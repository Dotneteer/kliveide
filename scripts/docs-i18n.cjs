/**
 * Translations of the website (§4 of .plans/DOCS_SITE_MODERNIZATION_PLAN.md). Mirrors the app's
 * `i18n:todo` / `i18n:merge` / `i18n:check` workflow (src/common/i18n/locales/README.md):
 *
 *   node scripts/docs-i18n.cjs languages         Export the enabled UI languages (R1) to
 *                                                 docs/i18n/languages.json.
 *   node scripts/docs-i18n.cjs todo <lang>        Write i18n-work/docs-<lang>.todo.json: what is
 *                                                 missing or outdated, with context, the glossary,
 *                                                 and the app's own translation of every UI label
 *                                                 a page names.
 *   node scripts/docs-i18n.cjs merge <lang> <file>  Validate a translation and write it: landing
 *                                                 and UI texts into docs/i18n/{landing,ui}/<lang>.json,
 *                                                 pages into docs/content/<lang>/.
 *   node scripts/docs-i18n.cjs pack <dir>         Build an answer file from plain files (see pack()).
 *   node scripts/docs-i18n.cjs check              The gate (part of `doc:check`).
 *
 * What gets translated: the landing page and the site chrome (all of them), and the areas listed
 * in TRANSLATED_AREAS (docs/i18n/locales.mjs) - today, Get Started.
 *
 * Every translated item records a hash of the English it came from (docs/i18n/sources/<lang>.json),
 * so a later change to the English shows as "outdated" in `todo` and `check`, and the page itself
 * shows a notice (app/[lang]/(docs)/[...mdxPath]/page.tsx).
 *
 * A page is accepted only if it keeps the English page's structure: identical code blocks,
 * the same <Shot> images and markers, the same headings, the same links. Links into a translated
 * area are rewritten from /en/... to /<lang>/... on merge; translators keep them as they are.
 */
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const REPO = path.join(__dirname, "..");
const DOCS = path.join(REPO, "docs");
const I18N = path.join(DOCS, "i18n");
const CONTENT = path.join(DOCS, "content");
const APP_LOCALES = path.join(REPO, "src", "common", "i18n", "locales");
const TRANSLATED_AREAS = ["get-started"];

// ------------------------------------------------------------------ helpers

const hash = (text) => crypto.createHash("sha1").update(text).digest("hex").slice(0, 16);
const readJson = (file, fallback) => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : fallback);
const writeJson = (file, data) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
};

/** Enabled rows of src/common/i18n/languages.ts, read as text (it is TypeScript). */
function appLanguages() {
  const source = fs.readFileSync(path.join(REPO, "src", "common", "i18n", "languages.ts"), "utf8");
  const rows = [];
  for (const m of source.matchAll(/\{\s*id:\s*"([^"]+)"([^}]*)\}/gs)) {
    const body = m[2];
    if (!/enabled:\s*true/.test(body)) continue;
    const field = (name) => body.match(new RegExp(`${name}:\\s*"([^"]+)"`))?.[1];
    rows.push({ id: m[1], nativeName: field("nativeName"), englishName: field("englishName") });
  }
  return rows;
}

const translatable = (catalog) => Object.entries(catalog).filter(([k]) => !k.startsWith("@"));
const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");

/** The English pages of the translated areas, as { "get-started/index": absolutePath }. */
function englishPages() {
  const pages = {};
  for (const area of TRANSLATED_AREAS) {
    const dir = path.join(CONTENT, "en", area);
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".mdx"))) {
      pages[`${area}/${file.replace(/\.mdx$/, "")}`] = path.join(dir, file);
    }
  }
  return pages;
}

// ------------------------------------------------------------------ page structure

const FENCE = /^```[^\n]*\n[\s\S]*?^```/gm;

