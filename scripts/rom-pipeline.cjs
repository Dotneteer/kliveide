#!/usr/bin/env node

/*
 * The ROM annotation pipeline's command line (`.plans/ROM_ANNOTATION_PIPELINE_PLAN.md` §3.2).
 *
 *   npm run rom:pipeline -- image   <rom> [--page n] [--kind k] [--cpu z80|z80n]
 *                                   what the pipeline sees: banks, origin, CPU, known entries
 *   npm run rom:pipeline -- listing <rom> <from>-<to> [--page n] [--cpu z80|z80n] [--why "..."]
 *                                   [--sidecar <file> | --no-sidecar]
 *                                   the listing of a range (hex offsets), shaped by the sidecar's
 *                                   regions; each request is recorded for the feedback report (D11)
 *   npm run rom:pipeline -- export-ann <rom> [--page n] [--sidecar <file>] [--out <dir>]
 *                                   the sidecar's pages as .ann files (default: work/<rom>/export/)
 *   npm run rom:pipeline -- compile <rom> <ann-dir|file...> [--sidecar <file>] [--out <file>] [--dry-run]
 *                                   lays the .ann files over the sidecar and writes it (default: the
 *                                   working copy), with work/<rom>/problems.md; errors write nothing
 *   npm run rom:pipeline -- prepare <rom> [--page n] [--cpu z80|z80n] [--sidecar <file> | --no-sidecar]
 *                                   [--profile <file>] [--range-weight n] [--force]
 *                                   the routine cards, overview, questions and facts of a page, in
 *                                   work/<rom>/page-<n>/ (skipped when its inputs have not changed)
 *   npm run rom:pipeline -- profile <recipe> | --list
 *                                   runs a profile recipe on the real machine (test/rom-annotations/
 *                                   profileRecipes.ts) and writes work/<rom>/profile-page-<n>.json for
 *                                   every ROM page it covers, which prepare then reads, and a log of
 *                                   the commands and screens (work/<recipe>.log.md)
 *
 * The base sidecar is --sidecar, else the working copy (<Klive home>/RomAnnotations/...), else the
 * shipped one, else a new all-code one (a ROM nobody has annotated yet).
 *
 * A ROM is named by its path relative to src/public/roms (`ep-exdos13.rom`,
 * `zxnext/nextzxos-2.10/enNextZX.rom`) or by a path to the file. Work files go to
 * `.rom-annotations/work/<rom>/` (git-ignored). This script only reads and writes files; the logic is
 * in `src/common/reverse/pipeline/`, which the tests run.
 */

const { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } = require("node:fs");
const { homedir } = require("node:os");
const { spawnSync } = require("node:child_process");
const { basename, dirname, join, relative, resolve, sep } = require("node:path");
const { registerTsRuntime } = require("./lib/ts-runtime.cjs");

const root = registerTsRuntime();
const ROMS = join(root, "src/public/roms");
const WORK = join(root, ".rom-annotations/work");
const PIPELINE = join(root, "src/common/reverse/pipeline");

const { imageFromRomPage, romPageBytes, romPageCount } = require(join(PIPELINE, "image/romImage.ts"));
const { parseCpu } = require(join(PIPELINE, "image/cpu.ts"));
const { formatListingLine, listImageBank } = require(join(PIPELINE, "listing.ts"));
const { sidecarPageToAnn } = require(join(PIPELINE, "postprocess/sidecarToAnn.ts"));
const { compileAnnotations } = require(join(PIPELINE, "postprocess/compile.ts"));
const { addRomSidecarPage, newRomSidecar } = require(join(PIPELINE, "postprocess/newSidecar.ts"));
const sidecarPaths = require(join(root, "src/common/roms/romSidecarPaths.ts"));

const LATER = {};
const RECIPES = join(root, "test/rom-annotations/profileRecipes.ts");

main().catch((error) => {
  console.error(error?.message ?? error);
  process.exit(1);
});

