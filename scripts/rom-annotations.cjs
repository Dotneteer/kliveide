#!/usr/bin/env node

/*
 * The shipped ROM sidecars' tools (`.plans/REVERSE_ENGINEERING_ANNOTATIONS_PLAN.md` §5.4, §6).
 *
 *   npm run rom:annotations                 format every .rom.dis under src/public/roms and regenerate
 *                                           rom-annotations.index.json (the default)
 *   npm run rom:annotations -- --check      fail when formatting would change anything (CI)
 *   npm run rom:annotations -- level [file] the completeness level of each page (§5.6)
 *   npm run rom:annotations -- skeleton <file> [page]
 *                                           the level 1 to-do list: unlabelled call/jump targets
 *   npm run rom:annotations -- bind <file> <rom> [page]
 *                                           which of a sidecar's labels survive on another ROM's bytes
 *   npm run rom:annotations -- coverage     run the ROM through BASIC with the access profile on and
 *                                           write which bytes are code and which data
 *                                           (.rom-annotations/coverage-sp48.json)
 *
 * The rules authors follow, and the provenance log, are in `.ai/rom-annotations/`. This script only
 * formats and measures; the logic is `src/common/roms/romAnnotationTools.ts`, which the tests run.
 *
 * A sidecar is named by its path relative to src/public/roms (`sp48.rom.dis`,
 * `zxnext/nextzxos-2.08/enNextZX.rom.dis`); a file argument may also be a path to the file. A bare
 * Next name (`enNextZX.rom.dis`) means the nextzxos-2.08 set's (`src/common/roms/romSidecarPaths.ts`).
 */

const { existsSync, readFileSync, readdirSync, writeFileSync } = require("node:fs");
const { registerTsRuntime } = require("./lib/ts-runtime.cjs");
const { join, relative, resolve, sep } = require("node:path");
const { spawnSync } = require("node:child_process");

const root = resolve(__dirname, "..");
const ROMS = join(root, "src/public/roms");
const INDEX = join(ROMS, "rom-annotations.index.json");

registerTsRuntime();
const tools = require(join(root, "src/common/roms/romAnnotationTools.ts"));
const identity = require(join(root, "src/common/roms/romIdentity.ts"));
const sidecarPaths = require(join(root, "src/common/roms/romSidecarPaths.ts"));

const args = process.argv.slice(2);
const command = args[0] && !args[0].startsWith("--") ? args[0] : "format";

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  switch (command) {
    case "format":
      return format(args.includes("--check"));
    case "level":
      return level(args[1]);
    case "skeleton":
      return skeleton(args[1], Number(args[2] ?? 0));
    case "bind":
      return bind(args[1], args[2], Number(args[3] ?? 0));
    case "coverage":
      return coverage();
    default:
      console.error(`Unknown command '${command}'. See the header of scripts/rom-annotations.cjs.`);
      process.exit(2);
  }
}

/** Every shipped sidecar, by its path relative to src/public/roms (subfolders included). */
function sidecarFiles() {
  return readdirSync(ROMS, { recursive: true })
    .map((name) => String(name).split(sep).join("/"))
    .filter((name) => name.endsWith(".rom.dis"))
    .sort();
}

function readSidecar(name) {
  const path = existsSync(name) ? name : join(ROMS, sidecarPaths.canonicalShippedSidecar(name));
  return { path, json: JSON.parse(readFileSync(path, "utf8")) };
}

/**
 * The shipped ROM a sidecar argument describes, relative to src/public/roms: a shipped sidecar's
 * own path, a working copy's shipped file (`~/Klive/RomAnnotations/enNextZX.rom.dis`), or the file
 * of that name in src/public/roms.
 */
function romFileOf(name) {
  const sidecar = existsSync(name)
    ? (sidecarPaths.managedSidecarOf(resolve(name))?.sidecar ??
      (resolve(name).startsWith(ROMS + sep)
        ? relative(ROMS, resolve(name)).split(sep).join("/")
        : sidecarPaths.canonicalShippedSidecar(name.split(/[\\/]/).pop())))
    : sidecarPaths.canonicalShippedSidecar(name);
  return sidecar.replace(/\.dis$/i, "");
}

/** The pages a sidecar has banks for (the index lists only those). */
function describedPages(name) {
  return Object.keys(readSidecar(name).json.banks ?? {}).map(Number);
}

function romBytes(romFile) {
  return new Uint8Array(readFileSync(existsSync(romFile) ? romFile : join(ROMS, romFile)));
}

/** Format every sidecar and regenerate the index; with `check`, only report. */
function format(check) {
  const changed = [];
  for (const name of sidecarFiles()) {
    const { path, json } = readSidecar(name);
    // --- Provenance that names nothing (a removed label) is dropped, so the file stays tidy
    for (const stray of tools.strayProvenance(json)) delete json.provenance[stray];
    const text = tools.formatRomSidecar(json);
    if (readFileSync(path, "utf8") !== text) {
      changed.push(name);
      if (!check) writeFileSync(path, text);
    }
  }
  const index = tools.formatRomIndex(tools.buildRomIndex(sidecarFiles(), romBytes, describedPages));
  if (!existsSync(INDEX) || readFileSync(INDEX, "utf8") !== index) {
    changed.push("rom-annotations.index.json");
    if (!check) writeFileSync(INDEX, index);
  }
  if (check && changed.length) {
    console.error(
      `ROM annotations are not formatted: ${changed.join(", ")}.\nRun: npm run rom:annotations`
    );
    process.exit(1);
  }
  console.log(
    check
      ? `ROM annotations are formatted (${sidecarFiles().length} sidecars).`
      : changed.length
        ? `Formatted: ${changed.join(", ")}`
        : "ROM annotations already formatted."
  );
}

