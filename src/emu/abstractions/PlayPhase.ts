/**
 * Represents the playing phase of the current block
 */
export enum PlayPhase {
  /**
   * The player is passive
   */
  None = 0,

  /**
   * Pilot signals
   */
  Pilot,

  /**
   * Sync signals at the end of the pilot
   */
  Sync,

  /**
   * Bits in the data block
   */
  Data,

  /**
   * Short terminating sync signal before pause
   */
  TermSync,

  /**
   * Pause after the data block
   */
  Pause,

  /**
   * The entire block has been played back
   */
  Completed
}
