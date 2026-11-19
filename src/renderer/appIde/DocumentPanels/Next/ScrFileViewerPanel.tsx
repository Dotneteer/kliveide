import { SmallIconButton } from "@renderer/controls/IconButton";
import { SCR_FILE_LENGTH, SPECTRUM_48_COLORS } from "@emu/machines/spectrum-colors";
import { DocumentProps } from "@renderer/features/documents/DocumentsContainer";
import { GenericFilePanel } from "../helpers/GenericFilePanel";
import { HeaderRow } from "@renderer/controls/layout/Row";
import { openStaticMemoryDump } from "@renderer/features/memory/StaticMemoryDump";
import { ScreenCanvas } from "@renderer/controls/Next/ScreenCanvas";
import { Panel } from "@renderer/controls/layout/Panel";
import { Column } from "@renderer/controls/layout/Column";
import { createElement } from "react";
import { useDocumentHubService } from "@renderer/appIde/services/DocumentServiceProvider";
import { t } from "@common/i18n/i18n";
import { useT } from "@common/i18n/useT";
import { parseHeader } from "@common/diskfs/plus3dos";

type ScrFileViewState = {
  scrollPosition?: number;
};

const ScrFileViewerPanel = ({
  document,
  contents,
  viewState
}: DocumentProps<ScrFileViewState>) => {
  const documentHubService = useDocumentHubService();
  const t = useT();

  return createElement(
    GenericFilePanel<Uint8Array, ScrFileViewState>,
    {
      document,
      contents,
      viewState,
      fileLoader: loadScrFileContents,
      // --- The loader hands over the 6912 screen bytes, without a PLUS3DOS header if the file has one.
      validRenderer: context => {
        const documentSource = document.node.projectPath;
        const screen = context.fileInfo ?? contents;

        return (
          <Panel>
            <Column>
              <HeaderRow>
                <SmallIconButton
                  iconName='square-arrow-out-up-right'
                  fill='--data-value'
                  title={t("panels.next.scr.showDump")}
                  clicked={async () => {
                    await openStaticMemoryDump(
                      documentHubService,
                      `scrData${documentSource}`,
                      t("panels.next.dumpTitle.dump", { source: documentSource }),
                      screen
                    );
                  }}
                />
              </HeaderRow>

              <ScreenCanvas
                data={screen}
                palette={SPECTRUM_48_COLORS}
                zoomFactor={2}
                screenWidth={256}
                screenHeight={192}
                createPixelData={createScrPixelData}
              />
            </Column>
          </Panel>
        );
      }
    }
  );
};

export const createScrFileViewerPanel = ({
  document,
  contents,
  viewState
}: DocumentProps) => (
  <ScrFileViewerPanel
    document={document}
    contents={contents}
    viewState={viewState}
    apiLoaded={() => {}}
  />
);

/** The size of the PLUS3DOS header a +3DOS or NextZXOS `SAVE ... SCREEN$` writes in front of the data */
const PLUS3DOS_HEADER_SIZE = 128;

/**
 * Validates a `.SCR` file and returns its 6912 screen bytes.
 *
 * A file saved from +3 BASIC or NextBASIC starts with a 128-byte PLUS3DOS header (7040 bytes in all).
 * A valid header (signature and checksum) is skipped; a file without one is read as it is. Pixels and
 * attributes are split at the point of use, in `createScrPixelData`.
 */
export function loadScrFileContents (contents: Uint8Array): { fileInfo?: Uint8Array; error?: string } {
  const screen = parseHeader(contents) ? contents.subarray(PLUS3DOS_HEADER_SIZE) : contents;
  if (screen.length !== SCR_FILE_LENGTH) {
    return {
      error: t("panels.next.scr.invalidSize", { size: contents.length, expected: SCR_FILE_LENGTH })
    };
  }
  return { fileInfo: screen };
}

/**
 * Draws a 6912-byte screen dump into `target`. Exported for the tape viewer's screen preview.
 */
export function createScrPixelData (
  data: Uint8Array,
  palette: number[],
  target: Uint32Array
) {
  const pixels = data.slice(0, 0x1800);
  const attrs = data.slice(0x1800, 0x1b00);

  let j = 0;
  for (let y = 0; y < 192; y++) {
    for (let x = 0; x < 256; x++) {
      const addr = pixelAddress(x, y);
      const pixelMask = 0x80 >> (x & 0x07);
      const pixelOn = (pixels[addr] & pixelMask) !== 0;
      const attr = attrs[attrAddress(x, y)];
      // --- BRIGHT (bit 6) lifts ink and paper alike. Paper took it as its bit 3; ink dropped it,
      // --- so bright text drew in the normal shade.
      const ink = (attr & 0x07) | ((attr & 0x40) >> 3);
      const paper = (attr & 0x78) >> 3;
      target[j++] = pixelOn ? palette[ink] : palette[paper];
    }
  }

  function pixelAddress (x: number, y: number) {
    return (
      ((y & 0xc0) << 5) +
      ((y & 0x07) << 8) +
      ((y & 0x38) << 2) +
      (x >> 3)
    );
  }

  function attrAddress (x: number, y: number) {
    return (x >> 3) + 32 * (y >> 3);
  }
}

