/**
 * Asserts that the custom Z80 (`z80klive`) Shiki grammar and theme actually applied
 * to the built documentation site.
 *
 * Why this exists: the docs contain 436 `z80klive` code blocks whose highlighting
 * depends on a non-serializable `getHighlighter` function in next.config.mjs.
 * Next.js 16 makes Turbopack the default builder, Turbopack silently ignores
 * non-serializable Nextra options, and Nextra 4 sets a top-level `turbopack` key
 * that suppresses Next's own "webpack config found" guard. The result would be a
 * green build with every Z80 code block rendered as flat unstyled text.
 *
 * A route/asset diff cannot catch that - the pages still exist, they just lose
 * their colours - so this checks the rendered token colours directly.
 *
 * See R1 in .plans/NEXTRA_4_NEXT_16_DOCS_MIGRATION_PLAN.md.
 *
 * Usage:
 *   node scripts/check-docs-highlighting.cjs
 *   node scripts/check-docs-highlighting.cjs --update   # re-baseline the minimums
 */
const { existsSync, readFileSync, readdirSync, writeFileSync } = require("node:fs");
const { join, relative, sep } = require("node:path");

const repoRoot = join(__dirname, "..");
const outDir = join(repoRoot, "docs", "out");
const baselineFile = join(repoRoot, ".plans", "docs-highlighting.golden.json");

/**
 * Token colours from `customTheme` in docs/next.config.mjs. Each is produced only
 * by the custom grammar, so a zero count means the grammar was not applied.
 */
const TOKENS = [
  { color: "569cd6", scope: "keyword.control.z80klive", example: "ld, jp, call" },
  { color: "c586c0", scope: "keyword.control.pragma.z80klive", example: ".org, .defb" },
  { color: "4d8061", scope: "constant.numeric", example: "#6000, 42" },
  { color: "b5890f", scope: "variable.other.identifier.z80klive", example: "labels" },
  { color: "6a9955", scope: "comment", example: "; comment" },
  { color: "ff6b35", scope: "string", example: '"text"' }
];

/** Tolerance for content edits that legitimately add or remove a few code blocks. */
const SLACK = 0.8;

function htmlFiles(dir) {
  const found = [];
  const visit = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.name.endsWith(".html")) found.push(full);
    }
  };
  visit(dir);
  return found;
}

function countTokens() {
  const counts = Object.fromEntries(TOKENS.map((t) => [t.color, 0]));
  let filesWithHighlighting = 0;

  for (const file of htmlFiles(outDir)) {
    const html = readFileSync(file, "utf8").toLowerCase();
    let hit = false;
    for (const { color } of TOKENS) {
      const matches = html.split(`color:#${color}`).length - 1;
      counts[color] += matches;
      if (matches) hit = true;
    }
    if (hit) filesWithHighlighting += 1;
  }
  return { counts, filesWithHighlighting };
}

function checkDocsHighlighting({ update = false } = {}) {
  if (!existsSync(outDir)) {
    throw new Error(`No build output at ${outDir}. Run 'npm run doc:build' first.`);
  }

  const { counts, filesWithHighlighting } = countTokens();

  if (update) {
    writeFileSync(baselineFile, JSON.stringify({ counts, filesWithHighlighting }, null, 2) + "\n");
    console.log(`Re-baselined -> ${relative(repoRoot, baselineFile)}`);
    console.log(JSON.stringify({ counts, filesWithHighlighting }, null, 2));
    return true;
  }

  const baseline = JSON.parse(readFileSync(baselineFile, "utf8"));
  let failed = false;

  for (const { color, scope, example } of TOKENS) {
    const actual = counts[color];
    const min = Math.floor(baseline.counts[color] * SLACK);
    const ok = actual >= min;
    if (!ok) failed = true;
    console.log(
      `  ${ok ? "OK  " : "FAIL"}  #${color}  ${String(actual).padStart(5)} (min ${min})  ${scope}  e.g. ${example}`
    );
  }

  const minFiles = Math.floor(baseline.filesWithHighlighting * SLACK);
  const filesOk = filesWithHighlighting >= minFiles;
  if (!filesOk) failed = true;
  console.log(
    `  ${filesOk ? "OK  " : "FAIL"}  pages with highlighted code: ${filesWithHighlighting} (min ${minFiles})`
  );

  if (failed) {
    console.error(
      "\nThe custom z80klive grammar/theme did not apply to the built site.\n" +
        "Most likely cause: the build ran under Turbopack, which silently drops the\n" +
        "non-serializable `getHighlighter` in docs/next.config.mjs.\n" +
        "Fix: make sure the docs build runs `next build --webpack`.\n" +
        "If the drop is a legitimate content change, re-baseline with --update."
    );
  } else {
    console.log("\nCustom Z80 syntax highlighting is intact.");
  }
  return !failed;
}

if (require.main === module) {
  const ok = checkDocsHighlighting({ update: process.argv.includes("--update") });
  process.exit(ok ? 0 : 1);
}

module.exports = { checkDocsHighlighting, TOKENS };
