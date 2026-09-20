import { describe, expect, it } from "vitest";
import {
  DEFAULT_ZOOM_STEP,
  ZOOM_STEPS,
  normalizeZoomStep,
  snapToZoomStep
} from "@common/settings/zoom-steps";

describe("zoom steps", () => {
  it("offers whole, half and quarter steps, and defaults to half", () => {
    expect(ZOOM_STEPS.map((s) => s.value)).toEqual([1, 0.5, 0.25]);
    expect(DEFAULT_ZOOM_STEP).toBe(0.5);
  });

  it("keeps the whole-step behaviour the screen had before the setting existed", () => {
    // --- 256px of machine screen in a 600px panel: 2x fits, 3x does not.
    expect(snapToZoomStep(600, 256, 1)).toBe(2);
    expect(snapToZoomStep(768, 256, 1)).toBe(3);
    expect(snapToZoomStep(767, 256, 1)).toBe(2);
  });

  it("lands on the half rungs when half steps are allowed", () => {
    expect(snapToZoomStep(600, 256, 0.5)).toBe(2);
    // --- 2.5x needs 640px; at 639px the fit still has to snap back to 2x.
    expect(snapToZoomStep(640, 256, 0.5)).toBe(2.5);
    expect(snapToZoomStep(639, 256, 0.5)).toBe(2);
  });

  it("lands on the quarter rungs when quarter steps are allowed", () => {
    // --- The same 600px panel the coarser steps could only fill to 2x.
    expect(snapToZoomStep(600, 256, 0.25)).toBe(2.25);
    expect(snapToZoomStep(640, 256, 0.25)).toBe(2.5);
    // --- 2.25x needs 576px; one pixel short and it has to fall all the way back to 2x.
    expect(snapToZoomStep(575, 256, 0.25)).toBe(2);
  });

  it("never snaps up: a finer step only ever fills more of the panel", () => {
    for (let available = 100; available <= 2000; available += 7) {
      const whole = snapToZoomStep(available, 256, 1);
      const half = snapToZoomStep(available, 256, 0.5);
      const quarter = snapToZoomStep(available, 256, 0.25);
      expect(half).toBeGreaterThanOrEqual(whole);
      expect(quarter).toBeGreaterThanOrEqual(half);
      // --- And no rung may overflow the space it was fitted into
      expect(quarter * 256).toBeLessThanOrEqual(available);
    }
  });

  it("falls back to the default for values a settings file may not carry", () => {
    expect(normalizeZoomStep(undefined)).toBe(DEFAULT_ZOOM_STEP);
    expect(normalizeZoomStep(null)).toBe(DEFAULT_ZOOM_STEP);
    expect(normalizeZoomStep("off")).toBe(DEFAULT_ZOOM_STEP);
    expect(normalizeZoomStep(3)).toBe(DEFAULT_ZOOM_STEP);
    expect(normalizeZoomStep(0)).toBe(DEFAULT_ZOOM_STEP);
  });

  it("accepts a hand-written numeric string", () => {
    expect(normalizeZoomStep("1")).toBe(1);
    expect(normalizeZoomStep("0.25")).toBe(0.25);
    expect(normalizeZoomStep(1)).toBe(1);
  });

  it("returns no fit for a degenerate screen size", () => {
    expect(snapToZoomStep(600, 0, 1)).toBe(0);
    expect(snapToZoomStep(Number.NaN, 256, 1)).toBe(0);
  });
});
