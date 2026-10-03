/**
 * Generates `src/common/kbasic/help-data.generated.ts`: the static help the `.zxbas` editor shows
 * for keywords, built-in functions, directives, pragmas and library routines
 * (`.plans/BASIC_EDITOR_INTELLIGENCE_PLAN.md` §4.4, E8).
 *
 * Sources, all Klive's own:
 * - `.ai/zxbasic-syntax/zxbasic-syntax.json` (keywords, statements, functions, types, operators,
 *   preprocessor, the CODEBANK extension);
 * - `.ai/kbasic/stdlib-api.json` (the documented library API);
 * - `src/main/kbasic/stdlib/*.bas` (which library routines Klive BASIC actually has);
 * - `scripts/kbasic-help-overrides.json` (display and summary lines the spec does not give cleanly).
 *
 * Both JSON files paraphrase CC BY 4.0 upstream documentation; the attribution travels with the data
 * (a header comment and the exported HELP_ATTRIBUTION, which hovers show).
 *
 * A syntax line that does not reduce to a readable line, and a keyword with no summary, are reported:
 * give them an entry in the overrides file instead of guessing.
 *
 * Usage:
 *   node scripts/kbasic-help-data.cjs          regenerate the file
 *   node scripts/kbasic-help-data.cjs --check  exit 1 if the file is stale (the test does the same)
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SPEC = path.join(ROOT, ".ai/zxbasic-syntax/zxbasic-syntax.json");
const API = path.join(ROOT, ".ai/kbasic/stdlib-api.json");
const STDLIB_DIR = path.join(ROOT, "src/main/kbasic/stdlib");
const OVERRIDES = path.join(__dirname, "kbasic-help-overrides.json");
const OUT = path.join(ROOT, "src/common/kbasic/help-data.generated.ts");

/** Non-terminals that make a syntax line a multi-line form: such lines need an override. */
const BLOCK_WORDS = new Set(["NL", "SEP", "block", "body"]);

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function firstSentence(text) {
  if (!text) return "";
  const m = /^(.*?[.;])(\s|$)/.exec(text.trim());
  return (m ? m[1] : text.trim()).replace(/;$/, ".");
}

/**
 * A readable line from an EBNF syntax line: the production name, the quotes and the comments go;
 * `[ ]`, `{ }`, `|` and grouping stay. Undefined when the line is not about `keyword` (a helper
 * production such as `convention = ...`).
 */
