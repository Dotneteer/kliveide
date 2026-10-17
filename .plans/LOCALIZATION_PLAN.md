# Localization Plan (Spanish, Brazilian and European Portuguese, German, Hungarian)

Goal: every user-facing literal in Klive IDE lives in one folder of per-language message files,
English carries translator context, AI translates English into the other languages, and the app
shows text in the language chosen in Settings. **English must keep working after every step.**

Status: **all steps done (1–13)**; see the "as built" notes under §3. 5817 English keys, translated into Spanish, Brazilian and European Portuguese, German and Hungarian (100 %, AI-translated, awaiting native-speaker review). New UI text follows `.ai/i18n-guide.md`; each later change reruns step 10 for its new keys.

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
  catalogs.ts             explicit imports of every namespace file, merged into flat catalogs
  pseudo.ts               the qps transformation (accent, pad, bracket) on the parsed ICU AST
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
    (no qps/ folder: the pseudo-locale is built from English at run time, see step 1 as built)
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

### Step 1 — as built

- **Runtime** (`src/common/i18n/`): `i18n.ts` holds a `Translator` class (tests build their own
  with fixture catalogs) and the app singleton `translator`, with `t()`, `setLanguage()`,
  `getLanguage()`, `setShowKeys()` and `subscribe()`. `t()` never throws: a key English lacks
  returns the key; a translation that is invalid ICU or fails to format falls back to English; an
  English message that fails to format returns its raw text. Messages are parsed with
  `ignoreTag: true`, so `<none>` is plain text. Formatters are cached per key and cleared on a
  language switch. `resolveLanguage(setting, systemLocale, available)` is pure (no Electron
  import); step 2 passes it the ids from `languages.ts` and `app.getLocale()`/`navigator.language`.
- `useT(translator?)` uses `useSyncExternalStore` on the translator, so it works before the store
  carries the language; step 2 only has to call `setLanguage` when `ide.language` changes.
- `catalogs.ts` imports each namespace file explicitly (the one import form both tsconfig projects
  and all three Vite builds agree on); `i18n:check` fails when a namespace file is not imported.
  `TRANSLATED_CATALOGS` is empty until step 10.
- **Pseudo-locale**: `qps` is generated at run time from English by `pseudo.ts` (on the ICU AST, so
  placeholders, plurals and `#` survive), `setLanguage("qps")` switches to it. There is no
  `i18n:pseudo` script and no `qps/` folder — a checked-in copy could only go stale, and
  `i18n:check` rejects one.
- **Tooling**: `npm run i18n:check` (`scripts/i18n-check.cjs`, chained into `build:check`, so CI
  runs it) and `npm run i18n:keys` (regenerates `keys.generated.ts`, which the check also verifies).
  English rules enforced as errors: dotted key format, no key in two namespaces, a non-empty
  `@key.context` on every entry, valid ICU, and every placeholder described in
  `@key.placeholders` (and nothing extra). `maxChars` counts literal text only: placeholders count
  zero, `#` one, a plural/select its longest branch. `.source.json` maps key → first 12 hex chars of
  the SHA-256 of the English text; a missing or different hash is *outdated* (warning). The check
  prints `<lang>: N % translated (x/y), z outdated` per language — the input to §7's status row.
- Dependencies: `intl-messageformat` 11.2 and `@formatjs/icu-messageformat-parser` (pinned to the
  version `intl-messageformat` uses, so one copy is bundled). 12.x was a month old; revisit later.
- **Tests pin English**: `test/vitest.setup.ts` resets the app translator to `en` and show-keys off
  before every test. Tests: `test/i18n/` (translator, pseudo-locale, `resolveLanguage`, `useT`,
  and the check script against fixture folders plus the real catalogs).
- **Moved to step 2**: pinning `en` in `scripts/doc-shots/` and the `.plans/baseline/` scripts —
  they seed settings, and `ide.language` does not exist until step 2. Seed it there.

