/**
 * ZX BASIC upstream syntax-change detector.
 *
 * ## What this script is for
 *
 * `.ai/zxbasic-syntax/zxbasic-syntax.json` is Klive's own description of the Boriel ZX BASIC
 * language (keywords, statements, operators, preprocessor, CLI options, warning codes). It was
 * written from one upstream release, and it goes stale the moment upstream adds a statement.
 *
 * `.ai/zxbasic-syntax/upstream-fingerprint.json` records *which* upstream release the spec
 * describes and the git blob SHA of every upstream file that can carry a syntax change: the lexer,
 * the parser, the keyword table, the preprocessor, the CLI option parser, the error/warning table,
 * and the per-statement documentation pages.
 *
 * This script compares that fingerprint with the upstream repository as it is now and reports:
 *
 *   - releases published since the snapshot;
 *   - fingerprinted files whose content changed (with a GitHub compare link for each);
 *   - files that appeared in the syntax-bearing folders since the snapshot — a new `docs/*.md` page
 *     usually means a new statement or function;
 *   - fingerprinted files that upstream removed or renamed.
 *
 * A session that re-checks the language then knows exactly which upstream files to re-read. When
 * nothing changed, the spec is still current and no reading is needed.
 *
 * ## What it deliberately does not do
 *
 * It never downloads file contents and never writes anything under `src/`. The upstream compiler is
 * AGPL-3.0; the spec is Klive's own MIT description of the *language*, made by reading upstream to
 * discover facts and writing them down independently. The fingerprint holds hashes and sizes only.
 * Keep it that way: a session that refreshes the spec reads upstream in the browser or a scratch
 * checkout, describes what changed in its own words, and then runs `--update` here.
 *
 * ## Usage
 *
 *   node scripts/zxbasic-syntax-check.cjs              # compare with the latest upstream release
 *   node scripts/zxbasic-syntax-check.cjs --ref main   # compare with a branch, tag or commit
 *   node scripts/zxbasic-syntax-check.cjs --json       # machine-readable report on stdout
 *   node scripts/zxbasic-syntax-check.cjs --update [--ref vX.Y.Z]
 *       # rewrite the fingerprint for that ref. Run this only AFTER the spec has been brought up to
 *       # date with that release; the fingerprint is a claim that the spec describes it.
 *
 * Exit code 0: nothing changed. 1: changes found (so it can gate a scheduled job). 2: failure.
 *
 * Uses the GitHub REST API without authentication (60 requests/hour is plenty: this script makes
 * three). Set `GITHUB_TOKEN` to raise the limit.
 */

const fs = require("node:fs");
const path = require("node:path");
const https = require("node:https");

const REPO = "boriel-basic/zxbasic";
const FINGERPRINT_PATH = path.join(__dirname, "..", ".ai", "zxbasic-syntax", "upstream-fingerprint.json");

/**
 * Folders in which a new file may carry a syntax change, with the extensions that count. A file
 * added here since the snapshot is reported even though it is not in the fingerprint. By default
 * only direct children are watched: `docs/` must not pull in `docs/architectures/**`.
 * `docs/library/` is watched recursively (it has sub-pages under `keys/`, `memorybank/`,
 * `string/`) because a new library page usually means a new `#include <...>` module that programs
 * will start to use.
 */
const WATCHED_FOLDERS = [
  { folder: "src/zxbc/", extensions: [".py"] }, // lexer, parser, keyword table, CLI
  { folder: "src/zxbpp/", extensions: [".py"] }, // preprocessor directives and macro expansion
  { folder: "src/zxbasm/", extensions: [".py"] }, // the inline-assembler dialect
  { folder: "docs/", extensions: [".md"] }, // one page per statement or function
  { folder: "docs/library/", extensions: [".md"], recursive: true }
];

/**
 * Files outside the watched folders (or not matching their extensions) that still carry language
 * facts: option tables, constants such as type sizes, and the warning/error code table.
 */
