# Translating the website

The website's landing page, its chrome (search, menus, notices) and the **Get Started** pages are
translated into every language the Klive app supports. The other documentation stays in English
for now; a translated site links to it, marked "(English)".

This guide is for whoever translates - a person or an AI model. Read the app's guide first,
`src/common/i18n/locales/TRANSLATING.md`: the tone, the glossary (`glossary.json`) and the list of
what is **never translated** (product, machine and hardware names, registers, instructions,
commands, file extensions, keyboard shortcuts) are the same here.

## The workflow

```bash
npm run doc:i18n:todo -- de          # writes i18n-work/docs-de.todo.json
# translate it into i18n-work/docs-de.answer.json
npm run doc:i18n:merge -- de i18n-work/docs-de.answer.json
npm run doc:build && npm run doc:check
```

The todo file lists what is missing or out of date: landing-page texts and chrome texts (each
with its English text and the context it appears in), and whole pages (their English MDX, and
`uiLabels`: the app's own translation of every menu item, button and panel the page names).

The answer is one JSON object with only what you translated:

```json
{
  "landing": { "hero.lead": "..." },
  "ui": { "toc.title": "..." },
  "pages": { "get-started/install": "---\ndescription: \"...\"\n---\n\n# ..." }
}
```

`merge` checks everything before it writes anything for an item. A rejected item is listed with
the reason and stays in the next todo. `merge` also writes the language's navigation
(`docs/content/<lang>/_meta.ts`), so there is nothing else to edit.

## Texts (landing page and chrome)

- Keep every `{placeholder}` exactly as it is. `merge` rejects a text whose placeholders differ.
- Read the context: it says where the text appears and how long it may be.

## Pages

Translate the prose; keep the structure. `merge` compares the translation with the English page
and rejects it unless these are identical:

- **Code blocks**, byte for byte - including the comments in them. The code is the tested program
  the screenshots show.
- **`<Shot>` and `<ClickableImage>` images**: keep `src`, `markers`, `width` and `figure` as they
  are. Translate `alt` and `caption`.
- **Headings**: the same number at the same levels. Translate their text.
- **Links**: keep every URL as it is, including `/en/...` ones. `merge` points links into translated
  areas (`/en/get-started/...`) at your language by itself; links elsewhere stay English on
  purpose.
- **Components** (`<Callout>`, `<Steps>`, `<Cards>`): the same ones in the same order. Translate a
  card's `title` and its text.
- The front matter's `description`: translate it.

Write the UI's words the way the translated app shows them: use `uiLabels`. For example, if the
German app calls **Machine › Start** "Maschine › Starten", the German page says
**Maschine › Starten**. Two exceptions stay English because the app shows them in English: the
items of the **Build** menu (they come from the project's `build.ksx`), and command names typed at
the prompt (`em-start`, `run`).

Keep keyboard keys as they are printed on keyboards: <kbd>F5</kbd>, <kbd>Ctrl</kbd>, <kbd>Shift</kbd>,
<kbd>Enter</kbd>. Keep ZX Spectrum keywords and what the reader types (`PRINT`, `LOAD ""`,
`10 PRINT "hello"`) in English, as the machine does.

For Portuguese, translate `pt-BR` and `pt-PT` separately, each from English.

## Out-of-date translations

`merge` records which English text each translation was made from (`docs/i18n/sources/<lang>.json`).
When the English changes, `doc:i18n:check` warns, `doc:i18n:todo` offers the item again (with your
previous translation), and the page shows a notice that links to the English original until it is
translated again.

## Screenshots

The Get Started screenshots are taken in each language by the doc-shots harness:

```bash
DOC_SHOTS_OUT=docs/public/images node scripts/doc-shots/run.cjs get-started --lang de
```

A page without its own screenshots shows the English ones. See `.ai/doc-screenshots-guide.md`.
