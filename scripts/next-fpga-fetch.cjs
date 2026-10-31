/*
 * Fetches the pinned ZX Spectrum Next VHDL trees (`vendor/next-fpga/sources.json`) into the
 * git-ignored `vendor/next-fpga/<version>/`, then applies Klive's comments from
 * `vendor/next-fpga/comments/<version>/` (`.plans/ZXNEXT_CORE_VERSIONS_PLAN.md` D4, D4.1).
 *
 *   npm run next-fpga:fetch [-- <version>...] [--check] [--force]
 *
 * - Every file is checked against its upstream git blob id before the comments are applied; a
 *   comment patch must apply exactly (no fuzz), or the fetch fails.
 * - `.klive-source` records the pin; `.klive-comments` records the patch hashes and the resulting
 *   blob ids, so a test can tell a pristine tree from a commented one.
 * - A tree that already matches the pin and the patches is left alone (no network).
 * - A tree with edits not yet saved as patches (`npm run next-fpga:comments -- --save <v>`) is
 *   refused unless `--force`, so comment work in progress is never overwritten.
 * - `--check` only verifies and exits 1 when a tree needs fetching.
 */
const fs = require("node:fs");
const path = require("node:path");
const lib = require("./next-fpga-lib.cjs");

/** Compares a fetched tree with the manifest and the patches; returns a list of problems. */
function treeProblems(manifest, version) {
  const entry = lib.versionEntry(manifest, version);
  const dir = path.join(lib.VENDOR, version);
  const problems = [];
  const sourceStamp = path.join(dir, lib.SOURCE_STAMP);
  if (!fs.existsSync(sourceStamp)) return ["not fetched"];
  const source = JSON.parse(fs.readFileSync(sourceStamp, "utf8"));
  if (source.commit !== entry.commit) problems.push(`pinned to ${source.commit}, manifest says ${entry.commit}`);
  const commentsStamp = path.join(dir, lib.COMMENTS_STAMP);
  const comments = fs.existsSync(commentsStamp) ? JSON.parse(fs.readFileSync(commentsStamp, "utf8")) : { patches: {}, results: {} };
  const want = lib.currentPatchHashes(version);
  if (JSON.stringify(want) !== JSON.stringify(comments.patches)) problems.push("comment patches changed since the fetch");
  const edited = [];
  for (const [rel, id] of Object.entries(entry.files)) {
    const file = path.join(dir, rel);
    if (!fs.existsSync(file)) {
      problems.push(`missing ${rel}`);
      continue;
    }
    const expected = comments.results[rel] ?? id;
    if (lib.blobId(fs.readFileSync(file)) !== expected) edited.push(rel);
  }
  if (edited.length) problems.push(`edited (not saved as patches): ${edited.join(", ")}`);
  return problems;
}

function fetchVersion(manifest, version, { force }) {
  const entry = lib.versionEntry(manifest, version);
  const dir = path.join(lib.VENDOR, version);
  const problems = treeProblems(manifest, version);
  if (!problems.length) {
    console.log(`next-fpga ${version}: up to date (${entry.commit.slice(0, 8)})`);
    return;
  }
  const unsaved = problems.find((p) => p.startsWith("edited"));
  if (unsaved && !force && fs.existsSync(path.join(dir, lib.SOURCE_STAMP))) {
    throw new Error(
      `next-fpga ${version}: ${unsaved}.\n  Save them with \`npm run next-fpga:comments -- --save ${version}\`, or pass --force to discard them.`
    );
  }
  console.log(`next-fpga ${version}: fetching ${entry.commit.slice(0, 8)} (${problems.join("; ")})`);

  lib.ensureObjects(manifest, entry, Object.values(entry.files));
  const tree = lib.upstreamTree(entry);
  for (const [rel, id] of Object.entries(entry.files)) {
    if (tree[rel] !== id) throw new Error(`next-fpga ${version}: ${rel} is ${tree[rel] ?? "absent"} upstream, sources.json says ${id}`);
  }

  const staging = `${dir}.staging`;
  fs.rmSync(staging, { recursive: true, force: true });
  for (const [rel, id] of Object.entries(entry.files)) {
    const data = lib.readBlob(id);
    if (lib.blobId(data) !== id) throw new Error(`next-fpga ${version}: blob id mismatch for ${rel}`);
    const target = path.join(staging, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, data);
  }

  for (const p of lib.listPatches(version)) {
    const target = path.join(staging, p.rel);
    if (!fs.existsSync(target)) throw new Error(`next-fpga ${version}: comment patch for missing file ${p.rel}`);
    const { text, report } = lib.applyPatch(fs.readFileSync(target, "latin1"), lib.parsePatch(fs.readFileSync(p.file, "latin1")));
    const bad = report.filter((r) => !r.applied || r.offset || r.fuzz);
    if (bad.length) {
      throw new Error(
        `next-fpga ${version}: ${path.relative(lib.ROOT, p.file)} does not apply exactly:\n` +
          bad.map((r) => `  ${r.header}${r.applied ? ` (offset ${r.offset}, fuzz ${r.fuzz})` : " FAILED"}`).join("\n")
      );
    }
    fs.writeFileSync(target, Buffer.from(text, "latin1"));
    console.log(`  comments: ${p.rel} (${report.length} hunks)`);
  }

  fs.writeFileSync(
    path.join(staging, lib.SOURCE_STAMP),
    JSON.stringify({ repository: manifest.repository.url, commit: entry.commit, path: entry.path, fetched: new Date().toISOString() }, null, 2) + "\n"
  );
  fs.rmSync(dir, { recursive: true, force: true });
  fs.renameSync(staging, dir);
  lib.writeCommentsStamp(manifest, version);
  console.log(`next-fpga ${version}: ${Object.keys(entry.files).length} files in ${path.relative(lib.ROOT, dir)}`);
}

function main(argv) {
  const manifest = lib.readManifest();
  const flags = new Set(argv.filter((a) => a.startsWith("--")));
  const versions = argv.filter((a) => !a.startsWith("--"));
  const list = versions.length ? versions : Object.keys(manifest.versions);
  if (flags.has("--check")) {
    let ok = true;
    for (const v of list) {
      const problems = treeProblems(manifest, v);
      console.log(`next-fpga ${v}: ${problems.length ? problems.join("; ") : "ok"}`);
      ok &&= !problems.length;
    }
    return ok ? 0 : 1;
  }
  for (const v of list) fetchVersion(manifest, v, { force: flags.has("--force") });
  return 0;
}

if (require.main === module) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}

module.exports = { treeProblems, fetchVersion };
