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

  // Interrupt timing (tact-based for simplified checking)
  intStartTact: number; // Tact when interrupt pulse starts
  intEndTact: number; // Tact when interrupt pulse ends (exclusive)
};

/**
 * Timing configuration for ZX Next 50Hz mode.
 */
export const Plus3_50Hz: TimingConfig = {
  firstVisibleHC: 0x60, // 96
  displayXStart: 0x90,  // 144
  displayXEnd: 0x18f,   // 399
  maxHC: 0x1c7,         // 455
  totalHC: 0x1c8,       // 456
  firstBitmapVC: 0x10,  // 16
  displayYStart: 0x40,  // 64
  displayYEnd: 0xff,    // 255
  lastBitmapVC: 0x12f,  // 303
  maxVC: 0x136,         // 310
  totalVC: 0x137,       // 311
  intStartTact: 0x252,  // vc(1) * totalHC(456) + hc(138) = 594
  intEndTact: 0x272     // intStartTact + pulse_length(32) = 626
};

/**
 * Timing configuration for ZX Next 60Hz mode.
 */
export const Plus3_60Hz: TimingConfig = {
  firstVisibleHC: 0x60, // 96
  displayXStart: 0x90,  // 144
  displayXEnd: 0x18f,   // 399
  maxHC: 0x1c7,         // 455
  totalHC: 0x1c8,       // 456
  firstBitmapVC: 0x10,  // 16
  displayYStart: 0x28,  // 40
  displayYEnd: 0xe7,    // 231
  lastBitmapVC: 0xff,   // 255
  maxVC: 0x107,         // 263
  totalVC: 0x108,       // 264
  intStartTact: 0x138,  // vc(0) * totalHC(456) + hc(138) = 138
  intEndTact: 0x158     // intStartTact + pulse_length(32) = 170
};
