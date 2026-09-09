import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import {
  ROW_SIZE_RATIOS,
  getRowSizes,
  rowSizes,
  rowSizeTokens
} from "../../src/renderer/theming/tokens/rowSizes";
import { PANEL_FONT_SIZES, DEFAULT_PANEL_FONT_SIZE } from "../../src/common/settings/font-sizes";

/**
 * M3 — the row heights that CSS and JavaScript must agree on.
 *
 * `VirtualizedList` positions rows absolutely from an `itemSize` number while a stylesheet draws
 * them, so if the two disagree rows overlap or clip and no stylesheet change can fix it. `rowSizes`
 * exists to be the single source; these tests stop it quietly becoming one source among several,
 * which is exactly what happened between Phase 1 and slice 7.4 — the module was written, wired to
 * CSS, and the components went on reading private literals for six phases.
 *
 * The heights are now derived from the panel font size, so every rule below is asserted at *every*
 * rung of the ladder rather than at the 12px they were originally written against. A size that
 * clips its own text is the same M3 failure whether the number was hardcoded or computed.
 */

const SRC = join(__dirname, "../../src/renderer");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|scss)$/.test(full)) out.push(full);
  }
  return out;
}

const FILES = walk(SRC);

describe("row size contract (M3)", () => {
  it.each(PANEL_FONT_SIZES.map((s) => s.value))(
    "emits a CSS custom property for every row size at %ipx",
    (size) => {
      const tokens = rowSizeTokens(size);
      for (const [key, value] of Object.entries(getRowSizes(size))) {
        expect(tokens[`--row-size-${key}`]).toBe(`${value}px`);
      }
    }
  );

  it("has no component-private row-height constant duplicating a row size", () => {
    // `const MEMORY_ROW_ITEM_SIZE = 20;` and `const DISASSEMBLY_ROW_ITEM_SIZE = 18;` were exactly
    // this: literals that had to match `rowSizes` with nothing enforcing it.
    const pattern = /const\s+[A-Z_]*ROW[A-Z_]*(?:SIZE|HEIGHT)\s*=\s*(\d+)\s*;/g;
    const offenders: string[] = [];
    for (const file of FILES) {
      if (file.endsWith("rowSizes.ts")) continue;
      const text = readFileSync(file, "utf8");
      for (const m of text.matchAll(pattern)) {
        offenders.push(`${relative(SRC, file)}: ${m[0].trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  /**
   * Rows that are a line box and nothing else, so the 18px floor below does not apply to them.
   *
   * Membership is opt-in and listed here rather than inferred, so a new row size defaults to the
   * strict floor and joining this list stays a deliberate decision with a reason in `rowSizes.ts`.
   */
  const LINE_BOX_ONLY = ["console"];

  /**
   * A monospace line box is about 4/3 of the type size — 16px at the 12px the original constants
   * were chosen against, which is where the 16px floor below came from. Expressing it as a ratio is
   * what lets the same rule be checked at every rung.
   */
  const LINE_BOX_RATIO = 4 / 3;
  /** A padded, hoverable row needs its line box plus room to breathe: 18px against 16px at 12px. */
  const PADDING_RATIO = 18 / 16;

  it.each(PANEL_FONT_SIZES.map((s) => s.value))(
    "keeps every padded row tall enough for its text plus padding at %ipx",
    (size) => {
      const lineBox = size * LINE_BOX_RATIO;
      for (const [key, value] of Object.entries(getRowSizes(size))) {
        if (LINE_BOX_ONLY.includes(key)) continue;
        expect(
          value,
          `row size "${key}" is too short for its text at a ${size}px panel font`
        ).toBeGreaterThanOrEqual(Math.floor(lineBox * PADDING_RATIO));
      }
    }
  );

  it.each(PANEL_FONT_SIZES.map((s) => s.value))(
    "keeps every row size at least one monospace line box at %ipx",
    (size) => {
      // Applies to the exceptions too: a console line may drop the padding, never the text.
      for (const [key, value] of Object.entries(getRowSizes(size))) {
        expect(
          value,
          `row size "${key}" cannot fit a line of text at a ${size}px panel font`
        ).toBeGreaterThanOrEqual(Math.floor(size * LINE_BOX_RATIO));
      }
    }
  );

  it("reproduces the original constants at the default panel font size", () => {
    // The values these ratios replaced. A user who never opens the menu must see no change at all,
    // and this is what pins that: 22/20/18/16 at 12px, exactly as they were written by hand.
    expect(getRowSizes(DEFAULT_PANEL_FONT_SIZE)).toEqual({
      list: 22,
      memory: 20,
      disassembly: 18,
      console: 16
    });
    expect(rowSizes).toEqual(getRowSizes(DEFAULT_PANEL_FONT_SIZE));
  });

  it("gives every row size a ratio, and every ratio a row size", () => {
    // Guards the shape rather than the numbers: a key added to one and not the other would emit a
    // CSS variable with no JS counterpart, or vice versa — M3's original failure mode.
    expect(Object.keys(getRowSizes(DEFAULT_PANEL_FONT_SIZE)).sort()).toEqual(
      Object.keys(ROW_SIZE_RATIOS).sort()
    );
  });

  it("grows every row monotonically with the panel font size", () => {
    // A larger font must never produce a shorter row - rounding included.
    const ladder = PANEL_FONT_SIZES.map((s) => s.value);
    for (const key of Object.keys(ROW_SIZE_RATIOS)) {
      for (let i = 1; i < ladder.length; i++) {
        const previous = getRowSizes(ladder[i - 1])[key as keyof typeof ROW_SIZE_RATIOS];
        const current = getRowSizes(ladder[i])[key as keyof typeof ROW_SIZE_RATIOS];
        expect(
          current,
          `row size "${key}" shrinks from ${ladder[i - 1]}px to ${ladder[i]}px`
        ).toBeGreaterThan(previous);
      }
    }
  });
});
