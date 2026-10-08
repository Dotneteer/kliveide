import { describe, expect, it } from "vitest";
import type { BreakpointInfo } from "@abstractions/BreakpointInfo";

import { DebugSupport } from "@emu/machines/DebugSupport";
import {
  getBreakpointAddressSpec,
  getBreakpointDisplayKey,
  getBreakpointStorageKey
} from "@common/utils/breakpoints";
import {
  isCopperBreakpoint,
  isEventBreakpoint,
  isSpriteBreakpoint,
  spriteAttrMaskOf
} from "@common/utils/breakpoint-scope";
import {
  describeSpriteStop,
  formatSpriteAttrList,
  parseSpriteAttrList
} from "@common/zxnext/sprites/spriteBreakpoints";

/*
 * The host half of sprite-attribute breakpoints (`sp:`): the key, the predicates, the definition
 * `DebugSupport` stores, the per-sprite attribute mask it hands the ZX Spectrum Next core, the
 * decision, and the stop message. See `.plans/SPRITE_ATTRIBUTE_BREAKPOINTS_PLAN.md`.
 */

const support = (...bps: BreakpointInfo[]): DebugSupport => new DebugSupport(undefined, bps);

describe("Sprite breakpoints - key and predicates", () => {
  it("is keyed by its sprite, in every form", () => {
    expect(getBreakpointStorageKey({ spriteIndex: 0x0c })).toBe("SP:$0C");
    expect(getBreakpointDisplayKey({ spriteIndex: 0x7f }, {})).toBe("SP:$7F");
    expect(getBreakpointAddressSpec({ spriteIndex: 0 }, {})).toBe("SP:$00");
  });

  it("leaves the attribute filter out of the key", () => {
    expect(getBreakpointStorageKey({ spriteIndex: 0x0c, spriteAttrMask: 0x03 })).toBe("SP:$0C");
  });

  it("puts a run-to target in its own namespace", () => {
    expect(getBreakpointStorageKey({ spriteIndex: 0x0c, runTo: true })).toBe("RT:SP:$0C");
    expect(getBreakpointAddressSpec({ spriteIndex: 0x0c, runTo: true }, {})).toBe("SP:$0C");
  });

  it("is an event breakpoint, and not a Copper one", () => {
    expect(isSpriteBreakpoint({ spriteIndex: 0 })).toBe(true);
    expect(isEventBreakpoint({ spriteIndex: 0 })).toBe(true);
    expect(isCopperBreakpoint({ spriteIndex: 0 })).toBe(false);
    expect(isSpriteBreakpoint({ copperIndex: 0 })).toBe(false);
  });

  it("watches all five bytes unless told otherwise", () => {
    expect(spriteAttrMaskOf({ spriteIndex: 1 })).toBe(0x1f);
    expect(spriteAttrMaskOf({ spriteIndex: 1, spriteAttrMask: 0 })).toBe(0x1f);
    expect(spriteAttrMaskOf({ spriteIndex: 1, spriteAttrMask: 0x05 })).toBe(0x05);
  });
});

describe("Sprite breakpoints - the attribute list", () => {
  it.each([
    ["0", 0x01],
    ["0,2", 0x05],
    ["0-3", 0x0f],
    ["1, 3-4", 0x1a],
    ["0-4", 0x1f]
  ])("parses %s", (text, mask) => {
    expect(parseSpriteAttrList(text)).toBe(mask);
  });

  it.each(["", "5", "a", "3-1", "0,,1", "-1"])("refuses %j", (text) => {
    expect(parseSpriteAttrList(text)).toBeUndefined();
  });

  it("formats with ranges collapsed, and round-trips", () => {
    expect(formatSpriteAttrList(0x01)).toBe("0");
    expect(formatSpriteAttrList(0x05)).toBe("0,2");
    expect(formatSpriteAttrList(0x03)).toBe("0,1");
    expect(formatSpriteAttrList(0x0f)).toBe("0-3");
    expect(formatSpriteAttrList(0x1a)).toBe("1,3,4");
    expect(formatSpriteAttrList(0x1d)).toBe("0,2-4");
    for (let mask = 1; mask < 0x20; mask++) {
      expect(parseSpriteAttrList(formatSpriteAttrList(mask))).toBe(mask);
    }
  });
});

