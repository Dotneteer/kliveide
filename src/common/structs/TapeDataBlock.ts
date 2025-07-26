import { PILOT_PL, SYNC_1_PL, SYNC_2_PL, BIT_0_PL, BIT_1_PL, TERM_SYNC } from "./tape-const";

/**
 * This class represents a data block that the tape device can play
 */
export class TapeDataBlock {
  /**
   * Block Data
   */
  data: Uint8Array = new Uint8Array(0);

  /**
   * Pause after this block (given in milliseconds)
   */
  pauseAfter = 1000;

  /**
   * Length of pilot pulse
   */
  pilotPulseLength = PILOT_PL;

  /**
   * Length of the first sync pulse
   */
  sync1PulseLength = SYNC_1_PL;

  /**
   * Length of the second sync pulse
   */
  sync2PulseLength = SYNC_2_PL;

  /**
   * Length of the zero bit
   */
  zeroBitPulseLength = BIT_0_PL;

  /**
   * Length of the one bit
   */
  oneBitPulseLength = BIT_1_PL;

  /**
   * Lenght of ther end sync pulse
   */
  endSyncPulseLength = TERM_SYNC;

  /**
   * Used bits in the last byte (other bits should be 0)
   *
   * (e.g. if this is 6, then the bits used(x) in the last byte are:
   * xxxxxx00, where MSb is the leftmost bit, LSb is the rightmost bit)
   */
  lastByteUsedBits?: number;
}
