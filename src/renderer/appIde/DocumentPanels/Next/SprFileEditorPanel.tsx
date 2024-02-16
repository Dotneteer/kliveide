import styles from "./SprFileEditorPanel.module.scss";
import { DocumentProps } from "../../DocumentArea/DocumentsContainer";
import {
  GenericFileEditorContext,
  GenericFileEditorPanel
} from "../helpers/GenericFileEditorPanel";
import { BinaryReader } from "@common/utils/BinaryReader";
import { createElement } from "react";
import { Row } from "@renderer/controls/generic/Row";
import { NextPaletteViewer } from "@renderer/controls/NextPaletteViewer";
import { Panel } from "@renderer/controls/generic/Panel";
import { SmallIconButton } from "@renderer/controls/IconButton";
import { ToolbarSeparator } from "@renderer/controls/ToolbarSeparator";
import { KeyHandler } from "@renderer/controls/generic/KeyHandler";
import { getCssStringForPaletteCode } from "@emu/machines/zxNext/palette";

type SprFileViewState = {
  scrollPosition?: number;
  zoomFactor?: number;
  spriteMap?: Uint8Array;
};

const defaultPalette: number[] = [];
for (let i = 0; i < 256; i++) {
  defaultPalette.push(i);
}

const gridIndexes = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];

const SprFileEditorPanel = ({
  document,
  contents,
  viewState
}: DocumentProps) => {
  const validRenderer: (
    context: GenericFileEditorContext<SprFileContents, SprFileViewState>
  ) => JSX.Element = context => {
    // --- Handle common keys
    const handleCommonKeys = (key: string) => {
      // TODO: Implement
    };

    const zoomFactor = context.viewState?.zoomFactor ?? 2;
    let spriteMap = context.viewState?.spriteMap;
    if (!spriteMap) {
      spriteMap = new Uint8Array(16 * 16);
      for (let i = 0; i < 16 * 16; i++) {
        spriteMap[i] = i % 9 === 0 ? 0xe3 : i;
      }
    }
    const palette = defaultPalette.slice(0);

    return (
      <>
        <Row>
          <KeyHandler
            xclass={styles.headerRow}
            onKey={handleCommonKeys}
            autofocus={true}
          >
            <SmallIconButton
              iconName='undo'
              title={"Undo"}
              enable={true}
              clicked={() => {
                // TODO: Implement
              }}
            />
            <SmallIconButton
              iconName='redo'
              title={"Redo"}
              enable={true}
              clicked={async () => {
                // TODO: Implement
              }}
            />
            <ToolbarSeparator small={true} />
            <SmallIconButton
              iconName='@zoom-in'
              title={"Zoom-in"}
              enable={zoomFactor < 3}
              clicked={() => {
                context.changeViewState(vs => {
                  vs.zoomFactor = zoomFactor + 1;
                });
              }}
            />
            <SmallIconButton
              iconName='@zoom-out'
              title={"Zoom-out"}
              enable={zoomFactor > 1}
              clicked={async () => {
                context.changeViewState(vs => (vs.zoomFactor = zoomFactor - 1));
              }}
            />
            <ToolbarSeparator small={true} />
            <SmallIconButton
              iconName='@pencil'
              title={"Pencil tool"}
              enable={true}
              clicked={async () => {
                // TODO: Implement
              }}
            />
            <SmallIconButton
              iconName='@line'
              title={"Line tool"}
              enable={true}
              clicked={async () => {
                // TODO: Implement
              }}
            />
            <SmallIconButton
              iconName='@rectangle'
              title={"Rectangle tool"}
              enable={true}
              clicked={async () => {
                // TODO: Implement
              }}
            />
            <SmallIconButton
              iconName='@rectangle-filled'
              title={"Filled rectangle tool"}
              enable={true}
              clicked={async () => {
                // TODO: Implement
              }}
            />
            <SmallIconButton
              iconName='@circle'
              title={"Circle tool"}
              enable={true}
              clicked={async () => {
                // TODO: Implement
              }}
            />
            <SmallIconButton
              iconName='@circle-filled'
              title={"Filled circle tool"}
              enable={true}
              clicked={async () => {
                // TODO: Implement
              }}
            />
            <SmallIconButton
              iconName='@paint'
              title={"Paint tool"}
              enable={true}
              clicked={async () => {
                // TODO: Implement
              }}
            />
            <SmallIconButton
              iconName='@select'
              title={"Select area tool"}
              enable={true}
              clicked={async () => {
                // TODO: Implement
              }}
            />
            <SmallIconButton
              iconName='@copy'
              title={"Copy selected area"}
              enable={true}
              clicked={async () => {
                // TODO: Implement
              }}
            />
            <SmallIconButton
              iconName='@paste'
              title={"Paste copied area"}
              enable={true}
              clicked={async () => {
                // TODO: Implement
              }}
            />
            <SmallIconButton
              iconName='@rotate'
              title={"Rotate counter-clockwise"}
              enable={true}
              clicked={async () => {
                const newSprite = rotateCounterClockwise(spriteMap);
                context.changeViewState(vs => (vs.spriteMap = newSprite));
              }}
            />
            <SmallIconButton
              iconName='@rotate-clockwise'
              title={"Rotate clockwise"}
              enable={true}
              clicked={async () => {
                const newSprite = rotateClockwise(spriteMap);
                context.changeViewState(vs => (vs.spriteMap = newSprite));
              }}
            />
            <SmallIconButton
              iconName='@flip-vertical'
              title={"Flip vertically"}
              enable={true}
              clicked={async () => {
                const newSprite = flipVertical(spriteMap);
                context.changeViewState(vs => (vs.spriteMap = newSprite));
              }}
            />
            <SmallIconButton
              iconName='@flip-horizontal'
              title={"Flip horizontally"}
              enable={true}
              clicked={async () => {
                const newSprite = flipHorizontal(spriteMap);
                context.changeViewState(vs => (vs.spriteMap = newSprite));
              }}
            />
          </KeyHandler>
        </Row>
        <Panel xclass={styles.editorPanel}>
          <Row>
            <div className={styles.editorArea}>
              <SpriteEditorGrid
                zoomFactor={zoomFactor}
                spriteMap={spriteMap}
                palette={palette}
                tranparencyIndex={0xe3}
              />
              <NextPaletteViewer
                palette={defaultPalette}
                transparencyIndex={0xe3}
                allowSelection={true}
                smallDisplay={true}
              />
            </div>
          </Row>
          <Row>
            <KeyHandler
              xclass={styles.headerRow}
              onKey={handleCommonKeys}
              autofocus={true}
            >
              <ToolbarSeparator small={true} />
              <SmallIconButton
                iconName='@duplicate'
                title={"Duplicate sprite"}
                enable={true}
                clicked={async () => {
                  // TODO: Implement
                }}
              />
              <SmallIconButton
                iconName='@cut'
                title={"Cut sprite"}
                enable={true}
                clicked={async () => {
                  // TODO: Implement
                }}
              />
              <SmallIconButton
                iconName='@move-left'
                title={"Move sprite left"}
                enable={true}
                clicked={async () => {
                  // TODO: Implement
                }}
              />
              <SmallIconButton
                iconName='@move-right'
                title={"Move sprite right"}
                enable={true}
                clicked={async () => {
                  // TODO: Implement
                }}
              />
              <SmallIconButton
                iconName='@plus'
                title={"Add new sprite"}
                enable={true}
                clicked={async () => {
                  // TODO: Implement
                }}
              />
            </KeyHandler>
          </Row>
        </Panel>
      </>
    );
  };
  return createElement(
    GenericFileEditorPanel<SprFileContents, SprFileViewState>,
    {
      document,
      contents,
      viewState,
      fileLoader: loadSprFileContents,
      validRenderer
    }
  );
};