const WATCHED_FILES = new Set([
  "src/api/config.py",
  "src/api/constants.py",
  "src/api/errmsg.py",
  "src/api/global_.py",
  "src/api/options.py",
  "CHANGELOG.md",
  "pyproject.toml"
]);

/** Files inside the watched folders that never carry syntax and only add noise. */
const IGNORED = new Set([
  "src/zxbc/zxbparser_standalone.py", // generated parser tables (the source grammar is zxbparser.py)
  "src/zxbpp/zxbpp_standalone.py",
  "src/zxbasm/asmparse_standalone.py",
  "src/zxbasm/asmparse_zxnext_standalone.py",
  "docs/index.md",
  "docs/about.md",
  "docs/archive.md",
  "docs/installation.md",
  "docs/external_resources.md",
  "docs/released_programs.md",
  "docs/sample_programs.md",
  "docs/tutorials.md",
  "docs/tools.md"
]);

function isWatched(filePath) {
  if (IGNORED.has(filePath)) return false;
  if (WATCHED_FILES.has(filePath)) return true;
  return WATCHED_FOLDERS.some(({ folder, extensions, recursive }) => {
    if (!filePath.startsWith(folder)) return false;
    const rest = filePath.slice(folder.length);
    return (recursive || !rest.includes("/")) && extensions.some((ext) => rest.endsWith(ext));
  });
}

function githubGet(apiPath) {
  return new Promise((resolve, reject) => {
    const headers = {
      "User-Agent": "kliveide-zxbasic-syntax-check",
      Accept: "application/vnd.github+json"
    };
    if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    https
      .get({ host: "api.github.com", path: apiPath, headers }, (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          if (res.statusCode !== 200) {
            reject(new Error(`GitHub ${apiPath} -> HTTP ${res.statusCode}: ${body.slice(0, 200)}`));
            return;
          }
          resolve(JSON.parse(body));
        });
      })
      .on("error", reject);
  });
}

async function latestRelease() {
  const rel = await githubGet(`/repos/${REPO}/releases/latest`);
  return { tag: rel.tag_name, date: rel.published_at };
}

async function releasesSince(snapshotDate) {
  const list = await githubGet(`/repos/${REPO}/releases?per_page=20`);
  return list
    .filter((r) => new Date(r.published_at) > new Date(snapshotDate))
    .map((r) => ({ tag: r.tag_name, date: r.published_at }));
}

async function resolveCommit(ref) {
  const commit = await githubGet(`/repos/${REPO}/commits/${encodeURIComponent(ref)}`);
  return { sha: commit.sha, date: commit.commit.committer.date };
}

async function treeAt(sha) {
  const tree = await githubGet(`/repos/${REPO}/git/trees/${sha}?recursive=1`);
  if (tree.truncated) throw new Error("GitHub truncated the tree listing; cannot compare reliably");
  const files = {};
  for (const entry of tree.tree) {
    if (entry.type === "blob" && isWatched(entry.path)) {
      files[entry.path] = { sha: entry.sha, size: entry.size };
    }
  }
  return files;
}

function readFingerprint() {
  return JSON.parse(fs.readFileSync(FINGERPRINT_PATH, "utf8"));
}

function compare(fingerprint, current) {
  const changed = [];
  const removed = [];
  const added = [];
  for (const [file, info] of Object.entries(fingerprint.files)) {
    const now = current[file];
    if (!now) removed.push(file);
    else if (now.sha !== info.sha) changed.push({ file, from: info.size, to: now.size });
  }
  for (const file of Object.keys(current)) {
    if (!fingerprint.files[file]) added.push(file);
  }
  const sortByPath = (a, b) => (a.file ?? a).localeCompare(b.file ?? b);
  return { changed: changed.sort(sortByPath), removed: removed.sort(), added: added.sort() };
}