function decoderFor(romFile, page) {
  const { romDecoderFor } = require(join(root, "src/renderer/appIde/annotations/romDecoder.ts"));
  const bytes = romBytes(romFile);
  const pageBytes = bytes.subarray(page * 0x4000, Math.min(bytes.length, (page + 1) * 0x4000));
  const kind = identity.knownRomPageKind(identity.romPageIdentity(pageBytes));
  return { decode: romDecoderFor(kind), pageBytes };
}

/**
 * The bank to measure: an inheriting sidecar's page together with its inherited, byte-bound entries
 * (`romInheritance.ts`), as the IDE shows and checks it; any other sidecar's own bank.
 */
async function measuredBank(json, page, pageBytes) {
  if (!json.inherits?.length) return json.banks[page];
  const { withInheritedEntries } = require(join(root, "src/renderer/appIde/annotations/romInheritance.ts"));
  const { parseAnnotations } = require(join(root, "src/renderer/appIde/annotations/programAnnotations.ts"));
  const { annotations } = await withInheritedEntries(
    parseAnnotations(JSON.stringify(json)).annotations,
    (p) => (p === Number(page) ? pageBytes : undefined),
    async (sidecar, p) => ({
      annotations: parseAnnotations(readFileSync(join(ROMS, sidecarPaths.canonicalShippedSidecar(sidecar)), "utf8"))
        .annotations,
      bytes: romBytes(romFileOf(sidecar)).subarray(p * 0x4000, (p + 1) * 0x4000)
    })
  );
  return annotations.banks[page];
}

async function level(only) {
  for (const name of only ? [only] : sidecarFiles()) {
    const { json } = readSidecar(name);
    const romFile = romFileOf(name);
    for (const page of Object.keys(json.banks ?? {})) {
      const { decode, pageBytes } = decoderFor(romFile, Number(page));
      const report = await tools.measureRomLevel(await measuredBank(json, page, pageBytes), pageBytes, decode);
      const missing = tools.missingProvenance(json);
      console.log(
        `${name} page ${page}: level ${report.level} (recorded ${json.level ?? 0}); ` +
          `${report.instructions} instructions, ${report.unlabelledTargets.length} unlabelled target(s), ` +
          (report.midInstructionTargets.length
            ? `${report.midInstructionTargets.length} target(s) inside an instruction, `
            : "") +
          `${report.labelsWithoutSynopsis.length} label(s) without a synopsis, ` +
          `${report.misplacedLabels.length} misplaced label(s), ${missing.length} entr(ies) without provenance`
      );
    }
  }
}

async function skeleton(name, page) {
  if (!name) throw new Error("skeleton <sidecar or rom file> [page]");
  const sidecar = name.endsWith(".dis")
    ? readSidecar(name).json
    : { banks: { [page]: { regions: [{ start: 0, end: 0x3fff, type: "disassemble" }] } } };
  const romFile = romFileOf(name.endsWith(".dis") ? name : `${name}.dis`);
  const { decode, pageBytes } = decoderFor(romFile, page);
  const bank = await measuredBank(sidecar, String(page), pageBytes);
  const report = await tools.measureRomLevel(bank, pageBytes, decode);
  console.log(`// ${report.unlabelledTargets.length} unlabelled target(s) in ${romFile} page ${page}:`);
  for (const line of tools.skeletonOf(report)) console.log(line);
}

function bind(name, romFile, page) {
  if (!name || !romFile) throw new Error("bind <sidecar> <rom file> [page]");
  const { bindRomPage } = require(join(root, "src/renderer/appIde/annotations/romBinding.ts"));
  const { json } = readSidecar(name);
  const described = romBytes(romFileOf(name)).subarray(page * 0x4000, (page + 1) * 0x4000);
  const target = romBytes(romFile).subarray(0, 0x4000);
  const binding = bindRomPage(json.banks[String(page)], described, target);
  const bound = (json.banks[String(page)].localLabels ?? []).filter((label) => binding.bound.has(label.value));
  console.log(`${binding.labelsBound} of ${binding.labelsTotal} labels bind on ${romFile}:`);
  for (const label of bound) console.log(`  ${label.name}`);
}

function coverage() {
  const out = join(root, ".rom-annotations/coverage-sp48.json");
  const result = spawnSync(
    "npx",
    ["vitest", "run", "--config", "build/vitest.config.ts", "--project", "e2e-cores", "test/rom-annotations/coverage.test.ts"],
    { cwd: root, stdio: "inherit", env: { ...process.env, ROM_COVERAGE_OUT: out }, shell: process.platform === "win32" }
  );
  if (result.status === 0) console.log(`Coverage written to ${out}`);
  process.exit(result.status ?? 1);
}

// ---------------------------------------------------------------------------------------------
// Loading the TypeScript sources in plain Node (the pattern of `benchmark-zxnext-wasm.cjs`)
