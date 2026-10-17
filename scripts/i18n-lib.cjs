/**
 * Shared catalog reading for the localization scripts (`.plans/LOCALIZATION_PLAN.md` §2, §6):
 * `i18n-check.cjs` (the gate), `i18n-todo.cjs` (the batch to translate) and `i18n-merge.cjs` (the
 * answer folded back). All three read the catalogs the same way, through this module.
 *
 * Layout (`src/common/i18n/locales/`):
 *   en/<ns>.json        English text plus `@key` context (the source of truth)
 *   <lang>/<ns>.json    translations, text only
 *   <lang>/.source.json key -> the English text each translation was made from (staleness)
 *   glossary.json       term table and do-not-translate list
 */
const fs = require("fs");
const path = require("path");

const REPO = path.resolve(__dirname, "..");
const LOCALES_DIR = path.join(REPO, "src/common/i18n/locales");
const SOURCE_LANGUAGE = "en";
const PSEUDO_LANGUAGE = "qps";
const SOURCE_TEXTS = ".source.json";
const KEY_PATTERN = /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$/;
const PARSE_OPTIONS = { ignoreTag: true };

let parserPromise;
/** The ICU parser (an ES module, reached from CommonJS through a dynamic import) */
function loadParser() {
  parserPromise ??= import("@formatjs/icu-messageformat-parser");
  return parserPromise;
}

function rel(file) {
  return path.relative(REPO, file).split(path.sep).join("/");
}

function readJsonObject(file, problems) {
  let value;
  try {
    value = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    problems?.push(`${rel(file)}: not valid JSON (${err.message})`);
    return null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    problems?.push(`${rel(file)}: must be a JSON object`);
    return null;
  }
  return value;
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
}

function listJson(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".json") && !name.startsWith("."))
    .sort();
}

/** The translation folders (everything but English and dot-folders) */
function listLanguages(localesDir) {
  if (!fs.existsSync(localesDir)) return [];
  return fs
    .readdirSync(localesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== SOURCE_LANGUAGE && !d.name.startsWith("."))
    .map((d) => d.name)
    .sort();
}

/** Parses a message: `{ ast }`, or `{ error }` for invalid ICU */
function parseMessage(parser, text) {
  try {
    return { ast: parser.parse(text, PARSE_OPTIONS) };
  } catch (err) {
    return { error: err.message };
  }
}

/**
 * A message's placeholder names and its literal length: placeholders count zero, `#` one, and a
 * plural/select its longest branch (what `maxChars` is compared against).
 */
function analyze(parser, ast) {
  const { TYPE } = parser;
  const names = new Set();
  const walk = (elements) => {
    let length = 0;
    for (const el of elements) {
      switch (el.type) {
        case TYPE.literal:
          length += el.value.length;
          break;
        case TYPE.pound:
          length += 1;
          break;
        case TYPE.argument:
        case TYPE.number:
        case TYPE.date:
        case TYPE.time:
          names.add(el.value);
          break;
        case TYPE.plural:
        case TYPE.select: {
          names.add(el.value);
          let longest = 0;
          for (const option of Object.values(el.options)) longest = Math.max(longest, walk(option.value));
          length += longest;
          break;
        }
        case TYPE.tag:
          names.add(el.value);
          length += walk(el.children);
          break;
      }
    }
    return length;
  };
  const length = walk(ast);
  return { placeholders: [...names].sort(), length };
}

/**
 * Reads English: `{ namespaces, entries }`, where `entries` maps key -> `{ text, meta, ns }` in file
 * order. Structural problems go to `problems`; nothing is validated beyond JSON shape here.
 */
function loadEnglish(localesDir, problems = []) {
  const enDir = path.join(localesDir, SOURCE_LANGUAGE);
  const namespaces = listJson(enDir).map((f) => f.replace(/\.json$/, ""));
  const entries = new Map();
  const raw = {};
  for (const ns of namespaces) {
    const data = readJsonObject(path.join(enDir, `${ns}.json`), problems);
    raw[ns] = data ?? {};
    if (!data) continue;
    for (const [key, value] of Object.entries(data)) {
      if (key.startsWith("@") || entries.has(key) || typeof value !== "string") continue;
      const meta = data[`@${key}`];
      entries.set(key, { text: value, meta: meta && typeof meta === "object" && !Array.isArray(meta) ? meta : {}, ns });
    }
  }
  return { namespaces, entries, raw };
}

