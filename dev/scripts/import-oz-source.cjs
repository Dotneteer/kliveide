#!/usr/bin/env node

/*
 * Import the Cambridge Z88 OZ source into a ROM sidecar (`dev/plans/Z88_OZ47_ROM_ANNOTATIONS_PLAN.md`,
 * Phase 2, D-OZ4/D-OZ5): the source aligner (`src/common/roms/ozSourceAligner.ts`) places a module's
 * lines on its bank of `z88v47.rom` through Klive's own disassembler, and its labels, comments and data
 * become `source` entries.
 *
 *   node dev/scripts/import-oz-source.cjs <module.asm> --bank <n> [--oz <dir>] [--out <sidecar>]
 *
 *   module.asm  the module, relative to the OZ checkout (`fp/fpp.asm`)
 *   --bank      the bank it is in ($0D, 0x0D or 13)
 *   --oz        the OZ checkout at tag V4.7 (default `.local/oz47/oz`; git-ignored, never committed)
 *   --out       the sidecar written (default `.local/oz-import/z88v47.rom.dis`); a bank already in it is
 *               replaced, the other banks are kept
 *
 * The defines are the slot 0 build's (`-DOZ_SLOT0`; `-DCOMPILE_BINARY` too, as the scripts pass it to
 * the final pass). Include folders: the module's own folder and `def/`. A report (what was placed, the
 * stop, target mismatches, labels that need a rename, the measured level) is printed and written beside
 * the sidecar as `<bank>.report.txt`.
 */

const { existsSync, mkdirSync, readFileSync, writeFileSync } = require("node:fs");
const { dirname, join, resolve } = require("node:path");
const { registerTsRuntime } = require("./lib/ts-runtime.cjs");

const root = registerTsRuntime();
const { alignOzModule } = require(join(root, "src/common/roms/ozSourceAligner.ts"));
const { MemorySectionType } = require(join(root, "src/common/abstractions/MemorySection.ts"));
const { MemorySection } = require(join(root, "src/renderer/appIde/disassemblers/common-types.ts"));
const { Z80Disassembler } = require(join(root, "src/renderer/appIde/disassemblers/z80-disassembler/z80-disassembler.ts"));
const { prepareRomDisassembler, romDecoderFor } = require(join(root, "src/renderer/appIde/annotations/romDecoder.ts"));
const { romPageIdentity } = require(join(root, "src/common/roms/romIdentity.ts"));
const tools = require(join(root, "src/common/roms/romAnnotationTools.ts"));
const { isValidLabelName } = require(join(root, "src/renderer/appIde/annotations/programAnnotations.ts"));

const SOURCE_CODE = {
  repository: "https://bitbucket.org/cambridge/oz",
  tag: "V4.7",
  commit: "603c979a"
};
const DEFINES = ["OZ_SLOT0", "COMPILE_BINARY"];

function args() {
  const argv = process.argv.slice(2);
  const options = { oz: join(root, ".local/oz47/oz"), out: join(root, ".local/oz-import/z88v47.rom.dis") };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--bank") options.bank = Number(argv[++i].replace(/^\$/, "0x"));
    else if (a === "--oz") options.oz = resolve(argv[++i]);
    else if (a === "--out") options.out = resolve(argv[++i]);
    else options.module = a;
  }
  if (!options.module || !Number.isInteger(options.bank)) {
    throw new Error("import-oz-source <module.asm> --bank <n> [--oz <dir>] [--out <sidecar>]");
  }
  return options;
}

/** Klive's decoding of one instruction at a bank offset, the bank listed at `origin` */
function decoderAt(bytes, origin) {
  const memory = new Uint8Array(0x10000);
  memory.set(bytes, origin);
  const cache = new Map();
  return async (offset) => {
    if (cache.has(offset)) return cache.get(offset);
    const address = origin + offset;
    const end = Math.min(0xffff, address + 7);
    const d = new Z80Disassembler([new MemorySection(address, end, MemorySectionType.Disassemble)], memory, undefined, {
      allowExtendedSet: false
    });
    prepareRomDisassembler(d, "z88-oz");
    const out = await d.disassemble(address, end);
    const item = (out?.outputItems ?? []).find((i) => !i.isPrefixItem && i.address === address);
    const result = item
      ? {
          length: item.opCodes?.length || 1,
          text: item.instruction ?? "",
          ...(item.branch?.target !== undefined &&
          item.branch.kind !== "ret" &&
          item.branch.target >= origin &&
          item.branch.target < origin + 0x4000
            ? { target: item.branch.target - origin }
            : {})
        }
      : undefined;
    cache.set(offset, result);
    return result;
  };
}

