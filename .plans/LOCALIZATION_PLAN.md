# Localization Plan (Spanish, Brazilian and European Portuguese, German, Hungarian)

Goal: every user-facing literal in Klive IDE lives in one folder of per-language message files,
English carries translator context, AI translates English into the other languages, and the app
shows text in the language chosen in Settings. **English must keep working after every step.**

Status: plan only. Nothing implemented.

---

## 0. Decisions

| # | Decision | Why |
|---|----------|-----|
| D1 | Message files live in `src/common/i18n/locales/<lang>/<namespace>.json`. | `src/common` is bundled into main *and* both renderers; menus are built in main, dialogs in the renderers. One folder, grouped by language, as asked. |
| D2 | **English is the source and the fallback.** A key missing in `de` shows the English text, never the key. | Lets every migration step ship; partly translated languages are safe. |
| D3 | Messages use **ICU MessageFormat** (`{count, plural, one {# breakpoint} other {# breakpoints}}`, `{name}`), formatted by `intl-messageformat` (FormatJS, small, no React dependency). | Plurals and placeholders work identically in main and renderer; AI translators know ICU well. |
| D4 | Context sits **next to the English text** in ARB style: `"@key": { "context": ..., "maxChars": ..., "placeholders": {...} }`. Other languages hold only `"key": "text"`. | One place to read when translating; the translated files stay small and diff cleanly. |
| D5 | Keys are dotted, area-first and stable: `menu.file.openFile`, `settings.emu.showToolbar.title`, `dialog.delete.confirm`. Never the English text as the key. | Changing English wording must not orphan four translations. |
| D6 | A thin in-house wrapper (`t(key, args)`, `useT()` hook) — no i18next. | ~100 lines; typed keys; nothing to configure; same call in main and renderer. (i18next + ICU plugin is the fallback if we later want namespaces lazy-loaded.) |
| D7 | **Keys at definition, text at display.** Module-level constants (setting definitions, command metadata, panel registries, menu builders) store keys or call `t()` when rendered, never at import time. | Import-time strings freeze in the start-up language and break live switching. |
| D8 | A dedicated **Language** page in the Settings dialog (§7), backed by the setting `ide.language` (`"system"` default, then `en`, `es`, `pt-BR`, `pt-PT`, `de`, `hu`). Switching is live: main rebuilds menus, renderers re-render. | Easy to find, room for completeness and a "help translate" link; `setupMenu` already runs on every state change (`src/main/app-menu.ts`), so menus come for free. |
| D9 | Not translated: Z80/6502 mnemonics, register and flag names, NextReg names, assembler directives, BASIC keywords, interactive **command names and their syntax**, machine/model names (`ZX Spectrum 48K`), file extensions, accelerators, log/trace output, external compiler output (sjasmplus, zxbc, z88dk, Pasta/80), the docs site. | Technical identifiers users type or search for; translating them hurts more than it helps. |
| D10 | **Both Portuguese variants ship as two full catalogs**, `pt-BR` and `pt-PT`, each translated from English and each falling back straight to English — no `pt-PT → pt-BR` overlay. | The variants differ in everyday UI vocabulary (*arquivo*/*ficheiro*, *salvar*/*guardar*, *tela*/*ecrã*, *excluir*/*eliminar*, *usuário*/*utilizador*) and in pronoun/verb forms (*você* vs *tu*/impersonal, gerund vs *a* + infinitive). An overlay leaks Brazilian words into the European UI wherever a key was not overridden; with AI translation a second full catalog costs almost nothing. |
| D11 | A **translator kit** for contributors (§8): a human guide for adding or fixing a language, plus the ready-to-use AI prompt and glossary. Written (AI-generated) once the tooling exists, and kept in the repo next to the catalogs. | New languages and fixes come from the community; the kit makes their output consistent with ours and passes `i18n:check` first time. |
| D12 | Supported languages are registered in **one table**, `src/common/i18n/languages.ts` (id, native name, English name, ICU locale, enabled flag). The settings page, `system` resolution, the tooling and the guide all read it. | Adding a language is "add a row + a folder", nothing else. |

---

## 1. File layout

