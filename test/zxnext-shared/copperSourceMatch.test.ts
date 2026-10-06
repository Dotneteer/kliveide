import { describe, expect, it } from "vitest";

import type { CopperBlock } from "@common/zxnext/copper/copperBlocks";
import {
  copperIndexesOfSourceLine,
  matchCopperSource
} from "@common/zxnext/copper/copperSourceMatch";

/*
 * Shape-based matching of live Copper RAM against assembled `.copper` blocks
 * (`.plans/COPPER_DEBUGGING_PLAN.md` D8, T10).
 */

const MOVE = (reg: number, value: number) => ((reg & 0x7f) << 8) | (value & 0xff);
const WAIT = (line: number, h = 0) => 0x8000 | ((h & 0x3f) << 9) | (line & 0x1ff);
const HALT = 0xffff;
const C03 = [MOVE(0x40, 16), MOVE(0x41, 0x00), WAIT(96, 8), MOVE(0x40, 16), MOVE(0x41, 0x1c), HALT];

const ramOf = (words: number[], at = 0) => {
  const ram = new Uint8Array(0x800);
  words.forEach((w, i) => {
    ram[(at + i) * 2] = w >> 8;
    ram[(at + i) * 2 + 1] = w & 0xff;
  });
  return ram;
};

const blockOf = (words: number[], firstLine = 10, fileIndex = 0, address = 0x8000): CopperBlock => ({
  address,
  length: words.length,
  entries: words.map((word, i) => ({ word, fileIndex, line: firstLine + i }))
});

describe("Copper source matching", () => {
  it("maps a block uploaded at index 0 line by line", () => {
    const map = matchCopperSource(ramOf(C03), [blockOf(C03)]);
    expect(map.byIndex.slice(0, 6).map((m) => m?.line)).toEqual([10, 11, 12, 13, 14, 15]);
    expect(map.byIndex[6]).toBeUndefined();
    expect(map.byIndex.slice(0, 6).every((m) => !m!.patched)).toBe(true);
    expect(map.matchedPerBlock).toEqual([6]);
  });

  it("matches an upload at an offset ($61/$62 address other than 0)", () => {
    const map = matchCopperSource(ramOf(C03, 0x100), [blockOf(C03)]);
    expect(map.byIndex[0x100]).toMatchObject({ entry: 0, line: 10 });
    expect(map.byIndex[0x105]).toMatchObject({ entry: 5, line: 15 });
    expect(map.byIndex[0]).toBeUndefined();
  });

  it("marks operands the CPU patched, keeping the match", () => {
    const live = [...C03];
    live[2] = WAIT(120, 8);
    live[4] = MOVE(0x41, 0xe0);
    const map = matchCopperSource(ramOf(live), [blockOf(C03)]);
    expect(map.byIndex[2]).toMatchObject({ line: 12, patched: true, sourceWord: WAIT(96, 8) });
    expect(map.byIndex[4]).toMatchObject({ patched: true });
    expect(map.byIndex[3]).toMatchObject({ patched: false });
  });

  it("picks the better of two candidate blocks", () => {
    const other = [MOVE(0x40, 16), MOVE(0x41, 0x00), WAIT(96, 8), MOVE(0x14, 0)];
    const map = matchCopperSource(ramOf(C03), [blockOf(other, 100, 1), blockOf(C03, 10, 0)]);
    // --- C03's block matches all six; the other only the first three
    expect(map.byIndex.slice(0, 6).every((m) => m?.block === 1)).toBe(true);
    expect(map.matchedPerBlock).toEqual([0, 6]);
  });

  it("never claims a run below the minimum (T10)", () => {
    const map = matchCopperSource(ramOf([MOVE(0x40, 1), MOVE(0x41, 2)]), [
      blockOf([MOVE(0x40, 1), MOVE(0x41, 2), WAIT(5)])
    ]);
    expect(map.byIndex.every((m) => m === undefined)).toBe(true);
  });

  it("does not match a zeroed RAM against a block of NOPs", () => {
    const map = matchCopperSource(new Uint8Array(0x800), [blockOf([0, 0, 0, 0])]);
    expect(map.byIndex.every((m) => m === undefined)).toBe(true);
  });

  it("matches nothing without blocks", () => {
    expect(matchCopperSource(ramOf(C03), undefined).byIndex.every((m) => !m)).toBe(true);
  });

  it("finds the list indexes of a source line, for a source-line breakpoint (D12)", () => {
    const ram = ramOf(C03);
    C03.forEach((w, i) => {
      ram[(0x200 + i) * 2] = w >> 8;
      ram[(0x200 + i) * 2 + 1] = w & 0xff;
    });
    const map = matchCopperSource(ram, [blockOf(C03)]);
    expect(copperIndexesOfSourceLine(map, 0, 12)).toEqual([2, 0x202]);
    expect(copperIndexesOfSourceLine(map, 0, 99)).toEqual([]);
  });
});

describe("Copper source-line breakpoints (D12)", () => {
  it("recognises a .copper line, with or without a label, ignoring comments", async () => {
    const { isCopperSourceLine } = await import("@renderer/features/copper/copperSourceBreakpoints");
    expect(isCopperSourceLine("    .copper wait 96, 8")).toBe(true);
    expect(isCopperSourceLine("List: .copper move $40, 16")).toBe(true);
    expect(isCopperSourceLine("List:.copper halt")).toBe(true);
    expect(isCopperSourceLine("    ld a,b ; .copper move")).toBe(false);
    expect(isCopperSourceLine("    .savenex copper \"x.cop\"")).toBe(false);
  });

  it("finds the file and the indexes of a line", async () => {
    const { copperIndexesForSourceLine, copperSourceFileIndex } = await import(
      "@renderer/features/copper/copperSourceBreakpoints"
    );
    const files = [{ filename: "/p/code/main.kz80.asm" }, { filename: "/p/code/copper.asm" }];
    expect(copperSourceFileIndex(files, "code/copper.asm", false)).toBe(1);
    expect(copperSourceFileIndex(files, "code/none.asm", false)).toBe(-1);
    const blocks = [blockOf(C03, 10, 1)];
    expect(copperIndexesForSourceLine(ramOf(C03, 4), blocks, 1, 12)).toEqual([6]);
    expect(copperIndexesForSourceLine(new Uint8Array(0x800), blocks, 1, 12)).toEqual([]);
  });
});
