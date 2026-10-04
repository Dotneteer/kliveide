/*
 * What `.sna` and `.z80` cannot hold, whatever the machine
 * (`.plans/SNAPSHOT_SAVING_AND_STATE_FILES_PLAN.md` D3, traps 8 and 9). `.szx` holds all of it.
 *
 * HALT is not a loss: Klive keeps PC on the HALT opcode, so a loader that knows nothing about HALT
 * runs the HALT again, which is the same state.
 */

import type { SpectrumSnapshot } from "./spectrumSnapshot";

/** The losses `.sna` and `.z80` share (`.sna` also loses the frame position) */
export function commonLosses(s: SpectrumSnapshot, format: "sna" | "z80"): string[] {
  const losses: string[] = [];
  if (format === "sna" && s.ula.frameTact) {
    losses.push(
      `A .sna has no frame position (the machine was at T-state ${s.ula.frameTact} of the frame); the program resumes at the start of a frame`
    );
  }
  if (s.cpu.suppressInterrupt) {
    losses.push(
      `The CPU had just run EI (or a DD/FD prefix), so no interrupt was due before the next instruction; a .${format} cannot say so`
    );
  }
  const tape = s.peripherals.tape;
  if (tape) {
    losses.push(`A .${format} does not record the tape${tape.fileName ? ` (${tape.fileName})` : ""}`);
  }
  const disks = s.peripherals.plus3?.disks ?? [];
  if (disks.length) {
    losses.push(`A .${format} does not record the inserted disk${disks.length > 1 ? "s" : ""}`);
  }
  return losses;
}