```
src/common/i18n/
  i18n.ts                 t(), setLanguage(), resolveLanguage("system" -> app.getLocale())
  languages.ts            the supported-language table (D12)
  useT.ts                 renderer hook, subscribes to the language in the store
  keys.generated.ts       union type of all English keys (generated, checked in)
  locales/
    glossary.json         term table: en term -> es/pt-BR/pt-PT/de/hu, plus do-not-translate list
    README.md             contributor guide: add a language / fix a translation (§8)
    TRANSLATING.md        the prompt/instructions given to the AI translator (§8)
    en/  common.json  menu.json  settings.json  dialogs.json  panels.json
         statusbar.json  toolbar.json  commands.json  messages.json  emu.json
    es/  (same files, text only) + .source.json (hash of the English each entry was translated from)
    pt-BR/  ...
    pt-PT/  ...
    de/  ...
    hu/  ...
    qps/ (generated pseudo-locale, not shipped in the language list except in dev)
```

English entry example:

```json
{
  "menu.file.openFile": "Open File…",
  "@menu.file.openFile": {
    "context": "File menu item. Opens a picker for any file the emulator understands (tape, snapshot, disk, ROM).",
    "maxChars": 28
  },
  "dialog.delete.confirm": "Delete {name}?",
  "@dialog.delete.confirm": {
    "context": "Title of the confirmation dialog when the user deletes a file or folder in the Explorer.",
    "placeholders": { "name": "File or folder name, shown verbatim, e.g. 'main.kz80.asm'" }
  },
  "statusbar.breakpoints": "{count, plural, one {# breakpoint} other {# breakpoints}}",
  "@statusbar.breakpoints": {
    "context": "IDE status bar, right side. Single line, no wrapping.",
    "maxChars": 18
  }
}
```

Namespaces are split by area so one AI request translates one coherent file with its context.

---

## 2. Tooling

- `npm run i18n:check` (also in CI), fails on:
  - a key used in code that is not in `en`; an `en` key not used anywhere (warning);
  - ICU syntax errors, or a translation whose **placeholders differ** from English;
  - `maxChars` exceeded (warning, listed per language — the overflow worklist);
  - keys present in a translation but gone from `en` (stale).
- `npm run i18n:todo -- de` writes the missing/stale keys for one language, **with their English
  context**, into a single JSON batch to hand to the AI; `npm run i18n:merge` folds the answer back.
- `npm run i18n:pseudo` generates `qps`: accents every letter (`Ôþéñ Fîļé…`), pads ~40 %, wraps in
  `[…]`. Run Klive in `qps` to see at a glance (a) any English text not yet extracted and (b) where
  longer text overflows. This is the main UX-check tool; German and Hungarian run ~30–40 % longer.
- **Staleness**: each language keeps `.source.json`, a hash of the English text each entry was
  translated from. When the English changes, `i18n:check` lists the entry as *outdated* (warning)
  and `i18n:todo` includes it with the old and new English, so a fix is re-translated, not lost.
- **Show keys** debug toggle (dev builds, and a hidden `ide.i18nShowKeys` setting): every string
  renders as `menu.file.openFile` (or appends it in a tooltip). A contributor who sees a bad
  translation on screen finds its key in seconds.
- Portuguese check: a warning list of `pt-PT` entries containing known Brazilian-only words (and
  vice versa), driven by the variant columns of `glossary.json` — the cheap guard against the AI
  drifting into the other variant.
- `keys.generated.ts` regenerated from `en` so `t("menu.file.opneFile")` is a type error.
- An ESLint `no-literal-string` rule (e.g. `eslint-plugin-i18next`) enabled **per migrated folder**,
  with the same "baseline only goes down" mechanism the project already uses for style mandates.

---

## 3. Migration steps (English works after each)

Each step: replace literals with `t()`, add keys + context to `en/*.json`, run `i18n:check`,
the focused tests, `build:check`, `lint:renderer`. Until step 10 no other language exists, so the
app is byte-for-byte English.