/** What a translation must keep from the English page. */
function structure(mdx) {
  const body = mdx.replace(/^---[\s\S]*?---\n/, "");
  const prose = body.replace(FENCE, "");
  return {
    fences: body.match(FENCE) ?? [],
    shots: [...body.matchAll(/<Shot\b[\s\S]*?\/>/g)].map((m) => {
      const src = m[0].match(/src="([^"]+)"/)?.[1];
      const markers = m[0].match(/markers=\{(\[[^\]]*\])\}/)?.[1]?.replace(/\s/g, "") ?? "";
      return `${src} ${markers}`;
    }),
    images: [...body.matchAll(/<ClickableImage\b[^>]*src="([^"]+)"/g)].map((m) => m[1]),
    headings: [...prose.matchAll(/^(#{1,6}) .*?(\[#[\w-]+\])?$/gm)].map((m) => `${m[1]}${m[2] ?? ""}`),
    links: [...prose.matchAll(/(?:\]\(|href=")([^)"\s]+)/g)].map((m) => m[1]).sort(),
    components: [...prose.matchAll(/<(Callout|Steps|Cards|Cards\.Card|Shot|ClickableImage)\b/g)].map((m) => m[1]),
    hasDescription: /^---[\s\S]*?description:\s*"[^"]+"[\s\S]*?---/.test(mdx)
  };
}

/** Links in a translated page as they will be after merge's rewrite, for comparing with English. */
function localizeLinks(mdx, lang) {
  return mdx.replace(/(\]\(|href=")\/en\/([\w-]+)\//g, (all, pre, area) =>
    TRANSLATED_AREAS.includes(area) ? `${pre}/${lang}/${area}/` : all
  );
}

/** Problems that make a translated page unacceptable, compared with its English original. */
function pageProblems(english, translated, lang) {
  const en = structure(localizeLinks(english, lang));
  const tr = structure(translated);
  const problems = [];
  const same = (name, a, b) => {
    if (JSON.stringify(a) !== JSON.stringify(b)) problems.push(`${name} differ from the English page`);
  };
  same("code blocks", en.fences, tr.fences);
  same("<Shot> images or markers", en.shots, tr.shots);
  same("images", en.images, tr.images);
  same("heading levels", en.headings, tr.headings);
  same("links", en.links, tr.links);
  same("components", en.components, tr.components);
  if (!tr.hasDescription) problems.push('the front matter has no description: "..."');
  return problems;
}

// ------------------------------------------------------------------ the app's UI labels

let appCatalogs;
function appCatalog(lang) {
  appCatalogs ??= {};
  if (!appCatalogs[lang]) {
    const dir = path.join(APP_LOCALES, lang);
    const merged = {};
    if (fs.existsSync(dir)) {
      for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".json") && !f.startsWith("."))) {
        Object.assign(merged, readJson(path.join(dir, f), {}));
      }
    }
    appCatalogs[lang] = merged;
  }
  return appCatalogs[lang];
}

/**
 * The app's translation of every UI label a page names in bold (`**Machine › Tape › Insert
 * Tape...**`), so the page uses the words the reader sees in the translated app.
 */
function uiLabels(mdx, lang) {
  const en = appCatalog("en");
  const tr = appCatalog(lang);
  // --- One English text often has several keys (a menu item and a table column both say
  // --- "Start"); a page names menus, toolbars and dialogs, so those win
  const rank = (key) => {
    const order = ["menu.", "toolbar.", "settings.", "dialog.", "dialogs.", "emu.", "panels."];
    const i = order.findIndex((p) => key.startsWith(p));
    return i < 0 ? order.length : i;
  };
  const byText = new Map();
  const add = (text, key) => {
    const list = byText.get(text) ?? [];
    list.push(key);
    byText.set(text, list);
  };
  for (const [key, text] of Object.entries(en)) {
    if (typeof text !== "string" || key.startsWith("@") || typeof tr[key] !== "string") continue;
    add(text.trim(), key);
  }
  const best = (text) => (byText.get(text) ?? []).sort((a, b) => rank(a) - rank(b))[0];
  const labels = {};
  for (const m of mdx.matchAll(/\*\*([^*]+)\*\*/g)) {
    for (const part of m[1].split(" › ")) {
      const clean = part.trim();
      // --- The exact text first ("Settings..." keeps its dots), then without the ellipsis
      let key = best(clean);
      if (!key) {
        const bare = clean.replace(/(\.\.\.|…)$/, "");
        key = best(bare) ?? best(`${bare}...`) ?? best(`${bare}…`);
      }
      if (key) labels[part] = tr[key];
    }
  }
  return labels;
}

