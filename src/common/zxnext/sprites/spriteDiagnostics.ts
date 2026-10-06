/*
 * "Why can't I see sprite N?" - one short reason per slot (`.plans/SPRITE_INSPECTOR_PLAN.md` §4.1).
 * The Sprites table shows the first one as a chip, the inspector as a sentence. Pure.
 */

import type { DecodedSpriteSlot, ResolvedSprite } from "./spriteAttributes";
import { findAnchor, patternSlotOf } from "./spriteAttributes";
import { clippedFraction, isOnScreen, spriteRect, type SpriteSpaceRect } from "./spriteGeometry";
import { NEX_SPRITE_TRANSPARENT, isBlankPattern, patternPixels } from "./spritePatterns";

export type SpriteDiagnosticCode =
  | "visibleBitClear"
  | "anchorHidden"
  | "noAnchor"
  | "spritesDisabled"
  | "offScreen"
  | "outsideClip"
  | "partlyClipped"
  | "patternTransparent"
  | "patternBlank"
  | "staleAttr4";

/**
 * - `hidden`: the sprite is not drawn, by the program's own settings
 * - `warning`: drawn, but the user is unlikely to see what they expect
 * - `info`: worth knowing, changes nothing (D13)
 */
export type SpriteDiagnosticLevel = "hidden" | "warning" | "info";

export type SpriteDiagnostic = {
  code: SpriteDiagnosticCode;
  level: SpriteDiagnosticLevel;
  /** The chip text */
  chip: string;
  /** The inspector's sentence */
  sentence: string;
};

export type SpriteDiagnosticContext = {
  slots: DecodedSpriteSlot[];
  resolved: ResolvedSprite[];
  /** `$15` bit 0 */
  spritesEnabled: boolean;
  /** The effective clip window in sprite space (`effectiveClipWindow`) */
  clip: SpriteSpaceRect;
  /** The raw 16K pattern RAM; omit it to skip the pattern checks */
  patterns?: ArrayLike<number>;
  /** `$4B` */
  transparencyIndex: number;
};

const isEmptySlot = (slot: DecodedSpriteSlot) => slot.raw.every((b) => b === 0);

/**
 * Every reason that applies to slot `index`, the most decisive first. An all-zero slot gets none:
 * it is simply unused, and a chip on it would be noise.
 */
export function spriteDiagnostics(index: number, ctx: SpriteDiagnosticContext): SpriteDiagnostic[] {
  const slot = ctx.slots[index];
  const resolved = ctx.resolved[index];
  if (!slot || isEmptySlot(slot)) return [];
  const out: SpriteDiagnostic[] = [];

  if (!slot.visibleBit) {
    out.push({
      code: "visibleBitClear",
      level: "hidden",
      chip: "hidden: visible bit clear",
      sentence: "Hidden: its visible bit (attr3 bit 7) is clear."
    });
  } else if (slot.kind === "relative" && resolved && !resolved.visible) {
    const anchor = findAnchor(ctx.slots, index);
    out.push(
      anchor === undefined
        ? {
            code: "noAnchor",
            level: "hidden",
            chip: "hidden: no anchor",
            sentence:
              "Hidden: this relative sprite has no anchor before it, so it composes onto an invisible, all-zero anchor."
          }
        : {
            code: "anchorHidden",
            level: "hidden",
            chip: `hidden: anchor #${anchor} not visible`,
            sentence: `Hidden: its anchor, sprite #${anchor}, is not visible.`
          }
    );
  }

  const visible = resolved?.visible ?? false;
  if (visible && !ctx.spritesEnabled) {
    out.push({
      code: "spritesDisabled",
      level: "hidden",
      chip: "sprites disabled ($15 bit 0)",
      sentence: "Hidden: the sprite layer is off (NextReg $15 bit 0 is clear)."
    });
  }

  if (visible && resolved) {
    const rect = spriteRect(resolved);
    if (!isOnScreen(rect)) {
      out.push({
        code: "offScreen",
        level: "hidden",
        chip: "off screen",
        sentence: `Hidden: it is at (${rect.x1}, ${rect.y1}), outside the 320×256 sprite space.`
      });
    } else {
      const fraction = clippedFraction(rect, ctx.clip);
      if (fraction >= 1) {
        out.push({
          code: "outsideClip",
          level: "hidden",
          chip: "outside clip window",
          sentence: "Hidden: it lies entirely outside the sprite clip window."
        });
      } else if (fraction > 0) {
        out.push({
          code: "partlyClipped",
          level: "warning",
          chip: "partly clipped",
          sentence: `Partly clipped: ${Math.round(fraction * 100)}% of it is outside the clip window or the screen.`
        });
      }
    }

    if (ctx.patterns) {
      const pixels = patternPixels(ctx.patterns, resolved.fourBit ? resolved.pattern7 : patternSlotOf(resolved), {
        format: resolved.fourBit ? "4bit" : "8bit",
        offset: 0,
        paletteOffset: resolved.paletteOffset,
        transparencyIndex: ctx.transparencyIndex
      });
      if (isBlankPattern(pixels)) {
        out.push(
          pixels[0] === NEX_SPRITE_TRANSPARENT
            ? {
                code: "patternTransparent",
                level: "warning",
                chip: "pattern is all transparent",
                sentence: "Its pattern is entirely the transparency colour ($4B), so nothing is drawn."
              }
            : {
                code: "patternBlank",
                level: "warning",
                chip: "pattern is blank",
                sentence: "Its pattern is a single solid colour."
              }
        );
      }
    }
  }

  if (slot.staleAttr4Matters) {
    out.push({
      code: "staleAttr4",
      level: "info",
      chip: "4-byte: attr4 ignored",
      sentence: `A 4-byte sprite: its stored attr4 ($${slot.raw[4]
        .toString(16)
        .toUpperCase()
        .padStart(2, "0")}) is left over from an earlier upload and ignored. It would change this sprite if attr3 bit 6 were set.`
    });
  }
  return out;
}
