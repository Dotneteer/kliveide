# Monaco Syntax Palette — Revision Plan

**Status: implemented.** Candidate **B (Spectrum Warm)** chosen by the author and shipped.
See the retrospective at the end for what changed during implementation.
**Preview:** the candidate preview page was a temporary artefact and has been deleted. The values
that mattered are recorded below (§3), and the shipped palette lives in `SYNTAX_HUES` in
`src/renderer/theming/tokens/syntax.ts`.

> **Process:** this plan supersedes §8.1 of `.plans/UI_MODERNIZATION_PLAN.md`. If the two disagree,
> this file wins. Amend this file in place as it is implemented, and write a retrospective at the end
> the way the modernization plan does.

---

## 1. The problem, and how it happened

Phase 8 replaced 146 hand-copied colour literals across seven language providers with a generated
palette that follows the active accent. The generation works. The *scheme* it generates is wrong.

**Evidence.** The palette Klive had before Phase 8 used 19 distinct colours across the two tones —
roughly ten per tone, spanning green, blue, magenta, gold, teal, cyan and tan. The Phase 8 palette
has eleven classes of which **nine are lightness/saturation steps of a single hue** (the accent),
plus a green for strings and a red for errors. Measured from the running editor under Sinclair Blue:

| class | Phase 8 colour | |
|---|---|---|
| keyword | `#60B2EA` | blue |
| label | `#339CE4` | blue |
| type | `#4A98CD` | blue |
| number | `#5490B8` | blue |
| function | `#7CC4F0` | blue |
| directive | `#949AA4` | grey |
| punctuation | `#949AA4` | grey |
| **comment** | **`#7F8690`** | **grey** |
| operand | `#E4E6EA` | near-white |

**Why it happened.** §8.1 of the modernization plan specified the scheme as steps of the accent ramp
("keywords step 9–10, numbers step 11 desaturated, labels step 8"). It optimised for *coherence with
the accent*. That was the wrong objective: syntax highlighting exists so a reader can separate token
classes at a glance, and hue is by far the strongest channel for that. Lightness steps of one hue are
the weakest possible encoding. When the author reported the editor looked "boring and less useful",
the assistant initially defended the result as the design's stated intent — the retrospective in
`UI_MODERNIZATION_PLAN.md` under "Phase 8" records this. Both the spec and the defence were wrong.

**The specific complaint to fix first:** grey comments. Comments are the largest body of prose in a
source file; rendering them in neutral grey makes them read as disabled UI rather than as authored
text.

## 2. Design principles for the replacement

1. **Hue carries class.** Adjacent classes must differ in hue, not only in lightness. Lightness and
   weight are secondary channels.
2. **Comments are coloured and italic — never neutral grey.** Enforced by a test (§5).
3. **The accent still anchors the editor.** The **keyword/mnemonic** colour remains the active
   accent, so switching accent visibly re-tints the editor and the app stays coherent. Every other
   class takes a fixed hue per tone. This keeps the accent meaningful *and* makes legibility
   independent of which of the six accents is active — the previous scheme had to work for twelve
   accent × tone combinations, which is what pushed it toward monochrome in the first place.
4. **Errors are never the accent, and never a syntax hue.** `--status-error`, always.
5. **Contrast floor stays 4.5:1** against the editor background (3.5:1 for comments), measured, not
   eyeballed.
6. **Grammars are untouched.** Only the token-name → colour mapping changes. No Monarch rule moves.

## 3. Candidates — the decision to make

All three were rendered against real Z80 source in dark and light with a contrast reading for every
colour, and reviewed by the author. Keyword = the accent in all three. The full values are recorded
here because the preview page they were shown in was temporary and has been deleted.

| | Character | Comments | Numbers | Strings |
|---|---|---|---|---|
| **A. Klive Classic+** | The scheme Klive had before Phase 8, re-grounded on the new neutrals. Familiar to any VS Code user. | `#6A9955` green | `#B5CEA8` pale green | `#CE9178` salmon |
| **B. Spectrum Warm** | Widest hue spread. Numbers moved to lavender so they can never blur into comments. | `#5FB37A` green | `#C0A6F5` lavender | `#E0906A` salmon |
| **C. Phosphor** | Higher saturation, closer to a period machine. | `#79B851` olive-green | `#7FD6C4` mint | `#E8A33D` amber |

<details><summary>Full candidate values (A and C were not chosen; B shipped, with its light blues
corrected — see §9)</summary>

