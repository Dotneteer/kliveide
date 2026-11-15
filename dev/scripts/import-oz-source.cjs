#!/usr/bin/env node

/*
 * Import the Cambridge Z88 OZ source into a ROM sidecar (`dev/plans/Z88_OZ47_ROM_ANNOTATIONS_PLAN.md`,
 * Phase 2, D-OZ4/D-OZ5): the source aligner (`src/common/roms/ozSourceAligner.ts`) places a module's
 * lines on its bank of `z88v47.rom` through Klive's own disassembler, and its labels, comments and data
 * become `source` entries.
 *
 *   node dev/scripts/import-oz-source.cjs <module.asm|project.prj> --bank <n> [--merge]
 *        [--define X]... [--include dir]... [--oz <dir>] [--out <sidecar>]
 *
 *   module      a module or a project (its modules in link order), relative to the OZ checkout
 *               (`fp/fpp.asm`, `gn/gn.prj`)
 *   --bank      the bank it is in ($0D, 0x0D or 13)
 *   --banks     a program over consecutive banks, assembled as one (PipeDream: `--banks 5,6`, 32K at
 *               $8000): walked as one span, then written to each bank, each in the segment it runs in
 *   --at        the bank offset the first module starts at, where it is stored somewhere else than its
 *               org says (LOWRAM: org $0000, stored at $0800 and copied to RAM at reset)
 *   --merge     add to what the bank already has (a bank of several components: bank 7's four
 *               applications); without it the bank is replaced. The other banks are always kept
 *   --define    a define besides the slot 0 build's `OZ_SLOT0` (the kernel and LOWRAM: COMPILE_BINARY)
 *   --include   an include folder, relative to the module (the kernel: `lowram`); `def/` is always one
 *   --oz        the OZ checkout at tag V4.7 (default `.local/oz47/oz`; git-ignored, never committed)
 *   --out       the sidecar written (default `.local/oz-import/z88v47.rom.dis`)
 *
 * A report (the stop, target mismatches, renames, the measured level) is printed and written beside the
 * sidecar as `<bank>.report.txt`. Labels over 16 characters take their names from the reviewed table
 * `dev/ai/rom-annotations/z88-label-renames.json`.
 */

const { existsSync, mkdirSync, readFileSync, writeFileSync } = require("node:fs");
const { dirname, join, resolve } = require("node:path");
const { registerTsRuntime } = require("./lib/ts-runtime.cjs");

const root = registerTsRuntime();
const { alignOzModule, ozHeaderSynopsis, shortLabelName } = require(join(root, "src/common/roms/ozSourceAligner.ts"));
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
const DEFINES = ["OZ_SLOT0"];

function args() {
  const argv = process.argv.slice(2);
  const options = {
    oz: join(root, ".local/oz47/oz"),
    out: join(root, ".local/oz-import/z88v47.rom.dis"),
    defines: [...DEFINES],
    includes: []
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--bank") options.bank = Number(argv[++i].replace(/^\$/, "0x"));
    else if (a === "--banks") options.banks = argv[++i].split(",").map((b) => Number(b.trim().replace(/^\$/, "0x")));
    else if (a === "--oz") options.oz = resolve(argv[++i]);
    else if (a === "--out") options.out = resolve(argv[++i]);
    else if (a === "--merge") options.merge = true;
    else if (a === "--at") options.at = Number(argv[++i].replace(/^\$/, "0x"));
    else if (a === "--define") options.defines.push(argv[++i]);
    else if (a === "--include") options.includes.push(argv[++i]);
    else if (a === "--write-renames") options.writeRenames = true;
    else options.module = a;
  }
  if (options.banks) options.bank = options.banks[0];
  options.banks ??= [options.bank];
  const consecutive = options.banks.every((b, i) => b === options.bank + i);
  if (!options.module || !Number.isInteger(options.bank) || !consecutive) {
    throw new Error(
      "import-oz-source <module.asm|project.prj> --bank <n> | --banks <n,n+1,...> [--merge] [--define X] [--include dir] [--oz <dir>] [--out <sidecar>]"
    );
  }
  return options;
}

/**
 * Klive's decoding of one instruction at a bank offset, the bank's offset 0 listed at `origin` (below 0
 * for a run stored above where it runs: LOWRAM, whose offsets below the run have no address)
 */