export const createSprFileEditorPanel = ({
  document,
  contents,
  viewState
}: DocumentProps) => {
  return (
    <SprFileEditorPanel
      document={document}
      contents={contents}
      viewState={viewState}
      apiLoaded={() => {}}
    />
  );
};

function loadSprFileContents (contents: Uint8Array): {
  fileInfo?: SprFileContents;
  error?: string;
} {
  const reader = new BinaryReader(contents);
  const sprites: Uint8Array[] = [];
  while (!reader.eof) {
    const sprite = reader.readBytes(16 * 16);
    sprites.push(new Uint8Array(sprite));
  }
  return { fileInfo: { sprites } };
}

function saveSprFileContents (): Uint8Array {
  return new Uint8Array(0);
}

type SprFileContents = {
  sprites: Uint8Array[];
};

type SpriteEditorGridProps = {
  zoomFactor: number;
  spriteMap: Uint8Array;
  palette: number[];
  tranparencyIndex: number;
};

const SpriteEditorGrid = ({
  zoomFactor,
  spriteMap,
  palette,
  tranparencyIndex
}: SpriteEditorGridProps) => {
  const cellSize = (zoomFactor - 1) * 8 + 16;
  const gridSize = 16 * cellSize + 1;
  return (
    <div className={styles.spriteGridWrapper}>
      <div
        className={styles.spriteEditorGrid}
        style={{ width: gridSize, height: gridSize }}
      >
        <svg viewBox={`0 0 ${gridSize} ${gridSize}`}>
          <defs>
            <pattern
              id='pattern1'
              x={0}
              y={0}
              width={cellSize}
              height={cellSize}
              patternUnits='userSpaceOnUse'
            >
              <line
                x1={-25}
                y1={0}
                x2={30}
                y2={60}
                stroke='var(--color-dash-sprite-editor)'
              />
              <line
                x1={-15}
                y1={0}
                x2={40}
                y2={60}
                stroke='var(--color-dash-sprite-editor)'
              />
              <line
                x1={-5}
                y1={0}
                x2={50}
                y2={60}
                stroke='var(--color-dash-sprite-editor)'
              />
              <line
                x1={5}
                y1={0}
                x2={60}
                y2={60}
                stroke='var(--color-dash-sprite-editor)'
              />
              <line
                x1={15}
                y1={0}
                x2={70}
                y2={60}
                stroke='var(--color-dash-sprite-editor)'
              />
              <line
                x1={25}
                y1={0}
                x2={80}
                y2={60}
                stroke='var(--color-dash-sprite-editor)'
              />
              <line
                x1={5}
                y1={0}
                x2={-50}
                y2={60}
                stroke='var(--color-dash-sprite-editor)'
              />
              <line
                x1={15}
                y1={0}
                x2={-40}
                y2={60}
                stroke='var(--color-dash-sprite-editor)'
              />
              <line
                x1={25}
                y1={0}
                x2={-30}
                y2={60}
                stroke='var(--color-dash-sprite-editor)'
              />
              <line
                x1={35}
                y1={0}
                x2={-20}
                y2={60}
                stroke='var(--color-dash-sprite-editor)'
              />
              <line
                x1={45}
                y1={0}
                x2={-10}
                y2={60}
                stroke='var(--color-dash-sprite-editor)'
              />
              <line
                x1={55}
                y1={0}
                x2={0}
                y2={60}
                stroke='var(--color-dash-sprite-editor)'
              />
            </pattern>
          </defs>
          {Array.from(spriteMap).map((colorIndex, i) => {
            const row = i >> 4;
            const col = i & 0x0f;
            return colorIndex === tranparencyIndex ? (
              <rect
                x={col * cellSize + 1}
                y={row * cellSize + 1}
                width={cellSize - 2}
                height={cellSize - 2}
                fill={`url(#pattern1)`}
              />
            ) : (
              <rect
                x={col * cellSize + 1}
                y={row * cellSize + 1}
                width={cellSize - 2}
                height={cellSize - 2}
                fill={getCssStringForPaletteCode(palette[colorIndex])}
              />
            );
          })}
          {/* {gridIndexes.map(i => {
            return (
              <>
                <line
                  x1={0}
                  y1={i * cellSize}
                  x2={gridSize}
                  y2={i * cellSize}
                  strokeDasharray={i % 4 !== 0 ? "1,4" : "1,1"}
                  strokeWidth={1.5}
                  stroke='var(--color-ruler-sprite-editor)'
                />
                <line
                  x1={i * cellSize}
                  y1={0}
                  x2={i * cellSize}
                  y2={gridSize}
                  strokeDasharray={i % 4 !== 0 ? "1,4" : "1,1"}
                  strokeWidth={1}
                  stroke='var(--color-ruler-sprite-editor)'
                />
              </>
            );
          })} */}
        </svg>
      </div>
    </div>
  );
};

