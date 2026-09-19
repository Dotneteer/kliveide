import { constants, copyFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir, userInfo } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { CimHandler } from "@main/fat32/CimHandlers";

import {
  ALL_CORES,
  createSession,
  MATRIX_KEYS,
  NEXT_EXTRA_KEYS,
  ULA_COLORS,
  type CoreName,
  type ExtraKey,
  type MatrixKey,
  type NextKey,
  type NextTestSession
} from "../../harness/zxnext";

/*
 * The keyboard (catalogue KEY-001 - KEY-006, KEY-008; KEY-007 needs the joystick input of §4.32).
 *
 * Hardware:
 * - zxnext.vhd ~2538: port $FE is every even port (A0 = 0); ~3440-3456: the read gives
 *   '1' & EAR & '1' & the key columns, and the membrane is asked for the rows A15-A8 of that read.
 * - input/membrane/membrane.vhd: o_cols is the AND of every row whose address line is 0 - each row
 *   the columns of its keys (0 = pressed); the rows are the Spectrum's: A8 CAPS Z X C V, A9 A S D F G,
 *   A10 Q W E R T, A11 1 2 3 4 5, A12 0 9 8 7 6, A13 P O I U Y, A14 ENTER L K J H, A15 SPACE SYM M N B
 *   (bit 0 first). The logic holds the full state of every row, so a read shows the keys pressed and
 *   nothing else: three keys on the corners of a rectangle do not make the fourth appear (the
 *   electrical ghosting of a passive membrane is not in the VHDL and not modelled).
 * - The 16 extra keys sit in columns 5-6 (row r column 5 = extended key 2r, column 6 = 2r + 1). Each
 *   also enters two matrix keys (matrix_work_ex): EXTEND = CAPS+SYM, UP = CAPS+7, CAPS LOCK = CAPS+2,
 *   GRAPH = CAPS+9, TRUE VIDEO = CAPS+3, INV VIDEO = CAPS+4, BREAK = CAPS+SPACE, EDIT = CAPS+1,
 *   ; = SYM+O, " = SYM+P, , = SYM+N, . = SYM+M, DELETE = CAPS+0, RIGHT = CAPS+8, LEFT = CAPS+5,
 *   DOWN = CAPS+6 - unless NextReg $68 bit 4 (nr_68_cancel_extended_keys, reset 0) cancels those
 *   entries. zxnext.vhd ~6149-6158: $B0 = ; " , . UP DOWN LEFT RIGHT, $B1 = DELETE EDIT BREAK INV TRUE
 *   GRAPH CAPSLOCK EXTEND, the keys themselves, cancelled or not.
 * - zxnext.vhd ~5145: $06 bit 2 (PS/2 mode) is written only in config mode; no reset branch.
 */

const ROWS = [0xfefe, 0xfdfe, 0xfbfe, 0xf7fe, 0xeffe, 0xdffe, 0xbffe, 0x7ffe];

/** The Spectrum matrix: row (A8 + n) and column bit of each key, independent of the harness table. */
const MATRIX: Record<MatrixKey, [number, number]> = {
  CAPS: [0, 0], Z: [0, 1], X: [0, 2], C: [0, 3], V: [0, 4],
  A: [1, 0], S: [1, 1], D: [1, 2], F: [1, 3], G: [1, 4],
  Q: [2, 0], W: [2, 1], E: [2, 2], R: [2, 3], T: [2, 4],
  "1": [3, 0], "2": [3, 1], "3": [3, 2], "4": [3, 3], "5": [3, 4],
  "0": [4, 0], "9": [4, 1], "8": [4, 2], "7": [4, 3], "6": [4, 4],
  P: [5, 0], O: [5, 1], I: [5, 2], U: [5, 3], Y: [5, 4],
  ENTER: [6, 0], L: [6, 1], K: [6, 2], J: [6, 3], H: [6, 4],
  SPACE: [7, 0], SYM: [7, 1], M: [7, 2], N: [7, 3], B: [7, 4]
};

