# Instructions for the translator (AI model or person)

You are translating the user interface of **Klive IDE**: an integrated development environment and
emulator for the ZX Spectrum family and related retro computers (ZX Spectrum 48K/128K/+3, ZX
Spectrum Next, ZX80/ZX81, Cambridge Z88, Timex, Commodore 64). Its users are retro-computing
hobbyists and programmers who write Z80 assembly and BASIC. The tone is technical but friendly:
short, plain and precise, like a well-made developer tool.

The request names the **target language** (for Portuguese it names the variant: `pt-BR` *or*
`pt-PT` — never mix them). You receive three things:

1. `<lang>.todo.json` — the entries to translate;
2. `glossary.json` — the term table, the do-not-translate list and each language's style rules;
3. this file.

## Input

`entries` is a list. Each entry has:

| Field | Meaning |
|---|---|
| `key` | The entry's identifier. Copy it exactly. |
| `english` | The text to translate (an ICU MessageFormat message). |
| `context` | Where the text appears and what it does. **Read it before translating.** |
| `maxChars` | Optional. The longest the visible text may be (placeholders count zero). |
| `placeholders` | Optional. What each `{name}` stands for. |
| `status: "outdated"` | The English changed since the last translation. |
| `oldEnglish` / `currentTranslation` | For an outdated entry: the English it was translated from, and that translation. Change the translation only as much as the English changed. |

## Output

Answer with **one JSON object** mapping each key to its translation, and nothing else inside it:

```json
{
  "menu.file.openFile": "…",
  "dialog.delete.confirm": "…"
}
```

After the JSON (outside it) you may list the keys whose context was not enough to choose a
translation, each with one line saying what was unclear. Those become context fixes in English,
which helps every language.

## Hard rules — the build rejects a translation that breaks them

1. **Placeholders are copied byte-exact**: `{name}`, `{count}`, `{file}` keep their names, braces
   and spelling. Never translate a placeholder name. Every placeholder of the English must appear,
   and no new ones.
2. **ICU syntax stays valid.** In `{count, plural, one {# file} other {# files}}` keep `count`,
   `plural`, the `#` and the braces; translate only the text inside the branches. Use the plural
   categories of the **target language** (CLDR): add `few`/`many` where the language needs them,
   and drop `one` where it has none — `other` must always be there. `select` works the same way:
   keep its option names (`select`, the values before each `{`) exactly.
3. A literal `{` or `}` is written `'{'` / `'}'`; keep an English `'` before a brace as it is.
4. Never translate anything on the do-not-translate list in `glossary.json`: product and machine
   names, hardware names (Copper, Layer 2, NextReg, ULA…), CPU register and flag names, Z80
   mnemonics, BASIC keywords, IDE command names and their options, file extensions, keyboard
   shortcuts, hexadecimal values.
5. Keep `...` and `…` where the English has them (an item that opens a dialog), and keep line breaks
   (`\n`, blank lines) in the same places.
6. Respect `maxChars`. Prefer a shorter synonym or an established abbreviation of your language over
   cutting a word. If no translation fits, give the best one anyway and list the key after the JSON.

## Soft rules — what makes it read well

- **Follow `glossary.json`** for every term it lists, so the same thing has the same name
  everywhere. Its `style` entry for your language says how to address the user and how to phrase
  commands; follow it.
- **Capitalization follows your language**, not English Title Case: Spanish, Portuguese and
  Hungarian use sentence case; German capitalizes nouns. Don't capitalize to match English menus.
- **Use the context to pick the right sense**: *Run* a program vs a *run* of tape; *Break* (the key)
  vs a *breakpoint*; *Step* (debugger) vs a *step* of a ladder; *Record* a video vs a *record* (an
  entry); *Reset* a machine vs *reset* a setting to its default.
- **Phrase around placeholders** so no grammatical ending attaches to them. In Hungarian write
  `A(z) {name} fájl törlése?`, never `{name}-t`; in German avoid a case ending on `{name}`.
- **Menu items and buttons are short commands** in the form your language's style entry gives
  (Spanish/Portuguese infinitive, German infinitive at the end, Hungarian nominal form).
- Translate the meaning, not the words. If the English is awkward in your language, say it the way
  a native developer tool would.

## Per-language notes

- **es** — `tú`; sentence case; *archivo*, *carpeta*, *guardar*. Neutral international Spanish.
- **pt-BR** — `você`; *arquivo*, *salvar*, *tela*, *excluir*, *usuário*. Never the European words.
- **pt-PT** — impersonal, no `você`; *ficheiro*, *guardar*, *ecrã*, *eliminar*, *utilizador*;
  `a` + infinitive instead of the gerund (*a carregar*). Never the Brazilian words.
- **de** — `Sie`; nouns capitalized; *Datei öffnen*, *Einstellungen*. German compounds run long:
  check `maxChars` and prefer a shorter word over a hyphenated abbreviation.
- **hu** — impersonal; nominal commands (*Megnyitás*, *Mentés*); suffixes never on placeholders;
  numbers are followed by the singular (*3 fájl*) — the ICU `other` branch takes care of it.
