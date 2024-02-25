export type SprFileContents = {
  sprites: Uint8Array[];
};

export type SprFileViewState = {
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

export type SpriteTools =
  | "pointer"
  | "pencil"
  | "line"
  | "rectangle"
  | "rectangle-filled"
  | "circle"
  | "circle-filled"
  | "paint";
