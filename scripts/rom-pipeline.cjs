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
 *                                   [--no-wrap] [--name-numbers] [--report <dir>]
 *                                   lays the .ann files over the sidecar and writes it (default: the
 *                                   working copy); work/<rom>/problems.md lists what to fix (lint, level,
 *                                   questions, each with its fix) and feedback-page-<n>.md what the run
 *                                   says about the tools (D11); errors write nothing
 *   npm run rom:pipeline -- prepare <rom> [--page n] [--cpu z80|z80n] [--sidecar <file> | --no-sidecar]
 *                                   [--profile <file>] [--range-weight n] [--force]
 *                                   the routine cards, overview, questions, region proposals and facts of a page, in
 *                                   work/<rom>/page-<n>/ (skipped when its inputs have not changed)
 *   npm run rom:pipeline -- carry <from sidecar> <to rom> [--page n] [--out <file>]
 *                                   carries a sidecar to another version of its ROM (byte signatures, then
 *                                   an instruction alignment), translating the RAM addresses that moved:
 *                                   work/<to rom>/carried.rom.dis, alignment.md and alignment-page-<n>.json
 *                                   (which prepare reads: the cards say which routines are the same,
 *                                   shifted or different)
 *   npm run rom:pipeline -- timings start|end|report <label> [--at <iso>]
 *   npm run rom:pipeline -- timings ai <label> --tokens n [--ms n] [--what "..."]
 *                                   measures a run (P8): every command above logs its time to
 *                                   work/timings.jsonl; the AI's tokens are recorded by the session;
 *                                   report gives the total time, the tools' time, the AI's time and tokens
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
const TIMINGS = join(WORK, "timings.jsonl");
const PIPELINE = join(root, "src/common/reverse/pipeline");

const { imageFromRomPage, romPageBytes, romPageCount } = require(join(PIPELINE, "image/romImage.ts"));
const { parseCpu } = require(join(PIPELINE, "image/cpu.ts"));
const { formatListingLine, listImageBank } = require(join(PIPELINE, "listing.ts"));
const { sidecarPageToAnn } = require(join(PIPELINE, "postprocess/sidecarToAnn.ts"));
const { compileAnnotations } = require(join(PIPELINE, "postprocess/compile.ts"));
const { addRomSidecarPage, newRomSidecar } = require(join(PIPELINE, "postprocess/newSidecar.ts"));
const { lint } = require(join(PIPELINE, "postprocess/lint.ts"));
const { feedbackSignals, problemKeys, renderFeedback, renderProblems } = require(join(PIPELINE, "postprocess/report.ts"));
const { analyseRomPage } = require(join(PIPELINE, "preprocess/analyse.ts"));
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
    ["--page", "--kind", "--cpu", "--why", "--sidecar", "--out", "--profile", "--range-weight", "--tokens", "--ms", "--what", "--report", "--at"],
    ["--no-sidecar", "--no-alignment", "--dry-run", "--force", "--list", "--no-wrap", "--name-numbers", "--help"]
  );
  const [command, ...rest] = args;
  if (!command || options["--help"]) return usage(0);
  if (command === "timings") return timings(rest, options);
  // --- Every tool command's time goes to the timing log (P8's measurement: tool time vs. AI time)
  const started = Date.now();
  process.on("exit", (code) => {
    if (code === 0 || code === undefined) logTiming({ kind: "tool", command, args: rest.slice(0, 2), ms: Date.now() - started });
  });
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
  if (command === "carry") return carry(rest, options);
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

