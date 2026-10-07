import type { NextLayerRegs } from "@common/messaging/EmuApi";
import {
  describeBlend,
  isLayerDebugActive,
  layerStackOrder,
  NEXT_LAYER_BITS,
  NEXT_LAYER_IDS,
  NEXT_LAYER_NAMES,
  PRIORITY_NAMES,
  soloLayerId,
  type NextLayerId,
  type NextLayerViewState
} from "./layerMix";

/*
 * The layer debug view's model (`.plans/LAYER_COMPOSITION_PLAN.md` §4.5): what the Layers strip, the
 * Machine menu's Layers submenu and the `layers` command do to the one shared state (D4), and what
 * the strip shows. Pure, so it is tested without the emulator.
 */

export const EMPTY_LAYER_VIEW: NextLayerViewState = { hidden: 0, solo: 0, showTransparent: false };

/** Hides or shows one layer. Hiding a layer that is soloed ends the solo. */
export function toggleHidden(view: NextLayerViewState, id: NextLayerId): NextLayerViewState {
  const bit = NEXT_LAYER_BITS[id];
  const hidden = view.hidden ^ bit;
  return { ...view, hidden, solo: hidden & bit ? view.solo & ~bit : view.solo };
}

/** Shows one layer alone, or ends its solo. */
export function toggleSolo(view: NextLayerViewState, id: NextLayerId): NextLayerViewState {
  const bit = NEXT_LAYER_BITS[id];
  return { ...view, solo: view.solo === bit ? 0 : bit };
}

/** Every layer shown, no solo, no transparency marking; the overlays are left as they are. */
export function resetLayers(view: NextLayerViewState): NextLayerViewState {
  return { ...view, hidden: 0, solo: 0, showTransparent: false };
}

/**
 * The strip's close button: back to the composite picture - every layer shown, no solo, no
 * transparency marking - with the clip outlines and the probe off, since nothing on the screen would
 * show they are still on once the strip is gone. The Layers document's flag stays as it is.
 */
export function closeLayerView(view: NextLayerViewState): NextLayerViewState {
  return { ...resetLayers(view), showClips: false, probe: false };
}

// ─── The `layers` command ────────────────────────────────────────────────────────────────────

export type LayersTarget = NextLayerId | "all" | "transparency";
export type LayersAction = "on" | "off" | "solo";

const TARGET_ALIASES: Record<string, LayersTarget> = {
  ula: "ula",
  u: "ula",
  tm: "tm",
  t: "tm",
  tilemap: "tm",
  l2: "l2",
  l: "l2",
  layer2: "l2",
  spr: "spr",
  s: "spr",
  sprites: "spr",
  all: "all",
  transparency: "transparency",
  tr: "transparency"
};

export type LayersCommand = { target?: LayersTarget; action?: LayersAction };

/**
 * `layers [ula|tm|l2|spr|all|transparency] [on|off|solo]`. With no action a layer target means
 * "toggle"; `all` without an action means "all on". Returns an error text for anything else.
 */
export function parseLayersCommand(target?: string, action?: string): LayersCommand | string {
  if (target === undefined) return {};
  const t = TARGET_ALIASES[target.toLowerCase()];
  if (!t) return `Unknown layer '${target}': use ula, tm, l2, spr, all or transparency`;
  if (action === undefined) return { target: t };
  const a = action.toLowerCase();
  if (a !== "on" && a !== "off" && a !== "solo") return `Unknown action '${action}': use on, off or solo`;
  if (a === "solo" && (t === "all" || t === "transparency")) return `'${target}' cannot be soloed`;
  return { target: t, action: a };
}

export function applyLayersCommand(view: NextLayerViewState, cmd: LayersCommand): NextLayerViewState {
  const { target, action } = cmd;
  if (!target) return view;
  if (target === "transparency") {
    return { ...view, showTransparent: action === undefined ? !view.showTransparent : action === "on" };
  }
  if (target === "all") {
    if (action === "off") return { ...view, hidden: 0x0f, solo: 0 };
    return { ...view, hidden: 0, solo: 0 };
  }
  const bit = NEXT_LAYER_BITS[target];
  switch (action) {
    case undefined:
      return toggleHidden(view, target);
    case "solo":
      return { ...view, solo: bit, hidden: view.hidden & ~bit };
    case "on":
      return { ...view, hidden: view.hidden & ~bit };
    case "off":
      return { ...view, hidden: view.hidden | bit, solo: view.solo === bit ? 0 : view.solo };
  }
}

/** One line per layer, for the command's output: "Sprites: hidden" */
export function describeLayerView(view: NextLayerViewState | undefined): string[] {
  const v = view ?? EMPTY_LAYER_VIEW;
  const solo = soloLayerId(v.solo);
  const lines = NEXT_LAYER_IDS.map((id) => {
    const state = solo === id ? "solo" : solo ? "not shown (another layer is solo)" : v.hidden & NEXT_LAYER_BITS[id] ? "hidden" : "shown";
    return `${NEXT_LAYER_NAMES[id]}: ${state}`;
  });
  lines.push(`Transparency: ${v.showTransparent ? "shown in magenta" : "not marked"}`);
  return lines;
}

// ─── The strip ───────────────────────────────────────────────────────────────────────────────

export type LayerChip = {
  id: NextLayerId;
  name: string;
  hidden: boolean;
  solo: boolean;
  /** Another layer is solo, so this one is not on the screen */
  eclipsed: boolean;
  /** The program has this layer switched off - why it may show nothing even when not hidden */
  disabledByProgram: boolean;
};

const programEnabled = (regs: NextLayerRegs | undefined, id: NextLayerId): boolean => {
  if (!regs) return true;
  switch (id) {
    case "ula":
      return regs.ulaEnabled;
    case "tm":
      return regs.tilemapEnabled;
    case "l2":
      return regs.layer2Enabled;
    case "spr":
      return regs.spritesEnabled;
  }
};

/** The chips in the priority order `$15` selects now, top layer first (§4.5) */
export function layerChips(regs: NextLayerRegs | undefined, view: NextLayerViewState | undefined): LayerChip[] {
  const v = view ?? EMPTY_LAYER_VIEW;
  const order = regs ? layerStackOrder(regs.priorities) : (["spr", "l2", "tm", "ula"] as NextLayerId[]);
  return order.map((id) => ({
    id,
    name: NEXT_LAYER_NAMES[id],
    hidden: (v.hidden & NEXT_LAYER_BITS[id]) !== 0,
    solo: v.solo === NEXT_LAYER_BITS[id],
    eclipsed: v.solo !== 0 && v.solo !== NEXT_LAYER_BITS[id],
    disabledByProgram: !programEnabled(regs, id)
  }));
}

/** "SLU" or "Blend (add): Layer 2 + ULA", the strip's priority readout */
export function priorityReadout(regs: NextLayerRegs | undefined): string | undefined {
  if (!regs) return undefined;
  return describeBlend(regs.priorities, regs.blendMode) ?? PRIORITY_NAMES[regs.priorities & 7];
}

/**
 * Capture costs frame time, so it runs only while something needs it (T6, Q5): the strip, the probe,
 * the Layers document, or a debug view that a paused toggle must recompose exactly.
 */
export function wantsLayerCapture(view: NextLayerViewState | undefined, stripShown: boolean): boolean {
  return stripShown || !!view?.probe || !!view?.documentOpen || isLayerDebugActive(view);
}
