/*
 * Shared plumbing for the ZX Spectrum Next VHDL reference (`.plans/ZXNEXT_CORE_VERSIONS_PLAN.md`
 * D4, D4.1): the manifest, git blob ids, the local git object cache, and a small unified-diff
 * applier with fuzz (so the scripts need neither `patch` nor a GNU toolchain).
 *
 *   vendor/next-fpga/sources.json          tracked: the pins and the upstream blob ids
 *   vendor/next-fpga/comments/<version>/   tracked: Klive's comments, one `<file>.patch` each
 *   vendor/next-fpga/<version>/            git-ignored: the fetched tree, comments applied
 *   vendor/next-fpga/.git-cache/           git-ignored: a bare partial clone holding the blobs
 */
const { createHash } = require("node:crypto");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const VENDOR = path.join(ROOT, "vendor", "next-fpga");
const MANIFEST = path.join(VENDOR, "sources.json");
const CACHE = path.join(VENDOR, ".git-cache");
const COMMENTS = path.join(VENDOR, "comments");
const SOURCE_STAMP = ".klive-source";
const COMMENTS_STAMP = ".klive-comments";

function readManifest() {
  return JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
}

function versionEntry(manifest, version) {
  const entry = manifest.versions[version];
  if (!entry) {
    throw new Error(
      `Unknown Next core version "${version}"; sources.json has: ${Object.keys(manifest.versions).join(", ")}`
    );
  }
  return entry;
}

/** The git blob id of a buffer (what `git hash-object` prints). */
function blobId(buf) {
  return createHash("sha1").update(`blob ${buf.length}\0`).update(buf).digest("hex");
}

function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

function git(args, options = {}) {
  return execFileSync("git", ["--git-dir", CACHE, ...args], {
    maxBuffer: 256 * 1024 * 1024,
    stdio: ["pipe", "pipe", options.quiet ? "pipe" : "inherit"],
    input: options.input,
  });
}

function ensureCache(manifest) {
  if (!fs.existsSync(path.join(CACHE, "HEAD"))) {
    fs.mkdirSync(CACHE, { recursive: true });
    execFileSync("git", ["init", "-q", "--bare", CACHE]);
    git(["remote", "add", "origin", manifest.repository.url]);
    // Mark the remote as a promisor so a partial (blob-less) fetch is allowed.
    git(["config", "remote.origin.promisor", "true"]);
    git(["config", "remote.origin.partialclonefilter", "blob:none"]);
  }
}

/**
 * The ids of the objects the cache holds. Enumerated rather than probed one by one: in a partial
 * clone, asking for a missing object (`cat-file -e`) fetches it from the remote on the spot.
 */
function localObjects() {
  const out = git(["cat-file", "--batch-all-objects", "--batch-check=%(objectname)"], { quiet: true }).toString();
  return new Set(out.split("\n").filter(Boolean));
}

/**
 * Makes sure the cache holds the pinned commit's tree and every listed blob. Uses Git's HTTPS
 * endpoint only (a depth-1, blob-less fetch, then one fetch of the wanted blobs by id): the GitLab
 * REST API rate-limits anonymous callers.
 */
function ensureObjects(manifest, entry, ids) {
  ensureCache(manifest);
  const fetchArgs = ["-c", "fetch.negotiationAlgorithm=noop", "fetch", "-q", "--no-tags", "--no-write-fetch-head"];
  let have = localObjects();
  if (!have.has(entry.commit)) {
    git([...fetchArgs, "--depth", "1", "--filter=blob:none", "origin", entry.commit]);
    have = localObjects();
  }
  const missing = [...new Set(ids)].filter((id) => !have.has(id));
  for (let i = 0; i < missing.length; i += 200) {
    git([...fetchArgs, "--filter=blob:none", "origin", ...missing.slice(i, i + 200)]);
  }
}

/** `{ relPath: blobId }` of the pinned commit, limited to the manifest's `include` list. */
function upstreamTree(entry) {
  const out = git(
    ["ls-tree", "-r", entry.commit, "--", ...entry.include.map((i) => `${entry.path}/${i}`)],
    { quiet: true }
  ).toString();
  const files = {};
  for (const line of out.split("\n").filter(Boolean)) {
    const [meta, file] = line.split("\t");
    const [, type, id] = meta.split(" ");
    if (type === "blob") files[file.slice(entry.path.length + 1)] = id;
  }
  return files;
}

function readBlob(id) {
  return git(["cat-file", "blob", id], { quiet: true });
}

/** The pristine upstream bytes of `rel` in `version` (fetching it into the cache if needed). */
function upstreamFile(manifest, version, rel) {
  const entry = versionEntry(manifest, version);
  const id = entry.files[rel];
  if (!id) return null;
  ensureObjects(manifest, entry, [id]);
  return readBlob(id);
}

/** Every `*.patch` under `comments/<version>/`, as `{ rel, file }` (rel = the patched file). */
function listPatches(version) {
  const dir = path.join(COMMENTS, version);
  const result = [];
  const walk = (d) => {
    if (!fs.existsSync(d)) return;
    for (const name of fs.readdirSync(d).sort()) {
      const full = path.join(d, name);
      if (fs.statSync(full).isDirectory()) walk(full);
      else if (name.endsWith(".patch")) {
        result.push({ rel: path.relative(dir, full).slice(0, -".patch".length).split(path.sep).join("/"), file: full });
      }
    }
  };
  walk(dir);
  return result;
}

// ---------------------------------------------------------------------------------------------
// Unified diffs

/** Splits text into lines without their terminator; `eol` remembers whether the last one had one. */
function splitLines(text) {
  const lines = text.split("\n");
  const eol = lines[lines.length - 1] === "";
  if (eol) lines.pop();
  return { lines, eol };
}

