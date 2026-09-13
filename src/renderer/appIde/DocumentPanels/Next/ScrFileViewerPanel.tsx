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

type ScrFileViewState = {
  scrollPosition?: number;
};

const ScrFileViewerPanel = ({
  document,
  contents,
  viewState
}: DocumentProps<ScrFileViewState>) => {
  const documentHubService = useDocumentHubService();

  return createElement(
    GenericFilePanel<true, ScrFileViewState>,
    {
      document,
      contents,
      viewState,
      fileLoader: loadScrFileContents,
      // --- The context is unused: this viewer draws from `contents` directly, and the loader now
      // --- returns only a validity flag (see `loadScrFileContents`).
      validRenderer: () => {
        const documentSource = document.node.projectPath;

        return (
          <Panel>
            <Column>
              <HeaderRow>
                <SmallIconButton
                  iconName='square-arrow-out-up-right'
                  fill='--data-value'
                  title='Display screen data dump'
                  clicked={async () => {
                    await openStaticMemoryDump(
                      documentHubService,
                      `scrData${documentSource}`,
                      `${documentSource} - Dump`,
                      contents
                    );
                  }}
                />
              </HeaderRow>

              <ScreenCanvas
                data={contents}
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

/**
 * Validates a `.SCR` file.
 *
 * It used to split `contents` into `pixels` and `attrs` and return them as a `ScrFileContents` —
 * which nothing ever read. The renderer passes the raw `contents` on, and `createScrPixelData`
 * splits them again at the point of use. The split here was doing no work; the length check was the
 * whole function. Saying so is the fix, rather than keeping a parse whose output has no consumer.
 */
function loadScrFileContents (contents: Uint8Array): { fileInfo?: true; error?: string } {
  if (contents.length !== SCR_FILE_LENGTH) {
    return {
      error: `Invalid file size (${contents.length} bytes): an .SCR file is ${SCR_FILE_LENGTH} bytes long.`
    };
  }
  return { fileInfo: true };
}

function createScrPixelData (
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
      const ink = attr & 0x07;
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