| class | A dark | A light | B dark | B light | C dark | C light |
|---|---|---|---|---|---|---|
| comment | `#6A9955` | `#237122` | `#5FB37A` | `#1F7A44` | `#79B851` | `#3F7A1E` |
| directive | `#C586C0` | `#AF00DB` | `#D68FE6` | `#9B2FB4` | `#E284D8` | `#A32BA0` |
| label | `#DCDCAA` | `#795E26` | `#E8C56B` | `#8A6A00` | `#F0C674` | `#8A5A00` |
| operand | `#9CDCFE` | `#0089BA` | `#A8D8F0` | `#0F6E93` | `#8FD1F5` | `#116C90` |
| number | `#B5CEA8` | `#2E7D32` | `#C0A6F5` | `#6340C8` | `#7FD6C4` | `#0E7A6A` |
| string | `#CE9178` | `#A31515` | `#E0906A` | `#B4551F` | `#E8A33D` | `#9C5A00` |
| type | `#4EC9B0` | `#267F99` | `#4ECFB0` | `#1A7F72` | `#5FD3A8` | `#12796A` |
| function | `#4FC1FF` | `#007ACC` | `#6FD3FF` | `#0B78C6` | `#63E0E0` | `#0F6FA8` |
| punctuation | `#B4BAC4` | `#565C65` | `#B4BAC4` | `#565C65` | `#AEB4BE` | `#565C65` |

B's `light` `operand` and `function` above are the values **as proposed**; both were wrong and were
corrected to `#3E4C54` and `#0A4E7A` during implementation (§9).

</details>

