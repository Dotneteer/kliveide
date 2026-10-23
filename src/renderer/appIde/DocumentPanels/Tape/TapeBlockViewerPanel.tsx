import { useEffect, useMemo, useState } from "react";
import classnames from "classnames";
import type { DocumentProps } from "@renderer/features/documents/DocumentsContainer";
import type { IDocumentHubService } from "@renderer/abstractions/IDocumentHubService";
import { TAPE_BLOCK_VIEWER } from "@common/state/common-ids";
import { ZxSpectrumChars, ht1080zCharsFor, type Ht1080zCharSetId } from "@common/machines/char-codes";
import { HT1080Z_PROGRAM_START } from "@common/ht1080z/codePlacement";
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
import { decodeZx8081Program } from "../zx8081BasicListing";
import { decodeHt1080zProgram } from "../ht1080zBasicListing";
import { zx81DisplayRows, ZX81_PROGRAM_START } from "../PFile/pFileView";
import { ZX80_PROGRAM_START } from "../PFile/oFileView";
import { Zx81ScreenView } from "../PFile/Zx81ScreenView";
import { useT } from "@common/i18n/useT";

/*
 * A tape block popped out as a BASIC listing or a screen (`.plans/TAPE_VIEWER_PLAN.md` §4.5): the
 * one document type the tape viewer added.
 *
 * Its own type rather than a "bytes" mode on `BasicPanel`, because that panel is built around the
 * live machine - auto-refresh, the machine-state listener, persisting its options into the project -
 * and a listing from a file needs none of it. What the two share is the decoder (`basicListing.ts`)
 * and the line renderer (`BasicLineDisplay`), so a program reads the same in either.
 *
 * The ZX81 `.P` viewer pops its program and display file out here too (`format: "zx81"`): the same
 * document, with the ZX81's detokenizer (`zx8081BasicListing.ts`) and its character-set picture. A
 * ZX80 `.O` file's program comes as `format: "zx80"`, listed by the 4K ROM's rules (it has no screen).
 * An HT-1080Z program (`format: "ht1080z"`, from the HT tape viewer) is listed at 42E9h by Level II's
 * rules, in the character set the viewer showed it in.
 *
 * Not restored at startup: like a memory dump, it is not a project file.
 */

/** Whose bytes these are: a Spectrum tape block (the default), or a part of a ZX81 `.P` or ZX80 `.O` file */
export type TapeBlockFormat = "spectrum" | "zx81" | "zx80" | "ht1080z";

export type TapeBlockViewState = {
  view: "basic" | "screen";
  format?: TapeBlockFormat;
  /** BASIC: where the program ends - the header's variables offset */
  basicEnd?: number;
  autostart?: number;
  showCodes?: boolean;
  showSpectrumFont?: boolean;
  /** An HT-1080Z program: the model whose characters it is listed in */
  htCharSet?: Ht1080zCharSetId;
};

type OpenOptions = {
  id: string;
  title: string;
  bytes: Uint8Array;
  view: "basic" | "screen";
  basicEnd?: number;
  autostart?: number;
  format?: TapeBlockFormat;
  htCharSet?: Ht1080zCharSetId;
};

/** Opens (or brings forward) a block's BASIC listing or screen */
export async function openTapeBlockView(
  hub: IDocumentHubService,
  { id, title, bytes, view, basicEnd, autostart, format, htCharSet }: OpenOptions
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
    { view, basicEnd, autostart, format, htCharSet, showSpectrumFont: true } satisfies TapeBlockViewState,
    false
  );
}