function displayOf(ebnf, keyword) {
  let s = ebnf.replace(/\(\*[\s\S]*?\*\)/g, "").trim();
  const production = /^([a-z][\w-]*)\s*=\s*/.exec(s);
  if (production) s = s.slice(production[0].length);
  s = s.replace(/;\s*$/, "").trim();
  // --- Spelling alternatives first: ( "CHR" | "CHR$" ) shows the one asked about
  s = s.replace(/^\(\s*("[^"]+"(?:\s*\|\s*"[^"]+")+)\s*\)/, (_, alts) => {
    const options = alts.split("|").map((a) => a.trim());
    return options.find((o) => keyword && o.slice(1, -1).toUpperCase() === keyword.toUpperCase()) ?? options[0];
  });
  const tokens = s.match(/"[^"]*"|'[^']*'|[A-Za-z_][\w.$-]*|[[\]{}()|]|\S/g) ?? [];
  const firstLiteral = tokens.find((t) => t.startsWith('"'));
  if (keyword && (!firstLiteral || !firstLiteral.slice(1, -1).toUpperCase().startsWith(keyword.replace(/\$$/, "").toUpperCase()))) {
    return undefined;
  }
  const parts = tokens.map((t) => {
    if (t.startsWith('"') || t.startsWith("'")) return { text: t.slice(1, -1), literal: true };
    return { text: t, literal: false };
  });
  let out = "";
  let inQuote = false;
  parts.forEach((p, i) => {
    const prev = parts[i - 1];
    let space = i > 0;
    if (p.literal && (p.text === "," || p.text === ")")) space = false;
    if (prev?.literal && prev.text === "(") space = false;
    if (p.literal && p.text === "(" && prev?.literal && /^[A-Za-z$#]/.test(prev.text)) space = false;
    if (p.literal && p.text === '"') {
      if (inQuote) space = false;
      inQuote = !inQuote;
    } else if (prev?.literal && prev.text === '"' && inQuote) space = false;
    if (prev?.literal && prev.text === "<") space = false;
    if (p.literal && p.text === ">") space = false;
    out += (space ? " " : "") + p.text;
  });
  return out;
}

/** A built-in's parameters from its call syntax: `expr {, expr }` is expr, …; `a [, b ]` is a, [b]. */
function paramsOf(inner) {
  const parts = [];
  let depth = 0;
  let current = "";
  for (const c of inner) {
    if ("[{(".includes(c)) depth++;
    else if ("]})".includes(c)) depth--;
    if (c === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else current += c;
  }
  parts.push(current);
  const params = [];
  for (const part of parts.map((p) => p.trim()).filter(Boolean)) {
    const repeat = /^(.*?)\s*\{\s*,\s*(.*?)\s*\}$/.exec(part);
    const optional = /^(.*?)\s*\[\s*,\s*(.*?)\s*\]$/.exec(part);
    if (repeat) params.push(repeat[1], "…");
    else if (optional) params.push(optional[1], `[${optional[2]}]`);
    else params.push(part);
  }
  return params;
}

function needsOverride(display) {
  return display.split(/\s+/).some((w) => BLOCK_WORDS.has(w));
}

/** The routines each Klive library file defines: lower-cased name -> file. */
function stdlibRoutines() {
  const map = new Map();
  for (const file of fs.readdirSync(STDLIB_DIR).filter((f) => f.endsWith(".bas")).sort()) {
    const text = fs.readFileSync(path.join(STDLIB_DIR, file), "utf8");
    const re = /^\s*(?:SUB|FUNCTION)\s+(?:(?:FASTCALL|STDCALL)\s+)?([A-Za-z_]\w*\$?)/gim;
    let m;
    while ((m = re.exec(text))) {
      const name = m[1].replace(/\$$/, "").toLowerCase();
      if (!name.startsWith("__") && !map.has(name)) map.set(name, file);
    }
  }
  return map;
}

function attributionOf(spec, api) {
  const re = /\(c\) Jose Rodriguez-Rosa.*?contributors/;
  const fromApi = re.exec(api.$comment)?.[0];
  const fromSpec = re.exec(spec.meta.reading_rule)?.[0];
  const holder = (fromApi ?? fromSpec ?? "").trim();
  if (!holder) throw new Error("No attribution line found in the help sources");
  return `Paraphrased from the ZX BASIC documentation, CC BY 4.0, ${holder}.`;
}

function build() {
  const spec = readJson(SPEC);
  const api = readJson(API);
  const overrides = readJson(OVERRIDES);
  const problems = [];
  const keywords = [];

  const statements = new Map(spec.statements.map((s) => [s.name, s]));
  const functions = new Map(spec.functions.map((f) => [f.name, f]));
  const primitives = new Map(spec.types.primitives.map((t) => [t.name.toUpperCase(), t]));

  const operatorSummary = (name) => {
    const op = spec.operators.list.find((o) => o.name.split(/\s*\/\s*|\s+/).some((n) => n.toUpperCase() === name));
    return op ? `Operands: ${op.operands}. Result: ${op.result}.` : undefined;
  };

  const entryFor = (name, kind) => {
    const base = name.replace(/\$$/, "");
    const override = overrides.keywords[name] ?? {};
    let display = [];
    let summary = "";
    let params;
    const statement = statements.get(name);
    const fn = functions.get(base);
    if (statement) {
      display = statement.syntax.map((s) => displayOf(s, name)).filter(Boolean);
      summary = firstSentence(statement.semantics);
    } else if (fn) {
      display = fn.syntax.map((s) => displayOf(s, name)).filter(Boolean);
      summary = fn.argument === "none" ? `Result: ${fn.result}.` : `Argument: ${fn.argument}. Result: ${fn.result}.`;
      const call = display.find((d) => d.includes("("));
      if (call) params = paramsOf(call.slice(call.indexOf("(") + 1, call.lastIndexOf(")")));
    } else if (kind === "type") {
      const t = primitives.get(name);
      if (t) {
        display = [name];
        summary = `${t.bytes} byte${t.bytes === 1 ? "" : "s"}, ${t.signed ? "signed" : "unsigned"}: ${t.range}.${t.sigil ? ` Sigil ${t.sigil}.` : ""}`;
      } else if (name === "STRING") {
        display = [name];
        summary = `Text: ${spec.types.strings.representation}.`;
      }
    } else if (kind === "operator") {
      display = [name];
      summary = operatorSummary(name) ?? "";
    }
    if (override.display) display = override.display;
    if (override.summary) summary = override.summary;
    if (override.params) params = override.params;
    if (!display.length) display = [name];
    for (const d of display) if (needsOverride(d)) problems.push(`${name}: "${d}" is a multi-line form; add a display override`);
    if (!summary) problems.push(`${name}: no summary; add one to the overrides`);
    return { name, kind, display, summary, ...(params && params.length ? { params } : {}) };
  };

  for (const k of spec.keywords) keywords.push(entryFor(k.name, k.kind));
  // --- The CODEBANK extension (plan D6)
  for (const [name, kind] of [["CODEBANK", "declaration"], ["FARPTR", "operator"]]) {
    const syntax = spec.extensions.codebank.syntax.map((s) => displayOf(s, name)).filter(Boolean);
    const o = overrides.keywords[name] ?? {};
    keywords.push({ name, kind, display: o.display ?? syntax, summary: o.summary ?? "" });
    if (!o.summary) problems.push(`${name}: no summary; add one to the overrides`);
  }

  const directives = spec.preprocessor.directives.map((d) => {
    const o = overrides.directives?.[d.name] ?? {};
    const display = o.display ?? d.syntax.map((s) => displayOf(s));
    return { name: d.name, kind: "directive", display, summary: o.summary ?? firstSentence(d.semantics) };
  });

  const pragmas = spec.preprocessor.pragmas.map((p) => ({
    name: p.name,
    type: String(p.type),
    default: p.default === null || p.default === undefined ? "" : String(p.default),
    effect: p.effect ?? ""
  }));

  const routinesByName = stdlibRoutines();
  const availableFiles = new Set(fs.readdirSync(STDLIB_DIR).map((f) => f.toLowerCase()));
  const libraries = api.libraries.map((l) => ({
    name: l.name,
    include: l.include ?? `#include <${l.name}>`,
    provides: l.provides ?? [],
    summary: l.summary ?? "",
    available: availableFiles.has(l.name.toLowerCase())
  }));
  const routines = api.routines
    .filter((r) => r.kind === "function" || r.kind === "statement")
    .map((r) => {
      const own = routinesByName.get(r.name.replace(/\$$/, "").toLowerCase());
      const documented = /<([^>]+)>/.exec(r.include ?? "")?.[1];
      const library = own ?? documented ?? "";
      return {
        name: r.name,
        kind: r.kind === "function" ? "function" : "sub",
        library,
        include: library ? `#include <${library}>` : "",
        syntax: r.syntax ?? [],
        ...(r.returns ? { returns: r.returns } : {}),
        params: (r.parameters ?? []).map((p) => ({ name: p.name, type: p.type ?? "", ...(p.notes ? { notes: p.notes } : {}) })),
        summary: r.summary ?? "",
        available: !!own
      };
    });

  return { attribution: attributionOf(spec, api), keywords, directives, pragmas, libraries, routines, problems };
}

function render(data) {
  const json = (v) => JSON.stringify(v, null, 2);
  return `// Generated by scripts/kbasic-help-data.cjs from .ai/zxbasic-syntax/zxbasic-syntax.json,
// .ai/kbasic/stdlib-api.json, src/main/kbasic/stdlib and scripts/kbasic-help-overrides.json.
// Do not edit: change the sources and run \`npm run kbasic:help\`.
// ${data.attribution}
import type {
  BasicHelpEntry,
  BasicLibraryHelp,
  BasicLibraryRoutineHelp,
  BasicPragmaHelp
} from "./help-types";

/** The attribution keyword and library help carries (hover footers show it). */
export const HELP_ATTRIBUTION = ${JSON.stringify(data.attribution)};

/** Every keyword, with its syntax and a one-line summary. */
export const KEYWORD_HELP: readonly BasicHelpEntry[] = ${json(data.keywords)};

/** The preprocessor directives. */
export const DIRECTIVE_HELP: readonly BasicHelpEntry[] = ${json(data.directives)};

/** The \`#pragma\` options. */
export const PRAGMA_HELP: readonly BasicPragmaHelp[] = ${json(data.pragmas)};

/** The documented libraries; \`available\` ones are in Klive BASIC's standard library. */
export const LIBRARY_HELP: readonly BasicLibraryHelp[] = ${json(data.libraries)};

/** The documented library routines; \`available\` ones are in Klive BASIC's standard library. */
export const LIBRARY_ROUTINE_HELP: readonly BasicLibraryRoutineHelp[] = ${json(data.routines)};
`;
}

/** The generated file's text, and what the generator could not derive. */
function generate() {
  const data = build();
  return { text: render(data), problems: data.problems };
}

module.exports = { generate, displayOf, OUT };

if (require.main === module) {
  const { text, problems } = generate();
  for (const p of problems) console.warn(`kbasic-help-data: ${p}`);
  if (process.argv.includes("--check")) {
    const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : "";
    if (current !== text || problems.length) {
      console.error("kbasic-help-data: src/common/kbasic/help-data.generated.ts is stale; run `npm run kbasic:help`");
      process.exit(1);
    }
    console.log("kbasic-help-data: up to date");
  } else {
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, text);
    console.log(`kbasic-help-data: wrote ${path.relative(ROOT, OUT)}`);
  }
}
