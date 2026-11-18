import { t as translate } from "@common/i18n/i18n";
import { useT } from "@common/i18n/useT";
import type { DocumentProps } from "@renderer/features/documents/DocumentsContainer";
import type { GenericFileContext } from "../helpers/GenericFilePanel";

import { GenericFilePanel } from "../helpers/GenericFilePanel";
import { Fact, FactFlag, FactNote, Facts, FactSection } from "@renderer/controls/data/FileFacts";
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
 * The RZX recording viewer (`dev/plans/RZX_PLAN.md` §4.6): the file's version, creator and notes, its
 * segments (each embedded snapshot is a jump point, "Play from this segment"), and the first
 * segment's snapshot through the snapshot viewer's own sections - screen, registers, paging, banks.
 * Play, Debug and Render to video sit in the document tab bar (`RzxLaunchMenu.tsx`).
 *
 * Built from the shared file-facts primitives (`controls/data/FileFacts`).
 */

/* --- M2: `ch`, not px */
const LABEL_WIDTH = "14ch";
const SEGMENT_LABEL_WIDTH = "9ch";

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
    return {
      error: translate("panels.spectrum.rzx.invalid", {
        reason: err instanceof Error ? err.message : String(err)
      })
    };
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
  const t = useT();
  const { file } = info;
  return (
    <FactSection
      title={t("panels.spectrum.rzx.heading")}
      expanded={ctx.viewState?.recordingExpanded ?? true}
      onExpandedChange={(exp) => ctx.changeViewState((vs) => (vs.recordingExpanded = exp))}
    >
      <Facts labelWidth={LABEL_WIDTH}>
        <Fact label={t("panels.spectrum.rzx.version")}>{`${file.major}.${file.minor}`}</Fact>
        <Fact label={t("panels.spectrum.rzx.creator")}>{rzxCreatorText(file.creator)}</Fact>
        <Fact label={t("panels.helpers.label.machine")}>
          {info.first
            ? describeSnapshotMapping(info.first.snapshot, info.first.mapping)
            : t("panels.spectrum.rzx.unknownMachine")}
        </Fact>
        <Fact label={t("panels.spectrum.rzx.frames")}>
          {t("panels.spectrum.rzx.framesValue", {
            frames: info.frames,
            pictures: info.pictureFrames,
            duration: formatRzxDuration(info.pictureFrames)
          })}
        </Fact>
        <Fact label={t("panels.spectrum.rzx.segmentsLabel")}>{`${info.segments.length}`}</Fact>
        <FactFlag label={t("panels.spectrum.rzx.signed")} value={(file.flags & 0x01) !== 0} />
        <FactFlag label={t("panels.spectrum.rzx.playable")} value={!info.error} />
      </Facts>
      {info.error && <FactNote tone="error">{info.error}</FactNote>}
      {(info.first?.mapping.warnings ?? []).map((warning, index) => (
        <FactNote key={`warning${index}`} tone="warning">
          {warning}
        </FactNote>
      ))}
      {file.notes.map((note, index) => (
        <FactNote key={`note${index}`}>{note}</FactNote>
      ))}
    </FactSection>
  );
};

const SegmentsSection = ({ ctx, info, fullPath }: SectionProps & { fullPath: string }) => {
  const t = useT();
  const { ideCommandsService } = useAppServices();
  return (
    <FactSection
      title={t("panels.spectrum.rzx.segments")}
      meta={info.segments.length}
      expanded={ctx.viewState?.segmentsExpanded ?? true}
      onExpandedChange={(exp) => ctx.changeViewState((vs) => (vs.segmentsExpanded = exp))}
    >
      <Facts labelWidth={SEGMENT_LABEL_WIDTH}>
        {info.segments.map((segment) => (
          <Fact
            key={segment.index}
            label={
              <>
                <SmallIconButton
                  iconName="play"
                  title={t("panels.spectrum.rzx.playFrom", { segment: segment.index + 1 })}
                  enable={!info.error && segment.frameCount > 0}
                  clicked={async () => {
                    await ideCommandsService.executeCommand(rzxPlayCommandText(fullPath, false, segment.index));
                  }}
                />
                {`#${segment.index + 1}:`}
              </>
            }
          >
            {t("panels.spectrum.rzx.segment", {
              first: segment.firstFrame + 1,
              frames: segment.frameCount,
              duration: formatRzxDuration(segment.pictureFrames),
              extension: segment.snapshot.extension,
              inputs: segment.inputs.length
            })}
          </Fact>
        ))}
      </Facts>
    </FactSection>
  );
};
