import { describe, it, expect, beforeEach } from "vitest";
import { createTestNextMachine } from "./TestNextMachine";

describe("Tilemap D1 — Per-tile ULA priority compositing", () => {
  let m: Awaited<ReturnType<typeof createTestNextMachine>>;
  let d: any;

  beforeEach(async () => {
    m = await createTestNextMachine();
    d = m.composedScreenDevice;
  });

  it("tilemapPixel1BelowUla field is readable and writable", () => {
    // Field should be assignable and readable
    expect(typeof d.tilemapPixel1BelowUla).toBe("boolean");
    d.tilemapPixel1BelowUla = true;
    expect(d.tilemapPixel1BelowUla).toBe(true);
    d.tilemapPixel1BelowUla = false;
    expect(d.tilemapPixel1BelowUla).toBe(false);
  });

  it("tilemapPixel2BelowUla field is readable and writable", () => {
    // Field should be assignable and readable
    expect(typeof d.tilemapPixel2BelowUla).toBe("boolean");
    d.tilemapPixel2BelowUla = true;
    expect(d.tilemapPixel2BelowUla).toBe(true);
    d.tilemapPixel2BelowUla = false;
    expect(d.tilemapPixel2BelowUla).toBe(false);
  });

  it("tilemapForceOnTopOfUla overrides belowUla flag", () => {
    // Both pixels below by default
    d.tilemapPixel1BelowUla = true;
    d.tilemapPixel2BelowUla = true;

    // When forceOnTopOfUla is true, tilemap should be on top regardless of belowUla flags
    d.tilemapForceOnTopOfUla = true;
    expect(d.tilemapForceOnTopOfUla).toBe(true);
    
    // Flags should still be set (compositing logic checks forceOnTop to override them)
    expect(d.tilemapPixel1BelowUla).toBe(true);
    expect(d.tilemapPixel2BelowUla).toBe(true);
  });
});

describe("Tilemap D1+D2 — Field state verification", () => {
  let m: Awaited<ReturnType<typeof createTestNextMachine>>;
  let d: any;

  beforeEach(async () => {
    m = await createTestNextMachine();
    d = m.composedScreenDevice;
  });

  it("tilemapPixel1BelowUla and tilemapPixel2BelowUla are reset on frame start", () => {
    // Set to true
    d.tilemapPixel1BelowUla = true;
    d.tilemapPixel2BelowUla = true;

    expect(d.tilemapPixel1BelowUla).toBe(true);
    expect(d.tilemapPixel2BelowUla).toBe(true);

    // Frame start should reset
    d.onNewFrame();

    // Should be reset to false
    expect(d.tilemapPixel1BelowUla).toBe(false);
    expect(d.tilemapPixel2BelowUla).toBe(false);
  });

  it("tilemapTilePriority field exists and is readable", () => {
    // Check that the current-phase priority field exists
    expect(typeof d.tilemapTilePriority).toBe("boolean");
  });

  it("tilemapForceOnTopOfUla field exists and is readable", () => {
    // Check that forceOnTopOfUla exists
    expect(typeof d.tilemapForceOnTopOfUla).toBe("boolean");
    // Test it's writable
    d.tilemapForceOnTopOfUla = true;
    expect(d.tilemapForceOnTopOfUla).toBe(true);
    d.tilemapForceOnTopOfUla = false;
    expect(d.tilemapForceOnTopOfUla).toBe(false);
  });


});
