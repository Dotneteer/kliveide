import { describe, expect, it } from "vitest";

import type { CopperState } from "@common/messaging/EmuApi";
import {
  buildCopperModel,
  copperListRows,
  copperModeText,
  copperModeTooltip,
  copperNopsText,
  copperRowOf,
  copperRuler,
  copperStateText,
  copperSummaryText,
  copperWarnings,
  copperWindow,
  copperWindowStart,
  rulerTickAt,
  rulerY
} from "@renderer/features/copper/copperViewModel";

const MOVE = (reg: number, value: number) => ((reg & 0x7f) << 8) | (value & 0xff);
const WAIT = (line: number, h = 0) => 0x8000 | ((h & 0x3f) << 9) | (line & 0x1ff);
const HALT = 0xffff;
const C03 = [MOVE(0x40, 16), MOVE(0x41, 0x00), WAIT(96, 8), MOVE(0x40, 16), MOVE(0x41, 0x1c), HALT];

const ramOf = (words: number[]) => {
  const ram = new Uint8Array(0x800);
  words.forEach((w, i) => {
    ram[i * 2] = w >> 8;
    ram[i * 2 + 1] = w & 0xff;
  });
  return ram;
};

const stateOf = (words: number[], over: Partial<CopperState> = {}): CopperState => ({
  ram: ramOf(words),
  startMode: 3,
  pc: 0,
  writeAddress: words.length * 2,
  lineOffset: 0,
  beam: { line: 10, hc: 0, waiting: false },
  timing: { lines: 311, hcs: 456, upperBorder: 48 },
  ...over
});

describe("Copper view model - mode and state", () => {
  it("names the modes and explains them from the $62 descriptor", () => {
    expect(copperModeText(3)).toBe("11 · loop, restart at (0,0)");
    expect(copperModeText(0)).toBe("00 · stopped");
    expect(copperModeTooltip(3)).toMatch(/restart the list when the raster reaches position \(0,0\)/);
  });

  it("says Stopped, and that a stopped list is retained (T9)", () => {
    expect(copperStateText(buildCopperModel(stateOf([], { startMode: 0 })))).toBe("Stopped");
    expect(copperStateText(buildCopperModel(stateOf(C03, { startMode: 0 })))).toBe(
      "Stopped · list retained"
    );
  });

  it("says Waiting, Halted or Running", () => {
    expect(
      copperStateText(buildCopperModel(stateOf(C03, { pc: 2, beam: { line: 40, hc: 0, waiting: true } })))
    ).toBe("Waiting for line 96, x 64");
    expect(
      copperStateText(buildCopperModel(stateOf(C03, { pc: 5, beam: { line: 200, hc: 0, waiting: true } })))
    ).toBe("Halted at $005");
    expect(copperStateText(buildCopperModel(stateOf(C03, { pc: 1 })))).toBe("Running");
  });

  it("says a WAIT that cannot match is a park", () => {
    expect(
      copperStateText(
        buildCopperModel(stateOf([WAIT(400, 0), HALT], { pc: 0, beam: { line: 4, hc: 0, waiting: true } }))
      )
    ).toBe("Parked at $000 (never matches)");
  });

  it("summarises the list", () => {
    expect(copperSummaryText(buildCopperModel(stateOf(C03)).summary)).toBe("6 used · HALT at $005 · 1018 NOP");
    expect(copperSummaryText(buildCopperModel(stateOf([MOVE(0x40, 1)])).summary)).toBe(
      "1 used · no HALT · 1023 NOP"
    );
    expect(copperSummaryText(buildCopperModel(stateOf([])).summary)).toBe("empty");
  });

  it("warns about a missing HALT, parks and out-of-order WAITs", () => {
    expect(copperWarnings(buildCopperModel(stateOf(C03)).summary)).toEqual([]);
    const w = copperWarnings(buildCopperModel(stateOf([WAIT(100), WAIT(50), WAIT(400)])).summary);
    expect(w).toHaveLength(3);
    expect(w[0]).toMatch(/does not end in a HALT/);
    expect(w[1]).toMatch(/\$002 never matches/);
    expect(w[2]).toMatch(/\$001 waits for an earlier line/);
  });
});

describe("Copper view model - window and rows", () => {
  it("centres a 7-row window on the PC, clamped to the list", () => {
    expect(copperWindowStart(0)).toBe(0);
    expect(copperWindowStart(10)).toBe(7);
    expect(copperWindowStart(0x3ff)).toBe(0x3ff - 6);
    const win = copperWindow(buildCopperModel(stateOf(C03, { pc: 4 })));
    expect(win.map((i) => i.index)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("collapses the trailing NOPs into one row", () => {
    const model = buildCopperModel(stateOf(C03));
    const rows = copperListRows(model, false);
    expect(rows).toHaveLength(7);
    expect(rows[6]).toEqual({ kind: "nops", from: 6, count: 1018 });
    expect(copperNopsText(6, 1018)).toBe("1018 × NOP ($006–$3FF)");
    expect(copperListRows(model, true)).toHaveLength(1024);
  });

  it("expands the run when the PC or a hit is inside it", () => {
    const model = buildCopperModel(stateOf(C03));
    expect(copperListRows(model, false, [40])).toHaveLength(1024);
    expect(copperListRows(model, false, [undefined, 3])).toHaveLength(7);
  });

  it("finds the row of an index, the collapsed row included", () => {
    const rows = copperListRows(buildCopperModel(stateOf(C03)), false);
    expect(copperRowOf(rows, 2)).toBe(2);
    expect(copperRowOf(rows, 500)).toBe(6);
  });
});

describe("Copper view model - the raster ruler", () => {
  it("shades paper, lower border and blanking, and the upper border in cvc order (T4)", () => {
    const ruler = copperRuler(buildCopperModel(stateOf(C03)));
    expect(ruler.lines).toBe(311);
    expect(ruler.zones).toEqual([
      { kind: "paper", from: 0, to: 192 },
      { kind: "lower", from: 192, to: 263 },
      { kind: "upper", from: 263, to: 311 }
    ]);
  });

  it("follows a 60 Hz frame", () => {
    const ruler = copperRuler(
      buildCopperModel(stateOf(C03, { timing: { lines: 264, hcs: 456, upperBorder: 24 } }))
    );
    expect(ruler.zones.at(-1)).toEqual({ kind: "upper", from: 240, to: 264 });
  });

  it("ticks every WAIT before the HALT, flagging parks, and marks beam and hit", () => {
    const model = buildCopperModel(stateOf([WAIT(96, 8), WAIT(400), HALT, WAIT(10)]));
    const ruler = copperRuler(model, {
      index: 0,
      kind: "wait",
      word: WAIT(96, 8),
      line: 96,
      hc: 76,
      pc: 0x8000
    });
    expect(ruler.ticks).toEqual([
      { index: 0, line: 96, matches: true },
      { index: 1, line: 400, matches: false }
    ]);
    expect(ruler.beamLine).toBe(10);
    expect(ruler.hitLine).toBe(96);
  });

  it("maps lines to pixels and finds the tick under the pointer", () => {
    expect(rulerY(0, 311, 311)).toBe(0);
    expect(rulerY(155, 310, 620)).toBe(310);
    expect(rulerY(500, 311, 311)).toBe(310);
    const ruler = copperRuler(buildCopperModel(stateOf(C03)));
    const y = rulerY(96, 311, 311);
    expect(rulerTickAt(ruler, y + 2, 311)?.index).toBe(2);
    expect(rulerTickAt(ruler, y + 10, 311)).toBeUndefined();
  });
});
