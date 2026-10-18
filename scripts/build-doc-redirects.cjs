/**
 * Writes a redirect stub for every documentation URL that moved.
 *
 * The site is a static export on GitHub Pages, which cannot answer with a 301. So
 * each old URL keeps an `index.html` that sends the visitor (and search engines) to
 * the new one: a `<meta http-equiv="refresh">`, a `<link rel="canonical">`, and a
 * plain link for anyone with meta refresh turned off. See R7 in
 * .plans/DOCS_SITE_MODERNIZATION_PLAN.md.
 *
 * The map is docs/redirects.json: { "/old/path/": "/new/path/" }, site-absolute,
 * without the base path. The stubs are listed in the route golden, so a page that
 * moves without an entry here fails `doc:check` as a missing route.
 *
 * Runs from docs' `postbuild`, before Pagefind; stubs carry
 * `data-pagefind-ignore="all"`, so they never show up in search.
 *
 * Usage: node scripts/build-doc-redirects.cjs
 */
const { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } = require("node:fs");
const { dirname, join } = require("node:path");

const repoRoot = join(__dirname, "..");
const docsDir = join(repoRoot, "docs");
const outDir = join(docsDir, "out");
const mapFile = join(docsDir, "redirects.json");

/** The base path the site was built with (same source as next.config.mjs). */
function basePath() {
  if (process.env.NEXT_PUBLIC_BASE_PATH !== undefined) return process.env.NEXT_PUBLIC_BASE_PATH;
  const envFile = join(docsDir, ".env.production");
  if (!existsSync(envFile)) return "";
  const m = readFileSync(envFile, "utf8").match(/^NEXT_PUBLIC_BASE_PATH=(.*)$/m);
  return m ? m[1].trim() : "";
}

/** The file a site path is served from, or undefined when nothing serves it. */
function servedFile(sitePath) {
  const clean = sitePath.split("#")[0];
  for (const candidate of [join(clean, "index.html"), clean, `${clean}.html`]) {
    const full = join(outDir, candidate);
    if (existsSync(full) && statSync(full).isFile()) return full;
  }
  return undefined;
}

function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function stub(target) {
  const href = escapeHtml(target);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Moved</title>
<meta name="robots" content="noindex">
<meta name="klive-redirect" content="1">
<link rel="canonical" href="${href}">
<meta http-equiv="refresh" content="0; url=${href}">
<script>location.replace(${JSON.stringify(target)} + location.hash);</script>
</head>
<body data-pagefind-ignore="all">
<p>This page has moved to <a href="${href}">${href}</a>.</p>
</body>
</html>
`;
}

function buildDocRedirects() {
  if (!existsSync(outDir)) {
    throw new Error(`No build output at ${outDir}. Run the docs build first.`);
  }
  const map = existsSync(mapFile) ? JSON.parse(readFileSync(mapFile, "utf8")) : {};
  const base = basePath();
  const problems = [];
  let written = 0;

  for (const [from, to] of Object.entries(map)) {
    if (!from.startsWith("/") || !from.endsWith("/")) {
      problems.push(`"${from}": an old path must be site-absolute and end with "/"`);
      continue;
    }
    if (!servedFile(to)) {
      problems.push(`"${from}" -> "${to}": the target is not a page of the build`);
      continue;
    }
    const file = join(outDir, from, "index.html");
    if (existsSync(file) && !readFileSync(file, "utf8").includes('name="klive-redirect"')) {
      problems.push(`"${from}": a real page is served there; a redirect would replace it`);
      continue;
    }
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, stub(`${base}${to}`));
    written += 1;
  }

  if (problems.length) {
    throw new Error(`docs/redirects.json has ${problems.length} problem(s):\n  ${problems.join("\n  ")}`);
  }
  console.log(`Wrote ${written} redirect stub${written === 1 ? "" : "s"}.`);
}

if (require.main === module) {
  try {
    buildDocRedirects();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = { buildDocRedirects };
