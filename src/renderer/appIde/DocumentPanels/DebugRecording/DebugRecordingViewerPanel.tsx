import { t as translate, uiLocale } from "@common/i18n/i18n";
import { labelRecord } from "@common/i18n/labels";
import { useT } from "@common/i18n/useT";
import { useEffect, useState } from "react";
import type { DocumentProps } from "@renderer/features/documents/DocumentsContainer";
import type { GenericFileContext } from "../helpers/GenericFilePanel";
import type { DebugRecordingReadResult } from "@common/debugRecording/debugRecordingFile";
import type { DebugRecordingCompatibility } from "@common/debugRecording/debugRecordingTypes";

import { GenericFilePanel } from "../helpers/GenericFilePanel";
import { ExpandableRow } from "@renderer/controls/layout/ExpandableRow";
import { LabeledText } from "@renderer/controls/layout/LabeledText";
import { LabeledFlag } from "@renderer/controls/layout/LabeledFlag";
import { Row } from "@renderer/controls/layout/Row";
import { Text } from "@renderer/controls/layout/Text";
import { ScreenCanvas } from "@renderer/controls/Next/ScreenCanvas";
import { toHexa4 } from "@renderer/appIde/services/ide-commands";
import { useEmuApi } from "@renderer/core/EmuApi";
import { useMainApi } from "@renderer/core/MainApi";
import { parseDebugRecording } from "@common/debugRecording/debugRecordingFile";
import { formatReverseSeconds } from "@common/history/reverseDebugText";
import { MEDIA_DISK_A, MEDIA_DISK_B, MEDIA_SD_CARD, MEDIA_TAPE } from "@common/structs/project-const";

