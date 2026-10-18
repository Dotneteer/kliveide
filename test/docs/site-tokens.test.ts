/**
 * The website's colours are the app's (decision D8 of .plans/DOCS_SITE_MODERNIZATION_PLAN.md):
 * docs/app/tokens.css must hold the same values as the app's L1 palette, in both tones, so a
 * palette change in the app cannot leave the site behind unnoticed.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ACCENTS, NEUTRAL } from "@renderer/theming/tokens/palette";

const css = readFileSync(join(__dirname, "..", "..", "docs", "app", "tokens.css"), "utf8");

/** The custom properties declared in the first block that matches `selector`. */
function block(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  expect(start, `tokens.css has no "${selector}" block`).toBeGreaterThanOrEqual(0);
  const body = css.slice(start, css.indexOf("}", start));
  return Object.fromEntries([...body.matchAll(/(--site-[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim().toLowerCase()]));
}

const MAP: [string, keyof (typeof NEUTRAL)["dark"]][] = [
  ["--site-bg", "canvas"],
  ["--site-chrome", "chrome"],
  ["--site-panel", "panel"],
  ["--site-raised", "raised"],
  ["--site-hover", "hover"],
  ["--site-line", "border"],
  ["--site-line-strong", "borderStrong"],
  ["--site-fg", "text"],
  ["--site-muted", "textSecondary"],
  ["--site-subtle", "textTertiary"]
];

describe("website tokens", () => {
  for (const [tone, selector] of [
    ["light", ":root"],
    ["dark", ":root.dark"],
    ["dark", ":root:not(.light)"]
  ] as const) {
    it(`match the app's ${tone} palette (${selector})`, () => {
      const tokens = block(selector);
      for (const [name, role] of MAP) expect(tokens[name], name).toBe(NEUTRAL[tone][role].toLowerCase());
      expect(tokens["--site-accent"]).toBe(ACCENTS.sinclairBlue.solid[tone].toLowerCase());
      expect(tokens["--site-on-accent"]).toBe(ACCENTS.sinclairBlue.onSolid[tone].toLowerCase());
    });
  }
});
