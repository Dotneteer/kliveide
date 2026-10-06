import type { NextLayerRegs, NextLayerState } from "@common/messaging/EmuApi";
import {
  NEXT_LAYER_BITS,
  NEXT_LAYER_NAMES,
  PRIORITY_NAMES,
  BLEND_SOURCE_NAMES,
  type NextLayerId,
  type NextLayerViewState
} from "@common/zxnext/layers/layerMix";
import {
  layer2ClipWindow,
  spriteClipWindow,
  tilemapClipWindow,
  ulaClipWindow,
  type LayerRect
} from "@common/zxnext/video/clipWindows";

/*
 * The Layers document's model (`.plans/LAYER_COMPOSITION_PLAN.md` D9): the priority stack for the
 * current `$15` and blend mode, and one card per layer with the reasons it might not be on the
 * screen. Pure: tested without the emulator. The mixer itself is never re-implemented here (D10);
 * this only names what the registers select.
 */

/** One level of the priority stack, top first */
export type StackLevel = {
  /** The layers at this level; two for the ULA/tilemap pair */
  layers: NextLayerId[];
  label: string;
  note?: string;
};

const L2_PRIORITY_NOTE = "only Layer 2 pixels whose palette entry has the priority bit";

/** The priority stack `$15` (and, for 110/111, `$68` bits 6-5) selects, top first */
export function priorityStack(regs: NextLayerRegs): StackLevel[] {
  const pair: StackLevel = {
    layers: ["tm", "ula"],
    label: regs.stencil && regs.ulaEnabled && regs.tilemapEnabled ? "ULA AND tilemap (stencil)" : "Tilemap / ULA",
    note: regs.stencil && regs.ulaEnabled && regs.tilemapEnabled
      ? "$68 bit 0: a pixel shows only where both are opaque, in the AND of their colours"
      : regs.tilemapOnTop
        ? "$6B bit 0: the tilemap is above the ULA everywhere"
        : "the tilemap is above the ULA except where a tile's attribute puts it below"
  };
  const level = (letter: string): StackLevel =>
    letter === "S"
      ? { layers: ["spr"], label: "Sprites" }
      : letter === "L"
        ? { layers: ["l2"], label: "Layer 2" }
        : pair;
  const p = regs.priorities & 7;
  if (p < 6) {
    const letters = PRIORITY_NAMES[p].split("");
    const levels = letters.map(level);
    // --- The Layer 2 priority bit lifts those pixels above whatever is over Layer 2
    if (letters[0] !== "L") levels.unshift({ layers: ["l2"], label: "Layer 2 priority pixels", note: L2_PRIORITY_NOTE });
    return levels;
  }
  const source = BLEND_SOURCE_NAMES[regs.blendMode & 3];
  const op = p === 6 ? "Layer 2 + source, each channel up to 7" : "Layer 2 + source - 5 per channel";
  return [
    { layers: ["l2"], label: "Blended priority pixels", note: L2_PRIORITY_NOTE },
    { layers: ["tm", "ula"], label: "Tilemap / ULA above", note: `the part of the pair not used as the blend source (${source})` },
    { layers: ["spr"], label: "Sprites" },
    { layers: ["tm", "ula"], label: "Tilemap / ULA below" },
    { layers: ["l2"], label: `Layer 2 blended with the ${source}`, note: op }
  ];
}

export type LayerCard = {
  id: NextLayerId;
  name: string;
  /** The program has the layer on */
  enabled: boolean;
  enableText: string;
  /** The effective clip window in layer space (320 x 256, paper at (32, 32)) */
  clip: LayerRect;
  clipText: string;
  clipEmpty: boolean;
  /** "shown", "hidden", "solo" or "not shown: X is solo" */
  debugText: string;
  /** Opaque pixels in the layer's thumbnail, when there is one */
  opaquePixels?: number;
  /** Why the layer may not be visible; empty when nothing obvious stops it */
  reasons: string[];
};

const ENABLE_TEXT: Record<NextLayerId, [string, string]> = {
  ula: ["On ($68 bit 7 clear)", "$68 bit 7 hides the ULA (the blend modes still read it)"],
  tm: ["On ($6B bit 7)", "Off: $6B bit 7 is clear"],
  l2: ["On ($123B bit 1 / $69 bit 7)", "Off: $123B bit 1 and $69 bit 7 are clear"],
  spr: ["On ($15 bit 0)", "Off: $15 bit 0 is clear"]
};

export function effectiveClip(regs: NextLayerRegs, id: NextLayerId): LayerRect {
  switch (id) {
    case "ula":
      return ulaClipWindow(regs.ulaClip);
    case "tm":
      return tilemapClipWindow(regs.tilemapClip);
    case "l2":
      return layer2ClipWindow(regs.layer2Clip, regs.layer2Resolution !== 0);
    case "spr":
      return spriteClipWindow(regs.spriteClip, regs.spritesOverBorder, regs.spritesClipping);
  }
}

/** Opaque (alpha > 0) pixels of an RGBA image */
export function countOpaque(rgba: Uint8ClampedArray | undefined): number | undefined {
  if (!rgba) return undefined;
  let n = 0;
  for (let i = 3; i < rgba.length; i += 4) if (rgba[i] !== 0) n++;
  return n;
}

const enabledOf = (regs: NextLayerRegs, id: NextLayerId) =>
  id === "ula" ? regs.ulaEnabled : id === "tm" ? regs.tilemapEnabled : id === "l2" ? regs.layer2Enabled : regs.spritesEnabled;

/** One card per layer, in mask-bit order (ULA, tilemap, Layer 2, sprites) */
export function layerCards(state: NextLayerState, view: NextLayerViewState | undefined): LayerCard[] {
  const regs = state.regs;
  const ids: NextLayerId[] = ["ula", "tm", "l2", "spr"];
  return ids.map((id) => {
    const enabled = enabledOf(regs, id);
    const clip = effectiveClip(regs, id);
    const clipEmpty = clip.x1 > clip.x2 || clip.y1 > clip.y2;
    const bit = NEXT_LAYER_BITS[id];
    const solo = view?.solo ?? 0;
    const hidden = ((view?.hidden ?? 0) & bit) !== 0;
    const soloName = solo ? (Object.keys(NEXT_LAYER_BITS) as NextLayerId[]).find((k) => NEXT_LAYER_BITS[k] === solo) : undefined;
    const debugText = solo === bit ? "solo" : soloName ? `not shown: ${NEXT_LAYER_NAMES[soloName]} is solo` : hidden ? "hidden" : "shown";
    const opaquePixels = countOpaque(state.thumbnails?.[id]);
    const reasons: string[] = [];
    if (!enabled) reasons.push(ENABLE_TEXT[id][1]);
    if (clipEmpty) reasons.push("Its clip window is empty");
    if (enabled && opaquePixels === 0) reasons.push("Every pixel is transparent (or clipped)");
    if (hidden) reasons.push("Hidden by the debug view (not by the program)");
    if (soloName && soloName !== id) reasons.push(`${NEXT_LAYER_NAMES[soloName]} is shown alone`);
    if (id === "ula" && regs.loRes) reasons.push("LoRes takes the ULA's place ($15 bit 7)");
    return {
      id,
      name: NEXT_LAYER_NAMES[id],
      enabled,
      // --- Off is explained once, under the card's facts, not again in this row
      enableText: enabled ? ENABLE_TEXT[id][0] : "Off",
      clip,
      clipText: clipEmpty ? "empty" : `x ${clip.x1}-${clip.x2}, y ${clip.y1}-${clip.y2}`,
      clipEmpty,
      debugText,
      opaquePixels,
      reasons
    };
  });
}
