/*
 * Writes `.szx` (zx-state 1.4) snapshots, the inverse of `szxFile.ts`
 * (`.plans/SNAPSHOT_SAVING_AND_STATE_FILES_PLAN.md` §4.2, D2, D17). The block layouts follow
 * Spectaculator's zx-state specification (https://www.spectaculator.com/docs/zx-state/intro.html).
 *
 * The file is "ZXST", major 1, minor 4, the machine id and flags, then these blocks:
 *   CRTR  the creator: "Klive IDE" and its version
 *   Z80R  the registers, the frame position, the EI delay and HALT flags, MEMPTR
 *   SPCR  border, $7FFD, $1FFD, the last $FE
 *   AY    the sound chip (128K models, or an add-on AY of a 48K)
 *   KEYB  the keyboard: issue 2, no keyboard joystick
 *   RAMP  one per RAM page, zlib-compressed
 *   +3    drive count and motor (+3 models with drives)
 *   DSK   one per inserted disk, as a link to the disk file (the spec has no embedded disks yet)
 *   TAPE  the tape, as a link to its file; embedded (zlib) only when it has no file (D17)
 */

import { zlibSync } from "fflate";
import {
  SPECTRUM_48K_BANKS,
  SPECTRUM_BANK_SIZE,
  isPagedSnapshotMachine,
  isPlus3SnapshotMachine,
  snapshotMachineName,
  type SnapshotMachineKind,
  type SpectrumSnapshot
} from "./spectrumSnapshot";
import {
  SnapshotBytes,
  SnapshotRefusedError,
  latin1Bytes,
  type SnapshotWriteResult
} from "./snapshotBytes";

/** The `chMachineId` of each machine (the inverse of the parser's table) */
const SZX_MACHINE_IDS: Record<SnapshotMachineKind, number> = {
  "16k": 0,
  "48k": 1,
  "128k": 2,
  plus2: 3,
  plus2a: 4,
  plus3: 5,
  plus3e: 6,
  "48k-ntsc": 15
};

/** The zx-state version Klive writes */
export const SZX_WRITE_MAJOR = 1;
export const SZX_WRITE_MINOR = 4;

/** The creator Klive writes into CRTR */
export type SzxCreator = { name: string; major: number; minor: number };

/** The default creator, when the caller passes none */
const DEFAULT_CREATOR: SzxCreator = { name: "Klive IDE", major: 0, minor: 0 };

/** Appends a block: its 4-character id (NUL-padded), its size and its data */
function block(out: SnapshotBytes, id: string, data: Uint8Array): void {
  out.fixedString(id, 4).dword(data.length).bytes(data);
}

/**
 * Writes a `.szx` file
 * @param creator The program name and version written into the CRTR block
 * @throws SnapshotRefusedError for a machine zx-state cannot name, or a missing RAM bank
 */
