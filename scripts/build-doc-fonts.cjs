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
 * It keeps Google's own split: per family and style, one woff2 per subset (latin, latin-ext) with
 * Google's unicode-range, so a page loads latin-ext glyphs (Hungarian ő/ű, ...) only when it uses
 * them. Every family is a variable font: one file per subset and style covers every weight.
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

/**
 * The typefaces (decision R1 of .plans/DOCS_SITE_REDESIGN_PLAN.md): Overpass for headings and text,
 * with its real italic, and Overpass Mono for code. `italic` also fetches the italic files.
 */
const FAMILIES = [
  { name: "Overpass", id: "body", variable: "--font-body", weights: [400, 600, 700, 800], italic: true, ofl: "overpass" },
  { name: "Overpass Mono", id: "mono", variable: "--font-mono", weights: [400, 600], italic: false, ofl: "overpassmono" }
];

const slug = (name) => name.toLowerCase().replace(/\s+/g, "-");

async function fetchOk(url, what) {
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`${what}: HTTP ${response.status} for ${url}`);
  return response;
}

/** The latin and latin-ext faces of Google's CSS: { style -> { subset -> { url, unicodeRange } } } */
async function facesOf(family) {
  const styles = family.italic ? ["normal", "italic"] : ["normal"];
  const axis = family.italic
    ? `ital,wght@${[0, 1].flatMap((i) => family.weights.map((w) => `${i},${w}`)).join(";")}`
    : `wght@${family.weights.join(";")}`;
  const url = `https://fonts.googleapis.com/css2?family=${family.name.replace(/ /g, "+")}:${axis}&display=swap`;
  const css = await (await fetchOk(url, family.name)).text();
  const faces = Object.fromEntries(styles.map((style) => [style, {}]));
  for (const m of css.matchAll(/\/\*\s*([a-z-]+)\s*\*\/\s*@font-face\s*\{([^}]*)\}/g)) {
    const [, subset, body] = m;
    if (!SUBSETS.includes(subset)) continue;
    const style = /font-style:\s*(\w+)/.exec(body)?.[1] ?? "normal";
    const src = /src:\s*url\(([^)]+)\)/.exec(body)?.[1];
    const range = /unicode-range:\s*([^;]+);/.exec(body)?.[1]?.trim();
    if (!faces[style]) throw new Error(`${family.name}: unexpected ${style} face in Google's CSS`);
    if (!src || !range) throw new Error(`${family.name} ${style} ${subset}: no src or unicode-range in Google's CSS`);
    if (!/\.woff2$/.test(src)) throw new Error(`${family.name} ${subset}: Google served ${src}, not a .woff2 file; try again later`);
    const known = faces[style][subset];
    // --- Google repeats the face per weight; a variable font points every weight at one file
    if (known && known.url !== src) throw new Error(`${family.name} ${style} ${subset}: different files per weight; not a variable font`);
    faces[style][subset] = { url: src, unicodeRange: range };
  }
  for (const style of styles) {
    for (const subset of SUBSETS) {
      if (!faces[style][subset]) throw new Error(`${family.name}: Google's CSS has no ${style} ${subset} face`);
      if (faces[style][subset].unicodeRange !== faces.normal[subset].unicodeRange) {
        throw new Error(`${family.name} ${subset}: the italic face covers another unicode-range than the upright one`);
      }
    }
  }
  return faces;
}

/** One localFont call per subset; its `src` lists the subset's file in each style */
function fontCall(family, subset, files, unicodeRange) {
  const isMain = subset === "latin";
  const weight = `${Math.min(...family.weights)} ${Math.max(...family.weights)}`;
  return [
    `const ${family.id}${isMain ? "" : "Ext"} = localFont({`,
    `  src: [`,
    files.map(({ file, style }) => `    { path: "../fonts/${file}", weight: "${weight}", style: "${style}" }`).join(",\n"),
    `  ],`,
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
      const files = [];
      for (const style of Object.keys(faces)) {
        const file = `${slug(family.name)}${style === "italic" ? "-italic" : ""}-${subset}.woff2`;
        const bytes = Buffer.from(await (await fetchOk(faces[style][subset].url, `${family.name} ${style} ${subset}`)).arrayBuffer());
        writeFileSync(join(fontsDir, file), bytes);
        console.log(`  ${file} (${Math.round(bytes.length / 1024)} kB)`);
        files.push({ file, style });
      }
      calls.push(fontCall(family, subset, files, faces.normal[subset].unicodeRange));
      names.push(`${family.id}${subset === "latin" ? "" : "Ext"}`);
    }
    const licence = await (await fetchOk(`https://raw.githubusercontent.com/google/fonts/main/ofl/${family.ofl}/OFL.txt`, `${family.name} licence`)).text();
    writeFileSync(join(fontsDir, `${slug(family.name)}-OFL.txt`), licence);
  }

  const module = `/**
 * The website's typefaces (decision R1 of .plans/DOCS_SITE_REDESIGN_PLAN.md): Overpass for
 * headings and text, Overpass Mono for code, served from the site itself, so visitors never fetch
 * from Google - and, since the files are committed (docs/fonts/, SIL Open Font License), neither
 * does the build.
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