/** Each extra key: its $B0/$B1 bit and the two matrix keys it enters. */
const EXTRA: Record<ExtraKey, { reg: 0xb0 | 0xb1; bit: number; combo: [MatrixKey, MatrixKey] }> = {
  ";": { reg: 0xb0, bit: 7, combo: ["SYM", "O"] },
  '"': { reg: 0xb0, bit: 6, combo: ["SYM", "P"] },
  ",": { reg: 0xb0, bit: 5, combo: ["SYM", "N"] },
  ".": { reg: 0xb0, bit: 4, combo: ["SYM", "M"] },
  UP: { reg: 0xb0, bit: 3, combo: ["CAPS", "7"] },
  DOWN: { reg: 0xb0, bit: 2, combo: ["CAPS", "6"] },
  LEFT: { reg: 0xb0, bit: 1, combo: ["CAPS", "5"] },
  RIGHT: { reg: 0xb0, bit: 0, combo: ["CAPS", "8"] },
  DELETE: { reg: 0xb1, bit: 7, combo: ["CAPS", "0"] },
  EDIT: { reg: 0xb1, bit: 6, combo: ["CAPS", "1"] },
  BREAK: { reg: 0xb1, bit: 5, combo: ["CAPS", "SPACE"] },
  "INV VIDEO": { reg: 0xb1, bit: 4, combo: ["CAPS", "4"] },
  "TRUE VIDEO": { reg: 0xb1, bit: 3, combo: ["CAPS", "3"] },
  GRAPH: { reg: 0xb1, bit: 2, combo: ["CAPS", "9"] },
  "CAPS LOCK": { reg: 0xb1, bit: 1, combo: ["CAPS", "2"] },
  EXTEND: { reg: 0xb1, bit: 0, combo: ["CAPS", "SYM"] }
};

async function parked(core: CoreName): Promise<NextTestSession> {
  const s = await createSession(core);
  await s.loadCode(" .org $8000\n di\n jr $");
  return s.runFrames(1);
}

/** The key columns (bits 4-0) of the eight half-row reads; bits 7 and 5 must read 1. */
function halfRows(s: NextTestSession): number[] {
  return ROWS.map((port) => {
    const v = s.in(port);
    expect(v & 0xa0, `bits 7 and 5 of ${port.toString(16)}`).toBe(0xa0);
    return v & 0x1f;
  });
}

/** The half-row reads expected with these matrix keys down. */
function expectedRows(keys: MatrixKey[]): number[] {
  const rows = Array(8).fill(0x1f);
  for (const k of keys) rows[MATRIX[k][0]] &= ~(1 << MATRIX[k][1]);
  return rows;
}

const hexes = (values: number[]) => values.map((v) => "$" + v.toString(16).padStart(2, "0"));

