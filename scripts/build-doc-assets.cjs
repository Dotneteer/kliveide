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

// An external archiver is used rather than a Node library so the archive stays
// byte-comparable with the one produced by the previous shell pipeline.
//
// `zip` covers macOS, Linux and GitHub's ubuntu-latest runners, but Windows ships
// no such command. There, the bsdtar that comes with the OS writes the same zip
// format — forward-slash entry names included — so it stands in. It is addressed
// by its full path: Git for Windows puts a GNU tar (which cannot write zip) ahead
// of it on PATH.
function getArchivers() {
  const zip = { command: "zip", args: ["-rq", archive, "book"] };
  const bsdTar = {
    command: join(process.env.SystemRoot || "C:\\Windows", "System32", "tar.exe"),
    args: ["-c", "--format", "zip", "-f", archive, "book"]
  };
  return process.platform === "win32" ? [bsdTar, zip] : [zip];
}

function createArchive() {
  const failures = [];
  for (const { command, args } of getArchivers()) {
    try {
      execFileSync(command, args, { cwd: sourceDir, stdio: "inherit" });
      return;
    } catch (error) {
      failures.push(`  ${command}: ${error.message}`);
    }
  }

  throw new Error(
    `Failed to create ${archive}. No usable archiver was found:\n${failures.join("\n")}`
  );
}

function buildDocAssets() {
  if (!existsSync(bookDir) || !statSync(bookDir).isDirectory()) {
    throw new Error(
      `Cannot build next-examples.zip: '${bookDir}' is missing.\n` +
        "The docs book chapters link to this archive; see docs/pages/book/flying-start.mdx."
    );
  }

  rmSync(archive, { force: true });
  createArchive();

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
