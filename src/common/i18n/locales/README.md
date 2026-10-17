# Translating Klive

Klive's menus, dialogs and panels can be shown in other languages. This folder holds every text of
the user interface, one folder per language. This guide is for anyone who wants to **fix a
translation** or **add a language**, by hand or with an AI model.

You need Node.js and a clone of the repository. Run `npm install` once.

## 1. How Klive's text works

- `en/` is the **source**: every English text, and next to each one its **context** — where it
  appears, what it does, how long it may be. Read the context before translating anything.
- Every other folder (`es/`, `de/`, `hu/`, …) holds only translations: `"key": "text"`. A text
  missing from a language shows in English, so a partial translation is always safe.
- `<lang>/.source.json` remembers which English text each translation was made from, so Klive knows
  when the English changed and the translation is *outdated*.
- `glossary.json` is the term table every language follows, plus the list of what is **never
  translated**: product and machine names, hardware names (Copper, NextReg, ULA…), CPU registers,
  Z80 instructions, BASIC keywords, IDE command names, file extensions, keyboard shortcuts. People
  type and search for these, so they stay as they are in every language.
- Messages use [ICU MessageFormat](https://unicode-org.github.io/icu/userguide/format_parse/messages/):
  `{name}` is a placeholder; `{count, plural, one {# file} other {# files}}` is a plural.
- The languages Klive knows are listed in `../languages.ts`. A language with `enabled: false` is not
  offered to users yet, but development builds list it as soon as it has a translation.

## 2. Fix a translation

1. Find the text's key. In a development build (`npm run dev`), open **Settings › Language** and
   turn on **Show translation keys**: every text then shows its key, e.g. `menu.file.openFile`.
   (Or search the language's files for the wrong text.)
2. Edit the text in `<lang>/<namespace>.json` — the namespace is the file whose name matches the
   key's area (`menu.file.openFile` lives in `menu.json`; `en/` shows where).
3. Run `npm run i18n:check`. It must report `0 error(s)`.
4. Open a pull request. Say what was wrong and, if you can, show a screenshot. (A fix made by
   hand leaves `.source.json` alone, so the check does not call it outdated; a fix of an outdated
   entry goes through `i18n:todo` / `i18n:merge`, section 4.)

A small fix needs nothing else. If you fixed a term, also fix it in `glossary.json` so the next
translation round keeps it.

## 3. Add a new language

1. **Register it.** Add a row to `src/common/i18n/languages.ts`: its id (`it`, `fr`, `pt-BR`…), its
   name in itself (`Italiano`), its English name, its ICU locale, and `enabled: false`.
2. **Add a glossary column.** In `glossary.json`, add your language's id to every term in `terms`
   and a `style` entry: how to address the user, how menu commands are phrased, capitalization.
   Ask an AI to draft it from the other columns, then correct it yourself.
3. **Get the work list.** `npm run i18n:todo -- <lang>` writes `i18n-work/<lang>.todo.json`: every
   entry still to translate, with its context. For smaller batches add `--ns menu` (one area) or
   `--limit 200`.
4. **Translate.**
   - *With an AI model:* give it `TRANSLATING.md`, `glossary.json` and the todo file, and ask:
     "Translate this file into <language> (<lang>), following TRANSLATING.md." For Portuguese, name
     the variant (`pt-BR` or `pt-PT`) and translate each variant in its own request, from English.
     Save the answer to a file, e.g. `i18n-work/<lang>.answer.json`.
   - *By hand:* write a JSON object `{ "<key>": "<translation>" }` with the entries you translated.
5. **Merge it.** `npm run i18n:merge -- <lang> i18n-work/<lang>.answer.json`. Entries with broken
   placeholders or ICU syntax are rejected and listed; they stay in the next `i18n:todo`. The merge
   creates the language's files and wires them into the app — no code to edit.
6. **Check it.** `npm run i18n:check` must report `0 error(s)`. Look at its warnings for your
   language: `maxChars` (text that may not fit) and, for Portuguese, words of the other variant.
7. **Look at it in the app** (`npm run dev`, then Settings › Language): open the screens in
   the review checklist below.
8. **Enable it** when it is ready (roughly 60 % or more): set `enabled: true` in `languages.ts`.
9. Open a pull request with the language folder (including `.source.json`), the glossary column,
   the `languages.ts` row, and `src/common/i18n/translations.generated.ts` — the merge regenerated
   it, and `npm run i18n:check` (CI) fails when it is out of date. Don't commit `i18n-work/`.

## 4. Update after the English changed

`npm run i18n:check` lists translations as *outdated* when their English changed. Run
`npm run i18n:todo -- <lang>` again: outdated entries come with the old English, the new English
and the current translation, so only the change needs translating. Merge the answer as in step 5.

## 5. Review checklist (before the pull request)

- [ ] `npm run i18n:check` shows `0 error(s)`.
- [ ] You read the `maxChars` warnings for your language and shortened what you could.
- [ ] In the app you looked at: the menu bar and its menus, the **status bars** of both windows,
      the **toolbars' tooltips**, the **Settings dialog** (page list and a long page), a dialog with
      several buttons (New Project, Export Code), the Explorer's context menu.
- [ ] Glossary terms are used the same way everywhere.
- [ ] Capitalization follows your language, not English Title Case.
- [ ] Nothing on the do-not-translate list was translated.

## 6. Troubleshooting

- **Klive starts in the wrong language.** It follows **Settings › Language › Display language**;
  *System default* means the operating system's language. The IDE command `settings language`
  opens that page even when you cannot read the menus.
- **A raw key shows on screen** (`menu.file.openFile` instead of text) while *Show translation keys*
  is off: the key is missing from English — a bug in Klive's code. Please report it.
- **A plural looks wrong** (`1 files`): check the `plural` branches against your language's
  categories (`one`, `few`, `many`, `other`).
- **A character shows as a box**: the font lacks it. Report it with the language and the screen.
- **`i18n:check` says a placeholder differs**: a `{name}` was translated or misspelt. Copy the
  English placeholders exactly.
