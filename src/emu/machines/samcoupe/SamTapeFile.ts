import type { TapeDataBlock } from "@common/structs/TapeDataBlock";

import { DATA_PILOT_COUNT, HEADER_PILOT_COUNT } from "@common/structs/tape-const";

/*
 * Tapes for the SAM Coupé (`dev/plans/SAM_COUPE_PLAN.md` §9.4; SOUND_INPUT_IO.md §5). The SAM's ROM decodes
 * the real signal from EAR (FEh bit 6), at the Spectrum's speed or faster, so a tape is played as its
 * half-periods: the shared tape reader's blocks (TZX, TAP) become a list of edge lengths in 3.5 MHz
 * Spectrum T-states, the unit TZX files count in, and the core plays them at 6 MHz with the remainder
 * carried (`sam-tape.c`).
 *
 * A block: its pilot (8063 pulses before a header - flag below 80h - or 3223 before data, unless the block
 * says), the two sync pulses, two pulses per bit (most significant bit first), then its pause as one long
 * half-period. A SAM header block (flag 01h, 82 bytes) is played the same way.
 */

/** The tape as the core takes it: edge lengths in Spectrum T-states */
export type SamTape = { kind: "samTape"; edges: Uint32Array };

export function isSamTape(value: unknown): value is SamTape {
  return !!value && typeof value === "object" && (value as SamTape).kind === "samTape";
}

/** The pause's T-states per millisecond at the Spectrum's 3.5 MHz */
const TACTS_PER_MS = 3500;

/** The edges of `blocks` */
export function samTapeFromBlocks(blocks: readonly TapeDataBlock[]): SamTape {
  const edges: number[] = [];
  for (const block of blocks) {
    const data = block.data;
    if (block.pilotPulseLength > 0) {
      const pilot = block.pilotPulseCount ?? (data.length > 0 && data[0] < 0x80 ? HEADER_PILOT_COUNT : DATA_PILOT_COUNT);
      for (let i = 0; i < pilot; i++) edges.push(block.pilotPulseLength);
      if (block.sync1PulseLength > 0) edges.push(block.sync1PulseLength);
      if (block.sync2PulseLength > 0) edges.push(block.sync2PulseLength);
    }
    for (let i = 0; i < data.length; i++) {
      const bits = i === data.length - 1 && block.lastByteUsedBits ? block.lastByteUsedBits : 8;
      for (let b = 0; b < bits; b++) {
        const pulse = data[i] & (0x80 >> b) ? block.oneBitPulseLength : block.zeroBitPulseLength;
        edges.push(pulse, pulse);
      }
    }
    if (block.pauseAfter > 0) edges.push(block.pauseAfter * TACTS_PER_MS);
  }
  return { kind: "samTape", edges: Uint32Array.from(edges) };
}

/** Decodes the SAVE recording (MIC half-periods in SAM T-states) into bytes per block, Spectrum style */
export function samDecodeSavedEdges(edges: ArrayLike<number>): Uint8Array[] {
  // --- At 6 MHz the ROM's speed 112 makes a pilot half-period of 3688 T, sync pulses of about 1000 T, a 0
  // --- bit's 1496 T and a 1 bit's 2984 T (observed, `test/sam-hw/tape.test.ts`); faster speeds scale them.
  // --- Bits are told apart by comparing each pair with the block's pilot.
  const blocks: Uint8Array[] = [];
  let i = 0;
  while (i < edges.length) {
    // --- A run of pilot pulses (at least 256 of similar length)
    let run = 0;
    const start = i;
    while (i + 1 < edges.length && Math.abs(edges[i + 1] - edges[i]) < edges[i] / 8) {
      i++;
      run++;
    }
    if (run < 256) {
      i = start + 1;
      continue;
    }
    const pilot = edges[i];
    i += 1;
    // --- The sync pair: both shorter than half the pilot
    if (i + 1 >= edges.length || edges[i] > pilot / 2) continue;
    i += 2;
    const bytes: number[] = [];
    let current = 0;
    let bits = 0;
    while (i + 1 < edges.length) {
      const a = edges[i];
      const b = edges[i + 1];
      // --- A bit's half-period is at most 0.81 pilot (a 1 at speed 112): anything longer ends the block
      if (a > pilot * 0.9 || b > pilot * 0.9) break;
      current = (current << 1) | (a + b > pilot * 1.2 ? 1 : 0);
      i += 2;
      if (++bits === 8) {
        bytes.push(current & 0xff);
        current = 0;
        bits = 0;
      }
    }
    if (bytes.length) blocks.push(Uint8Array.from(bytes));
  }
  return blocks;
}
