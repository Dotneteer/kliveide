import { t as translate, uiLocale } from "@common/i18n/i18n";
import { labelRecord } from "@common/i18n/labels";
import { useT } from "@common/i18n/useT";
import { useEffect, useState } from "react";
import type { DocumentProps } from "@renderer/features/documents/DocumentsContainer";
import type { GenericFileContext } from "../helpers/GenericFilePanel";
import type { DebugRecordingReadResult } from "@common/debugRecording/debugRecordingFile";
import type { DebugRecordingCompatibility } from "@common/debugRecording/debugRecordingTypes";

import { GenericFilePanel } from "../helpers/GenericFilePanel";
import { Fact, FactFlag, FactNote, Facts, FactSection, FactsWithPicture } from "@renderer/controls/data/FileFacts";
import { ScreenCanvas } from "@renderer/controls/Next/ScreenCanvas";
import { toHexa4 } from "@renderer/appIde/services/ide-commands";
import { useEmuApi } from "@renderer/core/EmuApi";
import { useMainApi } from "@renderer/core/MainApi";
import { parseDebugRecording } from "@common/debugRecording/debugRecordingFile";
import { formatReverseSeconds } from "@common/history/reverseDebugText";
import { MEDIA_DISK_A, MEDIA_DISK_B, MEDIA_SD_CARD, MEDIA_TAPE } from "@common/structs/project-const";

/*
 * The debug recording (`.klr`) viewer (`dev/plans/DEBUG_SESSION_RECORDING_PLAN.md` D19): the screen at
 * the saved moment, the machine, the Klive build, how long and how much it recorded, its breakpoints,
 * media and sources, the note - and whether this build can replay it, which the emulator can tell
 * when it runs the recording's core (D3). It reads the file without inflating the timeline and runs
 * no core. Built from the shared file-facts primitives (`controls/data/FileFacts`), as the `.kls`
 * viewer.
 */

/* --- M2: `ch`, not px */
const LABEL_WIDTH = "18ch";

type DebugRecordingViewState = {
  scrollPosition?: number;
  summaryExpanded?: boolean;
  debugExpanded?: boolean;
  mediaExpanded?: boolean;
  sourcesExpanded?: boolean;
  fileExpanded?: boolean;
};

type ViewContext = GenericFileContext<DebugRecordingReadResult, DebugRecordingViewState>;

/** Reads a recording for the viewer (its header parts only); a broken file is reported, not thrown */
export function loadDebugRecordingFileContents(contents: Uint8Array): {
  fileInfo?: DebugRecordingReadResult;
  error?: string;
} {
  try {
    return { fileInfo: parseDebugRecording(contents, { headerOnly: true }) };
  } catch (err) {
    return {
      error: translate("panels.debugRecording.invalid", {
        reason: err instanceof Error ? err.message : String(err)
      })
    };
  }
}

/** Copies a thumbnail's RGBA bytes into the canvas's ABGR words (the same byte order) */
function thumbnailPixels(data: Uint8Array, _palette: number[], target: Uint32Array): void {
  target.set(new Uint32Array(data.buffer, data.byteOffset, Math.floor(data.byteLength / 4)));
}

const MEDIA_NAMES: Readonly<Record<string, string>> = labelRecord({
  [MEDIA_TAPE]: "panels.helpers.media.tape",
  [MEDIA_DISK_A]: "panels.helpers.media.diskA",
  [MEDIA_DISK_B]: "panels.helpers.media.diskB",
  [MEDIA_SD_CARD]: "panels.helpers.media.sdCard"
});

/** The words for whether this build opens the recording */
export function compatibilityText(c: DebugRecordingCompatibility | undefined, coreId: string): string {
  if (!c) return translate("panels.debugRecording.checking");
  if (!c.known) {
    return c.liveCoreId
      ? translate("panels.debugRecording.unknownOtherCore", { liveCore: c.liveCoreId, core: coreId })
      : translate("panels.debugRecording.unknownNoMachine", { core: coreId });
  }
  return c.refusal
    ? translate("panels.debugRecording.refused", { reason: c.refusal })
    : translate("panels.debugRecording.compatible");
}

