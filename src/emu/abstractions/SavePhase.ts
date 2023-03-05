/**
 * This enumeration defines the phases of the SAVE operation
 */
export enum SavePhase {
  /**
   * No SAVE operation is in progress
   */
  None = 0,

  /**
   * Emitting PILOT impulses
   */
  Pilot,

  /**
   * Emitting SYNC1 impulse
   */
  Sync1,

  /**
   * Emitting SYNC2 impulse
   */
  Sync2,

  /**
   * Emitting BIT0/BIT1 impulses
   */
  Data,

  /**
   * Unexpected pulse detected
   */
  Error
}
