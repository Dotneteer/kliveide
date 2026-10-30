/**
 * Inline SVG in the documentation's MDX is JSX, not HTML: a presentation attribute is written in
 * camelCase (`fillOpacity`, `textAnchor`). The HTML spelling (`fill-opacity`) builds, and the static
 * export even renders it, but React rejects it at run time: `next dev` shows "Invalid DOM property
 * `fill-opacity`" on the page. The Videoton TVC video article had 47 of them.
 *
 * Code - fenced blocks and inline code - is not JSX, so it is left out.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const CONTENT = join(__dirname, "..", "..", "docs", "content");

// --- SVG presentation attributes React knows only in camelCase (aria-* and data-* stay hyphenated)
const HYPHENATED = [
  "alignment-baseline", "baseline-shift", "clip-path", "clip-rule", "color-interpolation", "dominant-baseline",
  "fill-opacity", "fill-rule", "flood-color", "flood-opacity", "font-family", "font-size", "font-style",
  "font-weight", "letter-spacing", "marker-end", "marker-mid", "marker-start", "paint-order", "shape-rendering",
  "stop-color", "stop-opacity", "stroke-dasharray", "stroke-dashoffset", "stroke-linecap", "stroke-linejoin",
  "stroke-miterlimit", "stroke-opacity", "stroke-width", "text-anchor", "text-decoration", "text-rendering",
  "vector-effect", "word-spacing", "writing-mode", "xlink:href", "xml:space"
];
const ATTRIBUTE = new RegExp(`\\s(${HYPHENATED.join("|")})=`);

function pages(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? pages(join(dir, e.name)) : /\.mdx$/.test(e.name) ? [join(dir, e.name)] : []
  );
}

/** Tags with a hyphenated SVG attribute, outside code: "line: <tag ...>" */
export function hyphenatedSvgAttributes(source: string): string[] {
  const blank = (s: string) => s.replace(/[^\n]/g, " ");
  const text = source
    .replace(/^([ \t]*)(```+|~~~+)[^\n]*\n[\s\S]*?^\1\2[ \t]*$/gm, blank)
    .replace(/`[^`\n]*`/g, blank);
  const found: string[] = [];
  for (const m of text.matchAll(/<[a-zA-Z][^<>]*>/g)) {
    const attr = m[0].match(ATTRIBUTE);
    if (attr) found.push(`${text.slice(0, m.index).split("\n").length}: ${attr[1]} in <${m[0].slice(1, 40)}`);
  }
  return found;
}

describe("inline SVG in the docs' MDX", () => {
  it("finds a hyphenated attribute in a tag, and not in code", () => {
    expect(hyphenatedSvgAttributes('<svg><rect fill-opacity="0.1" /></svg>')).toHaveLength(1);
    expect(hyphenatedSvgAttributes('<svg><rect fillOpacity="0.1" aria-label="x" /></svg>')).toEqual([]);
    expect(hyphenatedSvgAttributes('```xml\n<rect fill-opacity="0.1" />\n```\nand `<text font-size="9">`')).toEqual([]);
  });

  it("writes every presentation attribute in camelCase", () => {
    const problems = pages(CONTENT).flatMap((file) =>
      hyphenatedSvgAttributes(readFileSync(file, "utf8")).map((p) => `${relative(CONTENT, file)}:${p}`)
    );
    expect(problems).toEqual([]);
  });
});