const TapeBlockViewerPanel = ({
  document,
  contents,
  viewState
}: DocumentProps<TapeBlockViewState>) => {
  const t = useT();
  const bytes = contents instanceof Uint8Array ? contents : undefined;
  if (!bytes) {
    return <EmptyState tone="error" motif={false} message={t("panels.tape.block.noBytes")} />;
  }
  const zx81 = viewState?.format === "zx81" || viewState?.format === "zx80";
  return viewState?.view === "screen" ? (
    zx81 ? (
      <Zx81Screen bytes={bytes} />
    ) : (
      <TapeScreen bytes={bytes} />
    )
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
  const t = useT();
  const dispatch = useDispatch();
  const documentHubService = useDocumentHubService();
  const [showCodes, setShowCodes] = useState(viewState?.showCodes ?? false);
  const [showSpectrumFont, setShowSpectrumFont] = useState(viewState?.showSpectrumFont ?? true);
  const end = Math.min(viewState?.basicEnd ?? bytes.length, bytes.length);
  const format = viewState?.format ?? "spectrum";
  const zx81 = format === "zx81" || format === "zx80";
  const htCharSet = viewState?.htCharSet ?? "s2";

  const listing = useMemo(() => {
    if (format === "spectrum") return decodeBasicProgram(bytes, 0, end, { charSet: ZxSpectrumChars, showCodes });
    if (format === "ht1080z") {
      // --- Relinked at 42E9h by the viewer, so it lists where CLOAD puts it
      const memory = new Uint8Array(0x10000);
      memory.set(bytes.subarray(0, Math.min(end, 0x10000 - HT1080Z_PROGRAM_START)), HT1080Z_PROGRAM_START);
      return decodeHt1080zProgram(memory, HT1080Z_PROGRAM_START, HT1080Z_PROGRAM_START + end, {
        charSet: ht1080zCharsFor(htCharSet),
        backtickPairs: htCharSet === "s64",
        showCodes
      });
    }
    // --- A ZX81's or ZX80's lines are read where the machine keeps them, after the system variables
    const start = format === "zx80" ? ZX80_PROGRAM_START : ZX81_PROGRAM_START;
    const memory = new Uint8Array(0x10000);
    memory.set(bytes.subarray(0, Math.min(end, 0x10000 - start)), start);
    return decodeZx8081Program(memory, start, start + end, format, { showCodes });
  }, [bytes, end, showCodes, format, htCharSet]);
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
          title={t("panels.tape.block.copy")}
          clicked={async () => {
            await navigator.clipboard.writeText(basicListingText(listing.lines));
            dispatch(setIdeStatusMessageAction(t("panels.tape.block.copied"), true));
          }}
        />
        <ToolbarSeparator small={true} />
        <LabeledSwitch
          value={showCodes}
          label={t("panels.tape.block.showCodes")}
          title={t("panels.tape.block.showCodesTitle")}
          clicked={setShowCodes}
        />
        {format !== "ht1080z" && <ToolbarSeparator small={true} />}
        {format !== "ht1080z" && (
        <LabeledSwitch
          value={showSpectrumFont}
          label={zx81 ? t("panels.tape.block.sinclairFont") : t("panels.tape.block.spectrumFont")}
          title={zx81 ? t("panels.tape.block.sinclairFontTitle") : t("panels.tape.block.spectrumFontTitle")}
          clicked={setShowSpectrumFont}
        />
        )}
        <ToolbarSeparator small={true} />
        <span>
          {viewState?.autostart !== undefined
            ? t("panels.tape.block.linesAutostart", { count: listing.lineCount, line: viewState.autostart })
            : t("panels.helpers.lineCount", { count: listing.lineCount })}
        </span>
      </PanelHeader>
      {lines.length === 0 ? (
        <EmptyState message={t("panels.tape.block.noLines")} />
      ) : (
        <VirtualizedList
          items={lines}
          renderItem={(idx) => (
            <div
              key={idx}
              className={classnames(basicStyles.item, {
                [basicStyles.first]: idx === 0,
                [basicStyles.last]: idx === lines.length - 1
              })}
            >
              <BasicLineDisplay spans={lines[idx]?.spans} showSpectrumFont={format !== "ht1080z" && showSpectrumFont} />
            </div>
          )}
        />
      )}
    </FullPanel>
  );
};

const TapeScreen = ({ bytes }: { bytes: Uint8Array }) => {
  const t = useT();
  return bytes.length < 6912 ? (
    <EmptyState
      tone="error"
      motif={false}
      message={t("panels.tape.block.shortScreen", { count: bytes.length })}
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
};

/** A ZX81 display file, drawn with the ROM's character set */
const Zx81Screen = ({ bytes }: { bytes: Uint8Array }) => {
  const rows = useMemo(() => zx81DisplayRows(bytes, 0, bytes.length), [bytes]);
  return (
    <FullPanel fontSize="--panel-font-size" fontFamily="--monospace-font">
      <Zx81ScreenView rows={rows} zoomFactor={2} />
    </FullPanel>
  );
};

export const createTapeBlockViewerPanel = ({ document, contents, viewState }: DocumentProps) => (
  <TapeBlockViewerPanel
    key={document.id}
    document={document}
    contents={contents}
    viewState={viewState}
    apiLoaded={() => {}}
  />
);