async function main() {
  const args = process.argv.slice(2);
  const options = takeOptions(
    args,
    ["--page", "--kind", "--cpu", "--why", "--sidecar", "--out", "--profile", "--range-weight"],
    ["--no-sidecar", "--dry-run", "--force", "--list", "--help"]
  );
  const [command, ...rest] = args;
  if (!command || options["--help"]) return usage(0);
  if (LATER[command]) {
    console.error(`"${command}" is not built yet (phase ${LATER[command]} of .plans/ROM_ANNOTATION_PIPELINE_PLAN.md).`);
    process.exit(2);
  }
  if (command === "image") return showImage(rest, options);
  if (command === "listing") return showListing(rest, options);
  if (command === "export-ann") return exportAnn(rest, options);
  if (command === "compile") return compile(rest, options);
  if (command === "prepare") return prepare(rest, options);
  if (command === "profile") return profile(rest, options);
  console.error(`Unknown command "${command}".`);
  usage(2);
}

/** `image <rom>`: what the pipeline sees. */
function showImage([romArg], options) {
  if (!romArg) usage(2);
  const rom = loadRom(romArg, options);
  const { image } = rom;
  const [bank] = image.banks;
  console.log(`${image.name} page ${bank.id} of ${rom.pages}`);
  console.log(`  kind:   ${image.romKind ?? "(unknown: plain Z80 at $0000)"}`);
  console.log(`  cpu:    ${image.cpu}${options["--cpu"] ? " (from --cpu)" : ""}`);
  console.log(`  origin: ${hex(bank.origin)}, ${bank.bytes.length} bytes`);
  console.log(`  entries: ${image.entries.length ? "" : "none known before analysis"}`);
  for (const entry of image.entries) console.log(`    ${hex(entry.offset)}  ${entry.source}  ${entry.note}`);
}

/** `listing <rom> <from>-<to>`: a range of the listing, recorded as a request. */
async function showListing([romArg, range], options) {
  if (!romArg || !range) usage(2);
  const rom = loadRom(romArg, options);
  const [from, to] = parseRange(range);
  const bankId = rom.image.banks[0].id;
  const regions = options["--no-sidecar"] ? undefined : sidecarRegions(rom, options["--sidecar"], bankId);
  const lines = await listImageBank(rom.image, bankId, from, to, regions);
  const origin = rom.image.banks[0].origin;
  for (const line of lines) console.log(formatListingLine(line, origin));

  const folder = join(WORK, rom.workName);
  mkdirSync(folder, { recursive: true });
  const record = {
    at: new Date().toISOString(),
    page: Number(bankId),
    from,
    to,
    ...(options["--why"] ? { why: options["--why"] } : {}),
    lines: lines.length
  };
  appendFileSync(join(folder, "listing-requests.jsonl"), `${JSON.stringify(record)}\n`);
}