/** A size for people: in the display language's number format */
function sizeText(bytes: number): string {
  return bytes >= 1048576
    ? translate("panels.debugRecording.sizeMb", {
        mb: (bytes / 1048576).toLocaleString(uiLocale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 })
      })
    : translate("panels.debugRecording.sizeKb", { kb: Math.ceil(bytes / 1024) });
}

const DebugRecordingViewerPanel = ({ document, contents, viewState }: DocumentProps<DebugRecordingViewState>) => (
  <GenericFilePanel<DebugRecordingReadResult, DebugRecordingViewState>
    document={document}
    contents={contents}
    viewState={viewState}
    apiLoaded={() => {}}
    fileLoader={(bytes) => loadDebugRecordingFileContents(bytes)}
    validRenderer={(ctx) => <RecordingView ctx={ctx} fileSize={contents?.length ?? 0} />}
  />
);

export const createDebugRecordingViewerPanel = ({ document, contents, viewState }: DocumentProps) => (
  <DebugRecordingViewerPanel document={document} contents={contents} viewState={viewState} apiLoaded={() => {}} />
);

/** A module-level component, so it may hold state (see `GenericFilePanel`'s renderer note) */
const RecordingView = ({ ctx, fileSize }: { ctx: ViewContext; fileSize: number }) => {
  const t = useT();
  const emuApi = useEmuApi();
  const mainApi = useMainApi();
  const info = ctx.fileInfo;
  const h = info?.header;
  const [compatibility, setCompatibility] = useState<DebugRecordingCompatibility>();
  useEffect(() => {
    if (!h) return undefined;
    let canceled = false;
    (async () => {
      const version = await mainApi.getAppVersion().catch(() => "");
      const result = await emuApi.checkDebugRecording(h, version);
      if (!canceled) setCompatibility(result);
    })().catch(() => !canceled && setCompatibility({ known: false }));
    return () => {
      canceled = true;
    };
  }, [h, emuApi, mainApi]);
  if (!info || !h) return null;
  const savedAt = new Date(h.savedAt);
  const breakpoints = info.breakpoints?.breakpoints ?? [];
  const watches = info.breakpoints?.watches ?? [];
  const sources = info.sources;
  return (
    <>
      <FactSection
        title={t("panels.debugRecording.heading")}
        expanded={ctx.viewState?.summaryExpanded ?? true}
        onExpandedChange={(exp) => ctx.changeViewState((vs) => (vs.summaryExpanded = exp))}
      >
        <FactsWithPicture
          picture={
            info.thumbnail && (
              <ScreenCanvas
                data={info.thumbnail.rgba}
                palette={[]}
                zoomFactor={info.thumbnail.width <= 200 ? 2 : 1}
                screenWidth={info.thumbnail.width}
                screenHeight={info.thumbnail.height}
                createPixelData={thumbnailPixels}
              />
            )
          }
        >
          <Facts labelWidth={LABEL_WIDTH}>
            <Fact label={t("panels.helpers.label.machine")}>{h.machineName ?? h.machineId}</Fact>
            <Fact label={t("panels.helpers.label.saved")}>
              {isNaN(savedAt.getTime()) ? h.savedAt : savedAt.toLocaleString(uiLocale())}
            </Fact>
            <Fact label={t("panels.helpers.label.savedBy")}>
              {t("panels.debugRecording.savedBy", { version: h.kliveVersion, build: h.codeHash.slice(0, 8) })}
            </Fact>
            <Fact label={t("panels.debugRecording.length")}>
              {t("panels.debugRecording.lengthValue", {
                duration: formatReverseSeconds(h.seconds),
                frames: Math.round(h.frames),
                instructions: h.records
              })}
            </Fact>
            <Fact label={t("panels.debugRecording.keyframes")}>
              {t(
                h.sparse
                  ? h.from
                    ? "panels.debugRecording.keyframesSparseTrimmed"
                    : "panels.debugRecording.keyframesSparse"
                  : h.from
                    ? "panels.debugRecording.keyframesTrimmed"
                    : "panels.debugRecording.keyframesValue",
                { count: h.keyframes }
              )}
            </Fact>
            <Fact label={t("panels.debugRecording.opensAt")} tone="state">
              {t(h.cursor ? "panels.debugRecording.opensAtCursor" : "panels.debugRecording.opensAtEnd", {
                pc: `$${toHexa4(h.pc)}`
              })}
            </Fact>
            <Fact label={t("panels.debugRecording.fileSize")}>{sizeText(fileSize)}</Fact>
            <Fact label={t("panels.debugRecording.opensInBuild")}>{compatibilityText(compatibility, h.coreId)}</Fact>
            {info.note && <Fact label={t("panels.debugRecording.note")}>{info.note}</Fact>}
          </Facts>
        </FactsWithPicture>
      </FactSection>
      <FactSection
        title={t("panels.debugRecording.breakpointsHeading")}
        expanded={ctx.viewState?.debugExpanded ?? true}
        onExpandedChange={(exp) => ctx.changeViewState((vs) => (vs.debugExpanded = exp))}
      >
        <Facts labelWidth={LABEL_WIDTH}>
          <Fact label={t("panels.debugRecording.breakpoints")}>{breakpoints.length}</Fact>
          <Fact label={t("panels.debugRecording.watches")}>{watches.length}</Fact>
        </Facts>
        <FactNote>{t("panels.debugRecording.breakpointsNote")}</FactNote>
      </FactSection>
      <FactSection
        title={t("panels.helpers.heading.media")}
        meta={info.media.length || undefined}
        expanded={ctx.viewState?.mediaExpanded ?? true}
        onExpandedChange={(exp) => ctx.changeViewState((vs) => (vs.mediaExpanded = exp))}
      >
        <Facts labelWidth={LABEL_WIDTH}>
          {info.media.map((m) => (
            <Fact key={m.id} label={MEDIA_NAMES[m.id] ?? `${m.id}:`}>
              {m.fileName ?? "-"}
            </Fact>
          ))}
          <FactFlag label={t("panels.debugRecording.privateData")} value={true} />
        </Facts>
        {info.media.length === 0 && <FactNote>{t("panels.helpers.media.none")}</FactNote>}
        {info.media.some((m) => m.id === MEDIA_SD_CARD) && <FactNote>{t("panels.debugRecording.sdCardNote")}</FactNote>}
        <FactNote>{t("panels.debugRecording.privateNote")}</FactNote>
      </FactSection>
      <FactSection
        title={t("panels.debugRecording.sources")}
        meta={sources?.files.length || undefined}
        expanded={ctx.viewState?.sourcesExpanded ?? false}
        onExpandedChange={(exp) => ctx.changeViewState((vs) => (vs.sourcesExpanded = exp))}
      >
        {!sources?.files.length && <FactNote>{t("panels.debugRecording.noSources")}</FactNote>}
        {!!(sources?.mainFile || sources?.files.length) && (
          <Facts labelWidth={LABEL_WIDTH}>
            {sources?.mainFile && <Fact label={t("panels.debugRecording.mainFile")}>{sources.mainFile}</Fact>}
            {sources?.files.map((f) => (
              <Fact
                key={f.path}
                label={f.text !== undefined ? t("panels.debugRecording.embedded") : t("panels.debugRecording.identified")}
              >
                {f.path}
              </Fact>
            ))}
          </Facts>
        )}
      </FactSection>
      <FactSection
        title={t("panels.helpers.heading.file")}
        expanded={ctx.viewState?.fileExpanded ?? false}
        onExpandedChange={(exp) => ctx.changeViewState((vs) => (vs.fileExpanded = exp))}
      >
        <Facts labelWidth={LABEL_WIDTH}>
          <Fact label={t("panels.helpers.label.machineId")}>{`${h.machineId}${h.modelId ? ` / ${h.modelId}` : ""}`}</Fact>
          <Fact label={t("panels.helpers.label.core")}>{h.coreId}</Fact>
          <Fact label={t("panels.helpers.label.fingerprint")}>{h.fingerprint}</Fact>
          <Fact label={t("panels.debugRecording.codeHash")}>{h.codeHash}</Fact>
          <Fact label={t("panels.debugRecording.sections")}>
            {Object.entries(info.sectionSizes)
              .filter(([tag]) => tag !== "END")
              .map(([tag, size]) => `${tag} ${sizeText(size)}`)
              .join(" · ")}
          </Fact>
          {info.unknownSections.length > 0 && (
            <Fact label={t("panels.helpers.label.unknownSections")}>{info.unknownSections.join(", ")}</Fact>
          )}
        </Facts>
      </FactSection>
    </>
  );
};
