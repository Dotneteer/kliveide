import { useT } from "@common/i18n/useT";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import classnames from "classnames";

import type { DocumentProps } from "@renderer/features/documents/DocumentsContainer";
import { Button } from "@renderer/controls/Button";
import ScrollViewer from "@renderer/controls/ScrollViewer";
import { SmallIconButton } from "@renderer/controls/IconButton";
import { useSelector } from "@renderer/core/RendererProvider";
import { DataPanel, EmptyState, PanelHeader, PanelHeaderActions } from "@renderer/controls/data";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { useDocumentHubService } from "@renderer/appIde/services/DocumentServiceProvider";
import { useMainApi } from "@renderer/core/MainApi";
import { useEmuApi } from "@renderer/core/EmuApi";
import { openStaticMemoryDump } from "@renderer/features/memory/StaticMemoryDump";
import { toHexa4 } from "@renderer/appIde/services/ide-commands";
import {
  flushAnnotationSession,
  peekAnnotationSession,
  seedReadOnlyAnnotationSession,
  subscribeAnnotationSession
} from "@renderer/appIde/annotations/annotationSession";
import {
  checkRomSidecar,
  type RomSidecarCheck
} from "@renderer/appIde/annotations/romSidecarCheck";
import { matchRomPages, type RomPageMatch } from "@renderer/appIde/annotations/romSidecarMatch";
import { shippedChangedSince } from "@renderer/appIde/annotations/romWorkingCopy";
import {
  getRomProvenanceMode,
  setRomProvenanceMode,
  subscribeRomProvenanceMode
} from "@renderer/appIde/annotations/romSidecarWriter";
import {
  SHIPPED_ROM_FOLDER,
  WORKING_ROM_FOLDER
} from "@renderer/appIde/annotations/romAnnotationLoader";
import { parseAnnotations } from "@renderer/appIde/annotations/programAnnotations";
import { requestRomAnnotationsReload } from "@renderer/appIde/annotations/romAnnotations";
import {
  romExportVerdictText,
  runRomSourceExport
} from "@renderer/appIde/annotations/romSourceExport";

import { HoverCard } from "@renderer/controls/HoverCard";
import { RomLevelCard } from "./RomLevelCard";
import styles from "./RomAnnotationEditorPanel.module.scss";

/*
 * The ROM annotation editor (`.plans/ROM_ANNOTATION_EDITING_PLAN.md` R4, §4.1).
 *
 * Opened by selecting a ROM sidecar: a working copy in `<Klive home>/RomAnnotations/`, a custom ROM's
 * `<path>.dis`, or a shipped one. It matches the file's pages to ROM bytes by CRC and lists them; a
 * page opens as a bank document — the NEX viewer's, with every annotation dialog and shortcut — that
 * edits the file. A shipped sidecar is listed read-only: it is changed only through a working copy.
 * When no page matches, the editor is only a message saying what was searched.
 *
 * Two panes. The inspector column holds everything about the file: where it is and what kind (a
 * shipped sidecar is read-only and offers its working copy), whether it is ready to be copied into
 * `src/public/roms/` (R7) with its problems, the provenance a new entry is recorded with (R6), a
 * notice when the shipped sidecar has changed since the working copy was made (T5), and "Export as
 * source" (`romSourceExport.ts`, the same run as `rom-ann-export`). The pages list has one row per
 * page: its ROM and CRC, size, labels, how many call/jump targets still have no label (the level 1
 * to-do list, with a link to the next one), its level, and the views that open it. Below `108ch` the
 * inspector stacks above the list (a container query: the document's own width decides).
 */

export type RomAnnotationEditorViewState = {
  /** The sidecar, for an editor opened by path (a working copy is not a project file). */
  sidecarPath?: string;
};

/** Where the last "Export as source" got to. */
type ExportState =
  | { status: "running" }
  | { status: "failed"; message: string }
  | { status: "done"; file: string; verdict: string; identical: boolean; notes: string[] };

type Loaded =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "loaded"; text: string; raw: Record<string, any> };

/** Where the sidecar sits, which decides whether it may be edited and what a check means. */
export type RomSidecarLocation = "working" | "shipped" | "custom";

