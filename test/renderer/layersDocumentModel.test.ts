import { describe, expect, it } from "vitest";

import type { NextLayerRegs, NextLayerState } from "@common/messaging/EmuApi";
import { countOpaque, layerCards, priorityStack } from "@renderer/features/layers/layersDocumentModel";

// --- LAYER_COMPOSITION_PLAN D9: the priority diagram and the "why it might be invisible" cards

const regs = (patch: Partial<NextLayerRegs> = {}): NextLayerRegs => ({
  priorities: 0,
  blendMode: 0,
  stencil: false,
  ulaEnabled: true,
  loRes: false,
  tilemapEnabled: true,
  tilemapOnTop: false,
  layer2Enabled: true,
  layer2Resolution: 0,
  spritesEnabled: true,
  spritesOverBorder: true,
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

const state = (r: NextLayerRegs, opaque: Partial<Record<"ula" | "tm" | "l2" | "spr", boolean>> = {}): NextLayerState => {
  const pic = (on: boolean | undefined) => new Uint8ClampedArray([0, 0, 0, on ? 255 : 0, 0, 0, 0, 0]);
  return {
    regs: r,
    debug: { hidden: 0, solo: 0, showTransparent: false },
    capture: true,
    paperBufferY: 48,
    thumbnails: {
      width: 2,
      height: 1,
      ula: pic(opaque.ula ?? true),
      tm: pic(opaque.tm ?? true),
      l2: pic(opaque.l2 ?? true),
      spr: pic(opaque.spr ?? true),
      composite: pic(true)
    }
  };
};

describe("layers document model", () => {
  it("stacks the layers top first, with the priority-bit pixels above when Layer 2 is not on top", () => {
    expect(priorityStack(regs({ priorities: 0 })).map((l) => l.label)).toEqual([
      "Layer 2 priority pixels",
      "Sprites",
      "Layer 2",
      "Tilemap / ULA"
    ]);
    expect(priorityStack(regs({ priorities: 1 })).map((l) => l.label)).toEqual(["Layer 2", "Sprites", "Tilemap / ULA"]);
    expect(priorityStack(regs({ priorities: 4, stencil: true })).at(1)?.label).toBe("ULA AND tilemap (stencil)");
    const blend = priorityStack(regs({ priorities: 7, blendMode: 2 }));
    expect(blend).toHaveLength(5);
    expect(blend[4].label).toBe("Layer 2 blended with the ULA + tilemap");
  });

  it("explains why a layer may be invisible", () => {
    const cards = layerCards(
      state(regs({ tilemapEnabled: false, layer2Clip: [10, 5, 0, 191] }), { spr: false }),
      { hidden: 1, solo: 0, showTransparent: false }
    );
    const by = Object.fromEntries(cards.map((c) => [c.id, c]));
    expect(by.tm.reasons).toEqual(["Off: $6B bit 7 is clear"]);
    expect(by.l2.clipEmpty).toBe(true);
    expect(by.l2.reasons).toContain("Its clip window is empty");
    expect(by.spr.reasons).toEqual(["Every pixel is transparent (or clipped)"]);
    expect(by.ula.reasons).toEqual(["Hidden by the debug view (not by the program)"]);
    expect(by.ula.debugText).toBe("hidden");
    expect(by.ula.clipText).toBe("x 32-287, y 32-223");
  });

  it("names the solo layer on the others' cards", () => {
    const cards = layerCards(state(regs()), { hidden: 0, solo: 4, showTransparent: false });
    expect(cards.find((c) => c.id === "l2")!.debugText).toBe("solo");
    expect(cards.find((c) => c.id === "spr")!.debugText).toBe("not shown: Layer 2 is solo");
    expect(cards.find((c) => c.id === "spr")!.reasons).toEqual(["Layer 2 is shown alone"]);
  });

  it("counts opaque thumbnail pixels", () => {
    expect(countOpaque(new Uint8ClampedArray([1, 2, 3, 255, 1, 2, 3, 0, 0, 0, 0, 9]))).toBe(2);
    expect(countOpaque(undefined)).toBeUndefined();
  });
});