### Step 2 — as built

- **Setting ids follow the codebase's groups**, not the `ide.*` names used elsewhere in this plan:
  `ideViewOptions.language` (`"system"` default, or a `languages.ts` id) and
  `ideViewOptions.i18nShowKeys` (boolean). Read `ide.language` / `ide.i18nShowKeys` in this plan as
  these.
- `src/common/i18n/languages.ts`: the table (en, es, pt-BR, pt-PT, de, hu, qps); only `en` is
  `enabled`. `offeredLanguages(devTools)` = enabled languages that have text, plus — in dev builds —
  disabled ones with a catalog and `qps`. `resolveSystemLanguage` takes the first of the OS's
  preferred locales that matches an offered language, never `qps`. An unoffered setting value
  (e.g. `qps` in a release build) behaves as `system`.
- **Main resolves, everyone follows.** `src/main/ui-language.ts` (`createUiLanguageSync`) runs first
  in main's store subscriber: it computes `{ current, system, showKeys, devTools }` from the
  settings, `app.getPreferredSystemLanguages()` (falling back to `app.getLocale()`) and `is.dev`,
  sets main's translator, dispatches `SET_UI_LANGUAGE` into `AppState.uiLanguage`, and on a change
  calls `invalidateMenuCache()`. It re-publishes (`force`) when the emulator window has loaded,
  next to the other start-up dispatches, because a dispatch before the windows exist reaches no
  renderer. Renderers never resolve `system` themselves, so all three processes agree.
