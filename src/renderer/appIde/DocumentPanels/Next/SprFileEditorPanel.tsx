import styles from "./SprFileEditorPanel.module.scss";
import { DocumentProps } from "../../DocumentArea/DocumentsContainer";
import {
  GenericFileEditorContext,
  GenericFileEditorPanel
} from "../helpers/GenericFileEditorPanel";
import { BinaryReader } from "@common/utils/BinaryReader";
import { createElement, memo, useEffect, useRef, useState } from "react";
import { Row } from "@renderer/controls/generic/Row";
import { NextPaletteViewer } from "@renderer/controls/NextPaletteViewer";
import { Panel } from "@renderer/controls/generic/Panel";
import { SmallIconButton } from "@renderer/controls/IconButton";
import { ToolbarSeparator } from "@renderer/controls/ToolbarSeparator";
import {
  getAbrgForPaletteCode,
  getCssStringForPaletteCode,
  getLuminanceForPaletteCode,
  getRgbPartsForPaletteCode
} from "@emu/machines/zxNext/palette";
import { ScrollViewer } from "@renderer/controls/ScrollViewer";
import { TooltipFactory } from "@renderer/controls/Tooltip";
import classnames from "@renderer/utils/classnames";
import { ScreenCanvas } from "@renderer/controls/Next/ScreenCanvas";
import { useTheme } from "@renderer/theming/ThemeProvider";
import { LabelSeparator, Value } from "@renderer/controls/Labels";
import { Column } from "@renderer/controls/generic/Column";
import { Text } from "@renderer/controls/generic/Text";
import { toHexa2 } from "@renderer/appIde/services/ide-commands";
import { last, set } from "lodash";

type SprFileViewState = {
  scrollPosition?: number;
  zoomFactor?: number;
  spriteMap?: Uint8Array;
  spriteImagesSeparated?: boolean;
  showTrancparencyColor?: boolean;
  selectedSpriteIndex?: number;
  pencilColorIndex?: number;
  fillColorIndex?: number;
  currentRow?: string;
  currentColumn?: string;
  currentColorIndex?: number;
  currentTool?: SpriteTools;
};

const defaultPalette: number[] = [];
for (let i = 0; i < 256; i++) {
  defaultPalette.push(i);
}

