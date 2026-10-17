import type { NextLayerRegs, NextLayerState } from "@common/messaging/EmuApi";
import { t } from "@common/i18n/i18n";
import type { MessageKey } from "@common/i18n/keys.generated";
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
 * this only names what the registers select. Its text is translated
 * when the functions run (at render time); the layer names stay the hardware's.
 */

/** One level of the priority stack, top first */
export type StackLevel = {
  /** The layers at this level; two for the ULA/tilemap pair */
  layers: NextLayerId[];
  label: string;
  note?: string;
};

const l2PriorityNote = () => t("panels.layers.stack.l2PriorityNote");

/** The priority stack `$15` (and, for 110/111, `$68` bits 6-5) selects, top first */
export function priorityStack(regs: NextLayerRegs): StackLevel[] {
  const pair: StackLevel = {
    layers: ["tm", "ula"],
    label: regs.stencil && regs.ulaEnabled && regs.tilemapEnabled ? t("panels.layers.stack.stencil") : "Tilemap / ULA",
    note: regs.stencil && regs.ulaEnabled && regs.tilemapEnabled
      ? t("panels.layers.stack.stencilNote")
      : regs.tilemapOnTop
        ? t("panels.layers.stack.tilemapOnTop")
        : t("panels.layers.stack.tilemapPerTile")
  };
  const level = (letter: string): StackLevel =>
    letter === "S"
      ? { layers: ["spr"], label: t("panels.layers.stack.sprites") }
      : letter === "L"
        ? { layers: ["l2"], label: "Layer 2" }
        : pair;
  const p = regs.priorities & 7;
  if (p < 6) {
    const letters = PRIORITY_NAMES[p].split("");
    const levels = letters.map(level);
    // --- The Layer 2 priority bit lifts those pixels above whatever is over Layer 2
    if (letters[0] !== "L") levels.unshift({ layers: ["l2"], label: t("panels.layers.stack.l2Priority"), note: l2PriorityNote() });
    return levels;
  }
  const source = BLEND_SOURCE_NAMES[regs.blendMode & 3];
  const op = p === 6 ? t("panels.layers.stack.blendAdd") : t("panels.layers.stack.blendSub");
  return [
    { layers: ["l2"], label: t("panels.layers.stack.blendedPriority"), note: l2PriorityNote() },
    {
      layers: ["tm", "ula"],
      label: t("panels.layers.stack.pairAbove"),
      note: t("panels.layers.stack.pairAboveNote", { source })
    },
    { layers: ["spr"], label: t("panels.layers.stack.sprites") },
    { layers: ["tm", "ula"], label: t("panels.layers.stack.pairBelow") },
    { layers: ["l2"], label: t("panels.layers.stack.blended", { source }), note: op }
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

const ENABLE_TEXT: Record<NextLayerId, [MessageKey, MessageKey]> = {
  ula: ["panels.layers.enable.ula", "panels.layers.enable.ulaOff"],
  tm: ["panels.layers.enable.tm", "panels.layers.enable.tmOff"],
  l2: ["panels.layers.enable.l2", "panels.layers.enable.l2Off"],
  spr: ["panels.layers.enable.spr", "panels.layers.enable.sprOff"]
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
    const debugText =
      solo === bit
        ? t("panels.layers.debug.solo")
        : soloName
          ? t("panels.layers.debug.notShown", { layer: NEXT_LAYER_NAMES[soloName] })
          : hidden
            ? t("panels.layers.debug.hidden")
            : t("panels.layers.debug.shown");
    const opaquePixels = countOpaque(state.thumbnails?.[id]);
    const reasons: string[] = [];
    if (!enabled) reasons.push(t(ENABLE_TEXT[id][1]));
    if (clipEmpty) reasons.push(t("panels.layers.reason.clipEmpty"));
    if (enabled && opaquePixels === 0) reasons.push(t("panels.layers.reason.transparent"));
    if (hidden) reasons.push(t("panels.layers.reason.hidden"));
    if (soloName && soloName !== id) reasons.push(t("panels.layers.reason.solo", { layer: NEXT_LAYER_NAMES[soloName] }));
    if (id === "ula" && regs.loRes) reasons.push(t("panels.layers.reason.loRes"));
    return {
      id,
      name: NEXT_LAYER_NAMES[id],
      enabled,
      // --- Off is explained once, under the card's facts, not again in this row
      enableText: enabled ? t(ENABLE_TEXT[id][0]) : t("panels.layers.enable.off"),
      clip,
      clipText: clipEmpty ? t("panels.layers.clipEmpty") : t("panels.layers.clip", { x1: clip.x1, x2: clip.x2, y1: clip.y1, y2: clip.y2 }),
      clipEmpty,
      debugText,
      opaquePixels,
      reasons
    };
  });
}
