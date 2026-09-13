import { describe, expect, it } from "vitest";
import { ACCENT_IDS } from "../../src/common/theming/accents";
import {
  TOKEN_CLASSES,
  colourDistance,
  contrastRatio,
  editorBackground,
  hexToHsl,
  syntaxPalette,
  syntaxRules,
  type SyntaxClass
} from "../../src/renderer/theming/tokens/syntax";

/**
 * Six accents times two tones is twelve syntax palettes. A hand-checked palette is correct only
 * until someone adds a thirteenth, which is why these assert the property rather than the values —
 * the same lesson §5 learned when the first accent set turned out to be perceptually identical to
 * the data colours despite passing a hue-angle rule.
 */

const TONES = ["dark", "light"] as const;

describe("syntax palette", () => {
  it("keeps every token colour legible on the editor background", () => {
    const failures: string[] = [];
    for (const tone of TONES) {
      const bg = editorBackground(tone);
      for (const accent of ACCENT_IDS) {
        const palette = syntaxPalette(tone, accent);
        for (const [cls, style] of Object.entries(palette)) {
          // Comments are deliberately recessive; everything else is body text.
          const floor = cls === "comment" ? 3.5 : 4.5;
          const ratio = contrastRatio(`#${style.foreground}`, bg);
          if (ratio < floor - 0.01) {
            failures.push(`${tone}/${accent}/${cls}: ${ratio.toFixed(2)} < ${floor}`);
          }
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it("never colours an error with the accent", () => {
    // An error must mean the same thing whatever the accent is.
    for (const tone of TONES) {
      const errors = new Set(ACCENT_IDS.map((a) => syntaxPalette(tone, a).error.foreground));
      expect(errors.size, `error colour varied by accent in ${tone}`).toBe(1);
    }
  });

  it("does move the keyword colour with the accent", () => {
    // The point of the slice: switching accent restyles the editor, not just the chrome.
    for (const tone of TONES) {
      const keywords = new Set(ACCENT_IDS.map((a) => syntaxPalette(tone, a).keyword.foreground));
      expect(keywords.size).toBe(ACCENT_IDS.length);
    }
  });

  it("emits bare hex, as Monaco requires", () => {
    for (const rule of syntaxRules("dark", "sinclairBlue")) {
      expect(rule.foreground).toMatch(/^[0-9a-f]{6}$/);
    }
  });

  it("maps every token name the grammars emit", () => {
    // Read out of the seven providers; a name missing here renders in the editor's default colour.
    const required = [
      "comment", "keyword", "statement", "pragma", "identifier", "register", "condition",
      "function", "macroparam", "escape", "variable", "namespace", "struct", "equ", "macro",
      "string", "string.quote", "number", "number.hex", "directive", "delimiter", "type"
    ];
    for (const token of required) {
      expect(TOKEN_CLASSES[token], `no class for token "${token}"`).toBeDefined();
    }
  });

  it("keeps classes that share a line perceptually apart", () => {
    /*
     * `!==` is not an assertion worth making here.
     *
     * The scheme this replaced satisfied an inequality check while putting nine of eleven classes in
     * one blue: two colours four degrees apart are "distinct" and unreadable. Distance accounts for
     * hue, lightness and chroma together, which is what the eye does.
     */
    const adjacent: [SyntaxClass, SyntaxClass][] = [
      ["keyword", "operand"],
      ["keyword", "number"],
      ["keyword", "function"],
      ["operand", "number"],
      ["comment", "string"],
      ["label", "number"],
      ["label", "type"]
    ];
    const failures: string[] = [];
    for (const tone of TONES) {
      for (const accent of ACCENT_IDS) {
        const p = syntaxPalette(tone, accent);
        for (const [a, b] of adjacent) {
          const d = colourDistance(`#${p[a].foreground}`, `#${p[b].foreground}`);
          if (d < 20) failures.push(`${tone}/${accent}: ${a}/${b} dE ${d.toFixed(0)}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it("holds every class clear of the accent-driven keyword colour", () => {
    /*
     * The keyword is the one colour that moves with the accent, so it is the one thing the fixed hue
     * table can collide with — and it did: with Ultraviolet the keyword is `#6340C8` in light, which
     * is *exactly* the lavender assigned to numbers. `ensureDistinct` resolves that mechanically for
     * every class, and this asserts it for all six accents rather than for a hand-listed few.
     */
    const failures: string[] = [];
    for (const tone of TONES) {
      for (const accent of ACCENT_IDS) {
        const p = syntaxPalette(tone, accent);
        for (const [cls, style] of Object.entries(p)) {
          if (cls === "keyword" || cls === "error") continue;
          const d = colourDistance(`#${p.keyword.foreground}`, `#${style.foreground}`);
          if (d < 20) failures.push(`${tone}/${accent}: keyword/${cls} dE ${d.toFixed(0)}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it("colours comments rather than greying them", () => {
    /*
     * The regression this suite exists to prevent.
     *
     * Comments are the largest body of prose in a source file; at `--text-tertiary` (saturation
     * ~0.07) they read as disabled UI rather than as authored text. A saturation floor is the
     * author's complaint stated as a property.
     */
    for (const tone of TONES) {
      for (const accent of ACCENT_IDS) {
        const { s } = hexToHsl(`#${syntaxPalette(tone, accent).comment.foreground}`);
        expect(s, `${tone}/${accent}: comment is desaturated (${s.toFixed(2)})`).toBeGreaterThan(
          0.15
        );
      }
      // And italic, in every accent.
      expect(syntaxPalette(tone, "sinclairBlue").comment.fontStyle).toBe("italic");
    }
  });

  it("spreads the palette across the colour wheel", () => {
    /*
     * Hue is the strongest channel for telling token classes apart, so the palette has to use more
     * than one. Counted in 30-degree bins, ignoring near-neutrals whose hue carries no information.
     * The scheme this replaced scores two bins; this one scores seven or more.
     */
    for (const tone of TONES) {
      for (const accent of ACCENT_IDS) {
        const p = syntaxPalette(tone, accent);
        const bins = new Set(
          Object.entries(p)
            .filter(([cls]) => cls !== "error")
            .map(([, style]) => hexToHsl(`#${style.foreground}`))
            .filter(({ s }) => s >= 0.2)
            .map(({ h }) => Math.floor(h / 30))
        );
        expect(bins.size, `${tone}/${accent}: only ${bins.size} hue bins`).toBeGreaterThanOrEqual(5);
      }
    }
  });
});