/** `carry <from sidecar> <to rom>`: a sidecar carried to another version of its ROM. */
async function carry([fromArg, toArg], options) {
  if (!fromArg || !toArg) usage(2);
  const { carryPage } = require(join(PIPELINE, "align/carryPage.ts"));
  const { formatRomSidecar, provenanceKeysOf } = require(join(root, "src/common/roms/romAnnotationTools.ts"));
  const { romCrc32 } = require(join(root, "src/common/roms/romIdentity.ts"));
  const fromPath = existsSync(fromArg) ? resolve(fromArg) : join(ROMS, sidecarPaths.canonicalShippedSidecar(fromArg));
  const old = JSON.parse(readFileSync(fromPath, "utf8"));
  const oldRom = loadRom(fromPath.replace(/\.dis$/i, ""), { "--page": "0" });
  const target = loadRom(toArg, { "--page": "0" });
  const pages = options["--page"] === undefined ? Object.keys(old.banks ?? {}) : [String(Number(options["--page"]))];
  const folder = join(WORK, target.workName);
  mkdirSync(folder, { recursive: true });

  const sidecar = {};
  for (const [key, value] of Object.entries(old)) {
    if (!["banks", "pages", "provenance", "level", "source", "carriedFrom"].includes(key)) sidecar[key] = value;
  }
  sidecar.source = { fileName: basename(target.path) };
  sidecar.level = 0;
  sidecar.pages = {};
  sidecar.banks = {};
  sidecar.provenance = {};
  sidecar.carriedFrom = { sidecar: oldRom.workName + ".dis", method: "byte signature and instruction alignment (rom:pipeline carry)" };
  for (const page of pages) {
    const oldImage = loadRom(oldRom.path, { "--page": page }).image;
    const newImage = loadRom(target.path, { "--page": page }).image;
    const result = await carryPage(oldImage, old.banks[page], newImage);
    sidecar.pages[page] = { crc32: romCrc32(newImage.banks[0].bytes), name: old.pages?.[page]?.name ?? `${basename(target.path)} page ${page}` };
    sidecar.banks[page] = result.bank;
    for (const key of provenanceKeysOf({ banks: { [page]: result.bank } })) sidecar.provenance[key] = "derived";
    const names = new Map((old.banks[page].localLabels ?? []).map((l) => [l.value, l.name]));
    writeFileSync(
      join(folder, `alignment-page-${page}.json`),
      `${JSON.stringify({ from: oldRom.workName, page: Number(page), routines: result.alignment.routines.map((r) => ({ ...r, name: names.get(r.old) })) })}\n`
    );
    writeFileSync(join(folder, `alignment-page-${page}.md`), alignmentReport(oldRom.workName, target.workName, page, result, names));
    const counts = {};
    for (const r of result.alignment.routines) counts[r.status] = (counts[r.status] ?? 0) + 1;
    console.log(
      `page ${page}: ${result.bank.localLabels?.length ?? 0} of ${old.banks[page].localLabels?.length ?? 0} labels carried (${result.aligned} by the alignment); ` +
        `routines ${Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(", ")}; ${result.alignment.stretches.length} stretches; ` +
        `${result.translated.length} text(s) with RAM addresses translated; ${result.lost.length} entr(ies) not carried`
    );
  }
  const out = options["--out"] ? resolve(options["--out"]) : join(folder, "carried.rom.dis");
  writeFileSync(out, formatRomSidecar(sidecar));
  console.log(`Written: ${shown(out)}; reports: ${shown(folder)}/alignment-page-<n>.md`);
  console.log(`Next: npm run rom:pipeline -- prepare ${target.workName} --sidecar ${shown(out)}`);
}

