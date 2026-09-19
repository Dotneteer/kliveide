import { describe, expect, it } from "vitest";

import { createSession, type JoyButton, type JoySide, type NextTestSession } from "../../harness/zxnext";

/*
 * Joysticks (catalogue JOY-001 - JOY-008) and the key joystick (KEY-007).
 *
 * Hardware:
 * - zxnext.vhd ~5134, ~5842: $05 joystick 1 mode = bit 3 & bits 7-6, joystick 2 = bit 1 & bits 5-4;
 *   read back in the same bits (bit 2 / bit 0 are the effective 50/60 Hz and scandoubler).
 * - ~3426-3491: 001 Kempston 1 ($1F) and 100 Kempston 2 ($37) give C B U D L R in bits 5-0; 101 MD 1
 *   ($1F) and 110 MD 2 ($37) also START (bit 7) and A (bit 6); both connectors OR onto a port.
 *   ~2410, ~2630: $1F / $37 answer only while a joystick is in one of their modes - otherwise no device
 *   answers and the read is $FF (~1826). ~6161: $B2 = right X Z Y MODE, left X Z Y MODE.
 * - input/membrane/membrane_stick.vhd with src/ram/init/keyjoy_64_6.coe: the other modes press
 *   membrane keys - 011: RIGHT 7, LEFT 6, DOWN 8, UP 9, fire 0; 000: RIGHT 2, LEFT 1, DOWN 3, UP 4,
 *   fire 5; 010 (Cursor): RIGHT 8, LEFT 5, DOWN 6, UP 7, fire 0 (the comment block in zxnext.vhd ~3426
 *   names 000/011 the other way round; the table is what the hardware does). 111: all 12 buttons through
 *   the user-defined joymap entries, which also give the Kempston modes' buttons 5-11 and the MD modes'
 *   8-11 a key; they start with column 7 - no key. ~6244-6268: $28 bit 7 selects the joymap, $29 the
 *   address (bit 4 = right connector, bits 3-0 = button), each $2B write stores row (5-3) & column (2-0)
 *   and advances. Columns 5-6 are the extra keys, which behave as pressed on the keyboard.
 * - ~5177, ~5860, ~4917: $0B = I/O mode enable (7), mode (5-4), bit 0; reads en & 0 & mode & 000 & bit 0;
 *   a reset gives $01. md6_joystick_connector_x2.vhd: in I/O mode a connector reports its six raw pins
 *   (C B U D L R) only; membrane_stick's i_joy_en_n: no keys from the joysticks.
 */

const J = { none: 0x00, k1: 0x01, k2: 0x04, md1: 0x05, md2: 0x06, s000: 0x00, cursor: 0x02, s011: 0x03, user: 0x07 };

/** $05 for a mode on each connector (bits 1-0 of a mode: 7-6 / 5-4; bit 2: 3 / 1). */
function nr05(left: number, right: number): number {
  return ((left & 3) << 6) | (((left >> 2) & 1) << 3) | ((right & 3) << 4) | (((right >> 2) & 1) << 1);
}

async function parked(left = J.k1, right = J.s000): Promise<NextTestSession> {
  const s = await createSession();
  await s.loadCode(" .org $8000\n di\n jr $");
  return s.setNextReg(0x05, nr05(left, right)).runFrames(1);
}

const ROWS = [0xfefe, 0xfdfe, 0xfbfe, 0xf7fe, 0xeffe, 0xdffe, 0xbffe, 0x7ffe];
const rows = (s: NextTestSession) => ROWS.map((p) => s.in(p) & 0x1f);

/** Rows with these (row, bit) keys down. */
function rowsWith(...keys: Array<[number, number]>): number[] {
  const r = Array(8).fill(0x1f);
  for (const [row, bit] of keys) r[row] &= ~(1 << bit);
  return r;
}

