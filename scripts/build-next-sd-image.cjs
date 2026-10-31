#!/usr/bin/env node
/*
 * Builds the ZX Spectrum Next SD card base image of one ROM set
 * (`.plans/ZXNEXT_CORE_VERSIONS_PLAN.md` D9.4).
 *
 *   npm run next-sd:build -- <setId> [--out <file.cim>] [--src <checkout>] [--keep]
 *   npm run next-sd:build -- --list <file.cim>
 *
 * A development step, run once when a Next model is implemented, like `next-roms:fetch`: the image
 * lands in `src/public/mmc/<setId>-base.cim` (the set's `sdBaseImage.file`) and is committed; the
 * app and the tests never build it.
 *
 * 1. The distribution, `gitlab.com/thesmog358/tbblue`, is fetched with git over HTTPS (a shallow
 *    fetch of the set's `source.commit`, not the GitLab REST API, which rate-limits) into a
 *    temporary folder. `--src <dir>` uses an existing checkout instead; its HEAD must be that commit.
 * 2. The ROMs in its `machines/next/` must be the bytes of `src/public/roms/zxnext/<setId>/`, so the
 *    ROMs on the card and the ROMs Klive uploads are the same.
 * 3. A FAT32 CIM is created and formatted with Klive's own code (`src/main/fat32/`), and every
 *    tracked file of the distribution except the repository-only ones (`EXCLUDED`) is copied onto it,
 *    folders first, in sorted order.
 * 4. Without `--out`, the image's sha256 is written into the set's `sdBaseImage` entry of
 *    `src/common/zxnext/nextRomSets.json` (only that field). `--out` writes the image elsewhere and
 *    leaves the manifest alone.
 *
 * The build is deterministic: the FAT code's clock is pinned to `FIXED_TIME` while it runs (every
 * timestamp on the card and the volume serial number come from it), and the copy order is sorted, so
 * two runs give the same bytes.
 *
 * `--list <file.cim>` prints the card's volume facts and one line per entry (path, size, sha256).
 */
const { createHash } = require("node:crypto");
const { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, renameSync } = require("node:fs");
const { dirname, join, resolve } = require("node:path");
const { tmpdir } = require("node:os");
const { execFileSync } = require("node:child_process");

const ROOT = resolve(__dirname, "..");
const MANIFEST = join(ROOT, "src/common/zxnext/nextRomSets.json");
const ROM_ROOT = join(ROOT, "src/public/roms/zxnext");
const PUBLIC = join(ROOT, "src/public");
const REPO_URL = "https://gitlab.com/thesmog358/tbblue.git";

/** The card's size in MB, as `ks2-base.cim` (the hand-built `nextzxos-2.08` card). Its volume
 * label is the set's distribution ref (`KS2`, `KS3`), as on that card. */
const CARD_SIZE_MB = 2048;
/** Every timestamp on the card (local time, as the FAT code writes it). */
const FIXED_TIME = new Date(2026, 9, 31, 0, 0, 0);
/**
 * Tracked distribution files and folders that are not on the card (top-level names), as on
 * `ks2-base.cim`: the repository's own `.gitignore`, the sources, and the
 * demos and games (the card carries the system, its apps, docs and dot commands).
 */
const EXCLUDED = new Set([".gitignore", "demos", "games", "src"]);

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

// ------------------------------------------------------------------------------------------------
// Loading Klive's TypeScript FAT32 code

let tsRuntimeRegistered = false;

function registerTsRuntime() {
  if (tsRuntimeRegistered) return;
  const esbuild = require("esbuild");
  require.extensions[".ts"] = (module, filename) => {
    const result = esbuild.transformSync(readFileSync(filename, "utf8"), {
      format: "cjs",
      loader: "ts",
      platform: "node",
      target: "es2020",
      tsconfigRaw: { compilerOptions: { esModuleInterop: true, useDefineForClassFields: false } }
    });
    module._compile(result.code, filename);
  };
  require("tsconfig-paths").register({
    baseUrl: ROOT,
    paths: {
      "@abstractions/*": ["src/common/abstractions/*"],
      "@common/*": ["src/common/*"],
      "@main/*": ["src/main/*"]
    }
  });
  const Module = require("node:module");
  const originalResolveFilename = Module._resolveFilename;
  Module._resolveFilename = function (request, parent, isMain, options) {
    try {
      return originalResolveFilename.call(this, request, parent, isMain, options);
    } catch (error) {
      if (error?.code === "MODULE_NOT_FOUND" && parent?.filename) {
        const base = request.startsWith(".") ? resolve(dirname(parent.filename), request) : null;
        if (base && existsSync(`${base}.ts`)) return `${base}.ts`;
      }
      throw error;
    }
  };
  tsRuntimeRegistered = true;
}

function fat() {
  registerTsRuntime();
  return {
    ...require("../src/main/fat32/CimFileManager.ts"),
    ...require("../src/main/fat32/Fat32Volume.ts"),
    ...require("../src/main/fat32/Fat32Types.ts")
  };
}

