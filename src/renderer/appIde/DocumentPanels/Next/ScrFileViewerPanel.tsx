import { SmallIconButton } from "@renderer/controls/IconButton";
import { DocumentProps } from "../../DocumentArea/DocumentsContainer";
import { GenericFileViewerPanel } from "../helpers/GenericFileViewerPanel";
import { HeaderRow } from "@renderer/controls/generic/Row";
import { openStaticMemoryDump } from "../Memory/StaticMemoryDump";
import { ScreenCanvas } from "@renderer/controls/Next/ScreenCanvas";
import { Panel } from "@renderer/controls/generic/Panel";
import { Column } from "@renderer/controls/generic/Column";

type ScrFileViewState = {
  scrollPosition?: number;
};

const ScrFileViewerPanel = ({
  document,
  contents,
  viewState
}: DocumentProps<ScrFileViewState>) => {
  return GenericFileViewerPanel<ScrFileContents, ScrFileViewState>({
    document,
    contents,
    viewState,
    fileLoader: loadScrFileContents,
    validRenderer: context => {
      const projectService = context.appServices.projectService;
      const documentSource = document.node.projectPath;

      // --- Create the Layer2 screen from the data provided
      const createPixelData = (
        data: Uint8Array,
        palette: number[],
        target: Uint32Array
      ) => {
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
            ((y & 0xc0) << 5) + ((y & 0x07) << 8) + ((y & 0x38) << 2) + (x >> 3)
          );
        }

        function attrAddress (x: number, y: number) {
          return (x >> 3) + 32 * (y >> 3);
        }
      };

      return (
        <Panel>
          <Column>
            <HeaderRow>
              <SmallIconButton
                iconName='pop-out'
                fill='--color-value'
                title='Display screen data dump'
                clicked={async () => {
                  await openStaticMemoryDump(
                    projectService.getActiveDocumentHubService(),
                    `scrData${documentSource}`,
                    `${documentSource} - Dump`,
                    contents
                  );
                }}
              />
            </HeaderRow>

            <ScreenCanvas
              data={contents}
              palette={spectrum48Colors}
              zoomFactor={2}
              screenWidth={256}
              screenHeight={192}
              createPixelData={createPixelData}
            />
          </Column>
        </Panel>
      );
    }
  });
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

// --- Loads the contents of the SCR file
function loadScrFileContents (contents: Uint8Array): {
  fileInfo?: ScrFileContents;
  error?: string;
} {
  if (contents.length !== 0x1b00) {
    return {
      error: "Invalid file size, an .SCR file should be 6912 bytes long."
    };
  }
  const pixels = contents.slice(0, 0x1800);
  const attrs = contents.slice(0x1800, 0x1b00);
  return { fileInfo: { pixels, attrs } };
}

type ScrFileContents = {
  pixels: Uint8Array;
  attrs: Uint8Array;
};

/**
 * This table defines the ARGB colors for the 16 available colors on the ZX Spectrum 48K model.
 */
const spectrum48Colors: number[] = [
  0xff000000, // Black
  0xffaa0000, // Blue
  0xff0000aa, // Red
  0xffaa00aa, // Magenta
  0xff00aa00, // Green
  0xffaaaa00, // Cyan
  0xff00aaaa, // Yellow
  0xffaaaaaa, // White
  0xff000000, // Bright Black
  0xffff0000, // Bright Blue
  0xff0000ff, // Bright Red
  0xffff00ff, // Bright Magenta
  0xff00ff00, // Bright Green
  0xffffff00, // Bright Cyan
  0xff00ffff, // Bright Yellow
  0xffffffff // Bright White
];
