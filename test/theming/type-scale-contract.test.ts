import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * M1 and M2 — the two mandates that were documented as enforced and were not.
 *
 * `AGENTS.md` and `.plans/UI_MODERNIZATION_PLAN.md` §3.4 have said since Phase 0 that three rules
 * "have tests that will fail you": no `em` font sizes (M1), no px column widths (M2), no
 * component-private row heights (M3). Only M3 ever existed (`row-size-contract.test.ts`). Nothing
 * in the suite looked at a `font-size` or a width until this file.
 *
 * The cost was measurable rather than theoretical: **54 `em` font sizes across 28 files**, and the
 * largest single block of them — 19, better than a third — was written in the commit immediately
 * before this test: the seven NEX annotation dialogs, years after the mandate. A rule with no test
 * does not decay slowly; new code re-opens it at full rate.
 *
 * ## Why a baseline rather than zero
 *
 * Failing on all 57 would fail the build before a single panel could be converted, so this follows
 * `scripts/check-types.cjs`: the known offenders live in `build/style-mandate-baseline.json` and the
 * suite fails on anything *new*. Unlike that script, a count that has *dropped* also fails — with a
 * message saying exactly what to run. That is deliberate. This file exists to be a ratchet, and a
 * ratchet that lets the baseline drift above reality lets a fix be silently undone later.
 *
 *   npm run style:baseline
 *
 * The baseline is keyed by file and mandate, never by line, for the reason `check-types.cjs` gives:
 * line numbers go stale on the first unrelated edit to the file.
 *
 * ## Why M2's rule is so much narrower than M1's
 *
 * M1 is syntactically decidable: `font-size: 0.8em` is a violation wherever it appears.
 *
 * M2 is not, and the attempt to make it so is worth recording so nobody repeats it. Two heuristics
 * were tried and both were dropped:
 *
 * - *px widths in any stylesheet that mentions `--monospace-font` or `--panel-font-size`* produced
 *   16 hits of which about three were real. The rest were swatches, icons, a 2px prompt rail and a
 *   1px divider — all legitimately px, because **M2 governs columns, not chrome geometry**. A rule
 *   that is 80% false positives trains people to add allowlist entries instead of fixing code.
 * - *bare-number `width` on any cell, `LabelSeparator` included* produced 21 hits of which 19 were
 *   `<LabelSeparator width={8} />`. That component's own doc comment calls it "a spacer, not a
 *   label"; an 8px gap is not a column. Including it would have buried the one real violation.
 *
 * What is left is the one shape a regex can actually settle: a **numeric literal** passed as a
 * column width to a cell that reserves a column. Every other column width in the app is routed
 * through a named constant (`LAB_WIDTH`, `REG_LABEL_WIDTH`, `ADDRESS_WIDTH`), and whether those are
 * `ch` or px depends on the constant's *type* — `"7ch"` is a string and fine, `7` is a number and
 * becomes px. A text scan cannot see that. **The type system can**, and that is the real fix:
 * Phase 15 of `.plans/UI_MODERNIZATION_BATCH_2_PLAN.md` removes the number half of the `width` prop
 * so the unit is compiler-enforced. When it lands, `M2` here becomes redundant and should be
 * deleted rather than kept as decoration.
 */

const REPO = join(__dirname, "../..");
const SRC = join(REPO, "src", "renderer");
const BASELINE = join(REPO, "build", "style-mandate-baseline.json");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx?|scss)$/.test(full)) out.push(full);
  }
  return out;
}

/**
 * Blanks comments, preserving line structure, so prose *describing* a violation cannot be one.
 *
 * Several stylesheets document the `em` they removed (`Data.module.scss`, `Button.module.scss`,
 * `TextInput.module.scss`, `OutputPanel.module.scss`), and this file itself names `0.8em` a dozen
 * times. Without this, the rules would fire on their own explanations — which is exactly the trap
 * `NexAnnotationDialogConsistency.test.ts` already guards against the same way.
 *
 * The `[^:]` guard on the line-comment branch keeps `https://` out of it.
 */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/.*$/gm, (_m, lead: string) => lead);
}

/**
 * M1 — a `font-size` measured in `em`.
 *
 * `rem` is deliberately not matched: it resolves against the root, not the parent, so it cannot
 * compound the way M1 exists to prevent. The regex is safe against it without a lookbehind, because
 * `[\d.]+em` requires digits immediately before the `em` and `0.6rem` has an `r` there.
 *
 * **`calc(var(--some-size) * n)` is also allowed, and is the sanctioned form for a size that must
 * stay proportional to a named base.** Two exist. The register panel's flag letters are the
 * instructive one: `ch` columns in the same element scale with that element's font size, so pinning
 * the letters to a fixed step while the columns kept following the user's font-size setting would
 * break the width relationship the comment there spends a paragraph explaining. What M1 forbids is
 * a ratio against *whatever ancestor happens to set a size* — naming the base removes exactly that,
 * which is why this form passes and `em` does not. Do not "simplify" either of them to a scale step.
 */
