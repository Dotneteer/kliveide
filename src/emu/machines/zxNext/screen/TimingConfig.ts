/**
 * This type represents the timing configuration of the ZX Next 50Hz and 60Hz screen modes.
 */
export type TimingConfig = {
  // Horizontal timing (HC counter values)
  firstVisibleHC: number; // First visible HC position
  displayXStart: number; // Start of active display area
  displayXEnd: number; // End of active display area
  maxHC: number; // Maximum HC value
  totalHC: number; // Total number of horizontal clocks per line

  // Vertical timing (VC counter values) - MODE DEPENDENT
  firstBitmapVC: number; // First line mapped to bitmap
  displayYStart: number; // Active display start
  displayYEnd: number; // End of active display area
  lastBitmapVC: number; // Last line mapped to bitmap
  maxVC: number; // Maximum VC value
  totalVC: number; // Total number of vertical lines per frame

  // Interrupt timing
  intHC: number; // HC position where interrupt triggers
  intVC: number; // VC position where interrupt triggers
  intPulseLength: number; // Number of CPU cycles for interrupt pulse
};

/**
 * Timing configuration for ZX Next 50Hz mode.
 */
export const Plus3_50Hz: TimingConfig = {
  firstVisibleHC: 96,
  displayXStart: 144,
  displayXEnd: 399,
  maxHC: 455,
  totalHC: 456,
  firstBitmapVC: 16,
  displayYStart: 64,
  displayYEnd: 255,
  lastBitmapVC: 303,
  maxVC: 310,
  totalVC: 311,
  intHC: 138,
  intVC: 1,
  intPulseLength: 32
};

/**
 * Timing configuration for ZX Next 60Hz mode.
 */
export const Plus3_60Hz: TimingConfig = {
  firstVisibleHC: 96,
  displayXStart: 144,
  displayXEnd: 399,
  maxHC: 455,
  totalHC: 456,
  firstBitmapVC: 16,
  displayYStart: 40,
  displayYEnd: 231,
  lastBitmapVC: 255,
  maxVC: 263,
  totalVC: 264,
  intHC: 138,
  intVC: 0,
  intPulseLength: 32
};
