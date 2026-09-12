/**
 * How tall the sheet pane is, and why.
 *
 * The numbers are derived rather than picked, so that changing a thumbnail's zoom or the caption
 * size moves the default with it instead of leaving a magic constant behind that used to be right.
 */

/** Screen pixels per sprite pixel in a sheet thumbnail - `SpriteImage`'s default zoom. */
const THUMBNAIL_ZOOM = 3;
/** 16x16 at that zoom. */
const THUMBNAIL_PX = 16 * THUMBNAIL_ZOOM;
/** `.sheetCell`: 2px padding all round, a 1px gap, and the index caption beneath. */
const CELL_PADDING = 2 * 2;
const CELL_GAP = 1;
const CAPTION_PX = 10;

/** One row of thumbnails, caption included. */
export const SHEET_ROW_HEIGHT = THUMBNAIL_PX + CELL_PADDING + CELL_GAP + CAPTION_PX;

/** `.sectionHeader` - the same `--row-panelHeader` every panel header in the app uses. */
const SHEET_HEADER = 26;
/** `.sheetCells` vertical padding, and the gap between wrapped rows. */
const CELLS_PADDING_Y = 8 * 2;
const ROW_GAP = 8;

/** The pane height that shows exactly `rows` rows of thumbnails. */
export const sheetHeightForRows = (rows: number): number =>
  SHEET_HEADER + CELLS_PADDING_Y + rows * SHEET_ROW_HEIGHT + Math.max(0, rows - 1) * ROW_GAP;

/** Two rows by default: enough to see a sprite and its neighbours without taking the canvas. */
export const DEFAULT_SHEET_HEIGHT = sheetHeightForRows(2);

/** Never shrink below one whole row - a clipped row reads as broken rather than as scrollable. */
export const MIN_SHEET_HEIGHT = sheetHeightForRows(1);

/** The editor's own chrome above the sheet, which the drag has to leave room for. */
const TOP_TOOLBAR = 27;
/** `.stage`'s floor from `grid-template-rows`. The canvas is what the editor is for. */
const STAGE_MIN = 140;

/** The tallest the sheet may be dragged in an editor of this height. */
export const maxSheetHeight = (editorHeight: number): number =>
  Math.max(MIN_SHEET_HEIGHT, editorHeight - TOP_TOOLBAR - STAGE_MIN);

export const clampSheetHeight = (height: number, editorHeight: number): number =>
  Math.round(
    Math.min(maxSheetHeight(editorHeight), Math.max(MIN_SHEET_HEIGHT, height))
  );
