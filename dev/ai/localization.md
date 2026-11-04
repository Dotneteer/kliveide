# Localization: how it is built, and the pattern for the next language or area

Klive's UI is localized: every user-facing text comes from per-language message catalogs, English
carries translator context, AI translates English into the other languages, and the app shows the
language chosen in Settings. It was built in thirteen steps in October 2026 and the plan was closed
on 2026-11-04 (git history: `.plans/LOCALIZATION_PLAN.md`). Shipped: English plus Spanish,
Brazilian and European Portuguese, German and Hungarian, every key translated, **awaiting
native-speaker review**.

| Read | For |
| --- | --- |
| `dev/ai/i18n-guide.md` | The short rules for changing code (every new text through `t()`). |
| This file | The decisions, the runtime, the tooling, and how to localize something new. |
| `src/common/i18n/locales/README.md` | Contributors: fix a translation, add a language. |
| `src/common/i18n/locales/TRANSLATING.md` | The AI translator's prompt, used as is. |
| `docs/i18n/TRANSLATING.md`, `dev/ai/docs-site.md` | The website's translation, which mirrors this one. |

## Decisions (cited in the code as D1-D12)

| # | Decision | Why |
| --- | --- | --- |
| D1 | Catalogs live in `src/common/i18n/locales/<lang>/<namespace>.json`, bundled into main and both renderers. `source.generated.ts` imports every `en/<ns>.json` and `translations.generated.ts` every translation (`npm run i18n:keys` writes both), so a new namespace or language needs no TypeScript edit. | `src/common` reaches every process: menus are built in main, dialogs in the renderers. |
| D2 | **English is the source and the fallback.** A key missing in a language shows the English text, never the key. | Partly translated languages are safe; every step ships. |
| D3 | **ICU MessageFormat** (`{count, plural, one {# item} other {# items}}`, `{name}`), formatted by `intl-messageformat` (pinned with `@formatjs/icu-messageformat-parser`, so one copy is bundled). Messages parse with `ignoreTag: true`. | Plurals and placeholders work the same everywhere; models know ICU well. |
| D4 | Context sits **next to the English** in ARB style: `"@key": { "context", "maxChars", "placeholders" }`. Other languages hold only `"key": "text"`. | One place to read when translating; small, clean diffs. |
| D5 | Keys are dotted, area-first and stable (`menu.file.openFile`, `settings.<page>.<row>.title`, `dialog.<dialog>.*`), never the English text. | Changing English wording must not orphan the translations. |
| D6 | A thin in-house wrapper: `t(key, args)`, `useT()`, no i18next. Keys are typed (`keys.generated.ts`), so a misspelt key is a type error. | About 100 lines, same call in main and renderer. |
| D7 | **Keys at definition, text at display.** Module-level tables store keys, or getters that translate on read (`withLabels`, `labelRecord`, `withTexts` in `labels.ts`; computed diagnostics use `withTranslatedTexts`); filter and option lists are functions. | Import-time strings freeze in the start-up language and break live switching. |
| D8 | The **Language** page in Settings (right after General), on the setting `ideViewOptions.language` (`"system"` or a language id). Switching is live: main rebuilds the menus, renderers re-render. | Easy to find; menus come for free because `setupMenu` runs on every state change. |
| D9 | **Not translated:** mnemonics, register, flag and NextReg names, directives, BASIC keywords, IDE command names and syntax, machine/model/chip names, file extensions, accelerators, log/trace/console output, machine-parsed output (CSV, JSON, `$W:`, the CLI), text written into files, external compiler output, key-cap legends, NextReg and sysvar descriptions. | Technical identifiers users type or search for. |
| D10 | **Both Portuguese variants are full catalogs** (`pt-BR`, `pt-PT`), each translated from English, each falling back straight to English. | The variants differ in everyday UI words (*arquivo*/*ficheiro*, *salvar*/*guardar*, *tela*/*ecrã*); an overlay leaks one into the other. |
| D11 | A **translator kit** in the repo next to the catalogs: `locales/README.md`, `locales/TRANSLATING.md`, `locales/glossary.json`, and `dev/ai/i18n-guide.md` for agents. | Community translations come out consistent and pass `i18n:check` first time. |
| D12 | Languages are **one table**, `src/common/i18n/languages.ts` (id, native name, English name, ICU locale, `enabled`). The Language page, `system` resolution, the tooling and the guide read it. | Adding a language is a row and a folder. |

## The runtime

- `src/common/i18n/i18n.ts`: a `Translator` class (tests build their own with fixture catalogs) and
  the app singleton, with `t`, `tEnglish` (logs stay English, D9), `setLanguage`, `getLanguage`,
  `setShowKeys`, `subscribe`. **`t()` never throws**: a key English lacks returns the key; a
  translation that is invalid ICU or fails to format falls back to English. Formatters are cached
  per key and cleared on a switch. `resolveLanguage` is pure.
- **Main resolves, everyone follows.** `src/main/ui-language.ts` runs first in main's store
  subscriber: it computes the language from the setting and `app.getPreferredSystemLanguages()`,
  sets main's translator, publishes `SET_UI_LANGUAGE` into `AppState.uiLanguage`, and invalidates
  the menu cache; it re-publishes once the emulator window has loaded (a dispatch before the windows
  exist reaches no renderer). Renderers never resolve `system` themselves.
- **Renderers:** `installUiLanguageSync(store)` (`src/renderer/core/uiLanguageSync.ts`) is a store
  subscriber installed in `main.tsx` before React renders, so no render runs in the old language. It
  sets `document.documentElement.lang`. `useT()` uses `useSyncExternalStore` on the translator. The
  compiler worker sets its own translator from `state.uiLanguage`.
- **MVC dialogs:** Models are text-free; `UiController` memoizes the view model on state *and* the
  language, and also subscribes to the translator, so an open dialog re-words itself on a switch.
- **Names copied into state** (document and tool-tab names) are re-read from the registry at display
  (`documentDisplayName`), or they keep the language they were opened in. File views that word
  their text at load re-parse on a switch (`GenericFilePanel` lists `t` in its loader's
  dependencies).
- **Highlighted spans inside a sentence** stay one message: the code formats it with marker
  placeholders and splits on them to put the React nodes back (`richText.tsx`).
- **Numbers:** human figures use `uiLocale()` (the display language's locale) or ICU
  `{n, number}`; invariant data (hex, addresses, T-states, anything copy-pasteable) uses `"en-US"`.
  No bare `toLocaleString()`, which follows the OS locale.
- **Native menus and dialogs:** macOS `role:` items carry explicit labels (worded as Electron's
  defaults), and native dialog buttons are passed explicitly, or the OS labels them in its own
  language. Not controllable: what macOS appends to the Edit menu (*Start Dictation…*).

## The tooling

- `npm run i18n:check` (in `build:check`, so CI runs it). Errors: a key used in code missing from
  English, bad key format, a key in two namespaces, an empty `@key.context`, invalid ICU, a
  placeholder not described in `@key.placeholders` (or one described and unused), a translation whose
  placeholders differ, a stale key, a namespace file not imported. Warnings: an unused English key,
  `maxChars` exceeded (placeholders count zero, `#` one, a plural its longest branch), an
  *outdated* translation, Portuguese text using the other variant's words (`glossary.json`
  `variantOnly`). It reports `<lang>: N % translated, z outdated`. Code that builds keys at run time
  declares them with an `i18n-dynamic: <prefix>` comment.
- `npm run i18n:keys` regenerates `keys.generated.ts`, `source.generated.ts` and
  `translations.generated.ts` (with `TRANSLATION_STATUS`, the Language page's "N % translated").
- `npm run i18n:todo -- <lang> [--ns] [--limit] [--out]` writes the missing and outdated entries,
  with their English, context, `maxChars` and placeholders (and the old English for outdated ones),
  to the git-ignored `i18n-work/`. `npm run i18n:merge -- <lang> <answer>` reads the first JSON object
  of the answer, rejects unknown keys, bad ICU and changed placeholders, and writes in English's
  order. `<lang>/.source.json` stores the English text each entry was translated from, which is how
  an English change is detected and shown to the translator.
- **The pseudo-locale `qps`** is generated at run time from English (`pseudo.ts`, on the ICU AST, so
  placeholders and plurals survive): accented, padded about 40 %, bracketed. Anything on screen that
  is not `[Åççéñţéð~~]` was missed. Never a checked-in folder (`i18n:check` rejects one). It is not in
  the Language dropdown: use `setLanguage("qps")` in a test, or `ideViewOptions.language: "qps"` in a
  dev build's settings file (the doc-shots harness takes `ideViewOptions`).
- **Show translation keys** (`ideViewOptions.i18nShowKeys`, dev builds): every text shows its key.
- **Tests pin English** (`test/vitest.setup.ts` resets the translator before every test). Scripts
  that drive the app and read its text must seed `ideViewOptions.language: "en"`, as
  `dev/scripts/doc-shots/harness.cjs` does: "System default" really resolves to German on a German OS.

## Localizing a new area (the pattern the thirteen steps followed)

1. **Extract**, one coherent area at a time, English working after each: replace literals with
   `t()`, add the English and its context to the area's namespace file (`en/<area>.json`; a new file
   is picked up by `i18n:keys`), then `i18n:check`, the focused tests, `build:check`,
   `lint:renderer`. Generate contexts from what the code knows (a row's page, group, control kind and
   help text) rather than writing them blind.
2. **Replace logic that matches English text with codes or flags first** (a command's
   `value.needsConfirmation`, a problem code, an enum of reasons): a translated message breaks every
   regex or `.replace()` over it. Search for them before translating an area.
3. **Prove it with a pseudo-locale test** that walks the area in `qps` and fails on any text that is
   not pseudo text, with a verified-failing literal put back once. Existing ones:
   `test/main/app-menu-structure.test.ts` (menus for ten machines in both windows),
   `test/settings/settings-i18n.test.ts`, and the `*-i18n.test.ts` files under `test/`.
4. **Check the running app** in `qps`: a DOM walk for untranslated text, and clipped text.
5. **Large extractions run in parallel** on disjoint files: each agent owns its own namespace file
   (or writes to a staging file merged centrally), so nothing clashes. The shared `src/common`
   modules an agent reports but cannot reach get a cleanup wave of their own.
6. **Fix the English the translators report.** They flag the same defects independently (typos, a
   tooltip describing the wrong picker, a context that misreads an option); correcting `en` improves
   every language, and the outdated path re-translates what changed.

## A translation round (adding a language, or catching up after English grew)

1. A new language: a `languages.ts` row with `enabled: false`, a glossary column, a style decision
   (formal or informal address, capitalization) in `glossary.json`.
2. **One translator per language, never two**: two merges into one language race on its
   `.source.json`. Languages run in parallel. Each follows `TRANSLATING.md` and the glossary
   namespace by namespace (`i18n:todo` → answer → `i18n:merge`), then reviews its whole folder.
3. pt-BR and pt-PT are separate requests, each from English (D10); the variant-word warning guards
   the drift.
4. `maxChars` set by guessing about 1.4× English were too tight in the first round (19 raised): set
   limits from real translations, and give anything that can ellipsize a tooltip with the full text.
5. Grow the glossary with what translators had to settle on, and drop variant-only words that turn
   out to be used in both variants.
6. Check each language in the running app (the native menu, the Language page's status, a DOM scan
   for clipped text), then set `enabled: true`.
7. Never write translations as part of a feature change (`dev/ai/i18n-guide.md`, rule 10).

## UX rules learned

- **Text expansion:** German and Hungarian run about 35-40 % longer, Spanish and Portuguese about
  25 %. Status bars are one `nowrap` line; fixed-width dialogs, button rows and narrow `ch` columns
  overflow first. Prefer `min-width` and content sizing; translate a column header only when it is a
  plain word.
- **Grammar:** no concatenation and no hand-made plurals; Hungarian attaches suffixes with vowel
  harmony and German moves verbs, so phrase placeholders as standalone nouns and put a
  conditional fragment in two whole messages. Hungarian uses the singular after numbers (ICU handles
  it). Title Case is English only; do not rely on CSS `text-transform`. Keep `…` on items that open a
  dialog. Shortcuts inside sentences are placeholders.
- **Fonts:** Hungarian needs `ő ű Ő Ű` (Inter's `latin-ext` covers it); Iosevka and
  `zxspectrum.woff2` are not used for translated UI text.
- Settings, project files and command input store ids, never labels. The Settings search and the
  command filter match the current language **and** English.
- Images with English text (virtual keyboards) depict hardware and stay as they are.
- A heavier bundle made an old start-up race likely: `saveAppSettings()` wrote empty global settings
  if a save ran before main restored them (now gated on `markAppStateRestored()`).

## Open

- **Native-speaker review** of every language. `glossary.json` keeps `reviewed: false` per language.
  Look first at: the debugger step names (es *Salir* for both Step Out and Quit; pt-BR
  *Intervir/Contornar*; the coined reverse-step names), short status-bar tags (es/pt "Veloc.", RZX
  "REPR"/"GRAV"), machine states in the status bar, accent-colour names, the German breakpoint kinds,
  "Take over here" (pt-BR *Assumir daqui*, pt-PT *Retomar aqui*), and the Detect dialog's mode labels.
- The IDE status bar's `statusMessage` can be cut off and has no tooltip.
- `setting-definitions.ts` titles and descriptions are developer documentation, not UI text, and were
  not converted; nothing shows them.