**Chosen: B.** (Recommendation at the time, and the author's pick.) A's only real flaw is that its comment green and number green are neighbours,
which is exactly the "two classes that blur" problem this revision exists to remove — VS Code gets
away with it because comments are italic and numbers are short, but Z80 source is dense with
literals. C is attractive but its saturation makes long comment blocks loud. B keeps A's familiarity
while giving numbers their own hue.

Choosing a candidate is the only blocking decision. Mixing is fine — e.g. "B, but C's amber strings".

## 4. Implementation

All changes are in one module plus its test.

### 4.1 `src/renderer/theming/tokens/syntax.ts`

- Replace the derived-ramp body of `syntaxPalette(tone, accentId)`. Keep the signature, the
  `SyntaxClass` union, `TOKEN_CLASSES`, `syntaxRules`, `editorColors` and the colour maths
  (`contrastRatio`, `ensureContrast`, `relativeLuminance`) exactly as they are — they are correct and
  tested.
- Structure it as a `SYNTAX_HUES` constant holding the chosen candidate, then `syntaxPalette`
  supplies `keyword` from the accent and runs every value through `ensureContrast` against
  `editorBackground(tone)`.
  **As implemented:** the table is typed `Record<Tone, Record<Exclude<SyntaxClass, "keyword" |
  "error">, string>>` — both of those classes are supplied rather than tabled, so leaving them in the
  table would invite them being edited there and silently ignored. Each value also passes through
  `ensureDistinct` *before* contrast, which holds it clear of the accent-driven keyword (see §9).
- Keep `error` sourced from `STATUS[tone].error` rather than from the hue table, so it cannot drift.
- Keep the `fontStyle` handling: `keyword` bold, `comment` italic, and the `TOKEN_FONT_STYLE`
  overrides (`macroparam` italic, `macro` bold italic, `statement` bold).

### 4.2 Nothing else needs to change

`monacoBootstrap.defineLanguageThemes` and `MonacoEditor.tsx` already re-define and re-apply themes
on tone/accent change. The seven providers already carry empty override slots. Do not reintroduce
literals into them.

## 5. Tests

`test/theming/syntax-palette.test.ts` — keep all six existing cases, then:

- **Amend** `"does move the keyword colour with the accent"`: still true, and still the point.
- **Amend** the adjacency test to compare perceptually, not by inequality. Two colours 4° apart pass
  a `!==` check and are indistinguishable on screen; that is how the superseded scheme passed its own
  test.
  **As implemented:** hue alone turned out to be the wrong measure — the accent is a blue, so
  keywords, operands and functions are legitimately one hue family separated by lightness and chroma.
  The test uses `colourDistance` (CIE76 dE, exported from `syntax.ts`) with a floor of 20 over the
  co-occurring pairs, **plus** a second case asserting every class is clear of the keyword for all
  six accents — which is what the `ensureDistinct` mechanism actually guarantees.
- **Add** `"comments are coloured, not grey"`: assert the comment colour's HSL **saturation** is
  above a floor (≈0.15) in both tones. This is the author's complaint expressed as a property, and it
  is the one test that would have caught the original regression.
- **Add** `"the palette uses a spread of hues"`: bucket the non-error classes into 30° hue bins and
  assert at least **five** distinct bins per tone. The Phase 8 palette scores two.

Keep the contrast test unchanged — it is what makes any candidate safe to ship.

## 6. Verification

Automated gates cannot see this. Verify by eye and by DOM, in that order.

```bash
# type-check (build:check is a no-op — see AGENTS.md)
npx tsc --noEmit -p build/tsconfig.web.json | grep -c "error TS"   # baseline: 166
npx vitest run --config build/vitest.config.ts --project='!perf' --silent   # baseline: 19714 passed
npx electron-vite build --config build/electron.vite.config.ts
```

Then run the app and read the actual colours out of the editor:

```bash
npx electron-vite dev --config build/electron.vite.config.ts --remoteDebuggingPort=9222
# open a .kz80.asm document, then:
node .plans/baseline/drive.mjs ide "(()=>{
  const g=(t)=>{const s=[...document.querySelectorAll('.view-line span span')]
    .find(x=>x.textContent.trim()===t); return s?getComputedStyle(s).color:null;};
  return JSON.stringify({ld:g('ld'),Message:g('Message'),hex:g('#7C00'),a:g('a')});
})()" -
```

Switch accent through the app's own menu to confirm keywords re-tint and nothing else moves — the
one-script recipe is in `.ai/ui-theming-intent-and-lessons.md` under *Operational Knowledge*.
**Restore the author's accent (Ultraviolet) and theme afterwards.**

## 7. References a fresh session needs

**Read first**

- `AGENTS.md` — repo rules, and the `build:check` no-op warning.
- `.ai/ui-theming-intent-and-lessons.md` — token architecture, the five mandates, how to run and
  inspect the app, and the method lessons from Phases 0–9.
- This file.

**Code**

| Path | Why |
|---|---|
| `src/renderer/theming/tokens/syntax.ts` | The only file that must change. |
| `test/theming/syntax-palette.test.ts` | The gate; §5 lists the amendments. |
| `src/renderer/theming/tokens/palette.ts` | `NEUTRAL`, `ACCENTS`, `STATUS`, `DEVICE`, `DEVICE_INK`. |
| `src/common/theming/accents.ts` | `ACCENT_IDS`, `DEFAULT_ACCENT`. Sinclair Blue is the default. |
| `src/renderer/features/editor/monaco/monacoBootstrap.ts` | `defineLanguageThemes` — re-definable themes. |
| `src/renderer/features/editor/monaco/MonacoEditor.tsx` | Re-defines on tone/accent change **and** in `onMount`. Both are load-bearing. |
| `src/renderer/appIde/project/*LanguageProvider.ts` | Seven grammars. Their theme blocks are **empty override slots** for `customTokenLoader`; do not put colours back in them. |
| `src/renderer/appIde/project/customTokenLoader.ts` | User overrides from `<languageId>.tokens.json`, merged after the generated rules. |

**Background**

- `.plans/UI_MODERNIZATION_PLAN.md` §8.1 — the superseded spec, and the Phase 8 retrospective
  describing what shipped and why.
- The candidate values are in §3; the shipped table is `SYNTAX_HUES` in `syntax.ts`. If new
  candidates are ever wanted, the fastest way to see them is to edit `SYNTAX_HUES`, run the app, and
  read the colours out of the editor with the probe in §6 — the temporary preview page that was used
  the first time round has been deleted.

**Facts worth not rediscovering**

- Monaco resolves a theme rule by **longest matching token prefix**, so `number.hex` inherits
  `number`. The `.invalid` variants are mapped explicitly to `error` for this reason.
- Monaco wants **bare hex, no `#`**, in theme rules.
- `defineTheme` is idempotent by name; changing a theme's contents without changing its name requires
  an explicit `monaco.editor.setTheme` afterwards, because React will not re-apply an unchanged
  `theme` prop.
- The editor background is `NEUTRAL[tone].canvas` via `editorColors`, not Monaco's `#1e1e1e`.

## 8. Out of scope

- The other five accents. Get Sinclair Blue right first; the other five inherit the same hue table
  and differ only in the keyword colour, so they need a contrast pass (automatic) and a look (cheap),
  not a redesign.
- Semantic-token colours beyond the Monarch classes.
- The `$` vs `#` hex prefix — settled, both are valid; see `controls/data/index.tsx`.


---

## 9. Retrospective *(2026-09-07)*

19716 tests pass (3 new, 1 amended), build green, `tsc` unchanged at 166. Candidate B shipped.

**The result.** Six clearly distinct colours where the previous scheme had effectively two: comments
green **italic**, labels gold, mnemonics the accent in bold, directives magenta, numbers lavender,
operands pale blue. Hue-bin count went from 2 to 8.

**Two defects found during implementation, both by measurement rather than by eye.**

1. **My own light values for B were broken.** Measuring hue separation showed
   `light: keyword/function` at **0 degrees apart and 0.03 apart in lightness** — the same colour,
   separated only by the keyword's bold weight. That is precisely the bug Phase 8 had, reappearing in
   the candidate I generated. On a dark ground the keyword/operand/function blues separate by
   lightness (0.59 / 0.72 / 0.80) and read fine; on white that trick is unavailable, because lighter
   also means lower contrast. Fixed by taking `function` clearly darker (`#0A4E7A`) and making
   `operand` a near-neutral slate (`#3E4C54`) — the light-tone equivalent of dark's plain-reading
   pale operand. The preview page was regenerated so the artefact shows what shipped.

2. **The fixed-hue table collides with accents, and it collided with the author's own.** With
   Ultraviolet the keyword is `#6340C8` in light — *exactly* the lavender the table assigns to
   numbers. dE 0. A fixed table cannot anticipate six accents, so `ensureDistinct` now pushes any
   class clear of the keyword before contrast is applied, moving **lightness** in the same direction
   `ensureContrast` already moves so the two do not fight. Hue is left alone, which keeps a lavender
   recognisably lavender rather than rotating it into a neighbouring class. Result under Ultraviolet:
   numbers become `#412b8d`, still lavender, dE 22 from the keyword.

**The test that mattered was the one that changed metric.** The old adjacency test asserted `!==`,
which two colours four degrees apart satisfy — that is *how* the all-one-hue scheme passed its own
suite. Replacing it with a perceptual distance (`colourDistance`, CIE76 dE) caught both defects
above within seconds of being written. The lesson generalises: **when a test's job is "a human can
tell these apart", assert a perceptual property, not an identity.**

**Three guards now exist that would have prevented the original regression:**

- `comments are coloured rather than greyed` — a saturation floor. The author's complaint as a
  property; `--text-tertiary` scores ~0.07 against a floor of 0.15.
- `spreads the palette across the colour wheel` — at least 5 of 12 hue bins, ignoring near-neutrals.
  The superseded scheme scores 2.
- `holds every class clear of the accent-driven keyword colour` — all classes, all six accents.

**All six accents were then reviewed in the running editor, and the result accepted as is.**
Screenshots of each, same file, switched through View -> Accent. Four are comfortable. Two have a
pairing that clears the guard but reads tighter than the rest:

| accent | tight pair | dE dark / light | why |
|---|---|---|---|
| Ember | keyword / label | 27 / 23 | both gold; labels are pushed to a pale cream |
| Phosphor Green | keyword / comment | 37 / 22 | both green |
| Deep Teal | keyword / comment, keyword / operand | ~30 | teal sits between the green and the blue |

**The author's decision: leave it.** All six clear the floor, and bold-versus-italic plus lightness
do real work; the two tight pairs are the accents furthest from the default. Do not "fix" this
without being asked.

**A limit in the metric, recorded so it is not mistaken for a clean bill of health.** CIE76 weights
lightness heavily, so two greens differing mainly in lightness score 37 and pass comfortably while
still reading as one colour family. `colourDistance` is a large improvement on the `!==` it replaced
and it caught two real defects, but it does not model hue-family similarity — which is exactly what
makes the Ember and Phosphor Green pairs feel tighter than their numbers suggest. If this is ever
revisited, the options considered were: raise `MIN_CLASS_DISTANCE` from 22 to ~30 (one constant,
distorts those two palettes further), or add a hue-family rule for comments specifically (targeted,
but needs somewhere to shift to — teal collides with `type`, olive moves toward Phosphor Green).
