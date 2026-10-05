/*
 * Writes `.z80` snapshots, always version 3 (https://worldofspectrum.org/faq/reference/z80format.htm),
 * the inverse of `z80File.ts` (`.plans/SNAPSHOT_SAVING_AND_STATE_FILES_PLAN.md` §4.2, D2).
 *
 * The 30-byte header has PC = 0, which marks version 2 or later; the 54-byte extra header (55 with
 * the +3's $1FFD) holds PC, the hardware mode, $7FFD, the AY and the frame position. Each 16K page
 * follows as `{ length: u16, page: u8, data }`, compressed unless that does not make it shorter
 * (`length = $FFFF`: 16384 raw bytes).
 *
 * `.z80` has no NTSC 48K and no +3e, keeps no EI delay, and records no media.
 */

import {
  SPECTRUM_BANK_SIZE,
  isPagedSnapshotMachine,
  isPlus3SnapshotMachine,
  snapshotMachineName,
  type SnapshotMachineKind,
  type SpectrumSnapshot
} from "./spectrumSnapshot";
import { SnapshotBytes, SnapshotRefusedError, type SnapshotWriteResult } from "./snapshotBytes";
import { commonLosses } from "./snapshotLosses";
import { compressZ80DataBlock } from "./z80Compression";

/** The version 3 hardware mode, and the "modified hardware" bit, of each machine */
function hardwareMode(
  s: SpectrumSnapshot,
  machine: SnapshotMachineKind,
  losses: string[]
): { mode: number; modified: boolean } {
  switch (machine) {
    case "16k":
      return { mode: 0, modified: true };
    case "48k":
      return { mode: 0, modified: false };
    case "48k-ntsc":
      losses.push("A .z80 has no NTSC 48K; the file names a PAL 48K");
      return { mode: 0, modified: false };
    case "128k":
      return { mode: 4, modified: false };
    case "plus2":
      return { mode: 12, modified: false };
    case "plus2a":
      return { mode: 13, modified: false };
    case "plus3":
      return { mode: 7, modified: false };
    case "plus3e":
      if (s.peripherals.plus3) {
        losses.push(
          "A .z80 has no +3e; the file names a +3, and other emulators run it with the Amstrad ROMs"
        );
        return { mode: 7, modified: false };
      }
      losses.push(
        "A .z80 has no +2E; the file names a +2A, and other emulators run it with the Amstrad ROMs"
      );
      return { mode: 13, modified: false };
    case "pentagon":
      // --- Not in the v3 specification: an extension other emulators share (z80File.ts)
      return { mode: 9, modified: false };
    case "tc2048":
      return { mode: 14, modified: false };
  }
}

/** The pages a machine stores, as `.z80` page numbers with their 128K bank */
function pagesOf(machine: SnapshotMachineKind): { page: number; bank: number }[] {
  if (isPagedSnapshotMachine(machine)) {
    return [0, 1, 2, 3, 4, 5, 6, 7].map((bank) => ({ page: bank + 3, bank }));
  }
  if (machine === "16k") return [{ page: 8, bank: 5 }];
  return [
    { page: 8, bank: 5 },
    { page: 4, bank: 2 },
    { page: 5, bank: 0 }
  ];
}

/**
 * Encodes a frame position as the version 3 T-state counter: the high byte counts quarter frames
 * and is 3 just after the interrupt; the low word counts down through each quarter
 */
export function z80TStateCounter(frameTact: number, paged: boolean): { low: number; high: number } {
  const quarter = paged ? 17727 : 17472;
  const tact = Math.max(0, Math.min(frameTact, 4 * quarter - 1));
  const q = Math.floor(tact / quarter);
  return { low: quarter - 1 - (tact % quarter), high: (q + 3) & 0x03 };
}

/**
 * Writes a version 3 `.z80` file
 * @throws SnapshotRefusedError for a machine `.z80` cannot name
 */
export function writeZ80File(s: SpectrumSnapshot): SnapshotWriteResult {
  const machine = s.machine;
  if (typeof machine === "object") {
    throw new SnapshotRefusedError(`A ${machine.unsupported} snapshot cannot be saved`);
  }
  const losses = commonLosses(s, "z80");
  const { mode, modified } = hardwareMode(s, machine, losses);
  const paged = isPagedSnapshotMachine(machine);
  const plus3 = isPlus3SnapshotMachine(machine);
  const c = s.cpu;
  const out = new SnapshotBytes();

  // --- The 30-byte header (A before F, unlike everywhere else)
  out.byte(c.af >> 8, c.af).word(c.bc).word(c.hl).word(0 /* PC = 0: version 2+ */).word(c.sp);
  out.byte(c.i, c.r & 0x7f);
  out.byte(((c.r >> 7) & 0x01) | ((s.ula.border & 0x07) << 1));
  out.word(c.de).word(c.bc_).word(c.de_).word(c.hl_);
  out.byte(c.af_ >> 8, c.af_).word(c.iy).word(c.ix);
  out.byte(c.iff1 ? 1 : 0, c.iff2 ? 1 : 0);
  out.byte((c.im & 0x03) | (s.peripherals.issue2 ? 0x04 : 0));

  // --- The version 3 extra header
  const ay = s.ay;
  const ay48 = !paged && !!ay?.on48k;
  if (!paged && ay && !ay.on48k) {
    losses.push(`A 48K .z80 keeps the AY registers only for an add-on AY; they are not saved`);
  }
  out.word(plus3 ? 55 : 54);
  out.word(c.pc);
  if (machine === "tc2048") {
    // --- A Timex mode: the last OUTs to $F4 and $FF in place of $7FFD and Interface 1
    out.byte(mode, (s.timex?.portF4 ?? 0) & 0xff, (s.timex?.portFf ?? 0) & 0xff);
  } else {
    out.byte(mode, paged ? (s.paging?.port7ffd ?? 0) : 0, 0 /* Interface 1 ROM not paged */);
  }
  out.byte((modified ? 0x80 : 0) | (ay48 ? 0x04 : 0) | 0x03 /* R and LDIR emulation on */);
  if (paged || ay48) {
    out.byte(ay?.selected ?? 0);
    for (let r = 0; r < 16; r++) out.byte(ay?.regs[r] ?? 0);
  } else {
    out.fill(17);
  }
  const t = z80TStateCounter(s.ula.frameTact ?? 0, paged);
  out.word(t.low).byte(t.high);
  out.byte(0 /* Spectator */, 0 /* M.G.T. ROM */, 0 /* Multiface ROM */);
  out.byte(0xff, 0xff); // --- $0000-$3FFF is ROM
  out.fill(10).fill(10); // --- Joystick key mappings and their ASCII words: none
  out.byte(0 /* M.G.T. type */, 0, 0 /* Disciple inhibit */);
  if (plus3) out.byte(s.paging?.port1ffd ?? 0);

  // --- Memory pages
  for (const { page, bank } of pagesOf(machine)) {
    const data = s.ram.get(bank);
    if (!data) {
      throw new SnapshotRefusedError(
        `The ${snapshotMachineName(machine)} snapshot has no RAM bank ${bank}`
      );
    }
    const packed = compressZ80DataBlock(data);
    if (packed.length < SPECTRUM_BANK_SIZE) {
      out.word(packed.length).byte(page).bytes(packed);
    } else {
      out.word(0xffff).byte(page).bytes(data);
    }
  }
  return { bytes: out.toArray(), losses };
}
