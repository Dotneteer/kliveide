/*
 * Layer 2 diagnostics (`.plans/LAYER2_INSPECTOR_PLAN.md` §4.1, T1, T5, T6). Pure: one-line states for
 * the globals strip, each with a sentence for its tooltip.
 */
import { isOutsideRam, LAYER2_NO_PIXEL, layer2Size, writeTarget, type Layer2Regs } from "./layer2Decode";
import { clipOnLayer, readsPastLayer } from "./layer2Geometry";

export type Layer2DiagnosticLevel = "warning" | "info";

export type Layer2Diagnostic = {
  level: Layer2DiagnosticLevel;
  /** Stable key */
  id: string;
  /** The chip's text */
  chip: string;
  /** One sentence for the tooltip and the inspector */
  sentence: string;
};

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
    out.push({
      id: "off",
      level: "info",
      chip: "Layer 2 off",
      sentence: "Layer 2 is not displayed: $123B bit 1 and $69 bit 7 are both clear."
    });
  }

  const past = shown.filter(isOutsideRam);
  if (past.length) {
    out.push({
      id: "outsideRam",
      level: "warning",
      chip: "banks past 2 MB",
      sentence: `Bank${past.length > 1 ? "s" : ""} ${past.join(", ")} ${past.length > 1 ? "are" : "is"} past the 2 MB SRAM: the display has no pixels there.`
    });
  }

  if (target.mappedForWrites) {
    const writes = target.slices.map((s) => s.bank16);
    if (writes.some((b) => shown.includes(b))) {
      out.push({
        id: "writesShown",
        level: "info",
        chip: "writes go to the displayed bank",
        sentence:
          "The $123B write window maps banks of the displayed layer ($12): drawing shows at once (no double buffering, a tearing risk)."
      });
    } else if (target.useShadow) {
      out.push({
        id: "writesShadow",
        level: "info",
        chip: "write window maps the shadow bank",
        sentence: "$123B bit 3 maps the shadow layer ($13) into the write window: writes there are not displayed until $12 points at it."
      });
    }
    if (target.slices.some((s) => s.outsideRam)) {
      out.push({
        id: "writesPastRam",
        level: "warning",
        chip: "write window past 2 MB",
        sentence: "The $123B write window maps a bank past the 2 MB SRAM: writes through it are lost."
      });
    }
  }

  if (regs.activeBank === regs.shadowBank) {
    out.push({
      id: "sameBanks",
      level: "info",
      chip: "$12 = $13",
      sentence: "The displayed and the shadow layer are the same banks."
    });
  }

  if (readsPastLayer(regs)) {
    out.push({
      id: "readsPastLayer",
      level: "warning",
      chip: "scroll reads past the layer",
      sentence: layer2Size(regs.resolution).wide
        ? "The X scroll makes the display read source columns 320-511, which come from the three banks after the layer's five (the hardware's X wrap is not a modulo of 320)."
        : "The Y scroll makes the display read source rows 192-254, which come from the bank after the layer's three (the hardware folds rows back by bits 7-6, not modulo 192)."
    });
  }

  if (!clipOnLayer(regs)) {
    out.push({
      id: "clipEmpty",
      level: "warning",
      chip: "clip window empty",
      sentence: "The $18 clip window leaves no pixel of the layer: x1 > x2 or y1 > y2, or it is off the layer."
    });
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
      out.push({
        id: "allTransparent",
        level: "warning",
        chip: "all visible pixels transparent",
        sentence: "Every visible pixel's palette colour equals the global transparency colour $14, so nothing of Layer 2 shows."
      });
    }
  }
  return out;
}
