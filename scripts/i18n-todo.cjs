/**
 * Writes the batch of entries one language still needs (`.plans/LOCALIZATION_PLAN.md` §6): every
 * English entry the language has no translation for, and every translation whose English changed
 * since it was made (with the old English and the current translation, so a fix is re-translated,
 * not lost). Each entry carries its translator context. Hand the file, `TRANSLATING.md` and
 * `glossary.json` to the translator (an AI model or a person); fold the answer back with
 * `npm run i18n:merge`.
 *
 * Usage:
 *   npm run i18n:todo -- <lang> [--ns <namespace>] [--out <file>] [--limit <n>]
 * Default output: i18n-work/<lang>[.<ns>].todo.json (git-ignored).
 */
const path = require("path");
const lib = require("./i18n-lib.cjs");

function parseArgs(argv) {
  const args = { lang: undefined, ns: undefined, out: undefined, limit: undefined };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--ns") args.ns = argv[++i];
    else if (a === "--out") args.out = argv[++i];
    else if (a === "--limit") args.limit = Number(argv[++i]);
    else if (!args.lang) args.lang = a;
  }
  return args;
}

/** The batch for one language: `{ language, entries }` */
function buildTodo({ localesDir = lib.LOCALES_DIR, lang, ns, limit } = {}) {
  const { entries } = lib.loadEnglish(localesDir);
  const { texts, sources } = lib.loadLanguage(localesDir, lang);
  const todo = [];
  for (const [key, source] of entries) {
    if (ns && source.ns !== ns) continue;
    const existing = texts.get(key);
    const outdated = existing !== undefined && sources[key] !== source.text;
    if (existing !== undefined && !outdated) continue;
    const entry = { key, english: source.text, context: source.meta.context ?? "" };
    if (source.meta.maxChars) entry.maxChars = source.meta.maxChars;
    if (source.meta.placeholders) entry.placeholders = source.meta.placeholders;
    if (outdated) {
      entry.status = "outdated";
      if (sources[key] !== undefined) entry.oldEnglish = sources[key];
      entry.currentTranslation = existing.text;
    }
    todo.push(entry);
    if (limit && todo.length >= limit) break;
  }
  return {
    language: lang,
    instructions:
      "Translate each entry's 'english' into the language above, following TRANSLATING.md and glossary.json. " +
      "Answer with one JSON object { \"<key>\": \"<translation>\" } and nothing else in it.",
    entries: todo
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.lang || args.lang === lib.SOURCE_LANGUAGE || args.lang === lib.PSEUDO_LANGUAGE) {
    console.error("Usage: npm run i18n:todo -- <lang> [--ns <namespace>] [--out <file>] [--limit <n>]");
    process.exitCode = 1;
    return;
  }
  const todo = buildTodo({ lang: args.lang, ns: args.ns, limit: args.limit });
  const out =
    args.out ?? path.join(lib.REPO, "i18n-work", `${args.lang}${args.ns ? `.${args.ns}` : ""}.todo.json`);
  lib.writeJson(out, todo);
  const outdated = todo.entries.filter((e) => e.status === "outdated").length;
  console.log(`${lib.rel(out)}: ${todo.entries.length} entries (${outdated} outdated)`);
}

if (require.main === module) main();

module.exports = { buildTodo, parseArgs };
