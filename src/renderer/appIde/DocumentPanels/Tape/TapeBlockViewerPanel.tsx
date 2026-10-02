import { useEffect, useMemo, useState } from "react";
import type { DocumentProps } from "@renderer/features/documents/DocumentsContainer";
import type { IDocumentHubService } from "@renderer/abstractions/IDocumentHubService";
import { TAPE_BLOCK_VIEWER } from "@common/state/common-ids";
import { ZxSpectrumChars } from "@common/machines/char-codes";
import { SPECTRUM_48_COLORS } from "@emu/machines/spectrum-colors";
import { FullPanel } from "@renderer/controls/layout/Panels";
import { EmptyState, PanelHeader } from "@renderer/controls/data";
import { SmallIconButton } from "@controls/IconButton";
import { LabeledSwitch } from "@controls/LabeledSwitch";
import { ToolbarSeparator } from "@controls/ToolbarSeparator";
import { VirtualizedList } from "@renderer/controls/VirtualizedList";
import { ScreenCanvas } from "@renderer/controls/Next/ScreenCanvas";
import { useDocumentHubService } from "@renderer/appIde/services/DocumentServiceProvider";
import { useDispatch } from "@renderer/core/RendererProvider";
import { setIdeStatusMessageAction } from "@state/actions";
import { BasicLineDisplay } from "../BasicPanel";
import basicStyles from "../BasicPanel.module.scss";
import { basicListingText, decodeBasicProgram } from "../basicListing";
import { createScrPixelData } from "../Next/ScrFileViewerPanel";

/*
 * A tape block popped out as a BASIC listing or a screen (`.plans/TAPE_VIEWER_PLAN.md` §4.5): the
 * one document type the tape viewer added.
 *
 * Its own type rather than a "bytes" mode on `BasicPanel`, because that panel is built around the
 * live machine - auto-refresh, the machine-state listener, persisting its options into the project -
 * and a listing from a file needs none of it. What the two share is the decoder (`basicListing.ts`)
 * and the line renderer (`BasicLineDisplay`), so a program reads the same in either.
 *
 * Not restored at startup: like a memory dump, it is not a project file.
 */

export type TapeBlockViewState = {
  view: "basic" | "screen";
  /** BASIC: where the program ends - the header's variables offset */
  basicEnd?: number;
  autostart?: number;
  showCodes?: boolean;
  showSpectrumFont?: boolean;
};

type OpenOptions = {
  id: string;
  title: string;
  bytes: Uint8Array;
  view: "basic" | "screen";
  basicEnd?: number;
  autostart?: number;
};

/** Opens (or brings forward) a block's BASIC listing or screen */
export async function openTapeBlockView(
  hub: IDocumentHubService,
  { id, title, bytes, view, basicEnd, autostart }: OpenOptions
): Promise<void> {
  if (hub.isOpen(id)) {
    await hub.setActiveDocument(id);
    return;
  }
  await hub.openDocument(
    {
      id,
      name: title,
      type: TAPE_BLOCK_VIEWER,
      iconName: view === "basic" ? "code" : "vm",
      contents: bytes,
      isReadOnly: true
    },
    { view, basicEnd, autostart, showSpectrumFont: true } satisfies TapeBlockViewState,
    false
  );
}

const TapeBlockViewerPanel = ({
  document,
  contents,
  viewState
}: DocumentProps<TapeBlockViewState>) => {
  const bytes = contents instanceof Uint8Array ? contents : undefined;
  if (!bytes) {
    return (
      <EmptyState tone="error" motif={false} message="This block's bytes are not available." />
    );
  }
  return viewState?.view === "screen" ? (
    <TapeScreen bytes={bytes} />
  ) : (
    <TapeBasicListing documentId={document.id} bytes={bytes} viewState={viewState} />
  );
};

const TapeBasicListing = ({
  documentId,
  bytes,
  viewState
}: {
  documentId: string;
  bytes: Uint8Array;
  viewState?: TapeBlockViewState;
}) => {
  const dispatch = useDispatch();
  const documentHubService = useDocumentHubService();
  const [showCodes, setShowCodes] = useState(viewState?.showCodes ?? false);
  const [showSpectrumFont, setShowSpectrumFont] = useState(viewState?.showSpectrumFont ?? true);
  const end = Math.min(viewState?.basicEnd ?? bytes.length, bytes.length);

  const listing = useMemo(
    () => decodeBasicProgram(bytes, 0, end, { charSet: ZxSpectrumChars, showCodes }),
    [bytes, end, showCodes]
  );
  const lines = useMemo(() => listing.lines.filter((l) => l.spans.length > 0), [listing]);

  useEffect(() => {
    documentHubService.setDocumentViewState(documentId, {
      ...viewState,
      showCodes,
      showSpectrumFont
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCodes, showSpectrumFont]);

  return (
    <FullPanel fontSize="--panel-font-size" fontFamily="--monospace-font">
      <PanelHeader>
        <SmallIconButton
          iconName="copy"
          title="Copy to clipboard"
          clicked={async () => {
            await navigator.clipboard.writeText(basicListingText(listing.lines));
            dispatch(setIdeStatusMessageAction("BASIC listing copied to the clipboard", true));
          }}
        />
        <ToolbarSeparator small={true} />
        <LabeledSwitch
          value={showCodes}
          label="Show Non-Printable:"
          title="Display the non-printable codes"
          clicked={setShowCodes}
        />
        <ToolbarSeparator small={true} />
        <LabeledSwitch
          value={showSpectrumFont}
          label="Use ZX Spectrum font:"
          title="Use ZX Spectrum font to display the list"
          clicked={setShowSpectrumFont}
        />
        <ToolbarSeparator small={true} />
        <span>
          {`${listing.lineCount} line${listing.lineCount === 1 ? "" : "s"}`}
          {viewState?.autostart !== undefined ? ` · autostart LINE ${viewState.autostart}` : ""}
        </span>
      </PanelHeader>
      {lines.length === 0 ? (
        <EmptyState message="This block holds no BASIC lines." />
      ) : (
        <VirtualizedList
          items={lines}
          renderItem={(idx) => (
            <div key={idx} className={basicStyles.item}>
              <BasicLineDisplay spans={lines[idx]?.spans} showSpectrumFont={showSpectrumFont} />
            </div>
          )}
        />
      )}
    </FullPanel>
  );
};

const TapeScreen = ({ bytes }: { bytes: Uint8Array }) =>
  bytes.length < 6912 ? (
    <EmptyState
      tone="error"
      motif={false}
      message={`A screen is 6,912 bytes; this block holds ${bytes.length.toLocaleString("en-US")}.`}
    />
  ) : (
    <FullPanel fontSize="--panel-font-size" fontFamily="--monospace-font">
      <ScreenCanvas
        data={bytes}
        palette={SPECTRUM_48_COLORS}
        zoomFactor={2}
        screenWidth={256}
        screenHeight={192}
        createPixelData={createScrPixelData}
      />
    </FullPanel>
  );

export const createTapeBlockViewerPanel = ({ document, contents, viewState }: DocumentProps) => (
  <TapeBlockViewerPanel
    key={document.id}
    document={document}
    contents={contents}
    viewState={viewState}
    apiLoaded={() => {}}
  />
);
