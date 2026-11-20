import { describe, expect, it } from "vitest";

import type { PaletteDeviceInfo } from "@common/messaging/EmuApi";
import {
  deviceIsWatched,
  deviceOfSlot,
  entryBreakpoint,
  entryBreakpointCommand,
  entryBreakpointSpec,
  entryDetails,
  followTarget,
  isTransparentEntry,
  lastWriteOfEntry,
  previousValue,
  slotOf,
  slotValues,
  transparentEntries,
  watchedEntries,
  writtenEntries
} from "@renderer/features/next-palette/paletteDocumentModel";

/*
 * The Palette document's view model (`dev/plans/NEXT_PALETTE_DEBUGGING_PLAN.md` §4), without
 * rendering. Slots are the `$43` bits 6-4 order: 0 ULA 1, 1 Layer 2 1, 2 sprites 1, 3 tilemap 1, 4-7
 * the second banks.
 */

const RAMP = Array.from({ length: 256 }, (_, i) => (i << 1) | (i & 2 ? 1 : 0));

/** `written` with the given entries of the given slots marked */
const written = (marks: [slot: number, index: number][]) => {
  const bytes = new Array(256).fill(0);
  for (const [slot, index] of marks) bytes[slot * 32 + (index >> 3)] |= 1 << (index & 7);
  return bytes;
};

const info = (over: Partial<PaletteDeviceInfo> = {}): PaletteDeviceInfo => ({
  ulaFirst: [...RAMP],
  ulaSecond: [...RAMP],
  layer2First: [...RAMP],
  layer2Second: [...RAMP],
  spriteFirst: [...RAMP],
  spriteSecond: [...RAMP],
  tilemapFirst: [...RAMP],
  tilemapSecond: [...RAMP],
  storedPaletteValue: 0,
  spriteTransparencyIndex: 0xe3,
  tilemapTransparencyIndex: 0x0f,
  reg43Value: 0,
  reg6bValue: 0,
  ulaNextFormat: 0,
  globalTransparency: 0xe3,
  written: new Array(256).fill(0),
  ...over
});

describe("slots", () => {
  it("maps a device's banks to the core's slots and back", () => {
    expect(slotOf("ula", 0)).toBe(0);
    expect(slotOf("sprites", 1)).toBe(6);
    expect(slotOf("tilemap", 1)).toBe(7);
    expect(deviceOfSlot(5)).toEqual({ device: "layer2", bank: 1 });
    expect(deviceOfSlot(3)).toEqual({ device: "tilemap", bank: 0 });
  });

  it("reads a slot's values", () => {
    const i = info({ spriteSecond: new Array(256).fill(0x1c0) });
    expect(slotValues(i, 6)[0]).toBe(0x1c0);
    expect(slotValues(i, 2)[3]).toBe(RAMP[3]);
    expect(slotValues(undefined, 2)).toEqual([]);
  });
});