const M1_STYLESHEET = /font-size\s*:\s*[^;{}]*?[\d.]+em\b/g;
/** The same rule for an inline style or a `fontSize` prop: `fontSize="0.8em"`, `fontSize: "1.2em"`. */
const M1_SOURCE = /fontSize\s*[=:]\s*(["'])[^"']*?[\d.]+em\1/g;

/**
 * Cells that reserve a column, and therefore owe their width in `ch`.
 *
 * `LabelSeparator` is absent on purpose — see the header. So is every control-sized thing
 * (`Dropdown`, `Icon`, `Button`): a control's width is chrome geometry, which M2 does not govern.
 */
const COLUMN_CELLS = [
  "Label",
  "Value",
  "Secondary",
  "DataLabel",
  "DataValue",
  "DataSecondary",
  "LabeledText",
  "LabeledValue",
  "LabeledFlag",
  "HexValue",
  "AddressLabel"
].join("|");

/**
 * Matched in two steps so the count is per *prop*, not per element.
 *
 * `<LabeledFlag labelWidth={36} valueWidth={20} />` is two columns to fix, and a single regex over
 * the whole tag reports it as one — so clearing both would move the baseline by one and leave slack
 * behind. `M2_CELL_TAG` finds the opening tag; `M2_WIDTH_PROP` counts the offending props in it.
 */
const M2_CELL_TAG = new RegExp(`<(?:${COLUMN_CELLS})\\b[^>]*?/?>`, "gs");
/**
 * A px column width, in either form a call site can write it.
 *
 * `width={16}` was the only shape until Phase 15 removed the bare-number form from the
 * `controls/layout` cells. Converting those call sites to explicit `"16px"` strings preserved
 * every rendered width exactly — but it would also have made them invisible to this rule, so
 * the px-string form is matched too. That is the whole point of the conversion: the unit is
 * now written at the call site, which means it can be both read and counted.
 */
const M2_WIDTH_PROP =
  /\b(?:width|labelWidth|valueWidth)=(?:\{\s*[0-9]+\s*\}|["'][\d.]+px["'])/g;

/**
 * A column width held in a named constant, e.g. `const HEADER_LABEL_WIDTH = "160px";`.
 *
 * Phase 15 turned eight bare numbers into px strings to make their unit explicit without changing
 * what they render. That is real M2 debt owned by the panels' own phases, and without this rule it
 * would be untracked — the call sites pass the identifier, so `M2_WIDTH_PROP` never sees it.
 *
 * Safe to match on the name alone: every `*WIDTH` constant in the app is either a px string (these
 * eight) or a `ch` string, and the `ch` ones are what the rule wants. The keyboards' numeric
 * `NORMAL_WIDTH`/`DEFAULT_WIDTH` are SVG geometry, not column widths, and are numbers rather than
 * px strings, so they do not match.
 */
const M2_WIDTH_CONST = /\b[A-Z][A-Z0-9_]*WIDTH\s*=\s*["'][\d.]+px["']/g;

/** Every px column width in `source`, as written. */
function pxColumnWidths(source: string): string[] {
  return [
    ...[...source.matchAll(M2_CELL_TAG)].flatMap((tag) =>
      [...tag[0].matchAll(M2_WIDTH_PROP)].map((prop) => `${tag[0].match(/<\w+/)?.[0]} … ${prop[0]}`)
    ),
    ...[...source.matchAll(M2_WIDTH_CONST)].map((m) => m[0])
  ];
}

type Offence = { key: string; detail: string };

function scan(): { counts: Record<string, number>; detail: Record<string, string[]> } {
  const offences: Offence[] = [];
  for (const file of walk(SRC)) {
    const name = relative(SRC, file).split(sep).join("/");
    const text = code(readFileSync(file, "utf8"));
    const isStylesheet = file.endsWith(".scss");

    for (const m of text.matchAll(isStylesheet ? M1_STYLESHEET : M1_SOURCE)) {
      offences.push({ key: `${name}::M1`, detail: m[0].trim() });
    }
    if (file.endsWith(".tsx")) {
      for (const hit of pxColumnWidths(text)) {
        offences.push({ key: `${name}::M2`, detail: hit.replace(/\s+/g, " ") });
      }
    }
  }

  const counts: Record<string, number> = {};
  const detail: Record<string, string[]> = {};
  for (const { key, detail: d } of offences) {
    counts[key] = (counts[key] ?? 0) + 1;
    (detail[key] ??= []).push(d);
  }
  return { counts, detail };
}

const UPDATE_COMMAND = "npm run style:baseline";

describe("type scale and column width contract (M1, M2)", () => {
  const { counts, detail } = scan();

  if (process.env.UPDATE_STYLE_BASELINE) {
    it("rewrites the baseline", () => {
      const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
      writeFileSync(
        BASELINE,
        `${JSON.stringify(
          {
            $comment:
              "Known M1 (em font sizes) and M2 (px column widths) violations, keyed by file and " +
              "mandate. The suite fails on anything NOT listed here, and on any count that has " +
              "dropped — clearing entries is how a modernization phase proves it finished. " +
              `Regenerate with \`${UPDATE_COMMAND}\`. See test/theming/type-scale-contract.test.ts.`,
            updated: new Date().toISOString().slice(0, 10),
            total,
            entries: Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)))
          },
          null,
          2
        )}\n`
      );
      expect(existsSync(BASELINE)).toBe(true);
    });
    return;
  }

  it("has a baseline to compare against", () => {
    expect(existsSync(BASELINE), `No baseline at ${BASELINE}. Create one with:\n  ${UPDATE_COMMAND}`).toBe(
      true
    );
  });

  const baseline: Record<string, number> = existsSync(BASELINE)
    ? JSON.parse(readFileSync(BASELINE, "utf8")).entries ?? {}
    : {};

  it("introduces no new em font size or px column width", () => {
    const added = Object.entries(counts)
      .filter(([key, count]) => count > (baseline[key] ?? 0))
      .map(([key, count]) => {
        const known = baseline[key] ?? 0;
        return `${key}: ${known} known -> ${count} now\n      ${detail[key].slice(known).join("\n      ")}`;
      });

    expect(
      added,
      "New M1/M2 violations. M1: use the `--font-size-*` ladder, never `em` — it compounds, and it " +
        "once made the sidebar's own title smaller than the panel headers inside it. M2: give a " +
        "column its width in `ch`, as a string.\n\n" +
        added.join("\n    ")
    ).toEqual([]);
  });

  it("has a baseline no larger than reality", () => {
    // --- The ratchet. A cleared violation must clear its baseline entry in the same change, or the
    // --- slack it leaves behind lets the next edit put the violation back for free.
    const stale = Object.entries(baseline)
      .filter(([key, known]) => (counts[key] ?? 0) < known)
      .map(([key, known]) => `${key}: ${known} recorded -> ${counts[key] ?? 0} actual`);

    expect(
      stale,
      `${stale.length} baseline entr(y/ies) now overstate the code — nice. Lock it in:\n  ` +
        `${UPDATE_COMMAND}\n\n    ${stale.join("\n    ")}`
    ).toEqual([]);
  });

  it("counts a violation in prose as no violation at all", () => {
    // --- Pins the comment blanking. Without it this very file, and the four stylesheets that
    // --- document the `em` they removed, would each fail the rule they explain.
    const scss = code("/* was font-size: 0.8em */\n.a { color: red; }\n// font-size: 1em\n");
    expect(scss).not.toMatch(M1_STYLESHEET);
    expect(code("const url = \"https://x.y\";")).toContain("https://x.y");
    // --- And that a real declaration beside the prose still counts.
    expect(code("/* font-size: 0.8em */\n.a { font-size: 0.9em; }")).toMatch(M1_STYLESHEET);
  });

  it("does not mistake rem for em", () => {
    expect("font-size: 0.6rem;").not.toMatch(M1_STYLESHEET);
    expect("font-size: 0.6em;").toMatch(M1_STYLESHEET);
  });

  it("allows a ratio against a named base, but not against an unknown ancestor", () => {
    // --- See the header: a `calc()` on a token names what it is proportional to, so it cannot
    // --- compound. `em` cannot say that, which is the whole of M1.
    expect("font-size: calc(var(--panel-font-size) * 1.25);").not.toMatch(M1_STYLESHEET);
    expect("font-size: calc(var(--font-size-tooltip) * 0.9);").not.toMatch(M1_STYLESHEET);
    expect("font-size: 1.25em;").toMatch(M1_STYLESHEET);
  });

  it("governs columns, not spacers or controls", () => {
    // --- The two heuristics rejected in the header, pinned so they are not reintroduced as
    // --- "improvements". A spacer and a control are not columns.
    expect(pxColumnWidths('<LabelSeparator width={8} />')).toEqual([]);
    expect(pxColumnWidths('<Dropdown options={o} width={140} />')).toEqual([]);
    expect(pxColumnWidths('<Label text="CntC" width="16ch" />')).toEqual([]);
    expect(pxColumnWidths('<Label text="CntC" width={16} />')).toHaveLength(1);
    expect(pxColumnWidths('<Label text="CntC" width="16px" />')).toHaveLength(1);
    // --- A column width parked in a constant is still a column width.
    expect(pxColumnWidths('const HEADER_LABEL_WIDTH = "160px";')).toHaveLength(1);
    expect(pxColumnWidths('const LAB_WIDTH = "7ch";')).toEqual([]);
    expect(pxColumnWidths('const NORMAL_WIDTH = 75;')).toEqual([]);
  });

  it("counts a px column width per prop, not per element", () => {
    // --- `<LabeledFlag labelWidth={36} valueWidth={20} />` is two columns to fix. Counting the
    // --- element once would let a two-prop fix move the baseline by one and leave slack behind.
    expect(pxColumnWidths("<LabeledFlag labelWidth={36} valueWidth={20} />")).toHaveLength(2);
  });
});
