/**
 * The documentation's wording check (scripts/check-docs-prose.cjs, step 4 of
 * .plans/HALLMARK_SITE_POLISH_PLAN.md): what it reports, and the uses it must leave alone - each
 * exemption here was a false positive on a real page.
 */
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { proseFindings } = require("../../scripts/check-docs-prose.cjs");

type Finding = { line: number; column: number; rule: string; match: string };
const rules = (source: string) => (proseFindings(source) as Finding[]).map((f) => `${f.rule}:${f.match}`);

describe("check-docs-prose", () => {
  it("reports buzzwords, filler and the opener phrases", () => {
    expect(rules("A powerful way to work, seamlessly.")).toEqual(["buzzword:powerful", "buzzword:seamlessly"]);
    expect(rules("Let's start. Simply press Run.")).toEqual(["filler:Let's", "filler:Simply"]);
    expect(rules("Note that it stops. Whether you like it or not.")).toEqual(["filler:Note that", "filler:Whether you"]);
  });

  it("leaves 'note that' and 'whether you' alone inside a sentence", () => {
    expect(rules("It plays a note that was never there.")).toEqual([]);
    expect(rules("The default depends on whether you use `.model next`.")).toEqual([]);
  });

  it("reports 'just' only where it adds nothing", () => {
    expect(rules("Just press F5.")).toEqual(["just:Just"]);
    expect(rules("Turn on **Just My Code**.")).toEqual([]);
    expect(rules("Click just left of the line number.")).toEqual([]);
    expect(rules("What your code has just drawn.")).toEqual([]);
    expect(rules("Not just the registers.")).toEqual([]);
    expect(rules("It stops just after the interrupt.")).toEqual([]);
  });

  it("reports em dashes and spaced en dashes, and keeps ranges", () => {
    expect(rules("Extract it — the files sit at the root.")).toEqual(["dash:—"]);
    expect(rules("How Klive does it &mdash; keyframes.")).toEqual(["dash:&mdash;"]);
    expect(rules("A pause – then it goes on.")).toEqual(["dash:–"]);
    expect(rules("Pages 1–3, letters A–Z.")).toEqual([]);
    expect(rules("The ROM at `$0000`–`$3FFF`.")).toEqual([]);
  });

  it("keeps a dash that is a whole table cell", () => {
    expect(rules("| `IFF1` | ✓ | &mdash; |\n| `IFF2` | — | ✓ |")).toEqual([]);
  });

  it("reports middle-dot meta strings and arrows glued to links", () => {
    expect(rules("Version 1 · macOS · free")).toEqual(["dots:1 · macOS · free"]);
    expect(rules("See [the guide →](/en/guides/)")).toEqual(["arrow-link:[the guide →]"]);
    expect(rules("Read [the guide](/en/guides/) →")).toEqual(["arrow-link:](/en/guides/) →"]);
    expect(rules("**Machine › Record** and History · step 4")).toEqual([]);
  });

  it("never reads code: fenced blocks, inline code (even wrapped), link targets, attributes", () => {
    const page = [
      "Text.",
      "",
      "```z80klive",
      "  .dw 0   ; block length — patched at runtime",
      "```",
      "",
      "The header says `Sprite #9 · drawn ·",
      "120,69` there. See [it](/en/just-simply/).",
      '<Shot src="a — b.webp" alt="It plays" />'
    ].join("\n");
    expect(rules(page)).toEqual([]);
  });

  it("reads the description in front matter, not the other keys", () => {
    expect(rules('---\ntitle: "Simply"\ndescription: "A powerful tool."\n---\n\n# Page')).toEqual(["buzzword:powerful"]);
  });

  it("skips a line marked prose-ok, on itself or the line above", () => {
    expect(rules("Simply put. {/* prose-ok: a quotation */}")).toEqual([]);
    expect(rules("{/* prose-ok: the manual's own words */}\nA powerful call.")).toEqual([]);
  });

  it("gives the line and column of each finding", () => {
    expect(proseFindings("One.\nTwo — three.")[0]).toMatchObject({ line: 2, column: 5, rule: "dash" });
  });
});
