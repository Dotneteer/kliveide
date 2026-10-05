import { describe, expect, it } from "vitest";

import {
  analyzeCopperList,
  COPPER_TIMING_50HZ,
  copperMoveSwatch,
  copperShapeOf,
  CopperTiming,
  decodeCopperList,
  decodeCopperWord,
  describeCopperInstruction,
  formatCopperIndex,
  formatCopperInstruction,
  formatCopperWord
} from "@common/zxnext/copper/copperDecoder";

const wait = (line: number, hpos: number) => 0x8000 | (hpos << 9) | line;
const move = (reg: number, value: number) => (reg << 8) | value;

const ramOf = (words: number[]) => {
  const ram = new Uint8Array(0x800);
  words.forEach((w, i) => {
    ram[i * 2] = w >> 8;
    ram[i * 2 + 1] = w & 0xff;
  });
  return ram;
};

// --- The 60 Hz frame is shorter (264 lines); the Copper compares cvc, so the line count moves.
const TIMING_60HZ: CopperTiming = { lines: 264, hcs: 456 };

describe("Copper decoder: encodings", () => {
  it("decodes a WAIT with its hc and paper x", () => {
    const i = decodeCopperWord(11, wait(120, 31));
    expect(i).toEqual({
      kind: "wait",
      index: 11,
      word: 0xbe78,
      line: 120,
      hpos: 31,
      hc: 31 * 8 + 12,
      paperX: 248
    });
  });

  it("decodes the WAIT edges: line 511, hpos 63, line 0 / hpos 0", () => {
    const a = decodeCopperWord(0, wait(511, 0));
    expect(a).toMatchObject({ kind: "wait", line: 511, hpos: 0, hc: 12, paperX: 0 });
    const b = decodeCopperWord(0, wait(0, 63));
    expect(b).toMatchObject({ kind: "wait", line: 0, hpos: 63, hc: 516, paperX: 504 });
    expect(decodeCopperWord(0, 0x8000)).toMatchObject({ kind: "wait", line: 0, hpos: 0 });
  });

  it("decodes $FFFF (WAIT 511,63) as HALT", () => {
    expect(decodeCopperWord(5, 0xffff)).toEqual({ kind: "halt", index: 5, word: 0xffff });
  });

  it("decodes MOVE with the register name", () => {
    const i = decodeCopperWord(1, move(0x41, 0xfc));
    expect(i).toMatchObject({ kind: "move", reg: 0x41, value: 0xfc, regName: "Palette Value (8 bit)" });
    expect(decodeCopperWord(1, move(0x7f, 0xff))).toMatchObject({ kind: "move", reg: 0x7f, value: 0xff });
  });

  it("decodes MOVE to register 0 as NOP, keeping the ignored value", () => {
    expect(decodeCopperWord(0, 0x0000)).toEqual({ kind: "nop", index: 0, word: 0, value: 0 });
    expect(decodeCopperWord(0, 0x0012)).toEqual({ kind: "nop", index: 0, word: 0x12, value: 0x12 });
    expect(describeCopperInstruction(decodeCopperWord(0, 0x0012))).toBe("NOP (value $12 ignored)");
  });

  it("decodes the whole RAM big-endian into 1024 entries", () => {
    const list = decodeCopperList(ramOf([move(0x40, 16), wait(96, 8)]));
    expect(list).toHaveLength(1024);
    expect(list[0]).toMatchObject({ kind: "move", reg: 0x40, value: 16 });
    expect(list[1]).toMatchObject({ kind: "wait", line: 96, hpos: 8, paperX: 64 });
    expect(list[1023]).toMatchObject({ kind: "nop", index: 1023 });
  });
});

