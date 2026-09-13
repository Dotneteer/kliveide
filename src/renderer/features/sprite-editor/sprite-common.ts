export type SprFileContents = {
  /** Always at least one sprite; `parseSprFile` establishes that invariant. */
  sprites: Uint8Array[];
  /**
   * Bytes after the last complete sprite in the source file.
   *
   * A `.spr` whose length is not a multiple of 256 used to be rejected outright. The leftover bytes
   * are carried here and written back by `serializeSprFile`, so opening and saving such a file
   * cannot silently truncate it.
   */
  trailing?: Uint8Array;
  /** Set when the file was not a clean sequence of whole sprites. Informational, never fatal. */
  warning?: string;
};

export type SprFileViewState = {
  scrollPosition?: number;
  /**
   * Screen pixels per sprite pixel.
   *
   * This used to be a 1..3 "zoom factor" fed through `(z - 1) * 8 + 16`. The name is kept so an
   * existing view state still loads; `cellSizeFromLegacyZoom` migrates the old range.
   */
  zoomFactor?: number;
  /** Whether the canvas resizes with the pane. Default true. */
  fitToPane?: boolean;
  /** Hairlines between pixels. Default true. */
  showGrid?: boolean;
  /** Ghost the previous sprite through this one's transparent pixels. Default false. */
  showOnionSkin?: boolean;
  /** Frames per second for the sheet animation preview. */
  animationFps?: number;
  /** Height of the sheet pane in px, as the user dragged it. */
  sheetHeight?: number;
  spriteImagesSeparated?: boolean;
  showTrancparencyColor?: boolean;
  selectedSpriteIndex?: number;
  pencilColorIndex?: number;
  fillColorIndex?: number;
  currentTool?: SpriteTools;
};

export type SpriteTools =
  | "select"
  | "pencil"
  | "line"
  | "rectangle"
  | "rectangle-filled"
  | "circle"
  | "circle-filled"
  | "paint";

/**
 * The tool is persisted, and it used to be called `"pointer"` - a name it earned by doing nothing.
 * Now that it selects, the value is `"select"`; an older view state is migrated here rather than
 * being allowed to restore a tool that no longer exists.
 */
export const migrateTool = (tool: string | undefined): SpriteTools =>
  tool === "pointer" || tool === undefined ? "select" : (tool as SpriteTools);