/*
 * The debug recording (`.klr`) viewer (`.plans/DEBUG_SESSION_RECORDING_PLAN.md` D19): the screen at
 * the saved moment, the machine, the Klive build, how long and how much it recorded, its breakpoints,
 * media and sources, the note - and whether this build can replay it, which the emulator can tell
 * when it runs the recording's core (D3). It reads the file without inflating the timeline and runs
 * no core. Built only from the shared viewer primitives - no stylesheet, no colour, as the `.kls`
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
      <ExpandableRow
        heading={t("panels.debugRecording.heading")}
        initialExpanded={ctx.viewState?.summaryExpanded ?? true}
        onExpanded={(exp) => ctx.changeViewState((vs) => (vs.summaryExpanded = exp))}
      >
        <Row>
          <LabeledText label={t("panels.helpers.label.machine")} labelWidth={LABEL_WIDTH} value={h.machineName ?? h.machineId} />
        </Row>
        <Row>
          <LabeledText
            label={t("panels.helpers.label.saved")}
            labelWidth={LABEL_WIDTH}
            value={isNaN(savedAt.getTime()) ? h.savedAt : savedAt.toLocaleString(uiLocale())}
          />
        </Row>
        <Row>
          <LabeledText
            label={t("panels.helpers.label.savedBy")}
            labelWidth={LABEL_WIDTH}
            value={t("panels.debugRecording.savedBy", { version: h.kliveVersion, build: h.codeHash.slice(0, 8) })}
          />
        </Row>
        <Row>
          <LabeledText
            label={t("panels.debugRecording.length")}
            labelWidth={LABEL_WIDTH}
            value={t("panels.debugRecording.lengthValue", {
              duration: formatReverseSeconds(h.seconds),
              frames: Math.round(h.frames),
              instructions: h.records
            })}
          />
        </Row>
        <Row>
          <LabeledText
            label={t("panels.debugRecording.keyframes")}
            labelWidth={LABEL_WIDTH}
            value={t(
              h.sparse
                ? h.from
                  ? "panels.debugRecording.keyframesSparseTrimmed"
                  : "panels.debugRecording.keyframesSparse"
                : h.from
                  ? "panels.debugRecording.keyframesTrimmed"
                  : "panels.debugRecording.keyframesValue",
              { count: h.keyframes }
            )}
          />
        </Row>
        <Row>
          <LabeledText
            label={t("panels.debugRecording.opensAt")}
            labelWidth={LABEL_WIDTH}
            value={t(h.cursor ? "panels.debugRecording.opensAtCursor" : "panels.debugRecording.opensAtEnd", {
              pc: `$${toHexa4(h.pc)}`
            })}
          />
        </Row>
        <Row>
          <LabeledText label={t("panels.debugRecording.fileSize")} labelWidth={LABEL_WIDTH} value={sizeText(fileSize)} />
        </Row>
        <Row>
          <LabeledText label={t("panels.debugRecording.opensInBuild")} labelWidth={LABEL_WIDTH} value={compatibilityText(compatibility, h.coreId)} />
        </Row>
        {info.note && (
          <Row>
            <LabeledText label={t("panels.debugRecording.note")} labelWidth={LABEL_WIDTH} value={info.note} />
          </Row>
        )}
        {info.thumbnail && (
          <Row>
            <ScreenCanvas
              data={info.thumbnail.rgba}
              palette={[]}
              zoomFactor={info.thumbnail.width <= 200 ? 2 : 1}
              screenWidth={info.thumbnail.width}
              screenHeight={info.thumbnail.height}
              createPixelData={thumbnailPixels}
            />
          </Row>
        )}
      </ExpandableRow>
      <ExpandableRow
        heading={t("panels.debugRecording.breakpointsHeading")}
        initialExpanded={ctx.viewState?.debugExpanded ?? true}
        onExpanded={(exp) => ctx.changeViewState((vs) => (vs.debugExpanded = exp))}
      >
        <Row>
          <LabeledText label={t("panels.debugRecording.breakpoints")} labelWidth={LABEL_WIDTH} value={String(breakpoints.length)} />
        </Row>
        <Row>
          <LabeledText label={t("panels.debugRecording.watches")} labelWidth={LABEL_WIDTH} value={String(watches.length)} />
        </Row>
        <Row>
          <Text text={t("panels.debugRecording.breakpointsNote")} />
        </Row>
      </ExpandableRow>
      <ExpandableRow
        heading={t("panels.helpers.heading.media")}
        initialExpanded={ctx.viewState?.mediaExpanded ?? true}
        onExpanded={(exp) => ctx.changeViewState((vs) => (vs.mediaExpanded = exp))}
      >
        {info.media.length === 0 && (
          <Row>
            <Text text={t("panels.helpers.media.none")} />
          </Row>
        )}
        {info.media.map((m) => (
          <Row key={m.id}>
            <LabeledText label={MEDIA_NAMES[m.id] ?? `${m.id}:`} labelWidth={LABEL_WIDTH} value={m.fileName ?? "-"} />
          </Row>
        ))}
        {info.media.some((m) => m.id === MEDIA_SD_CARD) && (
          <Row>
            <Text text={t("panels.debugRecording.sdCardNote")} />
          </Row>
        )}
        <Row>
          <LabeledFlag label={t("panels.debugRecording.privateData")} labelWidth={LABEL_WIDTH} value={true} />
        </Row>
        <Row>
          <Text text={t("panels.debugRecording.privateNote")} />
        </Row>
      </ExpandableRow>
      <ExpandableRow
        heading={t("panels.debugRecording.sources")}
        initialExpanded={ctx.viewState?.sourcesExpanded ?? false}
        onExpanded={(exp) => ctx.changeViewState((vs) => (vs.sourcesExpanded = exp))}
      >
        {!sources?.files.length && (
          <Row>
            <Text text={t("panels.debugRecording.noSources")} />
          </Row>
        )}
        {sources?.mainFile && (
          <Row>
            <LabeledText label={t("panels.debugRecording.mainFile")} labelWidth={LABEL_WIDTH} value={sources.mainFile} />
          </Row>
        )}
        {sources?.files.map((f) => (
          <Row key={f.path}>
            <LabeledText
              label={f.text !== undefined ? t("panels.debugRecording.embedded") : t("panels.debugRecording.identified")}
              labelWidth={LABEL_WIDTH} value={f.path} />
          </Row>
        ))}
      </ExpandableRow>
      <ExpandableRow
        heading={t("panels.helpers.heading.file")}
        initialExpanded={ctx.viewState?.fileExpanded ?? false}
        onExpanded={(exp) => ctx.changeViewState((vs) => (vs.fileExpanded = exp))}
      >
        <Row>
          <LabeledText label={t("panels.helpers.label.machineId")} labelWidth={LABEL_WIDTH} value={`${h.machineId}${h.modelId ? ` / ${h.modelId}` : ""}`} />
        </Row>
        <Row>
          <LabeledText label={t("panels.helpers.label.core")} labelWidth={LABEL_WIDTH} value={h.coreId} />
        </Row>
        <Row>
          <LabeledText label={t("panels.helpers.label.fingerprint")} labelWidth={LABEL_WIDTH} value={h.fingerprint} />
        </Row>
        <Row>
          <LabeledText label={t("panels.debugRecording.codeHash")} labelWidth={LABEL_WIDTH} value={h.codeHash} />
        </Row>
        <Row>
          <LabeledText
            label={t("panels.debugRecording.sections")}
            labelWidth={LABEL_WIDTH}
            value={Object.entries(info.sectionSizes)
              .filter(([tag]) => tag !== "END")
              .map(([tag, size]) => `${tag} ${sizeText(size)}`)
              .join(" · ")}
          />
        </Row>
        {info.unknownSections.length > 0 && (
          <Row>
            <LabeledText label={t("panels.helpers.label.unknownSections")} labelWidth={LABEL_WIDTH} value={info.unknownSections.join(", ")} />
          </Row>
        )}
      </ExpandableRow>
    </>
  );
};