// ------------------------------------------------------------------ commands

function languages() {
  const rows = appLanguages();
  writeJson(path.join(I18N, "languages.json"), rows);
  console.log(`docs/i18n/languages.json: ${rows.map((r) => r.id).join(", ")}`);
}

function todo(lang) {
  if (!lang || lang === "en") throw new Error("Usage: docs-i18n.cjs todo <lang> (not en)");
  const info = appLanguages().find((l) => l.id === lang);
  if (!info) throw new Error(`"${lang}" is not an enabled language in src/common/i18n/languages.ts`);
  const sources = readJson(path.join(I18N, "sources", `${lang}.json`), { landing: {}, ui: {}, pages: {} });
  const work = {
    language: info,
    instructions:
      "Translate into the language above, following docs/i18n/TRANSLATING.md and the glossary. " +
      "Answer with a JSON object { landing: {key: text}, ui: {key: text}, pages: {path: mdx} } " +
      "holding only what you translated.",
    glossary: readJson(path.join(APP_LOCALES, "glossary.json"), {}),
    landing: {},
    ui: {},
    pages: {}
  };
  for (const [kind, folder] of [["landing", "landing"], ["ui", "ui"]]) {
    const en = readJson(path.join(I18N, folder, "en.json"), {});
    const tr = readJson(path.join(I18N, folder, `${lang}.json`), {});
    for (const [key, text] of translatable(en)) {
      if (tr[key] === undefined || sources[kind][key] !== hash(text)) {
        work[kind][key] = { text, context: en[`@${key}`]?.context ?? "", ...(tr[key] ? { previous: tr[key] } : {}) };
      }
    }
  }
  for (const [page, file] of Object.entries(englishPages())) {
    const mdx = fs.readFileSync(file, "utf8");
    const target = path.join(CONTENT, lang, `${page}.mdx`);
    if (!fs.existsSync(target) || sources.pages[page] !== hash(mdx)) {
      work.pages[page] = { mdx, uiLabels: uiLabels(mdx, lang), ...(fs.existsSync(target) ? { previous: fs.readFileSync(target, "utf8") } : {}) };
    }
  }
  const out = path.join(REPO, "i18n-work", `docs-${lang}.todo.json`);
  writeJson(out, work);
  console.log(
    `${path.relative(REPO, out)}: ${Object.keys(work.landing).length} landing, ${Object.keys(work.ui).length} UI, ` +
      `${Object.keys(work.pages).length} page(s) to translate`
  );
}

function merge(lang, answerFile) {
  if (!lang || lang === "en" || !answerFile) throw new Error("Usage: docs-i18n.cjs merge <lang> <answer.json>");
  if (!appLanguages().some((l) => l.id === lang)) throw new Error(`"${lang}" is not an enabled language`);
  const answer = JSON.parse(fs.readFileSync(answerFile, "utf8"));
  const sourcesFile = path.join(I18N, "sources", `${lang}.json`);
  const sources = readJson(sourcesFile, { landing: {}, ui: {}, pages: {} });
  const rejected = [];
  let accepted = 0;

  for (const kind of ["landing", "ui"]) {
    const en = readJson(path.join(I18N, kind, "en.json"), {});
    const file = path.join(I18N, kind, `${lang}.json`);
    const tr = readJson(file, {});
    for (const [key, text] of Object.entries(answer[kind] ?? {})) {
      if (typeof en[key] !== "string") rejected.push(`${kind} ${key}: no such English key`);
      else if (typeof text !== "string" || !text.trim()) rejected.push(`${kind} ${key}: empty`);
      else if (placeholders(text) !== placeholders(en[key])) rejected.push(`${kind} ${key}: placeholders {${placeholders(en[key])}} expected`);
      else {
        tr[key] = text;
        sources[kind][key] = hash(en[key]);
        accepted += 1;
      }
    }
    // --- Same key order as English, so diffs stay readable
    const ordered = Object.fromEntries(translatable(en).filter(([k]) => tr[k] !== undefined).map(([k]) => [k, tr[k]]));
    if (Object.keys(ordered).length) writeJson(file, ordered);
  }

  const pages = englishPages();
  for (const [page, mdx] of Object.entries(answer.pages ?? {})) {
    if (!pages[page]) {
      rejected.push(`page ${page}: not a page of a translated area`);
      continue;
    }
    const english = fs.readFileSync(pages[page], "utf8");
    const localized = localizeLinks(mdx, lang);
    const problems = pageProblems(english, localized, lang);
    if (problems.length) {
      rejected.push(`page ${page}: ${problems.join("; ")}`);
      continue;
    }
    const target = path.join(CONTENT, lang, `${page}.mdx`);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, localized.endsWith("\n") ? localized : localized + "\n");
    sources.pages[page] = hash(english);
    accepted += 1;
  }

  writeJson(sourcesFile, sources);
  writeMeta(lang);
  console.log(`Merged ${accepted} item(s) into ${lang}.`);
  if (rejected.length) {
    console.error(`Rejected ${rejected.length} (they stay in the next todo):\n  ${rejected.join("\n  ")}`);
    process.exitCode = 1;
  }
}

