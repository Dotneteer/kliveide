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
  /**
   * INT pulse length in CPU cycles (zxnext.vhd ~1968-1990 `pulse_count_end`): 32 for 48K and +3, 36
   * for 128K and Pentagon. The counter runs on the CPU clock, so in frame tacts (7 MHz HC ticks) the
   * pulse is `2 * cycles` at 3.5 MHz and halves with every speed step.
   */
  intPulseCycles: number;
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
  intPulseCycles: 32
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
  intPulseCycles: 32
};

/*
 * The other display timings (NextReg $03 bits 6-4). zxula_timing.vhd (~146-300) sets per timing the
 * line length (`c_max_hc`), frame length (`c_max_vc`), display origin (`c_min_hactive`,
 * `c_min_vactive`) and ULA interrupt position (`c_int_h`, `c_int_v`). The configs above map the VHDL
 * coordinates as: displayXStart = c_min_hactive + 8, interrupt HC = c_int_h + 12; the ones below use
 * the same mapping.
 *
 * Framing: every timing shows its paper at the same place in the 720x288 buffer (buffer x 96, row 48)
 * - the 360-HC-wide visible window starts 48 HC before the display. (The VHDL HDMI window would put
 * the Pentagon paper 8 pixels right and 8 rows lower; the buffer keeps one frame for all timings.)
 */

/** ZX 128K/+2 50 Hz: +3 raster, interrupt 2 HC later (c_int_h = 136 + 4 - 12). */
export const Zx128_50Hz: TimingConfig = {
  ...Plus3_50Hz,
  intStartTact: Plus3_50Hz.intStartTact + 2,
  intPulseCycles: 36
};

/** ZX 128K/+2 60 Hz: Plus3_60Hz's interrupt, 2 HC later. */
export const Zx128_60Hz: TimingConfig = {
  ...Plus3_60Hz,
  intStartTact: Plus3_60Hz.intStartTact + 2,
  intPulseCycles: 36
};

/** ZX 48K 50 Hz: 448 HC x 312 lines (224 x 312 = 69888 T-states), interrupt at VC 0, HC 116 + 12. */
export const Zx48_50Hz: TimingConfig = {
  firstVisibleHC: 88,
  displayXStart: 136,
  displayXEnd: 391,
  maxHC: 447,
  totalHC: 448,
  firstBitmapVC: 16,
  displayYStart: 64,
  displayYEnd: 255,
  lastBitmapVC: 303,
  maxVC: 311,
  totalVC: 312,
  intStartTact: 128,
  intPulseCycles: 32
};

/** ZX 48K 60 Hz: 448 HC x 264 lines. */
export const Zx48_60Hz: TimingConfig = {
  ...Zx48_50Hz,
  displayYStart: 40,
  displayYEnd: 231,
  lastBitmapVC: 255,
  maxVC: 263,
  totalVC: 264
};

/**
 * Pentagon (always 50 Hz): 448 HC x 320 lines (224 x 320 = 71680 T-states). The interrupt is at
 * VC 319, HC 439 + 12 - past the end of that line, so it lands at VC 0, HC 3.
 */
export const Pentagon_50Hz: TimingConfig = {
  firstVisibleHC: 88,
  displayXStart: 136,
  displayXEnd: 391,
  maxHC: 447,
  totalHC: 448,
  firstBitmapVC: 32,
  displayYStart: 80,
  displayYEnd: 271,
  lastBitmapVC: 319,
  maxVC: 319,
  totalVC: 320,
  intStartTact: 3,
  intPulseCycles: 36
};

/**
 * The raster for NextReg $03 display timing and the 50/60 Hz setting (zxula_timing.vhd `i_timing`:
 * 1XX Pentagon - which forces 50 Hz -, 010 128K, 011 +3, anything else 48K).
 */
export function selectTimingConfig(displayTiming: number, is60Hz: boolean): TimingConfig {
  if ((displayTiming & 0b100) !== 0) return Pentagon_50Hz;
  if (displayTiming === 0b010) return is60Hz ? Zx128_60Hz : Zx128_50Hz;
  if (displayTiming === 0b011) return is60Hz ? Plus3_60Hz : Plus3_50Hz;
  return is60Hz ? Zx48_60Hz : Zx48_50Hz;
}