describe.each(ALL_CORES)("keyboard - %s core", (core) => {
  // -------------------------------------------------------------------------------------------------
  // KEY-001 Matrix half-rows
  // -------------------------------------------------------------------------------------------------

  it("KEY-001: each of the 40 keys alone clears exactly its bit in its half-row", async () => {
    const s = await parked(core);
    expect(hexes(halfRows(s)), "no key").toEqual(hexes(expectedRows([])));
    for (const key of MATRIX_KEYS) {
      s.keyDown(key).runFrames(1);
      expect(hexes(halfRows(s)), key).toEqual(hexes(expectedRows([key])));
      s.keyUp(key);
    }
    expect(hexes(halfRows(s).slice(0)), "all released").toEqual(hexes(expectedRows([])));
  });

  // -------------------------------------------------------------------------------------------------
  // KEY-002 Several keys
  // -------------------------------------------------------------------------------------------------

  it("KEY-002: keys in one row and in several rows combine; a rectangle of three shows no fourth", async () => {
    const s = await parked(core);
    s.keyDown("CAPS", "Z", "V").runFrames(1);
    expect(hexes(halfRows(s)), "one row").toEqual(hexes(expectedRows(["CAPS", "Z", "V"])));
    s.keyUp("CAPS", "Z", "V");
    // --- A and S on row A9, Q on row A10: W (the rectangle's fourth corner) stays up
    s.keyDown("A", "S", "Q").runFrames(1);
    expect(hexes(halfRows(s)), "rectangle").toEqual(hexes(expectedRows(["A", "S", "Q"])));
    s.keyUp("A", "S", "Q").runFrames(1);
    expect(hexes(halfRows(s))).toEqual(hexes(expectedRows([])));
  });

  // -------------------------------------------------------------------------------------------------
  // KEY-003 Partial decoding
  // -------------------------------------------------------------------------------------------------

  it("KEY-003: every address line at 0 selects its row and the rows AND; any even port reads it", async () => {
    const s = await parked(core);
    s.keyDown("A", "Q", "Z", "P").runFrames(1);
    const cols = (port: number) => s.in(port) & 0x1f;
    expect(cols(0xf9fe), "A9 + A10: A and Q, both column 0").toBe(0x1e);
    expect(cols(0xdefe), "A8 + A13: Z (bit 1) and P (bit 0)").toBe(0x1c);
    expect(cols(0x00fe), "every row").toBe(0x1c);
    expect(cols(0xfffe), "no row").toBe(0x1f);
    // --- zxnext.vhd ~2538: A0 = 0 is the whole decode
    for (const port of [0xfefc, 0xfe02, 0xfe7e]) expect(cols(port), port.toString(16)).toBe(0x1d);
  });

  // -------------------------------------------------------------------------------------------------
  // KEY-004 The extra keys
  // -------------------------------------------------------------------------------------------------

  it("KEY-004: each extra key sets its $B0/$B1 bit and enters its two matrix keys", async () => {
    const s = await parked(core);
    expect(hexes([s.readNextReg(0xb0), s.readNextReg(0xb1)]), "no key").toEqual(["$00", "$00"]);
    for (const key of NEXT_EXTRA_KEYS) {
      const { reg, bit, combo } = EXTRA[key];
      s.keyDown(key).runFrames(1);
      expect(hexes([s.readNextReg(0xb0), s.readNextReg(0xb1)]), `${key}: $B0/$B1`).toEqual(
        hexes([reg === 0xb0 ? 1 << bit : 0, reg === 0xb1 ? 1 << bit : 0])
      );
      expect(hexes(halfRows(s)), `${key}: ${combo.join("+")}`).toEqual(hexes(expectedRows(combo)));
      s.keyUp(key);
    }
    s.keyDown("UP", "DOWN", ";", "EXTEND").runFrames(1);
    expect(hexes([s.readNextReg(0xb0), s.readNextReg(0xb1)]), "four together").toEqual(["$8c", "$01"]);
  });

  // -------------------------------------------------------------------------------------------------
  // KEY-005 $68 bit 4
  // -------------------------------------------------------------------------------------------------

  it("KEY-005: $68 bit 4 stops the matrix entries of the extra keys; $B0/$B1 still report them", async () => {
    const s = await parked(core);
    s.setNextReg(0x68, s.readNextReg(0x68) | 0x10);
    expect(s.readNextReg(0x68) & 0x10, "read back").toBe(0x10);
    s.keyDown("UP", ",", "BREAK").runFrames(1);
    expect(hexes(halfRows(s)), "no matrix keys").toEqual(hexes(expectedRows([])));
    expect(hexes([s.readNextReg(0xb0), s.readNextReg(0xb1)])).toEqual(["$28", "$20"]);
    // --- The matrix keys themselves are not affected
    s.keyDown("CAPS", "7").runFrames(1);
    expect(hexes(halfRows(s)), "real CAPS + 7").toEqual(hexes(expectedRows(["CAPS", "7"])));
    s.keyUp("CAPS", "7");
    s.setNextReg(0x68, s.readNextReg(0x68) & ~0x10).runFrames(1);
    expect(hexes(halfRows(s)), "entries back").toEqual(hexes(expectedRows(["CAPS", "7", "SYM", "N", "SPACE"])));
    // --- A reset clears the bit
    s.setNextReg(0x68, s.readNextReg(0x68) | 0x10).reset();
    expect(s.readNextReg(0x68) & 0x10, "after a soft reset").toBe(0);
  });

  // -------------------------------------------------------------------------------------------------
  // KEY-008 PS/2 mode
  // -------------------------------------------------------------------------------------------------

  it("KEY-008: $06 bit 2 (PS/2 mode) changes only in config mode", async () => {
    const s = await parked(core);
    const before = s.readNextReg(0x06) & 0x04;
    s.setNextReg(0x06, s.readNextReg(0x06) ^ 0x04);
    expect(s.readNextReg(0x06) & 0x04, "outside config mode").toBe(before);
    s.setNextReg(0x03, 0x07); // --- config mode
    s.setNextReg(0x06, s.readNextReg(0x06) | 0x04);
    s.setNextReg(0x03, 0x03);
    expect(s.readNextReg(0x06) & 0x04, "written in config mode").toBe(0x04);
    s.setNextReg(0x06, s.readNextReg(0x06) & ~0x04);
    expect(s.readNextReg(0x06) & 0x04, "kept outside config mode").toBe(0x04);
    s.reset();
    expect(s.readNextReg(0x06) & 0x04, "no reset branch").toBe(0x04);
  });
});

