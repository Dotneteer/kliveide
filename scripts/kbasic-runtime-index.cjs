/**
 * Generates `src/main/kbasic/runtime/generated/runtime-bundle.ts` from the Klive BASIC runtime
 * modules (`src/main/kbasic/runtime/*.kz80.asm`) and standard library (`src/main/kbasic/stdlib/*.bas`).
 *
 * The compiler imports the bundle instead of reading files, so it links the runtime the same way in
 * the main process, the diagnostics worker and tests (plan R7). The index comes from each module's
 * header comment - there is no hand-kept list; `src/main/kbasic/runtime/README.md` describes the
 * header and the rules checked here.
 *
 * Usage:
 *   node scripts/kbasic-runtime-index.cjs          regenerate the bundle
 *   node scripts/kbasic-runtime-index.cjs --check  exit 1 if the bundle is stale or a header is wrong
 *                                                  (part of `npm run build:check`)
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const RUNTIME_DIR = path.join(ROOT, "src/main/kbasic/runtime");
const STDLIB_DIR = path.join(ROOT, "src/main/kbasic/stdlib");
const BUNDLE_FILE = path.join(RUNTIME_DIR, "generated/runtime-bundle.ts");
// --- The documented library API (upstream's library names), for "not available yet" diagnostics
const STDLIB_API = path.join(ROOT, ".ai/kbasic/stdlib-api.json");
const MODULE_SUFFIX = ".kz80.asm";
const LIST_TAGS = ["exports", "requires", "symbols"];
const SINGLE_TAGS = ["module", "summary", "init"];

function readText(file) {
  return fs.readFileSync(file, "utf8").replace(/\r\n?/g, "\n");
}

function listFiles(dir, suffix) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(suffix))
    .sort();
}

/** Reads the `; @tag value` lines of the leading comment block. */
function parseHeader(text) {
  const header = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "") continue;
    if (!trimmed.startsWith(";")) break;
    const m = /^;\s*@([a-z-]+)\s*(.*)$/.exec(trimmed);
    if (!m) continue;
    const [, tag, value] = m;
    if (LIST_TAGS.includes(tag)) {
      header[tag] = (header[tag] ?? []).concat(
        value
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean)
      );
    } else {
      header[tag] = header[tag] === undefined ? value.trim() : `${header[tag]} ${value.trim()}`;
    }
  }
  return header;
}

/** Labels defined in the module: `Name:` or `Name` at the start of a line. */
function definedLabels(text) {
  const labels = new Set();
  for (const line of text.split("\n")) {
    const m = /^([A-Za-z_][A-Za-z0-9_]*)\s*(:|\s|$)/.exec(line);
    if (m) labels.add(m[1]);
  }
  return labels;
}

function testedSymbols(text) {
  const symbols = new Set();
  for (const line of text.split("\n")) {
    const m = /^\s*#ifn?def\s+([A-Za-z_][A-Za-z0-9_]*)/i.exec(line);
    if (m) symbols.add(m[1]);
  }
  return symbols;
}

/**
 * Builds the bundle from a runtime and a stdlib folder.
 * @returns `{ bundle, errors }`; the bundle is only meaningful when `errors` is empty.
 */
