import { describe, expect, it } from "vitest";

import { beamAt, type BeamTiming } from "@common/utils/beamGeometry";
import { beamOverlayModel, copperHitTact } from "@renderer/features/emulator/beamOverlayModel";
import { pointerToBuffer } from "@renderer/features/emulator/EmulatorScreenOverlay";

/*
 * The beam overlay's shape model and the screen mapping (`.plans/BEAM_POSITION_OVERLAY_PLAN.md`
 * Phase 4/5): the fresh/stale split, the blanking edge markers, Instant Screen, the Copper's hit,
 * and buffer pixels under the pointer at several zooms.
 */

const SP48: BeamTiming = {
  unit: "T",
  tactsPerLine: 224,
  linesPerFrame: 312,
  firstVisibleTact: 16 * 224 - 24,
  tactsPerBufferPixel: 0.5,
  bufferWidth: 352,
  bufferHeight: 287,
  paperLeft: 48,
  paperTop: 47,
  paperWidth: 256,
  paperHeight: 192
};

const NEXT: BeamTiming = {
  unit: "HC",
  tactsPerLine: 456,
  linesPerFrame: 311,
  firstVisibleTact: 16 * 456 + 96,
  tactsPerBufferPixel: 0.5,
  bufferWidth: 720,
  bufferHeight: 288,
  paperLeft: 96,
  paperTop: 48,
  paperWidth: 512,
  paperHeight: 192
};

const at = (t: BeamTiming, x: number, y: number) => t.firstVisibleTact + y * t.tactsPerLine + x * t.tactsPerBufferPixel;

describe("beam overlay model", () => {
  it("D1/D2: the beam's row and pixel, and the stale part hatched from the last drawn pixel", () => {
    const beam = beamAt(SP48, at(SP48, 100, 120), 352 * 110 + 40);
    const m = beamOverlayModel({ beam, instant: false });
    expect(m.shapes.filter((s) => s.className === "stale")).toEqual([
      { kind: "rect", className: "stale", x: 40, y: 110, width: 312, height: 1 },
      { kind: "rect", className: "stale", x: 0, y: 111, width: 352, height: 176 }
    ]);
    expect(m.shapes).toContainEqual(expect.objectContaining({ className: "beamLine", y1: 120.5, y2: 120.5, x1: 0, x2: 352 }));
    expect(m.shapes).toContainEqual(expect.objectContaining({ className: "beamMarker", x1: 100.5, y1: 114, y2: 127 }));
    expect(m.labels).toEqual([expect.objectContaining({ className: "staleLabel", text: "previous frame", x: 40, y: 111 })]);
    expect(m.pill).toBe("line 136 · paper row 73 · tact 26 · T 30,490");
  });

  it("D2: a stale part starting at a row's first pixel is one rectangle; nothing stale, nothing hatched", () => {
    const beam = beamAt(SP48, at(SP48, 0, 50), 352 * 50);
    expect(beamOverlayModel({ beam, instant: false }).shapes.filter((s) => s.className === "stale")).toEqual([
      { kind: "rect", className: "stale", x: 0, y: 50, width: 352, height: 237 }
    ]);
    const done = beamAt(SP48, 311 * 224, 352 * 287);
    expect(beamOverlayModel({ beam: done, instant: false }).shapes.some((s) => s.className === "stale")).toBe(false);
  });

  it("T8: over Instant Screen, the beam line only, and the pill says so", () => {
    const beam = beamAt(NEXT, at(NEXT, 300, 100), 0);
    const m = beamOverlayModel({ beam, instant: true });
    expect(m.shapes.some((s) => s.className === "stale")).toBe(false);
    expect(m.labels).toEqual([]);
    expect(m.pill).toMatch(/· instant screen$/);
  });

  it("D5: blanking pins a marker to the edge: the right edge in HBLANK, top or bottom in VBLANK", () => {
    const h = beamOverlayModel({ beam: beamAt(SP48, at(SP48, 0, 30) + 180), instant: false });
    expect(h.shapes).toContainEqual(expect.objectContaining({ className: "beamEdge", x1: 351.5, x2: 351.5 }));
    expect(h.shapes).toContainEqual(expect.objectContaining({ className: "beamLine", y1: 30.5 }));
    expect(h.pill).toContain("HBLANK");
    const top = beamOverlayModel({ beam: beamAt(SP48, 100), instant: false });
    expect(top.shapes).toContainEqual(expect.objectContaining({ className: "beamEdge", y1: 0.5, y2: 0.5 }));
    expect(top.pill).toContain("VBLANK · 15 lines to the top border");
    const bottom = beamOverlayModel({ beam: beamAt(SP48, 310 * 224), instant: false });
    expect(bottom.shapes).toContainEqual(expect.objectContaining({ className: "beamEdge", y1: 286.5 }));
  });

  it("D7: the Copper's hit gets its own marker and label when it is not where the beam is", () => {
    const beam = beamAt(NEXT, at(NEXT, 400, 150));
    // --- cvc 30 at hc_ula 12 + 50: paper row 30, paper x 100 (two buffer pixels per hc)
    const tact = copperHitTact(beam, { line: 30, hc: 62 }, 0);
    expect(tact).toBe(at(NEXT, 96 + 100, 48 + 30));
    const m = beamOverlayModel({ beam, instant: false, copper: { tact, label: "Copper hit $00B" } });
    expect(m.shapes).toContainEqual(expect.objectContaining({ className: "copper", x1: 196.5, title: "Copper hit $00B" }));
    expect(m.labels).toContainEqual(expect.objectContaining({ className: "copperLabel", text: "Copper hit $00B" }));
    // --- the $64 offset moves cvc 0 down the screen
    expect(copperHitTact(beam, { line: 30, hc: 62 }, 10)).toBe(at(NEXT, 196, 68));
    // --- where the beam is: no second marker
    const same = beamOverlayModel({ beam, instant: false, copper: { tact: beam.frameTact, label: "x" } });
    expect(same.shapes.some((s) => s.className === "copper")).toBe(false);
  });

  it("T5: the pointer maps to the same buffer pixel at every zoom and aspect", () => {
    for (const zoom of [1, 1.5, 2, 3.25]) {
      // --- the Next: 720 buffer pixels shown at half width
      const rect = { left: 10, top: 20, width: 720 * 0.5 * zoom, height: 288 * zoom };
      const p = pointerToBuffer(rect, 10 + (301 * 0.5 + 0.25) * zoom, 20 + (77 + 0.5) * zoom, 720, 288)!;
      expect([p.x, p.y]).toEqual([301, 77]);
      const q = pointerToBuffer({ left: 0, top: 0, width: 352 * zoom, height: 287 * zoom }, 351.5 * zoom, 0.1, 352, 287)!;
      expect([q.x, q.y]).toEqual([351, 0]);
    }
    expect(pointerToBuffer({ left: 0, top: 0, width: 100, height: 100 }, 101, 5, 352, 287)).toBeUndefined();
  });
});
