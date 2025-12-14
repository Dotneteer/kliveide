import { isDisplayArea } from "./matrix-helpers";
import { TilemapCell } from "./RenderingCell";
import { TimingConfig } from "./TimingConfig";

/**
 * Generate a single Tilemap rendering cell for the 40x32 tilemap mode at the given (vc, hc) position.
 * @param config Timing configuration (50Hz or 60Hz)
 * @param vc Vertical counter position (firstBitmapVC to lastBitmapVC)
 * @param hc Horizontal counter position (firstVisibleHC to maxHC)
 * @returns ULA Standard rendering cell with all activity flags
 */
export function generateTilemap40x32Cell(
  config: TimingConfig,
  vc: number,
  hc: number
): TilemapCell {
  const displayArea = isDisplayArea(config, vc, hc);

  return {
    displayArea,
    contentionWindow: false, // Tilemap uses internal memory
    tileIndexFetch: displayArea,
    patternFetch: displayArea
  };
}

/**
 * Generate a single Tilemap rendering cell for the 80x32 tilemap mode at the given (vc, hc) position.
 * @param config Timing configuration (50Hz or 60Hz)
 * @param vc Vertical counter position (firstBitmapVC to lastBitmapVC)
 * @param hc Horizontal counter position (firstVisibleHC to maxHC)
 * @returns ULA Standard rendering cell with all activity flags
 */
export function generateTilemap80x32Cell(
  config: TimingConfig,
  vc: number,
  hc: number
): TilemapCell {
  const displayArea = isDisplayArea(config, vc, hc);

  return {
    displayArea,
    contentionWindow: false, // Tilemap uses internal memory
    tileIndexFetch: displayArea,
    patternFetch: displayArea
  };
}