async function main() {
  const args = process.argv.slice(2);
  const refIndex = args.indexOf("--ref");
  const wantJson = args.includes("--json");
  const update = args.includes("--update");
  let ref = refIndex >= 0 ? args[refIndex + 1] : null;
  if (!ref) ref = (await latestRelease()).tag;

  const target = await resolveCommit(ref);
  const current = await treeAt(target.sha);

  if (update) {
    const versionFile = await githubGet(`/repos/${REPO}/contents/pyproject.toml?ref=${target.sha}`);
    const pyproject = Buffer.from(versionFile.content, "base64").toString("utf8");
    const version = (pyproject.match(/^version\s*=\s*"([^"]+)"/m) || [])[1] ?? ref;
    const fingerprint = {
      $comment:
        "Upstream snapshot the spec in zxbasic-syntax.json describes. Hashes only; see scripts/zxbasic-syntax-check.cjs.",
      repo: REPO,
      snapshot: { ref, commit: target.sha, date: target.date, version },
      watched: { folders: WATCHED_FOLDERS, files: [...WATCHED_FILES].sort() },
      files: Object.fromEntries(Object.entries(current).sort(([a], [b]) => a.localeCompare(b)))
    };
    fs.writeFileSync(FINGERPRINT_PATH, JSON.stringify(fingerprint, null, 2) + "\n");
    console.log(`Fingerprint written for ${ref} (${target.sha.slice(0, 7)}, version ${version}): ${Object.keys(current).length} files`);
    return 0;
  }

  const fingerprint = readFingerprint();
  const diff = compare(fingerprint, current);
  const newReleases = await releasesSince(fingerprint.snapshot.date);
  const base = fingerprint.snapshot.commit;
  const blobUrl = (file) => `https://github.com/${REPO}/blob/${target.sha}/${file}`;

  const nothing = diff.changed.length + diff.removed.length + diff.added.length === 0;

  if (wantJson) {
    console.log(
      JSON.stringify(
        {
          snapshot: fingerprint.snapshot,
          target: { ref, ...target },
          newReleases,
          ...diff,
          upToDate: nothing
        },
        null,
        2
      )
    );
    return nothing ? 0 : 1;
  }

  console.log(`Spec snapshot: ${fingerprint.snapshot.ref} (${base.slice(0, 7)}, ${fingerprint.snapshot.date.slice(0, 10)})`);
  console.log(`Compared with: ${ref} (${target.sha.slice(0, 7)}, ${target.date.slice(0, 10)})`);
  if (newReleases.length) {
    console.log(`\nReleases since the snapshot: ${newReleases.map((r) => `${r.tag} (${r.date.slice(0, 10)})`).join(", ")}`);
  }
  if (nothing) {
    console.log("\nNo syntax-bearing file changed. The spec is current for this ref.");
    return 0;
  }
  if (diff.changed.length) {
    console.log(`\nChanged (${diff.changed.length}) — re-read these and update the spec:`);
    for (const c of diff.changed) console.log(`  ${c.file}  (${c.from} -> ${c.to} bytes)\n    ${blobUrl(c.file)}`);
  }
  if (diff.added.length) {
    console.log(`\nNew in watched folders (${diff.added.length}) — a new docs page usually means a new statement:`);
    for (const f of diff.added) console.log(`  ${f}\n    ${blobUrl(f)}`);
  }
  if (diff.removed.length) {
    console.log(`\nRemoved or renamed (${diff.removed.length}):`);
    for (const f of diff.removed) console.log(`  ${f}`);
  }
  console.log(`\nFull compare: https://github.com/${REPO}/compare/${base.slice(0, 12)}...${target.sha.slice(0, 12)}`);
  console.log("After updating .ai/zxbasic-syntax/zxbasic-syntax.json, run: node scripts/zxbasic-syntax-check.cjs --update --ref " + ref);
  return 1;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err.message);
    process.exit(2);
  }
);
