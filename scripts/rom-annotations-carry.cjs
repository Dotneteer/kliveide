#!/usr/bin/env node

/*
 * Carry a Klive ROM sidecar's annotations to a newer ROM whose bytes moved
 * (`.plans/ZXNEXT_CORE_VERSIONS_PLAN.md` D8).
 *
 *   npm run rom:annotations:carry -- <fromSidecar> <toRom> [--page n] [--out <sidecar>]
 *                                    [--review <file>] [--force]
 *
 *   fromSidecar  a shipped sidecar, by its path under src/public/roms
 *                (`zxnext/nextzxos-2.08/enNextZX.rom.dis`) or a path to the file
 *   toRom        the ROM file it is carried to (`zxnext/nextzxos-2.10/enNextZX.rom`), likewise
 *   --page n     carry only that page (the default: every page the sidecar has a bank for); an
 *                existing output keeps its other pages
 *   --out        the sidecar written (default: `<toRom>.dis`); refused when it exists, unless --force
 *                or --page
 *   --review     the review list (default: `.rom-annotations/carry/<file>.review.txt`)
 *
 * How an entry is placed. Every annotated offset (a label, a line annotation, a data region's first
 * and last byte) is re-anchored on its own by a byte signature: a window of the old page's bytes
 * around it that occurs exactly once in the new page. Three window shapes are tried, each widened
 * from 8 to 128 bytes until it matches once (or no longer matches at all): forward from the offset,
 * centred on it, and ending at it (that one also has to find the annotated instruction's own bytes
 * at the place). In code the windows are cut at instruction boundaries, and the address operands of
 * CALL/JP/LD/PUSH nn (and of a restart's inline word) that point into the page are wildcards, since moving code changes them. An offset is:
 *
 * - placed, when every shape that matched once agrees on the place; a place found only by a window
 *   with fewer than 16 fixed bytes must also lie between its strongly placed neighbours;
 * - placed by its neighbours, when no window matched once but the strongly placed anchors on both
 *   sides moved by the same distance and one of the candidates is at that distance;
 * - otherwise not placed: missing (the bytes changed), ambiguous (several places, neighbours not
 *   agreeing), in conflict (shapes disagree) or out of order.
 *
 * The new sidecar has the placed labels, line annotations and data regions (code regions are the
 * gaps between them), labels that are not on an instruction start of the new page are dropped, and
 * every carried entry's provenance is `derived`, with `carriedFrom` naming the sidecar it came from.
 * `level` is the lower of the old one and the new page's measured level. Everything not carried, and
 * every carried comment that names a ROM address which moved, is listed in the review file.
 *
 * The re-anchoring core is `src/common/reverse/pipeline/align/carry.ts`, which
 * `test/annotations/romCarry.test.ts` tests.
 */

const { existsSync, mkdirSync, readFileSync, writeFileSync } = require("node:fs");
const { registerTsRuntime } = require("./lib/ts-runtime.cjs");
const { basename, dirname, join, relative, resolve, sep } = require("node:path");

const PAGE = 0x4000;

// --- The re-anchoring core lives in the pipeline (`src/common/reverse/pipeline/align/carry.ts`)
const root = registerTsRuntime();
const { carryBank, dropMisaligned, addressMentions } = require(join(root, "src/common/reverse/pipeline/align/carry.ts"));
const hex4 = (v) => v.toString(16).toUpperCase().padStart(4, "0");
const hex = (v) => (v === undefined ? "?" : `$${hex4(v)}`);
const regionText = (r) => `${r.type}${r.decode ? `/${r.decode}` : ""} ${hex(r.start)}-${hex(r.end)}`;

// =================================================================================================
// The command line

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

