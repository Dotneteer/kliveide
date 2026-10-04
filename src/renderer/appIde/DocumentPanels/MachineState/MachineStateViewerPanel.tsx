import type { DocumentProps } from "@renderer/features/documents/DocumentsContainer";
import type { GenericFileContext } from "../helpers/GenericFilePanel";
import type { KliveStateReadResult } from "@common/machineState/kliveStateFile";

import { GenericFilePanel } from "../helpers/GenericFilePanel";
import { ExpandableRow } from "@renderer/controls/layout/ExpandableRow";
import { LabeledText } from "@renderer/controls/layout/LabeledText";
import { LabeledFlag } from "@renderer/controls/layout/LabeledFlag";
import { Row } from "@renderer/controls/layout/Row";
import { Text } from "@renderer/controls/layout/Text";
import { ScreenCanvas } from "@renderer/controls/Next/ScreenCanvas";
import { toHexa4 } from "@renderer/appIde/services/ide-commands";
import { readKliveStateFile } from "@common/machineState/kliveStateFile";
import { MEDIA_DISK_A, MEDIA_DISK_B, MEDIA_SD_CARD, MEDIA_TAPE } from "@common/structs/project-const";

/*
 * The Klive state file (`.kls`) viewer (`.plans/SNAPSHOT_SAVING_AND_STATE_FILES_PLAN.md` §4.9): the
 * screen as it was saved, the machine, when and by which Klive it was saved, the media it had, and
 * whether it carries a portable .szx part. It reads the file without inflating the memory image and
 * runs no core. Built only from the shared viewer primitives - no stylesheet, no colour.
 */

/* --- M2: `ch`, not px */
const LABEL_WIDTH = "18ch";

type MachineStateViewState = {
  scrollPosition?: number;
  summaryExpanded?: boolean;
  mediaExpanded?: boolean;
  fileExpanded?: boolean;
};

type ViewContext = GenericFileContext<KliveStateReadResult, MachineStateViewState>;

/** Reads a state file for the viewer; a broken file is reported, not thrown */
export function loadMachineStateFileContents(contents: Uint8Array): {
  fileInfo?: KliveStateReadResult;
  error?: string;
} {
  try {
    return { fileInfo: readKliveStateFile(contents, { skipImage: true }) };
  } catch (err) {
    return { error: `Not a valid Klive state file: ${err instanceof Error ? err.message : String(err)}` };
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

const MachineStateViewerPanel = ({ document, contents, viewState }: DocumentProps<MachineStateViewState>) => (
  <GenericFilePanel<KliveStateReadResult, MachineStateViewState>
    document={document}
    contents={contents}
    viewState={viewState}
    apiLoaded={() => {}}
    fileLoader={(bytes) => loadMachineStateFileContents(bytes)}
    validRenderer={(ctx) => <StateView ctx={ctx} />}
  />
);

export const createMachineStateViewerPanel = ({ document, contents, viewState }: DocumentProps) => (
  <MachineStateViewerPanel document={document} contents={contents} viewState={viewState} apiLoaded={() => {}} />
);

/** A module-level component, so it may hold state (see `GenericFilePanel`'s renderer note) */
const StateView = ({ ctx }: { ctx: ViewContext }) => {
  const info = ctx.fileInfo;
  if (!info) return null;
  const h = info.header;
  const savedAt = new Date(h.savedAt);
  return (
    <>
      <ExpandableRow
        heading="Machine State"
        initialExpanded={ctx.viewState?.summaryExpanded ?? true}
        onExpanded={(exp) => ctx.changeViewState((vs) => (vs.summaryExpanded = exp))}
      >
        <Row>
          <LabeledText label="Machine:" labelWidth={LABEL_WIDTH} value={h.machineName ?? h.machineId} />
        </Row>
        <Row>
          <LabeledText
            label="Saved:"
            labelWidth={LABEL_WIDTH}
            value={isNaN(savedAt.getTime()) ? h.savedAt : savedAt.toLocaleString()}
          />
        </Row>
        <Row>
          <LabeledText label="Saved by:" labelWidth={LABEL_WIDTH} value={`Klive ${h.kliveVersion}`} />
        </Row>
        <Row>
          <LabeledText label="PC:" labelWidth={LABEL_WIDTH} value={`$${toHexa4(h.pc)}`} />
        </Row>
        <Row>
          <LabeledFlag label="Portable .szx part:" labelWidth={LABEL_WIDTH} value={!!info.szx} />
        </Row>
        <Row>
          <Text
            text={
              info.szx
                ? "Loads exactly into a Klive whose core is unchanged; into another version, from its .szx part."
                : "Loads only into a Klive whose core is unchanged since it was saved."
            }
          />
        </Row>
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
        {info.media.some((m) => m.id === MEDIA_DISK_A || m.id === MEDIA_DISK_B) && (
          <Row>
            <Text text="The disks' contents are in the state; once loaded, they are detached from these files." />
          </Row>
        )}
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
          <LabeledText
            label="Memory image:"
            labelWidth={LABEL_WIDTH}
            value={`${(h.memorySize / 1048576).toFixed(1)} MiB, ${Math.round(info.compressedImageSize / 1024)} KiB compressed`}
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
