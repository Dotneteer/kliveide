/*
 * Who uses which pattern (`.plans/SPRITE_INSPECTOR_PLAN.md` §4.5.2). Pure.
 *
 * Pattern RAM is 64 slots of 256 bytes. An 8-bit sprite reads a whole slot; a 4-bit sprite reads one
 * 128-byte half of it (`pattern7 & 1` picks the high half). The Patterns view draws each slot the way
 * its users read it (*As used*), and flags a slot read both ways - almost always a bug.
 */

import type { DecodedSpriteSlot, ResolvedSprite } from "./spriteAttributes";
import { patternSlotOf } from "./spriteAttributes";
import type { NexSpriteFormat } from "./spritePatterns";

export const PATTERN_SLOT_COUNT = 64;

export type PatternSlotUsage = {
  /** The 256-byte slot, `0..63` */
  slot: number;
  /** Sprites reading it as one 8-bit pattern */
  users8: number[];
  /** Sprites reading one of its 4-bit halves */
  users4: number[];
  /** The users whose effective visible flag is set */
  visibleUsers: number[];
  /** Read both as 8-bit and as 4-bit */
  mixed: boolean;
  /** The palette offset of the first visible user (or the first user), for *From sprite* */
  firstPaletteOffset?: number;
};

const isEmptySlot = (slot: DecodedSpriteSlot | undefined) => !slot || slot.raw.every((b) => b === 0);

/**
 * The usage of each of the 64 slots. A sprite counts as a user when its attribute slot is not all
 * zero: an unused slot "references" pattern 0 only by accident.
 */
export function patternUsage(slots: DecodedSpriteSlot[], resolved: ResolvedSprite[]): PatternSlotUsage[] {
  const usage: PatternSlotUsage[] = Array.from({ length: PATTERN_SLOT_COUNT }, (_, slot) => ({
    slot,
    users8: [],
    users4: [],
    visibleUsers: [],
    mixed: false
  }));
  for (const sprite of resolved) {
    if (isEmptySlot(slots[sprite.index])) continue;
    const u = usage[patternSlotOf(sprite)];
    (sprite.fourBit ? u.users4 : u.users8).push(sprite.index);
    if (sprite.visible) {
      u.visibleUsers.push(sprite.index);
      // --- The first visible user wins over any invisible one before it
      if (u.visibleUsers.length === 1) u.firstPaletteOffset = sprite.paletteOffset;
    } else if (u.users8.length + u.users4.length === 1) {
      u.firstPaletteOffset = sprite.paletteOffset;
    }
  }
  for (const u of usage) u.mixed = u.users8.length > 0 && u.users4.length > 0;
  return usage;
}

/** All users of a slot, in index order. */
export function slotUsers(u: PatternSlotUsage): number[] {
  return [...u.users8, ...u.users4].sort((a, b) => a - b);
}

/**
 * The format *As used* draws a slot in (D17): the way its users read it, the fallback when it has
 * none, and 8-bit when it is mixed (the warning corner says the rest).
 */
export function slotFormatAsUsed(u: PatternSlotUsage, fallback: NexSpriteFormat): NexSpriteFormat {
  if (u.users8.length > 0) return "8bit";
  if (u.users4.length > 0) return "4bit";
  return fallback;
}