/** `profile <recipe>`: a recipe's run on the real machine, cut into ROM page profiles. */
function profile([recipe], options) {
  // --- The recipes import the test harnesses, so their ids are read from the file, not loaded
  const text = readFileSync(RECIPES, "utf8");
  const recipes = [...text.matchAll(/^\s+id: "([^"]+)",\n\s+description: "([^"]+)"/gm)].map((m) => ({ id: m[1], description: m[2] }));
  if (options["--list"] || !recipe) {
    for (const r of recipes) console.log(`${r.id.padEnd(14)} ${r.description}`);
    if (!recipe && !options["--list"]) process.exit(2);
    return;
  }
  if (!recipes.some((r) => r.id === recipe)) throw new Error(`No recipe "${recipe}" (there are ${recipes.map((r) => r.id).join(", ")})`);
  mkdirSync(WORK, { recursive: true });
  const result = spawnSync(
    "npx",
    ["vitest", "run", "--config", "build/vitest.config.ts", "--project", "e2e-cores", "test/rom-annotations/profile.test.ts"],
    {
      cwd: root,
      stdio: "inherit",
      env: { ...process.env, ROM_PROFILE_RECIPE: recipe, ROM_PROFILE_OUT: WORK },
      shell: process.platform === "win32"
    }
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
  console.log(`Profiles written under ${shown(WORK)}/<rom>/; the run's log is ${shown(join(WORK, `${recipe}.log.md`))}`);
}

/** `prepare <rom>`: the analysis bundle of one page. */
async function prepare([romArg], options) {
  if (!romArg) usage(2);
  const { analyseRomPage, PIPELINE_VERSION } = require(join(PIPELINE, "preprocess/analyse.ts"));
  const { factsJson, renderCardFiles, renderOverview, renderQuestions } = require(join(PIPELINE, "preprocess/cards.ts"));
  const { romCrc32 } = require(join(root, "src/common/roms/romIdentity.ts"));
  const rom = loadRom(romArg, options);
  const bankId = rom.image.banks[0].id;
  const base = options["--no-sidecar"] ? { label: "none (--no-sidecar)" } : readBase(rom, options["--sidecar"]);
  const folder = join(WORK, rom.workName, `page-${bankId}`);
  const profilePath = options["--profile"] ? resolve(options["--profile"]) : join(WORK, rom.workName, `profile-page-${bankId}.json`);
  const profileText = existsSync(profilePath) ? readFileSync(profilePath, "utf8") : undefined;
  const crc = (text) => (text === undefined ? null : romCrc32(new TextEncoder().encode(text)));
  const inputs = {
    pipelineVersion: PIPELINE_VERSION,
    rom: crc(Buffer.from(rom.image.banks[0].bytes).toString("latin1")),
    cpu: rom.image.cpu,
    sidecar: base.label,
    sidecarCrc: crc(base.text),
    profile: profileText ? shown(profilePath) : null,
    profileCrc: crc(profileText),
    rangeWeight: options["--range-weight"] ? Number(options["--range-weight"]) : null
  };
  const inputsFile = join(folder, "inputs.json");
  if (!options["--force"] && existsSync(inputsFile) && readFileSync(inputsFile, "utf8") === `${JSON.stringify(inputs, null, 2)}\n`) {
    return console.log(`${shown(folder)} is up to date (its inputs have not changed; --force to redo it).`);
  }

  const started = Date.now();
  const analysis = await analyseRomPage({
    image: rom.image,
    bankId,
    ...(base.json ? { sidecar: base.json } : {}),
    ...(profileText ? { profile: JSON.parse(profileText) } : {}),
    ...(options["--range-weight"] ? { rangeWeight: Number(options["--range-weight"]) } : {})
  });
  rmSync(join(folder, "cards"), { recursive: true, force: true });
  mkdirSync(join(folder, "cards"), { recursive: true });
  const cards = renderCardFiles(analysis);
  for (const card of cards) writeFileSync(join(folder, "cards", card.name), card.text);
  writeFileSync(join(folder, "overview.md"), renderOverview(analysis));
  writeFileSync(join(folder, "questions.md"), renderQuestions(analysis));
  writeFileSync(join(folder, "facts.json"), `${JSON.stringify(factsJson(analysis))}\n`);
  writeFileSync(inputsFile, `${JSON.stringify(inputs, null, 2)}\n`);
  const kinds = (kind) => analysis.routines.filter((r) => r.routine.kind === kind).length;
  console.log(
    `${rom.workName} page ${bankId} (${rom.image.cpu}; sidecar: ${base.label}; profile: ${profileText ? shown(profilePath) : "none"})`
  );
  console.log(
    `  ${analysis.routines.length} routines (${kinds("subroutine")} subroutines, ${kinds("jump-target")} jump targets, ` +
      `${kinds("entry-point")} entry points, ${kinds("unreached")} unreached); ${cards.length} range(s); ` +
      `${analysis.questions.length} question(s); ${Date.now() - started} ms`
  );
  console.log(`  ${shown(folder)}/: overview.md, questions.md, facts.json, cards/`);
}

/** `export-ann <rom>`: the base sidecar's pages as .ann files. */
function exportAnn([romArg], options) {
  if (!romArg) usage(2);
  const probe = loadRom(romArg, { ...options, "--page": options["--page"] ?? "0" });
  const base = readBase(probe, options["--sidecar"]);
  if (!base.json) throw new Error(`${probe.workName} has no sidecar to export`);
  const pages = options["--page"] === undefined ? Object.keys(base.json.banks ?? {}) : [String(Number(options["--page"]))];
  const folder = options["--out"] ? resolve(options["--out"]) : join(WORK, probe.workName, "export");
  mkdirSync(folder, { recursive: true });
  for (const page of pages) {
    const rom = loadRom(romArg, { ...options, "--page": page });
    const text = sidecarPageToAnn(base.json, Number(page), {
      cpu: rom.image.cpu,
      preamble: [`Exported from ${base.label}, page ${page}`]
    });
    const file = join(folder, `page-${page}.ann`);
    writeFileSync(file, text);
    console.log(`${shown(file)}: ${text.split("\n").length - 1} lines`);
  }
}

/** `compile <rom> <ann...>`: the .ann files laid over the base sidecar. */
async function compile([romArg, ...annArgs], options) {
  if (!romArg || !annArgs.length) usage(2);
  const annFiles = annArgs.flatMap((arg) =>
    statSync(arg).isDirectory()
      ? readdirSync(arg).filter((f) => f.endsWith(".ann")).sort().map((f) => join(arg, f))
      : [arg]
  );
  if (!annFiles.length) throw new Error("No .ann files given");
  const byPage = new Map();
  for (const file of annFiles) {
    const text = readFileSync(file, "utf8");
    const header = /^rom\s+\S+\s+page\s+(\d+)/m.exec(text);
    const page = header ? Number(header[1]) : 0;
    byPage.set(page, [...(byPage.get(page) ?? []), { fileName: shown(resolve(file)), text }]);
  }

  const probe = loadRom(romArg, { ...options, "--page": String([...byPage.keys()][0]) });
  const base = readBase(probe, options["--sidecar"]);
  let sidecar = base.json ?? newRomSidecar(basename(probe.path), []);
  const report = [`# ${probe.workName}: compile`, "", `Base: ${base.label}`, ""];
  let errors = 0;
  for (const [page, ann] of [...byPage].sort((a, b) => a[0] - b[0])) {
    const rom = loadRom(romArg, { ...options, "--page": String(page) });
    const bank = rom.image.banks[0];
    if (!sidecar.banks?.[String(page)]) {
      addRomSidecarPage(sidecar, { page, bytes: bank.bytes, origin: bank.origin, kind: rom.image.romKind });
      report.push(`Page ${page} is new: an all-code bank was added.`, "");
    }
    const result = compileAnnotations({
      base: sidecar,
      page,
      rom: rom.workName,
      cpu: rom.image.cpu,
      // --- A sidecar may describe more than the ROM's bytes (the ZX81's 8K ROM is listed to $3FFF)
      pageSize: Math.max(bank.bytes.length, ...(sidecar.banks[String(page)].regions ?? []).map((r) => r.end + 1)),
      ann
    });
    sidecar = result.sidecar;
    const level = await measureLevel(sidecar, page, bank.bytes, rom.image.romKind);
    const pageErrors = result.problems.filter((p) => p.severity === "error").length;
    errors += pageErrors;
    report.push(...pageReport(page, ann, result, level));
    console.log(
      `page ${page}: ${ann.length} file(s), ${pageErrors} error(s), ` +
        `${result.problems.length - pageErrors} warning(s), ${result.changes.length} change(s) to base entries, ` +
        `level ${level.level} (${level.unlabelledTargets.length} unlabelled target(s), ` +
        `${level.labelsWithoutSynopsis.length} label(s) without a synopsis, ${level.misplacedLabels.length} misplaced)`
    );
  }

  const folder = join(WORK, probe.workName);
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, "problems.md"), `${report.join("\n")}\n`);
  console.log(`Report: ${shown(join(folder, "problems.md"))}`);
  if (errors) {
    console.error(`${errors} error(s): nothing written.`);
    process.exit(1);
  }
  if (options["--dry-run"]) return console.log("Dry run: nothing written.");
  const target = options["--out"] ? resolve(options["--out"]) : base.workingCopy;
  // --- The IDE may be editing the working copy: write only if it is unchanged since it was read
  if (existsSync(target) && target === base.path && readFileSync(target, "utf8") !== base.text) {
    throw new Error(`${target} changed since it was read; nothing written. Run compile again.`);
  }
  mkdirSync(dirname(target), { recursive: true });
  const { formatRomSidecar } = require(join(root, "src/common/roms/romAnnotationTools.ts"));
  writeFileSync(target, formatRomSidecar(sidecar));
  console.log(`Written: ${target}`);
}