const KEY = {
  "1": [3, 0], "2": [3, 1], "3": [3, 2], "4": [3, 3], "5": [3, 4],
  "0": [4, 0], "9": [4, 1], "8": [4, 2], "7": [4, 3], "6": [4, 4],
  Q: [2, 0], A: [1, 0], ENTER: [6, 0], SPACE: [7, 0], CAPS: [0, 0], SYM: [7, 1], O: [5, 1]
} as const satisfies Record<string, [number, number]>;

const hexes = (v: number[]) => v.map((b) => "$" + b.toString(16).padStart(2, "0"));

/** Programs joymap entries: connector, first button index, row/column bytes (Z80 code, as software). */
async function program(s: NextTestSession, side: JoySide, button: number, entries: number[]): Promise<void> {
  s.setNextReg(0x28, 0x80).setNextReg(0x29, (side === "right" ? 0x10 : 0) | button);
  for (const e of entries) s.setNextReg(0x2b, e);
}

const entry = (row: number, col: number) => (row << 3) | col;

describe("joysticks", () => {
  // -------------------------------------------------------------------------------------------------
  // JOY-006 / JOY-008
  // -------------------------------------------------------------------------------------------------

  it("JOY-006: $05 holds a 3-bit mode per joystick in bits 7-6 + 3 and 5-4 + 1", async () => {
    const s = await parked();
    for (const v of [0x00, 0xca, 0x7a, 0x48, 0x32, 0xfa]) {
      expect(s.setNextReg(0x05, v).readNextReg(0x05) & 0xfa, `$${v.toString(16)}`).toBe(v & 0xfa);
    }
    // --- The split is observable: bits 5-4 = 01 put joystick 2 on $1F, bit 1 then moves it to $37
    s.joystick("right", "UP");
    expect([s.setNextReg(0x05, nr05(J.s000, J.k1)).in(0x1f), s.in(0x37)], "right: Kempston 1").toEqual([0x08, 0xff]);
    expect([s.setNextReg(0x05, nr05(J.s000, J.k2)).in(0x1f), s.in(0x37)], "right: Kempston 2").toEqual([0xff, 0x08]);
  });

  it("JOY-008: with nothing pressed a Kempston port reads 0; a port no mode uses reads $FF", async () => {
    const s = await parked(J.k1, J.k2);
    expect([s.in(0x1f), s.in(0x37)]).toEqual([0x00, 0x00]);
    s.setNextReg(0x05, nr05(J.s000, J.cursor));
    expect([s.in(0x1f), s.in(0x37)], "no Kempston / MD mode").toEqual([0xff, 0xff]);
  });

  // -------------------------------------------------------------------------------------------------
  // JOY-001 / JOY-002 Kempston
  // -------------------------------------------------------------------------------------------------

  it("JOY-001: Kempston 1 on $1F: R L D U B C in bits 0-5; A and START do not show", async () => {
    const s = await parked(J.k1, J.s000);
    const bits: Array<[JoyButton, number]> = [["RIGHT", 0x01], ["LEFT", 0x02], ["DOWN", 0x04], ["UP", 0x08], ["B", 0x10], ["C", 0x20], ["A", 0], ["START", 0]];
    for (const [button, bit] of bits) expect(s.joystick("left", button).in(0x1f), button).toBe(bit);
    expect(s.joystick("left", "UP", "RIGHT", "B").in(0x1f), "together").toBe(0x19);
    // --- The right connector in Kempston 1 too: the two OR
    s.setNextReg(0x05, nr05(J.k1, J.k1)).joystick("right", "LEFT");
    expect(s.in(0x1f), "both connectors").toBe(0x1b);
    expect(s.in(0x37), "$37 unused").toBe(0xff);
  });

  it("JOY-002: Kempston 2 on $37, from either connector", async () => {
    const s = await parked(J.s000, J.k2);
    s.joystick("right", "DOWN", "C");
    expect([s.in(0x37), s.in(0x1f)]).toEqual([0x24, 0xff]);
    s.setNextReg(0x05, nr05(J.k2, J.k1)).joystick("left", "UP");
    expect([s.in(0x37), s.in(0x1f)], "left on $37, right on $1F").toEqual([0x08, 0x24]);
  });

  // -------------------------------------------------------------------------------------------------
  // JOY-005 MD pads
  // -------------------------------------------------------------------------------------------------

  it("JOY-005: MD 1 / MD 2 add START and A in bits 7-6; X Y Z MODE are in $B2", async () => {
    const s = await parked(J.md1, J.md2);
    s.joystick("left", "START", "A", "C", "B", "UP");
    expect(s.in(0x1f), "MD 1").toBe(0xf8);
    s.joystick("right", "START", "RIGHT");
    expect(s.in(0x37), "MD 2").toBe(0x81);
    // --- $B2: right X Z Y MODE in bits 7-4, left in bits 3-0
    s.joystick("left", "X", "MODE").joystick("right", "Z", "Y");
    expect(s.readNextReg(0xb2), "$B2").toBe(0x69);
    s.joystick("left").joystick("right", "X", "MODE");
    expect(s.readNextReg(0xb2), "$B2 right X, MODE").toBe(0x90);
  });

  // -------------------------------------------------------------------------------------------------
  // JOY-003 / JOY-004 Sinclair and Cursor
  // -------------------------------------------------------------------------------------------------

  it("JOY-003: mode 011 presses 7 6 8 9 0, mode 000 presses 2 1 3 4 5 (R L D U fire)", async () => {
    const s = await parked(J.s011, J.s000);
    const cases: Array<[JoySide, JoyButton, keyof typeof KEY]> = [
      ["left", "RIGHT", "7"], ["left", "LEFT", "6"], ["left", "DOWN", "8"], ["left", "UP", "9"], ["left", "B", "0"],
      ["right", "RIGHT", "2"], ["right", "LEFT", "1"], ["right", "DOWN", "3"], ["right", "UP", "4"], ["right", "B", "5"]
    ];
    for (const [side, button, key] of cases) {
      s.joystick(side, button);
      expect(hexes(rows(s)), `${side} ${button}`).toEqual(hexes(rowsWith(KEY[key] as [number, number])));
      s.joystick(side);
    }
    s.joystick("left", "C", "A", "START");
    expect(hexes(rows(s)), "other buttons: no key").toEqual(hexes(rowsWith()));
    expect([s.in(0x1f), s.in(0x37)], "no Kempston port").toEqual([0xff, 0xff]);
  });

  it("JOY-004: Cursor mode presses 8 5 6 7 0 (R L D U fire) without CAPS SHIFT", async () => {
    const s = await parked(J.cursor, J.s000);
    const cases: Array<[JoyButton, keyof typeof KEY]> = [["RIGHT", "8"], ["LEFT", "5"], ["DOWN", "6"], ["UP", "7"], ["B", "0"]];
    for (const [button, key] of cases) {
      s.joystick("left", button);
      expect(hexes(rows(s)), button).toEqual(hexes(rowsWith(KEY[key] as [number, number])));
    }
    s.joystick("left", "UP", "B").keyDown("A");
    expect(hexes(rows(s)), "with a key of the keyboard").toEqual(hexes(rowsWith(KEY["7"], KEY["0"], KEY.A)));
  });

  // -------------------------------------------------------------------------------------------------
  // KEY-007 The key joystick map
  // -------------------------------------------------------------------------------------------------

  it("KEY-007: mode 111 presses the keys programmed through $28/$29/$2B; unprogrammed, none", async () => {
    const s = await parked(J.user, J.user);
    s.joystick("left", "RIGHT", "B", "START", "MODE");
    expect(hexes(rows(s)), "power-on joymap: no keys").toEqual(hexes(rowsWith()));
    // --- left buttons 0-4 (R L D U B): Q A SPACE ENTER SYM; button 7 (START): EDIT (row 3, column 6)
    await program(s, "left", 0, [entry(2, 0), entry(1, 0), entry(7, 0), entry(6, 0), entry(7, 1)]);
    await program(s, "left", 7, [entry(3, 6)]);
    s.joystick("left", "RIGHT");
    expect(hexes(rows(s)), "RIGHT = Q").toEqual(hexes(rowsWith(KEY.Q)));
    s.joystick("left", "B", "DOWN");
    expect(hexes(rows(s)), "B + DOWN = SYM + SPACE").toEqual(hexes(rowsWith(KEY.SYM, KEY.SPACE)));
    // --- An extra key: $B1 bit 6 and its CAPS + 1 entry
    s.joystick("left", "START");
    expect(s.readNextReg(0xb1), "START = EDIT").toBe(0x40);
    expect(hexes(rows(s)), "EDIT = CAPS + 1").toEqual(hexes(rowsWith(KEY.CAPS, KEY["1"])));
    // --- The right connector has its own entries
    s.joystick("left").joystick("right", "RIGHT");
    expect(hexes(rows(s)), "right not programmed").toEqual(hexes(rowsWith()));
    await program(s, "right", 0, [entry(5, 1)]);
    expect(hexes(rows(s)), "right RIGHT = O").toEqual(hexes(rowsWith(KEY.O)));
  });

  it("KEY-007: the Kempston and MD modes give their other buttons the user-defined keys", async () => {
    const s = await parked(J.k1, J.md1);
    await program(s, "left", 6, [entry(6, 0)]); // --- A: ENTER
    await program(s, "right", 9, [entry(1, 0)]); // --- Z: A
    await program(s, "right", 6, [entry(2, 0)]); // --- A on an MD pad: bits 5-7 are port bits, not keys
    s.joystick("left", "A", "UP");
    expect([s.in(0x1f) & 0x3f, ...rows(s)], "Kempston: UP on the port, A as ENTER").toEqual([0x08, ...rowsWith(KEY.ENTER)]);
    s.joystick("left").joystick("right", "Z", "A");
    expect([s.in(0x1f), ...rows(s)], "MD: A on the port, Z as the A key").toEqual([0x40, ...rowsWith(KEY.A)]);
  });

  it("KEY-007: a soft reset keeps the joymap; a hard reset (a core load) restores it", async () => {
    const s = await parked(J.user, J.s000);
    await program(s, "left", 0, [entry(2, 0)]);
    s.reset().setNextReg(0x05, nr05(J.user, J.s000)).joystick("left", "RIGHT");
    expect(hexes(rows(s)), "soft reset").toEqual(hexes(rowsWith(KEY.Q)));
    s.hardReset();
    await s.loadCode(" .org $8000\n di\n jr $");
    s.setNextReg(0x05, nr05(J.user, J.s000)).joystick("left", "RIGHT");
    expect(hexes(rows(s)), "hard reset").toEqual(hexes(rowsWith()));
  });

  // -------------------------------------------------------------------------------------------------
  // JOY-007 $0B I/O mode
  // -------------------------------------------------------------------------------------------------

  it("JOY-007: $0B reads en & 0 & mode & 000 & bit 0, resets to $01; I/O mode passes raw pins, no keys", async () => {
    const s = await parked(J.md1, J.s011);
    expect(s.readNextReg(0x0b), "reset value").toBe(0x01);
    expect(s.setNextReg(0x0b, 0xff).readNextReg(0x0b), "unused bits").toBe(0xb1);
    s.setNextReg(0x0b, 0x80);
    s.joystick("left", "START", "A", "UP", "X").joystick("right", "B");
    expect(s.in(0x1f), "MD 1 in I/O mode: the six raw pins").toBe(0x08);
    expect(s.readNextReg(0xb2), "no X").toBe(0x00);
    expect(hexes(rows(s)), "no key from the Sinclair stick").toEqual(hexes(rowsWith()));
    s.setNextReg(0x0b, 0x00);
    expect([s.in(0x1f), s.readNextReg(0xb2)], "I/O mode off").toEqual([0xc8, 0x08]);
    expect(hexes(rows(s)), "the Sinclair stick's fire").toEqual(hexes(rowsWith(KEY["0"])));
    s.setNextReg(0x0b, 0xb0).reset();
    expect(s.readNextReg(0x0b), "soft reset").toBe(0x01);
  });
});
