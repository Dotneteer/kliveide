import { describe, expect, it } from "vitest";

import {
  decodeProbe,
  describeBlend,
  describeLayerDebug,
  isLayerDebugActive,
  layerStackOrder,
  rgb333Css,
  unpackMixParams,
  whyLayer,
  WHY_BORDER,
  WHY_L2_PRIORITY,
  WHY_STENCIL
} from "@common/zxnext/layers/layerMix";
import {
  applyLayersCommand,
  closeLayerView,
  describeLayerView,
  EMPTY_LAYER_VIEW,
  layerChips,
  parseLayersCommand,
  priorityReadout,
  resetLayers,
  toggleHidden,
  toggleSolo,
  wantsLayerCapture
} from "@common/zxnext/layers/layerView";
import type { NextLayerRegs } from "@common/messaging/EmuApi";

// --- LAYER_COMPOSITION_PLAN §4.5: the one view the strip, the menu and the command share (D4)

const regs = (patch: Partial<NextLayerRegs> = {}): NextLayerRegs => ({
  priorities: 0,
  blendMode: 0,
  stencil: false,
  ulaEnabled: true,
  loRes: false,
  tilemapEnabled: false,
  tilemapOnTop: false,
  layer2Enabled: true,
  layer2Resolution: 0,
  spritesEnabled: true,
  spritesOverBorder: false,
  spritesClipping: false,
  globalTransparency: 0xe3,
  fallback: 0xe3,
  ulaClip: [0, 255, 0, 191],
  layer2Clip: [0, 255, 0, 191],
  spriteClip: [0, 255, 0, 191],
  tilemapClip: [0, 159, 0, 255],
  copperRunning: false,
  ...patch
});

describe("layer view", () => {
  it("hides, shows and solos; hiding the soloed layer ends the solo", () => {
    let v = toggleHidden(EMPTY_LAYER_VIEW, "spr");
    expect(v.hidden).toBe(8);
    v = toggleSolo(v, "l2");
    expect(v.solo).toBe(4);
    v = toggleHidden(v, "l2");
    expect(v).toMatchObject({ hidden: 12, solo: 0 });
    expect(toggleSolo(toggleSolo(EMPTY_LAYER_VIEW, "tm"), "tm").solo).toBe(0);
    expect(resetLayers({ ...v, showTransparent: true, probe: true })).toEqual({ ...v, hidden: 0, solo: 0, showTransparent: false, probe: true });
  });

  it("closing the strip returns to the composite picture and turns its overlays off", () => {
    const v = { hidden: 9, solo: 4, showTransparent: true, showClips: true, probe: true, documentOpen: true };
    const closed = closeLayerView(v);
    expect(closed).toEqual({ hidden: 0, solo: 0, showTransparent: false, showClips: false, probe: false, documentOpen: true });
    expect(isLayerDebugActive(closed)).toBe(false);
    // --- with nothing else needing it, the capture stops once the strip is hidden (T6)
    expect(wantsLayerCapture({ ...closed, documentOpen: false }, false)).toBe(false);
  });

  it("parses the layers command and refuses what it cannot do", () => {
    expect(parseLayersCommand()).toEqual({});
    expect(parseLayersCommand("SPRITES", "off")).toEqual({ target: "spr", action: "off" });
    expect(parseLayersCommand("l2", "solo")).toEqual({ target: "l2", action: "solo" });
    expect(parseLayersCommand("tm")).toEqual({ target: "tm" });
    expect(typeof parseLayersCommand("copper")).toBe("string");
    expect(typeof parseLayersCommand("ula", "maybe")).toBe("string");
    expect(typeof parseLayersCommand("all", "solo")).toBe("string");
  });

  it("applies the command to the shared view", () => {
    let v = applyLayersCommand(EMPTY_LAYER_VIEW, { target: "spr", action: "off" });
    expect(v.hidden).toBe(8);
    v = applyLayersCommand(v, { target: "ula" });
    expect(v.hidden).toBe(9);
    v = applyLayersCommand(v, { target: "spr", action: "solo" });
    expect(v).toMatchObject({ hidden: 1, solo: 8 });
    v = applyLayersCommand(v, { target: "transparency", action: "on" });
    expect(v.showTransparent).toBe(true);
    v = applyLayersCommand(v, { target: "all", action: "on" });
    expect(v).toMatchObject({ hidden: 0, solo: 0, showTransparent: true });
    expect(applyLayersCommand(v, { target: "all", action: "off" }).hidden).toBe(15);
    expect(describeLayerView(applyLayersCommand(EMPTY_LAYER_VIEW, { target: "tm", action: "solo" }))).toEqual([
      "ULA: not shown (another layer is solo)",
      "Tilemap: solo",
      "Layer 2: not shown (another layer is solo)",
      "Sprites: not shown (another layer is solo)",
      "Transparency: not marked"
    ]);
  });

  it("announces the debug view (D3) only while it changes the picture", () => {
    expect(describeLayerDebug(EMPTY_LAYER_VIEW)).toBeUndefined();
    expect(describeLayerDebug({ ...EMPTY_LAYER_VIEW, probe: true, showClips: true } as never)).toBeUndefined();
    expect(describeLayerDebug({ hidden: 8, solo: 0, showTransparent: false })).toBe("Layers: sprites hidden");
    expect(describeLayerDebug({ hidden: 3, solo: 0, showTransparent: true })).toBe("Layers: ULA, tilemap hidden; transparency shown");
    expect(describeLayerDebug({ hidden: 3, solo: 4, showTransparent: false })).toBe("Layers: Layer 2 solo");
    expect(isLayerDebugActive({ hidden: 0, solo: 0, showTransparent: true })).toBe(true);
  });

  it("orders the chips by $15, the ULA/tilemap pair together, top first", () => {
    expect(layerStackOrder(0)).toEqual(["spr", "l2", "tm", "ula"]);
    expect(layerStackOrder(3)).toEqual(["l2", "tm", "ula", "spr"]);
    expect(layerStackOrder(5)).toEqual(["tm", "ula", "l2", "spr"]);
    expect(layerStackOrder(7)).toEqual(["spr", "l2", "tm", "ula"]);
    const chips = layerChips(regs({ priorities: 4, tilemapEnabled: false }), { hidden: 1, solo: 0, showTransparent: false });
    expect(chips.map((c) => c.id)).toEqual(["tm", "ula", "spr", "l2"]);
    expect(chips.find((c) => c.id === "ula")!.hidden).toBe(true);
    expect(chips.find((c) => c.id === "tm")!.disabledByProgram).toBe(true);
    expect(layerChips(regs(), { hidden: 0, solo: 4, showTransparent: false }).filter((c) => c.eclipsed).map((c) => c.id)).toEqual([
      "spr",
      "tm",
      "ula"
    ]);
  });

  it("names the priority mode and the blend", () => {
    expect(priorityReadout(regs({ priorities: 2 }))).toBe("SUL");
    expect(priorityReadout(regs({ priorities: 6, blendMode: 3 }))).toBe("Blend (add): Layer 2 + tilemap");
    expect(describeBlend(5, 0)).toBeUndefined();
    expect(priorityReadout(undefined)).toBeUndefined();
  });

  it("wants the capture only while something needs it (T6, Q5)", () => {
    expect(wantsLayerCapture(EMPTY_LAYER_VIEW, false)).toBe(false);
    expect(wantsLayerCapture(EMPTY_LAYER_VIEW, true)).toBe(true);
    expect(wantsLayerCapture({ ...EMPTY_LAYER_VIEW, probe: true }, false)).toBe(true);
    expect(wantsLayerCapture({ ...EMPTY_LAYER_VIEW, documentOpen: true }, false)).toBe(true);
    expect(wantsLayerCapture({ ...EMPTY_LAYER_VIEW, hidden: 2 }, false)).toBe(true);
  });
});

