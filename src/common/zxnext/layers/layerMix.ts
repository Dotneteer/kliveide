/*
 * The ZX Spectrum Next layer mixer as the IDE describes it (`.plans/LAYER_COMPOSITION_PLAN.md`).
 *
 * Pure: names, orders and decoders only. The mixer itself is never re-implemented here (D10) - the
 * core's `zxnextComposePixel` (`zxnext-ula.c`) composes the picture and computes the "why" of every
 * pixel; this module only gives its numbers names. The constants mirror that file's
 * `ZXNEXT_LAYER_BIT_*`, `ZXNEXT_WHY_*`, `ZXNEXT_RECOMPOSE_*` and `zxnextMixParamsPack`.
 */

/** The four layers, in the order of their mask bits */
export type NextLayerId = "ula" | "tm" | "l2" | "spr";

export const NEXT_LAYER_IDS: readonly NextLayerId[] = ["ula", "tm", "l2", "spr"];

/** `ZXNEXT_LAYER_BIT_*` */
export const NEXT_LAYER_BITS: Record<NextLayerId, number> = { ula: 0x01, tm: 0x02, l2: 0x04, spr: 0x08 };

export const NEXT_LAYER_NAMES: Record<NextLayerId, string> = {
  ula: "ULA",
  tm: "Tilemap",
  l2: "Layer 2",
  spr: "Sprites"
};

/** The short names the pill and the command use */
export const NEXT_LAYER_SHORT_NAMES: Record<NextLayerId, string> = {
  ula: "ULA",
  tm: "tilemap",
  l2: "Layer 2",
  spr: "sprites"
};

/**
 * The layer debug view: debugging state, never machine state (D2). The emulator applies it to the
 * machine's mixer; the strip, the menu and the `layers` command all change this one value (D4).
 */
export type NextLayerDebug = {
  /** Hidden layers, `NEXT_LAYER_BITS` */
  hidden: number;
  /** 0, or the bit of the one layer shown alone (D5) */
  solo: number;
  /** Where no layer is opaque, paint the flag colour instead of the fallback `$4A` (D5) */
  showTransparent: boolean;
};

export const NO_LAYER_DEBUG: NextLayerDebug = { hidden: 0, solo: 0, showTransparent: false };

/** The layer view as the app state holds it: the debug view and what the emulator window shows */
export type NextLayerViewState = NextLayerDebug & {
  /** Draw the four effective clip windows on the screen (D8) */
  showClips?: boolean;
  /** The pixel probe is on (D7) */
  probe?: boolean;
  /** The `$layers` document is open: it needs the capture too (Q5) */
  documentOpen?: boolean;
};

/** True when the debug view changes the picture (and the D3 pill must say so) */
export function isLayerDebugActive(d: NextLayerDebug | undefined): boolean {
  return !!d && ((d.hidden & 0x0f) !== 0 || (d.solo & 0x0f) !== 0 || d.showTransparent);
}

export function layerIdsOf(bits: number): NextLayerId[] {
  return NEXT_LAYER_IDS.filter((id) => (bits & NEXT_LAYER_BITS[id]) !== 0);
}

/** One layer's bit, or 0 */
export function layerBit(id: NextLayerId | undefined): number {
  return id ? NEXT_LAYER_BITS[id] : 0;
}

/** The lowest set layer bit as an id */
export function soloLayerId(solo: number): NextLayerId | undefined {
  return NEXT_LAYER_IDS.find((id) => (solo & NEXT_LAYER_BITS[id]) !== 0);
}

/**
 * The D3 pill's text, or undefined when the picture is the machine's own: "Layers: sprites hidden",
 * "Layers: Layer 2 solo", "Layers: ULA, tilemap hidden; transparency shown".
 */
export function describeLayerDebug(d: NextLayerDebug | undefined): string | undefined {
  if (!isLayerDebugActive(d)) return undefined;
  const parts: string[] = [];
  const solo = soloLayerId(d!.solo);
  if (solo) {
    parts.push(`${NEXT_LAYER_SHORT_NAMES[solo]} solo`);
  } else if (d!.hidden & 0x0f) {
    parts.push(`${layerIdsOf(d!.hidden).map((id) => NEXT_LAYER_SHORT_NAMES[id]).join(", ")} hidden`);
  }
  if (d!.showTransparent) parts.push("transparency shown");
  return `Layers: ${parts.join("; ")}`;
}

// ─── The mixer's inputs ──────────────────────────────────────────────────────────────────────

