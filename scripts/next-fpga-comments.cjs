/*
 * Klive's own comments on the ZX Spectrum Next VHDL, kept as patches in
 * `vendor/next-fpga/comments/<version>/` (`.plans/ZXNEXT_CORE_VERSIONS_PLAN.md` D4.1).
 *
 *   npm run next-fpga:comments -- --save <version>
 *     Rewrites that version's patches from the fetched tree (`vendor/next-fpga/<version>/`)
 *     against the pinned upstream files: one `<file>.patch` per file that differs. Files that
 *     differ only in CRLF/LF line endings get no patch (their upstream bytes are restored); patches of files that no longer differ
 *     are removed.
 *
 *   npm run next-fpga:comments -- --carry <from> <to> [--fuzz <n>] [--force]
 *     Applies <from>'s patches to <to>'s pristine upstream files with fuzz (default 2), writes the
 *     result into the fetched <to> tree, saves what applied as <to>'s patches, and lists the hunks
 *     that did not apply (also written as `<file>.rej` next to the file in the fetched tree).
 *     A file that moved upstream is followed when exactly one <to> file has its name.
 *     Refuses to replace an existing <to> patch unless --force.
 */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const lib = require("./next-fpga-lib.cjs");
const { treeProblems } = require("./next-fpga-fetch.cjs");

function requireFetched(manifest, version) {
  if (!fs.existsSync(path.join(lib.VENDOR, version, lib.SOURCE_STAMP))) {
    throw new Error(`vendor/next-fpga/${version} is not fetched: run \`npm run next-fpga:fetch\``);
  }
  lib.ensureObjects(manifest, lib.versionEntry(manifest, version), Object.values(lib.versionEntry(manifest, version).files));
}

function save(manifest, version, { only } = {}) {
  requireFetched(manifest, version);
  const entry = lib.versionEntry(manifest, version);
  const dir = path.join(lib.VENDOR, version);
  const outDir = path.join(lib.COMMENTS, version);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "next-fpga-"));
  const written = [];
  try {
    for (const [rel, id] of Object.entries(entry.files)) {
      if (only && !only.has(rel)) continue;
      const patchFile = path.join(outDir, `${rel}.patch`);
      const file = path.join(dir, rel);
      const current = fs.existsSync(file) ? fs.readFileSync(file) : null;
      if (!current) throw new Error(`${rel} is missing from vendor/next-fpga/${version}`);
      const upstream = lib.readBlob(id);
      const patch =
        Buffer.compare(upstream, current) === 0 || lib.onlyLineEndings(upstream, current)
          ? null
          : lib.makePatch(rel, upstream, current, tmp);
      if (lib.onlyLineEndings(upstream, current) && Buffer.compare(upstream, current) !== 0) {
        fs.writeFileSync(file, upstream);
        console.log(`  ${rel}: line endings only; no patch, upstream bytes restored`);
      }
      if (patch) {
        if (current.includes(0)) throw new Error(`${rel} is binary; comments go in text files only`);
        fs.mkdirSync(path.dirname(patchFile), { recursive: true });
        const old = fs.existsSync(patchFile) ? fs.readFileSync(patchFile, "latin1") : null;
        if (old !== patch) fs.writeFileSync(patchFile, Buffer.from(patch, "latin1"));
        written.push(rel);
        console.log(`  ${rel}.patch ${old === patch ? "unchanged" : old ? "updated" : "created"} (${lib.parsePatch(patch).length} hunks)`);
      } else if (fs.existsSync(patchFile)) {
        fs.rmSync(patchFile);
        console.log(`  ${rel}.patch removed (no difference)`);
      }
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  lib.writeCommentsStamp(manifest, version);
  console.log(`next-fpga ${version}: ${written.length} comment patch(es) in ${path.relative(lib.ROOT, outDir)}`);
  return written;
}

function carry(manifest, from, to, { fuzz, force }) {
  requireFetched(manifest, to);
  const toEntry = lib.versionEntry(manifest, to);
  const toDir = path.join(lib.VENDOR, to);
  const problems = treeProblems(manifest, to).filter((p) => p.startsWith("edited"));
  if (problems.length && !force) throw new Error(`next-fpga ${to}: ${problems[0]}; save or --force first`);
  const carried = new Set();
  const failed = [];
  for (const p of lib.listPatches(from)) {
    // A file upstream moved is followed when exactly one file of <to> has its name.
    let rel = p.rel;
    if (!toEntry.files[rel]) {
      const base = path.posix.basename(rel);
      const same = Object.keys(toEntry.files).filter((f) => path.posix.basename(f) === base);
      if (same.length !== 1) {
        console.log(`  ${p.rel}: not in ${to}${same.length ? ` (candidates: ${same.join(", ")})` : ""}; not carried`);
        failed.push({ rel: p.rel, header: "(file absent)" });
        continue;
      }
      rel = same[0];
      console.log(`  ${p.rel}: moved upstream to ${rel}`);
    }
    const target = path.join(lib.COMMENTS, to, `${rel}.patch`);
    if (fs.existsSync(target) && !force) {
      console.log(`  ${rel}: ${to} already has a patch; skipped (use --force to replace)`);
      continue;
    }
    const pristine = lib.readBlob(toEntry.files[rel]).toString("latin1");
    const hunks = lib.parsePatch(fs.readFileSync(p.file, "latin1"));
    const { text, report } = lib.applyPatch(pristine, hunks, { fuzz });
    const ok = report.filter((r) => r.applied);
    const bad = report.filter((r) => !r.applied);
    fs.writeFileSync(path.join(toDir, rel), Buffer.from(text, "latin1"));
    const rej = path.join(toDir, `${rel}.rej`);
    if (bad.length) fs.writeFileSync(rej, bad.map((r) => `${r.header}\n${r.text}\n`).join(""));
    else fs.rmSync(rej, { force: true });
    if (ok.length) carried.add(rel);
    const moved = ok.filter((r) => r.offset || r.fuzz);
    console.log(
      `  ${rel}: ${ok.length}/${report.length} hunks applied` +
        (moved.length ? `, ${moved.length} with offset/fuzz` : "") +
        (bad.length ? `, ${bad.length} FAILED (see ${path.relative(lib.ROOT, rej)})` : "")
    );
    for (const r of moved) console.log(`      ${r.header.split("@@").slice(0, 2).join("@@")}@@ -> line ${r.at} (offset ${r.offset}, fuzz ${r.fuzz})`);
    for (const r of bad) {
      console.log(`      FAILED ${r.header}`);
      failed.push({ rel, header: r.header });
    }
  }
  if (carried.size) save(manifest, to, { only: carried });
  return { carried: [...carried], failed };
}

function main(argv) {
  const manifest = lib.readManifest();
  const force = argv.includes("--force");
  const fuzzAt = argv.indexOf("--fuzz");
  const fuzz = fuzzAt >= 0 ? Number(argv[fuzzAt + 1]) : 2;
  const saveAt = argv.indexOf("--save");
  const carryAt = argv.indexOf("--carry");
  if (saveAt >= 0 && argv[saveAt + 1]) {
    save(manifest, argv[saveAt + 1]);
    return 0;
  }
  if (carryAt >= 0 && argv[carryAt + 2]) {
    const { failed } = carry(manifest, argv[carryAt + 1], argv[carryAt + 2], { fuzz, force });
    if (failed.length) console.log(`${failed.length} hunk(s) did not carry; review them by hand.`);
    return 0;
  }
  console.error("usage: next-fpga-comments --save <version> | --carry <from> <to> [--fuzz n] [--force]");
  return 2;
}

if (require.main === module) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}

module.exports = { save, carry };
