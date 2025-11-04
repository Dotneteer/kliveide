/**
 * Represents integer constants that mask out particular flags of the Z80 CPU's F register.
 */
export const enum FlagsSetMask {
  /**
   * Sign Flag
   */
  S = 0x80,

  /**
   * Zero Flag
   */
  Z = 0x40,

  /**
   * Undocumented flag at Bit 5
   */
  R5 = 0x20,

  /**
   * Half Carry Flag
   */
  H = 0x10,

  /**
   * Undocumented flag at Bit 3
   */
  R3 = 0x08,

  /**
   * Parity/Overflow Flag
   */
  PV = 0x04,

  /**
   * Add/Subtract Flag
   */
  N = 0x02,

  /**
   * Carry Flag
   */
  C = 0x01,

  /**
   * Combination of S, Z, and PV
   */
  SZPV = S | Z | PV,

  /**
   * Combination of N, and H
   */
  NH = N | H,

  /**
   * Combination of R3, and R5
   */
  R3R5 = R3 | R5
}