/** The problem-list section of one page. */
function pageReport(page, ann, result, level) {
  const where = (p) => (p.file ? `${p.file}${p.line ? `:${p.line}` : ""}: ` : "");
  const lines = [`## Page ${page}`, "", `Files: ${ann.map((a) => a.fileName).join(", ")}`, ""];
  lines.push(
    `Level ${level.level}: ${level.instructions} instructions, ${level.unlabelledTargets.length} unlabelled target(s), ` +
      `${level.labelsWithoutSynopsis.length} label(s) without a synopsis, ${level.misplacedLabels.length} misplaced label(s).`,
    ""
  );
  const section = (title, items) => {
    if (!items.length) return;
    lines.push(`### ${title}`, "", ...items.map((item) => `- ${item}`), "");
  };
  section("Errors", result.problems.filter((p) => p.severity === "error").map((p) => `${where(p)}${p.message}`));
  section("Warnings", result.problems.filter((p) => p.severity === "warning").map((p) => `${where(p)}${p.message}`));
  section("Unlabelled targets", level.unlabelledTargets.map((t) => hex(t)));
  section("Labels without a synopsis", level.labelsWithoutSynopsis);
  section("Misplaced labels", level.misplacedLabels);
  section(
    "Base entries changed",
    result.changes.map(
      (c) => `${hex(c.offset)} ${c.what}: ${JSON.stringify(c.before ?? "")} -> ${JSON.stringify(c.after ?? "(deleted)")} (${c.file}:${c.line})`
    )
  );
  section("Questions", result.questions.map((q) => `${hex(q.offset)} ${q.text} (${q.file}:${q.line})`));
  section("Feedback on the tools", result.feedback.map((f) => `${f.kind} ${hex(f.from)}: ${f.text} (${f.file}:${f.line})`));
  return lines;
}

