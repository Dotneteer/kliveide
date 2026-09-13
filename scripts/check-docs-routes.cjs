/**
 * Diffs the built documentation site against the golden snapshots captured in
 * Phase 0 of .plans/NEXTRA_4_NEXT_16_DOCS_MIGRATION_PLAN.md.
 *
 * The golden files are the machine-checkable definition of "the docs site still
 * works". Every phase of the Nextra 4 / Next 16 migration diffs against them, so a
 * route or image that silently disappears during the migration fails the build
 * instead of shipping.
 *
 * Usage:
 *   node scripts/check-docs-routes.cjs             # removals fail, additions warn
 *   node scripts/check-docs-routes.cjs --strict    # additions fail too
 *   node scripts/check-docs-routes.cjs --update    # re-baseline the golden files
 *
 * Re-baselining is deliberate and rare: Phase 4 removes the bogus `_meta` routes
 * that the Nextra 3 Pages Router leaks into the export. Any other diff is a
 * regression.
 */
const { existsSync, readdirSync, readFileSync, statSync, writeFileSync } = require("node:fs");
const { join, relative, sep } = require("node:path");

const repoRoot = join(__dirname, "..");
const outDir = join(repoRoot, "docs", "out");

const SNAPSHOTS = [
  {
    name: "routes",
    golden: join(repoRoot, ".plans", "docs-routes.golden.txt"),
    collect: () => walk(outDir).filter((p) => p.endsWith(".html"))
  },
  {
    name: "assets",
    golden: join(repoRoot, ".plans", "docs-assets.golden.txt"),
    collect: () =>
      walk(outDir).filter((p) => p.startsWith("/images/") || p === "/next-examples.zip")
  }
];

/** Returns every file under `dir` as a site-absolute, POSIX-style path. */
function walk(dir) {
  const results = [];
  const visit = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) visit(full);
      else results.push("/" + relative(dir, full).split(sep).join("/"));
    }
  };
  visit(dir);
  return results.sort();
}

function readGolden(file) {
  return readFileSync(file, "utf8").split("\n").filter(Boolean);
}

function checkDocsRoutes({ strict = false, update = false } = {}) {
  if (!existsSync(outDir) || !statSync(outDir).isDirectory()) {
    throw new Error(`No build output at ${outDir}. Run 'npm run doc:build' first.`);
  }

  let failed = false;

  for (const { name, golden, collect } of SNAPSHOTS) {
    const actual = collect();

    if (update) {
      writeFileSync(golden, actual.join("\n") + "\n");
      console.log(`[${name}] re-baselined ${actual.length} entries -> ${relative(repoRoot, golden)}`);
      continue;
    }

    const expected = readGolden(golden);
    const actualSet = new Set(actual);
    const expectedSet = new Set(expected);
    const missing = expected.filter((p) => !actualSet.has(p));
    const added = actual.filter((p) => !expectedSet.has(p));

    if (missing.length) {
      failed = true;
      console.error(`\n[${name}] ${missing.length} entr${missing.length === 1 ? "y" : "ies"} MISSING from the build:`);
      for (const p of missing) console.error(`  - ${p}`);
    }
    if (added.length) {
      if (strict) failed = true;
      const label = strict ? "error" : "note";
      console[strict ? "error" : "log"](
        `\n[${name}] ${added.length} new entr${added.length === 1 ? "y" : "ies"} (${label}):`
      );
      for (const p of added) console[strict ? "error" : "log"](`  + ${p}`);
    }
    if (!missing.length && !added.length) {
      console.log(`[${name}] OK - ${actual.length} entries match the golden snapshot.`);
    }
  }

  if (failed) {
    console.error(
      "\nThe built docs site diverges from the golden snapshot.\n" +
        "If this change is intended, re-baseline with:\n" +
        "  node scripts/check-docs-routes.cjs --update\n" +
        "and explain why in the commit message."
    );
  }
  return !failed;
}

if (require.main === module) {
  const ok = checkDocsRoutes({
    strict: process.argv.includes("--strict"),
    update: process.argv.includes("--update")
  });
  process.exit(ok ? 0 : 1);
}

module.exports = { checkDocsRoutes, walk };