export function writeSzxFile(
  s: SpectrumSnapshot,
  creator: SzxCreator = DEFAULT_CREATOR
): SnapshotWriteResult {
  const machine = s.machine;
  if (typeof machine === "object") {
    throw new SnapshotRefusedError(`A ${machine.unsupported} snapshot cannot be saved`);
  }
  const losses: string[] = [];
  const paged = isPagedSnapshotMachine(machine);
  const plus3 = isPlus3SnapshotMachine(machine);
  const out = new SnapshotBytes();
  out.fixedString("ZXST", 4).byte(SZX_WRITE_MAJOR, SZX_WRITE_MINOR, SZX_MACHINE_IDS[machine]);
  out.byte(s.ula.alternateTimings ? 0x01 : 0x00);

  // --- CRTR
  const crtr = new SnapshotBytes()
    .fixedString(creator.name, 32)
    .word(creator.major)
    .word(creator.minor);
  block(out, "CRTR", crtr.toArray());

  // --- Z80R
  const c = s.cpu;
  const z = new SnapshotBytes();
  for (const v of [c.af, c.bc, c.de, c.hl, c.af_, c.bc_, c.de_, c.hl_, c.ix, c.iy, c.sp, c.pc]) {
    z.word(v);
  }
  z.byte(c.i, c.r, c.iff1 ? 1 : 0, c.iff2 ? 1 : 0, c.im & 0x03);
  z.dword(s.ula.frameTact ?? 0);
  // --- HALT and "interrupts suppressed" are mutually exclusive (spec); HALT wins
  const flags = c.halted ? 0x02 : c.suppressInterrupt ? 0x01 : 0x00;
  z.byte(0 /* chHoldIntReqCycles */, flags).word(c.memptr ?? 0);
  block(out, "Z80R", z.toArray());

  // --- SPCR
  const spcr = new SnapshotBytes()
    .byte(s.ula.border & 0x07)
    .byte(paged ? (s.paging?.port7ffd ?? 0) : 0)
    .byte(plus3 ? (s.paging?.port1ffd ?? 0) : 0)
    .byte(s.ula.lastFe ?? s.ula.border & 0x07)
    .fill(4);
  block(out, "SPCR", spcr.toArray());

  // --- AY: built into the 128K models (flags 0), or a Melodik-style add-on of a 48K
  if (s.ay && (paged || s.ay.on48k)) {
    const ay = new SnapshotBytes().byte(paged ? 0x00 : 0x02, s.ay.selected & 0x0f);
    for (let r = 0; r < 16; r++) ay.byte(s.ay.regs[r] ?? 0);
    block(out, "AY", ay.toArray());
  } else if (s.ay) {
    losses.push("The AY registers of a 48K without an add-on AY are not saved");
  }

  // --- KEYB: issue 2 (16K/48K only), no keyboard joystick
  const keyb = new SnapshotBytes()
    .dword(!paged && s.peripherals.issue2 ? 0x01 : 0x00)
    .byte(8 /* ZXSTKJT_NONE */);
  block(out, "KEYB", keyb.toArray());

  // --- RAMP
  const banks =
    machine === "16k" ? [5] : paged ? [0, 1, 2, 3, 4, 5, 6, 7] : [...SPECTRUM_48K_BANKS];
  for (const b of banks) {
    const data = s.ram.get(b);
    if (!data || data.length !== SPECTRUM_BANK_SIZE) {
      throw new SnapshotRefusedError(
        `The ${snapshotMachineName(machine)} snapshot has no RAM bank ${b}`
      );
    }
    const ramp = new SnapshotBytes().word(0x01 /* compressed */).byte(b).bytes(zlibSync(data));
    block(out, "RAMP", ramp.toArray());
  }

  // --- +3 and DSK
  const p3 = s.peripherals.plus3;
  if (plus3 && p3 && p3.drives > 0) {
    block(out, "+3", new SnapshotBytes().byte(p3.drives, p3.motorOn ? 1 : 0).toArray());
    for (const disk of p3.disks) {
      if (!disk.fileName) {
        losses.push(
          `The disk in drive ${disk.drive === 1 ? "B" : "A"} has no file, and a .szx can only link disks to files`
        );
        continue;
      }
      const name = latin1Bytes(disk.fileName + "\0");
      const dsk = new SnapshotBytes()
        .word(disk.sideB ? 0x04 : 0x00)
        .byte(disk.drive)
        .dword(name.length)
        .bytes(name);
      block(out, "DSK", dsk.toArray());
    }
  }

  // --- TAPE: linked to its file, or embedded when it has none (D17)
  const tape = s.peripherals.tape;
  if (tape) {
    const t = new SnapshotBytes().word(tape.currentBlock);
    if (tape.fileName) {
      const name = latin1Bytes(tape.fileName);
      t.word(0x00).dword(0).dword(name.length).fill(16).bytes(name);
      block(out, "TAPE", t.toArray());
    } else if (tape.embedded) {
      const packed = zlibSync(tape.embedded);
      t.word(0x01 | 0x02)
        .dword(tape.embedded.length)
        .dword(packed.length)
        .fixedString((tape.extension ?? "tzx").toLowerCase(), 16)
        .bytes(packed);
      block(out, "TAPE", t.toArray());
    }
  }

  return { bytes: out.toArray(), losses };
}