function decoderAt(bytes, origin) {
  const size = bytes.length;
  const memory = new Uint8Array(0x10000);
  const skip = Math.max(0, -origin);
  memory.set(bytes.subarray(skip, skip + 0x10000 - Math.max(0, origin)), origin + skip);
  const cache = new Map();
  return async (offset) => {
    if (cache.has(offset)) return cache.get(offset);
    const address = origin + offset;
    if (address < 0) return undefined;
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
          item.branch.target < origin + size
            ? { target: item.branch.target - origin }
            : {})
        }
      : undefined;
    cache.set(offset, result);
    return result;
  };
}

/**
 * `--all [--oz <dir>] [--out <sidecar>]`: every component of `z88-oz47-components.json` into a fresh
 * sidecar, in order, each in a process of its own; the first of a bank replaces it, the rest merge.
 * Prints each component's summary; exits 1 when any did not walk to its end or has a target mismatch.
 */
function importAll(argv) {
  const { spawnSync } = require("node:child_process");
  const { unlinkSync } = require("node:fs");
  const passOn = [];
  let out = join(root, ".local/oz-import/z88v47.rom.dis");
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--write-renames") passOn.push(argv[i]);
    if (argv[i] === "--oz" || argv[i] === "--out") passOn.push(argv[i], argv[i + 1]);
    if (argv[i] === "--out") out = resolve(argv[i + 1]);
    if (argv[i] === "--oz" || argv[i] === "--out") i++;
  }
  if (existsSync(out)) unlinkSync(out);
  const { components } = JSON.parse(readFileSync(join(root, "dev/ai/rom-annotations/z88-oz47-components.json"), "utf8"));
  const seen = new Set();
  let failed = 0;
  for (const c of components) {
    const banks = c.banks ?? [c.bank];
    const args = [__filename, c.module, ...(c.banks ? ["--banks", banks.join(",")] : ["--bank", String(c.bank)]), ...passOn];
    if (banks.some((b) => seen.has(b))) args.push("--merge");
    for (const b of banks) seen.add(b);
    for (const d of c.defines ?? []) args.push("--define", d);
    for (const inc of c.includes ?? []) args.push("--include", inc);
    if (c.at !== undefined) args.push("--at", String(c.at));
    const run = spawnSync(process.execPath, args, { encoding: "utf8" });
    const lines = (run.stdout || run.stderr).split("\n");
    const ok = run.status === 0 && lines.some((l) => l.startsWith("walked to")) && lines.some((l) => l === "target mismatches: 0");
    if (!ok) failed++;
    console.log(`${ok ? "ok  " : "FAIL"} ${lines[0]}`);
    for (const l of lines.filter((x) => /^(placed|STOP|target|level)/.test(x))) console.log(`     ${l}`);
  }
  console.log(failed ? `\n${failed} component(s) did not import cleanly` : `\nAll ${components.length} components imported.`);
  if (!failed) console.log(fillGaps(out));
  if (!failed) console.log(applyAuthored(out));
  process.exit(failed ? 1 : 0);
}

/**
 * The bytes no component covers, between components and after the last one, are the build's $FF
 * filler: each such run becomes a `fill` region (listed as one `.fillb n,$FF` row instead of `rst $38`
 * rows), `observed`. A run with any other byte stays as it is and is reported.
 */
function fillGaps(file) {
  const sidecar = JSON.parse(readFileSync(file, "utf8"));
  const rom = new Uint8Array(readFileSync(join(root, "src/public/roms/z88v47.rom")));
  let filled = 0;
  let bytesFilled = 0;
  const other = [];
  for (const [key, bank] of Object.entries(sidecar.banks)) {
    const bytes = rom.subarray(Number(key) * 0x4000, (Number(key) + 1) * 0x4000);
    const covered = new Uint8Array(0x4000);
    for (const r of bank.regions) covered.fill(1, r.start, r.end + 1);
    for (let i = 0; i < 0x4000; ) {
      if (covered[i]) {
        i++;
        continue;
      }
      let j = i;
      while (j < 0x4000 && !covered[j]) j++;
      if (bytes.subarray(i, j).every((v) => v === 0xff)) {
        bank.regions.push({ start: i, end: j - 1, type: "bytes", decode: "fill" });
        sidecar.provenance[`${key}:${i}:region`] = "observed";
        filled++;
        bytesFilled += j - i;
      } else other.push(`bank ${key} $${hex4(i)}-$${hex4(j - 1)}`);
      i = j;
    }
    bank.regions.sort((a, b) => a.start - b.start);
  }
  writeFileSync(file, tools.formatRomSidecar(sidecar));
  const notFiller = other.length ? `; not filler: ${other.join(", ")}` : "";
  return `Filler: ${filled} run(s) of $FF, ${bytesFilled} bytes, as fill regions${notFiller}.`;
}

