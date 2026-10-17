import { useT } from "@common/i18n/useT";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import classnames from "classnames";

import type { DocumentProps } from "@renderer/features/documents/DocumentsContainer";
import { Button } from "@renderer/controls/Button";
import { SmallIconButton } from "@renderer/controls/IconButton";
import { useSelector } from "@renderer/core/RendererProvider";
import {
  DataLabel,
  DataPanel,
  DataRow,
  DataSecondary,
  DataValue,
  EmptyState,
  PanelHeader,
  PanelHeaderActions
} from "@renderer/controls/data";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { useDocumentHubService } from "@renderer/appIde/services/DocumentServiceProvider";
import { useMainApi } from "@renderer/core/MainApi";
import { useEmuApi } from "@renderer/core/EmuApi";
import { openStaticMemoryDump } from "@renderer/features/memory/StaticMemoryDump";
import { toHexa4 } from "@renderer/appIde/services/ide-commands";
import {
  peekAnnotationSession,
  seedReadOnlyAnnotationSession,
  subscribeAnnotationSession
} from "@renderer/appIde/annotations/annotationSession";
import { checkRomSidecar, type RomSidecarCheck } from "@renderer/appIde/annotations/romSidecarCheck";
import { matchRomPages, type RomPageMatch } from "@renderer/appIde/annotations/romSidecarMatch";
import { shippedChangedSince } from "@renderer/appIde/annotations/romWorkingCopy";
import {
  getRomProvenanceMode,
  setRomProvenanceMode,
  subscribeRomProvenanceMode
} from "@renderer/appIde/annotations/romSidecarWriter";
import { SHIPPED_ROM_FOLDER, WORKING_ROM_FOLDER } from "@renderer/appIde/annotations/romAnnotationLoader";
import { parseAnnotations } from "@renderer/appIde/annotations/programAnnotations";
import { requestRomAnnotationsReload } from "@renderer/appIde/annotations/romAnnotations";

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
 * Above the pages: whether the file is ready to be copied into `src/public/roms/` (R7), the
 * provenance a new entry is recorded with (R6), and a notice when the shipped sidecar has changed
 * since the working copy was made (T5).
 */

export type RomAnnotationEditorViewState = {
  /** The sidecar, for an editor opened by path (a working copy is not a project file). */
  sidecarPath?: string;
};

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

