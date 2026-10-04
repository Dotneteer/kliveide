import type { DocumentProps } from "@renderer/features/documents/DocumentsContainer";
import type { GenericFileContext } from "../helpers/GenericFilePanel";

import { GenericFilePanel } from "../helpers/GenericFilePanel";
import { ExpandableRow } from "@renderer/controls/layout/ExpandableRow";
import { LabeledText } from "@renderer/controls/layout/LabeledText";
import { LabeledFlag } from "@renderer/controls/layout/LabeledFlag";
import { Row } from "@renderer/controls/layout/Row";
import { Text } from "@renderer/controls/layout/Text";
import { SmallIconButton } from "@renderer/controls/IconButton";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { parseRzxFile } from "@common/spectrum/rzx/rzxFile";
import { mapRzxToKlive } from "@common/spectrum/rzx/rzxMapping";
import { rzxCreatorText, type RzxFile } from "@common/spectrum/rzx/rzxModel";
import { formatRzxDuration, rzxSegments, type RzxSegment } from "@common/spectrum/rzx/rzxSegments";
import { rzxPlayCommandText } from "@common/spectrum/rzx/rzxCommandTypes";
import { describeSnapshotMapping } from "@common/spectrum/snapshot/spectrumSnapshotMapping";
import { SnapshotView, type SpectrumSnapshotViewState } from "./SpectrumSnapshotViewerPanel";
import type { SpectrumSnapshotFileInfo } from "./spectrumSnapshotView";

/*
 * The RZX recording viewer (`.plans/RZX_PLAN.md` §4.6): the file's version, creator and notes, its
 * segments (each embedded snapshot is a jump point, "Play from this segment"), and the first
 * segment's snapshot through the snapshot viewer's own sections - screen, registers, paging, banks.
 * Play, Debug and Render to video sit in the document tab bar (`RzxLaunchMenu.tsx`).
 *
 * Built only from the shared viewer primitives - no stylesheet of its own, no colour.
 */

/* --- M2: `ch`, not px */
const LABEL_WIDTH = "14ch";

type RzxViewState = SpectrumSnapshotViewState & {
  recordingExpanded?: boolean;
  segmentsExpanded?: boolean;
};

export type RzxFileInfo = {
  file: RzxFile;
  segments: RzxSegment[];
  /** The first segment's snapshot and how it maps to a Klive machine; undefined when it cannot */
  first?: SpectrumSnapshotFileInfo;
  /** Why the recording cannot be played */
  error?: string;
  frames: number;
  pictureFrames: number;
};

type ViewContext = GenericFileContext<RzxFileInfo, RzxViewState>;

/**
 * Parses a recording for the viewer. A file Klive cannot *play* (an unknown machine, an unreadable
 * snapshot) still shows; one that is not an RZX file is reported.
 */
export function loadRzxFileContents(contents: Uint8Array): { fileInfo?: RzxFileInfo; error?: string } {
  let file: RzxFile;
  let segments: RzxSegment[];
  try {
    file = parseRzxFile(contents);
    segments = rzxSegments(file);
  } catch (err) {
    return { error: `Not a playable RZX file: ${err instanceof Error ? err.message : String(err)}` };
  }
  const frames = segments.reduce((sum, s) => sum + s.frameCount, 0);
  const pictureFrames = segments.reduce((sum, s) => sum + s.pictureFrames, 0);
  try {
    const { snapshot, mapping } = mapRzxToKlive(file, 0);
    return { fileInfo: { file, segments, first: { snapshot, mapping }, frames, pictureFrames } };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { fileInfo: { file, segments, error, frames, pictureFrames } };
  }
}

const RzxViewerPanel = ({ document, contents, viewState }: DocumentProps<RzxViewState>) => {
  const fullPath = document.node?.fullPath ?? document.path ?? document.id;
  return (
    <GenericFilePanel<RzxFileInfo, RzxViewState>
      document={document}
      contents={contents}
      viewState={viewState}
      apiLoaded={() => {}}
      fileLoader={(bytes) => loadRzxFileContents(bytes)}
      validRenderer={(ctx) => (
        <RzxView ctx={ctx} documentSource={document.node?.projectPath ?? document.id} fullPath={fullPath} />
      )}
    />
  );
};