/** Runs `action` with `new Date()` / `Date.now()` returning `FIXED_TIME`. */
function withFixedClock(action) {
  const RealDate = global.Date;
  const fixed = FIXED_TIME.valueOf();
  class FixedDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) super(fixed);
      else super(...args);
    }
    static now() {
      return fixed;
    }
  }
  global.Date = FixedDate;
  const restore = () => {
    global.Date = RealDate;
  };
  try {
    const result = action();
    if (result && typeof result.then === "function") return result.finally(restore);
    restore();
    return result;
  } catch (error) {
    restore();
    throw error;
  }
}

// ------------------------------------------------------------------------------------------------
// Reading a card

/** The long (or 8.3) names of a directory's entries, with their attributes and sizes. */
function readDirectory(dir) {
  const { FAT_ATTRIB_LONG_NAME, FAT_ATTRIB_LABEL, FAT_NAME_DELETED, FS_ATTR_DIRECTORY } = fat();
  const entries = [];
  let lfn = [];
  for (const entry of dir.getDirectoryEntries()) {
    const b = entry.buffer;
    if (b[0] === FAT_NAME_DELETED) {
      lfn = [];
      continue;
    }
    if (b[11] === FAT_ATTRIB_LONG_NAME) {
      const chars = [];
      for (const offset of [1, 3, 5, 7, 9, 14, 16, 18, 20, 22, 24, 28, 30]) {
        const c = b[offset] | (b[offset + 1] << 8);
        if (c === 0 || c === 0xffff) break;
        chars.push(c);
      }
      lfn[(b[0] & 0x3f) - 1] = String.fromCharCode(...chars);
      continue;
    }
    if (b[11] & FAT_ATTRIB_LABEL) {
      entries.push({ label: entry.DIR_Name.trimEnd() });
      lfn = [];
      continue;
    }
    let name = lfn.length ? lfn.join("") : null;
    if (!name) {
      const base = entry.DIR_Name.substring(0, 8).trimEnd();
      const ext = entry.DIR_Name.substring(8).trimEnd();
      name = ext ? `${base}.${ext}` : base;
    }
    lfn = [];
    if (name === "." || name === "..") continue;
    entries.push({
      name,
      isDirectory: (entry.DIR_Attr & FS_ATTR_DIRECTORY) !== 0,
      attr: entry.DIR_Attr,
      size: entry.DIR_FileSize,
      date: entry.DIR_WrtDate,
      time: entry.DIR_WrtTime
    });
  }
  return entries;
}

/** Every entry of a card: `{ path, isDirectory, size, sha256 }`, depth first in directory order. */
function walkCard(cimPath) {
  const { CimFile, Fat32Volume, O_RDONLY } = fat();
  const file = new CimFile(cimPath);
  const volume = new Fat32Volume(file);
  volume.init();
  const bs = volume.bootSector;
  const result = {
    cim: file.cimInfo,
    sizeMb: file.cimInfo.maxSize,
    sectorsPerCluster: bs.BPB_SecPerClus,
    bootLabel: bs.BS_VolLab.trimEnd(),
    oem: bs.BS_OEMName,
    volId: bs.BS_VolID >>> 0,
    label: undefined,
    entries: []
  };
  const visit = (dir, prefix) => {
    for (const entry of readDirectory(dir)) {
      if (entry.label !== undefined) {
        if (!prefix) result.label = entry.label;
        continue;
      }
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory) {
        result.entries.push({ path, isDirectory: true, attr: entry.attr });
        const child = volume.open(path, O_RDONLY);
        if (!child) throw new Error(`Cannot open folder ${path}`);
        visit(child, path);
        child.close();
      } else {
        const handle = volume.open(path, O_RDONLY);
        if (!handle) throw new Error(`Cannot open file ${path}`);
        const data = handle.fileSize > 0 ? handle.readFileData(handle.fileSize) : new Uint8Array(0);
        handle.close();
        if (data.length !== entry.size) throw new Error(`${path}: read ${data.length} of ${entry.size} bytes`);
        result.entries.push({ path, isDirectory: false, attr: entry.attr, size: entry.size, sha256: sha256(data) });
      }
    }
  };
  visit(volume.openRootDirectory(), "");
  file.close();
  return result;
}

function listCard(cimPath) {
  const card = walkCard(cimPath);
  console.log(
    `# ${cimPath}: ${card.sizeMb} MB, CIM cluster ${card.cim.clusterSize * 64}K x ${card.cim.clusterCount}, ` +
      `${card.cim.maxClusters} allocated; FAT cluster ${card.sectorsPerCluster} sectors; ` +
      `label "${card.label}" (boot sector "${card.bootLabel}", OEM "${card.oem}", id ${card.volId.toString(16)})`
  );
  for (const e of card.entries) {
    console.log(e.isDirectory ? `${e.path}/` : `${e.path}\t${e.size}\t${e.sha256}`);
  }
}

// ------------------------------------------------------------------------------------------------
// Building a card