/** The alignment report of one carried page. */
function alignmentReport(from, to, page, result, names) {
  const h = (v) => `$${v.toString(16).padStart(4, "0").toUpperCase()}`;
  const a = result.alignment;
  const lines = [`# ${from} -> ${to}, page ${page}`, ""];
  lines.push("## Stretches (the same instructions at a constant distance)", "");
  for (const s of [...a.stretches].sort((x, y) => y.oldEnd - y.oldStart - (x.oldEnd - x.oldStart)).slice(0, 40)) {
    lines.push(`- ${h(s.oldStart)}-${h(s.oldEnd)} = ${h(s.newStart)}-${h(s.newEnd)} (${s.delta >= 0 ? "+" : "-"}${h(Math.abs(s.delta))})`);
  }
  lines.push("", "## RAM addresses that moved (from matched instructions)", "");
  for (const m of a.ramMap) lines.push(`- ${h(m.from)} -> ${h(m.to)}: seen ${m.count} time(s)${m.count < 2 || m.from < 0x4000 ? " (not translated in text: check)" : ""}`);
  for (const c of a.ramConflicts) lines.push(`- ${h(c.from)} -> ${c.to.map(h).join(" or ")}: conflicting, not translated`);
  lines.push("", "## Routines that differ (for the AI)", "");
  for (const r of a.routines.filter((r) => r.status === "different" || r.status === "missing")) {
    lines.push(`- ${h(r.old)} ${names.get(r.old) ?? ""}: ${r.status}${r.new !== undefined ? ` at ${h(r.new)}` : ""}, ${r.unmatched} of ${r.instructions} instruction(s) with no partner`);
  }
  lines.push("", "## Not carried", "");
  for (const l of result.lost) lines.push(`- ${l.kind} ${h(l.offset)}${l.name ? ` ${l.name}` : ""}: ${l.why}`);
  lines.push("", "## Carried text to check", "");
  for (const m of result.moved) lines.push(`- ${h(m.offset)} (from ${h(m.from)}): ${m.why}`);
  for (const t of result.translated) lines.push(`- ${h(t.offset)}: RAM translated ${t.swaps.join(", ")}`);
  return `${lines.join("\n")}\n`;
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

// ------------------------------------------------------------------------------------------------
// Timings (P8's measurement)

function logTiming(entry) {
  mkdirSync(WORK, { recursive: true });
  appendFileSync(TIMINGS, `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`);
}

/**
 * `timings start <label>` marks the start of a measured run; `timings ai <label> --tokens n [--ms n]
 * --what "..."` records AI work the CLI cannot see (a helper's tokens and time, the session's own); `timings
 * report <label>` sums the run: total time, the tools' time by command, the AI's time (the rest) and tokens.
 */
function timings([action, label], options) {
  if (!action || !label) usage(2);
  if (action === "start") {
    logTiming({ kind: "start", label });
    return console.log(`Measuring "${label}" from now.`);
  }
  if (action === "end") {
    // --- --at <iso>: the end of a run measured earlier (the report then counts up to it, not up to now)
    logTiming({ kind: "end", label, ...(options["--at"] ? { endAt: options["--at"] } : {}) });
    return console.log(`Measured run "${label}" ended.`);
  }
  if (action === "ai") {
    if (options["--tokens"] === undefined) throw new Error("timings ai needs --tokens");
    logTiming({
      kind: "ai",
      label,
      tokens: Number(options["--tokens"]),
      ...(options["--ms"] ? { ms: Number(options["--ms"]) } : {}),
      ...(options["--what"] ? { what: options["--what"] } : {})
    });
    return console.log(`Recorded ${options["--tokens"]} AI token(s) for "${label}".`);
  }
  if (action !== "report") usage(2);
  const entries = existsSync(TIMINGS) ? readFileSync(TIMINGS, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
  const startAt = entries.map((e, i) => [e, i]).filter(([e]) => e.kind === "start" && e.label === label).pop();
  if (!startAt) throw new Error(`No measured run "${label}" (start one with: timings start ${label})`);
  const after = entries.slice(startAt[1] + 1);
  const endMark = after.filter((e) => e.kind === "end" && e.label === label).pop();
  const end = endMark ? Date.parse(endMark.endAt ?? endMark.at) : Date.now();
  const run = after.filter((e) => (e.kind === "tool" && Date.parse(e.at) <= end) || (e.kind === "ai" && e.label === label));
  const total = end - Date.parse(startAt[0].at);
  const tools = run.filter((e) => e.kind === "tool");
  const toolMs = tools.reduce((sum, e) => sum + e.ms, 0);
  const byCommand = new Map();
  for (const e of tools) {
    const seen = byCommand.get(e.command) ?? { runs: 0, ms: 0 };
    byCommand.set(e.command, { runs: seen.runs + 1, ms: seen.ms + e.ms });
  }
  const ai = run.filter((e) => e.kind === "ai");
  const tokens = ai.reduce((sum, e) => sum + e.tokens, 0);
  const helperMs = ai.reduce((sum, e) => sum + (e.ms ?? 0), 0);
  const minutes = (ms) => (ms < 60000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.floor(ms / 60000)} min ${Math.round((ms % 60000) / 1000)} s`);
  console.log(`Measured run "${label}" (from ${startAt[0].at}${endMark ? ` to ${new Date(end).toISOString()}` : ", still running"})`);
  console.log(`  total time:          ${minutes(total)}`);
  console.log(`  preprocessor/postprocessor and other tools: ${minutes(toolMs)} (${((100 * toolMs) / total).toFixed(1)} %)`);
  for (const [command, t] of [...byCommand].sort((a, b) => b[1].ms - a[1].ms)) {
    console.log(`    ${command.padEnd(12)} ${String(t.runs).padStart(4)} run(s)  ${minutes(t.ms)}`);
  }
  console.log(`  AI (the rest):       ${minutes(total - toolMs)} (${((100 * (total - toolMs)) / total).toFixed(1)} %)${helperMs ? `; helpers reported ${minutes(helperMs)} of their own, partly in parallel` : ""}`);
  console.log(`  AI tokens:           ${tokens.toLocaleString("en-US")} in ${ai.length} record(s)`);
  for (const e of ai) console.log(`    ${String(e.tokens).padStart(9)}  ${e.what ?? ""}`);
}

/** `prepare <rom>`: the analysis bundle of one page. */
async function prepare([romArg], options) {
  if (!romArg) usage(2);
  const { PIPELINE_VERSION } = require(join(PIPELINE, "preprocess/analyse.ts"));
  const { factsJson, renderCardFiles, renderOverview, renderProposals, renderProposalsAnn, renderQuestions, renderTexts } = require(
    join(PIPELINE, "preprocess/cards.ts")
  );
  const { romCrc32 } = require(join(root, "src/common/roms/romIdentity.ts"));
  const rom = loadRom(romArg, options);
  const bankId = rom.image.banks[0].id;
  const base = options["--no-sidecar"] ? { label: "none (--no-sidecar)" } : readBase(rom, options["--sidecar"]);
  const folder = join(WORK, rom.workName, `page-${bankId}`);
  const profilePath = options["--profile"] ? resolve(options["--profile"]) : join(WORK, rom.workName, `profile-page-${bankId}.json`);
  const profileText = existsSync(profilePath) ? readFileSync(profilePath, "utf8") : undefined;
  const alignmentPath = join(WORK, rom.workName, `alignment-page-${bankId}.json`);
  const alignmentText = options["--no-alignment"] || !existsSync(alignmentPath) ? undefined : readFileSync(alignmentPath, "utf8");
  const crc = (text) => (text === undefined ? null : romCrc32(new TextEncoder().encode(text)));
  // --- The pipeline's own sources: a change to the tools makes every bundle stale
  const sources = [];
  const collect = (dir) => {
    for (const name of readdirSync(dir).sort()) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) collect(path);
      else if (name.endsWith(".ts")) sources.push(readFileSync(path, "utf8"));
    }
  };
  collect(PIPELINE);
  const inputs = {
    pipelineVersion: PIPELINE_VERSION,
    tools: crc(sources.join("\n")),
    rom: crc(Buffer.from(rom.image.banks[0].bytes).toString("latin1")),
    cpu: rom.image.cpu,
    sidecar: base.label,
    sidecarCrc: crc(base.text),
    profile: profileText ? shown(profilePath) : null,
    profileCrc: crc(profileText),
    alignmentCrc: crc(alignmentText),
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
    ...(alignmentText ? { carried: JSON.parse(alignmentText) } : {}),
    ...(options["--range-weight"] ? { rangeWeight: Number(options["--range-weight"]) } : {})
  });
  rmSync(join(folder, "cards"), { recursive: true, force: true });
  mkdirSync(join(folder, "cards"), { recursive: true });
  const cards = renderCardFiles(analysis);
  for (const card of cards) writeFileSync(join(folder, "cards", card.name), card.text);
  writeFileSync(join(folder, "overview.md"), renderOverview(analysis));
  writeFileSync(join(folder, "questions.md"), renderQuestions(analysis));
  writeFileSync(join(folder, "proposals.md"), renderProposals(analysis));
  writeFileSync(join(folder, "proposals.ann"), renderProposalsAnn(analysis));
  writeFileSync(join(folder, "texts.md"), renderTexts(analysis));
  writeFileSync(join(folder, "facts.json"), `${JSON.stringify(factsJson(analysis))}\n`);
  writeFileSync(inputsFile, `${JSON.stringify(inputs, null, 2)}\n`);
  const kinds = (kind) => analysis.routines.filter((r) => r.routine.kind === kind).length;
  console.log(
    `${rom.workName} page ${bankId} (${rom.image.cpu}; sidecar: ${base.label}; profile: ${profileText ? shown(profilePath) : "none"})`
  );
  console.log(
    `  ${analysis.routines.length} routines (${kinds("subroutine")} subroutines, ${kinds("jump-target")} jump targets, ` +
      `${kinds("entry-point")} entry points, ${kinds("unreached")} unreached); ${cards.length} range(s); ` +
      `${analysis.questions.length} question(s); ${analysis.proposals.length} region proposal(s); ${Date.now() - started} ms`
  );
  console.log(`  ${shown(folder)}/: overview.md, questions.md, proposals.md, proposals.ann, texts.md, facts.json, cards/`);
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
      ann,
      text: { wrap: !options["--no-wrap"], nameNumbers: !!options["--name-numbers"] }
    });
    sidecar = result.sidecar;
    const level = await measureLevel(sidecar, page, bank.bytes, rom.image.romKind);
    const pageErrors = result.problems.filter((p) => p.severity === "error").length;
    errors += pageErrors;

    // --- The compiled page analysed again: the lint, the problem list with its fixes, the feedback
    const pageFolder = join(WORK, rom.workName);
    // --- --report <dir>: this compile's reports and history apart (helpers compiling in parallel)
    const reportFolder = options["--report"] ? resolve(options["--report"]) : pageFolder;
    const readJson = (file) => (existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : undefined);
    const profile = readJson(join(pageFolder, `profile-page-${page}.json`));
    const analysis = await analyseRomPage({ image: rom.image, bankId: String(page), sidecar, ...(profile ? { profile } : {}) });
    const lintItems = lint({ analysis, touched: result.touched, otherLabels: otherSidecarLabels(rom.workName) });
    report.push(...renderProblems({ page, files: ann.map((a) => a.fileName), result, level, lint: lintItems, analysis, ...(profile ? { flags: profile.flags } : {}) }));
    const historyFile = join(reportFolder, `compile-history-page-${page}.jsonl`);
    const history = existsSync(historyFile) ? readFileSync(historyFile, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
    history.push({ at: new Date().toISOString(), keys: problemKeys(lintItems, level) });
    mkdirSync(reportFolder, { recursive: true });
    appendFileSync(historyFile, `${JSON.stringify(history[history.length - 1])}\n`);
    const listingFile = join(pageFolder, "listing-requests.jsonl");
    const listingRequests = existsSync(listingFile)
      ? readFileSync(listingFile, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((r) => r.page === page)
      : [];
    const facts = readJson(join(pageFolder, `page-${page}`, "facts.json"));
    const signals = feedbackSignals({ result, lint: lintItems, analysis, listingRequests, ...(facts?.proposals ? { proposals: facts.proposals } : {}), history });
    writeFileSync(join(reportFolder, `feedback-page-${page}.md`), renderFeedback(rom.workName, page, signals, history.length));
    const problems = lintItems.filter((l) => l.severity === "problem").length;
    console.log(
      `page ${page}: ${ann.length} file(s), ${pageErrors} error(s), ${problems} problem(s), ` +
        `${lintItems.length - problems + result.questions.length} question(s), ${result.changes.length} change(s) to base entries, ` +
        `level ${level.level} (${level.unlabelledTargets.length} unlabelled target(s), ` +
        `${level.labelsWithoutSynopsis.length} label(s) without a synopsis, ${level.misplacedLabels.length} misplaced); ` +
        `${signals.length} feedback signal(s)`
    );
  }

  // --- The IDE's own readiness check (the "Ready to ship" chip, rom-ann-check) on the whole result
  const ready = await readinessOf(sidecar, probe);
  report.push("## Ready to ship?", "");
  if (ready.problems.length) report.push(...ready.problems.map((p) => `- ${p}`));
  else report.push(`Yes: the IDE's check finds nothing; levels ${Object.entries(ready.levels).map(([page, level]) => `page ${page}: ${level}`).join(", ")}.`);
  report.push("");

  const folder = options["--report"] ? resolve(options["--report"]) : join(WORK, probe.workName);
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, "problems.md"), `${report.join("\n")}\n`);
  console.log(`Reports: ${shown(join(folder, "problems.md"))}, ${shown(folder)}/feedback-page-<n>.md`);
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

/** The IDE's readiness check of a sidecar for a ROM, with the inherited sidecars as the IDE reads them. */
async function readinessOf(sidecar, rom) {
  const { checkRomSidecar } = require(join(root, "src/renderer/appIde/annotations/romSidecarCheck.ts"));
  const { parseAnnotations } = require(join(root, "src/renderer/appIde/annotations/programAnnotations.ts"));
  const { formatRomSidecar } = require(join(root, "src/common/roms/romAnnotationTools.ts"));
  const file = new Uint8Array(readFileSync(rom.path));
  const pageBytes = (page) => (page * 0x4000 < file.length ? romPageBytes(file, page) : undefined);
  const inherited = async (name, page) => {
    const canonical = sidecarPaths.canonicalShippedSidecar(name);
    const working = join(homedir(), "Klive", sidecarPaths.workingCopyRelativePath(canonical));
    const text = readFileSync(existsSync(working) ? working : join(ROMS, canonical), "utf8");
    return {
      annotations: parseAnnotations(text).annotations,
      bytes: romPageBytes(new Uint8Array(readFileSync(join(ROMS, canonical.replace(/\.dis$/i, "")))), page)
    };
  };
  return checkRomSidecar(formatRomSidecar(sidecar), pageBytes, inherited);
}

/** Every other shipped sidecar's labels by name, for the lint's clash check. */
function otherSidecarLabels(own) {
  const labels = new Map();
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (name.endsWith(".rom.dis")) {
        const rel = relative(ROMS, path).split(sep).join("/");
        if (rel === `${own}.dis`) continue;
        const json = JSON.parse(readFileSync(path, "utf8"));
        for (const bank of Object.values(json.banks ?? {})) {
          for (const label of bank.localLabels ?? []) labels.set(label.name, [...(labels.get(label.name) ?? []), { sidecar: rel, offset: label.value }]);
        }
      }
    }
  };
  walk(ROMS);
  return labels;
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
