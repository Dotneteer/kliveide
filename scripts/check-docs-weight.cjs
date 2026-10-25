/**
 * Fails a documentation page whose images weigh more than the budget.
 *
 * Screenshots are the site's heaviest content, and the generated ones multiply by language.
 * The budget keeps a page fast on a phone; a page that needs more images than this should be
 * split, or its images made smaller (`.webp` from the doc-shots harness, or a smaller
 * `displayWidth`). See §5 of .plans/DOCS_SITE_MODERNIZATION_PLAN.md.
 *
 * Usage: node scripts/check-docs-weight.cjs [--budget <MB>]
 */
const { existsSync, readdirSync, readFileSync, statSync } = require("node:fs");
const { join, relative, sep } = require("node:path");

const repoRoot = join(__dirname, "..");
const outDir = join(repoRoot, "docs", "out");
const DEFAULT_BUDGET_MB = 1.5;

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

function checkDocsWeight({ budgetMb = DEFAULT_BUDGET_MB } = {}) {
  if (!existsSync(outDir)) {
    throw new Error(`No build output at ${outDir}. Run 'npm run doc:build' first.`);
  }
  const budget = budgetMb * 1024 * 1024;
  const over = [];
  let heaviest = { bytes: 0, page: "" };
  for (const file of htmlFiles(outDir)) {
    const html = readFileSync(file, "utf8");
    // --- Images are referenced as /images/... (public) or /_next/static/media/... (imported);
    // --- the base path, if any, comes first
    // --- (Fonts are served from /_next/static/media too; only images count)
    // --- `src` loads with the page, and so does a <link href> (a preload); an <a href> to a
    // --- picture (the landing page's full-size links) loads only when it is clicked, so it is not
    // --- counted
    const urls = new Set(
      [...html.matchAll(/(?:\ssrc|<link\b[^>]*?\shref)="[^"]*?(\/images\/[^"]+|\/_next\/static\/media\/[^"]+)"/g)]
        .map((m) => m[1])
        .filter((url) => /\.(png|jpe?g|webp|avif|gif|svg)(\?|$)/i.test(url))
    );
    let bytes = 0;
    for (const url of urls) {
      const asset = join(outDir, decodeURIComponent(url.split("?")[0]));
      if (existsSync(asset)) bytes += statSync(asset).size;
    }
    const page = "/" + relative(outDir, file).split(sep).join("/");
    if (bytes > heaviest.bytes) heaviest = { bytes, page };
    if (bytes > budget) over.push({ page, bytes });
  }
  const mb = (n) => (n / 1024 / 1024).toFixed(2);
  if (!over.length) {
    console.log(`Image weight OK: the heaviest page is ${heaviest.page} at ${mb(heaviest.bytes)} MB (budget ${budgetMb} MB).`);
    return true;
  }
  console.error(`${over.length} page(s) exceed the ${budgetMb} MB image budget:`);
  for (const { page, bytes } of over.sort((a, b) => b.bytes - a.bytes)) console.error(`  ${mb(bytes)} MB  ${page}`);
  return false;
}

if (require.main === module) {
  const at = process.argv.indexOf("--budget");
  const ok = checkDocsWeight(at > 0 ? { budgetMb: Number(process.argv[at + 1]) } : {});
  process.exit(ok ? 0 : 1);
}

module.exports = { checkDocsWeight };
