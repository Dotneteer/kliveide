# Localization: rules for changing Klive's code

Every user-facing text in Klive goes through the translator. This is the short version for agents
writing code; the plan and its "as built" notes are `.plans/LOCALIZATION_PLAN.md`, and the guide for
translators is `src/common/i18n/locales/README.md`.

## The rules

1. **New user-facing text goes through `t()`.** Add the English to the right
   `src/common/i18n/locales/en/<namespace>.json` with an `@key` entry holding a `context` — where it
   appears, which control, what it does, anything easy to misread. Run `npm run i18n:keys` (it
   regenerates `keys.generated.ts`, so a misspelt key is a type error) and `npm run i18n:check`.
   `build:check` runs the check too.
2. **Keys are dotted and area-first** (`menu.file.openFile`, `dialog.newProject.title`,
   `settings.editor.tabSize.title`), never the English text. Reuse `common.button.*` /
   `common.filter.*` for OK/Cancel/Close/Yes/No and file-dialog filters.
3. **Whole messages with placeholders, never concatenation** (`"Delete {name}?"`, not
   `"Delete " + name + "?"`). A conditional fragment becomes two whole messages. Plurals use ICU
   (`{count, plural, one {# item} other {# items}}`), never `n === 1 ? … : …`. Describe every
   placeholder in `@key.placeholders`.
4. **Keys at definition, text at display (D7).** Never call `t()` at module load. A module-level
   table or registry stores keys; when consumers read `.label`/`.title` directly, wrap it with
   `withLabels` / `labelRecord` / `withTexts` from `@common/i18n/labels` (getters that translate on
   each read). A filter list or option list built once is a function, not a constant.
5. **React components that render text call `const t = useT()`** (`@common/i18n/useT`), so they
   re-render when the language changes. Non-React code calls `t()` at display time.
6. **MVC dialogs** (`.ai/ui-mvc-guide.md`): Models stay text-free; `t()` goes in the View or the
   ViewModel selector. Store keys/arguments in state, format at display.
7. **Add `maxChars`** to anything in a status bar, toolbar, tab, button, menu-bar title or narrow
   column. Status bars are one `nowrap` line; give long items a tooltip with the full text.
8. **Commands**: `description` is a getter returning `t(...)`; in `usage`, a pure syntax line
   (`bp-set <address-spec> [-r] …`) stays English, an explanatory line (`-once: a one-shot …`) is a
   translated message — make `usage` a getter then. Never match a command's message text in code:
   return a code/flag in the result's `value`.
9. **Not translated (D9):** mnemonics, register/flag names, NextReg names, directives, BASIC
   keywords, IDE command names and syntax, machine/model names, file extensions, accelerators,
   log/trace/console output (use `tEnglish()` when a log line reuses a translated label), external
   compiler output, the docs site. Settings' `setting-definitions.ts` titles are developer docs, not
   UI text.
10. **Never write translations for other languages** as part of a feature change. New English is
   picked up by `npm run i18n:todo -- <lang>` in the next translation round (`README.md` §3–4).
11. **Tests pin English** (`test/vitest.setup.ts`), so English assertions keep working. To check a
    new screen for missed text, switch to the pseudo-locale: `setLanguage("qps")` in a test, or in a
    dev build `ideViewOptions.language: "qps"` in the settings file (the Language dropdown does not
    list it; `scripts/doc-shots/harness.cjs` takes `ideViewOptions`) — anything not `[Åççéñţéð~~]` was
    missed. `test/main/app-menu-structure.test.ts` and `test/settings/settings-i18n.test.ts` do this
    for the menus and the Settings dialog.
12. **Tests never hard-code the list of offered languages.** A disabled language appears in dev
    builds as soon as it has a catalog (Hungarian's menu catalog did exactly that in the step 9 dry
    run and broke two tests); read `offeredLanguages()` / `LANGUAGES` instead.

## Where things are

| | |
|---|---|
| `src/common/i18n/i18n.ts` | `t`, `tEnglish`, `setLanguage`, the `Translator` |
| `src/common/i18n/useT.ts` | the React hook |
| `src/common/i18n/labels.ts` | `withLabels`, `labelled`, `labelRecord`, `withTexts`, `englishLabel` |
| `src/common/i18n/languages.ts` | the language table (add a row to add a language) |
| `src/common/i18n/locales/en/*.json` | English + context |
| `scripts/i18n-check.cjs`, `i18n-todo.cjs`, `i18n-merge.cjs` | the tooling |