const SprFileEditorPanel = ({
  document,
  contents,
  viewState
}: DocumentProps) => {
  const validRenderer: (
    context: GenericFileEditorContext<SprFileContents, SprFileViewState>
  ) => JSX.Element = context => {
    // --- Get the current view state
    const zoomFactor = context.viewState?.zoomFactor ?? 2;
    const spriteImagesSeparated =
      context.viewState?.spriteImagesSeparated ?? true;
    const showTrancparencyColor =
      context.viewState?.showTrancparencyColor ?? false;
    let selectedSpriteIndex = context.viewState?.selectedSpriteIndex ?? 0;
    let spriteMap = context.fileInfo?.sprites?.[selectedSpriteIndex];
    if (!spriteMap) {
      spriteMap = new Uint8Array(16 * 16);
      for (let i = 0; i < 16 * 16; i++) {
        spriteMap[i] = 0xe3;
      }
    }
    const palette = defaultPalette.slice(0);
    const pencilColorIndex = context.viewState?.pencilColorIndex ?? 0x0f;
    const fillColorIndex = context.viewState?.fillColorIndex ?? 0xe3;
    const currentRow = context.viewState?.currentRow ?? "-";
    const currentColumn = context.viewState?.currentColumn ?? "-";
    const currentColorIndex = context.viewState?.currentColorIndex ?? -1;
    const rgbParts =
      currentColorIndex >= 0
        ? getRgbPartsForPaletteCode(palette[currentColorIndex])
        : undefined;
    const currentTool = context.viewState?.currentTool ?? "pointer";

    const updateSpriteMap = (newSpriteMap: Uint8Array) => {
      context.changeViewState(vs => (vs.spriteMap = newSpriteMap));
      if (context.fileInfo?.sprites) {
        context.fileInfo.sprites[selectedSpriteIndex] = newSpriteMap;
      }
    };

    return (
      <>
        <Row>
          <ToolbarSeparator small={true} />
          <SmallIconButton
            iconName='@duplicate'
            title={"Duplicate sprite"}
            enable={true}
            clicked={async () => {
              const sprites = context.fileInfo?.sprites;
              const sprite = sprites[selectedSpriteIndex];
              const newSprite = new Uint8Array(sprite);
              sprites.splice(selectedSpriteIndex, 0, newSprite);
              updateSpriteMap(newSprite);
            }}
          />
          <SmallIconButton
            iconName='@cut'
            title={"Cut sprite"}
            enable={context.fileInfo?.sprites?.length > 1}
            clicked={async () => {
              const sprites = context.fileInfo?.sprites;
              if (sprites.length < 2) {
                return;
              }
              sprites.splice(selectedSpriteIndex, 1);
              if (selectedSpriteIndex > sprites.length - 1) {
                selectedSpriteIndex = sprites.length - 1;
              }
              spriteMap = sprites[selectedSpriteIndex];
              context.changeViewState(vs => {
                vs.selectedSpriteIndex = selectedSpriteIndex;
                vs.spriteMap = spriteMap.slice(0);
                if (context.fileInfo?.sprites) {
                  context.fileInfo.sprites[selectedSpriteIndex] = vs.spriteMap;
                }
              });
            }}
          />
          <SmallIconButton
            iconName='@move-left'
            title={"Move sprite left"}
            enable={selectedSpriteIndex > 0}
            clicked={async () => {
              const sprites = context.fileInfo?.sprites;
              if (selectedSpriteIndex < 1) {
                return;
              }
              const sprite = sprites[selectedSpriteIndex - 1];
              sprites[selectedSpriteIndex - 1] = sprites[selectedSpriteIndex];
              sprites[selectedSpriteIndex] = sprite;
              selectedSpriteIndex--;
              context.changeViewState(vs => {
                vs.selectedSpriteIndex = selectedSpriteIndex;
                vs.spriteMap = sprites[selectedSpriteIndex].slice(0);
              });
            }}
          />
          <SmallIconButton
            iconName='@move-right'
            title={"Move sprite right"}
            enable={selectedSpriteIndex < context.fileInfo?.sprites?.length - 1}
            clicked={async () => {
              const sprites = context.fileInfo?.sprites;
              if (
                selectedSpriteIndex >=
                context.fileInfo?.sprites?.length - 1
              ) {
                return;
              }
              const sprite = sprites[selectedSpriteIndex + 1];
              sprites[selectedSpriteIndex + 1] = sprites[selectedSpriteIndex];
              sprites[selectedSpriteIndex] = sprite;
              selectedSpriteIndex++;
              context.changeViewState(vs => {
                vs.selectedSpriteIndex = selectedSpriteIndex;
                vs.spriteMap = sprites[selectedSpriteIndex].slice(0);
              });
            }}
          />
          <SmallIconButton
            iconName='@plus'
            title={"Add new sprite"}
            enable={true}
            clicked={async () => {
              const sprites = context.fileInfo?.sprites;
              const sprite = sprites[selectedSpriteIndex];
              const newSprite = new Uint8Array(256);
              for (let i = 0; i < 256; i++) {
                newSprite[i] = 0xe3;
              }
              sprites.splice(selectedSpriteIndex, 0, newSprite);
              updateSpriteMap(newSprite);
            }}
          />
          <ToolbarSeparator small={true} />
          <SmallIconButton
            iconName='@separate-vertical'
            title={`${
              spriteImagesSeparated ? "Merge" : "Separate"
            } sprites vertically`}
            selected={spriteImagesSeparated}
            enable={true}
            clicked={async () => {
              context.changeViewState(
                vs => (vs.spriteImagesSeparated = !spriteImagesSeparated)
              );
            }}
          />
          <SmallIconButton
            iconName='@transparent'
            title={`${
              showTrancparencyColor ? "Hide" : "Show"
            } transparency color`}
            selected={showTrancparencyColor}
            enable={true}
            clicked={async () => {
              context.changeViewState(
                vs => (vs.showTrancparencyColor = !showTrancparencyColor)
              );
            }}
          />
          {selectedSpriteIndex !== undefined &&
            context?.fileInfo?.sprites?.length > 0 && (
              <>
                <ToolbarSeparator small={true} />
                <LabelSeparator width={8} />
                <Text
                  text={`Sprite #${selectedSpriteIndex + 1} of ${
                    context.fileInfo.sprites.length
                  }`}
                />
              </>
            )}
        </Row>
        <ScrollViewer
          xclass={styles.spriteScroller}
          scrollBarWidth={4}
          allowVertical={false}
        >
          {context.fileInfo?.sprites &&
            context.fileInfo.sprites.map((spr, idx) => {
              return (
                <SpriteImage
                  key={idx}
                  title={`Sprite #${idx + 1} of ${
                    context.fileInfo.sprites.length
                  }`}
                  spriteMap={spr}
                  palette={palette}
                  transparencyIndex={0xe3}
                  separated={spriteImagesSeparated}
                  showTransparencyColor={showTrancparencyColor}
                  selected={selectedSpriteIndex === idx}
                  clicked={() => {
                    context.changeViewState(vs => {
                      vs.selectedSpriteIndex = idx;
                      vs.spriteMap = spr;
                    });
                  }}
                />
              );
            })}
        </ScrollViewer>
        <Row>
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
            iconName='@pointer'
            title={"Pencil tool"}
            selected={currentTool === "pointer"}
            enable={true}
            clicked={async () => {
              context.changeViewState(vs => (vs.currentTool = "pointer"));
            }}
          />
          <SmallIconButton
            iconName='@pencil'
            title={"Pencil tool"}
            selected={currentTool === "pencil"}
            enable={true}
            clicked={async () => {
              context.changeViewState(vs => (vs.currentTool = "pencil"));
            }}
          />
          <SmallIconButton
            iconName='@line'
            title={"Line tool"}
            selected={currentTool === "line"}
            enable={true}
            clicked={async () => {
              context.changeViewState(vs => (vs.currentTool = "line"));
            }}
          />
          <SmallIconButton
            iconName='@rectangle'
            title={"Rectangle tool"}
            selected={currentTool === "rectangle"}
            enable={true}
            clicked={async () => {
              context.changeViewState(vs => (vs.currentTool = "rectangle"));
            }}
          />
          <SmallIconButton
            iconName='@rectangle-filled'
            title={"Filled rectangle tool"}
            selected={currentTool === "rectangle-filled"}
            enable={true}
            clicked={async () => {
              context.changeViewState(
                vs => (vs.currentTool = "rectangle-filled")
              );
            }}
          />
          <SmallIconButton
            iconName='@circle'
            title={"Circle tool"}
            selected={currentTool === "circle"}
            enable={true}
            clicked={async () => {
              context.changeViewState(vs => (vs.currentTool = "circle"));
            }}
          />
          <SmallIconButton
            iconName='@circle-filled'
            title={"Filled circle tool"}
            selected={currentTool === "circle-filled"}
            enable={true}
            clicked={async () => {
              context.changeViewState(vs => (vs.currentTool = "circle-filled"));
            }}
          />
          <SmallIconButton
            iconName='@paint'
            title={"Paint tool"}
            selected={currentTool === "paint"}
            enable={true}
            clicked={async () => {
              context.changeViewState(vs => (vs.currentTool = "paint"));
            }}
          />
          <ToolbarSeparator small={true} />
          <SmallIconButton
            iconName='@rotate'
            title={"Rotate counter-clockwise"}
            enable={true}
            clicked={async () =>
              updateSpriteMap(rotateCounterClockwise(spriteMap))
            }
          />
          <SmallIconButton
            iconName='@rotate-clockwise'
            title={"Rotate clockwise"}
            enable={true}
            clicked={async () => updateSpriteMap(rotateClockwise(spriteMap))}
          />
          <SmallIconButton
            iconName='@flip-vertical'
            title={"Flip vertically"}
            enable={true}
            clicked={async () => updateSpriteMap(flipVertical(spriteMap))}
          />
          <SmallIconButton
            iconName='@flip-horizontal'
            title={"Flip horizontally"}
            enable={true}
            clicked={async () => updateSpriteMap(flipHorizontal(spriteMap))}
          />
        </Row>
        <Panel xclass={styles.editorPanel}>
          <Row xclass={styles.editorInfo}>
            <LabelSeparator width={8} />
            <Text text='Pencil color:' />
            <LabelSeparator width={8} />
            <ColorSample
              color={palette[pencilColorIndex]}
              isTransparency={pencilColorIndex === 0xe3}
            />
            <LabelSeparator width={8} />
            <SmallIconButton
              iconName='@swap'
              title='Swap colors'
              enable={true}
              clicked={async () => {
                context.changeViewState(vs => {
                  vs.pencilColorIndex = fillColorIndex;
                  vs.fillColorIndex = pencilColorIndex;
                });
              }}
            />
            <LabelSeparator width={8} />
            <Text text='Fill color:' />
            <LabelSeparator width={8} />
            <ColorSample
              color={palette[fillColorIndex]}
              isTransparency={fillColorIndex === 0xe3}
            />
            <LabelSeparator width={8} />
            <ToolbarSeparator small={true} />
            <Text text='Position:' />
            <Value text={`(${currentRow}:${currentColumn})`} width={60} />
            <Text text='Color:' />
            <Value
              text={
                currentColorIndex >= 0 ? "$" + toHexa2(currentColorIndex) : "-"
              }
              width={32}
            />
            {currentColorIndex >= 0 && (
              <ColorSample
                color={palette[currentColorIndex]}
                isTransparency={currentColorIndex === 0xe3}
              />
            )}
            <LabelSeparator width={8} />
            {rgbParts && (
              <Value
                text={`(R: ${rgbParts[0]}, G: ${rgbParts[1]}, B: ${rgbParts[2]})`}
              />
            )}
          </Row>
          <Row>
            <div className={styles.editorArea}>
              <SpriteEditorGrid
                zoomFactor={zoomFactor}
                spriteMap={spriteMap}
                palette={palette}
                transparencyIndex={0xe3}
                pencilColorIndex={pencilColorIndex}
                fillColorIndex={fillColorIndex}
                tool={currentTool}
                onPositionChange={(row, col) => {
                  context.changeViewState(vs => {
                    vs.currentRow = row?.toString() ?? "-";
                    vs.currentColumn = col?.toString() ?? "-";
                    vs.currentColorIndex =
                      row !== undefined && col !== undefined
                        ? spriteMap[row * 16 + col]
                        : -1;
                  });
                }}
                onSpriteChange={(newSpriteMap: Uint8Array) => {
                  updateSpriteMap(newSpriteMap);
                }}
              />
              <Column>
                <NextPaletteViewer
                  palette={defaultPalette}
                  transparencyIndex={0xe3}
                  allowSelection={true}
                  smallDisplay={true}
                  onSelection={idx => {
                    context.changeViewState(vs => (vs.pencilColorIndex = idx));
                  }}
                  onRightClick={idx => {
                    context.changeViewState(vs => (vs.fillColorIndex = idx));
                  }}
                />
              </Column>
            </div>
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
  transparencyIndex: number;
  pencilColorIndex?: number;
  fillColorIndex?: number;
  tool: SpriteTools;
  onPositionChange?: (row?: number, col?: number) => void;
  onSpriteChange?: (sprite: Uint8Array) => void;
};

const SpriteEditorGrid = ({
  zoomFactor,
  spriteMap,
  palette,
  transparencyIndex,
  pencilColorIndex,
  fillColorIndex,
  tool,
  onPositionChange,
  onSpriteChange
}: SpriteEditorGridProps) => {
  const cellSize = (zoomFactor - 1) * 8 + 16;
  const gridSize = 16 * cellSize + 1;

  const theme = useTheme();
  const currentCellStroke = theme.getThemeProperty("--color-pos-sprite-editor");

  const [row, setRow] = useState<number | undefined>(undefined);
  const [col, setCol] = useState<number | undefined>(undefined);
  const [version, setVersion] = useState(1);
  const savedSpriteMap = useRef<Uint8Array>();
  const activeSpriteMap = useRef<Uint8Array>(spriteMap);
  const inverseColors = useRef<boolean>(false);
  const startMousePos = useRef<MouseGridPosition>();
  let lastMovePos = [-1, -1];

  useEffect(() => {
    activeSpriteMap.current = spriteMap;
    setVersion(version + 1);
  }, [spriteMap])

  // --- Event handlers for moving the mouse
  const _move = (e: MouseEvent) => move(e);
  const _endMove = () => endMove();

  // --- Start the drawing operation with the tool set
  const handleMouseDown = (row: number, col: number, button: number) => {
    // --- Save the current sprite map
    savedSpriteMap.current = activeSpriteMap.current.slice(0);
    inverseColors.current = button === 2;
  };

  const handleMouseMove = (row: number, col: number, completed = false) => {
    if (!savedSpriteMap.current || !startMousePos.current) return;
    if (lastMovePos[0] === row && lastMovePos[1] === col) return;
    lastMovePos = [row, col];
    const newMap = updateSpriteMapOperation(
      savedSpriteMap.current,
      startMousePos.current.row,
      startMousePos.current.col,
      row,
      col,
      pencilColorIndex,
      fillColorIndex,
      inverseColors.current,
      tool
    );
    activeSpriteMap.current = newMap.sprite;
    onSpriteChange?.(activeSpriteMap.current);
    if (newMap.sprite) {
      if (newMap.immediateUpdate || completed) {
        savedSpriteMap.current = newMap.sprite;
      }
      setVersion(version + 1);
    }
  };

  const handleMouseUp = (row?: number, col?: number) => {
    // --- Complete the operation
    if (row === undefined || col === undefined) {
      onSpriteChange?.(activeSpriteMap.current);
    } else {
      handleMouseMove(row, col, true);
    }
    savedSpriteMap.current = undefined;
    lastMovePos = [-1, -1];
  };

  return (
    <div
      tabIndex={0}
      className={styles.spriteGridWrapper}
      onMouseLeave={() => {
        setRow(undefined);
        setCol(undefined);
        onPositionChange?.();
      }}
      onKeyDown={e => console.log("key", e.key)}
    >
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
          {Array.from(activeSpriteMap.current).map((colorIndex, i) => {
            const thisRow = i >> 4;
            const thisCol = i & 0x0f;
            return (
              <rect
                onMouseEnter={() => {
                  setRow(thisRow);
                  setCol(thisCol);
                  onPositionChange?.(thisRow, thisCol);
                }}
                onMouseDown={e => {
                  if (tool === "pointer") return;
                  e.stopPropagation();
                  e.preventDefault();
                  startMove(e);
                  startMousePos.current = {
                    row: thisRow,
                    col: thisCol,
                    x: e.clientX,
                    y: e.clientY
                  };
                  handleMouseDown(thisRow, thisCol, e.button);
                }}
                onMouseMove={e => {
                  if (startMousePos.current) {
                    _move(e as unknown as MouseEvent);
                  }
                  onPositionChange?.(thisRow, thisCol);
                }}
                onMouseUp={e => {
                  endMove(thisRow, thisCol);
                }}
                key={i}
                x={thisCol * cellSize + 1}
                y={thisRow * cellSize + 1}
                stroke={
                  tool !== "pointer" && row === thisRow && col === thisCol
                    ? currentCellStroke
                    : "none"
                }
                width={cellSize - 2}
                height={cellSize - 2}
                fill={
                  colorIndex === transparencyIndex
                    ? "url(#pattern1)"
                    : getCssStringForPaletteCode(palette[colorIndex])
                }
              />
            );
          })}
        </svg>
      </div>
    </div>
  );

  // --- Sign the start of operation
  function startMove (e: React.MouseEvent): void {
    // --- Capture mouse move via window events
    window.addEventListener("mouseup", _endMove);
    window.addEventListener("mousemove", _move);
    document.body.style.cursor = "crosshair";
  }

  function move (e: MouseEvent): void {
    const startPos = startMousePos.current;
    if (startPos) {
      const row =
        Math.floor((e.clientY - startPos.y) / cellSize + 0.5) + startPos.row;
      const col =
        Math.floor((e.clientX - startPos.x) / cellSize + 0.5) + startPos.col;
      handleMouseMove(row, col);
    }
  }

  // --- End moving the splitter
  function endMove (row?: number, col?: number): void {
    handleMouseUp(row, col);
    startMousePos.current = undefined;

    // --- Release the captured mouse
    window.removeEventListener("mouseup", _endMove);
    window.removeEventListener("mousemove", _move);
    document.body.style.cursor = "default";
  }
};

type SpriteImageProps = {
  title?: string;
  zoom?: number;
  spriteMap: Uint8Array;
  palette: number[];
  transparencyIndex: number;
  separated?: boolean;
  showTransparencyColor?: boolean;
  selected?: boolean;
  clicked: () => void;
};

const SpriteImage = ({
  title = "No title",
  zoom = 3,
  spriteMap,
  palette,
  transparencyIndex,
  showTransparencyColor = false,
  separated = false,
  selected,
  clicked
}: SpriteImageProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    setVersion(version + 1);
  }, [showTransparencyColor]);

  const createPixelData = (
    data: Uint8Array,
    palette: number[],
    target: Uint32Array
  ) => {
    for (let i = 0; i < 256; i++) {
      const colorIndex = data[i];
      target[i] =
        colorIndex !== transparencyIndex || showTransparencyColor
          ? getAbrgForPaletteCode(palette[colorIndex])
          : 0x00000000;
    }
  };
  return (
    <div
      ref={ref}
      className={classnames(styles.spriteImageWrapper, {
        [styles.separated]: separated,
        [styles.selected]: selected
      })}
      onClick={clicked}
    >
      <ScreenCanvas
        data={spriteMap.slice(0)}
        palette={palette}
        zoomFactor={zoom}
        screenWidth={16}
        screenHeight={16}
        createPixelData={createPixelData}
      />
      <TooltipFactory
        refElement={ref.current}
        placement='right'
        offsetX={-12}
        offsetY={28}
      >
        {title}
      </TooltipFactory>
    </div>
  );
};

