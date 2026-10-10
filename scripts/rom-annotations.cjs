#!/usr/bin/env node

/*
 * The shipped ROM sidecars' tools (`.plans/REVERSE_ENGINEERING_ANNOTATIONS_PLAN.md` §5.4, §6).
 *
 *   npm run rom:annotations                 format every src/public/roms/*.rom.dis and regenerate
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
 */

const { existsSync, readFileSync, readdirSync, writeFileSync } = require("node:fs");
const { dirname, join, resolve } = require("node:path");
const { spawnSync } = require("node:child_process");

const root = resolve(__dirname, "..");
const ROMS = join(root, "src/public/roms");
const INDEX = join(ROMS, "rom-annotations.index.json");

registerTsRuntime();
const tools = require(join(root, "src/common/roms/romAnnotationTools.ts"));
const identity = require(join(root, "src/common/roms/romIdentity.ts"));

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

function sidecarFiles() {
  return readdirSync(ROMS)
    .filter((name) => name.endsWith(".rom.dis"))
    .sort();
}

function readSidecar(name) {
  const path = existsSync(name) ? name : join(ROMS, name);
  return { path, json: JSON.parse(readFileSync(path, "utf8")) };
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
  const index = tools.formatRomIndex(tools.buildRomIndex(sidecarFiles(), romBytes));
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

async function level(only) {
  for (const name of only ? [only] : sidecarFiles()) {
    const { json } = readSidecar(name);
    const romFile = name.replace(/\.dis$/i, "").split(/[\\/]/).pop();
    for (const page of Object.keys(json.banks ?? {})) {
      const { decode, pageBytes } = decoderFor(romFile, Number(page));
      const report = await tools.measureRomLevel(json.banks[page], pageBytes, decode);
      const missing = tools.missingProvenance(json);
      console.log(
        `${name} page ${page}: level ${report.level} (recorded ${json.level ?? 0}); ` +
          `${report.instructions} instructions, ${report.unlabelledTargets.length} unlabelled target(s), ` +
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
  const romFile = name.replace(/\.dis$/i, "").split(/[\\/]/).pop();
  const { decode, pageBytes } = decoderFor(romFile, page);
  const bank = sidecar.banks[String(page)];
  const report = await tools.measureRomLevel(bank, pageBytes, decode);
  console.log(`// ${report.unlabelledTargets.length} unlabelled target(s) in ${romFile} page ${page}:`);
  for (const line of tools.skeletonOf(report)) console.log(line);
}

function bind(name, romFile, page) {
  if (!name || !romFile) throw new Error("bind <sidecar> <rom file> [page]");
  const { bindRomPage } = require(join(root, "src/renderer/appIde/annotations/romBinding.ts"));
  const { json } = readSidecar(name);
  const described = romBytes(name.replace(/\.dis$/i, "").split(/[\\/]/).pop()).subarray(page * 0x4000, (page + 1) * 0x4000);
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

function registerTsRuntime() {
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
    baseUrl: root,
    paths: {
      "@abstractions/*": ["src/common/abstractions/*"],
      "@common/*": ["src/common/*"],
      "@messaging/*": ["src/common/messaging/*"],
      "@state/*": ["src/common/state/*"],
      "@utils/*": ["src/common/utils/*"],
      "@renderer/*": ["src/renderer/*"],
      "@emu/*": ["src/emu/*"],
      "@appIde/*": ["src/renderer/appIde/*"],
      "@main/*": ["src/main/*"],
      "@controls/*": ["src/renderer/controls/*"]
    }
  });
  const Module = require("node:module");
  const original = Module._resolveFilename;
  Module._resolveFilename = function (request, parent, isMain, opts) {
    try {
      return original.call(this, request, parent, isMain, opts);
    } catch (error) {
      if (error?.code === "MODULE_NOT_FOUND" && parent?.filename) {
        const base = request.startsWith(".") ? resolve(dirname(parent.filename), request) : undefined;
        for (const candidate of base ? [`${base}.ts`, `${base}/index.ts`] : []) {
          if (existsSync(candidate)) return candidate;
        }
      }
      throw error;
    }
  };
}
