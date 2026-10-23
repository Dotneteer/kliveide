/*
 * Starting code at an exact T-state of the ZX Spectrum's frame, for the ULA timing tests
 * (`.plans/SPECTRUM_ULA_ACCURACY_PLAN.md`): the floating bus, a write racing the beam, a border change,
 * snow. Shared by the 48K and the 128K harnesses (`./sp48`, `./sp128`).
 *
 * The code runs from uncontended RAM ($8000 by default) with interrupts off, after a filler of NOPs
 * (4 T), INC HL (6 T) and LD B,0 (7 T) that reaches the target from where the frame began: every
 * distance from 13 T-states up. B and HL are not preserved.
 */

/** The part of a harness session the helper uses */
export type BeamSession = {
  readonly machine: { pc: number; readonly wasmV2Runtime?: { readonly exports: unknown } };
  poke(address: number, bytes: number | ArrayLike<number>): unknown;
  runFrames(count?: number): unknown;
  runTo(where: number, options?: { maxFrames?: number }): unknown;
  frameTact(): number;
};

const NOP = 0x00;
const INC_HL = [0x23];
const LD_B_0 = [0x06, 0x00];

/** Instructions that take exactly `tacts` T-states (13 or more) in uncontended memory */
export function fillerOf(tacts: number): number[] {
  if (tacts < 13) throw new Error(`A filler needs 13 T-states or more, not ${tacts}.`);
  const code: number[] = [];
  let left = tacts;
  switch (left % 4) {
    case 1:
      code.push(...LD_B_0, ...INC_HL);
      left -= 13;
      break;
    case 2:
      code.push(...INC_HL);
      left -= 6;
      break;
    case 3:
      code.push(...LD_B_0);
      left -= 7;
      break;
  }
  for (let i = 0; i < left / 4; i++) code.push(NOP);
  return code;
}

/**
 * Lets the current frame end, then runs a filler and stops when `code` is about to start at frame
 * T-state `target`. `code` is written right after the filler, followed by `JR $`; returns its
 * address (the PC now). The caller steps it (`step`) or runs on.
 */
export function startAtFrameTact(
  s: BeamSession,
  core: "sp48" | "sp128",
  target: number,
  code: number[],
  base = 0x8000
): number {
  const x = s.machine.wasmV2Runtime!.exports as Record<string, (...args: number[]) => number>;
  s.runFrames(1);
  // --- Out of the ROM's HALT, interrupts off: near a frame's start the INT line is still active
  x[`${core}SetCpuHalted`](0);
  x[`${core}SetCpuIff1`](0);
  x[`${core}SetCpuIff2`](0);
  // --- One NOP first, so the new frame has begun and its T-state count is the one the filler sees
  s.poke(base, [0x00]);
  s.machine.pc = base;
  s.runTo(base + 1, { maxFrames: 1 });
  const from = s.frameTact();
  const filler = fillerOf(target - from);
  const start = base + 1 + filler.length;
  s.poke(base + 1, [...filler, ...code, 0x18, 0xfe]);
  s.runTo(start, { maxFrames: 2 });
  const at = s.frameTact();
  if (at !== target) throw new Error(`The filler reached frame tact ${at}, not ${target}.`);
  return start;
}