| Step | Scope | Notes |
|------|-------|-------|
| 1 | Infrastructure: `i18n.ts`, `useT`, empty `en` files, `i18n:check`, pseudo-locale, test setup pinning `en`. | No UI change. |
| 2 | `languages.ts`, the `ide.language` setting and the **Language** settings page (§7), offering `en` only (plus `qps` in dev). Language goes into app state so main and both renderers agree. | Proves live switching end to end with `qps`. |
| 3 | **Menus** (`src/main/menus/*`, `app-menu.ts`, `machine-menus/*`, ~240 labels). | Replace macOS `role:` items' implicit labels with explicit ones, or Electron labels them in the *OS* language — a mixed menu. Accelerators untouched. |
| 4 | **Native dialogs and notifications** in main (`showMessageBox`, ~30). | Full sentences, no concatenation. |
| 5 | **Shared controls**: OK/Cancel/Close defaults, `Modal`, `EmptyState`, validators in `dialogValidators.ts`. | Small, high reach. |
| 6 | **Settings**: `setting-definitions.ts` titles/descriptions, `settings-pages.ts`, dropdown option labels (values stay IDs). | Convert to keys (D7). Settings search should match the translated title *and* the English one. |
| 7 | **Dialogs**, one folder per PR: IDE dialogs, then Emu dialogs. | MVC dialogs: put `t()` in the View, keep Models text-free so tests don't depend on wording. |
| 8 | **Chrome**: activity bar, side-bar panel titles, toolbars (tooltips), status bars, document tab titles of built-in panels, context menus, explorer messages. | |
| 9 | **Translator kit** (§8): AI-generate `locales/README.md`, `TRANSLATING.md`, the first `glossary.json`, and `.ai/i18n-guide.md` for agents changing code. Dry-run it: follow the guide literally to add `hu` from scratch, fix what the guide got wrong. | Must exist before the first real translation, because that round uses the same prompt contributors will. |
| 10 | **First translation round**: run `i18n:todo` for es/pt-BR/pt-PT/de/hu on what is migrated so far; review; enable the five languages in the dropdown (incomplete parts fall back to English). | Can happen any time after step 9; repeat after each later step. |
| 11 | **Panels** (data panels: CPU, ULA, Next, Copper, Sprites, history, profiler…): only headers, section titles, empty states, tooltips. Register/field labels stay English (D9). | Most `ch`-width columns hold technical labels and need no change. |
| 12 | **Interactive commands**: `description`/`usage` help text (~150 commands) and user-facing result messages. Command names and argument syntax stay English. | Large but mechanical; lowest priority. |
| 13 | Klive's own assembler and Klive BASIC error messages (error-code catalogs) — optional, last. | Errors appear in output panes and editor squiggles; users search the web for them, so keep the code (`Z0001`) visible in every language. |

---

## 4. UX risks to watch

**Text expansion** (de/hu ~+35 %, es/pt ~+25 %). Spots seen in a quick survey:

- **Status bars** (`appIde/StatusBar`, `appEmu/StatusBar`): one line, `nowrap`. Long items push
  others off-screen. Give each item a truncation rule + tooltip; prefer short keys with `maxChars`.
- **Fixed-width dialogs**: `Z88InsertCardDialog` (`width: 354px`), `JoystickBindingsDialog`
  (`18ch` column), toolbar split-button menu (`min-width: 190px`). Switch to `min-width` or let content size them.
- **Dialog button rows**: several buttons with long verbs (de "Abbrechen", "Übernehmen"; hu
  "Mégse", "Alkalmaz") — allow wrapping the row or stack on narrow modals.
- **`ch`-width data columns** (`DataLabel width="5ch"` etc., ~20 places, e.g.
  `ExecutionHistoryPanel` "Before"/"After (now)" at 6ch/11ch). Only translate where a header is
  plain English; there, widen to the longest translation or let the column size to content.
- **Truncated titles**: ~190 `nowrap`/`text-overflow` rules (panel headers, tabs with
  `max-width: 360px`, explorer). Anything that can ellipsize must have a tooltip with full text.
- **Settings dialog**: page list column and long titles; descriptions wrap fine.
- **Activity bar / icon buttons**: tooltips only — safe.

**Grammar and composition**

- **No string concatenation** (`"Delete " + name + "?"`, `` `${n} items` ``). Hungarian attaches
  suffixes to nouns with vowel harmony (`fájlt`, `fájlba`) and German moves verbs; only whole
  messages with placeholders survive translation. Phrase placeholders as standalone nouns
  ("A(z) {name} fájl törlése?") and say so in `TRANSLATING.md`.
- **Plurals** always via ICU; never `n === 1 ? "…" : "…s"`. (Hungarian uses singular after
  numbers — ICU handles it; hand-written English logic does not.)
- **Capitalization**: English Title Case menus; es/pt/hu use sentence case, German capitalizes
  nouns. Tell the translator; don't rely on CSS `text-transform`.
- **Ellipsis**: keep `…` on items that open a dialog, in every language.

**Formatting**

