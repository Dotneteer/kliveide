import { describe, expect, it } from "vitest";

import type { NextLayer2State } from "@common/messaging/EmuApi";
import { LAYER2_NO_PIXEL, LAYER2_READ_BYTES, type Layer2Regs } from "@common/zxnext/layer2/layer2Decode";
import {
  bankChips,
  breakOnWriteCommands,
  memoryLocation,
  buildLayer2Model,
  globalsStrip,
  layer2Overlay,
  layer2StateHash,
  modelDiagnostics,
  needsShadow,
  paletteFlags,
  pixelFields,
  pixelInfo,
  priorityDim,
  viewImage,
  windowText,
  withTransparency
} from "@renderer/features/layer2/layer2ViewModel";

/* The Layer 2 Inspector's view model (`.plans/LAYER2_INSPECTOR_PLAN.md` §4.4-§4.5, Phase 3-5). */

function regs(patch: Partial<Layer2Regs> = {}): Layer2Regs {
  return {
    enabled: true,
    activeBank: 9,
    shadowBank: 14,
    port123B: 0x03,
    bankOffset: 0,
    resolution: 1,
    paletteOffset: 0,
    scrollX: 0,
    scrollY: 0,
    clip: [0, 159, 0, 255],
    clipIndex: 0,
    globalTransparency: 0xe3,
    secondPalette: false,
    ...patch
  };
}

function state(patch: Partial<Layer2Regs> = {}, shadow = false): NextLayer2State {
  const displayed = new Uint8Array(LAYER2_READ_BYTES);
  displayed[(10 << 8) | 20] = 0x47; // --- 320x256: column 10, row 20
  return {
    regs: regs(patch),
    displayed,
    shadow: shadow ? new Uint8Array(LAYER2_READ_BYTES).fill(0x11) : undefined,
    // --- bank 9's first 8K page (18) at $C000
    slotOffsets: [0, 0x2000, 0x054000, 0x056000, 0x044000, 0x046000, 0x040000 + 18 * 0x2000, 0x042000],
    copperRunning: false
  };
}

const palette = Array.from({ length: 256 }, (_, i) => (i << 1) | (i === 0x47 ? 0x200 : 0));

