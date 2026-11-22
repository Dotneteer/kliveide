/**
 * Builds the non-MDX assets the documentation site depends on:
 *
 * - `next-examples.zip`: the archive of the old ZX Spectrum Next book's sample projects.
 *   `docs/content/en/book/flying-start.mdx` links to `/next-examples.zip`, so if this step is
 *   skipped the book's "download the examples" flow 404s.
 * - `books/unraveling-the-zx-spectrum-next-examples.zip`: the examples project of
 *   "Unraveling the ZX Spectrum Next" (`docs/books/unraveling-next/`), offered on the landing
 *   page and on /unraveling-book/. Its `klive.project` loses the keys that hold the author's own
 *   machine and IDE state (`BOOK_PROJECT_DROPPED_KEYS`); the file is git-ignored.
 *
 * Extracted from the inline shell chain that used to live in the root
 * `doc:build` script, so the docs build works the same whether it is invoked from
 * the repo root or from the isolated docs package.
 *
 * Usage: node dev/scripts/build-doc-assets.cjs
 */
const { execFileSync } = require("node:child_process");
const { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { dirname, join } = require("node:path");
const { REPO_ROOT } = require("./repo-root.cjs");

const repoRoot = REPO_ROOT;
const sourceDir = join(repoRoot, "dev", "experiments", "testprojects", "next");
const bookDir = join(sourceDir, "book");
const archive = join(repoRoot, "dev", "experiments", "testprojects", "next-examples.zip");
const published = join(repoRoot, "docs", "public", "next-examples.zip");

// An external archiver is used rather than a Node library so the archive stays
// byte-comparable with the one produced by the previous shell pipeline.
//
// `zip` covers macOS, Linux and GitHub's ubuntu-latest runners, but Windows ships
// no such command. There, the bsdtar that comes with the OS writes the same zip
// format — forward-slash entry names included — so it stands in. It is addressed
// by its full path: Git for Windows puts a GNU tar (which cannot write zip) ahead
// of it on PATH.
function getArchivers(target, folder) {
  const zip = { command: "zip", args: ["-rq", target, folder] };
  const bsdTar = {
    command: join(process.env.SystemRoot || "C:\\Windows", "System32", "tar.exe"),
    args: ["-c", "--format", "zip", "-f", target, folder]
  };
  return process.platform === "win32" ? [bsdTar, zip] : [zip];
}

/** Zips `folder` (a name inside `cwd`) into `target` */
function createArchive(target = archive, cwd = sourceDir, folder = "book") {
  const failures = [];
  for (const { command, args } of getArchivers(target, folder)) {
    try {
      execFileSync(command, args, { cwd, stdio: "inherit" });
      return;
    } catch (error) {
      failures.push(`  ${command}: ${error.message}`);
    }
  }

  throw new Error(
    `Failed to create ${target}. No usable archiver was found:\n${failures.join("\n")}`
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

// --- "Unraveling the ZX Spectrum Next": its examples project
const bookExamples = join(repoRoot, "docs", "books", "unraveling-next", "examples");
const bookArchive = join(repoRoot, "docs", "public", "books", "unraveling-the-zx-spectrum-next-examples.zip");

/** The `klive.project` keys that hold the author's machine and IDE state, not the project's */
const BOOK_PROJECT_DROPPED_KEYS = ["media", "viewOptions", "workspaceSettings", "debugger"];

/** A project file without the author's own state; it stays JSON, in the IDE's own layout */
function cleanProjectFile(text) {
  const project = JSON.parse(text);
  for (const key of BOOK_PROJECT_DROPPED_KEYS) delete project[key];
  return JSON.stringify(project, null, 2);
}

function buildBookExamples() {
  if (!existsSync(join(bookExamples, "klive.project"))) {
    throw new Error(
      `Cannot build the book's examples zip: '${bookExamples}' has no klive.project.\n` +
        "Run `node dev/scripts/sync-unraveling-book.cjs` (docs/books/unraveling-next/README.md)."
    );
  }
  // --- The zip holds one folder, `examples`, the name the book uses for it
  const stage = mkdtempSync(join(tmpdir(), "klive-book-examples-"));
  try {
    const staged = join(stage, "examples");
    cpSync(bookExamples, staged, { recursive: true, filter: (src) => !src.endsWith(".DS_Store") });
    const project = join(staged, "klive.project");
    writeFileSync(project, cleanProjectFile(readFileSync(project, "utf8")));
    mkdirSync(dirname(bookArchive), { recursive: true });
    rmSync(bookArchive, { force: true });
    createArchive(bookArchive, stage, "examples");
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
  const { size } = statSync(bookArchive);
  console.log(`Built unraveling-the-zx-spectrum-next-examples.zip (${(size / 1024).toFixed(0)} kB) -> docs/public/books/`);
  return { published: bookArchive, size };
}

if (require.main === module) {
  buildDocAssets();
  buildBookExamples();
}

module.exports = { buildDocAssets, buildBookExamples, cleanProjectFile, BOOK_PROJECT_DROPPED_KEYS };