(async () => {
  const o = args();
  const modulePath = join(o.oz, o.module);
  const rom = new Uint8Array(readFileSync(join(root, "src/public/roms/z88v47.rom")));
  const bytes = rom.subarray(o.bank * 0x4000, (o.bank + 1) * 0x4000);
  const reader = {
    include(from, name) {
      for (const folder of [dirname(from), join(o.oz, "def")]) {
        const path = resolve(folder, name);
        if (existsSync(path)) return { path, text: readFileSync(path, "latin1") };
      }
      return undefined;
    }
  };

  // --- The aligner is synchronous; Klive's disassembler is not. Decode the module's org once to find the
  // --- segment, then pre-decode linearly and on demand at each offset the walk asks about.
  const text = readFileSync(modulePath, "latin1");
  // --- Two passes: the first, with no decoding, stops at the first instruction, after the org (and so
  // --- learns the segment); the second walks
  const first = alignOzModule({ path: modulePath, text, bytes, defines: DEFINES, reader, decodeAt: () => undefined });
  const origin = first.org !== undefined ? first.org & 0xc000 : 0xc000;
  const decode = decoderAt(bytes, origin);
  // --- Decode every offset of the bank up front (the aligner asks synchronously)
  const decoded = new Map();
  for (let offset = 0; offset < 0x4000; offset++) {
    if (bytes[offset] === undefined) break;
    decoded.set(offset, await decode(offset));
  }
  const result = alignOzModule({
    path: modulePath,
    text,
    bytes,
    defines: DEFINES,
    reader,
    decodeAt: (offset) => decoded.get(offset)
  });

  // --- The sidecar's bank
  const rel = (path) => path.slice(o.oz.length + 1);
  const report = [];
  const labels = [];
  const renames = [];
  const lineAnnotations = {};
  const provenance = {};
  for (const label of result.labels) {
    if (!isValidLabelName(label.name)) {
      renames.push(`${label.name} at $${hex4(label.offset)} (${rel(label.file)}:${label.line})`);
      continue;
    }
    if (labels.some((l) => l.value === label.offset)) continue;
    labels.push({ name: label.name, value: label.offset });
    provenance[`${o.bank}:${label.offset}:label`] = "source";
    if (label.header.length) {
      lineAnnotations[label.offset] = { synopsis: label.header.join("\n") };
    }
  }
  for (const line of result.lines) {
    if (!line.comment) continue;
    const entry = (lineAnnotations[line.offset] ??= {});
    entry.comment = line.comment;
  }
  for (const offset of Object.keys(lineAnnotations)) provenance[`${o.bank}:${offset}:line`] = "source";

  // --- Regions: code, and each run of data lines as bytes
  const regions = [];
  const end = result.end - 1;
  let cursor = result.start;
  const flush = (to, type) => {
    if (to >= cursor) regions.push({ start: cursor, end: to, type });
  };
  for (const line of result.lines) {
    if (line.kind !== "data") continue;
    if (line.offset > cursor) flush(line.offset - 1, "disassemble");
    const last = regions[regions.length - 1];
    if (last && last.type === "bytes" && last.end === line.offset - 1) last.end = line.offset + line.length - 1;
    else regions.push({ start: line.offset, end: line.offset + line.length - 1, type: "bytes" });
    cursor = line.offset + line.length;
  }
  flush(end, "disassemble");
  // --- Provenance is for the non-code regions (README, "Provenance, per entry")
  for (const region of regions) if (region.type !== "disassemble") provenance[`${o.bank}:${region.start}:region`] = "source";

  const bank = { offsetIndex: 0, regions, localLabels: labels, lineAnnotations };
  const segment = (result.org ?? 0xc000) >> 14;

  mkdirSync(dirname(o.out), { recursive: true });
  const sidecar = existsSync(o.out)
    ? JSON.parse(readFileSync(o.out, "utf8"))
    : { schemaVersion: 3, machine: "rom", source: { fileName: "z88v47.rom" }, authoring: "dev/ai/rom-annotations/README.md", level: 0, pages: {}, banks: {}, provenance: {} };
  sidecar.sourceCode = SOURCE_CODE;
  sidecar.pages[String(o.bank)] = {
    crc32: romPageIdentity(bytes).crc32,
    name: `OZ 4.7, bank ${hex2(o.bank)}h`,
    segments: [{ start: result.start, segment }]
  };
  sidecar.banks[String(o.bank)] = bank;
  for (const key of Object.keys(sidecar.provenance)) if (key.startsWith(`${o.bank}:`)) delete sidecar.provenance[key];
  Object.assign(sidecar.provenance, provenance);
  writeFileSync(o.out, tools.formatRomSidecar(sidecar));

  // --- The level, as the readiness check measures it
  const level = await tools.measureRomLevel(bank, bytes, romDecoderFor("z88-oz", sidecar.pages[String(o.bank)].segments));

  const codeBytes = result.lines.filter((l) => l.kind === "code").reduce((s, l) => s + l.length, 0);
  const dataBytes = result.lines.filter((l) => l.kind === "data").reduce((s, l) => s + l.length, 0);
  report.push(`${rel(modulePath)} -> bank ${hex2(o.bank)}h, org ${result.org !== undefined ? "$" + hex4(result.org) : "-"}, segment ${segment}`);
  report.push(`placed $${hex4(result.start)}-$${hex4(result.end - 1)}: ${result.lines.length} lines (${codeBytes} code bytes, ${dataBytes} data bytes), ${result.labels.length} labels`);
  report.push(result.stop ? `STOP at $${hex4(result.stop.offset)} ${rel(result.stop.file)}:${result.stop.line}: ${result.stop.source} -- ${result.stop.reason}${result.stop.decoded ? ` (decoded: ${result.stop.decoded})` : ""}; ${result.unplaced} line(s) not placed` : "walked to the module's end");
  report.push(`target mismatches: ${result.targetMismatches.length}`);
  for (const m of result.targetMismatches.slice(0, 20)) report.push(`  $${hex4(m.offset)} ${rel(m.file)}:${m.line}: ${m.source} -- ${m.reason}`);
  report.push(`labels needing a rename (over 16 characters or invalid): ${renames.length}`);
  for (const r of renames.slice(0, 20)) report.push(`  ${r}`);
  const long = result.lines.filter((l) => l.comment && l.comment.length > 70).length;
  report.push(`line comments: ${result.lines.filter((l) => l.comment).length} (${long} over 70 characters); synopses from headers: ${result.labels.filter((l) => l.header.length).length}`);
  report.push(`level ${level.level}: ${level.instructions} instructions, ${level.unlabelledTargets.length} unlabelled target(s), ${level.midInstructionTargets.length} mid-instruction, ${level.misplacedLabels.length} misplaced label(s), ${level.labelsWithoutSynopsis.length} label(s) without a synopsis`);
  if (level.unlabelledTargets.length) report.push(`  unlabelled: ${level.unlabelledTargets.slice(0, 20).map((t) => "$" + hex4(t)).join(" ")}`);
  if (level.misplacedLabels.length) report.push(`  misplaced: ${level.misplacedLabels.slice(0, 20).join(" ")}`);
  for (const p of result.problems) report.push(`note: ${p}`);
  const reportFile = join(dirname(o.out), `${hex2(o.bank)}.report.txt`);
  writeFileSync(reportFile, report.join("\n") + "\n");
  console.log(report.join("\n"));
  console.log(`\nwrote ${o.out}\nwrote ${reportFile}`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

function hex2(v) {
  return v.toString(16).toUpperCase().padStart(2, "0");
}
function hex4(v) {
  return v.toString(16).toUpperCase().padStart(4, "0");
}