describe("mixer words", () => {
  it("unpacks zxnextMixParamsPack", () => {
    const v = 0x1c7 | (5 << 9) | (1 << 12) | (1 << 14) | (1 << 16) | (2 << 17) | (1 << 19);
    expect(unpackMixParams(v)).toEqual({
      fallbackRgb: 0x1c7,
      priorities: 5,
      ulaEnabled: true,
      tilemapEnabled: false,
      layer2Enabled: true,
      spritesEnabled: false,
      stencil: true,
      blendMode: 2,
      tilemapBelowWhenOff: true
    });
  });

  it("decodes the probe's twelve words", () => {
    const params = 0x0e3 | (1 << 12) | (1 << 13) | (1 << 14) | (1 << 15);
    const p = decodeProbe(10, 20, [0x8000 | 0x0800 | 0x007, 0x0400, 0x8000 | 0x0200 | 0x1c0, 0, params, WHY_L2_PRIORITY, 0x1c0, WHY_L2_PRIORITY, 0x1c0, 3, 1440, 1]);
    expect(p.layers.ula).toEqual({ opaque: true, rgb: 7, border: true });
    expect(p.layers.tm).toEqual({ opaque: false, rgb: 0, below: true });
    expect(p.layers.l2).toEqual({ opaque: true, rgb: 0x1c0, priority: true });
    expect(p.layers.spr).toEqual({ opaque: false, rgb: 0 });
    expect(p.status).toEqual({ exact: true, captured: true, overflow: false });
    expect([p.spanStart, p.thisFrame, p.why]).toEqual([1440, true, WHY_L2_PRIORITY]);
    // --- a disabled layer is reported as disabled, whatever its stale buffer holds
    const off = decodeProbe(0, 0, [0, 0, 0x8000 | 5, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(off.layers.l2).toEqual({ opaque: false, rgb: 0, disabled: true });
  });

  it("maps a rule to the layer that owns the pixel", () => {
    expect(whyLayer(WHY_BORDER)).toBe("spr");
    expect(whyLayer(WHY_STENCIL)).toBeUndefined();
    expect(rgb333Css(0x1c7)).toBe("#ff00ff");
  });
});