function fileNameOf(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

const RomAnnotationEditorPanel = ({ document, viewState }: DocumentProps<RomAnnotationEditorViewState>) => {
  const t = useT();
  const path = viewState?.sidecarPath ?? document?.node?.fullPath ?? document?.path ?? "";
  const { projectService } = useAppServices();
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
  const provenanceMode = useSyncExternalStore(subscribeRomProvenanceMode, getRomProvenanceMode);
  // --- Where "Next unlabelled target" got to, per page
  const nextTarget = useRef(new Map<number, number>());

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
    void checkRomSidecar(loaded.text, (page) => matches.find((m) => m.page === page)?.bytes).then((result) => {
      if (!cancelled) setCheck(result);
    });
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
        t("panels.rom.pageTitle", { file: fileNameOf(path).replace(/\.dis$/i, ""), page: match.page }),
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
      const after = nextTarget.current.get(match.page) ?? -1;
      const target = targets.find((t) => t > after) ?? targets[0];
      nextTarget.current.set(match.page, target);
      void openPage(match, "disassembly", target);
    },
    [check, openPage]
  );

  const labelCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const [page, bank] of Object.entries<any>(raw?.banks ?? {})) {
      counts.set(Number(page), (bank.localLabels ?? []).length);
    }
    return counts;
  }, [raw]);

  if (loaded.status === "loading") return <EmptyState message={t("panels.rom.loading")} motif={false} />;
  if (loaded.status === "error") return <EmptyState message={loaded.message} tone="error" motif={false} />;
  if (!isRomSidecar) {
    return <EmptyState message={t("panels.rom.notRomSidecar", { file: fileNameOf(path) })} tone="error" />;
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
            ? t("panels.rom.noMatch", { file: fileNameOf(path), crcs: crcs || t("panels.rom.noCrcs"), searched })
            : t("panels.rom.noMatchNothingSearched", { file: fileNameOf(path), crcs: crcs || t("panels.rom.noCrcs") })
        }
        tone="error"
      />
    );
  }

  const ready = check && check.problems.length === 0;
  const measured = check ? Math.min(...Object.values(check.levels), 2) : undefined;
  const readinessText = !check
    ? t("panels.rom.checking")
    : ready
      ? t("panels.rom.ready", { level: measured ?? 0 })
      : t("panels.rom.problems", { count: check.problems.length, level: measured ?? 0 });
  return (
    <DataPanel xclass={styles.panel}>
      <PanelHeader title={t("panels.rom.title")}>
        <PanelHeaderActions>
          {!readOnly && (
            <span className={styles.mode} title={t("panels.rom.modeTitle")}>
              {t("panels.rom.newEntries")}
              <button
                type="button"
                className={classnames(styles.modeButton, { [styles.modeActive]: provenanceMode === "observed" })}
                onClick={() => setRomProvenanceMode("observed")}
              >
                {t("panels.rom.observed")}
              </button>
              <button
                type="button"
                className={classnames(styles.modeButton, { [styles.modeActive]: provenanceMode === "manual" })}
                onClick={() => setRomProvenanceMode("manual")}
              >
                {t("panels.rom.manual")}
              </button>
            </span>
          )}
        </PanelHeaderActions>
      </PanelHeader>

      <div className={styles.summary}>
        <DataRow>
          <DataLabel text={t("panels.helpers.heading.file")} />
          <DataValue text={path} />
          {/* --- Only a file on disk can be revealed: `roms/…` is relative to Klive's own folder */}
          {isAbsolutePath(path) && (
            <SmallIconButton
              iconName="folder-opened"
              title={isWindows ? t("panels.rom.revealExplorer") : t("panels.rom.revealFinder")}
              clicked={() => void mainApi.showItemInFolder(path)}
            />
          )}
        </DataRow>
        <DataRow>
          <DataLabel text={t("panels.tape.fact.kind")} />
          <DataValue
            text={
              location === "working"
                ? t("panels.rom.kindWorking")
                : location === "shipped"
                  ? t("panels.rom.kindShipped")
                  : t("panels.rom.kindCustom")
            }
          />
        </DataRow>
        <DataRow>
          <DataLabel text={t("panels.rom.readyLabel")} />
          <DataValue text={readinessText}>
            {!check ? (
              t("panels.rom.checking")
            ) : (
              <button
                type="button"
                className={classnames(styles.chip, ready ? styles.chipReady : styles.chipProblems)}
                onClick={() => setShowProblems((shown) => !shown)}
                title={ready ? t("panels.rom.readyTitle") : t("panels.rom.showProblems")}
              >
                {readinessText}
              </button>
            )}
            {check && <DataSecondary text={` ${t("panels.rom.recordsLevel", { level: check.recordedLevel })}`} />}
          </DataValue>
        </DataRow>
        {showProblems && check && check.problems.length > 0 && (
          <ul className={styles.problems}>
            {check.problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        )}
        {shippedChanged && (
          <div className={styles.notice}>
            {t("panels.rom.shippedChanged", { file: fileNameOf(path) })}
          </div>
        )}
        {!readOnly && (
          <div className={styles.rule}>
            {t("panels.rom.rule")}
          </div>
        )}
      </div>

      <div className={styles.pages}>
        {matches.map((match, index) => {
          const targets = check?.unlabelledTargets[String(match.page)] ?? [];
          return (
            <DataRow key={match.page} index={index} xclass={styles.pageRow}>
              <DataLabel text={t("panels.rom.page", { page: match.page })} />
              <DataValue text={match.name ?? ""} />
              <DataSecondary text={`CRC ${match.crc32}`} />
              {match.bytes ? (
                <>
                  <DataSecondary
                    text={t("panels.rom.pageFacts", {
                      kb: match.bytes.length / 1024,
                      labels: labelCounts.get(match.page) ?? 0,
                      level: String(check?.levels[String(match.page)] ?? "?"),
                      from: match.foundAt
                    })}
                  />
                  <span className={styles.actions}>
                    <Button text={t("panels.helpers.view.disassembly")} variant="secondary" clicked={() => void openPage(match, "disassembly")} />
                    <Button text={t("panels.helpers.view.memory")} variant="secondary" clicked={() => void openPage(match, "memory")} />
                    {!readOnly && targets.length > 0 && (
                      <Button
                        text={t("panels.rom.nextUnlabelled", {
                          address: `$${toHexa4(
                            targets.find((target) => target > (nextTarget.current.get(match.page) ?? -1)) ?? targets[0]
                          )}`
                        })}
                        variant="secondary"
                        clicked={() => openNextUnlabelled(match)}
                      />
                    )}
                  </span>
                </>
              ) : (
                <DataSecondary
                  xclass={styles.missing}
                  text={t("panels.rom.pageMissing", { crc: match.crc32, searched: match.searched.join("; ") })}
                />
              )}
            </DataRow>
          );
        })}
      </div>
    </DataPanel>
  );
};

export const createRomAnnotationEditorPanel = ({ document, contents, viewState }: DocumentProps) => (
  <RomAnnotationEditorPanel
    document={document}
    contents={contents}
    viewState={viewState as RomAnnotationEditorViewState}
    apiLoaded={() => {}}
  />
);
