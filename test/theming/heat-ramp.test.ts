import { describe, expect, it } from "vitest";
import { semanticTokens } from "@renderer/theming/tokens/semantic";
import { componentAliases } from "@renderer/theming/tokens/componentAliases";
import { ACCENT_IDS, DEFAULT_ACCENT } from "@common/theming/accents";

/*
 * The memory heat map's ramp (`.plans/CODE_COVERAGE_AND_HEAT_MAP_PLAN.md` T9): in both tones and
 * whatever the accent, each kind's five steps move monotonically away from the panel surface, the
 * row's text stays legible (≥ 3:1) over the hottest step, and the ramp does not follow the accent.
 */

function channels(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
}

function luminance(hex: string): number {
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = channels(hex).map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const KINDS = ["exec", "read", "write"] as const;

describe("the heat ramp", () => {
  for (const tone of ["dark", "light"] as const) {
    const tokens = semanticTokens(tone, DEFAULT_ACCENT);
    const panel = tokens["--surface-panel"];
    const text = tokens["--text-primary"];

    for (const kind of KINDS) {
      const steps = [1, 2, 3, 4, 5].map((s) => tokens[`--heat-${kind}-${s}`]);

      it(`${tone} ${kind}: every step is an opaque colour`, () => {
        for (const s of steps) expect(s).toMatch(/^#[0-9a-f]{6}$/i);
      });

      it(`${tone} ${kind}: moves monotonically away from the panel`, () => {
        const distances = steps.map((s) => Math.abs(luminance(s) - luminance(panel)));
        for (let i = 1; i < distances.length; i++) expect(distances[i]).toBeGreaterThan(distances[i - 1]);
        const lums = steps.map(luminance);
        const rising = tone === "dark";
        for (let i = 1; i < lums.length; i++) {
          if (rising) expect(lums[i]).toBeGreaterThan(lums[i - 1]);
          else expect(lums[i]).toBeLessThan(lums[i - 1]);
        }
      });

      it(`${tone} ${kind}: the text stays legible over the hottest step`, () => {
        expect(contrast(text, steps[4])).toBeGreaterThanOrEqual(3);
      });

      it(`${tone} ${kind}: step 1 is visibly off the panel`, () => {
        expect(steps[0].toLowerCase()).not.toBe(panel.toLowerCase());
      });
    }

    it(`${tone}: the three kinds are told apart at every step`, () => {
      for (let s = 1; s <= 5; s++) {
        const [e, r, w] = KINDS.map((k) => tokens[`--heat-${k}-${s}`].toLowerCase());
        expect(new Set([e, r, w]).size).toBe(3);
      }
    });
  }

  it("does not follow the accent", () => {
    const ids = ACCENT_IDS as readonly string[];
    for (const tone of ["dark", "light"] as const) {
      const first = semanticTokens(tone, ids[0] as never);
      for (const id of ids.slice(1)) {
        const other = semanticTokens(tone, id as never);
        for (const k of KINDS) for (let s = 1; s <= 5; s++) expect(other[`--heat-${k}-${s}`]).toBe(first[`--heat-${k}-${s}`]);
      }
    }
  });

  it("is aliased at L4 for every kind and step", () => {
    for (const k of KINDS) {
      for (let s = 1; s <= 5; s++) expect(componentAliases[`--color-heat-${k}-${s}`]).toBe(`var(--heat-${k}-${s})`);
    }
  });
});