function readManifest() {
  return JSON.parse(readFileSync(MANIFEST, "utf8"));
}

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

function fetchDistribution(commit, into) {
  console.log(`Fetching ${REPO_URL} at ${commit} ...`);
  git(into, "init", "-q");
  git(into, "fetch", "-q", "--depth", "1", REPO_URL, commit);
  git(into, "checkout", "-q", "FETCH_HEAD");
}

/** The distribution's tracked files that go on the card, sorted. */
function cardFiles(src) {
  return git(src, "ls-files", "-z")
    .split("\0")
    .filter(Boolean)
    .filter((path) => !EXCLUDED.has(path.split("/")[0]) && !EXCLUDED.has(path))
    .sort();
}

/** Checks that the card's ROMs are the bytes of the committed set. */
function checkRoms(src, setId, set) {
  const problems = [];
  for (const name of Object.keys(set.files)) {
    const onCard = join(src, set.source.dir, name);
    const committed = join(ROM_ROOT, setId, name);
    if (!existsSync(onCard)) problems.push(`${set.source.dir}/${name} is missing from the distribution`);
    else if (sha256(readFileSync(onCard)) !== sha256(readFileSync(committed)))
      problems.push(`${set.source.dir}/${name} differs from src/public/roms/zxnext/${setId}/${name}`);
  }
  if (problems.length) throw new Error(`ROM check failed:\n  ${problems.join("\n  ")}`);
  console.log(`ROMs: the ${Object.keys(set.files).length} ROMs in ${set.source.dir}/ equal src/public/roms/zxnext/${setId}/.`);
}

async function buildCard(src, files, outPath, label) {
  const { CimFileManager, Fat32Volume } = fat();
  const { FileManager } = require("../src/main/fat32/FileManager.ts");
  const temp = `${outPath}.partial`;
  await withFixedClock(async () => {
    const cim = new CimFileManager().createFile(temp, CARD_SIZE_MB);
    const volume = new Fat32Volume(cim);
    volume.format(label);
    volume.init();
    const folders = [...new Set(files.flatMap((f) => f.split("/").slice(0, -1).map((_, i, parts) => parts.slice(0, i + 1).join("/"))))].sort();
    for (const folder of folders) volume.mkdir(folder);
    const manager = new FileManager(volume);
    let done = 0;
    for (const file of files) {
      await manager.copyFile(join(src, file), file);
      if (++done % 200 === 0) console.log(`  ${done}/${files.length} files`);
    }
    cim.close();
  });
  renameSync(temp, outPath);
}

function parseArgs(argv) {
  const args = { positional: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--out" || arg === "--src" || arg === "--list") args[arg.slice(2)] = argv[++i];
    else if (arg === "--keep") args.keep = true;
    else args.positional.push(arg);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.list) {
    listCard(resolve(args.list));
    return;
  }
  const [setId] = args.positional;
  if (!setId) throw new Error("Usage: next-sd:build -- <setId> [--out <file.cim>] [--src <checkout>] | --list <file.cim>");
  const manifest = readManifest();
  const set = manifest[setId];
  if (!set) throw new Error(`'${setId}' is not in ${MANIFEST}.`);
  const commit = set.source.commit;
  if (!set.sdBaseImage?.file) throw new Error(`'${setId}' has no sdBaseImage.file in the manifest.`);

  let src = args.src ? resolve(args.src) : null;
  let tempDir = null;
  if (src) {
    const head = git(src, "rev-parse", "HEAD").trim();
    if (head !== commit) throw new Error(`${src} is at ${head}, not the set's commit ${commit}.`);
  } else {
    tempDir = mkdtempSync(join(tmpdir(), "klive-tbblue-"));
    src = tempDir;
    fetchDistribution(commit, src);
  }

  try {
    checkRoms(src, setId, set);
    const files = cardFiles(src);
    const outPath = args.out ? resolve(args.out) : join(PUBLIC, set.sdBaseImage.file);
    const label = set.source.ref.toUpperCase().substring(0, 11);
    console.log(`Building ${outPath}: ${files.length} files, ${CARD_SIZE_MB} MB card, label "${label}" ...`);
    await buildCard(src, files, outPath, label);
    const digest = sha256(readFileSync(outPath));
    const size = readFileSync(outPath).length;
    console.log(`Wrote ${outPath}: ${size} bytes, sha256 ${digest}`);
    if (!args.out) {
      const fresh = readManifest();
      fresh[setId].sdBaseImage = { ...fresh[setId].sdBaseImage, sha256: digest };
      writeFileSync(MANIFEST, `${JSON.stringify(fresh, null, 2)}\n`);
      console.log(`Recorded the sha256 in ${MANIFEST} (${setId}.sdBaseImage).`);
      console.log(`Review and commit: ${set.sdBaseImage.file} and the manifest.`);
    }
  } finally {
    if (tempDir && !args.keep) rmSync(tempDir, { recursive: true, force: true });
  }
}

module.exports = { walkCard, fat, withFixedClock };

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message ?? error);
    process.exit(1);
  });
}
