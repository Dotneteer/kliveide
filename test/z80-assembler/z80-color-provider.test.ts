import { describe, it, expect } from "vitest";
import { computeColorDecorations, nearestZxIndex, type ColorDecoration } from "@renderer/appIde/services/z80-providers";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deco(lines: string | string[]): ColorDecoration[] {
  return computeColorDecorations(Array.isArray(lines) ? lines : [lines]);
}

// ---------------------------------------------------------------------------
// ZX Spectrum color palette reference (non-bright)
// ---------------------------------------------------------------------------
//  0 Black     [  0,   0,   0]
//  1 Blue      [  0,   0, 204]
//  2 Red       [204,   0,   0]
//  3 Magenta   [204,   0, 204]
//  4 Green     [  0, 204,   0]
//  5 Cyan      [  0, 204, 204]
//  6 Yellow    [204, 204,   0]
//  7 White     [204, 204, 204]

describe("computeColorDecorations", () => {

  // ── No matches ────────────────────────────────────────────────────────────

  it("returns empty for a plain instruction line", () => {
    expect(deco("  ld hl, #4000")).toEqual([]);
  });

  it("returns empty for an empty line", () => {
    expect(deco("")).toEqual([]);
  });

  it("returns empty for a comment-only line", () => {
    expect(deco("; ink(3) paper(2) attr(1,2)")).toEqual([]);
  });

  it("ignores ink/paper/attr that appear after a semicolon", () => {
    expect(deco("nop   ; ink(3)")).toEqual([]);
  });

  // ── ink(n) ────────────────────────────────────────────────────────────────

  it("detects ink(0) → black", () => {
    const d = deco("ink(0)");
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ line: 1, r: 0, g: 0, b: 0 });
  });

  it("detects ink(1) → non-bright blue", () => {
    const d = deco("ink(1)");
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ r: 0, g: 0, b: 204 });
  });

  it("detects ink(4) → non-bright green", () => {
    const d = deco("ink(4)");
    expect(d[0]).toMatchObject({ r: 0, g: 204, b: 0 });
  });

  it("detects ink(7) → non-bright white", () => {
    const d = deco("ink(7)");
    expect(d[0]).toMatchObject({ r: 204, g: 204, b: 204 });
  });

  it("ignores ink with value > 7", () => {
    expect(deco("ink(8)")).toHaveLength(0);
    expect(deco("ink(255)")).toHaveLength(0);
  });

  it("is case-insensitive for ink()", () => {
    expect(deco("INK(3)")).toHaveLength(1);
    expect(deco("Ink(3)")).toHaveLength(1);
  });

  // ── paper(n) ──────────────────────────────────────────────────────────────

  it("detects paper(2) → non-bright red", () => {
    const d = deco("paper(2)");
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ r: 204, g: 0, b: 0 });
  });

  it("detects paper(5) → non-bright cyan", () => {
    const d = deco("paper(5)");
    expect(d[0]).toMatchObject({ r: 0, g: 204, b: 204 });
  });

  it("ignores paper with value > 7", () => {
    expect(deco("paper(9)")).toHaveLength(0);
  });

  // ── attr(ink, paper) ──────────────────────────────────────────────────────

  it("detects attr(4, 2) → two decorations: green ink, red paper", () => {
    const d = deco("attr(4, 2)");
    expect(d).toHaveLength(2);
    expect(d[0]).toMatchObject({ r: 0, g: 204, b: 0 });     // ink=4 green
    expect(d[1]).toMatchObject({ r: 204, g: 0, b: 0 });     // paper=2 red
  });

  it("attr with bright=1 uses bright palette for both ink and paper", () => {
    const d = deco("attr(4, 2, 1)");
    expect(d).toHaveLength(2);
    expect(d[0]).toMatchObject({ r: 0, g: 255, b: 0 });     // ink=4 bright green
    expect(d[1]).toMatchObject({ r: 255, g: 0, b: 0 });     // paper=2 bright red
  });

  it("attr with bright=0 uses normal palette", () => {
    const d = deco("attr(1, 7, 0)");
    expect(d[0]).toMatchObject({ r: 0, g: 0, b: 204 });      // ink=1 normal blue
    expect(d[1]).toMatchObject({ r: 204, g: 204, b: 204 });  // paper=7 normal white
  });

  it("attr with flash argument still works", () => {
    const d = deco("attr(3, 5, 1, 1)");
    expect(d).toHaveLength(2);
    expect(d[0]).toMatchObject({ r: 255, g: 0, b: 255 });    // ink=3 bright magenta
    expect(d[1]).toMatchObject({ r: 0, g: 255, b: 255 });    // paper=5 bright cyan
  });

  it("ignores attr with ink or paper > 7", () => {
    expect(deco("attr(8, 2)")).toHaveLength(0);
    expect(deco("attr(4, 9)")).toHaveLength(0);
  });

  // ── Column computation ────────────────────────────────────────────────────

  it("ink(3) at column 1 — digit at correct column", () => {
    // "ink(3)" → 'i' at col1, '(' at col4, '3' at col5
    const d = deco("ink(3)");
    expect(d[0].startColumn).toBe(5);
    expect(d[0].endColumn).toBe(6);
  });

  it("ink(3) with leading spaces — column offset correct", () => {
    // "  ink(3)" → 'i' at col3 (1-based), '3' at col7
    const d = deco("  ink(3)");
    expect(d[0].startColumn).toBe(7);
    expect(d[0].endColumn).toBe(8);
  });

  it("attr(4, 2) — ink digit at correct column", () => {
    // "attr(4, 2)" → 'a'=col1, '4'=col6
    const d = deco("attr(4, 2)");
    expect(d[0].startColumn).toBe(6);  // ink '4'
    expect(d[0].endColumn).toBe(7);
  });

  it("attr(4, 2) — paper digit at correct column", () => {
    // "attr(4, 2)" → '2'=col9
    const d = deco("attr(4, 2)");
    expect(d[1].startColumn).toBe(9);  // paper '2'
    expect(d[1].endColumn).toBe(10);
  });

  it("handles attr where ink == paper (same digit)", () => {
    // "attr(2, 2)" — both args are '2', must find each at distinct positions
    const d = deco("attr(2, 2)");
    expect(d).toHaveLength(2);
    expect(d[0].startColumn).toBe(6);  // first '2'
    expect(d[1].startColumn).toBe(9);  // second '2'
    // Both have red color (non-bright red)
    expect(d[0]).toMatchObject({ r: 204, g: 0, b: 0 });
    expect(d[1]).toMatchObject({ r: 204, g: 0, b: 0 });
  });

  it("correct line numbers for multi-line input", () => {
    const d = deco(["nop", "ink(2)", "paper(3)"]);
    expect(d[0].line).toBe(2);   // ink(2) on line 2
    expect(d[1].line).toBe(3);   // paper(3) on line 3
  });

  it("multiple color calls on same line both detected", () => {
    const d = deco("ld a, ink(4) | paper(1)");
    expect(d).toHaveLength(2);
  });

  // ── nearestZxIndex ────────────────────────────────────────────────────────

  it("nearestZxIndex(0,0,0) → 0 (black)", () => {
    expect(nearestZxIndex(0, 0, 0)).toBe(0);
  });

  it("nearestZxIndex(255,255,255) → 7 (white)", () => {
    expect(nearestZxIndex(255, 255, 255)).toBe(7);
  });

  it("nearestZxIndex for bright red → 2", () => {
    expect(nearestZxIndex(255, 0, 0)).toBe(2);
  });

  it("nearestZxIndex for bright green → 4", () => {
    expect(nearestZxIndex(0, 255, 0)).toBe(4);
  });

  it("nearestZxIndex for bright blue → 1", () => {
    expect(nearestZxIndex(0, 0, 255)).toBe(1);
  });

  it("nearestZxIndex for bright magenta → 3", () => {
    expect(nearestZxIndex(255, 0, 255)).toBe(3);
  });

  it("nearestZxIndex for bright yellow → 6", () => {
    expect(nearestZxIndex(255, 255, 0)).toBe(6);
  });

  it("nearestZxIndex for bright cyan → 5", () => {
    expect(nearestZxIndex(0, 255, 255)).toBe(5);
  });

  it("nearestZxIndex maps mid-gray to white (7)", () => {
    // 128,128,128 is closer to white (204,204,204) than to black (0,0,0)
    // dist to 7 = 3*(128-204)^2 = 3*5776 = 17328
    // dist to 0 = 3*128^2 = 49152
    expect(nearestZxIndex(128, 128, 128)).toBe(7);
  });
});
