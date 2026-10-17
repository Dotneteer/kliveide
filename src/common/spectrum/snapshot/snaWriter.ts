/*
 * Writes `.sna` snapshots (https://worldofspectrum.org/faq/reference/formats.htm), the inverse of
 * `snaFile.ts` (`.plans/SNAPSHOT_SAVING_AND_STATE_FILES_PLAN.md` §4.2).
 *
 * A 48K file has no PC field: PC is pushed onto the stack, as if an NMI had happened, and a loader
 * pops it with a RETN. The push goes into a copy of the snapshot's RAM, never into the model (D5).
 * A 128K file stores PC and $7FFD after the first 48K; the paged bank sits at $C000 there and is
 * stored again among the rest when it is bank 2 or 5 (the 147,487-byte variant).
 *
 * The format has no frame position, no EI delay, no AY and no $1FFD.
 */

import {
  SPECTRUM_48K_BANKS,
  SPECTRUM_BANK_SIZE,
  hex,
  isPagedSnapshotMachine,
  isPlus3SnapshotMachine,
  type SpectrumSnapshot
} from "./spectrumSnapshot";
import { SnapshotBytes, SnapshotRefusedError, type SnapshotWriteResult } from "./snapshotBytes";
import { commonLosses } from "./snapshotLosses";
import { t } from "@common/i18n/i18n";

/** The 27-byte header shared by both layouts */
function writeHeader(out: SnapshotBytes, s: SpectrumSnapshot, sp: number): void {
  const c = s.cpu;
  out
    .byte(c.i)
    .word(c.hl_)
    .word(c.de_)
    .word(c.bc_)
    .word(c.af_)
    .word(c.hl)
    .word(c.de)
    .word(c.bc)
    .word(c.iy)
    .word(c.ix)
    .byte(c.iff2 ? 0x04 : 0x00, c.r)
    .word(c.af)
    .word(sp)
    .byte(c.im & 0x03, s.ula.border & 0x07);
}

/** A bank of the snapshot, or zeros when it has none (the upper 32K of a 16K machine) */
function bank(s: SpectrumSnapshot, index: number): Uint8Array {
  return s.ram.get(index) ?? new Uint8Array(SPECTRUM_BANK_SIZE);
}

/**
 * Writes a `.sna` file
 * @throws SnapshotRefusedError when the file would not load back into the same state
 */
export function writeSnaFile(s: SpectrumSnapshot): SnapshotWriteResult {
  if (typeof s.machine === "object") {
    throw new SnapshotRefusedError(t("media.snapshot.refused.unsupported", { machine: s.machine.unsupported }));
  }
  const losses = commonLosses(s, "sna");
  if (s.cpu.iff1 !== s.cpu.iff2) {
    losses.push(t("media.snapshot.loss.snaIff", { iff1: s.cpu.iff1 ? "1" : "0", iff2: s.cpu.iff2 ? "1" : "0" }));
  }
  return isPagedSnapshotMachine(s.machine)
    ? { bytes: write128(s, losses), losses }
    : { bytes: write48(s, losses), losses };
}

function write48(s: SpectrumSnapshot, losses: string[]): Uint8Array {
  if (s.machine === "16k") {
    losses.push(t("media.snapshot.loss.sna16k"));
  } else if (s.machine === "48k-ntsc") {
    losses.push(t("media.snapshot.loss.snaNtsc"));
  } else if (s.machine === "tc2048" || s.machine === "tc2068" || s.machine === "ts2068") {
    losses.push(
      (s.timex?.portFf ?? 0) !== 0
        ? t("media.snapshot.loss.snaTimexScreenMode", { mode: hex(s.timex!.portFf) })
        : t("media.snapshot.loss.snaTimex")
    );
    if (s.timex?.portF4) losses.push(t("media.snapshot.loss.snaChunkMap", { value: hex(s.timex.portF4) }));
    if (s.timex?.dock?.length) losses.push(t("media.snapshot.loss.snaDock"));
  }
  if (s.ay?.on48k || (s.ay && (s.machine === "tc2068" || s.machine === "ts2068"))) {
    losses.push(t("media.snapshot.loss.sna48Ay"));
  }

  // --- Push PC: the low byte at SP-2, the high byte at SP-1
  const sp = (s.cpu.sp - 2) & 0xffff;
  if (sp < 0x4000 || sp === 0xffff) {
    throw new SnapshotRefusedError(
      t("media.snapshot.refused.sna48Stack", { sp: hex(s.cpu.sp, 4), pushAt: hex(sp, 4) })
    );
  }
  const ram = new Uint8Array(3 * SPECTRUM_BANK_SIZE);
  SPECTRUM_48K_BANKS.forEach((b, slot) => ram.set(bank(s, b), slot * SPECTRUM_BANK_SIZE));
  ram[sp - 0x4000] = s.cpu.pc & 0xff;
  ram[sp + 1 - 0x4000] = (s.cpu.pc >> 8) & 0xff;

  const out = new SnapshotBytes();
  writeHeader(out, s, sp);
  out.bytes(ram);
  return out.toArray();
}

function write128(s: SpectrumSnapshot, losses: string[]): Uint8Array {
  const port7ffd = s.paging?.port7ffd ?? 0;
  if (isPlus3SnapshotMachine(s.machine)) {
    const port1ffd = s.paging?.port1ffd ?? 0;
    if (port1ffd & 0x01) {
      throw new SnapshotRefusedError(t("media.snapshot.refused.snaPlus3Special", { value: hex(port1ffd) }));
    }
    losses.push(t("media.snapshot.loss.snaPlus3"));
  } else if (s.machine === "plus2") {
    losses.push(t("media.snapshot.loss.snaPlus2"));
  } else if (s.machine === "scorpion") {
    const port1ffd = s.paging?.port1ffd ?? 0;
    if (port1ffd & 0x13) {
      throw new SnapshotRefusedError(t("media.snapshot.refused.snaScorpion", { value: hex(port1ffd) }));
    }
    losses.push(t("media.snapshot.loss.snaScorpion"));
  }
  if (s.ay && s.ay.regs.some((r) => r !== 0)) {
    losses.push(t("media.snapshot.loss.snaAy"));
  }

  const paged = port7ffd & 0x07;
  const out = new SnapshotBytes();
  writeHeader(out, s, s.cpu.sp);
  out.bytes(bank(s, 5)).bytes(bank(s, 2)).bytes(bank(s, paged));
  out.word(s.cpu.pc).byte(port7ffd, s.peripherals.trdosPaged ? 1 : 0);
  // --- The rest in ascending order. With bank 2 or 5 paged in, that is six banks (the bank at
  // --- $C000 was a second copy), which makes the 147,487-byte variant.
  for (let b = 0; b < 8; b++) {
    if (b === 2 || b === 5 || b === paged) continue;
    out.bytes(bank(s, b));
  }
  return out.toArray();
}
