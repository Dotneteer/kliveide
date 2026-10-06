import { describe, expect, it } from "vitest";

import { decodeResolvedSprites, decodeSpriteSlots } from "@common/zxnext/sprites/spriteAttributes";
import { patternUsage, slotFormatAsUsed, slotUsers } from "@common/zxnext/sprites/spriteUsage";

// --- Sprites as [visible, fourBit, pattern7, paletteOffset]
function usageOf(sprites: [boolean, boolean, number, number][]) {
  const attrs = new Uint8Array(640);
  const buf = new Uint8Array(128 * 8);
  sprites.forEach(([visible, fourBit, pattern7, pal], i) => {
    attrs[i * 5 + 3] = 0x01; // --- not an all-zero slot
    buf.set([(visible ? 1 : 0) | (fourBit ? 0x10 : 0), 0, 0, 0, 0, pal, 0, pattern7], i * 8);
  });
  return patternUsage(decodeSpriteSlots(attrs), decodeResolvedSprites(buf));
}

describe("patternUsage", () => {
  it("indexes users per 256-byte slot and format, skipping all-zero slots", () => {
    const u = usageOf([
      [true, false, 80, 0],
      [false, true, 81, 0],
      [true, true, 6, 0]
    ]);
    expect(u[40].users8).toEqual([0]);
    expect(u[40].users4).toEqual([1]);
    expect(u[40].visibleUsers).toEqual([0]);
    expect(u[40].mixed).toBe(true);
    expect(u[3].users4).toEqual([2]);
    expect(u[3].mixed).toBe(false);
    // --- The other 125 slots are all zero and reference nothing
    expect(u[0].users8).toEqual([]);
    expect(slotUsers(u[40])).toEqual([0, 1]);
  });

  it("takes 'From sprite' from the first visible user", () => {
    const u = usageOf([
      [false, false, 4, 7],
      [true, false, 4, 3],
      [true, false, 4, 9]
    ]);
    expect(u[2].firstPaletteOffset).toBe(3);
    expect(usageOf([[false, false, 4, 7]])[2].firstPaletteOffset).toBe(7);
  });

  it("draws a slot As used, with the fallback for an unused one (D17)", () => {
    const u = usageOf([[true, true, 6, 0]]);
    expect(slotFormatAsUsed(u[3], "8bit")).toBe("4bit");
    expect(slotFormatAsUsed(u[5], "8bit")).toBe("8bit");
    expect(slotFormatAsUsed(u[5], "4bit")).toBe("4bit");
  });
});