/**
 * The locale's navigation: content/<lang>/_meta.ts (the five navbar tabs; untranslated areas
 * link to English) and, per translated area, a _meta.ts in the English order with each page's
 * translated H1 as its sidebar title.
 */
function writeMeta(lang) {
  const ui = { ...readJson(path.join(I18N, "ui", "en.json"), {}), ...readJson(path.join(I18N, "ui", `${lang}.json`), {}) };
  const areas = ["get-started", "guides", "reference", "under-the-hood", "library"];
  const lines = [
    "// Generated by scripts/docs-i18n.cjs (merge); do not edit. Areas without a translation link to English.",
    "export default {"
  ];
  for (const area of areas) {
    const title = ui[`area.${area}`];
    if (TRANSLATED_AREAS.includes(area)) lines.push(`  ${JSON.stringify(area)}: { type: "page", title: ${JSON.stringify(title)} },`);
    else {
      const label = ui["area.englishOnly"].replace("{title}", title);
      lines.push(`  ${JSON.stringify(area)}: { type: "page", title: ${JSON.stringify(label)}, href: "/en/${area}/" },`);
    }
  }
  lines.push("};");
  fs.mkdirSync(path.join(CONTENT, lang), { recursive: true });
  fs.writeFileSync(path.join(CONTENT, lang, "_meta.ts"), lines.join("\n") + "\n");

  for (const area of TRANSLATED_AREAS) {
    const dir = path.join(CONTENT, lang, area);
    if (!fs.existsSync(dir)) continue;
    // --- The English sidebar's order: read the keys of its _meta.ts
    const enMeta = fs.readFileSync(path.join(CONTENT, "en", area, "_meta.ts"), "utf8");
    const order = [...enMeta.matchAll(/^\s*"?([\w-]+)"?:/gm)].map((m) => m[1]);
    const entries = [];
    for (const page of order) {
      const file = path.join(dir, `${page}.mdx`);
      if (!fs.existsSync(file)) continue;
      const h1 = fs.readFileSync(file, "utf8").match(/^# (.+)$/m)?.[1]?.trim() ?? page;
      entries.push(`  ${JSON.stringify(page)}: ${JSON.stringify(h1)}`);
    }
    fs.writeFileSync(
      path.join(dir, "_meta.ts"),
      `// Generated by scripts/docs-i18n.cjs (merge) from the pages' headings; do not edit.\nexport default {\n${entries.join(",\n")}\n};\n`
    );
  }
}

function check() {
  const problems = [];
  const warnings = [];

  // --- R1: the site's languages are the app's enabled languages
  const exported = readJson(path.join(I18N, "languages.json"), []);
  if (JSON.stringify(exported) !== JSON.stringify(appLanguages())) {
    problems.push("docs/i18n/languages.json differs from src/common/i18n/languages.ts: run `node scripts/docs-i18n.cjs languages`");
  }

  const enPages = englishPages();
  const coverage = [];
  for (const { id } of exported.filter((l) => l.id !== "en")) {
    const sources = readJson(path.join(I18N, "sources", `${id}.json`), { landing: {}, ui: {}, pages: {} });
    let outdated = 0;
    for (const kind of ["landing", "ui"]) {
      const en = readJson(path.join(I18N, kind, "en.json"), {});
      const tr = readJson(path.join(I18N, kind, `${id}.json`), {});
      for (const [key, text] of Object.entries(tr)) {
        if (typeof en[key] !== "string") problems.push(`${kind}/${id}.json: "${key}" is not an English key`);
        else if (placeholders(text) !== placeholders(en[key])) problems.push(`${kind}/${id}.json: "${key}" has the wrong placeholders`);
        else if (sources[kind][key] !== hash(en[key])) outdated += 1;
      }
    }
    let pages = 0;
    if (fs.existsSync(path.join(CONTENT, id))) {
      if (!fs.existsSync(path.join(CONTENT, id, "_meta.ts"))) problems.push(`content/${id}/_meta.ts is missing`);
      for (const [page, file] of Object.entries(enPages)) {
        const target = path.join(CONTENT, id, `${page}.mdx`);
        if (!fs.existsSync(target)) continue;
        pages += 1;
        const english = fs.readFileSync(file, "utf8");
        for (const p of pageProblems(english, fs.readFileSync(target, "utf8"), id)) problems.push(`content/${id}/${page}.mdx: ${p}`);
        if (sources.pages[page] !== hash(english)) outdated += 1;
      }
    }
    const landing = Object.keys(readJson(path.join(I18N, "landing", `${id}.json`), {})).length;
    const landingTotal = translatable(readJson(path.join(I18N, "landing", "en.json"), {})).length;
    coverage.push(`${id}: landing ${landing}/${landingTotal}, pages ${pages}/${Object.keys(enPages).length}${outdated ? `, ${outdated} outdated` : ""}`);
    if (outdated) warnings.push(`${id}: ${outdated} translated item(s) are older than their English source (see \`todo ${id}\`)`);
  }

  console.log(`Website translations:\n  ${coverage.join("\n  ") || "(none)"}`);
  for (const w of warnings) console.warn(`warning: ${w}`);
  if (problems.length) {
    console.error(`${problems.length} problem(s):\n  ${problems.join("\n  ")}`);
    return false;
  }
  console.log("Website translations: 0 error(s).");
  return true;
}

/**
 * Builds an answer file from a folder, so a translator can write plain files instead of whole
 * pages escaped inside JSON: <dir>/landing.json, <dir>/ui.json (key -> text) and
 * <dir>/pages/<area>/<page>.mdx. Writes <dir>.answer.json.
 */
function pack(dir) {
  if (!dir) throw new Error("Usage: docs-i18n.cjs pack <dir>");
  const answer = { landing: readJson(path.join(dir, "landing.json"), {}), ui: readJson(path.join(dir, "ui.json"), {}), pages: {} };
  const pagesDir = path.join(dir, "pages");
  if (fs.existsSync(pagesDir)) {
    for (const area of fs.readdirSync(pagesDir)) {
      for (const file of fs.readdirSync(path.join(pagesDir, area)).filter((f) => f.endsWith(".mdx"))) {
        answer.pages[`${area}/${file.replace(/\.mdx$/, "")}`] = fs.readFileSync(path.join(pagesDir, area, file), "utf8");
      }
    }
  }
  const out = `${dir.replace(/\/$/, "")}.answer.json`;
  writeJson(out, answer);
  console.log(`${out}: ${Object.keys(answer.landing).length} landing, ${Object.keys(answer.ui).length} UI, ${Object.keys(answer.pages).length} page(s)`);
}

// ------------------------------------------------------------------ main

if (require.main === module) {
  const [command, ...args] = process.argv.slice(2);
  try {
    if (command === "languages") languages();
    else if (command === "todo") todo(args[0]);
    else if (command === "merge") merge(args[0], args[1]);
    else if (command === "meta") writeMeta(args[0]);
    else if (command === "pack") pack(args[0]);
    else if (command === "check") process.exitCode = check() ? 0 : 1;
    else {
      console.error("Usage: docs-i18n.cjs languages | todo <lang> | merge <lang> <file> | check");
      process.exitCode = 2;
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { structure, pageProblems, localizeLinks, appLanguages, check };