/** The level of one page, with an inheriting sidecar's inherited entries (as `rom:annotations level`). */
async function measureLevel(sidecar, page, pageBytes, kind) {
  const tools = require(join(root, "src/common/roms/romAnnotationTools.ts"));
  const { romDecoderFor } = require(join(root, "src/renderer/appIde/annotations/romDecoder.ts"));
  let bank = sidecar.banks[String(page)];
  if (sidecar.inherits?.length) {
    const { withInheritedEntries } = require(join(root, "src/renderer/appIde/annotations/romInheritance.ts"));
    const { parseAnnotations } = require(join(root, "src/renderer/appIde/annotations/programAnnotations.ts"));
    const { annotations } = await withInheritedEntries(
      parseAnnotations(JSON.stringify(sidecar)).annotations,
      (p) => (p === page ? pageBytes : undefined),
      async (inherited, p) => {
        const name = sidecarPaths.canonicalShippedSidecar(inherited);
        const file = new Uint8Array(readFileSync(join(ROMS, name.replace(/\.dis$/i, ""))));
        return {
          annotations: parseAnnotations(readFileSync(join(ROMS, name), "utf8")).annotations,
          bytes: romPageBytes(file, p)
        };
      }
    );
    bank = annotations.banks[String(page)];
  }
  return tools.measureRomLevel(bank, pageBytes, romDecoderFor(kind));
}

