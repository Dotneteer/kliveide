import { describe, expect, it } from "vitest";

import { NextKeyCodeSet, nextKeyMappings } from "@emu/machines/zxNext/NextKeyMappings";
import { spectrumKeyMappings } from "@emu/machines/zxSpectrum/SpectrumKeyMappings";
import { createSession, type ExtraKey, type MatrixKey, type NextTestSession } from "../../harness/zxnext";
import { keyCode } from "../../harness/zxnext/script/keys";

/*
 * The host's keys on the Next (KEY-009): the arrows, Backspace, Home, comma, full stop, semicolon and
 * quote press the Next's extra keys, so that NextRegs $B0/$B1 report them and NextReg $68 bit 4 can
 * cancel their matrix entries - the way the membrane treats the real keys (keyboard.test.ts, KEY-004
 * and KEY-005). Before this, the Next used the Spectrum's mapping, which pressed the two matrix keys
 * directly (UP as CAPS SHIFT + 7): $B0/$B1 read 0 and $68 bit 4 had nothing to cancel.
 */

/** The host keys that stand for an extra key, the extra key, and the matrix pair it enters. */
const HOST_EXTRA: Array<[string, ExtraKey, [MatrixKey, MatrixKey]]> = [
  ["ArrowUp", "UP", ["CAPS", "7"]],
  ["ArrowDown", "DOWN", ["CAPS", "6"]],
  ["ArrowLeft", "LEFT", ["CAPS", "5"]],
  ["ArrowRight", "RIGHT", ["CAPS", "8"]],
  ["Backspace", "DELETE", ["CAPS", "0"]],
  ["Home", "EDIT", ["CAPS", "1"]],
  ["Comma", ",", ["SYM", "N"]],
  ["Period", ".", ["SYM", "M"]],
  ["NumpadDecimal", ".", ["SYM", "M"]],
  ["Semicolon", ";", ["SYM", "O"]],
  ["Quote", '"', ["SYM", "P"]]
];

/** $B0/$B1 bit of each extra key used here (zxnext.vhd ~6149-6158) */
const EXTRA_BIT: Partial<Record<ExtraKey, [0xb0 | 0xb1, number]>> = {
  ";": [0xb0, 7], '"': [0xb0, 6], ",": [0xb0, 5], ".": [0xb0, 4],
  UP: [0xb0, 3], DOWN: [0xb0, 2], LEFT: [0xb0, 1], RIGHT: [0xb0, 0],
  DELETE: [0xb1, 7], EDIT: [0xb1, 6]
};

const ROWS = [0xfefe, 0xfdfe, 0xfbfe, 0xf7fe, 0xeffe, 0xdffe, 0xbffe, 0x7ffe];
const MATRIX_ROWS: MatrixKey[][] = [
  ["CAPS", "Z", "X", "C", "V"], ["A", "S", "D", "F", "G"], ["Q", "W", "E", "R", "T"],
  ["1", "2", "3", "4", "5"], ["0", "9", "8", "7", "6"], ["P", "O", "I", "U", "Y"],
  ["ENTER", "L", "K", "J", "H"], ["SPACE", "SYM", "M", "N", "B"]
];

/** The matrix keys down, read through port $FE */
function matrixDown(s: NextTestSession): MatrixKey[] {
  const down: MatrixKey[] = [];
  ROWS.forEach((port, row) => {
    const cols = s.in(port) & 0x1f;
    for (let bit = 0; bit < 5; bit++) if ((cols & (1 << bit)) === 0) down.push(MATRIX_ROWS[row][bit]);
  });
  return down.sort();
}

/** The key codes a host key presses, through the Next's default mapping */
function codesOf(hostKey: string): number[] {
  const mapping = nextKeyMappings[hostKey];
  const names = typeof mapping === "string" ? [mapping] : mapping;
  return names.map((name) => NextKeyCodeSet[name]);
}

async function parked(): Promise<NextTestSession> {
  const s = await createSession();
  await s.loadCode(" .org $8000\n di\n jr $");
  return s.runFrames(1);
}

function press(s: NextTestSession, hostKey: string, down: boolean): NextTestSession {
  for (const code of codesOf(hostKey)) s.machine.setKeyStatus(code, down);
  return s;
}

describe("host keys on the Next", () => {
  it("KEY-009: the machine offers the Next's own key codes and mapping", async () => {
    const s = await parked();
    expect(s.machine.getKeyCodeSet()).toBe(NextKeyCodeSet);
    expect(s.machine.getDefaultKeyMapping()).toBe(nextKeyMappings);
  });

  it("KEY-009: every name in the Next's mapping is a Next key code", () => {
    for (const [hostKey, mapping] of Object.entries(nextKeyMappings)) {
      const names = typeof mapping === "string" ? [mapping] : mapping;
      for (const name of names) expect(NextKeyCodeSet[name], `${hostKey} -> ${name}`).toBeTypeOf("number");
    }
  });

  it("KEY-009: each extra-key host key presses that one extra key", () => {
    for (const [hostKey, extra] of HOST_EXTRA) {
      expect(codesOf(hostKey), hostKey).toEqual([keyCode(extra)]);
    }
  });

  it("KEY-009: the Spectrum keeps its mapping: the host's arrow is CAPS SHIFT + 7 there", () => {
    expect(spectrumKeyMappings.ArrowUp).toEqual(["CShift", "N7"]);
    expect(spectrumKeyMappings.Backspace).toEqual(["CShift", "N0"]);
  });

  it("KEY-009: a host extra key sets $B0/$B1 and enters its pair; $68 bit 4 cancels only the pair", async () => {
    const s = await parked();
    for (const [hostKey, extra, pair] of HOST_EXTRA) {
      const [reg, bit] = EXTRA_BIT[extra]!;
      // --- $68 bit 4 clear (the reset value): the extra key and its matrix pair
      press(s, hostKey, true).runFrames(1);
      expect(s.readNextReg(reg) & (1 << bit), `${hostKey}: $${reg.toString(16)} bit ${bit}`).toBe(1 << bit);
      expect(matrixDown(s), `${hostKey}: pair`).toEqual([...pair].sort());
      press(s, hostKey, false).runFrames(1);
      // --- $68 bit 4 set: the extra key alone
      s.setNextReg(0x68, s.readNextReg(0x68) | 0x10);
      press(s, hostKey, true).runFrames(1);
      expect(s.readNextReg(reg) & (1 << bit), `${hostKey}: $${reg.toString(16)}, pair cancelled`).toBe(1 << bit);
      expect(matrixDown(s), `${hostKey}: no pair`).toEqual([]);
      press(s, hostKey, false);
      s.setNextReg(0x68, s.readNextReg(0x68) & ~0x10).runFrames(1);
      expect([s.readNextReg(0xb0), s.readNextReg(0xb1)], `${hostKey}: released`).toEqual([0, 0]);
    }
  });

  it("KEY-009: the host's Shift is still CAPS SHIFT, and $68 bit 4 does not touch it", async () => {
    const s = await parked();
    s.setNextReg(0x68, s.readNextReg(0x68) | 0x10);
    press(s, "ShiftLeft", true);
    press(s, "Digit7", true).runFrames(1);
    expect(matrixDown(s)).toEqual(["7", "CAPS"]);
    expect(s.readNextReg(0xb0), "no extra key").toBe(0);
  });
});
