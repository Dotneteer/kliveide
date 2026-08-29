export type SprFileContents = {
  sprites: Uint8Array[];
};

export type SprFileViewState = {
  scrollPosition?: number;
  zoomFactor?: number;
  spriteImagesSeparated?: boolean;
  showTrancparencyColor?: boolean;
  selectedSpriteIndex?: number;
  pencilColorIndex?: number;
  fillColorIndex?: number;
  currentColorIndex?: number;
  currentTool?: SpriteTools;
};

export type SpriteTools =
  | "pointer"
  | "pencil"
  | "line"
  | "rectangle"
  | "rectangle-filled"
  | "circle"
  | "circle-filled"
  | "paint";
