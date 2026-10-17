/**
 * Folds a translator's answer into one language's catalogs (`.plans/LOCALIZATION_PLAN.md` §6).
 *
 * The answer is a JSON object `{ "<key>": "<translation>" }`; text around it (the translator's
 * notes) is ignored, and only the first `{ ... }` is read. Each accepted entry goes into the
 * namespace file English keeps it in, in English's order, and `.source.json` records the English
 * it was translated from (so a later change to that English marks it outdated). An entry is
 * rejected - and stays in the next `i18n:todo` - when English has no such key, its ICU is invalid,
 * or its placeholders differ from English's. Then `translations.generated.ts` is regenerated, so a
 * new language needs no TypeScript edit.
 *
 * Usage:
 *   npm run i18n:merge -- <lang> <answer.json>
 */
const fs = require("fs");
const path = require("path");
const lib = require("./i18n-lib.cjs");

/** The first balanced `{ ... }` of a text, parsed */
function extractJsonObject(text) {
  const start = text.indexOf("{");
  if (start < 0) throw new Error("The answer holds no JSON object.");
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return JSON.parse(text.slice(start, i + 1));
  }
  throw new Error("The answer's JSON object is not closed.");
}

/**
 * Merges `answer` into `lang`. Returns `{ accepted, rejected: [{ key, reason }] }`. Writes nothing
 * when `dryRun`.
 */
async function mergeTranslations({ localesDir = lib.LOCALES_DIR, lang, answer, dryRun = false, translationsFile }) {
  if (!lang || lang === lib.SOURCE_LANGUAGE || lang === lib.PSEUDO_LANGUAGE) {
    throw new Error(`Cannot merge into "${lang}".`);
  }
  const parser = await lib.loadParser();
  const { namespaces, entries } = lib.loadEnglish(localesDir);
  const loaded = lib.loadLanguage(localesDir, lang);
  const files = {};
  for (const ns of namespaces) files[ns] = { ...(loaded.files[ns] ?? {}) };
  const sources = { ...loaded.sources };
  const rejected = [];
  let accepted = 0;

  for (const [key, value] of Object.entries(answer)) {
    const source = entries.get(key);
    if (!source) {
      rejected.push({ key, reason: "English has no such key" });
      continue;
    }
    if (typeof value !== "string") {
      rejected.push({ key, reason: "the translation is not a string" });
      continue;
    }
    const parsed = lib.parseMessage(parser, value);
    if (parsed.error) {
      rejected.push({ key, reason: `invalid ICU: ${parsed.error}` });
      continue;
    }
    const englishParsed = lib.parseMessage(parser, source.text);
    if (!englishParsed.error) {
      const want = lib.analyze(parser, englishParsed.ast).placeholders;
      const got = lib.analyze(parser, parsed.ast).placeholders;
      if (want.join(",") !== got.join(",")) {
        rejected.push({ key, reason: `placeholders {${got.join("}, {")}} differ from English {${want.join("}, {")}}` });
        continue;
      }
    }
    files[source.ns][key] = value;
    sources[key] = source.text;
    accepted++;
  }

  if (!dryRun) {
    // --- English's order, so the files diff cleanly
    for (const ns of namespaces) {
      const ordered = {};
      for (const [key, source] of entries) {
        if (source.ns === ns && files[ns][key] !== undefined) ordered[key] = files[ns][key];
      }
      const file = path.join(loaded.dir, `${ns}.json`);
      if (Object.keys(ordered).length) lib.writeJson(file, ordered);
      else if (fs.existsSync(file)) fs.rmSync(file);
    }
    const orderedSources = {};
    for (const key of entries.keys()) if (sources[key] !== undefined) orderedSources[key] = sources[key];
    lib.writeJson(loaded.sourcesFile, orderedSources);
    const generated = translationsFile ?? path.join(lib.REPO, "src/common/i18n/translations.generated.ts");
    fs.writeFileSync(generated, lib.renderTranslationsFile(localesDir));
  }
  return { accepted, rejected };
}

async function main() {
  const [lang, answerFile] = process.argv.slice(2);
  if (!lang || !answerFile) {
    console.error("Usage: npm run i18n:merge -- <lang> <answer.json>");
    process.exitCode = 1;
    return;
  }
  const answer = extractJsonObject(fs.readFileSync(answerFile, "utf8"));
  const { accepted, rejected } = await mergeTranslations({ lang, answer });
  console.log(`${lang}: ${accepted} translation(s) merged`);
  for (const r of rejected) console.warn(`rejected "${r.key}": ${r.reason}`);
  if (rejected.length) console.warn(`${rejected.length} rejected - they stay in the next i18n:todo`);
  console.log("Next: npm run i18n:check, then look at it in the app.");
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message ?? err);
    process.exitCode = 1;
  });
}

module.exports = { mergeTranslations, extractJsonObject };
