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
    return { error: `Not a valid Klive debug recording: ${err instanceof Error ? err.message : String(err)}` };
  }
}

/** Copies a thumbnail's RGBA bytes into the canvas's ABGR words (the same byte order) */
function thumbnailPixels(data: Uint8Array, _palette: number[], target: Uint32Array): void {
  target.set(new Uint32Array(data.buffer, data.byteOffset, Math.floor(data.byteLength / 4)));
}

const MEDIA_NAMES: Record<string, string> = {
  [MEDIA_TAPE]: "Tape:",
  [MEDIA_DISK_A]: "Disk A:",
  [MEDIA_DISK_B]: "Disk B:",
  [MEDIA_SD_CARD]: "SD card:"
};

/** The words for whether this build opens the recording */
export function compatibilityText(c: DebugRecordingCompatibility | undefined, coreId: string): string {
  if (!c) return "Checking...";
  if (!c.known) {
    return `Not known yet: the emulator runs ${c.liveCoreId ? `the ${c.liveCoreId} core` : "no machine"}, not the ${coreId} core. Opening it checks.`;
  }
  return c.refusal ? `No. ${c.refusal}. Its end state can still be opened, without its past.` : "Yes: this build made it, or one with the same core.";
}

function sizeText(bytes: number): string {
  return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
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
        heading="Debug Recording"
        initialExpanded={ctx.viewState?.summaryExpanded ?? true}
        onExpanded={(exp) => ctx.changeViewState((vs) => (vs.summaryExpanded = exp))}
      >
        <Row>
          <LabeledText label="Machine:" labelWidth={LABEL_WIDTH} value={h.machineName ?? h.machineId} />
        </Row>
        <Row>
          <LabeledText label="Saved:" labelWidth={LABEL_WIDTH} value={isNaN(savedAt.getTime()) ? h.savedAt : savedAt.toLocaleString()} />
        </Row>
        <Row>
          <LabeledText label="Saved by:" labelWidth={LABEL_WIDTH} value={`Klive ${h.kliveVersion} (build ${h.codeHash.slice(0, 8)})`} />
        </Row>
        <Row>
          <LabeledText
            label="Length:"
            labelWidth={LABEL_WIDTH}
            value={`${formatReverseSeconds(h.seconds)} · ${Math.round(h.frames).toLocaleString("en-US")} frames · ${h.records.toLocaleString("en-US")} instructions`}
          />
        </Row>
        <Row>
          <LabeledText
            label="Keyframes:"
            labelWidth={LABEL_WIDTH}
            value={`${h.keyframes}${h.sparse ? " (sparse: about a second apart)" : ""}${h.from ? " (front trimmed)" : ""}`}
          />
        </Row>
        <Row>
          <LabeledText
            label="Opens at:"
            labelWidth={LABEL_WIDTH}
            value={`${h.cursor ? "the point it was saved at, in its past" : "its end"} (PC $${toHexa4(h.pc)} at the end)`}
          />
        </Row>
        <Row>
          <LabeledText label="File size:" labelWidth={LABEL_WIDTH} value={sizeText(fileSize)} />
        </Row>
        <Row>
          <LabeledText label="Opens in this build:" labelWidth={LABEL_WIDTH} value={compatibilityText(compatibility, h.coreId)} />
        </Row>
        {info.note && (
          <Row>
            <LabeledText label="Note:" labelWidth={LABEL_WIDTH} value={info.note} />
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
        heading="Breakpoints and Watches"
        initialExpanded={ctx.viewState?.debugExpanded ?? true}
        onExpanded={(exp) => ctx.changeViewState((vs) => (vs.debugExpanded = exp))}
      >
        <Row>
          <LabeledText label="Breakpoints:" labelWidth={LABEL_WIDTH} value={String(breakpoints.length)} />
        </Row>
        <Row>
          <LabeledText label="Watches:" labelWidth={LABEL_WIDTH} value={String(watches.length)} />
        </Row>
        <Row>
          <Text text="Opened, they are added as session breakpoints: the project's own stay, and none are saved into it." />
        </Row>
      </ExpandableRow>
      <ExpandableRow
        heading="Media"
        initialExpanded={ctx.viewState?.mediaExpanded ?? true}
        onExpanded={(exp) => ctx.changeViewState((vs) => (vs.mediaExpanded = exp))}
      >
        {info.media.length === 0 && (
          <Row>
            <Text text="No tape, disk or SD card." />
          </Row>
        )}
        {info.media.map((m) => (
          <Row key={m.id}>
            <LabeledText label={MEDIA_NAMES[m.id] ?? `${m.id}:`} labelWidth={LABEL_WIDTH} value={m.fileName ?? "-"} />
          </Row>
        ))}
        {info.media.some((m) => m.id === MEDIA_SD_CARD) && (
          <Row>
            <Text text="Every SD card sector the run read is in the recording: it replays without the card." />
          </Row>
        )}
        <Row>
          <LabeledFlag label="Private data:" labelWidth={LABEL_WIDTH} value={true} />
        </Row>
        <Row>
          <Text text="A recording holds every key typed and every tape and SD card sector read." />
        </Row>
      </ExpandableRow>
      <ExpandableRow
        heading="Sources"
        initialExpanded={ctx.viewState?.sourcesExpanded ?? false}
        onExpanded={(exp) => ctx.changeViewState((vs) => (vs.sourcesExpanded = exp))}
      >
        {!sources?.files.length && (
          <Row>
            <Text text="No compilation was recorded." />
          </Row>
        )}
        {sources?.mainFile && (
          <Row>
            <LabeledText label="Main file:" labelWidth={LABEL_WIDTH} value={sources.mainFile} />
          </Row>
        )}
        {sources?.files.map((f) => (
          <Row key={f.path}>
            <LabeledText label={f.text !== undefined ? "Embedded:" : "Identified:"} labelWidth={LABEL_WIDTH} value={f.path} />
          </Row>
        ))}
      </ExpandableRow>
      <ExpandableRow
        heading="File"
        initialExpanded={ctx.viewState?.fileExpanded ?? false}
        onExpanded={(exp) => ctx.changeViewState((vs) => (vs.fileExpanded = exp))}
      >
        <Row>
          <LabeledText label="Machine id:" labelWidth={LABEL_WIDTH} value={`${h.machineId}${h.modelId ? ` / ${h.modelId}` : ""}`} />
        </Row>
        <Row>
          <LabeledText label="Core:" labelWidth={LABEL_WIDTH} value={h.coreId} />
        </Row>
        <Row>
          <LabeledText label="Layout fingerprint:" labelWidth={LABEL_WIDTH} value={h.fingerprint} />
        </Row>
        <Row>
          <LabeledText label="Code hash:" labelWidth={LABEL_WIDTH} value={h.codeHash} />
        </Row>
        <Row>
          <LabeledText
            label="Sections:"
            labelWidth={LABEL_WIDTH}
            value={Object.entries(info.sectionSizes)
              .filter(([tag]) => tag !== "END")
              .map(([tag, size]) => `${tag} ${sizeText(size)}`)
              .join(" · ")}
          />
        </Row>
        {info.unknownSections.length > 0 && (
          <Row>
            <LabeledText label="Unknown sections:" labelWidth={LABEL_WIDTH} value={info.unknownSections.join(", ")} />
          </Row>
        )}
      </ExpandableRow>
    </>
  );
};