describe("Copper decoder: text", () => {
  it("formats instructions, indexes and words", () => {
    expect(formatCopperInstruction(decodeCopperWord(0, wait(120, 31)))).toBe("WAIT 120, 31");
    expect(formatCopperInstruction(decodeCopperWord(0, move(0x41, 0xfc)))).toBe("MOVE $41, $FC");
    expect(formatCopperInstruction(decodeCopperWord(0, move(0x41, 0xfc)), { hex: false })).toBe(
      "MOVE 65, 252"
    );
    expect(formatCopperInstruction(decodeCopperWord(0, wait(120, 31)), { hex: true })).toBe(
      "WAIT $078, $1F"
    );
    expect(formatCopperInstruction(decodeCopperWord(0, 0))).toBe("NOP");
    expect(formatCopperInstruction(decodeCopperWord(0, 0xffff))).toBe("HALT");
    expect(formatCopperIndex(11)).toBe("$00B");
    expect(formatCopperWord(0xbe78)).toBe("$BE78");
  });

  it("describes the meaning of each kind", () => {
    expect(describeCopperInstruction(decodeCopperWord(0, wait(120, 31)))).toBe("line 120 · x 248");
    expect(describeCopperInstruction(decodeCopperWord(0, move(0x41, 0xfc)))).toBe(
      "Palette Value (8 bit) ← $FC"
    );
    expect(describeCopperInstruction(decodeCopperWord(0, wait(400, 0)), COPPER_TIMING_50HZ)).toBe(
      "line 400 · x 0 · never matches"
    );
    expect(describeCopperInstruction(decodeCopperWord(0, 0xffff))).toMatch(/halt/);
  });

  it("decodes MOVE values through the register's slices", () => {
    // --- $62 = $C0: mode 3
    expect(describeCopperInstruction(decodeCopperWord(0, move(0x62, 0xc0)))).toContain(
      "restart the list when the raster reaches position (0,0)"
    );
  });

  it("gives palette writes a swatch", () => {
    expect(copperMoveSwatch(0x41, 0xe0)).toBe("#ff0000");
    expect(copperMoveSwatch(0x41, 0x1c)).toBe("#00ff00");
    expect(copperMoveSwatch(0x41, 0x03)).toBe("#0000ff");
    expect(copperMoveSwatch(0x44, 0x00)).toBe("#000000");
    expect(copperMoveSwatch(0x40, 0x10)).toBeUndefined();
  });

  it("classifies shapes for source matching", () => {
    expect(copperShapeOf(wait(1, 2))).toBe("W");
    expect(copperShapeOf(move(0x41, 3))).toBe("M65");
    expect(copperShapeOf(0)).toBe("N");
    expect(copperShapeOf(0xffff)).toBe("H");
  });
});

describe("Copper decoder: list analysis", () => {
  it("finds the used length, the HALT and the trailing NOPs", () => {
    const s = analyzeCopperList(
      decodeCopperList(ramOf([move(0x40, 16), move(0x41, 0), wait(96, 8), move(0x41, 0x1c), 0xffff]))
    );
    expect(s).toMatchObject({ usedLength: 5, haltIndex: 4, terminated: true, trailingNops: 1019 });
    expect(s.parks).toEqual([]);
    expect(s.orderWarnings).toEqual([]);
  });

  it("flags a list without a HALT (D15)", () => {
    const s = analyzeCopperList(decodeCopperList(ramOf([move(0x40, 16), wait(96, 8)])));
    expect(s.terminated).toBe(false);
    expect(s.haltIndex).toBeUndefined();
    expect(s.usedLength).toBe(2);
  });

  it("treats an empty RAM as an empty list", () => {
    const s = analyzeCopperList(decodeCopperList(new Uint8Array(0x800)));
    expect(s).toMatchObject({ usedLength: 0, terminated: false, trailingNops: 1024 });
  });

  it("warns about a WAIT earlier than the previous WAIT", () => {
    const s = analyzeCopperList(decodeCopperList(ramOf([wait(100, 0), wait(50, 0), wait(60, 0), 0xffff])));
    expect(s.orderWarnings).toEqual([1]);
  });

  it("flags parks by the timing in force (T5): 50 Hz vs 60 Hz", () => {
    const list = decodeCopperList(ramOf([wait(280, 0), wait(300, 55), wait(10, 56), 0xffff]));
    const at50 = analyzeCopperList(list, COPPER_TIMING_50HZ);
    // --- hpos 56 → hc 460, past the last hc_ula (455)
    expect(at50.parks).toEqual([2]);
    const at60 = analyzeCopperList(list, TIMING_60HZ);
    // --- at 60 Hz lines 280 and 300 never come
    expect(at60.parks).toEqual([0, 1, 2]);
  });

  it("does not count the HALT idiom as a park", () => {
    const s = analyzeCopperList(decodeCopperList(ramOf([wait(10, 0), 0xffff])));
    expect(s.parks).toEqual([]);
  });
});