/** `ZxnextMixParams`: what the mixer reads once per span, not per pixel */
export type MixParams = {
  /** `$4A` as 9-bit RGB */
  fallbackRgb: number;
  /** `$15` bits 4-2 */
  priorities: number;
  ulaEnabled: boolean;
  tilemapEnabled: boolean;
  layer2Enabled: boolean;
  spritesEnabled: boolean;
  /** `$68` bit 0, in force only with the ULA and the tilemap both enabled */
  stencil: boolean;
  /** `$68` bits 6-5 */
  blendMode: number;
  /** Not `$6B` bit 0: a disabled tilemap's "below" */
  tilemapBelowWhenOff: boolean;
};

/** `zxnextMixParamsPack` reversed */
export function unpackMixParams(v: number): MixParams {
  return {
    fallbackRgb: v & 0x1ff,
    priorities: (v >> 9) & 7,
    ulaEnabled: ((v >> 12) & 1) !== 0,
    tilemapEnabled: ((v >> 13) & 1) !== 0,
    layer2Enabled: ((v >> 14) & 1) !== 0,
    spritesEnabled: ((v >> 15) & 1) !== 0,
    stencil: ((v >> 16) & 1) !== 0,
    blendMode: (v >> 17) & 3,
    tilemapBelowWhenOff: ((v >> 19) & 1) !== 0
  };
}

/** `$15` bits 4-2 as the Next documentation names them */
export const PRIORITY_NAMES = ["SLU", "LSU", "SUL", "LUS", "USL", "ULS", "Blend (add)", "Blend (add - 5)"];

/**
 * The layers top to bottom for a `$15` priority mode, for the strip's chips. U is the ULA/tilemap
 * pair, combined first (the tilemap above or below the ULA per cell), so its two chips stay together
 * with the tilemap first. The blend modes put Layer 2 + U as one blended layer under the sprites;
 * the chips then read S, L, T, U.
 */
export function layerStackOrder(priorities: number): NextLayerId[] {
  const letter: Record<string, NextLayerId[]> = { S: ["spr"], L: ["l2"], U: ["tm", "ula"] };
  const name = PRIORITY_NAMES[priorities & 7];
  if ((priorities & 7) >= 6) return ["spr", "l2", "tm", "ula"];
  return name.split("").flatMap((c) => letter[c]);
}

/** The blend source `$68` bits 6-5 selects (zxnext.vhd `ula_blend_mode`) */
export const BLEND_SOURCE_NAMES = ["ULA", "none", "ULA + tilemap", "tilemap"];

/** "Blend (add): Layer 2 + ULA" for 110/111, undefined otherwise */
export function describeBlend(priorities: number, blendMode: number): string | undefined {
  if ((priorities & 7) < 6) return undefined;
  const source = BLEND_SOURCE_NAMES[blendMode & 3];
  return `${PRIORITY_NAMES[priorities & 7]}: Layer 2 + ${source}`;
}

// ─── Why a pixel shows what it shows (D7, T5) ────────────────────────────────────────────────

export const WHY_FALLBACK = 0;
export const WHY_ULA = 1;
export const WHY_TM = 2;
export const WHY_L2 = 3;
export const WHY_L2_PRIORITY = 4;
export const WHY_SPR = 5;
export const WHY_BORDER = 6;
export const WHY_STENCIL = 7;
export const WHY_BLEND_ADD = 8;
export const WHY_BLEND_SUB = 9;

/** The rule behind each `ZXNEXT_WHY_*`, as the probe says it */
export const WHY_TEXT = [
  "fallback $4A: no layer is opaque here",
  "ULA: the top opaque layer in this order",
  "tilemap: the top opaque layer in this order",
  "Layer 2: the top opaque layer in this order",
  "Layer 2 priority bit: Layer 2 over every other layer",
  "sprites: the top opaque layer in this order",
  "sprite over the border: a sprite shows over the ULA border where the tilemap is transparent",
  "stencil: ULA AND tilemap ($68 bit 0)",
  "blend: Layer 2 + the blend source, saturated ($15 110)",
  "blend: Layer 2 + the blend source - 5 ($15 111)"
];

/** The layer a `why` names, if it names one */
export function whyLayer(why: number): NextLayerId | undefined {
  switch (why) {
    case WHY_ULA:
      return "ula";
    case WHY_TM:
      return "tm";
    case WHY_L2:
    case WHY_L2_PRIORITY:
    case WHY_BLEND_ADD:
    case WHY_BLEND_SUB:
      return "l2";
    case WHY_SPR:
    case WHY_BORDER:
      return "spr";
    default:
      return undefined;
  }
}