type ColorSampleProps = {
  color: number;
  isTransparency?: boolean;
};

const ColorSample = memo(({ color, isTransparency }: ColorSampleProps) => {
  const backgroundColor = getCssStringForPaletteCode(color);
  const midColor = getLuminanceForPaletteCode(color) < 3.5 ? "white" : "black";

  return (
    <div className={styles.colorSample} style={{ backgroundColor }}>
      {isTransparency && (
        <svg viewBox='0 0 16 16'>
          <circle cx={8} cy={8} r={5} fill={midColor} fillOpacity={0.5} />
        </svg>
      )}
    </div>
  );
});

type SpriteTools =
  | "pointer"
  | "pencil"
  | "line"
  | "rectangle"
  | "rectangle-filled"
  | "circle"
  | "circle-filled"
  | "paint";

type MouseGridPosition = {
  row: number;
  col: number;
  x: number;
  y: number;
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

function updateSpriteMapOperation (
  spriteMap: Uint8Array,
  row1: number,
  col1: number,
  row2: number,
  col2: number,
  pencilColorIndex: number,
  fillColorIndex: number,
  inverseColors: boolean,
  tool: SpriteTools
): { sprite: Uint8Array | null; immediateUpdate: boolean } {
  const newMap = new Uint8Array(spriteMap);
  if (inverseColors) {
    [pencilColorIndex, fillColorIndex] = [fillColorIndex, pencilColorIndex];
  }
  switch (tool) {
    case "pencil":
      newMap[row2 * 16 + col2] = pencilColorIndex;
      return { sprite: newMap, immediateUpdate: true };
    case "rectangle":
      drawRectangle(newMap, row1, col1, row2, col2, pencilColorIndex);
      break;
    case "rectangle-filled":
      drawRectangle(
        newMap,
        row1,
        col1,
        row2,
        col2,
        pencilColorIndex,
        fillColorIndex
      );
      break;
    case "circle":
      drawEllipse(newMap, row1, col1, row2, col2, pencilColorIndex);
      break;
    case "circle-filled":
      drawEllipse(newMap, row1, col1, row2, col2, pencilColorIndex);
      const cx = Math.max(
        0,
        Math.min(15, Math.floor(Math.abs(row2 - row1) / 2))
      );
      const cy = Math.max(
        0,
        Math.min(15, Math.floor(Math.abs(col2 - col1) / 2))
      );
      boundaryFill(newMap, cx, cy, pencilColorIndex, fillColorIndex);
      break;
    case "paint":
      areaFill(newMap, row2, col2, pencilColorIndex);
      return { sprite: newMap, immediateUpdate: true };
    default:
      return { sprite: null, immediateUpdate: false };
  }
  return { sprite: newMap, immediateUpdate: false };
}

function drawRectangle (
  map: Uint8Array,
  row1: number,
  col1: number,
  row2: number,
  col2: number,
  pencilColor: number,
  fillColor?: number
): void {
  [row1, col1, row2, col2] = normalizeCoords(row1, col1, row2, col2);
  for (let row = row1; row <= row2; row++) {
    for (let col = col1; col <= col2; col++) {
      if (row < 0 || row > 15 || col < 0 || col > 15) continue;
      if (row === row1 || row === row2 || col === col1 || col === col2) {
        map[row * 16 + col] = pencilColor;
      } else if (fillColor !== undefined) {
        map[row * 16 + col] = fillColor;
      }
    }
  }
}

function drawEllipse (
  map: Uint8Array,
  row1: number,
  col1: number,
  row2: number,
  col2: number,
  pencilColor: number
): void {
  [row1, col1, row2, col2] = normalizeCoords(row1, col1, row2, col2);

  // --- Single pixel ellipse
  if (row1 === row2 && col1 === col2) {
    map[row1 * 16 + col1] = pencilColor;
    return;
  }

  const rx = Math.abs(col2 - col1) / 2;
  const ry = Math.abs(row2 - row1) / 2;
  const xc = row1 + rx;
  const yc = col1 + ry;

  if (rx !== ry) {
    // --- Ellipse with midpoint algorithm
    let dx = 0,
      dy = 0,
      d1 = 0,
      d2 = 0,
      x = 0,
      y = ry;

    // --- Initial decision parameter of region 1
    d1 = ry * ry - rx * rx * ry + 0.25 * rx * rx;
    dx = 2 * ry * ry * x;
    dy = 2 * rx * rx * y;

    // --- For region 1
    while (dx < dy) {
      // --- Print points based on 4-way symmetry
      plotPoint(
        Math.min(x + up(xc), col2),
        Math.min(y + up(yc), row2),
        pencilColor
      );
      plotPoint(
        Math.max(-x + down(xc), col1),
        Math.min(y + down(yc), row2),
        pencilColor
      );
      plotPoint(
        Math.min(x + up(xc), col2),
        Math.max(-y + down(yc), row1),
        pencilColor
      );
      plotPoint(
        Math.max(-x + down(xc), col1),
        Math.max(-y + down(yc), row1),
        pencilColor
      );

      // --- Checking and updating value of decision parameter based on algorithm
      if (d1 < 0) {
        x++;
        dx = dx + 2 * ry * ry;
        d1 = d1 + dx + ry * ry;
      } else {
        x++;
        y--;
        dx = dx + 2 * ry * ry;
        dy = dy - 2 * rx * rx;
        d1 = d1 + dx - dy + ry * ry;
      }
    }

    // --- Decision parameter of region 2
    d2 =
      ry * ry * ((x + 0.5) * (x + 0.5)) +
      rx * rx * ((y - 1) * (y - 1)) -
      rx * rx * ry * ry;

    // --- Plotting points of region 2
    while (y >= 0) {
      // --- Print points based on 4-way symmetry
      plotPoint(
        Math.min(x + up(xc), col2),
        Math.min(y + up(yc), row2),
        pencilColor
      );
      plotPoint(
        Math.max(-x + down(xc), col1),
        Math.min(y + down(yc), row2),
        pencilColor
      );
      plotPoint(
        Math.min(x + up(xc), col2),
        Math.max(-y + down(yc), row1),
        pencilColor
      );
      plotPoint(
        Math.max(-x + down(xc), col1),
        Math.max(-y + down(yc), row1),
        pencilColor
      );

      // --- Checking and updating parameter value based on algorithm
      if (d2 > 0) {
        y--;
        dy = dy - 2 * rx * rx;
        d2 = d2 + rx * rx - dy;
      } else {
        y--;
        x++;
        dx = dx + 2 * ry * ry;
        dy = dy - 2 * rx * rx;
        d2 = d2 + dx - dy + rx * rx;
      }
    }
  } else {
    // --- Circle with Bresenham's algorithm
    let x = 0,
      y = rx;
    let d = 3 - 2 * rx;
    drawCirclePoints(xc, yc, x, y, pencilColor);
    while (y >= x) {
      // --- For each pixel we will draw all eight pixels
      x++;

      // --- Check for decision parameter and correspondingly update d, x, y
      if (d > 0) {
        y--;
        d = d + 4 * (x - y) + 10;
      } else d = d + 4 * x + 6;
      drawCirclePoints(xc, yc, x, y, pencilColor);
    }
  }

  function down (x: number): number {
    return Number.isInteger(x) ? x : x - 0.25;
  }

  function up (x: number): number {
    return Number.isInteger(x) ? x : x + 0.25;
  }

  function drawCirclePoints (
    xc: number,
    yc: number,
    x: number,
    y: number,
    colorIndex: number
  ) {
    plotPoint(
      Math.min(x + up(xc), col2),
      Math.min(y + up(yc), row2),
      colorIndex
    );
    plotPoint(
      Math.max(-x + down(xc), col1),
      Math.min(y + up(yc), row2),
      colorIndex
    );
    plotPoint(
      Math.min(x + up(xc), col2),
      Math.max(-y + down(yc), row1),
      colorIndex
    );
    plotPoint(
      Math.max(-x + down(xc), col1),
      Math.max(-y + down(yc), row1),
      colorIndex
    );
    plotPoint(
      Math.min(y + up(xc), col2),
      Math.min(x + up(yc), row2),
      colorIndex
    );
    plotPoint(
      Math.max(-y + down(xc), col1),
      Math.min(x + up(yc), row2),
      colorIndex
    );
    plotPoint(
      Math.min(y + up(xc), col2),
      Math.max(-x + down(yc), row1),
      colorIndex
    );
    plotPoint(
      Math.max(-y + down(xc), col1),
      Math.max(-x + down(yc), row1),
      colorIndex
    );
  }

  function plotPoint (col: number, row: number, colorIndex: number) {
    row = Math.round(row);
    col = Math.round(col);
    if (row < 0 || row > 15 || col < 0 || col > 15) return;
    map[row * 16 + col] = colorIndex;
  }
}

function areaFill (
  map: Uint8Array,
  row: number,
  col: number,
  fillColor: number
) {
  const startColor = map[row * 16 + col];
  fill(row, col);

  function fill (row: number, col: number) {
    const pixel = map[row * 16 + col];
    if (row < 0 || row > 15 || col < 0 || col > 15) {
      return;
    }
    if (pixel !== startColor || pixel === fillColor) {
      return;
    }

    map[row * 16 + col] = fillColor;
    fill(row + 1, col);
    fill(row - 1, col);
    fill(row, col + 1);
    fill(row, col - 1);
  }
}

function boundaryFill (
  map: Uint8Array,
  row: number,
  col: number,
  boundaryColor: number,
  fillColor: number
) {
  fill(row, col);

  function fill (row: number, col: number) {
    const pixel = map[row * 16 + col];
    if (row < 0 || row > 15 || col < 0 || col > 15) {
      return;
    }
    if (pixel === boundaryColor || pixel === fillColor) {
      return;
    }

    map[row * 16 + col] = fillColor;
    fill(row + 1, col);
    fill(row - 1, col);
    fill(row, col + 1);
    fill(row, col - 1);
  }
}

function normalizeCoords (
  row1: number,
  col1: number,
  row2: number,
  col2: number
): [number, number, number, number] {
  if (row2 < row1) {
    [row1, row2] = [row2, row1];
  }
  if (col2 < col1) {
    [col1, col2] = [col2, col1];
  }
  return [row1, col1, row2, col2];
}
