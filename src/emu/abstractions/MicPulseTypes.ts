/**
 * This enum defines the MIC pulse types according to their widths
 */
export enum MicPulseType {
  /**
   * No pulse information
   */
  None = 0,

  /**
   * Too short to be a valid pulse
   */
  TooShort,

  /**
   * Too long to be a valid pulse
   */
  TooLong,

  /**
   * PILOT pulse (Length: 2168 tacts)
   */
  Pilot,

  /**
   * SYNC1 pulse (Length: 667 tacts)
   */
  Sync1,

  /**
   * SYNC2 pulse (Length: 735 tacts)
   */
  Sync2,

  /**
   * BIT0 pulse (Length: 855 tacts)
   */
  Bit0,

  /**
   * BIT1 pulse (Length: 1710 tacts)
   */
  Bit1,

  /**
   * TERM_SYNC pulse (Length: 947 tacts)
   */
  TermSync
}
