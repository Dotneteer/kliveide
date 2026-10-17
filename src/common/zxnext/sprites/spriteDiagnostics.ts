/*
 * "Why can't I see sprite N?" - one short reason per slot (`.plans/SPRITE_INSPECTOR_PLAN.md` §4.1).
 * The Sprites table shows the first one as a chip, the inspector as a sentence. Pure.
 */

import type { DecodedSpriteSlot, ResolvedSprite } from "./spriteAttributes";
import { findAnchor, patternSlotOf } from "./spriteAttributes";
import { clippedFraction, isOnScreen, spriteRect, type SpriteSpaceRect } from "./spriteGeometry";
import { NEX_SPRITE_TRANSPARENT, isBlankPattern, patternPixels } from "./spritePatterns";
import type { MessageArgs } from "@common/i18n/i18n";
import type { MessageKey } from "@common/i18n/keys.generated";
import { withTranslatedTexts } from "../translatedTexts";

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
  /** The chip text, in the current language on each read */
  readonly chip: string;
  /** The inspector's sentence, in the current language on each read */
  readonly sentence: string;
};

/** The chip and sentence keys of each code */
const TEXT_KEYS: Record<SpriteDiagnosticCode, { chip: MessageKey; sentence: MessageKey }> = {
  visibleBitClear: { chip: "gfxCommon.sprite.diag.visibleBitClear.chip", sentence: "gfxCommon.sprite.diag.visibleBitClear.sentence" },
  anchorHidden: { chip: "gfxCommon.sprite.diag.anchorHidden.chip", sentence: "gfxCommon.sprite.diag.anchorHidden.sentence" },
  noAnchor: { chip: "gfxCommon.sprite.diag.noAnchor.chip", sentence: "gfxCommon.sprite.diag.noAnchor.sentence" },
  spritesDisabled: { chip: "gfxCommon.sprite.diag.spritesDisabled.chip", sentence: "gfxCommon.sprite.diag.spritesDisabled.sentence" },
  offScreen: { chip: "gfxCommon.sprite.diag.offScreen.chip", sentence: "gfxCommon.sprite.diag.offScreen.sentence" },
  outsideClip: { chip: "gfxCommon.sprite.diag.outsideClip.chip", sentence: "gfxCommon.sprite.diag.outsideClip.sentence" },
  partlyClipped: { chip: "gfxCommon.sprite.diag.partlyClipped.chip", sentence: "gfxCommon.sprite.diag.partlyClipped.sentence" },
  patternTransparent: { chip: "gfxCommon.sprite.diag.patternTransparent.chip", sentence: "gfxCommon.sprite.diag.patternTransparent.sentence" },
  patternBlank: { chip: "gfxCommon.sprite.diag.patternBlank.chip", sentence: "gfxCommon.sprite.diag.patternBlank.sentence" },
  staleAttr4: { chip: "gfxCommon.sprite.diag.staleAttr4.chip", sentence: "gfxCommon.sprite.diag.staleAttr4.sentence" }
};

/** A diagnostic whose texts translate on each read */
function diagnostic(
  code: SpriteDiagnosticCode,
  level: SpriteDiagnosticLevel,
  args?: MessageArgs
): SpriteDiagnostic {
  return withTranslatedTexts(
    { code, level },
    {
      chip: { key: TEXT_KEYS[code].chip, args },
      sentence: { key: TEXT_KEYS[code].sentence, args }
    }
  );
}

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
    out.push(diagnostic("visibleBitClear", "hidden"));
  } else if (slot.kind === "relative" && resolved && !resolved.visible) {
    const anchor = findAnchor(ctx.slots, index);
    out.push(
      anchor === undefined
        ? diagnostic("noAnchor", "hidden")
        : diagnostic("anchorHidden", "hidden", { anchor: String(anchor) })
    );
  }

  const visible = resolved?.visible ?? false;
  if (visible && !ctx.spritesEnabled) {
    out.push(diagnostic("spritesDisabled", "hidden"));
  }

  if (visible && resolved) {
    const rect = spriteRect(resolved);
    if (!isOnScreen(rect)) {
      // --- Coordinates are copy-pasteable values: invariant, not locale-formatted
      out.push(diagnostic("offScreen", "hidden", { x: String(rect.x1), y: String(rect.y1) }));
    } else {
      const fraction = clippedFraction(rect, ctx.clip);
      if (fraction >= 1) {
        out.push(diagnostic("outsideClip", "hidden"));
      } else if (fraction > 0) {
        out.push(diagnostic("partlyClipped", "warning", { fraction: Math.round(fraction * 100) / 100 }));
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
            ? diagnostic("patternTransparent", "warning")
            : diagnostic("patternBlank", "warning")
        );
      }
    }
  }

  if (slot.staleAttr4Matters) {
    out.push(
      diagnostic("staleAttr4", "info", {
        value: `$${slot.raw[4].toString(16).toUpperCase().padStart(2, "0")}`
      })
    );
  }
  return out;
}