describe("Sprite breakpoints - the definition", () => {
  it("is not stored as an execution breakpoint, and keeps its sprite and filter", () => {
    const d = support({ spriteIndex: 0x0c, spriteAttrMask: 0x03, exec: true });
    const [bp] = d.breakpoints;
    expect(bp.exec).toBe(false);
    expect(bp.spriteIndex).toBe(0x0c);
    expect(bp.spriteAttrMask).toBe(0x03);
  });

  it("arms no address flag", () => {
    expect(support({ spriteIndex: 0 }).breakpointFlags.every((f) => f === 0)).toBe(true);
  });

  it("is reported by hasSpriteBreakpoints only while enabled", () => {
    expect(support().hasSpriteBreakpoints()).toBe(false);
    expect(support({ copperIndex: 7 }).hasSpriteBreakpoints()).toBe(false);
    expect(support({ spriteIndex: 1 }).hasSpriteBreakpoints()).toBe(true);
    expect(support({ spriteIndex: 1, disabled: true }).hasSpriteBreakpoints()).toBe(false);
  });
});

describe("Sprite breakpoints - the watch table", () => {
  it("holds each enabled sprite's attribute mask", () => {
    const d = support(
      { spriteIndex: 0 },
      { spriteIndex: 0x0c, spriteAttrMask: 0x05 },
      { spriteIndex: 0x7f, spriteAttrMask: 0x10 },
      { spriteIndex: 5, disabled: true }
    );
    const table = d.buildSpriteWatch();
    expect(table).toHaveLength(128);
    expect(table[0]).toBe(0x1f);
    expect(table[0x0c]).toBe(0x05);
    expect(table[0x7f]).toBe(0x10);
    expect(table[5]).toBe(0);
    expect(table.filter((b) => b !== 0)).toHaveLength(3);
  });

  it("is rebuilt from the current definitions on every call", () => {
    const d = support({ spriteIndex: 7 });
    expect(d.buildSpriteWatch()[7]).toBe(0x1f);
    d.removeBreakpoint({ spriteIndex: 7 });
    expect(d.buildSpriteWatch()[7]).toBe(0);
  });
});

describe("Sprite breakpoints - the decision", () => {
  it("stops only for the watched sprite and attribute bytes", () => {
    const d = support({ spriteIndex: 2, spriteAttrMask: 0x02 });
    expect(d.hasSpriteHit(2, 1, 0x40)).toBe(true);
    expect(d.hasSpriteHit(2, 0, 0x40)).toBe(false);
    expect(d.hasSpriteHit(3, 1, 0x40)).toBe(false);
  });

  it("counts hits (-hit 2)", () => {
    const d = support({ spriteIndex: 2, hitCount: 2, hitMode: "eq" });
    expect([d.hasSpriteHit(2, 0, 0), d.hasSpriteHit(2, 0, 0), d.hasSpriteHit(2, 0, 0)]).toEqual([
      false,
      true,
      false
    ]);
  });

  it("ignores a disabled breakpoint", () => {
    expect(support({ spriteIndex: 2, disabled: true }).hasSpriteHit(2, 0, 0)).toBe(false);
  });
});

describe("Sprite breakpoints - the stop message", () => {
  it("names the sprite, the byte, the change and who wrote it", () => {
    expect(
      describeSpriteStop(
        { sprite: 12, attribute: 2, oldValue: 0, newValue: 0x41, origin: "port", pc: 0x8012, partition: 0 },
        { 0: "R0" }
      )
    ).toBe(
      "Sprite breakpoint: sprite $0C attr 2 (palette, mirror, rotate, X8) $00 -> $41 through port $57, written at $8012 in R0"
    );
    expect(
      describeSpriteStop({ sprite: 20, attribute: 3, oldValue: 0, newValue: 0xc0, origin: "copper", pc: 0x8003 })
    ).toBe("Sprite breakpoint: sprite $14 attr 3 (visible, pattern) $00 -> $C0 by the Copper, with the CPU at $8003");
    expect(
      describeSpriteStop({ sprite: 1, attribute: 0, oldValue: 1, newValue: 2, origin: "dma", pc: 0x8000 })
    ).toMatch(/by the DMA, with the CPU at \$8000$/);
    expect(
      describeSpriteStop({ sprite: 1, attribute: 0, oldValue: 1, newValue: 2, origin: "nextreg", pc: 0x8000 })
    ).toMatch(/through a NextReg mirror, written at \$8000$/);
  });
});