/** Reads one language: `{ texts: key -> text, files: ns -> object, sources: key -> English }` */
function loadLanguage(localesDir, lang, problems = []) {
  const dir = path.join(localesDir, lang);
  const files = {};
  const texts = new Map();
  for (const file of listJson(dir)) {
    const ns = file.replace(/\.json$/, "");
    const data = readJsonObject(path.join(dir, file), problems);
    files[ns] = data ?? {};
    for (const [key, value] of Object.entries(data ?? {})) texts.set(key, { text: value, ns });
  }
  const sourcesFile = path.join(dir, SOURCE_TEXTS);
  const sources = fs.existsSync(sourcesFile) ? (readJsonObject(sourcesFile, problems) ?? {}) : {};
  return { dir, files, texts, sources, sourcesFile };
}

/** The glossary, or an empty one */
function loadGlossary(localesDir) {
  const file = path.join(localesDir, "glossary.json");
  if (!fs.existsSync(file)) return { terms: [], doNotTranslate: [], variantOnly: {} };
  const data = readJsonObject(file) ?? {};
  return {
    terms: Array.isArray(data.terms) ? data.terms : [],
    doNotTranslate: Array.isArray(data.doNotTranslate) ? data.doNotTranslate : [],
    variantOnly: data.variantOnly && typeof data.variantOnly === "object" ? data.variantOnly : {}
  };
}

/** The translations module the runtime imports: every `<lang>/<ns>.json`, merged per language */
function renderTranslationsFile(localesDir) {
  const header =
    "// Generated by `npm run i18n:keys` from src/common/i18n/locales/<lang>/*.json - do not edit.\n" +
    "// Every translated catalog, bundled into main and both renderers (LOCALIZATION_PLAN D1).\n";
  const imports = [];
  const langs = [];
  for (const lang of listLanguages(localesDir)) {
    if (lang === PSEUDO_LANGUAGE) continue;
    const nsList = listJson(path.join(localesDir, lang)).map((f) => f.replace(/\.json$/, ""));
    if (!nsList.length) continue;
    const ids = nsList.map((ns) => {
      const id = `${lang.replace(/[^a-zA-Z0-9]/g, "_")}_${ns}`;
      imports.push(`import ${id} from "./locales/${lang}/${ns}.json";`);
      return id;
    });
    langs.push(`  ${JSON.stringify(lang)}: mergeNamespaces({ ${nsList.map((ns, i) => `${JSON.stringify(ns)}: ${ids[i]}`).join(", ")} })`);
  }
  // --- Translation status per language (the Language page's status line, LOCALIZATION_PLAN §7)
  const { entries } = loadEnglish(localesDir);
  const status = [];
  for (const lang of listLanguages(localesDir)) {
    if (lang === PSEUDO_LANGUAGE) continue;
    const { texts, sources } = loadLanguage(localesDir, lang);
    let translated = 0;
    let outdated = 0;
    for (const [key, source] of entries) {
      if (!texts.has(key)) continue;
      translated++;
      if (sources[key] !== source.text) outdated++;
    }
    if (translated) status.push(`  ${JSON.stringify(lang)}: { translated: ${translated}, total: ${entries.size}, outdated: ${outdated} }`);
  }
  return (
    header +
    (langs.length
      ? 'import { mergeNamespaces, type Catalog } from "./catalogs-core";\n'
      : 'import type { Catalog } from "./catalogs-core";\n') +
    (imports.length ? imports.join("\n") + "\n" : "") +
    "\nexport const TRANSLATED_CATALOGS: Readonly<Record<string, Catalog>> = {" +
    (langs.length ? `\n${langs.join(",\n")}\n` : "") +
    "};\n" +
    "\n/** How much of English each language translates, and how much of that is outdated */\n" +
    "export const TRANSLATION_STATUS: Readonly<Record<string, { translated: number; total: number; outdated: number }>> = {" +
    (status.length ? `\n${status.join(",\n")}\n` : "") +
    "};\n"
  );
}

module.exports = {
  REPO,
  LOCALES_DIR,
  SOURCE_LANGUAGE,
  PSEUDO_LANGUAGE,
  SOURCE_TEXTS,
  KEY_PATTERN,
  loadParser,
  rel,
  readJsonObject,
  writeJson,
  listJson,
  listLanguages,
  parseMessage,
  analyze,
  loadEnglish,
  loadLanguage,
  loadGlossary,
  renderTranslationsFile
};