function buildBundle(runtimeDir = RUNTIME_DIR, stdlibDir = STDLIB_DIR) {
  const errors = [];
  const modules = [];
  for (const file of listFiles(runtimeDir, MODULE_SUFFIX)) {
    const text = readText(path.join(runtimeDir, file));
    const name = file.slice(0, -MODULE_SUFFIX.length);
    const header = parseHeader(text);
    const where = `${file}:`;
    for (const tag of Object.keys(header)) {
      if (!LIST_TAGS.includes(tag) && !SINGLE_TAGS.includes(tag)) errors.push(`${where} unknown header tag @${tag}`);
    }
    if (header.module !== name) errors.push(`${where} "; @module ${name}" expected, found "${header.module ?? ""}"`);
    if (!header.summary) errors.push(`${where} "; @summary" is missing`);
    if (/^\s*\.?(module|moduleend|org)\b/im.test(text)) {
      errors.push(`${where} must not use .module, .moduleend or .org: the linker places every module in core`);
    }
    const labels = definedLabels(text);
    const exports = header.exports ?? [];
    for (const label of exports) {
      if (!labels.has(label)) errors.push(`${where} exported label ${label} is not defined`);
    }
    if (header.init && !exports.includes(header.init)) errors.push(`${where} @init ${header.init} is not exported`);
    const symbols = header.symbols ?? [];
    const tested = testedSymbols(text);
    for (const s of tested) {
      if (!symbols.includes(s)) errors.push(`${where} tests ${s} but does not list it in @symbols`);
    }
    for (const s of symbols) {
      if (!tested.has(s)) errors.push(`${where} lists ${s} in @symbols but never tests it`);
    }
    modules.push({
      name,
      summary: header.summary ?? "",
      exports,
      requires: header.requires ?? [],
      ...(header.init ? { init: header.init } : {}),
      symbols,
      text
    });
  }

  const byName = new Map(modules.map((m) => [m.name, m]));
  const exporter = new Map();
  for (const m of modules) {
    for (const r of m.requires) {
      if (r === m.name) errors.push(`${m.name}${MODULE_SUFFIX}: requires itself`);
      else if (!byName.has(r)) errors.push(`${m.name}${MODULE_SUFFIX}: requires unknown module ${r}`);
    }
    for (const label of m.exports) {
      const key = label.toLowerCase();
      if (exporter.has(key)) errors.push(`${m.name}${MODULE_SUFFIX}: ${label} is also exported by ${exporter.get(key)}`);
      else exporter.set(key, m.name);
    }
  }

  const state = new Map();
  const visit = (name, chain) => {
    if (state.get(name) === "done" || !byName.has(name)) return;
    if (state.get(name) === "visiting") {
      errors.push(`@requires cycle: ${[...chain, name].join(" -> ")}`);
      return;
    }
    state.set(name, "visiting");
    for (const r of byName.get(name).requires) visit(r, [...chain, name]);
    state.set(name, "done");
  };
  for (const m of modules) visit(m.name, []);

  const stdlib = listFiles(stdlibDir, ".bas").map((file) => ({
    name: file,
    text: readText(path.join(stdlibDir, file))
  }));

  const documented = fs.existsSync(STDLIB_API)
    ? [...new Set(JSON.parse(readText(STDLIB_API)).libraries.map((l) => l.name).filter((n) => /^[\w.-]+\.bas$/.test(n)))].sort()
    : [];

  return { bundle: { modules, stdlib, documented }, errors };
}

function renderBundle(bundle) {
  return [
    "// Generated by scripts/kbasic-runtime-index.cjs from src/main/kbasic/runtime and",
    "// src/main/kbasic/stdlib. Do not edit: change the sources and run `npm run kbasic:runtime`.",
    'import type { RuntimeBundle } from "../runtime-types";',
    "",
    `export const runtimeBundle: RuntimeBundle = ${JSON.stringify(bundle, null, 2)};`,
    ""
  ].join("\n");
}

function main() {
  const check = process.argv.includes("--check");
  const { bundle, errors } = buildBundle();
  if (errors.length) {
    console.error("Klive BASIC runtime headers are wrong:\n  " + errors.join("\n  "));
    process.exit(1);
  }
  const rendered = renderBundle(bundle);
  if (check) {
    const current = fs.existsSync(BUNDLE_FILE) ? readText(BUNDLE_FILE) : "";
    if (current !== rendered) {
      console.error(
        `${path.relative(ROOT, BUNDLE_FILE)} is stale: a runtime module or library changed. Run \`npm run kbasic:runtime\`.`
      );
      process.exit(1);
    }
    console.log(`Klive BASIC runtime bundle is current (${bundle.modules.length} modules).`);
    return;
  }
  fs.mkdirSync(path.dirname(BUNDLE_FILE), { recursive: true });
  fs.writeFileSync(BUNDLE_FILE, rendered);
  console.log(`Wrote ${path.relative(ROOT, BUNDLE_FILE)} (${bundle.modules.length} modules, ${bundle.stdlib.length} library files).`);
}

if (require.main === module) main();

module.exports = { buildBundle, renderBundle, parseHeader, BUNDLE_FILE };
