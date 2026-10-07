/*
 * A transcription of the layer mixer - `_input/next-fpga/src/zxnext.vhd` "VIDEO PIPELINE STAGE 2"
 * (~7040-7300) - for one pixel. Colours are 9-bit RRRGGGBBB; every "transparent" input is the stage-2
 * signal of the same name. Used by compositing.test.ts; read that file for how the inputs are made.
 */

export type MixerConfig = {
  /** $15 bits 4-2 (layer_priorities). */
  order: number;
  /** $68 bits 6-5 (ula_blend_mode). */
  blend: number;
  /** $68 bit 0 (ula_stencil_mode). */
  stencil: boolean;
  /** Not $68 bit 7 (ula_en). */
  ulaEn: boolean;
  /** $6B bit 7 (tm_en). */
  tmEn: boolean;
  /** $6B bit 0 (tilemap always on top). */
  tmOnTop: boolean;
  /** $15 bit 0 (sprites shown). */
  spritesEn: boolean;
  /** $14. */
  transparent: number;
  /** $4A. */
  fallback: number;
  /**
   * The IDE's layer debug mask (`.plans/LAYER_COMPOSITION_PLAN.md` D1): bit 0 ULA, 1 tilemap,
   * 2 Layer 2, 3 sprites. A hidden layer's pixels are transparent; nothing else changes - a hidden
   * tile keeps its "below" bit and stencil mode stays on (T4). Not hardware: the IDE's own view.
   */
  hidden?: number;
};

export type MixerPixel = {
  /** The ULA (or LoRes) palette colour, and whether the pixel is border. */
  ula: number;
  ulaBorder: boolean;
  /** Tilemap: the palette colour, pixel_en (nibble != $4C), and the tile's below bit (attr bit 0). */
  tm: number;
  tmPixelEn: boolean;
  tmAttrBelow: boolean;
  /** Sprite: colour and whether a sprite pixel is there. */
  sprite: number;
  spritePixelEn: boolean;
  /** Layer 2: colour, palette priority bit, pixel_en (inside the clip window). */
  layer2: number;
  layer2PriorityBit: boolean;
  layer2PixelEn: boolean;
};

/** The 9-bit colour an 8-bit register colour ($4A) stands for. */
export const expand8 = (v: number) => ((v << 1) | ((v & 3) !== 0 ? 1 : 0)) & 0x1ff;

/** The 9-bit colour the mixer outputs for one pixel. */
export function mixPixel(c: MixerConfig, p: MixerPixel): number {
  return mixPixelExplained(c, p).rgb;
}

/**
 * Which rule chose a pixel's colour - the IDE's pixel probe vocabulary
 * (`.plans/LAYER_COMPOSITION_PLAN.md` D7, `src/common/zxnext/layers/layerMix.ts` `WHY_*`): the layer
 * the priority case took, with the ULA/tilemap pair named by its source (ULA, tilemap or stencil),
 * a sprite that won over an opaque ULA border pixel as "border", and a blended Layer 2 by its mode.
 */
export type MixWhy =
  | "fallback"
  | "ula"
  | "tm"
  | "l2"
  | "l2-priority"
  | "spr"
  | "border"
  | "stencil"
  | "blend-add"
  | "blend-sub";

