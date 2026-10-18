/**
 * Refreshes the website's self-hosted typefaces: docs/fonts/*.woff2, their OFL licences, and the
 * generated docs/app/fonts.ts that loads them with next/font/local.
 *
 * The site used next/font/google, which fetches the fonts from Google during every build. Google
 * sometimes answers with font URLs next/font cannot parse (no `.woff2` ending), which failed the
 * docs build of the v0.64.0 release ("TypeError: Cannot read properties of null (reading '1')" in
 * next/font's google loader). The files are now committed, so a build never touches the network
 * for fonts. Run this by hand when the fonts should be updated, then build and look at the site.
 *
 * It keeps Google's own split: per family, one woff2 per subset (latin, latin-ext) with Google's
 * unicode-range, so a page loads latin-ext glyphs (Hungarian ő/ű, ...) only when it uses them.
 * All three families are variable fonts: one file per subset covers every weight.
 *
 * Usage: node scripts/build-doc-fonts.cjs
 */
const { mkdirSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

const repoRoot = join(__dirname, "..");
const fontsDir = join(repoRoot, "docs", "fonts");
const fontsModule = join(repoRoot, "docs", "app", "fonts.ts");

/** A modern browser, so Google serves woff2 (next/font sends the same) */
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36";
const SUBSETS = ["latin", "latin-ext"];

/** The typefaces (decision D8 of .plans/DOCS_SITE_MODERNIZATION_PLAN.md) */
const FAMILIES = [
  { name: "Schibsted Grotesk", id: "display", variable: "--font-display", weights: [500, 700, 800], ofl: "schibstedgrotesk" },
  { name: "IBM Plex Sans", id: "body", variable: "--font-body", weights: [400, 500, 600], ofl: "ibmplexsans" },
  { name: "JetBrains Mono", id: "mono", variable: "--font-mono", weights: [400, 600], ofl: "jetbrainsmono" }
];

const slug = (name) => name.toLowerCase().replace(/\s+/g, "-");

async function fetchOk(url, what) {
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`${what}: HTTP ${response.status} for ${url}`);
  return response;
}

/** The latin and latin-ext faces of Google's CSS: { subset -> { url, unicodeRange } } */
async function facesOf(family) {
  const url = `https://fonts.googleapis.com/css2?family=${family.name.replace(/ /g, "+")}:wght@${family.weights.join(";")}&display=swap`;
  const css = await (await fetchOk(url, family.name)).text();
  const faces = {};
  for (const m of css.matchAll(/\/\*\s*([a-z-]+)\s*\*\/\s*@font-face\s*\{([^}]*)\}/g)) {
    const [, subset, body] = m;
    if (!SUBSETS.includes(subset)) continue;
    const src = /src:\s*url\(([^)]+)\)/.exec(body)?.[1];
    const range = /unicode-range:\s*([^;]+);/.exec(body)?.[1]?.trim();
    if (!src || !range) throw new Error(`${family.name} ${subset}: no src or unicode-range in Google's CSS`);
    if (!/\.woff2$/.test(src)) throw new Error(`${family.name} ${subset}: Google served ${src}, not a .woff2 file; try again later`);
    const known = faces[subset];
    // --- Google repeats the face per weight; a variable font points every weight at one file
    if (known && known.url !== src) throw new Error(`${family.name} ${subset}: different files per weight; not a variable font`);
    faces[subset] = { url: src, unicodeRange: range };
  }
  for (const subset of SUBSETS) if (!faces[subset]) throw new Error(`${family.name}: Google's CSS has no ${subset} face`);
  return faces;
}

function fontCall(family, subset, file, unicodeRange) {
  const isMain = subset === "latin";
  const weight = `${Math.min(...family.weights)} ${Math.max(...family.weights)}`;
  return [
    `const ${family.id}${isMain ? "" : "Ext"} = localFont({`,
    `  src: [{ path: "../fonts/${file}", weight: "${weight}", style: "normal" }],`,
    `  declarations: [`,
    `    { prop: "font-family", value: "${family.name}" },`,
    `    { prop: "unicode-range", value: "${unicodeRange}" }`,
    `  ],`,
    // --- One variable per family, on the latin face; the latin-ext face shares the family name,
    // --- and its own variable only makes its CSS part of the page
    `  variable: "${isMain ? family.variable : `${family.variable}-ext`}",`,
    // --- The fallback face (Arial with metric overrides, next/font's own) comes from the latin file
    ...(isMain ? [] : [`  adjustFontFallback: false,`]),
    `  display: "swap"`,
    `});`
  ].join("\n");
}

async function main() {
  mkdirSync(fontsDir, { recursive: true });
  const calls = [];
  const names = [];
  for (const family of FAMILIES) {
    const faces = await facesOf(family);
    for (const subset of SUBSETS) {
      const file = `${slug(family.name)}-${subset}.woff2`;
      const bytes = Buffer.from(await (await fetchOk(faces[subset].url, `${family.name} ${subset}`)).arrayBuffer());
      writeFileSync(join(fontsDir, file), bytes);
      console.log(`  ${file} (${Math.round(bytes.length / 1024)} kB)`);
      calls.push(fontCall(family, subset, file, faces[subset].unicodeRange));
      names.push(`${family.id}${subset === "latin" ? "" : "Ext"}`);
    }
    const licence = await (await fetchOk(`https://raw.githubusercontent.com/google/fonts/main/ofl/${family.ofl}/OFL.txt`, `${family.name} licence`)).text();
    writeFileSync(join(fontsDir, `${slug(family.name)}-OFL.txt`), licence);
  }

  const module = `/**
 * The website's typefaces (decision D8): Schibsted Grotesk for headings, IBM Plex Sans for text,
 * JetBrains Mono for code and labels, served from the site itself, so visitors never fetch from
 * Google - and, since the files are committed (docs/fonts/, SIL Open Font License), neither does
 * the build.
 *
 * GENERATED by scripts/build-doc-fonts.cjs - run it to update the fonts; do not edit by hand.
 * next/font only accepts literal arguments, hence a generated module rather than a data file.
 *
 * Each family is Google's latin + latin-ext split: two faces with one family name and their own
 * unicode-range. Each exposes a CSS variable that app/tokens.css builds its font stacks on.
 */
import localFont from "next/font/local";

${calls.join("\n\n")}

/** The class names that define the font variables; put them on <html>. */
export const fontVariables = [${names.join(", ")}].map((font) => font.variable).join(" ");
`;
  writeFileSync(fontsModule, module);
  console.log(`Wrote ${names.length} faces and docs/app/fonts.ts`);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
