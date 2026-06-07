/**
 * The Z80 CPU uses multi-byte operations. The values of this enum indicate the prefix of an executable opcode.
 */
export const enum OpCodePrefix {
  /**
   * The opcode does not have a prefix (standard instruction)
   */
  None,

  /**
   * The opcode has an ED prefix (extended instruction)
   */
  ED,

  /**
   * The opcode has a CB prefix (bit instruction)
   */
  CB,

  /**
   * The opcode has a DD prefix (IX-indexed instruction)
   */
  DD,

  /**
   * The opcode has an FD prefix (IY-indexed instruction)
   */
  FD,

  /**
   * The opcode has DD and CB prefixes (IX-indexed bit instruction)
   */
  DDCB,

  /**
   * The opcode has FD and CB prefixes (IY-indexed bit instruction)
   */
  FDCB
}