/** The 9-bit colour and the rule that chose it. */
export function mixPixelExplained(c: MixerConfig, p: MixerPixel): { rgb: number; why: MixWhy } {
  const T = c.transparent & 0xff;
  const hide = c.hidden ?? 0;

  // --- ULA (~7046-7050); the clip window is left open by the tests, the border is never clipped
  const ulaMixTransparent = p.ula >> 1 === T || (hide & 1) !== 0;
  const ulaMixRgb = ulaMixTransparent ? 0 : p.ula;
  const ulaTransparent = ulaMixTransparent || !c.ulaEn;
  const ulaRgb = ulaTransparent ? 0 : p.ula;

  // --- tilemap (~7055, text mode not used); below (~6809): the tile's bit when enabled, else not $6B bit 0
  const tmTransparent = !p.tmPixelEn || !c.tmEn || (hide & 2) !== 0;
  const tmRgb = tmTransparent ? 0 : p.tm;
  const tmBelow = c.tmEn ? p.tmAttrBelow && !c.tmOnTop : !c.tmOnTop;

  // --- stencil / merge (~7058-7063)
  const stencilTransparent = ulaTransparent || tmTransparent;
  const stencilRgb = stencilTransparent ? 0 : ulaRgb & tmRgb;
  const ulatmTransparent = ulaTransparent && tmTransparent;
  const ulatmRgb = !tmTransparent && (!tmBelow || ulaTransparent) ? tmRgb : ulaRgb;

  // --- sprites (~7065, ~6880) and Layer 2 (~7067-7069)
  const spriteTransparent = !(p.spritePixelEn && c.spritesEn) || (hide & 8) !== 0;
  const spriteRgb = spriteTransparent ? 0 : p.sprite;
  const layer2Transparent = p.layer2 >> 1 === T || !p.layer2PixelEn || (hide & 4) !== 0;
  const layer2Rgb = layer2Transparent ? 0 : p.layer2;
  const layer2Priority = layer2Transparent ? false : p.layer2PriorityBit;

  // --- ula_final (~7071-7082)
  const stencilOn = c.stencil && c.ulaEn && c.tmEn;
  const ulaFinalRgb = stencilOn ? stencilRgb : ulatmRgb;
  const ulaFinalTransparent = stencilOn ? stencilTransparent : ulatmTransparent;

  // --- blend operand and the layers around it (~7084-7121)
  let mixRgb: number, mixRgbTransparent: boolean;
  let topT: boolean, topRgb: number, botT: boolean, botRgb: number;
  switch (c.blend & 3) {
    case 0:
      [mixRgb, mixRgbTransparent] = [ulaMixRgb, ulaMixTransparent];
      [topT, topRgb, botT, botRgb] = [tmTransparent || tmBelow, tmRgb, tmTransparent || !tmBelow, tmRgb];
      break;
    case 2:
      [mixRgb, mixRgbTransparent] = [ulaFinalRgb, ulaFinalTransparent];
      [topT, topRgb, botT, botRgb] = [true, tmRgb, true, tmRgb];
      break;
    case 3:
      [mixRgb, mixRgbTransparent] = [tmRgb, tmTransparent];
      [topT, topRgb, botT, botRgb] = [ulaTransparent || !tmBelow, ulaRgb, ulaTransparent || tmBelow, ulaRgb];
      break;
    default:
      [mixRgb, mixRgbTransparent] = [0, true];
      [topT, topRgb, botT, botRgb] = tmBelow
        ? [ulaTransparent, ulaRgb, tmTransparent, tmRgb]
        : [tmTransparent, tmRgb, ulaTransparent, ulaRgb];
  }

  // --- the priority case (~7141-7295)
  const borderException = p.ulaBorder && tmTransparent && !spriteTransparent;
  const ulaShows = !ulaFinalTransparent && !borderException;
  const L = () => (!layer2Transparent ? layer2Rgb : undefined);
  const S = () => (!spriteTransparent ? spriteRgb : undefined);
  const U = () => (!ulaFinalTransparent ? ulaFinalRgb : undefined);
  const Ub = () => (ulaShows ? ulaFinalRgb : undefined);
  const P = () => (layer2Priority ? layer2Rgb : undefined);
  // --- the source of the ULA/tilemap pair (ula_final): stencil, or the tilemap when it is above
  const finalWhy: MixWhy = stencilOn ? "stencil" : !tmTransparent && (!tmBelow || ulaTransparent) ? "tm" : "ula";
  // --- a sprite under the ULA in LUS/USL/ULS shows only by the border exception
  const sprUnderUla = (c.order & 7) >= 3 && !ulaFinalTransparent;
  const why = new Map<() => number | undefined, MixWhy>([
    [L, "l2"],
    [S, sprUnderUla ? "border" : "spr"],
    [U, finalWhy],
    [Ub, finalWhy],
    [P, "l2-priority"]
  ]);
  const first = (...xs: Array<() => number | undefined>): { rgb: number; why: MixWhy } => {
    for (const x of xs) {
      const v = x();
      if (v !== undefined) return { rgb: v, why: why.get(x)! };
    }
    return { rgb: expand8(c.fallback), why: "fallback" };
  };

  switch (c.order & 7) {
    case 0:
      return first(P, S, L, U);
    case 1:
      return first(L, S, U);
    case 2:
      return first(P, S, U, L);
    case 3:
      return first(L, Ub, S);
    case 4:
      return first(P, Ub, S, L);
    case 5:
      return first(P, Ub, L, S);
  }

  // --- blend modes: per-channel 4-bit sums of Layer 2 and the blend operand
  const ch = (shift: number) => ((layer2Rgb >> shift) & 7) + ((mixRgb >> shift) & 7);
  let r = ch(6), g = ch(3), b = ch(0);
  if ((c.order & 7) === 6) {
    [r, g, b] = [r, g, b].map((v) => Math.min(v, 7));
  } else if (!mixRgbTransparent) {
    // --- <= 4 -> 0; bits 3-2 = "11" (12-15) -> 7; else - 5
    [r, g, b] = [r, g, b].map((v) => (v <= 4 ? 0 : (v & 0x0c) === 0x0c ? 7 : v - 5));
  }
  // --- 4-bit values not clamped by 111 with a transparent operand keep only bits 2-0 (mixer_x_t(2 downto 0))
  const blended = ((r & 7) << 6) | ((g & 7) << 3) | (b & 7);
  const B = () => (!layer2Transparent ? blended : undefined);
  const PB = () => (layer2Priority ? blended : undefined);
  const Top = () => (!topT ? topRgb : undefined);
  const Bot = () => (!botT ? botRgb : undefined);
  const blendWhy: MixWhy = (c.order & 7) === 6 ? "blend-add" : "blend-sub";
  // --- top / bottom: the tilemap for sources 0 and 2, the ULA for 3, otherwise as the tile's below bit puts them
  const blend = c.blend & 3;
  const topWhy: MixWhy = blend === 3 ? "ula" : blend === 1 && tmBelow ? "ula" : "tm";
  const botWhy: MixWhy = blend === 3 ? "ula" : blend === 1 && !tmBelow ? "ula" : "tm";
  why.set(B, blendWhy).set(PB, blendWhy).set(Top, topWhy).set(Bot, botWhy).set(S, "spr");
  return first(PB, Top, S, Bot, B);
}