- **Renderers**: `installUiLanguageSync(store)` (`src/renderer/core/uiLanguageSync.ts`) is a plain
  store subscriber installed at bootstrap in `main.tsx`, before React renders — so a render after
  the change already formats in the new language (a React effect would let one render run in the
  old one). It also sets `document.documentElement.lang` (the language's `locale`; `en` for `qps`).
- **The Language page** (`settings-pages.ts`, right after General): *Display language* (dropdown:
  "System default (<native name of what system gives>)", then each offered language in its own
  name) and, in dev builds only (row condition `i18nDevTools`), *Show translation keys*. The page's
  texts are the first `t()` users: rows gained optional `groupKey` / `titleKey` / `descriptionKey`
  and pages an optional `titleKey`, read through `settingsRowTitle`/`settingsRowDescription`/
  `settingsRowGroup`/`settingsPageTitle`; step 6 makes the keys mandatory and drops the English
  strings. The search matches the current language **and** English.
- **Deferred**: the *Translation status* row (meaningless until a translation exists — step 10) and
  the *Help translate* button (its target, `locales/README.md`, is written in step 9). Escape hatch
  today: the IDE command `settings language` opens the page; there is no prompt command that writes
  a global setting (`set` writes user/project settings).
- **English pinned**: `scripts/doc-shots/harness.cjs` seeds `ideViewOptions.language: "en"`; the
  `.plans/baseline/` README lists English as a capture condition.
- **Verified in the running app** (Playwright via the doc-shots harness): switching the dropdown to
  `qps` re-rendered the open Settings dialog at once and saved the setting; a fresh start with the
  setting seeded comes up in `qps`. Nothing in the emulator window is translated yet, so only the
  state reaching it is tested (unit), not its picture.
- Tests: `test/i18n/languages.test.ts`, `test/main/ui-language.test.ts`,
  `test/renderer/uiLanguageSync.test.ts`, `test/settings/language-page.test.ts` (including a live
  switch of the Settings view model to `qps`).

### Step 3 — as built

- **185 menu keys** in `en/menu.json`, area-first (`menu.file.*`, `menu.view.*`, `menu.machine.*`,
  `menu.debug.*`, `menu.help.*`, `menu.app.*`, `menu.edit.*`, then per device/machine:
  `menu.tape.*`, `menu.disk.*`, `menu.program.*`, `menu.timex.*`, `menu.z88.*`, `menu.rzx.*`,
  `menu.next.*`). Only the seven menu-bar titles carry `maxChars` (12): submenus size to their
  content, so a long item cannot overflow.
- **Role items carry explicit labels** (Edit, Hide/Hide Others/Show All/Quit, Zoom's Actual
  Size/Zoom In/Zoom Out, File › Exit on Windows / Quit on Linux), worded exactly as Electron's own
  defaults so the English menu is unchanged. Not controllable: the items macOS itself appends to the
  Edit menu (*Start Dictation…*, *Emoji & Symbols*) follow the OS language.
- **Shared option tables** read by the menus *and* the Settings dialog / renderers became keyed
  without touching their consumers: `withLabels` / `labelRecord` (`src/common/i18n/labels.ts`)
  give each item a `labelKey` and a `label` *getter* that calls `t()` when read. Converted:
  `SOUND_LEVELS`, `clockMultiplierLabel`, `MACHINE_DEVICE_MENU_LABELS`, `MOUSE_SENSITIVITIES`,
  `MOUSE_POINTER_DISPLAYS`, `JOYSTICK_SIDE_LABELS`, `JOYSTICK_SOURCES`, the Next's joystick modes.
  Their texts live in `en/common.json` (20 keys). A consumer that copies `label` at import time
  (two `settings-pages.ts` rows map the mouse tables when the module loads) still freezes English;
  step 6 fixes those.
- `HelpLinkInfo` gained `labelKey`; the Z88's help links use it. Machine and model names, the app
  name, recent-project paths, build-task names and the Z88's LCD sizes stay untranslated.
- `createBooleanSettingsMenu` now **requires** a label: a setting's `title` is the Settings
  dialog's English and no longer leaks into a menu (the Fast load checkbox used it).
- **Logs stay English (D9)**: `tEnglish(key)` / `englishLabel(item)` / `englishSide(side)` format a
  message in English whatever the language; the joystick and mouse menu actions log with them.
- The menu rebuilds on a language change by itself (labels are part of the menu signature), and
  `invalidateMenuCache()` from step 2 forces it regardless.
- Tests: `test/main/app-menu-structure.test.ts` builds the whole menu for ten machines/models in
  both windows in `qps` and fails on any label that is not pseudo text (machine names and LCD sizes
  excepted), and checks every role item has a label. Verified to fail when one literal is put back.
- **Verified in the running app** (Playwright, `Menu.getApplicationMenu()`): English labels as
  before; switching to `qps` in Settings rebuilt the native menu at once, every label pseudo text
  except the app name.
- Left for step 4: the `showMessageBox`/`showErrorBox`/file-dialog texts that menu actions open
  (SD-card reset question, TR-DOS errors, picker titles and filters), and `executeIdeCommand`'s
  message titles in `app-menu.ts`.

### Step 4 — as built

- **~95 texts of native dialogs in main** — every `showMessageBox`/`showErrorBox` and the
  titles and file-type filter names of every `showOpenDialog`/`showSaveDialog` (17 files) — now
  come from `en/messages.json` (`messages.<area>.*`) and the shared `en/common.json`
  (`common.button.*`: Yes, No, OK, Cancel, Close, Overwrite, Load…; `common.filter.*`: All Files,
  ROM Files, Tape Files…). Native dialog buttons are passed explicitly, so none falls back to the
  OS language.
- Sentences that were glued together became whole messages: the Timex ROM size error is two
  messages (with and without the HOME/EXROM note), the dropped-file error two (with and without an
  extension), "Could not save/load/open {file}" three.
- Module-level filter lists became functions (`traceFileFilters()`, debug recordings' `filters()`),
  so the filter names are in the language current when the dialog opens.
- **Pass-through stays English for now:** an IDE command's `finalMessage` (step 12), `err.message`,
  and `loadMachineStateFile`'s match on the command text " Use -y to load it anyway." — that regex
  must follow the command's text when step 12 translates it (commented in place).
- Fixed in passing: the Next's SD-card picker was titled "Select Tape File"; it now says
  "Select SD Card Image".

### Step 5 — as built

- `Modal` and `DialogForm` default their buttons through `useT()` (`common.button.ok` /
  `cancel`), and the title bar's X has a translated accessible name. **The default primary button
  now reads "OK"** (was "Ok"); one test followed.
- `PanelFilter` (`controls/data`) translates its accessible names; the eight validators in
  `dialogValidators.ts` return `dialog.validation.*` texts. `EmptyState` has no text of its own.

### Step 6 — as built

- **Every Settings row is keyed**: `SettingsRow` has required `groupKey`/`titleKey` and optional
  `descriptionKey`; the English strings are gone from `settings-pages.ts` and live in
  `en/settings.json` (`settings.<page>.<row>.title|description|option.<value>`,
  `settings.group.*`, `settings.button.*`, `settings.page.*`). A transformer converted the 67 rows
  and generated the contexts from each row's page, group, control kind and help text.
- Option lists: `opts([[value, key | lit("text")]])` — `lit()` marks labels shown verbatim in
  every language (numbers, sizes, `128 MB`, `640 x 64`, product names). Shared tables
  (`ZOOM_STEPS`, `PANEL_/EDITOR_FONT_SIZES`, `ACCENT_MENU_ITEMS`, `MOUSE_*`) became `withLabels`
  tables, and rows read them through `tableOptions(() => …)` so nothing freezes at import.
- `SETTINGS_PAGES` keeps each page's English `title` (the `settings` command's help and the search
  use it) next to its `titleKey`. The search matches the current language **and** English; the
  old-menu paths of `replaces` stay English on purpose ("Was: {path}" is translated).
- **`setting-definitions.ts` titles/descriptions were deliberately not converted**: nothing shows
  them (the dialog uses its rows' texts; menus pass their own labels since step 3). They are marked
  as developer documentation in the file.
- The Settings dialog's own texts (title, Close, Reset Page to Defaults, search box, empty and
  machine notes, file-row placeholders) are translated.
- Test: `test/settings/settings-i18n.test.ts` fails on any page, group, row, help text, choice or
  button that is not pseudo text in `qps` (literals excepted).

### Steps 7–8 — as built

- **Done in parallel by six agents on disjoint files**, each writing its English entries and
  contexts to a staging file that was merged centrally (no clashes). 735 new keys: `dialogs.json`
  (IDE and emulator dialogs, `dialog.<dialog>.*`), `toolbar.json`, `statusbar.json`, and
  `panels.json` (activity bar, side-bar and tool panel titles, document tabs and launch menus,
  Explorer, Open Editors: `panels.*`, `documents.*`, `explorer.*`). 1290 English keys in all.
- **MVC dialogs**: Models are text-free — constants that were English became keys
  (`SjasmplusModel`) or moved to the ViewModel as functions (`titleOf`, `invalidSizeMessage`,
  `exportSuccessMessage`, `ramChangeWarning`, `projectListLabelOf` …); tests followed.
  `UiController` memoizes the view model on state *and* the translator's language, and its
  `subscribe` also listens to the translator, so an open dialog re-words itself on a switch
  (`test/mvc/UiController.test.ts`).
- **Highlighted spans inside a sentence** (Delete/Rename/New Item prompts, the SjasmPlus status
  line, the Output pane's empty-state hints with `<code>`) stay one message: the code formats it
  with marker placeholders and splits on them to put the React nodes back (`richText.tsx`).
- **Registries** (`registry.ts`, `specialDocuments.ts`) use `withTexts` getters; names copied into
  state at open (built-in document names, tool tab names) are re-read from the registry at display
  (`documentDisplayName`), or they would keep the language they were opened in.
- Status-bar texts all carry `maxChars`; the reverse-debugging item (`reverseDebugText.ts`) is whole
  messages joined by a translatable `"{status} · {file}"`.
- **Still English, owned by later steps**: IDE command output and the texts commands share —
  `forkConfirmation`, `historyReasonText`, the snapshot/RZX project guards (step 12; note
  `RzxLaunchMenu` rewrites the snapshot guard with `.replace(/snapshot/g, "recording")`, which a
  translation breaks — give recordings their own guard then), panel content —
  `hardware-specs.ts`, `SPRITE_ATTRIBUTE_LABELS`, NextReg descriptions, Z88 card type names,
  `breakpoint-form.ts` validation, `describeKeyCode` key names (step 11). Detect's
  `NO_COVERAGE_PREFIX` matches an English problem text from `reverse/detection*`: turn it into a
  problem code before translating that text.
- Known gap: the IDE status bar's `statusMessage` label can be cut off and has no tooltip.
- Verified in the running app: started in `qps`, every visible text and tooltip of the IDE chrome
  is pseudo text (a DOM walk found none left), and the Settings dialog renders.

### Step 9 — as built

- **Tooling**: `scripts/i18n-lib.cjs` (shared catalog reading) under `i18n-check.cjs`,
  `i18n-todo.cjs` (`npm run i18n:todo -- <lang> [--ns] [--limit] [--out]`, writes to the
  git-ignored `i18n-work/`) and `i18n-merge.cjs` (`npm run i18n:merge -- <lang> <answer>`: reads the
  first JSON object of the answer, rejects unknown keys, bad ICU and changed placeholders, writes in
  English's order).
- **`.source.json` stores the English text** each translation was made from, not a hash (changed
  from step 1), so `i18n:todo` can show the old English next to the new one for outdated entries.
- **`translations.generated.ts`** is generated (by `i18n:keys` and `i18n:merge`) and imports every
  `<lang>/<ns>.json`; `catalogs-core.ts` holds `Catalog`/`mergeNamespaces` to avoid an import cycle.
  Adding a language needs no TypeScript edit beyond its `languages.ts` row.
- `i18n:check` also warns on Portuguese text using the other variant's words
  (`glossary.json` → `variantOnly`) and reports per-language `{ translated, total, outdated }`.
- **Translator kit**: `locales/README.md` (contributors), `locales/TRANSLATING.md` (the AI prompt),
  `locales/glossary.json` (113 terms × es/pt-BR/pt-PT/de/hu, per-language style decisions,
  do-not-translate list; AI-seeded, `reviewed: false` for every language until a native speaker
  checks it), `.ai/i18n-guide.md` (agents) and an `AGENTS.md` section.
- **Dry run**: followed the README for `hu` on the `menu` namespace — todo (185 entries), an AI
  translation per `TRANSLATING.md`, merge (185 accepted), check (0 errors, no `maxChars` warning),
  and the app: the Hungarian native menu shows, and *Magyar* is offered in the dev build's
  dropdown (`enabled: false` keeps it out of releases). Fixes it led to: the README's PR step now
  lists `.source.json` and `translations.generated.ts`; tests must not hard-code the offered
  languages (two did, and broke when Magyar gained a catalog).

### Step 10 — as built (first translation round)

- **All 1295 English keys translated into es, pt-BR, pt-PT, de and hu** (100 %, 0 outdated) by
  five AI translator agents in parallel, one per language, each following `TRANSLATING.md` and the
  glossary namespace by namespace through `i18n:todo` → answer → `i18n:merge`, then a review pass
  of its whole folder. pt-BR and pt-PT were separate requests, each from English, and neither
  triggers a variant-word warning. **No native speaker has reviewed them yet** — `glossary.json`
  keeps `reviewed: false` per language; each translator's "look at this first" list is below.
- **All five are `enabled: true`.** "System default" now really resolves to them (a German OS
  starts Klive in German); scripts that drive the app and read its English text must seed
  `ideViewOptions.language: "en"` as `scripts/doc-shots/harness.cjs` does.
- **Language page completed (§7)**: a *Translations* row shows "N % translated" (plus "· N entries
  outdated" when some are) for the current language — counted at build time into
  `TRANSLATION_STATUS` in `translations.generated.ts` — and a *Help translate* button (UI action
  `open:translation-guide`) opens `locales/README.md` on GitHub. Rows can now carry a computed
  `describe(env)` help text.
- **English fixed from translators' reports** (they flagged the same entries independently):
  "region(s)" inside plural branches; two browse tooltips that said "Select the root project
  folder" while picking the export / disk-file folder; "Click Ok," in the Z88 RAM warning; and
  Monaco's `boundary` whitespace option, described as "At line boundaries" (it is "All but single
  spaces between words"). Where translators had already rendered the intended meaning,
  `.source.json` was set to the corrected English; the whitespace option went through the outdated
  path (`i18n:todo` showed old English, new English and the current translation; re-merged), which
  proves the update workflow end to end.
- **`maxChars` were too tight** where the extraction agents guessed ~1.4× English: 19 limits were
  raised to fit real translations (breakpoint dialog titles, side-bar headings like *Call Stack*,
  *Watch*, *Breakpoints*, Boriel dialog buttons, …), and three Hungarian texts squeezed into the old
  limits got their proper form back. Limits now reflect five languages, not a guess.
- **Glossary grew to 124 terms** with what translators had to settle on (logpoint, build root,
  release, executable, template, exclude-from-project, frame rate, Open Editors, hit count, Log
  pane, image) and corrections: de *pause* = "pausieren" (it had equalled *stop*), de *unit test* =
  "Unit-Test", pt-PT *watch* = "inspeção". Two variant-only words gave false positives and were
  dropped: "separador" (also a pt-BR word) and "excluir" (pt-PT *exclude*).
- **For native reviewers, first**: the debugger step names (es *Salir* for Step Out equals
  *Salir* for Quit; pt-BR *Intervir/Contornar*; coined reverse-step names), short status-bar tags
  (es/pt "Veloc.", RZX "REPR"/"GRAV"), machine states in the status bar, accent-colour names, the
  breakpoint kinds (de), "Take over here" (pt-BR *Assumir daqui*, pt-PT *Retomar aqui*), and the
  Detect dialog's mode labels.
- **Verified in the running app**, each language launched in turn: the native menu is translated,
  the Language page shows 100 % and the button, and a DOM scan found no clipped text in the IDE
  window or the Settings dialog.

### Steps 11–13 — as built

- **4505 more English keys (5800 in all)**, extracted by fifteen agents on disjoint files in three
  waves — panels (step 11), commands (step 12), compiler messages (step 13), then two cleanup waves
  for the shared `src/common` modules the first wave reported but could not reach. New namespace
  files: `panels-next`, `panels-docs`, `panels-media`, `panels-graphics`, `panels-side`, `emu`,
  `hardware`, `commands`, `commands-debug`, `commands-media`, `compiler`, `compiler-basic`,
  `debug-common`, `graphics-common`, `media-common`.
- **English catalogs are generated too**: `source.generated.ts` imports every `en/<ns>.json`
  (`npm run i18n:keys`), so a new namespace needs no code edit, and each agent could own its
  namespace file and run its tests at once. `i18n:check` accepts an `i18n-dynamic: <prefix>`
  comment for code that builds keys at run time (compiler codes).
- **Step 11 (panels)**: headers, empty states, tooltips, menus, help, column headers that are
  plain words; register/flag/field names, hardware and layer names (ULA, Layer 2, Tilemap,
  Copper), key-cap legends, hex and T-states stay English. **Formatting audit (§4)**: every bare
  `toLocaleString()` (OS locale) is gone — human figures use `uiLocale()` (the display language's
  locale) or ICU `{n, number}`/plurals, invariant data `"en-US"`. File models that word their text
  at load (`tapeView`, `z88SnapshotView`, …) re-parse on a switch because `GenericFilePanel` lists `t`
  in its loader's dependencies; registries and computed diagnostics use getters
  (`withTexts`, `withTranslatedTexts`, `labelRecord`) so values computed before a switch still read in
  the new language.
- **Step 12 (commands)**: every `description` is a getter (`get description() { return t(...) }`);
  ids, aliases, options and echoed syntax stay English. `usage` lines that are pure syntax stay
  English; the explanatory lines inside `usage` (17, e.g. bp-set's "-once: a one-shot breakpoint…")
  are translated — `usage` became a getter there too (`commands-usage.json`). Result, error and
  validation messages, the help command and the argument parser are translated. Machine-parsed output (CSV,
  JSON, `$W:` markers, the CLI) stays as it was.
- **Logic that matched English text was replaced by codes/flags** (the reason this step had to come
  before more languages): `state-load` → `value.needsConfirmation`; debug-recording fallback →
  `value.fallbackRefusal`; Detect `problemCode`; the RZX guard and recording guard `kind`; fork
  confirmation `ForkAction` ids; RZX interrupt `RzxInterruptReason` codes; snapshot
  `isInsidePrefixRefusal()`; tape/Next-layer/sprite/tilemap fields by id instead of English labels;
  Select Machine's media chips from `mediaChips`; `BankBrowser` `itemKind` with whole messages.
- **Step 13 (compiler messages)**: the Z80/6510 assembler catalog (172 codes) and the KSX catalog
  (27) moved to `compiler.json` as ICU, converted mechanically and verified to format identically
  (`assemblerMessage`, `ksxErrorMessage`); Klive BASIC's 192 diagnostics (120 codes) to
  `compiler-basic.json`. **Codes stay visible** ("Z0201: …") in the Output pane and editor markers.
  The compiler worker sets its own translator from `state.uiLanguage`, so background compiles word
  their errors in the display language. All 5239 assembler/KSX and 3713 BASIC tests (corpus
  included) pass unchanged — English is byte-for-byte.
- **Still English on purpose**: NextReg descriptions (hardware reference), sysvar descriptions,
  key-cap names, machine/chip/peripheral names, the joystick-interface names in snapshot headers,
  text written into files (exported source headers, `.defb` comments), `usage` lines, trace and log
  output, `#error`/`#warning` program text, and compiler-bug internals (E599 detail).
- A few English wordings were corrected on the way ("1 call too deep", "0 breakpoints removed",
  "1 cell uses it", "Frame clock", "Klive project", "rolled back to the latest point"); "(s)"
  plurals became ICU plurals except in BASIC diagnostics, where English stays byte-identical and the
  context tells translators to inflect properly.

### Step 10 rerun — after steps 11–13

- **4522 new keys translated into all five languages** (each 5817/5817, 0 outdated, no `maxChars`
  or variant warnings) by one translator agent per language — one per language, never two, because
  two merges into the same language race on its `.source.json`.
- Their reports found English defects and a tooling bug, all fixed: assembler typos (Z0206 "cen",
  Z0313 "less then", Z0321/Z0328 "exceends", Z0410 "overflew"), KSX K014's missing token, a missing
  parenthesis, a doubled "not supported", and **Z0322**, which printed the OS error in place of the
  file name (the call now passes both). `translations.generated.ts` imported hyphenated namespaces
  as invalid identifiers (`de_panels-side`); the generator now sanitises them, with a test.
- Prose lines inside command `usage` (17) were added to the scope and translated (see step 12).
- The glossary has 145 terms; "definições" left the pt-PT-only list (it is also pt-BR).
- Verified: unit tier 877 files / 19,511 tests and e2e tiers 375 files / 7,461 tests green; in the
  running app, in each language, the command help, the Debug side bar and the IDE chrome are
  translated with no clipped text.

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
