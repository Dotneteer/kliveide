/**
 * Builds the non-MDX assets the documentation site depends on.
 *
 * Currently that is `next-examples.zip`: the archive of the ZX Spectrum Next book's
 * sample projects. `docs/pages/book/flying-start.mdx` links to `/next-examples.zip`,
 * so if this step is skipped the book's "download the examples" flow 404s.
 *
 * Extracted from the inline shell chain that used to live in the root
 * `doc:build` script, so the docs build works the same whether it is invoked from
 * the repo root or from the isolated docs package.
 *
 * Usage: node scripts/build-doc-assets.cjs
 */
const { execFileSync } = require("node:child_process");
const { copyFileSync, existsSync, mkdirSync, rmSync, statSync } = require("node:fs");
const { dirname, join } = require("node:path");

const repoRoot = join(__dirname, "..");
const sourceDir = join(repoRoot, "_experiments", "testprojects", "next");
const bookDir = join(sourceDir, "book");
const archive = join(repoRoot, "_experiments", "testprojects", "next-examples.zip");
const published = join(repoRoot, "docs", "public", "next-examples.zip");

function buildDocAssets() {
  if (!existsSync(bookDir) || !statSync(bookDir).isDirectory()) {
    throw new Error(
      `Cannot build next-examples.zip: '${bookDir}' is missing.\n` +
        "The docs book chapters link to this archive; see docs/pages/book/flying-start.mdx."
    );
  }

  rmSync(archive, { force: true });

  // `zip` is used rather than a Node library so the archive stays byte-comparable
  // with the one produced by the previous shell pipeline. Present on macOS, Linux
  // and GitHub's ubuntu-latest runners.
  try {
    execFileSync("zip", ["-rq", archive, "book"], { cwd: sourceDir, stdio: "inherit" });
  } catch (error) {
    throw new Error(
      `Failed to create ${archive}. Is the 'zip' command available on PATH?\n${error.message}`
    );
  }

  mkdirSync(dirname(published), { recursive: true });
  copyFileSync(archive, published);

  const { size } = statSync(published);
  console.log(`Built next-examples.zip (${(size / 1024).toFixed(0)} kB) -> docs/public/`);
  return { archive, published, size };
}

if (require.main === module) {
  buildDocAssets();
}

module.exports = { buildDocAssets };