- Decimal comma in de/es/pt/hu. Use the locale **only** for human figures (file sizes, durations,
  percentages in the profiler); hex dumps, addresses, T-states and anything copy-pasteable stay
  invariant. The ~55 existing `toLocale*`/`Intl` calls should be audited in step 11 — some
  currently follow the OS locale and will change behaviour silently.
- Keyboard shortcuts inside sentences → placeholders (`"Press {shortcut} to step"`).

**Fonts**: Hungarian needs `ő ű Ő Ű` (Latin Extended-A). Inter ships a `latin-ext` subset, good.
Check that Iosevka (no `-ext` file) and `zxspectrum.woff2` are not used for translated UI text, or
that they cover those glyphs; run the `qps` locale plus a Hungarian sample screen.

**Other**

- Tests asserting English text, the `scripts/doc-shots/` recipes and the `.plans/baseline/`
  screenshot scripts must pin `en` (step 1), or a developer's language setting breaks them.
- Persisted settings, project files and command-prompt input must store IDs, never labels.
- The command palette/prompt filter: match translated titles and English command names.
- Images with English text (virtual keyboards) stay as they are — they depict hardware.

---

## 5. Runtime design (how text reaches the screen)

```ts
// src/common/i18n/i18n.ts
type Catalog = Record<string, string>;
let current: Catalog = en;            // merged: en <- selected language
export function setLanguage(lang: LanguageId): void { current = { ...en, ...catalogs[lang] }; cache.clear(); }
export function t(key: MessageKey, args?: Record<string, unknown>): string {
  // compile once per key with IntlMessageFormat(current[key], lang), cache, format(args)
}
```

- **Main**: on start, resolve `ide.language` (`system` → `app.getLocale()` mapped to a supported
  language: `pt-BR` → `pt-BR`, `pt-PT` → `pt-PT`, a bare `pt` → `pt-BR`, `es-*` → `es`, `de-*` → `de`,
  anything else → `en`), call `setLanguage`. Subscribe to the setting; on change call `setLanguage`
  and invalidate the menu signature cache so `setupMenu` rebuilds.
- **Renderers**: catalogs are bundled (six catalogs × a few hundred KB at most — no lazy loading
  needed). `useT()` selects the language from the store, calls `setLanguage` when it changes, and
  returns `t` so the component re-renders. Non-React code calls `t()` at display time (D7).
- **Main ↔ renderer** consistency: the language lives in the shared store, so all three agree.
- `document.documentElement.lang` is set too (correct hyphenation and spell-check hints).

---

## 6. AI translation workflow

1. `npm run i18n:todo -- hu` → `hu.todo.json` (key, English, context, maxChars, placeholders).
2. Send it with `locales/TRANSLATING.md` and `glossary.json` to the model. `TRANSLATING.md` states:
   keep placeholders and ICU syntax byte-exact, respect `maxChars` (prefer a shorter synonym or a
   standard abbreviation over truncation), never translate the do-not-translate list, follow the
   glossary, keep `…`, use the language's capitalization convention. For Portuguese, the request
   names the variant explicitly and the glossary gives a separate `pt-BR` and `pt-PT` column; the
   two variants are translated in separate requests, each from English.
3. `npm run i18n:merge -- hu hu.todo.json`, then `i18n:check` (placeholders, ICU, length).
4. Look at it in the app: run in `hu`, scan the screens listed in §4. Optionally automate with
   `scripts/doc-shots/` capturing the same screens per language for side-by-side review.
5. Translating between non-English languages (e.g. es→pt-BR, or pt-BR→pt-PT as a starting point)
   works the same way: pass the English source with context and the existing translation as a
   hint; English stays the source of truth.

---

## 7. The Language settings page

A new page `{ id: "language", title: "Language" }` in `SETTINGS_PAGES`
(`src/common/settings/settings-pages.ts`), placed right after **General**. Rows are ordinary
settings rows, so the page needs no new dialog machinery (the MVC split in
`appIde/dialogs/settings/` stays as is).

| Row | Control | Notes |
|-----|---------|-------|
| Display language | Dropdown | Options from `languages.ts`, each shown in **its own language** (*English*, *Español*, *Português (Brasil)*, *Português (Portugal)*, *Deutsch*, *Magyar*) — a user stuck in a language they cannot read still finds theirs. The first option is *System default (Deutsch)*, naming what `system` resolves to. Changes apply immediately. |
| Translation status | Read-only text | For the selected language: "92 % translated · 14 entries outdated". Shown only for non-English. Computed at build time by `i18n:check` into a small JSON, not at run time. |
| Help translate | Button | Opens the contributor guide (`locales/README.md` on GitHub) in the browser. |
| Show translation keys | Checkbox | Dev builds only (the `ide.i18nShowKeys` toggle from §2). |

