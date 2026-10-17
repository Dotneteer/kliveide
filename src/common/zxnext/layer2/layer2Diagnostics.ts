/*
 * Layer 2 diagnostics (`.plans/LAYER2_INSPECTOR_PLAN.md` §4.1, T1, T5, T6). Pure: one-line states for
 * the globals strip, each with a sentence for its tooltip.
 */
import { isOutsideRam, LAYER2_NO_PIXEL, layer2Size, writeTarget, type Layer2Regs } from "./layer2Decode";
import { clipOnLayer, readsPastLayer } from "./layer2Geometry";
import type { MessageArgs } from "@common/i18n/i18n";
import type { MessageKey } from "@common/i18n/keys.generated";
import { withTranslatedTexts } from "../translatedTexts";

export type Layer2DiagnosticLevel = "warning" | "info";

export type Layer2Diagnostic = {
  level: Layer2DiagnosticLevel;
  /** Stable key */
  id: string;
  /** The chip's text, in the current language on each read */
  readonly chip: string;
  /** One sentence for the tooltip and the inspector, in the current language on each read */
  readonly sentence: string;
};

/**
 * A diagnostic with translated texts. `chip` is a key, or fixed text for a chip that is only
 * register names (`$12 = $13`).
 */
function diagnostic(
  id: string,
  level: Layer2DiagnosticLevel,
  chip: MessageKey | { text: string },
  sentence: MessageKey,
  args?: MessageArgs
): Layer2Diagnostic {
  if (typeof chip === "string") {
    return withTranslatedTexts({ id, level }, { chip: { key: chip, args }, sentence: { key: sentence, args } });
  }
  return withTranslatedTexts({ id, level, chip: chip.text }, { sentence: { key: sentence, args } });
}


export type Layer2DiagnosticInput = {
  regs: Layer2Regs;
  /**
   * The displayed layer as it reaches the mixer (`displayedImage`), with the palette's transparency
   * test; both or neither (without a palette the transparency check is skipped)
   */
  displayed?: Int16Array;
  isTransparent?: (index: number) => boolean;
};

/** The 16K banks a set starting at `base` spans at this resolution. */
export function setBanks(base: number, resolution: number): number[] {
  return Array.from({ length: layer2Size(resolution).banks }, (_, i) => base + i);
}

export function layer2Diagnostics({ regs, displayed, isTransparent }: Layer2DiagnosticInput): Layer2Diagnostic[] {
  const out: Layer2Diagnostic[] = [];
  const target = writeTarget(regs);
  const shown = setBanks(regs.activeBank, regs.resolution);

  if (!regs.enabled) {
    out.push(diagnostic("off", "info", "gfxCommon.layer2.diag.off.chip", "gfxCommon.layer2.diag.off.sentence"));
  }

  const past = shown.filter(isOutsideRam);
  if (past.length) {
    out.push(
      diagnostic("outsideRam", "warning", "gfxCommon.layer2.diag.outsideRam.chip", "gfxCommon.layer2.diag.outsideRam.sentence", {
        count: past.length,
        banks: past.join(", ")
      })
    );
  }

  if (target.mappedForWrites) {
    const writes = target.slices.map((s) => s.bank16);
    if (writes.some((b) => shown.includes(b))) {
      out.push(diagnostic("writesShown", "info", "gfxCommon.layer2.diag.writesShown.chip", "gfxCommon.layer2.diag.writesShown.sentence"));
    } else if (target.useShadow) {
      out.push(diagnostic("writesShadow", "info", "gfxCommon.layer2.diag.writesShadow.chip", "gfxCommon.layer2.diag.writesShadow.sentence"));
    }
    if (target.slices.some((s) => s.outsideRam)) {
      out.push(diagnostic("writesPastRam", "warning", "gfxCommon.layer2.diag.writesPastRam.chip", "gfxCommon.layer2.diag.writesPastRam.sentence"));
    }
  }

  if (regs.activeBank === regs.shadowBank) {
    out.push(diagnostic("sameBanks", "info", { text: "$12 = $13" }, "gfxCommon.layer2.diag.sameBanks.sentence"));
  }

  if (readsPastLayer(regs)) {
    out.push(
      diagnostic(
        "readsPastLayer",
        "warning",
        "gfxCommon.layer2.diag.readsPastLayer.chip",
        layer2Size(regs.resolution).wide ? "gfxCommon.layer2.diag.readsPastLayer.wideSentence" : "gfxCommon.layer2.diag.readsPastLayer.tallSentence"
      )
    );
  }

  if (!clipOnLayer(regs)) {
    out.push(diagnostic("clipEmpty", "warning", "gfxCommon.layer2.diag.clipEmpty.chip", "gfxCommon.layer2.diag.clipEmpty.sentence"));
  } else if (regs.enabled && displayed && isTransparent) {
    let any = false;
    let opaque = false;
    for (const index of displayed) {
      if (index === LAYER2_NO_PIXEL) continue;
      any = true;
      if (!isTransparent(index)) {
        opaque = true;
        break;
      }
    }
    if (any && !opaque) {
      out.push(diagnostic("allTransparent", "warning", "gfxCommon.layer2.diag.allTransparent.chip", "gfxCommon.layer2.diag.allTransparent.sentence"));
    }
  }
  return out;
}