describe("entryDetails", () => {
  it("decodes a colour into RGB333, its components and the register bytes", () => {
    // --- Red 7, green 0, blue 0: RRRGGGBBB = 111 000 000
    expect(entryDetails(0x1c0)).toMatchObject({
      rgb333: 0x1c0,
      red: 7,
      green: 0,
      blue: 0,
      nextReg41: 0xe0,
      nextReg44: [0xe0, 0x00],
      priority: false
    });
    expect(entryDetails(0x1c0).css.toLowerCase()).toMatch(/^#ff0000/);
  });

  it("puts blue's low bit and the priority bits into the $44 pair", () => {
    // --- Blue 7 (bit 0 set) with the Layer 2 priority bit (0x200) and the other one (0x400)
    expect(entryDetails(0x007 | 0x200 | 0x400)).toMatchObject({
      rgb333: 0x007,
      blue: 7,
      nextReg41: 0x03,
      nextReg44: [0x03, 0xc1],
      priority: true
    });
  });
});

describe("transparency", () => {
  it("is the index register for sprites and the tilemap", () => {
    const i = info();
    expect(isTransparentEntry(i, "sprites", 0xe3, 0)).toBe(true);
    expect(isTransparentEntry(i, "sprites", 0xe2, 0)).toBe(false);
    expect(isTransparentEntry(i, "tilemap", 0x0f, 0)).toBe(true);
  });

  it("is the colour matching $14 for the ULA and Layer 2, so several entries can match", () => {
    const i = info({ layer2First: new Array(256).fill(0x000).map((_, n) => (n < 3 ? 0xe3 << 1 : 0)) });
    expect([...transparentEntries(i, "layer2", 0)]).toEqual([0, 1, 2]);
    expect(isTransparentEntry(i, "ula", 0, 0xe3 << 1)).toBe(true);
    expect(isTransparentEntry({ ...i, globalTransparency: undefined }, "ula", 0, 0xe3 << 1)).toBe(false);
  });
});

describe("written and previous values", () => {
  it("lists the entries of a slot written since the last stop", () => {
    const i = info({ written: written([[2, 3], [2, 4], [6, 0]]) });
    expect([...writtenEntries(i, 2)]).toEqual([3, 4]);
    expect([...writtenEntries(i, 6)]).toEqual([0]);
    expect(writtenEntries(i, 0).size).toBe(0);
  });

  it("gives a written entry's value at the previous stop, and nothing for an unwritten one", () => {
    const baseline = info();
    const now = info({ spriteFirst: RAMP.map((v, n) => (n === 3 ? 0x1c0 : v)), written: written([[2, 3]]) });
    expect(previousValue(now, baseline, 2, 3)).toBe(RAMP[3]);
    expect(previousValue(now, baseline, 2, 4)).toBeUndefined();
    expect(previousValue(now, undefined, 2, 3)).toBeUndefined();
  });
});

describe("watched entries", () => {
  const bps = [
    { paletteStop: "spr1:$03" },
    { paletteStop: "spr:$02-$04", disabled: true },
    { paletteStop: "any:live" },
    { paletteStop: "l2", runTo: true },
    { exec: true, address: 0x8000 }
  ] as any[];

  it("marks each watched entry, enabled when any of its breakpoints is", () => {
    const first = watchedEntries(bps, 2);
    expect([...first.keys()].sort()).toEqual([2, 3, 4]);
    expect(first.get(3)!.enabled).toBe(true);
    expect(first.get(3)!.bps).toHaveLength(2);
    expect(first.get(2)!.enabled).toBe(false);
    // --- The second sprite bank only has the bank-less range
    expect([...watchedEntries(bps, 6).keys()]).toEqual([2, 3, 4]);
    // --- A live-bank breakpoint and a run-to target mark no entries
    expect(watchedEntries(bps, 1).size).toBe(0);
  });

  it("marks every entry for pal:any", () => {
    expect(watchedEntries([{ paletteStop: "any" }] as any, 7).size).toBe(256);
  });

  it("says whether an enabled breakpoint watches a device, a live-bank one included", () => {
    expect(deviceIsWatched(bps, "sprites")).toBe(true);
    expect(deviceIsWatched(bps, "tilemap")).toBe(true);
    expect(deviceIsWatched([{ paletteStop: "spr1", disabled: true }] as any, "sprites")).toBe(false);
    expect(deviceIsWatched([{ paletteStop: "spr1" }] as any, "ula")).toBe(false);
  });
});

describe("entry breakpoints", () => {
  it("spells the entry's spec and bp-set line", () => {
    expect(entryBreakpointSpec("sprites", 0, 3)).toBe("spr1:$03");
    expect(entryBreakpointSpec("layer2", 1, 0xaf)).toBe("l22:$af");
    expect(entryBreakpointCommand("tilemap", 0, 0x0f)).toBe("bp-set pal:TM1:$0F");
    expect(entryBreakpointCommand("ula", 1, 0x80, true)).toBe("bp-set pal:ULA2:$80 -changed");
  });

  it("finds the entry's own breakpoint, not a range covering it", () => {
    const bps = [{ paletteStop: "spr:$00-$ff" }, { paletteStop: "spr1:$03", disabled: true }] as any[];
    expect(entryBreakpoint(bps, "sprites", 0, 3)).toBe(bps[1]);
    expect(entryBreakpoint(bps, "sprites", 0, 4)).toBeUndefined();
  });
});

describe("follow", () => {
  const hit = {
    kind: "entry" as const,
    slot: 6,
    index: 0x21,
    oldValue: 0,
    newValue: 0x1c0,
    origin: "nextreg" as const,
    path: "$41" as const,
    pc: 0x8009
  };

  it("goes to the write a pal: breakpoint stopped on", () => {
    expect(followTarget(info({ written: written([[0, 1]]) }), hit)).toEqual({
      device: "sprites",
      bank: 1,
      index: 0x21
    });
  });

  it("goes to a flipped device's newly live bank", () => {
    expect(followTarget(info(), { ...hit, kind: "live", slot: 7, index: 0 })).toEqual({
      device: "tilemap",
      bank: 1,
      index: 0
    });
  });

  it("otherwise goes to the first entry written, in slot order", () => {
    expect(followTarget(info({ written: written([[5, 0x40], [1, 0x12], [1, 0x30]]) }), undefined)).toEqual({
      device: "layer2",
      bank: 0,
      index: 0x12
    });
    expect(followTarget(info(), undefined)).toBeUndefined();
  });

  it("names the last write only on the entry it wrote", () => {
    expect(lastWriteOfEntry(hit, 6, 0x21)).toBe(hit);
    expect(lastWriteOfEntry(hit, 2, 0x21)).toBeUndefined();
    expect(lastWriteOfEntry({ ...hit, kind: "live" }, 6, 0x21)).toBeUndefined();
  });
});