describe("Layer 2 view model", () => {
  it("D4: picks the set for each source; the window follows $123B bit 3", () => {
    expect(buildLayer2Model(state(), "displayed").baseBank).toBe(9);
    expect(buildLayer2Model(state({}, true), "shadow").baseBank).toBe(14);
    expect(buildLayer2Model(state({ port123B: 0x0b }, true), "window").baseBank).toBe(14);
    expect(needsShadow(state(), "window")).toBe(false);
    expect(needsShadow(state({ port123B: 0x0b }), "window")).toBe(true);
    // --- the shadow banks not read yet: no image
    expect(viewImage(buildLayer2Model(state(), "shadow"), false)).toBeUndefined();
  });

  it("T1: says where the window sends writes", () => {
    const m = buildLayer2Model(state({ port123B: 0x43 }), "displayed");
    expect(windowText(m.target)).toBe("writes → bank 10 ($0000-$3FFF)");
    expect(windowText(buildLayer2Model(state({ port123B: 0xc7 }), "displayed").target)).toBe(
      "reads+writes → banks 9, 10, 11 ($0000-$BFFF)"
    );
    expect(windowText(buildLayer2Model(state({ port123B: 0x02 }), "displayed").target)).toBe("window off");
    const strip = globalsStrip(m, []).map((g) => `${g.key}=${g.value}`);
    expect(strip).toContain("$123B=$43: writes → bank 10 ($0000-$3FFF)");
    expect(strip).toContain("Mode=320×256");
    expect(strip).toContain("$12=9 (banks 9-13)");
  });

  it("marks each bank's roles in the strip", () => {
    const chips = bankChips(buildLayer2Model(state({ port123B: 0x41, shadowBank: 12 }), "displayed"));
    expect(chips.map((c) => [c.bank16, c.roles])).toEqual([
      [9, ["displayed"]],
      [10, ["displayed", "window"]],
      [11, ["displayed"]],
      [12, ["displayed", "shadow"]],
      [13, ["displayed", "shadow"]]
    ]);
    expect(chips[0].pages).toEqual([18, 19]);
  });

  it("T6, D10: clears transparent entries and dims the non-priority ones", () => {
    const flags = paletteFlags(palette, 0x47);
    const pixels = Int16Array.from([0x47, 0x10, LAYER2_NO_PIXEL]);
    expect(Array.from(withTransparency(pixels, flags))).toEqual([LAYER2_NO_PIXEL, 0x10, LAYER2_NO_PIXEL]);
    expect(Array.from(priorityDim(pixels, flags))).toEqual([0, 1, 1]);
    // --- every byte 0 except one $47: transparent only when $47's colour is too
    const s = state();
    expect(modelDiagnostics(buildLayer2Model(s, "displayed"), paletteFlags(palette, 0)).map((x) => x.id)).toEqual(["writesShown"]);
    const both = palette.map((v, i) => (i === 0x47 ? 0x200 : v));
    expect(modelDiagnostics(buildLayer2Model(s, "displayed"), paletteFlags(both, 0)).map((x) => x.id)).toEqual([
      "writesShown",
      "allTransparent"
    ]);
  });

  it("D6: resolves a pixel to its byte, index, colour and addresses", () => {
    const m = buildLayer2Model(state({ paletteOffset: 1 }), "displayed");
    const p = pixelInfo(m, 10, 20, false, palette)!;
    expect(p).toMatchObject({ stored: 0x47, index: 0x57, priority: false, transparent: false });
    expect(p.address).toMatchObject({ bank16: 9, offset: 0x0a14, page8k: 18 });
    expect(p.z80Mmu).toBe(0xca14);
    expect(p.z80Window).toBe(0x0a14);
    // --- mapped through the MMU: the 64K view; writes mapped through the window: both breakpoints
    expect(memoryLocation(p)).toEqual({ kind: "z80", address: 0xca14, text: "$CA14" });
    expect(breakOnWriteCommands(m, p)).toEqual(["bp-set 09:+$0A14 -w", "bp-set $0A14 -w"]);
    const fields = Object.fromEntries(pixelFields(m, p).map((f) => [f.name, f.value]));
    expect(fields).toMatchObject({ Stored: "$47", Index: "$57 (87)", Bank: "9:$0A14", "Z80 (MMU)": "$CA14", "Z80 ($123B)": "$0A14" });
  });

  it("D6: an unmapped byte still has a memory page and a bank-relative write breakpoint", () => {
    const s = state({ port123B: 0x02 }); // --- window off
    s.slotOffsets = [0, 0x2000, 0x054000, 0x056000, 0x044000, 0x046000, 0x040000, 0x042000];
    const m = buildLayer2Model(s, "displayed");
    const p = pixelInfo(m, 64, 3, false, palette)!; // --- column 64: bank 10, offset $0003
    expect(p.z80Mmu).toBeUndefined();
    expect(memoryLocation(p)).toEqual({ kind: "page", page8k: 20, offset: 3, text: "page 14:$0003" });
    expect(breakOnWriteCommands(m, p)).toEqual(["bp-set 0A:+$0003 -w"]);
    // --- past 2 MB: nothing to show, nothing to break on
    const high = buildLayer2Model(state({ activeBank: 111 }), "displayed");
    const q = pixelInfo(high, 100, 0, false, palette)!;
    expect(q.address.outsideRam).toBe(true);
    expect(memoryLocation(q)).toBeUndefined();
    expect(breakOnWriteCommands(high, q)).toEqual([]);
  });

  it("D5: in *As displayed*, a pixel is its scrolled source", () => {
    const m = buildLayer2Model(state({ scrollX: 5, scrollY: 1 }), "displayed");
    const p = pixelInfo(m, 5, 19, true, palette)!;
    expect(p.layer).toEqual({ x: 10, y: 20 });
    expect(p.stored).toBe(0x47);
  });

  it("draws the banks, the window and the visible window on the whole layer, the clip as displayed", () => {
    const m = buildLayer2Model(state({ port123B: 0x41 }), "displayed");
    const whole = layer2Overlay(m, { asDisplayed: false, banks: true });
    expect(whole.filter((s) => s.kind === "rect" && s.role === "bank")).toHaveLength(5);
    expect(whole.find((s) => s.kind === "rect" && s.role === "window")).toMatchObject({ rect: { x1: 64, x2: 127 } });
    expect(whole.some((s) => s.kind === "rect" && s.role === "visible")).toBe(true);
    const shown = layer2Overlay(m, { asDisplayed: true, banks: true });
    expect(shown.map((s) => (s.kind === "rect" ? s.role : s.kind))).toEqual(["clip"]);
    // --- T5: past 2 MB hatched
    const high = layer2Overlay(buildLayer2Model(state({ activeBank: 110 }), "displayed"), { asDisplayed: false, banks: false });
    expect(high.filter((s) => s.kind === "hatch")).toHaveLength(3);
  });

  it("D9: the hash follows the bytes and the registers", () => {
    const a = state();
    const b = state();
    expect(layer2StateHash(a)).toBe(layer2StateHash(b));
    b.displayed[5] = 1;
    expect(layer2StateHash(a)).not.toBe(layer2StateHash(b));
    expect(layer2StateHash(a)).not.toBe(layer2StateHash(state({ scrollY: 1 })));
  });
});