/** Parses a single-file unified diff into hunks. */
function parsePatch(text) {
  const { lines } = splitLines(text);
  const hunks = [];
  let hunk = null;
  for (const line of lines) {
    const m = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/.exec(line);
    if (m) {
      hunk = { oldStart: +m[1], newStart: +m[3], header: line, lines: [], noEolOld: false, noEolNew: false };
      hunks.push(hunk);
      continue;
    }
    if (!hunk) continue; // --- / +++ headers
    if (line.startsWith("\\")) {
      const prev = hunk.lines[hunk.lines.length - 1];
      if (prev && prev[0] !== "+") hunk.noEolOld = true;
      if (prev && prev[0] !== "-") hunk.noEolNew = true;
      continue;
    }
    hunk.lines.push(line === "" ? " " : line);
  }
  return hunks;
}

function matchAt(lines, at, want) {
  if (at < 0 || at + want.length > lines.length) return false;
  for (let i = 0; i < want.length; i++) if (lines[at + i] !== want[i]) return false;
  return true;
}

/**
 * Applies a parsed patch to `text`. With `fuzz` > 0, a hunk that does not match may drop up to
 * that many context lines at its start and end (like `patch --fuzz`). Returns the new text and a
 * per-hunk report; hunks that fail are left out.
 */
function applyPatch(text, hunks, { fuzz = 0 } = {}) {
  const { lines, eol } = splitLines(text);
  let endEol = eol;
  let delta = 0;
  const report = [];
  for (const hunk of hunks) {
    let done = false;
    for (let f = 0; f <= fuzz && !done; f++) {
      let body = hunk.lines;
      let lead = 0;
      while (lead < f && body[lead] && body[lead][0] === " ") lead++;
      let trail = 0;
      while (trail < f && body[body.length - 1 - trail] && body[body.length - 1 - trail][0] === " ") trail++;
      body = body.slice(lead, body.length - trail);
      const oldLines = body.filter((l) => l[0] !== "+").map((l) => l.slice(1));
      const newLines = body.filter((l) => l[0] !== "-").map((l) => l.slice(1));
      const expected = Math.max(0, hunk.oldStart - 1 + lead + delta);
      let found = -1;
      for (let off = 0; off <= lines.length && found < 0; off++) {
        if (matchAt(lines, expected + off, oldLines)) found = expected + off;
        else if (off && matchAt(lines, expected - off, oldLines)) found = expected - off;
      }
      if (found >= 0) {
        lines.splice(found, oldLines.length, ...newLines);
        if (found + newLines.length === lines.length && (hunk.noEolOld || hunk.noEolNew)) endEol = !hunk.noEolNew;
        report.push({ header: hunk.header, applied: true, offset: found - expected, fuzz: f, at: found + 1 });
        delta = found - (hunk.oldStart - 1 + lead) + newLines.length - oldLines.length;
        done = true;
      }
    }
    if (!done) report.push({ header: hunk.header, applied: false, text: hunk.lines.join("\n") });
  }
  return { text: lines.join("\n") + (endEol && lines.length ? "\n" : ""), report };
}

/** A unified diff (3 lines of context) from `oldBuf` to `newBuf` for `rel`, or null if equal. */
function makePatch(rel, oldBuf, newBuf, tmpDir) {
  if (Buffer.compare(oldBuf, newBuf) === 0) return null;
  fs.mkdirSync(tmpDir, { recursive: true });
  const a = path.join(tmpDir, "a");
  const b = path.join(tmpDir, "b");
  fs.writeFileSync(a, oldBuf);
  fs.writeFileSync(b, newBuf);
  let out;
  try {
    out = execFileSync("git", ["diff", "--no-index", "--no-color", "-U3", "--", a, b], { maxBuffer: 64 * 1024 * 1024 });
  } catch (e) {
    if (e.status !== 1) throw e;
    out = e.stdout;
  }
  const text = out.toString("latin1");
  const body = text.slice(text.indexOf("\n@@") + 1);
  return `--- a/${rel}\n+++ b/${rel}\n${body}`;
}

/** Whether two buffers differ only in CRLF vs LF line endings. */
function onlyLineEndings(a, b) {
  const norm = (x) => x.toString("latin1").replace(/\r\n/g, "\n");
  return norm(a) === norm(b);
}

function writeCommentsStamp(manifest, version) {
  const dir = path.join(VENDOR, version);
  const entry = versionEntry(manifest, version);
  const patches = {};
  const results = {};
  for (const p of listPatches(version)) {
    patches[p.rel] = sha256(fs.readFileSync(p.file));
    results[p.rel] = blobId(fs.readFileSync(path.join(dir, p.rel)));
  }
  fs.writeFileSync(
    path.join(dir, COMMENTS_STAMP),
    JSON.stringify({ base: entry.commit, patches, results }, null, 2) + "\n"
  );
}

function currentPatchHashes(version) {
  const patches = {};
  for (const p of listPatches(version)) patches[p.rel] = sha256(fs.readFileSync(p.file));
  return patches;
}

module.exports = {
  ROOT,
  VENDOR,
  CACHE,
  COMMENTS,
  SOURCE_STAMP,
  COMMENTS_STAMP,
  readManifest,
  versionEntry,
  blobId,
  sha256,
  ensureObjects,
  upstreamTree,
  readBlob,
  upstreamFile,
  listPatches,
  parsePatch,
  applyPatch,
  makePatch,
  onlyLineEndings,
  writeCommentsStamp,
  currentPatchHashes,
  splitLines,
};
