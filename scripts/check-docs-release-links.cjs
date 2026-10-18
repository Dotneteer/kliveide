/**
 * Keeps release versions out of the documentation's sources (D8 of
 * .plans/RELEASE_AUTOMATION_PLAN.md):
 *
 * 1. No page under docs/content/ links a particular release (`releases/download/v1.2.3/...`,
 *    `releases/tag/v1.2.3`). Write `@KLIVE_RELEASE@` instead; docs/remark-release-version.mjs
 *    replaces it with the latest release on every build, and a release redeploys the site.
 *    The generated "What's new" page is exempt: it quotes the CHANGELOG.
 * 2. No built page (docs/out/) still contains the token, which would mean the remark plugin was
 *    lost - the pages would build fine and show a placeholder.
 *
 * Usage: node scripts/check-docs-release-links.cjs   (after npm run doc:build, for check 2)
 */
const { existsSync, readdirSync, readFileSync } = require("node:fs");
const { join, relative } = require("node:path");

const repoRoot = join(__dirname, "..");
const contentDir = join(repoRoot, "docs", "content");
const outDir = join(repoRoot, "docs", "out");
const TOKEN = "@KLIVE_RELEASE@";
const RELEASE_LINK = /releases\/(?:download|tag)\/v\d+\.\d+\.\d+/g;

function files(dir, extensions) {
  const found = [];
  const visit = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (extensions.some((ext) => entry.name.endsWith(ext))) found.push(full);
    }
  };
  if (existsSync(dir)) visit(dir);
  return found;
}

const problems = [];
for (const file of files(contentDir, [".mdx", ".md"])) {
  if (/whats-new\.mdx$/.test(file)) continue;
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, i) => {
      for (const m of line.matchAll(RELEASE_LINK)) {
        problems.push(`${relative(repoRoot, file)}:${i + 1}: links release ${m[0]}; use ${TOKEN} for the version`);
      }
    });
}

const built = files(outDir, [".html", ".txt"]);
for (const file of built) {
  if (readFileSync(file, "utf8").includes(TOKEN)) {
    problems.push(`${relative(repoRoot, file)}: the built page still contains ${TOKEN} (is remarkReleaseVersion in docs/next.config.mjs?)`);
  }
}

if (problems.length) {
  console.error(problems.join("\n"));
  console.error(`\n${problems.length} release-link problem(s).`);
  process.exit(1);
}
console.log(`release links: content/ links no particular release; ${built.length} built file(s) carry no ${TOKEN}`);