async function main() {
  const ROMS = join(root, "src/public/roms");
  const tools = require(join(root, "src/common/roms/romAnnotationTools.ts"));
  const identity = require(join(root, "src/common/roms/romIdentity.ts"));
  const sidecarPaths = require(join(root, "src/common/roms/romSidecarPaths.ts"));
  const { romDecoderFor } = require(join(root, "src/renderer/appIde/annotations/romDecoder.ts"));
  const { withInheritedEntries } = require(join(root, "src/renderer/appIde/annotations/romInheritance.ts"));
  const { parseAnnotations } = require(join(root, "src/renderer/appIde/annotations/programAnnotations.ts"));

  const args = process.argv.slice(2);
  const option = (name) => {
    const at = args.indexOf(name);
    if (at < 0) return undefined;
    const value = args[at + 1];
    args.splice(at, 2);
    return value;
  };
  const flag = (name) => {
    const at = args.indexOf(name);
    if (at >= 0) args.splice(at, 1);
    return at >= 0;
  };
  const onlyPage = option("--page");
  const outArg = option("--out");
  const reviewArg = option("--review");
  const force = flag("--force");
  const [fromArg, toArg] = args;
  if (!fromArg || !toArg) {
    console.error("Usage: npm run rom:annotations:carry -- <fromSidecar> <toRom> [--page n] [--out f] [--review f] [--force]");
    process.exit(2);
  }

  // --- Names relative to src/public/roms (or paths)
  const underRoms = (name) => {
    const path = existsSync(name) ? resolve(name) : join(ROMS, sidecarPaths.canonicalShippedSidecar(name));
    return { path, rel: path.startsWith(ROMS + sep) ? relative(ROMS, path).split(sep).join("/") : undefined };
  };
  const from = underRoms(fromArg);
  const toRom = underRoms(toArg);
  const out = outArg ? resolve(outArg) : `${toRom.path}.dis`;
  const outRel = out.startsWith(ROMS + sep) ? relative(ROMS, out).split(sep).join("/") : undefined;
  const old = JSON.parse(readFileSync(from.path, "utf8"));
  const oldRom = new Uint8Array(readFileSync(from.path.replace(/\.dis$/i, "")));
  const newRom = new Uint8Array(readFileSync(toRom.path));
  const pageOf = (bytes, page) => bytes.subarray(page * PAGE, Math.min(bytes.length, (page + 1) * PAGE));
  const pages = Object.keys(old.banks ?? {}).filter((p) => onlyPage === undefined || p === String(Number(onlyPage)));
  if (!pages.length) throw new Error(`${fromArg} has no bank for page ${onlyPage}`);
  if (existsSync(out) && !force && onlyPage === undefined) {
    throw new Error(`${out} exists. Pass --force to replace it, or --page n to replace one page.`);
  }

  const kindOf = (bytes) => identity.knownRomPageKind(identity.romPageIdentity(bytes));
  const decodeAll = async (bank, bytes) => {
    const decode = romDecoderFor(kindOf(bytes));
    const code = (bank.regions ?? []).filter((r) => r.type === "disassemble");
    const cuts = [...new Set((bank.localLabels ?? []).map((l) => l.value))].sort((a, b) => a - b);
    const instructions = [];
    for (const region of code) {
      const end = Math.min(region.end, bytes.length - 1);
      const runs = [region.start, ...cuts.filter((o) => o > region.start && o <= end)];
      for (let i = 0; i < runs.length; i++) {
        instructions.push(...(await decode(bytes, runs[i], i + 1 < runs.length ? runs[i + 1] - 1 : end)));
      }
    }
    return instructions;
  };

  const target = existsSync(out) && onlyPage !== undefined ? JSON.parse(readFileSync(out, "utf8")) : undefined;
  const sidecar = target ?? {};
  for (const [key, value] of Object.entries(old)) {
    if (!["banks", "pages", "provenance", "level", "inherits", "source"].includes(key) && !(key in sidecar)) sidecar[key] = value;
  }
  sidecar.source = { ...(old.source ?? {}), fileName: basename(toRom.path) };
  sidecar.pages = { ...(sidecar.pages ?? {}) };
  sidecar.banks = { ...(sidecar.banks ?? {}) };
  sidecar.provenance = { ...(sidecar.provenance ?? {}) };
  if (old.inherits) {
    // --- An inherited sidecar of the old ROM's folder is the new ROM's folder's file of that name
    const oldDir = dirname(from.rel ?? "");
    const newDir = dirname(toRom.rel ?? "");
    sidecar.inherits = old.inherits.map((entry) => {
      const canonical = sidecarPaths.canonicalShippedSidecar(entry.sidecar);
      const moved = dirname(canonical) === oldDir ? [newDir, basename(canonical)].filter((p) => p !== ".").join("/") : canonical;
      return { ...entry, sidecar: existsSync(join(ROMS, moved)) ? moved : canonical };
    });
  }
  sidecar.carriedFrom = {
    sidecar: from.rel ?? basename(from.path),
    method: "byte signature (scripts/rom-annotations-carry.cjs)"
  };

  const report = [];
  const summary = [];
  for (const page of pages) {
    const n = Number(page);
    const oldBank = old.banks[page];
    const oldBytes = pageOf(oldRom, n);
    const newBytes = pageOf(newRom, n);
    const { bank, lost, moved } = carryBank(oldBank, oldBytes, newBytes, { instructions: await decodeAll(oldBank, oldBytes) });
    const starts = new Set((await decodeAll(bank, newBytes)).map((i) => i.offset));
    lost.push(...dropMisaligned(bank, starts));

    // --- Provenance: every carried entry is derived from the old sidecar
    for (const key of Object.keys(sidecar.provenance)) if (key.startsWith(`${page}:`)) delete sidecar.provenance[key];
    sidecar.banks[page] = bank;
    for (const key of tools.provenanceKeysOf({ banks: { [page]: bank } })) sidecar.provenance[key] = "derived";
    sidecar.pages[page] = { ...(old.pages?.[page] ?? {}), crc32: identity.romCrc32(newBytes) };

    const oldLines = Object.keys(oldBank.lineAnnotations ?? {}).length;
    const oldLabels = (oldBank.localLabels ?? []).length;
    const oldRegions = (oldBank.regions ?? []).filter((r) => r.type !== "disassemble" || r.decode).length;
    const newRegions = bank.regions.filter((r) => r.type !== "disassemble" || r.decode).length;
    const lostOf = (kind) => lost.filter((l) => l.kind === kind);
    summary.push({
      page,
      labels: [bank.localLabels?.length ?? 0, oldLabels],
      lines: [Object.keys(bank.lineAnnotations ?? {}).length, oldLines],
      regions: [newRegions, oldRegions],
      moved: moved.length,
      resized: lostOf("resized").length
    });
    report.push(`== Page ${page} (${old.pages?.[page]?.crc32} -> ${sidecar.pages[page].crc32})`);
    report.push(
      `   labels ${bank.localLabels?.length ?? 0}/${oldLabels}, line annotations ${Object.keys(bank.lineAnnotations ?? {}).length}/${oldLines}, ` +
        `data regions ${newRegions}/${oldRegions} carried`
    );
    for (const [kind, title] of [
      ["label", "Labels not carried"],
      ["line", "Line annotations not carried"],
      ["region", "Data regions not carried (their bytes are code regions now)"],
      ["resized", "Data regions carried with another length"]
    ]) {
      const items = lostOf(kind);
      if (!items.length) continue;
      report.push("", `-- ${title} (${items.length})`);
      for (const item of items) {
        const what = item.name ?? (item.text ? item.text.replace(/\s+/g, " ").slice(0, 90) : "");
        report.push(`${hex(item.offset)}  ${what}\n        ${item.isNew ? "at the new offset: " : ""}${item.why}`);
      }
    }
    if (moved.length) {
      report.push("", `-- Carried comments to check: a ROM address they name moved or was not placed, or their data changed (${moved.length})`);
      for (const item of moved) {
        report.push(`${hex(item.offset)} (was ${hex(item.from)})  ${item.text.replace(/\s+/g, " ").slice(0, 90)}\n        ${item.why}`);
      }
    }
    report.push("");
  }
  for (const key of Object.keys(sidecar.provenance)) if (!sidecar.banks[key.split(":")[0]]) delete sidecar.provenance[key];

  // --- The level: the lower of the old file's and the new pages' measured one (inherited entries in)
  let measured = 2;
  const parsed = parseAnnotations(JSON.stringify(sidecar));
  if (!parsed.annotations) throw new Error(`The carried sidecar does not parse: ${JSON.stringify(parsed.diagnostics)}`);
  const { annotations } = await withInheritedEntries(parsed.annotations, (p) => pageOf(newRom, p), async (name, p) => ({
    annotations: parseAnnotations(readFileSync(join(ROMS, sidecarPaths.canonicalShippedSidecar(name)), "utf8")).annotations,
    bytes: pageOf(new Uint8Array(readFileSync(join(ROMS, sidecarPaths.canonicalShippedSidecar(name).replace(/\.dis$/, "")))), p)
  }));
  for (const page of Object.keys(sidecar.banks)) {
    const bytes = pageOf(newRom, Number(page));
    const level = await tools.measureRomLevel(annotations.banks[page], bytes, romDecoderFor(kindOf(bytes)));
    measured = Math.min(measured, level.level);
    report.push(
      `Page ${page} measured: level ${level.level}, ${level.unlabelledTargets.length} unlabelled target(s), ` +
        `${level.labelsWithoutSynopsis.length} label(s) without a synopsis, ${level.misplacedLabels.length} misplaced`
    );
  }
  sidecar.level = Math.min(old.level ?? 0, measured);
  writeFileSync(out, tools.formatRomSidecar(sidecar));

  const review =
    reviewArg ? resolve(reviewArg) : join(root, ".rom-annotations/carry", `${(outRel ?? basename(out)).replace(/\//g, "_")}.review.txt`);
  mkdirSync(dirname(review), { recursive: true });
  const header = [
    `Carried by scripts/rom-annotations-carry.cjs (byte signature), for hand review.`,
    `From: ${sidecar.carriedFrom.sidecar}`,
    `To:   ${outRel ?? out}  (level ${sidecar.level})`,
    ""
  ];
  writeFileSync(review, [...header, ...report].join("\n") + "\n");

  console.log(`Wrote ${outRel ?? out} (level ${sidecar.level}); review list: ${relative(root, review)}`);
  for (const s of summary) {
    console.log(
      `  page ${s.page}: labels ${s.labels[0]}/${s.labels[1]}, line annotations ${s.lines[0]}/${s.lines[1]}, ` +
        `data regions ${s.regions[0]}/${s.regions[1]} (${s.resized} resized), ${s.moved} carried comment(s) to check`
    );
  }
}
