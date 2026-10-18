/**
 * Keeps the unlinked areas out of the site search (decision D6 of
 * .plans/DOCS_SITE_MODERNIZATION_PLAN.md: the book is available at its URLs but not linked, and
 * search must not lead to it either).
 *
 * Nextra marks each page's content with `data-pagefind-body`; once any page has it, Pagefind
 * indexes only pages that do. Removing the attribute from a page therefore takes it out of the
 * index. Runs in docs' `postbuild`, before Pagefind.
 *
 * Usage: node scripts/build-doc-search-scope.cjs
 */
const { readdirSync, readFileSync, writeFileSync, existsSync } = require("node:fs");
const { join } = require("node:path");

const outDir = join(__dirname, "..", "docs", "out");
/** Areas (per language) that search must not find */
const UNSEARCHED = ["book"];

function htmlFiles(dir, found = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) htmlFiles(full, found);
    else if (entry.name.endsWith(".html")) found.push(full);
  }
  return found;
}

let changed = 0;
for (const lang of readdirSync(outDir, { withFileTypes: true }).filter((e) => e.isDirectory())) {
  for (const area of UNSEARCHED) {
    const dir = join(outDir, lang.name, area);
    const page = join(outDir, lang.name, `${area}.html`);
    const files = [...(existsSync(dir) ? htmlFiles(dir) : []), ...(existsSync(page) ? [page] : [])];
    for (const file of files) {
      const html = readFileSync(file, "utf8");
      const next = html.replace(/\sdata-pagefind-body(="[^"]*")?/g, "");
      if (next !== html) {
        writeFileSync(file, next);
        changed += 1;
      }
    }
  }
}
console.log(`Search scope: ${changed} page(s) kept out of the index.`);
