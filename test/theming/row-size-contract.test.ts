import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { rowSizes, rowSizeTokens } from "../../src/renderer/theming/tokens/rowSizes";

/**
 * M3 — the row heights that CSS and JavaScript must agree on.
 *
 * `VirtualizedList` positions rows absolutely from an `itemSize` number while a stylesheet draws
 * them, so if the two disagree rows overlap or clip and no stylesheet change can fix it. `rowSizes`
 * exists to be the single source; these tests stop it quietly becoming one source among several,
 * which is exactly what happened between Phase 1 and slice 7.4 — the module was written, wired to
 * CSS, and the components went on reading private literals for six phases.
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
  it("emits a CSS custom property for every row size", () => {
    const tokens = rowSizeTokens();
    for (const [key, value] of Object.entries(rowSizes)) {
      expect(tokens[`--row-size-${key}`]).toBe(`${value}px`);
    }
  });

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

  it("keeps every padded row tall enough for a 12px monospace line plus its padding", () => {
    // The module's own rule: ~16px line box at --font-size-200, so 18px is the practical floor for
    // a row that also draws padding and a hover state.
    for (const [key, value] of Object.entries(rowSizes)) {
      if (LINE_BOX_ONLY.includes(key)) continue;
      expect(value, `row size "${key}" is too short for its text`).toBeGreaterThanOrEqual(18);
    }
  });

  it("keeps every row size at least one 12px monospace line box", () => {
    // Applies to the exceptions too: a console line may drop the padding, never the text.
    for (const [key, value] of Object.entries(rowSizes)) {
      expect(value, `row size "${key}" cannot fit a line of text`).toBeGreaterThanOrEqual(16);
    }
  });
});
