import type { SprFormat } from "./sprite-file";

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
  /**
   * The file's bytes as read, until the first edit. The editor reads them in the remembered format,
   * and a format switch before any edit reads them again: exact even for a file shorter than one
   * sprite, which the 8-bit parse pads and a reinterpretation would therefore lengthen.
   */
  source?: Uint8Array;
  /**
   * Which format `sprites` and `trailing` are in. The panel parses as 8-bit (absent); the editor
   * re-reads the sheet in the remembered format and records it here.
   */
  format?: SprFormat;
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
  /**
   * How the file's bytes are read: 256-byte 8-bit patterns (the default) or 128-byte 4-bit ones.
   * A `.spr` has no header that could say, so it is the user's choice, remembered per document.
   */
  spriteFormat?: SprFormat;
  /**
   * Which 16 palette entries a 4-bit sheet is drawn with (0..15, the sprite attribute's palette
   * offset). A view setting only: on the machine it belongs to each sprite, not to the pattern.
   */
  paletteOffset?: number;
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
