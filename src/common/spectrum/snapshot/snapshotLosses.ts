/*
 * What `.sna` and `.z80` cannot hold, whatever the machine
 * (`.plans/SNAPSHOT_SAVING_AND_STATE_FILES_PLAN.md` D3, traps 8 and 9). `.szx` holds all of it.
 *
 * HALT is not a loss: Klive keeps PC on the HALT opcode, so a loader that knows nothing about HALT
 * runs the HALT again, which is the same state.
 */

import type { SpectrumSnapshot } from "./spectrumSnapshot";
import { t } from "@common/i18n/i18n";

/** The losses `.sna` and `.z80` share (`.sna` also loses the frame position), translated */
export function commonLosses(s: SpectrumSnapshot, format: "sna" | "z80"): string[] {
  const losses: string[] = [];
  if (format === "sna" && s.ula.frameTact) {
    losses.push(t("media.snapshot.loss.snaFramePosition", { tact: String(s.ula.frameTact) }));
  }
  if (s.cpu.suppressInterrupt) {
    losses.push(t("media.snapshot.loss.eiDelay", { format }));
  }
  const tape = s.peripherals.tape;
  if (tape) {
    losses.push(
      tape.fileName
        ? t("media.snapshot.loss.tapeFile", { format, file: tape.fileName })
        : t("media.snapshot.loss.tape", { format })
    );
  }
  const disks = [...(s.peripherals.plus3?.disks ?? []), ...(s.peripherals.beta128?.disks ?? [])];
  if (disks.length) {
    losses.push(t("media.snapshot.loss.disks", { format, count: disks.length }));
  }
  // --- The Beta 128: a .sna keeps only whether TR-DOS was paged in, a .z80 nothing at all
  if (s.peripherals.beta128) {
    losses.push(
      format === "sna"
        ? t("media.snapshot.loss.snaTrdos")
        : t("media.snapshot.loss.z80Beta128")
    );
  }
  // --- The Interface 1 (`.plans/MICRODRIVE_PLAN.md` Phase 5): a .z80 names it and its paging, a .sna
  // --- nothing; neither holds the cartridges or a ROM other than the standard one
  const if1 = s.peripherals.if1;
  if (format === "sna" && (s.peripherals.interface1 || if1)) {
    losses.push(t(if1?.paged ? "media.snapshot.loss.snaInterface1Paged" : "media.snapshot.loss.snaInterface1"));
  }
  if (if1?.microdrives.length) {
    losses.push(t("media.snapshot.loss.microdrives", { format, count: if1.microdrives.length }));
  }
  if (format === "z80" && if1?.customRom) {
    losses.push(t("media.snapshot.loss.z80Interface1Rom"));
  }
  return losses;
}
