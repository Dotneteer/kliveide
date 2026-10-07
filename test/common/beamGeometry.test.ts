import { describe, expect, it } from "vitest";

import {
  beamAt,
  describeBeam,
  describePixel,
  drawnUpTo,
  pixelToTact,
  rasterLineOf,
  tactToPixel,
  tactsUntil,
  type BeamTiming
} from "@common/utils/beamGeometry";
import { ulaRasterPosition } from "@renderer/appEmu/MainToEmuProcessor";

/*
 * The beam overlay's geometry (`.plans/BEAM_POSITION_OVERLAY_PLAN.md` §4.1, Phase 3): the linear
 * raster each machine reports, per timing. The cores themselves are checked against it in
 * test/zxnext-hw/video/beam-position.test.ts and test/spectrum-hw/beam-position.test.ts.
 */

/** The 48K: 224 T x 312 lines, 352 x 287 displayed, row 0 one line after the first visible */
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

/** The Next on the +3 timing: 456 HC x 311 lines, buffer (0, 0) at (vc 16, hc 96) */
const NEXT_P3: BeamTiming = {
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

/** The Pentagon: the frame starts with its interrupt, 62 T into the raster */
const PENTAGON: BeamTiming = { ...SP48, tactsPerLine: 224, linesPerFrame: 320, lineStartTact: 62, firstVisibleTact: 62 + 32 * 224 - 24, bufferHeight: 287, paperTop: 48 };

describe("beamGeometry", () => {
  it("maps tacts to pixels and back, per timing", () => {
    for (const t of [SP48, NEXT_P3, PENTAGON]) {
      for (const [x, y] of [[0, 0], [2, 0], [t.paperLeft, t.paperTop], [t.bufferWidth - 2, t.bufferHeight - 1], [100, 77]]) {
        const tact = pixelToTact(t, x, y);
        expect(tactToPixel(t, tact)).toEqual({ region: x >= t.paperLeft && x < t.paperLeft + t.paperWidth && y >= t.paperTop && y < t.paperTop + t.paperHeight ? "paper" : "border", x, y });
      }
    }
  });

  it("D5: names blanking: before and after the picture, and past the right edge", () => {
    expect(tactToPixel(SP48, 0).region).toBe("vblank");
    expect(tactToPixel(SP48, SP48.firstVisibleTact - 1).region).toBe("vblank");
    expect(tactToPixel(SP48, SP48.firstVisibleTact + 176).region).toBe("hblank");
    expect(tactToPixel(SP48, SP48.firstVisibleTact + 175).region).toBe("border");
    expect(tactToPixel(SP48, SP48.firstVisibleTact + 287 * 224).region).toBe("vblank");
    expect(tactToPixel(NEXT_P3, NEXT_P3.firstVisibleTact + 360).region).toBe("hblank");
  });

  it("T1: drawnUpTo splits the picture at the beam; blanking draws up to the next row", () => {
    expect(drawnUpTo(SP48, 0)).toBe(0);
    expect(drawnUpTo(SP48, SP48.firstVisibleTact + 10)).toBe(20);
    expect(drawnUpTo(SP48, SP48.firstVisibleTact + 200)).toBe(352);
    expect(drawnUpTo(SP48, SP48.firstVisibleTact + 224 + 1)).toBe(352 + 2);
    expect(drawnUpTo(SP48, 312 * 224 - 1)).toBe(352 * 287);
  });

  it("names the raster line and the tact within it, with the Pentagon's shifted frame start", () => {
    expect(rasterLineOf(SP48, 224 * 100 + 5)).toEqual({ line: 100, lineTact: 5 });
    expect(rasterLineOf(PENTAGON, 62)).toEqual({ line: 0, lineTact: 0 });
    expect(rasterLineOf(PENTAGON, 10)).toEqual({ line: 319, lineTact: 224 - 52 });
    expect(beamAt(NEXT_P3, 456 * 150 + 210).line).toBe(150);
  });

  it("D1: the pill names the line, the paper row or border, the line tact and the frame tact", () => {
    const paper = beamAt(NEXT_P3, NEXT_P3.firstVisibleTact + (48 + 75) * 456 + 100);
    expect(describeBeam(paper)).toBe("line 139 · paper row 75 · hc 196 · HC 63,580");
    const border = beamAt(SP48, SP48.firstVisibleTact + 10 * 224 + 3);
    expect(describeBeam(border)).toBe("line 25 · top border · tact 203 · T 5,803");
    expect(describeBeam(beamAt(SP48, SP48.firstVisibleTact + 250 * 224 + 10))).toContain("bottom border");
  });

  it("D5: the pill names blanking, and how far the top border is", () => {
    expect(describeBeam(beamAt(SP48, 4 * 224))).toBe("line 4 · VBLANK · 11 lines to the top border · tact 0 · T 896");
    expect(describeBeam(beamAt(SP48, SP48.firstVisibleTact + 180))).toBe("line 16 · HBLANK · tact 156 · T 3,740");
    expect(describeBeam(beamAt(SP48, 311 * 224))).toContain("VBLANK · 16 lines to the top border");
  });

  it("D6: the hover readout says when the beam gets to a pixel, or that it already did", () => {
    const beam = beamAt(SP48, SP48.firstVisibleTact + 100 * 224);
    expect(tactsUntil(beam, 0, 99)).toBe("drawn");
    expect(tactsUntil(beam, 0, 100)).toBe("drawn");
    expect(tactsUntil(beam, 10, 101)).toBe(224 + 5);
    expect(describePixel(beam, 10, 101)).toBe("(10, 101) · line 116 · tact 205 · T 26,189 · in 229 T");
    expect(describePixel(beam, 0, 3)).toMatch(/· drawn$/);
  });

  it("T6: the ULA panel's RAS and POS are the beam's line and line tact", () => {
    const beam = beamAt(SP48, 224 * 64 + 17);
    expect(ulaRasterPosition({ getBeamPosition: () => beam })).toEqual({ ras: 64, pos: 17 });
    expect(ulaRasterPosition({})).toEqual({ ras: 0, pos: 0 });
  });
});
