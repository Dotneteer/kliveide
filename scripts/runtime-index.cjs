/**
 * Generates the runtime packages of the shared Z80 back end and its languages
 * (`.plans/SHARED_Z80_BACKEND_PLAN.md` §3.2), and Klive BASIC's standard-library bundle:
 *
 * | Package | Modules | Generated |
 * | --- | --- | --- |
 * | `core` | `src/main/z80-backend/runtime/core/*.kz80.asm` | `src/main/z80-backend/runtime/generated/core-package.ts` |
 * | `zx` | `src/main/z80-backend/runtime/zx/*.kz80.asm` | `src/main/z80-backend/runtime/generated/zx-package.ts` |
 * | `kbasic` | `src/main/kbasic/runtime/*.kz80.asm` | `src/main/kbasic/runtime/generated/kbasic-package.ts` |
 * | (library) | `src/main/kbasic/stdlib/*.bas` | `src/main/kbasic/stdlib/generated/stdlib-bundle.ts` |
 *
 * The compiler imports the generated files instead of reading files, so it links the runtime the
 * same way in the main process, the diagnostics worker and tests. The index comes from each
 * module's header comment - there is no hand-kept list; `src/main/z80-backend/runtime/README.md`
 * describes the header and the rules checked here, among them the package rule: a `core` module
 * requires only `core` modules, a `zx` module `core` and `zx` ones, a language's any of those and
 * its own.
 *
 * Usage:
 *   node scripts/runtime-index.cjs          regenerate
 *   node scripts/runtime-index.cjs --check  exit 1 if a generated file is stale or a header is wrong
 *                                           (part of `npm run build:check`)
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const BACKEND_TYPES = "src/main/z80-backend/runtime/runtime-types";
const PACKAGES = [
  { name: "core", dir: "src/main/z80-backend/runtime/core", out: "src/main/z80-backend/runtime/generated/core-package.ts", may: ["core"] },
  { name: "zx", dir: "src/main/z80-backend/runtime/zx", out: "src/main/z80-backend/runtime/generated/zx-package.ts", may: ["core", "zx"] },
  { name: "kbasic", dir: "src/main/kbasic/runtime", out: "src/main/kbasic/runtime/generated/kbasic-package.ts", may: ["core", "zx", "kbasic"] }
];
const STDLIB_DIR = path.join(ROOT, "src/main/kbasic/stdlib");
const STDLIB_FILE = path.join(ROOT, "src/main/kbasic/stdlib/generated/stdlib-bundle.ts");
// --- The documented library API (upstream's library names), for "not available yet" diagnostics
const STDLIB_API = path.join(ROOT, ".ai/kbasic/stdlib-api.json");
const MODULE_SUFFIX = ".kz80.asm";
const LIST_TAGS = ["exports", "requires", "symbols"];
const SINGLE_TAGS = ["module", "summary", "init"];
/** `; @abi Name(reg, reg)`: one entry per line (the value has commas of its own). */
const ENTRY_TAGS = ["abi"];
/** The register vocabulary of `@abi` (as instruction selection reads it). */
const REGISTERS = new Set(["a", "b", "c", "d", "e", "h", "l", "bc", "de", "hl", "dehl", "aedcb", "stack"]);

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
    } else if (ENTRY_TAGS.includes(tag)) {
      header[tag] = (header[tag] ?? []).concat([value.trim()]);
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

/** One package's modules, read from its folder. */
function readPackage(pkg, errors) {
  const modules = [];
  const dir = path.isAbsolute(pkg.dir) ? pkg.dir : path.join(ROOT, pkg.dir);
  for (const file of listFiles(dir, MODULE_SUFFIX)) {
    const text = readText(path.join(dir, file));
    const name = file.slice(0, -MODULE_SUFFIX.length);
    const header = parseHeader(text);
    const where = `${file}:`;
    for (const tag of Object.keys(header)) {
      if (!LIST_TAGS.includes(tag) && !SINGLE_TAGS.includes(tag) && !ENTRY_TAGS.includes(tag)) errors.push(`${where} unknown header tag @${tag}`);
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
    // --- The register contract: `Name(regs)` or `Name!variant(regs)` for an exported Name
    const abi = {};
    for (const entry of header.abi ?? []) {
      const m = /^([A-Za-z_]\w*)(![A-Za-z]+)?\(([^)]*)\)$/.exec(entry);
      if (!m) {
        errors.push(`${where} @abi ${entry}: "Name(reg, reg)" expected`);
        continue;
      }
      const [, routine, variant = "", list] = m;
      if (!exports.includes(routine)) errors.push(`${where} @abi ${routine} is not exported`);
      const regs = list
        .split(",")
        .map((r) => r.trim())
        .filter(Boolean);
      for (const r of regs) if (!REGISTERS.has(r)) errors.push(`${where} @abi ${routine}: unknown register ${r}`);
      if (abi[routine + variant]) errors.push(`${where} @abi ${routine + variant} is given twice`);
      abi[routine + variant] = regs;
    }
    modules.push({
      name,
      package: pkg.name,
      summary: header.summary ?? "",
      exports,
      requires: header.requires ?? [],
      ...(header.init ? { init: header.init } : {}),
      symbols,
      abi,
      text
    });
  }
  return modules;
}

/** Every package's modules, checked together: they link into one assembler module. */
function buildPackages(packages = PACKAGES) {
  const errors = [];
  const read = packages.map((pkg) => ({ pkg, modules: readPackage(pkg, errors) }));
  const all = read.flatMap((r) => r.modules);
  const byName = new Map();
  for (const m of all) {
    if (byName.has(m.name)) errors.push(`${m.name}${MODULE_SUFFIX}: a module of that name is also in package ${byName.get(m.name).package}`);
    else byName.set(m.name, m);
  }
  const exporter = new Map();
  for (const { pkg, modules } of read) {
    for (const m of modules) {
      for (const r of m.requires) {
        if (r === m.name) errors.push(`${m.name}${MODULE_SUFFIX}: requires itself`);
        else if (!byName.has(r)) errors.push(`${m.name}${MODULE_SUFFIX}: requires unknown module ${r}`);
        else if (pkg.may && !pkg.may.includes(byName.get(r).package)) {
          errors.push(`${m.name}${MODULE_SUFFIX}: a ${pkg.name} module may not require ${r}, a module of package ${byName.get(r).package}`);
        }
      }
      for (const label of m.exports) {
        const key = label.toLowerCase();
        if (exporter.has(key)) errors.push(`${m.name}${MODULE_SUFFIX}: ${label} is also exported by ${exporter.get(key)}`);
        else exporter.set(key, m.name);
      }
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
  for (const m of all) visit(m.name, []);
  return { packages: read.map(({ pkg, modules }) => ({ ...pkg, modules })), errors };
}

/** One folder as a package of its own (the tests' fixtures), with the old bundle's shape. */
function buildBundle(runtimeDir, stdlibDir = STDLIB_DIR) {
  const { packages, errors } = buildPackages([{ name: "test", dir: runtimeDir }]);
  return { bundle: { modules: packages[0].modules, ...readStdlib(stdlibDir) }, errors };
}

function readStdlib(stdlibDir = STDLIB_DIR) {
  const stdlib = listFiles(stdlibDir, ".bas").map((file) => ({ name: file, text: readText(path.join(stdlibDir, file)) }));
  const documented = fs.existsSync(STDLIB_API)
    ? [...new Set(JSON.parse(readText(STDLIB_API)).libraries.map((l) => l.name).filter((n) => /^[\w.-]+\.bas$/.test(n)))].sort()
    : [];
  return { stdlib, documented };
}

function relativeImport(fromFile, toModule) {
  let rel = path.relative(path.dirname(fromFile), path.join(ROOT, toModule)).replace(/\\/g, "/");
  if (!rel.startsWith(".")) rel = `./${rel}`;
  return rel;
}

function renderPackage(pkg) {
  const file = path.join(ROOT, pkg.out);
  const { out, may, dir, ...data } = pkg;
  return [
    `// Generated by scripts/runtime-index.cjs from ${pkg.dir}. Do not edit: change the modules and`,
    "// run `npm run runtime:bundle`.",
    `import type { RuntimePackage } from "${relativeImport(file, BACKEND_TYPES)}";`,
    "",
    `export const ${pkg.name}Package: RuntimePackage = ${JSON.stringify({ name: data.name, modules: data.modules }, null, 2)};`,
    ""
  ].join("\n");
}

function renderStdlib(bundle) {
  return [
    "// Generated by scripts/runtime-index.cjs from src/main/kbasic/stdlib and .ai/kbasic/stdlib-api.json.",
    "// Do not edit: change the library and run `npm run runtime:bundle`.",
    "",
    "/** Klive BASIC's standard library: each file's name and text, and the library files upstream documents. */",
    `export const stdlibBundle: { stdlib: { name: string; text: string }[]; documented: string[] } = ${JSON.stringify(bundle, null, 2)};`,
    ""
  ].join("\n");
}

/** Every generated file and the text it should have; errors when a header is wrong. */
function generated() {
  const { packages, errors } = buildPackages();
  const files = packages.map((pkg) => ({ file: path.join(ROOT, pkg.out), text: renderPackage(pkg), modules: pkg.modules.length }));
  files.push({ file: STDLIB_FILE, text: renderStdlib(readStdlib()), modules: 0 });
  return { files, errors };
}

function main() {
  const check = process.argv.includes("--check");
  const { files, errors } = generated();
  if (errors.length) {
    console.error("Runtime module headers are wrong:\n  " + errors.join("\n  "));
    process.exit(1);
  }
  if (check) {
    const stale = files.filter((f) => (fs.existsSync(f.file) ? readText(f.file) : "") !== f.text);
    if (stale.length) {
      console.error(`${stale.map((f) => path.relative(ROOT, f.file)).join(", ")} stale: a runtime module or library changed. Run \`npm run runtime:bundle\`.`);
      process.exit(1);
    }
    console.log(`Runtime packages are current (${files.reduce((n, f) => n + f.modules, 0)} modules).`);
    return;
  }
  for (const f of files) {
    fs.mkdirSync(path.dirname(f.file), { recursive: true });
    fs.writeFileSync(f.file, f.text);
    console.log(`Wrote ${path.relative(ROOT, f.file)}${f.modules ? ` (${f.modules} modules)` : ""}.`);
  }
}

if (require.main === module) main();

module.exports = { buildBundle, buildPackages, generated, parseHeader, PACKAGES };
