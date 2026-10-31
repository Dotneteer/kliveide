#!/usr/bin/env node
/*
 * Fetches one ZX Spectrum Next ROM set from the official distribution and records it in the
 * manifest (`.plans/ZXNEXT_CORE_VERSIONS_PLAN.md` D9.2).
 *
 *   npm run next-roms:fetch -- <setId> --ref <branch|commit> [--replace] [--files a.rom,b.rom]
 *
 * A development step, run once when a Next model is implemented: the files land in
 * `src/public/roms/zxnext/<setId>/` and are committed; the app and the tests never download them.
 *
 * 1. `--ref` is resolved to a full commit SHA with `git ls-remote` (Git's HTTPS endpoint: the GitLab
 *    REST API rate-limits anonymous callers per IP).
 * 2. Each file comes from the raw file URL at that commit.
 * 3. The files are written to the set's folder and its entry in `src/common/zxnext/nextRomSets.json` is
 *    added or updated: commit, fetch date, size, sha256, the CRC-32 of each 16K page.
 * 4. It prints what to review and commit.
 *
 * A set already in the manifest is refused without `--replace`, which is for a set that has not
 * shipped. The ROM facts (`facts`) are never guessed here: they are written by hand and proved by
 * `test/zxnext-hw/rom/rom-facts.test.ts`. `npm run next-roms:check -- --online` re-downloads every set
 * at its recorded commit and confirms the committed bytes.
 */
const { createHash } = require("node:crypto");
const { existsSync, mkdirSync, readFileSync, writeFileSync } = require("node:fs");
const { join, resolve } = require("node:path");
const { execFileSync } = require("node:child_process");

const ROOT = resolve(__dirname, "..");
const MANIFEST = join(ROOT, "src/common/zxnext/nextRomSets.json");
const ROM_ROOT = join(ROOT, "src/public/roms/zxnext");
const PROJECT = "thesmog358/tbblue";
const DIR = "machines/next";
const DEFAULT_FILES = ["enNextZX.rom", "enNxtmmc.rom", "enNextMf.rom", "enAltZX.rom", "enNextLG.rom"];
const PAGE = 0x4000;

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i];
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, "0");
}

/** The CRC-32 of each 16K page; a file of one page or less has one CRC, of all its bytes. */
function pageCrcs(bytes) {
  if (bytes.length <= PAGE) return [crc32(bytes)];
  const pages = [];
  for (let offset = 0; offset < bytes.length; offset += PAGE) pages.push(crc32(bytes.subarray(offset, offset + PAGE)));
  return pages;
}

function describe(bytes) {
  return { size: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), pages: pageCrcs(bytes) };
}

function resolveRef(ref) {
  if (/^[0-9a-f]{40}$/i.test(ref)) return ref.toLowerCase();
  const out = execFileSync("git", ["ls-remote", `https://gitlab.com/${PROJECT}.git`, ref], { encoding: "utf8" });
  const lines = out.trim().split(/\r?\n/).filter(Boolean);
  const exact = lines.find((line) => line.endsWith(`refs/heads/${ref}`) || line.endsWith(`refs/tags/${ref}`));
  const line = exact ?? lines[0];
  if (!line) throw new Error(`'${ref}' is neither a branch nor a tag of ${PROJECT}.`);
  return line.split(/\s+/)[0];
}

async function download(commit, file) {
  const url = `https://gitlab.com/${PROJECT}/-/raw/${commit}/${DIR}/${file}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

function readManifest() {
  return existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : {};
}

function writeManifest(manifest) {
  writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
}

function parseArgs(argv) {
  const args = { files: DEFAULT_FILES };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--ref") args.ref = argv[++i];
    else if (arg === "--replace") args.replace = true;
    else if (arg === "--files") args.files = argv[++i].split(",").map((f) => f.trim()).filter(Boolean);
    else if (!arg.startsWith("--") && !args.setId) args.setId = arg;
    else throw new Error(`Unknown argument '${arg}'.`);
  }
  if (!args.setId || !args.ref) {
    throw new Error("Usage: npm run next-roms:fetch -- <setId> --ref <branch|commit> [--replace] [--files a.rom,b.rom]");
  }
  if (!/^[a-z0-9][a-z0-9.-]*$/.test(args.setId)) throw new Error(`'${args.setId}' is not a valid set id.`);
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const manifest = readManifest();
  if (manifest[args.setId] && !args.replace) {
    throw new Error(`'${args.setId}' is already in the manifest. A shipped set is never re-fetched; use --replace only for one that has not shipped.`);
  }
  const commit = resolveRef(args.ref);
  console.log(`${PROJECT} ${args.ref} = ${commit}`);
  const folder = join(ROM_ROOT, args.setId);
  mkdirSync(folder, { recursive: true });
  const files = {};
  for (const file of args.files) {
    const bytes = await download(commit, file);
    writeFileSync(join(folder, file), bytes);
    files[file] = describe(bytes);
    console.log(`  ${file}: ${bytes.length} bytes, pages ${files[file].pages.join(" ")}`);
  }
  const previous = manifest[args.setId] ?? {};
  manifest[args.setId] = {
    ...previous,
    source: { project: PROJECT, ref: args.ref, commit, dir: DIR },
    fetched: new Date().toISOString().slice(0, 10),
    files,
    facts: previous.facts ?? {}
  };
  writeManifest(manifest);
  console.log(`
Review and commit:
  src/public/roms/zxnext/${args.setId}/   the ROM files
  src/common/zxnext/nextRomSets.json          the set's entry (fill in its "facts" by hand)
The distribution's licence note: https://gitlab.com/${PROJECT}/-/tree/${commit}/docs`);
}

module.exports = { crc32, pageCrcs, describe, resolveRef, download, MANIFEST, ROM_ROOT, PROJECT, DIR };

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
