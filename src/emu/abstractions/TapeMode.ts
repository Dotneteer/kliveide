/**
 * This enum indicates the current mode of the tape device.
 */
export enum TapeMode {
  /**
   * The tape device is passive.
   */
  Passive,

  /**
   * The tape device is in LOAD mode, affecting the read operation of the EAR bit.
   */
  Load,

  /**
   * The tape device is in SAVE mode, affecting the write operation of the MIC bit.
   */
  Save
}