// ---------------------------------------------------------------------------------------------------
// KEY-006 The ROM's keyboard scan, through NextZXOS
// ---------------------------------------------------------------------------------------------------

const CARD = process.env.KLIVE_SD_CARD ?? join(userInfo().homedir, "Klive", "ks2.cim");

/** Boots NextZXOS from a clone of the card (as SPI-009) and runs until the menu is up. */
async function bootNextZxos(core: CoreName, dir: string): Promise<{ s: NextTestSession; close: () => void }> {
  const path = join(dir, `ks2-${core}.cim`);
  copyFileSync(CARD, path, constants.COPYFILE_FICLONE);
  const handler = new CimHandler(path);
  const info = handler.cimInfo;
  const s = await createSession(core);
  s.setRtcTime({ year: 26, month: 9, date: 19, day: 7, hours: 10, minutes: 0, seconds: 0 });
  s.attachSdCard({
    totalSectors: (info.maxSize * 2048) / info.sectorSize,
    readSector: (i) => handler.readSector(i),
    writeSector: (i, d) => handler.writeSector(i, d)
  });
  await s.runFramesAsync(250);
  return { s, close: () => handler.close() };
}

/** Holds a key for 4 frames and gives the ROM 4 frames with it released (its scan runs every frame). */
async function tap(s: NextTestSession, ...keys: NextKey[]): Promise<void> {
  s.keyDown(...keys);
  await s.runFramesAsync(4);
  s.keyUp(...keys);
  await s.runFramesAsync(4);
}

async function type(s: NextTestSession, text: string): Promise<void> {
  for (const c of text) await tap(s, c === " " ? "SPACE" : (c as NextKey));
}

describe.skipIf(!existsSync(CARD))("KEY-006: the ROM reads the keyboard (NextZXOS, both cores)", () => {
  it.each(ALL_CORES)("%s: the menu takes DOWN and ENTER; NextBASIC takes a typed BORDER and POKE", async (core) => {
    const dir = mkdtempSync(join(tmpdir(), "klive-key006-"));
    try {
      const { s, close } = await bootNextZxos(core, dir);
      try {
        // --- DOWN twice (an extra key: CAPS + 6 in the matrix) from Browser to NextBASIC
        await tap(s, "DOWN");
        await tap(s, "DOWN");
        await tap(s, "ENTER");
        await s.runFramesAsync(100);
        // --- The comma is the extra "," key (SYM + N)
        await type(s, "POKE 40000");
        await tap(s, ",");
        await type(s, "42");
        await tap(s, "ENTER");
        await s.runFramesAsync(50);
        expect(s.peek(40000), "POKE 40000,42").toBe(42);
        await type(s, "BORDER 2");
        await tap(s, "ENTER");
        await s.runFramesAsync(50);
        expect(s.pixel(8, 8), "a red border").toBe(ULA_COLORS[2]);
      } finally {
        close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 300_000);
});
