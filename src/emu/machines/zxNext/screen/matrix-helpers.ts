import { TimingConfig } from "./TimingConfig";

/**
 * Helper: Calculate if a position is within the display area (256×192 ULA coordinates).
 * @param config Timing configuration (50Hz or 60Hz)
 * @param vc Vertical counter position
 * @param hc Horizontal counter position
 * @returns true if position is within the display area
 */
export function isDisplayArea(config: TimingConfig, vc: number, hc: number): boolean {
  return (
    hc >= config.displayXStart &&
    hc <= config.displayXEnd &&
    vc >= config.displayYStart &&
    vc <= config.displayYEnd
  );
}

/**
 * Helper: Calculate if a position is within the visible screen area (includes border + display).
 * This excludes blanking areas (horizontal and vertical blanking).
 * @param config Timing configuration (50Hz or 60Hz)
 * @param vc Vertical counter position
 * @param hc Horizontal counter position
 * @returns true if position is within the visible screen area
 */
export function isVisibleArea(config: TimingConfig, vc: number, hc: number): boolean {
  return (
    hc >= config.firstVisibleHC &&
    hc <= config.maxHC &&
    vc >= config.firstBitmapVC &&
    vc <= config.lastBitmapVC
  );
}

/**
 * Helper: Calculate if a position is within the contention window.
 * Based on VHDL: hc_adj = (hc & 0xF) + 1
 * Contention occurs when hc_adj[3:2] != 0 OR (hc_adj[3:1] == 0 for +3)
 * Only active in display area.
 * @param hc Horizontal counter position
 * @param inDisplayArea Whether the position is in the display area
 * @returns true if position is within the contention window
 */
export function isContentionWindow(hc: number, inDisplayArea: boolean): boolean {
  if (!inDisplayArea) return false;

  const hcAdj = ((hc & 0xf) + 1) & 0xf;
  const hcAdj_32 = (hcAdj >> 2) & 0x3; // bits [3:2]
  const hcAdj_31 = (hcAdj >> 1) & 0x7; // bits [3:1]

  // +3 mode contention: hc_adj[3:2] != 00 OR hc_adj[3:1] == 000
  return hcAdj_32 !== 0 || hcAdj_31 === 0;
}