/**
 * The sidecar to start from: --sidecar, else the working copy, else the shipped file. `json` is
 * undefined for a ROM with no sidecar anywhere.
 */
function readBase(rom, sidecarArg) {
  const shipped = `${rom.path}.dis`;
  const workingCopy = join(homedir(), "Klive", sidecarPaths.workingCopyRelativePath(`${rom.workName}.dis`));
  const candidates = sidecarArg ? [resolve(sidecarArg)] : [workingCopy, shipped];
  const path = candidates.find((p) => existsSync(p));
  if (sidecarArg && !path) throw new Error(`No sidecar ${sidecarArg}`);
  if (!path) return { json: undefined, label: "a new sidecar (none exists yet)", workingCopy };
  const text = readFileSync(path, "utf8");
  return { json: JSON.parse(text), text, path, label: shown(path), workingCopy };
}

/** The ROM file and the image of one of its pages. */
function loadRom(romArg, options) {
  const path = existsSync(romArg) ? resolve(romArg) : join(ROMS, romArg);
  if (!existsSync(path)) throw new Error(`No ROM ${romArg} (looked in ${relative(root, ROMS)})`);
  const file = new Uint8Array(readFileSync(path));
  const page = options["--page"] === undefined ? 0 : Number(options["--page"]);
  const workName = path.startsWith(ROMS + sep) ? relative(ROMS, path).split(sep).join("/") : basename(path);
  const image = imageFromRomPage(romPageBytes(file, page), {
    name: workName,
    page,
    ...(options["--kind"] ? { kind: options["--kind"] } : {}),
    ...(options["--cpu"] ? { cpu: parseCpu(options["--cpu"]) } : {})
  });
  return { path, image, workName, pages: romPageCount(file) };
}

/** The bank's regions from the sidecar beside the ROM (or the one named), when there is one. */
function sidecarRegions(rom, sidecarArg, bankId) {
  const path = sidecarArg ? resolve(sidecarArg) : `${rom.path}.dis`;
  if (!existsSync(path)) {
    if (sidecarArg) throw new Error(`No sidecar ${sidecarArg}`);
    return undefined;
  }
  return JSON.parse(readFileSync(path, "utf8")).banks?.[bankId]?.regions;
}

/** `0B40-0C00` (hex, `$` optional) as two numbers. */
function parseRange(text) {
  const match = /^\$?([0-9a-f]{1,4})-\$?([0-9a-f]{1,4})$/i.exec(text);
  if (!match) throw new Error(`Range "${text}" is not <from>-<to> in hex (0B40-0C00)`);
  return [parseInt(match[1], 16), parseInt(match[2], 16)];
}

/** Removes `--name value` and `--flag` options from `args`. */
function takeOptions(args, valued, flags) {
  const result = {};
  for (const name of valued) {
    const at = args.indexOf(name);
    if (at < 0) continue;
    if (at + 1 >= args.length) throw new Error(`${name} needs a value`);
    result[name] = args[at + 1];
    args.splice(at, 2);
  }
  for (const name of flags) {
    const at = args.indexOf(name);
    if (at >= 0) {
      result[name] = true;
      args.splice(at, 1);
    }
  }
  return result;
}

/** A path as printed: relative to the repository when inside it, else absolute. */
function shown(path) {
  const rel = relative(root, path);
  return rel.startsWith("..") ? path : rel;
}

function hex(value) {
  return `$${value.toString(16).padStart(4, "0").toUpperCase()}`;
}

function usage(code) {
  const text = readFileSync(__filename, "utf8");
  const header = text.slice(text.indexOf("/*") + 2, text.indexOf("*/"));
  console.log(header.split("\n").map((l) => l.replace(/^ \* ?/, "")).join("\n").trim());
  process.exit(code);
}