export function romSidecarLocationOf(path: string): RomSidecarLocation {
  // --- `roms/sp48.rom.dis`: a shipped sidecar named relative to the public folder
  if (path.startsWith(`${SHIPPED_ROM_FOLDER}/`)) return "shipped";
  const parts = path.split(/[\\/]/);
  const folder = parts[parts.length - 2];
  if (folder === WORKING_ROM_FOLDER) return "working";
  const parent = parts[parts.length - 3];
  // --- `src/public/roms` in development, `resources/roms` when packaged
  if (folder === "roms" && (parent === "public" || parent === "resources")) return "shipped";
  return "custom";
}

/** Whether a path names a file on disk rather than one relative to Klive's public folder. */
function isAbsolutePath(path: string): boolean {
  return /^([A-Za-z]:)?[\\/]/.test(path);
}

/**
 * Where each file's "next" links got to, per page. Kept outside the component: switching to the
 * page document a link opened and back remounts the editor, and the link must not start again.
 */
const visitedTargetsByFile = new Map<string, Record<number, number>>();

function fileNameOf(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

const RomAnnotationEditorPanel = ({
  document,
  viewState
}: DocumentProps<RomAnnotationEditorViewState>) => {
  const t = useT();
  const path = viewState?.sidecarPath ?? document?.node?.fullPath ?? document?.path ?? "";
  const { projectService, ideCommandsService } = useAppServices();
  const documentHubService = useDocumentHubService();
  // --- Read through refs: the effects below must not re-run because a hook handed back a new object
  const apis = useRef({ mainApi: useMainApi(), emuApi: useEmuApi() });
  const { mainApi, emuApi } = apis.current;
  const location = romSidecarLocationOf(path);
  const isWindows = useSelector((s) => !!s.isWindows);
  const readOnly = location === "shipped";

  const [loaded, setLoaded] = useState<Loaded>({ status: "loading" });
  const [matches, setMatches] = useState<RomPageMatch[] | undefined>();
  const [check, setCheck] = useState<RomSidecarCheck | undefined>();
  const [shippedChanged, setShippedChanged] = useState<boolean | undefined>();
  const [showProblems, setShowProblems] = useState(false);
  const [exportState, setExportState] = useState<ExportState | undefined>();
  const provenanceMode = useSyncExternalStore(subscribeRomProvenanceMode, getRomProvenanceMode);
  // --- Where the "next" link got to, per page: state, so the link shows the target it opens next
  const [visitedTargets, setVisitedTargets] = useState<Record<number, number>>(
    () => visitedTargetsByFile.get(path) ?? {}
  );

  // --- The file, read again whenever its session publishes (an edit from any page document)
  useEffect(() => {
    if (!path) {
      setLoaded({ status: "error", message: t("panels.rom.noFile") });
      return undefined;
    }
    let cancelled = false;
    const publicRelative = path.startsWith(`${SHIPPED_ROM_FOLDER}/`);
    const read = async () => {
      try {
        const contents = publicRelative
          ? await mainApi.readTextFile(path)
          : await projectService.readFileContent(path, false);
        if (cancelled) return;
        if (typeof contents !== "string") throw new Error(t("panels.rom.notText"));
        // --- A shipped sidecar is shown, never written: its page documents read a read-only session
        if (location === "shipped" && !peekAnnotationSession(path)) {
          const parsed = parseAnnotations(contents);
          if (parsed.annotations) seedReadOnlyAnnotationSession(path, parsed.annotations);
        }
        setLoaded({ status: "loaded", text: contents, raw: JSON.parse(contents) });
      } catch (err) {
        if (!cancelled) setLoaded({ status: "error", message: (err as Error).message });
      }
    };
    void read();
    if (location === "shipped") {
      return () => {
        cancelled = true;
      };
    }
    let seen: unknown;
    const unsubscribe = subscribeAnnotationSession(projectService, path, undefined, (snapshot) => {
      // --- After a write lands, the file on disk is the new text
      if (snapshot.dirty || snapshot.annotations === seen) return;
      seen = snapshot.annotations;
      void read();
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `t` only words an error; no re-read
  }, [location, mainApi, path, projectService]);

  const raw = loaded.status === "loaded" ? loaded.raw : undefined;
  const isRomSidecar = raw?.machine === "rom";

  // --- The pages, matched to ROM bytes once per file (the CRCs do not change with edits)
  const pagesKey = raw ? JSON.stringify(raw.pages ?? {}) : "";
  useEffect(() => {
    if (!raw || !isRomSidecar) return undefined;
    let cancelled = false;
    void matchRomPages({ files: mainApi, emuApi }, path, raw.pages ?? {}).then((found) => {
      if (!cancelled) setMatches(found);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the pages, not the whole file
  }, [pagesKey, isRomSidecar, path]);

  // --- The readiness check, after every edit
  useEffect(() => {
    if (loaded.status !== "loaded" || !isRomSidecar || !matches) return undefined;
    let cancelled = false;
    void checkRomSidecar(loaded.text, (page) => matches.find((m) => m.page === page)?.bytes).then(
      (result) => {
        if (!cancelled) setCheck(result);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [loaded, isRomSidecar, matches]);

  // --- Has an update moved the shipped sidecar on since this working copy was made?
  useEffect(() => {
    if (location !== "working") return undefined;
    let cancelled = false;
    void shippedChangedSince(mainApi, projectService, path, fileNameOf(path)).then((changed) => {
      if (!cancelled) setShippedChanged(changed);
    });
    return () => {
      cancelled = true;
    };
  }, [location, mainApi, path, projectService]);

  // --- A working copy that was copied in by hand is picked up by the live view once it is opened
  useEffect(() => {
    if (location !== "shipped" && isRomSidecar) requestRomAnnotationsReload();
  }, [location, isRomSidecar]);

  const openPage = useCallback(
    async (match: RomPageMatch, view: "disassembly" | "memory", topAddress?: number) => {
      if (!match.bytes) return;
      await openStaticMemoryDump(
        documentHubService,
        `rom:${path}:${match.page}`,
        t("panels.rom.pageTitle", {
          file: fileNameOf(path).replace(/\.dis$/i, ""),
          page: match.page
        }),
        match.bytes,
        {
          disassemblyEnabled: true,
          disassOffset: 0,
          viewMode: view,
          annotationPath: path,
          annotationBank: match.page,
          annotationMachine: "rom",
          ...(readOnly ? { annotationReadOnly: true } : {}),
          disassemblyFlavor: "rom",
          ...(match.kind ? { romPageKind: match.kind } : {}),
          ...(topAddress !== undefined ? { topAddress } : {})
        }
      );
    },
    [documentHubService, path, readOnly, t]
  );

  /** The next unlabelled control-transfer target of a page, cycling: the level 1 to-do list. */
  const openNextUnlabelled = useCallback(
    (match: RomPageMatch) => {
      const targets = check?.unlabelledTargets[String(match.page)] ?? [];
      if (targets.length === 0) return;
      const after = visitedTargets[match.page] ?? -1;
      const target = targets.find((t) => t > after) ?? targets[0];
      setVisitedTargets((visited) => {
        const next = { ...visited, [match.page]: target };
        visitedTargetsByFile.set(path, next);
        return next;
      });
      void openPage(match, "disassembly", target);
    },
    [check, openPage, path, visitedTargets]
  );

  /** Ask for a file, export every found page to it, and assemble it to check the bytes. */
  const exportAsSource = useCallback(async () => {
    if (!matches || loaded.status !== "loaded") return;
    // --- In the export folder every "Export as source" shares (`export.sourceFolder`)
    const file = await mainApi.showSourceExportDialog({
      title: t("panels.rom.exportDialogTitle"),
      defaultName: `${fileNameOf(path)
        .replace(/\.dis$/i, "")
        .replace(/\.rom$/i, "")}.kz80.asm`,
      filters: [{ name: t("panels.rom.exportFilter"), extensions: ["kz80.asm", "asm"] }]
    });
    if (!file) return;
    setExportState({ status: "running" });
    try {
      // --- What the page documents hold now: an edit still on its way to the file counts
      if (!readOnly) await flushAnnotationSession(path);
      const annotations = peekAnnotationSession(path) ?? parseAnnotations(loaded.text).annotations;
      if (!annotations) throw new Error(t("panels.rom.notRomSidecar", { file: fileNameOf(path) }));
      const run = await runRomSourceExport(mainApi, { path, annotations, matches }, file);
      setExportState({
        status: "done",
        file,
        verdict: romExportVerdictText(run.verdict),
        identical: run.verdict.kind === "identical",
        notes: run.notes
      });
    } catch (err) {
      setExportState({
        status: "failed",
        message: err instanceof Error ? err.message : String(err)
      });
    }
  }, [loaded, mainApi, matches, path, readOnly, t]);

  const labelCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const [page, bank] of Object.entries<any>(raw?.banks ?? {})) {
      counts.set(Number(page), (bank.localLabels ?? []).length);
    }
    return counts;
  }, [raw]);

  if (loaded.status === "loading")
    return <EmptyState message={t("panels.rom.loading")} motif={false} />;
  if (loaded.status === "error")
    return <EmptyState message={loaded.message} tone="error" motif={false} />;
  if (!isRomSidecar) {
    return (
      <EmptyState
        message={t("panels.rom.notRomSidecar", { file: fileNameOf(path) })}
        tone="error"
      />
    );
  }
  if (!matches) return <EmptyState message={t("panels.rom.lookingForRom")} motif={false} />;

  const matched = matches.filter((m) => m.bytes);
  if (matched.length === 0) {
    const crcs = matches.map((m) => m.crc32).join(", ");
    const searched = [...new Set(matches.flatMap((m) => m.searched))].join("; ");
    return (
      <EmptyState
        message={
          searched
            ? t("panels.rom.noMatch", {
                file: fileNameOf(path),
                crcs: crcs || t("panels.rom.noCrcs"),
                searched
              })
            : t("panels.rom.noMatchNothingSearched", {
                file: fileNameOf(path),
                crcs: crcs || t("panels.rom.noCrcs")
              })
        }
        tone="error"
      />
    );
  }

  const ready = check && check.problems.length === 0;
  const measured = check ? Math.min(...Object.values(check.levels), 2) : undefined;
  // --- The whole file's level card: its lowest page level, and what every page still lacks
  const fileLevelCard = () =>
    check && (
      <RomLevelCard
        kind="file"
        measured={measured}
        recorded={check.recordedLevel}
        note={ready ? t("panels.rom.readyTitle") : t("panels.rom.showProblems")}
        unlabelled={Object.values(check.unlabelledTargets).reduce((sum, list) => sum + list.length, 0)}
        withoutSynopsis={Object.values(check.labelsWithoutSynopsis).reduce((sum, n) => sum + n, 0)}
      />
    );
  const readinessText = !check
    ? t("panels.rom.checking")
    : ready
      ? t("panels.rom.ready", { level: measured ?? 0 })
      : t("panels.rom.problems", { count: check.problems.length, level: measured ?? 0 });
  // --- A shipped sidecar is named after its ROM (`roms/zx81.rom.dis`): what rom-ann-new takes
  const shippedRomName =
    location === "shipped" ? fileNameOf(path).replace(/\.dis$/i, "") : undefined;
  const badge =
    location === "working"
      ? { text: t("panels.rom.badgeWorking"), tone: styles.badgeAccent }
      : location === "shipped"
        ? { text: t("panels.rom.badgeShipped"), tone: styles.badgeReadOnly }
        : { text: t("panels.rom.badgeCustom"), tone: styles.badgeAccent };

  return (
    <DataPanel xclass={styles.panel}>
      <div className={styles.layout}>
        {/* --- The inspector: everything about the file */}
        <div className={styles.inspector}>
          <PanelHeader title={t("panels.rom.title")}>
            <PanelHeaderActions>
              <span className={classnames(styles.badge, badge.tone)}>{badge.text}</span>
            </PanelHeaderActions>
          </PanelHeader>

          <ScrollViewer className={styles.paneScroll} allowHorizontal={false} thinScrollBar={true}>
            <div className={styles.inspectorBody}>
              <section className={styles.section}>
                <span className={styles.sectionLabel}>{t("panels.helpers.heading.file")}</span>
                <span className={styles.fileLine}>
                  <span className={styles.path}>{path}</span>
                  {/* --- Only a file on disk can be revealed: `roms/…` is relative to Klive's own folder */}
                  {isAbsolutePath(path) && (
                    <SmallIconButton
                      iconName="folder-opened"
                      title={
                        isWindows ? t("panels.rom.revealExplorer") : t("panels.rom.revealFinder")
                      }
                      clicked={() => void mainApi.showItemInFolder(path)}
                    />
                  )}
                </span>
                <span className={styles.secondary}>
                  {location === "working"
                    ? t("panels.rom.kindWorking")
                    : location === "shipped"
                      ? t("panels.rom.kindShipped")
                      : t("panels.rom.kindCustom")}
                </span>
                {shippedRomName && (
                  <span className={styles.sectionAction}>
                    <Button
                      text={t("panels.rom.makeWorkingCopy")}
                      variant="secondary"
                      clicked={() =>
                        void ideCommandsService.executeCommand(`rom-ann-new ${shippedRomName}`)
                      }
                    />
                  </span>
                )}
                {shippedChanged && (
                  <div className={styles.notice}>
                    {t("panels.rom.shippedChanged", { file: fileNameOf(path) })}
                  </div>
                )}
              </section>

              <section className={styles.section}>
                <span className={styles.sectionLabel}>{t("panels.rom.readyLabel")}</span>
                {!check ? (
                  <span className={styles.secondary}>{t("panels.rom.checking")}</span>
                ) : (
                  <HoverCard content={fileLevelCard}>
                    <button
                      type="button"
                      className={classnames(
                        styles.chip,
                        ready ? styles.chipReady : styles.chipProblems
                      )}
                      onClick={() => setShowProblems((shown) => !shown)}
                      aria-expanded={ready ? undefined : showProblems}
                    >
                      {readinessText}
                    </button>
                  </HoverCard>
                )}
                {check && (
                  <HoverCard className={styles.secondary} tabIndex={0} content={fileLevelCard}>
                    {t("panels.rom.recordsLevel", { level: check.recordedLevel })}
                  </HoverCard>
                )}
                {showProblems && check && check.problems.length > 0 && (
                  <ul className={styles.problems}>
                    {check.problems.map((problem) => (
                      <li key={problem}>{problem}</li>
                    ))}
                  </ul>
                )}
              </section>

              {!readOnly && (
                <section className={styles.section}>
                  <span className={styles.sectionLabel} title={t("panels.rom.modeTitle")}>
                    {t("panels.rom.newEntriesLabel")}
                  </span>
                  <span className={styles.segmented}>
                    <button
                      type="button"
                      className={classnames(styles.segment, {
                        [styles.segmentActive]: provenanceMode === "observed"
                      })}
                      aria-pressed={provenanceMode === "observed"}
                      onClick={() => setRomProvenanceMode("observed")}
                    >
                      {t("panels.rom.observed")}
                    </button>
                    <button
                      type="button"
                      className={classnames(styles.segment, {
                        [styles.segmentActive]: provenanceMode === "manual"
                      })}
                      aria-pressed={provenanceMode === "manual"}
                      onClick={() => setRomProvenanceMode("manual")}
                    >
                      {t("panels.rom.manual")}
                    </button>
                  </span>
                </section>
              )}

              <section className={styles.section}>
                <span className={styles.sectionLabel}>{t("panels.rom.sourceLabel")}</span>
                <span className={styles.sectionAction} title={t("panels.rom.exportSourceTitle")}>
                  <Button
                    text={t("panels.rom.exportSource")}
                    variant="secondary"
                    disabled={exportState?.status === "running"}
                    clicked={() => void exportAsSource()}
                  />
                </span>
                {!exportState && (
                  <span className={styles.secondary}>{t("panels.rom.notExported")}</span>
                )}
                {exportState?.status === "running" && (
                  <span className={styles.secondary}>{t("panels.rom.exporting")}</span>
                )}
                {exportState?.status === "failed" && (
                  <span className={styles.exportBad}>
                    {t("panels.rom.exportFailed", { message: exportState.message })}
                  </span>
                )}
                {exportState?.status === "done" && (
                  <>
                    <span className={exportState.identical ? styles.exportGood : styles.exportBad}>
                      {exportState.verdict}
                    </span>
                    <span className={styles.fileLine}>
                      <span className={styles.secondary}>
                        {t("panels.rom.exportedTo", { file: fileNameOf(exportState.file) })}
                      </span>
                      <Button
                        text={t("panels.rom.openExport")}
                        variant="secondary"
                        clicked={() =>
                          void ideCommandsService.executeCommand(
                            `nav "${exportState.file.replace(/"/g, '\\"')}"`
                          )
                        }
                      />
                    </span>
                    {exportState.notes.length > 0 && (
                      <span className={styles.secondary} title={exportState.notes.join("\n")}>
                        {t("panels.rom.exportNotes", { count: exportState.notes.length })}
                      </span>
                    )}
                  </>
                )}
              </section>

              {!readOnly && <div className={styles.rule}>{t("panels.rom.rule")}</div>}
            </div>
          </ScrollViewer>
        </div>

        {/* --- The pages: one row each */}
        <div className={styles.pagesPane}>
          <PanelHeader title={t("panels.rom.pagesTitle")}>
            <span className={styles.count}>{matches.length}</span>
          </PanelHeader>
          <ScrollViewer className={styles.paneScroll} thinScrollBar={true}>
            <div className={styles.pagesTable} role="table">
              <div className={classnames(styles.pageGrid, styles.columnHeads)} role="row">
                <span role="columnheader">{t("panels.rom.colPage")}</span>
                <span role="columnheader">{t("panels.rom.colRom")}</span>
                <span role="columnheader">{t("panels.rom.colSize")}</span>
                <span role="columnheader">{t("panels.rom.colLabels")}</span>
                <span role="columnheader" title={t("panels.rom.colToLabelTitle")}>
                  {t("panels.rom.colToLabel")}
                </span>
                <HoverCard role="columnheader" tabIndex={0} content={<RomLevelCard kind="legend" />}>
                  {t("panels.rom.colCompleteness")}
                </HoverCard>
                <span role="columnheader" />
              </div>
              {matches.map((match) => {
                const targets = check?.unlabelledTargets[String(match.page)];
                const level = check?.levels[String(match.page)];
                const next =
                  targets && targets.length > 0
                    ? (targets.find((target) => target > (visitedTargets[match.page] ?? -1)) ??
                      targets[0])
                    : undefined;
                return (
                  <div
                    key={match.page}
                    className={classnames(styles.pageGrid, styles.pageRow)}
                    role="row"
                  >
                    <span className={styles.pageNumber}>{match.page}</span>
                    <span
                      className={styles.romCell}
                      title={
                        match.foundAt ? t("panels.rom.foundIn", { from: match.foundAt }) : undefined
                      }
                    >
                      {match.name ?? ""} <span className={styles.secondary}>{match.crc32}</span>
                    </span>
                    {match.bytes ? (
                      <>
                        <span>{t("panels.rom.sizeKb", { kb: match.bytes.length / 1024 })}</span>
                        <span>{labelCounts.get(match.page) ?? 0}</span>
                        <span
                          className={classnames(styles.toLabel, {
                            [styles.secondary]: !targets?.length
                          })}
                        >
                          {targets === undefined
                            ? "…"
                            : targets.length > 0
                              ? targets.length
                              : t("panels.rom.toLabelNone")}
                          {!readOnly && next !== undefined && (
                            <button
                              type="button"
                              className={styles.nextLink}
                              title={t("panels.rom.nextTargetTitle")}
                              onClick={() => openNextUnlabelled(match)}
                            >
                              {t("panels.rom.nextTarget", { address: `$${toHexa4(next)}` })}
                            </button>
                          )}
                        </span>
                        <HoverCard
                          className={styles.completeness}
                          tabIndex={0}
                          content={() =>
                            level === undefined ? (
                              <RomLevelCard kind="legend" />
                            ) : (
                              <RomLevelCard
                                kind="page"
                                page={match.page}
                                measured={level}
                                unlabelled={targets?.length}
                                withoutSynopsis={check?.labelsWithoutSynopsis[String(match.page)]}
                              />
                            )
                          }
                        >
                          <span
                            className={styles.meter}
                            role="img"
                            aria-label={t("panels.rom.levelMeter", { level: level ?? 0 })}
                          >
                            <span
                              className={classnames(styles.meterStep, {
                                [styles.meterFilled]: (level ?? 0) >= 1
                              })}
                            />
                            <span
                              className={classnames(styles.meterStep, {
                                [styles.meterFilled]: (level ?? 0) >= 2
                              })}
                            />
                          </span>
                          <span>
                            {level === undefined ? "…" : t("panels.rom.levelValue", { level })}
                          </span>
                        </HoverCard>
                        <span className={styles.rowActions}>
                          <SmallIconButton
                            iconName="logs"
                            title={t("panels.helpers.view.disassembly")}
                            clicked={() => void openPage(match, "disassembly")}
                          />
                          <SmallIconButton
                            iconName="binary"
                            title={t("panels.helpers.view.memory")}
                            clicked={() => void openPage(match, "memory")}
                          />
                        </span>
                      </>
                    ) : (
                      <span className={styles.missing}>
                        {t("panels.rom.pageMissing", {
                          crc: match.crc32,
                          searched: match.searched.join("; ")
                        })}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollViewer>
        </div>
      </div>
    </DataPanel>
  );
};

export const createRomAnnotationEditorPanel = ({
  document,
  contents,
  viewState
}: DocumentProps) => (
  <RomAnnotationEditorPanel
    document={document}
    contents={contents}
    viewState={viewState as RomAnnotationEditorViewState}
    apiLoaded={() => {}}
  />
);
