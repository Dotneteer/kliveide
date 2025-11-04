/**
 * This enum defines the flag bits of the 6510 CPU
 */
export enum FlagSetMask6510 {
  C = 0x01, // Carry flag
  Z = 0x02, // Zero flag
  I = 0x04, // Interrupt disable flag
  D = 0x08, // Decimal mode flag
  B = 0x10, // Break flag
  UNUSED = 0x20, // Bit 5 is always 1
  V = 0x40, // Overflow flag
  N = 0x80  // Negative flag
}