Also:

- The page's own title, the row titles and the *System default* label are translated like
  everything else; the **language names are never translated** (they come from `languages.ts`).
- The settings search finds the page by "language" in English **and** in the current language
  (a German user searching *Sprache* or *language* both land here).
- Escape hatch: the existing setting command in the IDE command prompt can set `ide.language en`,
  and the command name is never translated (D9). The guide's troubleshooting section mentions it.
- Partially translated languages are listed normally; `enabled: false` in `languages.ts` hides a
  language that is still too incomplete to offer (e.g. below ~60 %), except in dev builds.

---

## 8. Translator kit (contributor instructions)

Written in step 9, AI-generated from this plan and the finished tooling, then dry-run by following
it literally. Four files:

**`src/common/i18n/locales/README.md`** — the human guide, linked from the Language page and
from the repo `README.md`:

1. *How Klive's text works*: one folder per language, English is the source with context, the rest
   fall back to English; what is never translated (D9) and why.
2. *Fix a translation*: turn on **Show translation keys**, find the key, edit `<lang>/<ns>.json`,
   run `npm run i18n:check`, open a PR. No tooling beyond Node.
3. *Add a new language*: add a row to `languages.ts` (`enabled: false`), create the folder,
   add a glossary column, run `i18n:todo -- <lang>`, translate (with AI using `TRANSLATING.md`,
   or by hand), `i18n:merge`, `i18n:check`, review in the app, flip `enabled` when ready.
4. *Update after English changed*: the outdated list from `i18n:check`, re-translate only those.
5. *Review checklist* before the PR: placeholders intact, `maxChars` warnings looked at, the
   screens of §4 opened in the app (status bars, dialog buttons, settings page), glossary terms
   used consistently, capitalization convention of the language.
6. *Troubleshooting*: wrong language at start (`ide.language`), a raw key on screen (missing in
   `en` — a code bug, report it), broken plural (ICU syntax), a character shows as a box (font).

**`src/common/i18n/locales/TRANSLATING.md`** — the AI prompt, used as is by contributors and by
us. It is written for the model, not the human, and contains:

- the role and product context (a ZX Spectrum / Z80 development IDE and emulator; audience is
  retro-computing hobbyists and programmers — technical but friendly tone);
- the input format (`*.todo.json`: key, English, context, maxChars, placeholders, old English for
  outdated entries) and the exact output format (`{ "key": "translation" }`, nothing else);
- the hard rules: ICU syntax and `{placeholders}` byte-exact; `#` in plurals kept; plural
  categories of the *target* language (CLDR) — add or drop branches as needed; `…` kept; never
  translate the do-not-translate list; respect `maxChars`, preferring a shorter synonym or an
  established abbreviation over cutting a word;
- the soft rules: follow `glossary.json`; the language's capitalization convention; use the
  context to pick the right sense (*Run* a program vs a *run* of tape; *Break* the key vs a
  breakpoint); phrase around placeholders so no suffix attaches to them (Hungarian);
- per-language notes (one short block each): formal/informal address (de: *Sie*, es/pt-PT/pt-BR
  per glossary decision, hu: impersonal/*Ön*-free UI style); pt-BR vs pt-PT vocabulary; German
  compound length vs `maxChars`;
- a final instruction to list, after the JSON, any entry where the context was insufficient — these
  become context fixes in `en`, which improves every language.

**`src/common/i18n/locales/glossary.json`** — term → per-language translation, plus
`doNotTranslate` (mnemonics, register names, *Klive*, *NextReg*, *Copper*, machine names...).
Seeded by AI from the `en` catalogs (the 100–150 most frequent domain terms), then reviewed by a
native speaker per language; contributors extend it in the same PR as a new language.

**`.ai/i18n-guide.md`** — for AI agents changing Klive's code (listed in `AGENTS.md`): every new
user-facing string goes through `t()` with a key and context in `en`; no concatenation or hand-made
plurals; keys at definition, text at display (D7); add `maxChars` for anything in a status bar,
toolbar, tab, button or column; run `i18n:check`. Agents never write translations for other
languages as part of a feature change — those come through the todo/merge workflow.