// ─── Layer values (the core's `ZXNEXT_PX_*` encoding) ────────────────────────────────────────

export const PX_RGB = 0x01ff;
export const PX_L2_PRIORITY = 0x0200;
export const PX_TM_BELOW = 0x0400;
export const PX_BORDER = 0x0800;
export const PX_OPAQUE = 0x8000;

/** One layer's value at a pixel, as the probe reports it */
export type LayerPixel = {
  /** Opaque: the layer has a colour here */
  opaque: boolean;
  /** 9-bit RGB, when opaque */
  rgb: number;
  /** Layer 2: the palette entry's priority bit */
  priority?: boolean;
  /** Tilemap: the tile's "below the ULA" bit */
  below?: boolean;
  /** ULA: the pixel is border */
  border?: boolean;
  /** Tilemap, Layer 2, sprites: the layer is disabled, so the mixer ignores it */
  disabled?: boolean;
};

export function decodeLayerPixel(id: NextLayerId, v: number, p: MixParams): LayerPixel {
  const disabled =
    id === "tm" ? !p.tilemapEnabled : id === "l2" ? !p.layer2Enabled : id === "spr" ? !p.spritesEnabled : false;
  const opaque = !disabled && (v & PX_OPAQUE) !== 0;
  const out: LayerPixel = { opaque, rgb: opaque ? v & PX_RGB : 0 };
  if (disabled) out.disabled = true;
  if (id === "l2" && opaque) out.priority = (v & PX_L2_PRIORITY) !== 0;
  if (id === "tm" && !disabled) out.below = (v & PX_TM_BELOW) !== 0;
  if (id === "ula" && opaque) out.border = (v & PX_BORDER) !== 0;
  return out;
}

// ─── The recompose and the probe ─────────────────────────────────────────────────────────────

/** `ZXNEXT_RECOMPOSE_*` */
export type RecomposeStatus = {
  /** Every pixel was recomposed with the mixer inputs of its own span */
  exact: boolean;
  /** Capture was on: the layer pixels are the ones each span drew */
  captured: boolean;
  /** A span table ran out of room (T7) */
  overflow: boolean;
};

export function decodeRecomposeStatus(v: number): RecomposeStatus {
  return { exact: (v & 1) !== 0, captured: (v & 2) !== 0, overflow: (v & 4) !== 0 };
}

/** What the probe found at one buffer pixel (D7) */
export type NextPixelProbe = {
  /** Buffer coordinates */
  x: number;
  y: number;
  layers: Record<NextLayerId, LayerPixel>;
  /** The mixer inputs in force for this pixel */
  params: MixParams;
  /** With the debug mask applied: the winner and its colour */
  why: number;
  rgb: number;
  /** What the machine itself shows */
  machineWhy: number;
  machineRgb: number;
  status: RecomposeStatus;
  /** The buffer pixel the pixel's span started at */
  spanStart: number;
  /** Drawn this frame (before the beam) rather than last frame */
  thisFrame: boolean;
};

/** Decodes the core's 12-word probe result (`zxnextLayerProbe`) */
export function decodeProbe(x: number, y: number, w: ArrayLike<number>): NextPixelProbe {
  const params = unpackMixParams(w[4]);
  return {
    x,
    y,
    layers: {
      ula: decodeLayerPixel("ula", w[0], params),
      tm: decodeLayerPixel("tm", w[1], params),
      l2: decodeLayerPixel("l2", w[2], params),
      spr: decodeLayerPixel("spr", w[3], params)
    },
    params,
    why: w[5],
    rgb: w[6] & PX_RGB,
    machineWhy: w[7],
    machineRgb: w[8] & PX_RGB,
    status: decodeRecomposeStatus(w[9]),
    spanStart: w[10] >>> 0,
    thisFrame: w[11] !== 0
  };
}

/** `#RRGGBB` of a 9-bit colour, with the core's 3-to-8-bit levels */
const LEVELS = [0x00, 0x24, 0x49, 0x6d, 0x92, 0xb6, 0xdb, 0xff];
export function rgb333Css(rgb: number): string {
  const h = (v: number) => LEVELS[v & 7].toString(16).padStart(2, "0");
  return `#${h(rgb >> 6)}${h(rgb >> 3)}${h(rgb)}`;
}

/** The 9-bit colour as hex text: `$1C7` */
export function rgb333Hex(rgb: number): string {
  return `$${(rgb & 0x1ff).toString(16).toUpperCase().padStart(3, "0")}`;
}