/**
 * The hand-written entries of `z88-oz47-authored.json` over the imported sidecar (Phase 3): a label
 * replaces the one at its offset, a synopsis or comment the imported one, a region the bytes it
 * overlaps (an overlapped region keeps its parts outside); a bank the import does not cover gets its page. Each entry keeps its own provenance.
 */
function applyAuthored(file) {
  const authored = JSON.parse(readFileSync(join(root, "dev/ai/rom-annotations/z88-oz47-authored.json"), "utf8"));
  const sidecar = JSON.parse(readFileSync(file, "utf8"));
  const rom = new Uint8Array(readFileSync(join(root, "src/public/roms/z88v47.rom")));
  let labels = 0;
  let lines = 0;
  let regions = 0;
  for (const [key, entries] of Object.entries(authored.banks)) {
    const bank = (sidecar.banks[key] ??= { offsetIndex: 0, regions: [], localLabels: [], lineAnnotations: {} });
    if (!sidecar.pages[key]) {
      const bytes = rom.subarray(Number(key) * 0x4000, (Number(key) + 1) * 0x4000);
      sidecar.pages[key] = { crc32: romPageIdentity(bytes).crc32, name: entries.page?.name ?? `OZ 4.7, bank ${hex2(Number(key))}h` };
    }
    if (entries.page?.segments) sidecar.pages[key].segments = entries.page.segments;
    for (const { name, value, provenance, synopsis } of entries.labels ?? []) {
      bank.localLabels = bank.localLabels.filter((l) => l.value !== value && l.name !== name);
      bank.localLabels.push({ name, value });
      sidecar.provenance[`${key}:${value}:label`] = provenance;
      labels++;
      if (synopsis) {
        (bank.lineAnnotations[value] ??= {}).synopsis = synopsis;
        sidecar.provenance[`${key}:${value}:line`] = provenance;
        lines++;
      }
    }
    for (const [offset, { provenance, ...entry }] of Object.entries(entries.lines ?? {})) {
      Object.assign((bank.lineAnnotations[offset] ??= {}), entry);
      sidecar.provenance[`${key}:${offset}:line`] = provenance;
      lines++;
    }
    for (const { provenance, ...region } of entries.regions ?? []) {
      // --- An overlapped region keeps the parts outside the new one (code around an inline string)
      const kept = [];
      for (const old of bank.regions) {
        if (old.end < region.start || old.start > region.end) {
          kept.push(old);
          continue;
        }
        const oldProvenance = sidecar.provenance[`${key}:${old.start}:region`];
        delete sidecar.provenance[`${key}:${old.start}:region`];
        const parts = [];
        if (old.start < region.start) parts.push({ ...old, end: region.start - 1 });
        if (old.end > region.end) parts.push({ ...old, start: region.end + 1 });
        for (const part of parts) {
          kept.push(part);
          if (oldProvenance) sidecar.provenance[`${key}:${part.start}:region`] = oldProvenance;
        }
      }
      bank.regions = kept;
      bank.regions.push(region);
      sidecar.provenance[`${key}:${region.start}:region`] = provenance;
      regions++;
    }
    bank.localLabels.sort((a, b) => a.value - b.value);
    bank.regions.sort((a, b) => a.start - b.start);
  }
  writeFileSync(file, tools.formatRomSidecar(sidecar));
  return `Hand-written entries applied: ${labels} label(s), ${lines} line annotation(s), ${regions} region(s).`;
}

if (process.argv.includes("--all")) importAll(process.argv.slice(2).filter((a) => a !== "--all"));

