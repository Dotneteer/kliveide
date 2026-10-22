
// Screen sizes.
export const TRS80_CHAR_WIDTH = 64;
export const TRS80_CHAR_HEIGHT = 16;
export const TRS80_CHAR_PIXEL_WIDTH = 2;
export const TRS80_CHAR_PIXEL_HEIGHT = 3;
export const TRS80_PIXEL_WIDTH = TRS80_CHAR_WIDTH*TRS80_CHAR_PIXEL_WIDTH;
export const TRS80_PIXEL_HEIGHT = TRS80_CHAR_HEIGHT*TRS80_CHAR_PIXEL_HEIGHT;

// RAM address range of screen.
export const TRS80_SCREEN_SIZE = TRS80_CHAR_WIDTH*TRS80_CHAR_HEIGHT;
export const TRS80_SCREEN_BEGIN = 15 * 1024;
export const TRS80_SCREEN_END = TRS80_SCREEN_BEGIN + TRS80_SCREEN_SIZE;

// This is 7 ticks of the Model III timer (30 Hz).
export const TRS80_BLINK_PERIOD_MS = 233;