function rotateCounterClockwise (sprite: Uint8Array): Uint8Array {
  const result = new Uint8Array(16 * 16);
  for (let row = 0; row < 16; row++) {
    for (let col = 0; col < 16; col++) {
      result[row * 16 + col] = sprite[col * 16 + 15 - row];
    }
  }
  return result;
}

function rotateClockwise (sprite: Uint8Array): Uint8Array {
  const result = new Uint8Array(16 * 16);
  for (let row = 0; row < 16; row++) {
    for (let col = 0; col < 16; col++) {
      result[row * 16 + col] = sprite[(15 - col) * 16 + row];
    }
  }
  return result;
}

function flipHorizontal (sprite: Uint8Array): Uint8Array {
  const result = new Uint8Array(16 * 16);
  for (let row = 0; row < 16; row++) {
    for (let col = 0; col < 16; col++) {
      result[row * 16 + col] = sprite[(15 - row) * 16 + col];
    }
  }
  return result;
} 

function flipVertical (sprite: Uint8Array): Uint8Array {  
  const result = new Uint8Array(16 * 16);
  for (let row = 0; row < 16; row++) {
    for (let col = 0; col < 16; col++) {
      result[row * 16 + col] = sprite[row * 16 + (15 - col)];
    }
  }
  return result;
}