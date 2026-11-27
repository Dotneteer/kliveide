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

  /**
   * Number of pilot pulses in the block
   */
  pilotPulseCount?: number;

  /**
   * Explicit pulses, for the TZX blocks that are not a pilot, syncs and data: a pure tone (12h), a pulse
   * sequence (13h) and a direct recording (15h, as its runs of equal samples). Each entry is a pulse of
   * `length` T-states (3.5 MHz) repeated `count` times; every pulse ends with an edge. A block with pulses
   * plays them, then its `pauseAfter`; its other fields are not used.
   */
  pulses?: TapePulses[];
}

/** `count` pulses of `length` T-states each */
export type TapePulses = { length: number; count: number };

/** Bytes per entry when a block's pulses are uploaded to a core: the length and the count, 32-bit little-endian */
export const TAPE_PULSE_ENTRY_BYTES = 8;

/**
 * The bytes a core gets for a block: its data, or for a block with pulses the entries (`TAPE_PULSE_ENTRY_BYTES`
 * each). The Spectrum-family cores mark such a block with `TapeSetBlockPulses`.
 */
export function tapeBlockUploadBytes(block: TapeDataBlock): Uint8Array {
  if (!block.pulses) return block.data;
  const bytes = new Uint8Array(block.pulses.length * TAPE_PULSE_ENTRY_BYTES);
  const view = new DataView(bytes.buffer);
  block.pulses.forEach((p, i) => {
    view.setUint32(i * TAPE_PULSE_ENTRY_BYTES, p.length >>> 0, true);
    view.setUint32(i * TAPE_PULSE_ENTRY_BYTES + 4, p.count >>> 0, true);
  });
  return bytes;
}