export const createRzxViewerPanel = ({ document, contents, viewState }: DocumentProps) => (
  <RzxViewerPanel document={document} contents={contents} viewState={viewState} apiLoaded={() => {}} />
);

type ViewProps = { ctx: ViewContext; documentSource: string; fullPath: string };

const RzxView = ({ ctx, documentSource, fullPath }: ViewProps) => {
  const info = ctx.fileInfo;
  if (!info) return null;
  const snapshotCtx = info.first
    ? ({ ...ctx, fileInfo: info.first } as unknown as GenericFileContext<SpectrumSnapshotFileInfo, SpectrumSnapshotViewState>)
    : undefined;
  return (
    <>
      <RecordingSection ctx={ctx} info={info} />
      <SegmentsSection ctx={ctx} info={info} fullPath={fullPath} />
      {snapshotCtx && <SnapshotView ctx={snapshotCtx} documentSource={documentSource} fullPath={fullPath} />}
    </>
  );
};

type SectionProps = { ctx: ViewContext; info: RzxFileInfo };

const RecordingSection = ({ ctx, info }: SectionProps) => {
  const { file } = info;
  return (
    <ExpandableRow
      heading="RZX Recording"
      initialExpanded={ctx.viewState?.recordingExpanded ?? true}
      onExpanded={(exp) => ctx.changeViewState((vs) => (vs.recordingExpanded = exp))}
    >
      <Row>
        <LabeledText label="Version:" labelWidth={LABEL_WIDTH} value={`${file.major}.${file.minor}`} />
      </Row>
      <Row>
        <LabeledText label="Creator:" labelWidth={LABEL_WIDTH} value={rzxCreatorText(file.creator)} />
      </Row>
      <Row>
        <LabeledText
          label="Machine:"
          labelWidth={LABEL_WIDTH}
          value={info.first ? describeSnapshotMapping(info.first.snapshot, info.first.mapping) : "unknown"}
        />
      </Row>
      <Row>
        <LabeledText
          label="Frames:"
          labelWidth={LABEL_WIDTH}
          value={`${info.frames} (${info.pictureFrames} pictures, ${formatRzxDuration(info.pictureFrames)})`}
        />
      </Row>
      <Row>
        <LabeledText label="Segments:" labelWidth={LABEL_WIDTH} value={`${info.segments.length}`} />
      </Row>
      <Row>
        <LabeledFlag label="Signed:" labelWidth={LABEL_WIDTH} value={(file.flags & 0x01) !== 0} />
      </Row>
      <Row>
        <LabeledFlag label="Playable:" labelWidth={LABEL_WIDTH} value={!info.error} />
      </Row>
      {info.error && (
        <Row>
          <Text text={info.error} variant="error" />
        </Row>
      )}
      {(info.first?.mapping.warnings ?? []).map((warning, index) => (
        <Row key={`warning${index}`}>
          <Text text={warning} variant="warning" />
        </Row>
      ))}
      {file.notes.map((note, index) => (
        <Row key={`note${index}`}>
          <Text text={note} />
        </Row>
      ))}
    </ExpandableRow>
  );
};

const SegmentsSection = ({ ctx, info, fullPath }: SectionProps & { fullPath: string }) => {
  const { ideCommandsService } = useAppServices();
  return (
    <ExpandableRow
      heading="Segments"
      initialExpanded={ctx.viewState?.segmentsExpanded ?? true}
      onExpanded={(exp) => ctx.changeViewState((vs) => (vs.segmentsExpanded = exp))}
    >
      {info.segments.map((segment) => (
        <Row key={segment.index}>
          <SmallIconButton
            iconName="play"
            title={`Play from segment ${segment.index + 1}`}
            enable={!info.error && segment.frameCount > 0}
            clicked={async () => {
              await ideCommandsService.executeCommand(rzxPlayCommandText(fullPath, false, segment.index));
            }}
          />
          <LabeledText
            label={`#${segment.index + 1}:`}
            labelWidth="5ch"
            value={
              `frame ${segment.firstFrame + 1}, ${segment.frameCount} frames ` +
              `(${formatRzxDuration(segment.pictureFrames)}), .${segment.snapshot.extension} snapshot, ` +
              `${segment.inputs.length} input block${segment.inputs.length === 1 ? "" : "s"}`
            }
          />
        </Row>
      ))}
    </ExpandableRow>
  );
};