(async () => {
  const o = args();
  const modulePath = join(o.oz, o.module);
  const rom = new Uint8Array(readFileSync(join(root, "src/public/roms/z88v47.rom")));
  const bytes = rom.subarray(o.bank * 0x4000, (o.bank + o.banks.length) * 0x4000);
  const reader = {
    include(from, name) {
      // --- The including file's folder, the project's -I folders (relative to the module), then def/
      const folders = [dirname(from), ...o.includes.map((dir) => resolve(dirname(modulePath), dir)), join(o.oz, "def")];
      for (const folder of folders) {
        const path = resolve(folder, name);
        if (existsSync(path)) return { path, text: readFileSync(path, "latin1") };
      }
      return undefined;
    }
  };

  // --- The modules: one `.asm`, or a `.prj`'s list in link order (each line's file, a path relative to
  // --- the project, before its `: dependencies`, which may touch it: `osfep/fepcrddata.asm:`; mpm adds
  // --- `.asm` to a bare name: `ostables`). mpm places each module where the one before it ended
  const modules = /\.prj$/i.test(modulePath)
    ? readFileSync(modulePath, "latin1")
        .split(/\r?\n/)
        .map((line) => line.replace(/;.*/, "").split(":")[0].trim().split(/\s+/)[0])
        .filter((name) => name && !name.startsWith("-"))
        .map((name) => resolve(dirname(modulePath), /\.\w+$/.test(name) ? name : `${name}.asm`))
    : [modulePath];
  const texts = modules.map((path) => readFileSync(path, "latin1"));

  // --- The aligner is synchronous; Klive's disassembler is not. A first walk of the first module, with
  // --- no decoding, stops at its first instruction, after its org, and so gives the segment. Then every
  // --- offset of the bank is decoded up front at that segment's address.
  const first = alignOzModule({ path: modules[0], text: texts[0], bytes, defines: o.defines, reader, decodeAt: () => undefined });
  // --- With --at, the module is stored at that offset and runs at its org: offset 0 is `org - at`
  const origin = o.at !== undefined && first.org !== undefined ? first.org - o.at : first.org !== undefined ? first.org & 0xc000 : 0xc000;
  const decode = decoderAt(bytes, origin);
  const decoded = new Map();
  for (let offset = 0; offset < bytes.length; offset++) decoded.set(offset, await decode(offset));

  // --- Each module where the last one ended; a stop ends the project's walk there
  const walks = [];
  let next = o.at;
  for (let i = 0; i < modules.length; i++) {
    const walk = alignOzModule({
      path: modules[i],
      text: texts[i],
      bytes,
      defines: o.defines,
      reader,
      decodeAt: (offset) => decoded.get(offset),
      base: origin,
      ...(next !== undefined ? { start: next } : {})
    });
    walks.push(walk);
    next = walk.end;
    if (walk.stop) break;
  }
  const whole = {
    org: walks[0].org,
    start: walks[0].start,
    end: walks[walks.length - 1].end,
    labels: walks.flatMap((w) => w.labels),
    lines: walks.flatMap((w) => w.lines),
    stop: walks.find((w) => w.stop)?.stop,
    unplaced:
      walks.reduce((sum, w) => sum + w.unplaced, 0) +
      texts.slice(walks.length).reduce((sum, t) => sum + t.split(/\r?\n/).filter((l) => l.replace(/;.*/, "").trim()).length, 0),
    targetMismatches: walks.flatMap((w) => w.targetMismatches),
    problems: [...new Set(walks.flatMap((w) => w.problems))]
  };
  // --- Jumps across modules: to a label of another module of the project, the label's offset
  // --- A name two modules both define (each its own `HexNibble`) may be either: any of them will do
  const projectLabels = new Map();
  for (const label of whole.labels) {
    projectLabels.set(label.name, [...(projectLabels.get(label.name) ?? []), label.offset]);
  }
  for (const jump of walks.flatMap((w) => w.externalJumps)) {
    const at = projectLabels.get(jump.label);
    if (at === undefined || at.includes(jump.target)) continue;
    whole.targetMismatches.push({
      ...jump,
      reason: `the target is ${jump.target === undefined ? "outside the bank" : `$${hex4(jump.target)}`}, the label ${jump.label} is at ${at.map((a) => `$${hex4(a)}`).join(" or ")}`
    });
  }

  // --- Each bank its slice of the walk, at offsets from the bank's start
  for (let slice = 0; slice < o.banks.length; slice++) {
    const lo = slice * 0x4000;
    const hi = lo + 0x4000;
    const inBank = (offset) => offset >= lo && offset < hi;
    const shift = (x) => ({ ...x, offset: x.offset - lo });
    const start = Math.max(whole.start, lo);
    const finish = Math.min(whole.end, hi);
    // --- A later bank the walk did not reach has nothing to write; the first always reports
    if (start >= finish && slice > 0) continue;
    const result = {
      ...whole,
      start: start - lo,
      end: finish - lo,
      labels: whole.labels.filter((l) => inBank(l.offset)).map(shift),
      lines: whole.lines.filter((l) => inBank(l.offset)).map(shift),
      targetMismatches: whole.targetMismatches.filter((m) => inBank(m.offset)).map(shift)
    };
    await writeBank(o.banks[slice], slice, result, bytes.subarray(lo, hi));
  }

  async function writeBank(bankNo, slice, result, bankBytes) {
    // --- The sidecar, and with --merge what the bank keeps outside this component's range: its labels,
    // --- lines, regions, segments and their provenance. Without --merge, the bank is this component.
    const rel = (path) => path.slice(o.oz.length + 1);
    const end = result.end - 1;
    const outside = (offset) => offset < result.start || offset > end;
    mkdirSync(dirname(o.out), { recursive: true });
    const sidecar = existsSync(o.out)
      ? JSON.parse(readFileSync(o.out, "utf8"))
      : { schemaVersion: 3, machine: "rom", source: { fileName: "z88v47.rom" }, authoring: "dev/ai/rom-annotations/README.md", level: 0, pages: {}, banks: {}, provenance: {} };
    sidecar.sourceCode = SOURCE_CODE;
    const key = String(bankNo);
    const old = o.merge ? sidecar.banks[key] : undefined;
    const keptLabels = (old?.localLabels ?? []).filter((l) => outside(l.value));

    const report = [];
    const labels = [];
    const renames = [];
    const lineAnnotations = {};
    const provenance = {};
    const names = new Set(keptLabels.map((l) => l.name));
    // --- Names over 16 characters, and names two modules (or two components of the bank) share, take
    // --- their name from the reviewed table (`z88-label-renames.json`: keyed `file:name` for one
    // --- module's, `name` for every module's); a name the table lacks gets `shortLabelName`'s proposal,
    // --- which --write-renames records there
    const renamesFile = join(root, "dev/ai/rom-annotations/z88-label-renames.json");
    const renameJson = JSON.parse(readFileSync(renamesFile, "utf8"));
    const renameTable = renameJson.renames;
    const proposals = {};
    let renamed = 0;
    const stemOf = (file) => file.split("/").pop().replace(/\.asm$/i, "").replace(/\W/g, "");
    // --- A label in code that is not a routine, only a jump target inside one, needs no synopsis for
    // --- level 2 (D-OZ6): the page's `jumpLabels`. A label with a header stays a routine
    const kindAt = new Map(result.lines.map((line) => [line.offset, line.kind]));
    const routines = routineNames(o.oz);
    const jumpOffsets = [];
    for (const label of result.labels) {
      // --- A macro's own label (`.\start` in a DOR macro) is not the source's
      if (label.internal) continue;
      if (labels.some((l) => l.value === label.offset)) continue;
      const fileKey = `${rel(label.file)}:${label.name}`;
      let name = renameTable[fileKey] ?? renameTable[label.name] ?? label.name;
      if (!isValidLabelName(name)) {
        const proposal = shortLabelName(name, names);
        proposals[label.name] = proposal;
        renames.push(`${label.name} -> ${proposal} at $${hex4(label.offset)} (${rel(label.file)}:${label.line}): too long`);
        name = proposal;
      }
      // --- Two modules' local labels may share a name; a page's names are unique
      if (names.has(name)) {
        const proposal = shortLabelName(`${name}_${stemOf(label.file)}`, names);
        proposals[fileKey] = proposal;
        renames.push(`${name} -> ${proposal} at $${hex4(label.offset)} (${rel(label.file)}:${label.line}): the name is taken`);
        name = proposal;
      }
      if (name !== label.name) renamed++;
      names.add(name);
      labels.push({ name, value: label.offset });
      provenance[`${bankNo}:${label.offset}:label`] = "source";
      if (!routines.has(label.name) && kindAt.get(label.offset) === "code" && !label.header.length) {
        jumpOffsets.push(label.offset);
      }
      if (label.header.length) {
        lineAnnotations[label.offset] = { synopsis: ozHeaderSynopsis(label.header) };
      }
    }
    for (const line of result.lines) {
      if (!line.comment) continue;
      const entry = (lineAnnotations[line.offset] ??= {});
      entry.comment = line.comment;
    }
    for (const offset of Object.keys(lineAnnotations)) provenance[`${bankNo}:${offset}:line`] = "source";

    // --- Regions: code, and each run of data lines as bytes
    const regions = [];
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
    for (const region of regions) if (region.type !== "disassemble") provenance[`${bankNo}:${region.start}:region`] = "source";

    const segment = (((result.org ?? 0xc000) & 0xc000) + slice * 0x4000) >> 14;
    const newLabels = labels;
    const keptLines = Object.fromEntries(Object.entries(old?.lineAnnotations ?? {}).filter(([k]) => outside(Number(k))));
    const keptRegions = (old?.regions ?? []).filter((r) => r.end < result.start || r.start > end);
    const bank = {
      offsetIndex: 0,
      regions: [...keptRegions, ...regions].sort((a, b) => a.start - b.start),
      localLabels: [...keptLabels, ...newLabels].sort((a, b) => a.value - b.value),
      lineAnnotations: { ...keptLines, ...lineAnnotations }
    };
    const segments = [
      ...((o.merge ? sidecar.pages[key]?.segments : undefined) ?? []).filter((s) => outside(s.start)),
      { start: result.start, segment, ...(o.at !== undefined && result.org !== undefined ? { address: result.org } : {}) }
    ].sort((a, b) => a.start - b.start);
    const jumpLabels = [
      ...((o.merge ? sidecar.pages[key]?.jumpLabels : undefined) ?? []).filter(outside),
      ...jumpOffsets
    ].sort((a, b) => a - b);
    sidecar.pages[key] = {
      crc32: romPageIdentity(bankBytes).crc32,
      name: `OZ 4.7, bank ${hex2(bankNo)}h`,
      segments,
      ...(jumpLabels.length ? { jumpLabels } : {})
    };
    // --- The IDE lists a bank at one address (`offsetIndex`, a segment): the segment of its largest
    // --- run, so that the most jumps show their labels. A run of another segment (bank $0A's Filer)
    // --- or with its own address (LOWRAM) is listed at that segment's address too
    const covered = new Map();
    segments.forEach((s, i) => {
      const length = (segments[i + 1]?.start ?? 0x4000) - s.start;
      covered.set(s.segment, (covered.get(s.segment) ?? 0) + length);
    });
    bank.offsetIndex = [...covered].sort((a, b) => b[1] - a[1])[0][0] & 0x03;
    sidecar.banks[key] = bank;
    for (const k of Object.keys(sidecar.provenance)) {
      if (!k.startsWith(`${bankNo}:`)) continue;
      if (!o.merge || !outside(Number(k.split(":")[1]))) delete sidecar.provenance[k];
    }
    Object.assign(sidecar.provenance, provenance);
    writeFileSync(o.out, tools.formatRomSidecar(sidecar));

    // --- The level, as the readiness check measures it
    const level = await tools.measureRomLevel(bank, bankBytes, romDecoderFor("z88-oz", segments), new Set(jumpLabels));

    const codeBytes = result.lines.filter((l) => l.kind === "code").reduce((s, l) => s + l.length, 0);
    const dataBytes = result.lines.filter((l) => l.kind === "data").reduce((s, l) => s + l.length, 0);
    report.push(`${rel(modulePath)} (${walks.length}/${modules.length} module(s) walked) -> bank ${hex2(bankNo)}h${o.banks.length > 1 ? ` (${slice + 1} of ${o.banks.length})` : ""}, org ${result.org !== undefined ? "$" + hex4(result.org) : "-"}, segment ${segment}`);
    report.push(`placed $${hex4(result.start)}-$${hex4(result.end - 1)}: ${result.lines.length} lines (${codeBytes} code bytes, ${dataBytes} data bytes), ${result.labels.length} labels`);
    report.push(result.stop ? `STOP at $${hex4(result.stop.offset)} ${rel(result.stop.file)}:${result.stop.line}: ${result.stop.source} -- ${result.stop.reason}${result.stop.decoded ? ` (decoded: ${result.stop.decoded})` : ""}; ${result.unplaced} line(s) not placed` : "walked to the module's end");
    report.push(`target mismatches: ${result.targetMismatches.length}`);
    for (const m of result.targetMismatches.slice(0, 20)) report.push(`  $${hex4(m.offset)} ${rel(m.file)}:${m.line}: ${m.source} -- ${m.reason}`);
    report.push(`labels renamed: ${renamed}, ${Object.keys(proposals).length} of them by a proposal not in the table yet (--write-renames records it)`);
    for (const r of renames) report.push(`  ${r}`);
    const long = result.lines.filter((l) => l.comment && l.comment.length > 70).length;
    report.push(`line comments: ${result.lines.filter((l) => l.comment).length} (${long} over 70 characters); synopses from headers: ${result.labels.filter((l) => l.header.length).length}`);
    report.push(`level ${level.level}: ${level.instructions} instructions, ${level.unlabelledTargets.length} unlabelled target(s), ${level.midInstructionTargets.length} mid-instruction, ${level.misplacedLabels.length} misplaced label(s), ${level.labelsWithoutSynopsis.length} label(s) without a synopsis`);
    if (level.unlabelledTargets.length) report.push(`  unlabelled: ${level.unlabelledTargets.slice(0, 20).map((t) => "$" + hex4(t)).join(" ")}`);
    if (level.misplacedLabels.length) report.push(`  misplaced: ${level.misplacedLabels.slice(0, 20).join(" ")}`);
    for (const p of result.problems) report.push(`note: ${p}`);
    const reportFile = join(dirname(o.out), `${hex2(bankNo)}.report.txt`);
    writeFileSync(reportFile, report.join("\n") + "\n");
    // --- --write-renames: the proposals join the reviewed table, sorted, where a hand edit then wins
    if (o.writeRenames && Object.keys(proposals).length) {
      const merged = { ...renameTable, ...proposals };
      renameJson.renames = Object.fromEntries(Object.keys(merged).sort((a, b) => a.localeCompare(b)).map((k) => [k, merged[k]]));
      writeFileSync(renamesFile, JSON.stringify(renameJson, null, 2) + "\n");
    }
    console.log(report.join("\n"));
    console.log(`\nwrote ${o.out}\nwrote ${reportFile}`);
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * The names the OZ source uses as routines anywhere: exported (`xdef`), called (`call`, `extcall`,
 * conditional or not) or listed in a table (`defw`, `defp`, `dw`). Read once per process.
 */
let routineNameCache;
function routineNames(ozDir) {
  if (routineNameCache) return routineNameCache;
  const { readdirSync } = require("node:fs");
  const names = new Set();
  const add = (list) => {
    for (const item of list.split(",")) {
      const name = /^\s*([A-Za-z_]\w*)/.exec(item)?.[1];
      if (name) names.add(name);
    }
  };
  (function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.asm$/i.test(entry.name)) {
        for (const row of readFileSync(path, "latin1").split(/\r?\n/)) {
          const code = row.replace(/;.*/, "");
          const exported = /^\s*xdef\s+(.*)$/i.exec(code);
          if (exported) add(exported[1]);
          const called = /\b(?:call|extcall)\s+(?:(?:n?z|n?c|po|pe|p|m)\s*,\s*)?([A-Za-z_]\w*)/i.exec(code);
          if (called) names.add(called[1]);
          const table = /^\s*(?:\.\w+\s+)?(?:defw|defp|dw)\s+(.*)$/i.exec(code);
          if (table) add(table[1]);
        }
      }
    }
  })(ozDir);
  routineNameCache = names;
  return names;
}

function hex2(v) {
  return v.toString(16).toUpperCase().padStart(2, "0");
}
function hex4(v) {
  return v.toString(16).toUpperCase().padStart(4, "0");
}
