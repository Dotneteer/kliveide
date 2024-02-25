import { useTheme } from "@renderer/theming/ThemeProvider";
import styles from "./SpriteEditor.module.scss";
import { useEffect, useRef, useState } from "react";
import { getCssStringForPaletteCode } from "@emu/machines/zxNext/palette";
import { SpriteTools } from "./sprite-common";

type Props = {
  zoomFactor: number;
  spriteMap: Uint8Array;
  palette: number[];
  transparencyIndex: number;
  pencilColorIndex?: number;
  fillColorIndex?: number;
  tool: SpriteTools;
  onPositionChange?: (row?: number, col?: number) => void;
  onSpriteChange?: (sprite: Uint8Array) => void;
  onSignEscape?: () => void;
};

export const SpriteEditorGrid = ({
  zoomFactor,
  spriteMap,
  palette,
  transparencyIndex,
  pencilColorIndex,
  fillColorIndex,
  tool,
  onPositionChange,
  onSpriteChange,
  onSignEscape
}: Props) => {
  // --- Calculate sizes
  const cellSize = (zoomFactor - 1) * 8 + 16;
  const gridSize = 16 * cellSize + 1;

  // --- Obtain the color for the current cell's border stroke
  const theme = useTheme();
  const currentCellStroke = theme.getThemeProperty("--color-pos-sprite-editor");

  // --- Initialize the editor state
  const [row, setRow] = useState<number | undefined>(undefined);
  const [col, setCol] = useState<number | undefined>(undefined);
  const [version, setVersion] = useState(1);
  const origSpriteMap = useRef<Uint8Array>();
  const savedSpriteMap = useRef<Uint8Array>();
  const activeSpriteMap = useRef<Uint8Array>(spriteMap);
  const inverseColors = useRef<boolean>(false);
  const startMousePos = useRef<MouseGridPosition>();
  let lastMovePos = [-1, -1];

  useEffect(() => {
    // --- Refresh the grid whenever the sprite changes
    activeSpriteMap.current = spriteMap;
    setVersion(version + 1);
    onSpriteChange?.(spriteMap);
  }, [spriteMap]);

  // --- Event handlers for moving the mouse
  const _move = (e: MouseEvent) => {
    const startPos = startMousePos.current;
    if (startPos) {
      const row =
        Math.floor((e.clientY - startPos.y) / cellSize + 0.5) + startPos.row;
      const col =
        Math.floor((e.clientX - startPos.x) / cellSize + 0.5) + startPos.col;
      handleMouseMove(row, col);
    }
  };
  const _endMove = () => endMove();

  // --- Start the drawing operation with the tool set
  const handleMouseDown = (row: number, col: number, button: number) => {
    // --- Save the current sprite map
    savedSpriteMap.current = activeSpriteMap.current.slice(0);
    origSpriteMap.current = activeSpriteMap.current.slice(0);
    inverseColors.current = button === 2;
  };

  // --- Handle the mouse move, using the current tool
  const handleMouseMove = (row: number, col: number, completed = false) => {
    if (!savedSpriteMap.current || !startMousePos.current) return;
    if (lastMovePos[0] === row && lastMovePos[1] === col) return;
    lastMovePos = [row, col];
    const newMap = updateSpriteMapOperation(
      startMousePos.current.row,
      startMousePos.current.col,
      row,
      col,
      pencilColorIndex,
      fillColorIndex
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

  // --- Handle the mouse up event, complete the current operation
  const handleMouseUp = (row?: number, col?: number) => {
    // --- Complete the operation
    if (row === undefined || col === undefined) {
      onSpriteChange?.(activeSpriteMap.current);
    } else {
      handleMouseMove(row, col, true);
    }
    savedSpriteMap.current = undefined;
    origSpriteMap.current = undefined;
    lastMovePos = [-1, -1];
  };

  // --- Sign the start of operation
  const startMove = (e: React.MouseEvent) => {
    // --- Capture mouse move via window events
    window.addEventListener("mouseup", _endMove);
    window.addEventListener("mousemove", _move);
    document.body.style.cursor = "crosshair";
  };

  // --- End moving the splitter
  const endMove = (row?: number, col?: number) => {
    handleMouseUp(row, col);
    startMousePos.current = undefined;

    // --- Release the captured mouse
    window.removeEventListener("mouseup", _endMove);
    window.removeEventListener("mousemove", _move);
    document.body.style.cursor = "default";
  };

  // --- Update the sprite map based on the tool when the mouse moves
  const updateSpriteMapOperation = (
    row1: number,
    col1: number,
    row2: number,
    col2: number,
    pencilColorIndex: number,
    fillColorIndex: number
  ): { sprite: Uint8Array | null; immediateUpdate: boolean } => {
    const newMap = new Uint8Array(savedSpriteMap.current);
    if (inverseColors.current) {
      [pencilColorIndex, fillColorIndex] = [fillColorIndex, pencilColorIndex];
    }
    switch (tool) {
      case "pencil":
        newMap[row2 * 16 + col2] = pencilColorIndex;
        return { sprite: newMap, immediateUpdate: true };
      case "line":
        drawLine(newMap, row1, col1, row2, col2, pencilColorIndex);
        break;
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
        drawEllipse(
          newMap,
          row1,
          col1,
          row2,
          col2,
          pencilColorIndex,
          fillColorIndex
        );
        break;
      case "paint":
        areaFill(newMap, row2, col2, pencilColorIndex);
        return { sprite: newMap, immediateUpdate: true };
      default:
        return { sprite: null, immediateUpdate: false };
    }
    return { sprite: newMap, immediateUpdate: false };
  };

  // --- Draw a line on the sprite map
  const drawLine = (
    map: Uint8Array,
    row1: number,
    col1: number,
    row2: number,
    col2: number,
    pencilColor: number
  ) => {
    const dx = Math.abs(col2 - col1);
    const dy = Math.abs(row2 - row1);
    const sx = col1 < col2 ? 1 : -1;
    const sy = row1 < row2 ? 1 : -1;
    let err = dx - dy;

    let x = col1;
    let y = row1;

    while (true) {
      plotPixel(x, y, pencilColor);

      if (x === col2 && y === row2) break;

      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }

    function plotPixel (col: number, row: number, colorIndex: number) {
      row = Math.round(row);
      col = Math.round(col);
      if (row < 0 || row > 15 || col < 0 || col > 15) return;
      map[row * 16 + col] = colorIndex;
    }
  };

  // --- Draw a rectangle on the sprite map
  const drawRectangle = (
    map: Uint8Array,
    row1: number,
    col1: number,
    row2: number,
    col2: number,
    pencilColor: number,
    fillColor?: number
  ) => {
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
  };

  // --- Draw an ellipse on the sprite map
  const drawEllipse = (
    map: Uint8Array,
    row1: number,
    col1: number,
    row2: number,
    col2: number,
    pencilColor: number,
    fillColor?: number
  ) => {
    [row1, col1, row2, col2] = normalizeCoords(row1, col1, row2, col2);

    // --- Single pixel ellipse
    if (row1 === row2 && col1 === col2) {
      map[row1 * 16 + col1] = pencilColor;
      return;
    }

    // --- Spans by row
    const rowSpans: [number, number][] = [];
    for (let row = 0; row < 16; row++) {
      rowSpans.push([-1, -1]);
    }

    const rx = Math.abs(col2 - col1) / 2;
    const ry = Math.abs(row2 - row1) / 2;
    const xc = col1 + rx;
    const yc = row1 + ry;

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
        plotPixel(
          Math.min(x + up(xc), col2),
          Math.min(y + up(yc), row2),
          pencilColor
        );
        plotPixel(
          Math.max(-x + down(xc), col1),
          Math.min(y + down(yc), row2),
          pencilColor
        );
        plotPixel(
          Math.min(x + up(xc), col2),
          Math.max(-y + down(yc), row1),
          pencilColor
        );
        plotPixel(
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
        plotPixel(
          Math.min(x + up(xc), col2),
          Math.min(y + up(yc), row2),
          pencilColor
        );
        plotPixel(
          Math.max(-x + down(xc), col1),
          Math.min(y + down(yc), row2),
          pencilColor
        );
        plotPixel(
          Math.min(x + up(xc), col2),
          Math.max(-y + down(yc), row1),
          pencilColor
        );
        plotPixel(
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

    // --- Fill the ellipse
    for (let row = row1 + 1; row < row2; row++) {
      const rowSpan = rowSpans[row];
      for (let col = rowSpan[0] + 1; col < rowSpan[1]; col++) {
        map[row * 16 + col] = fillColor;
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
      plotPixel(
        Math.min(x + up(xc), col2),
        Math.min(y + up(yc), row2),
        colorIndex
      );
      plotPixel(
        Math.max(-x + down(xc), col1),
        Math.min(y + up(yc), row2),
        colorIndex
      );
      plotPixel(
        Math.min(x + up(xc), col2),
        Math.max(-y + down(yc), row1),
        colorIndex
      );
      plotPixel(
        Math.max(-x + down(xc), col1),
        Math.max(-y + down(yc), row1),
        colorIndex
      );
      plotPixel(
        Math.min(y + up(xc), col2),
        Math.min(x + up(yc), row2),
        colorIndex
      );
      plotPixel(
        Math.max(-y + down(xc), col1),
        Math.min(x + up(yc), row2),
        colorIndex
      );
      plotPixel(
        Math.min(y + up(xc), col2),
        Math.max(-x + down(yc), row1),
        colorIndex
      );
      plotPixel(
        Math.max(-y + down(xc), col1),
        Math.max(-x + down(yc), row1),
        colorIndex
      );
    }

    function plotPixel (col: number, row: number, colorIndex: number) {
      row = Math.round(row);
      col = Math.round(col);
      if (row < 0 || row > 15 || col < 0 || col > 15) return;
      const rowSpan = rowSpans[row];
      if (rowSpan[0] === -1 || col < rowSpan[0]) {
        rowSpan[0] = col;
      }
      if (col > rowSpan[1]) {
        rowSpan[1] = col;
      }
      map[row * 16 + col] = colorIndex;
    }
  };

  // --- Fill an area on the sprite map
  const areaFill = (
    map: Uint8Array,
    row: number,
    col: number,
    fillColor: number
  ) => {
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
  };

  // --- Normalize the coordinates
  const normalizeCoords = (
    row1: number,
    col1: number,
    row2: number,
    col2: number
  ) => {
    if (row2 < row1) {
      [row1, row2] = [row2, row1];
    }
    if (col2 < col1) {
      [col1, col2] = [col2, col1];
    }
    return [row1, col1, row2, col2];
  };

  // --- Render the sprite grid
  return (
    <div
      tabIndex={0}
      className={styles.spriteGridWrapper}
      onMouseLeave={() => {
        setRow(undefined);
        setCol(undefined);
        onPositionChange?.();
      }}
      onKeyDown={e => {
        if (e.key === "Escape" && startMousePos.current) {
          if (origSpriteMap.current) {
            activeSpriteMap.current = origSpriteMap.current.slice(0);
          }
          endMove();
          onSignEscape?.();
        }
      }}
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
};

type MouseGridPosition = {
  row: number;
  col: number;
  x: number;
  y: number;
};
