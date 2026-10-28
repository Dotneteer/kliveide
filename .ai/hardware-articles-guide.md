# Writing "Under The Hood" Hardware Articles

How to write an article that explains how a machine works inside, in the style of the ZX Spectrum Next
screen series (`docs/content/en/under-the-hood/emulator-internals/next-display/`, ten articles, plan
`.plans/NEXT_SCREEN_ARTICLES_PLAN.md`) and its models `spectrum-display.mdx` and `zx81-display.mdx`.
Read this before planning or writing a similar article or series. Every rule below was either a ground
rule of that series or a correction the project author made while reviewing it: the corrections are the
part a new session would otherwise repeat.

This is a standing brief, not a log: when a review teaches a new rule, fold it into the section it belongs
to and replace what it supersedes.

## What the articles are

- **The hardware's view**: how the machine does it, and why it is built that way. Not the programmer's
  how-to (that is the book or the Guides); link there instead of repeating it.
- **Every fact is checked against the reference** (for the Next, the VHDL in `_input/next-fpga/` and its
  `nextreg.txt` / `ports.txt`) before it is written, never from memory or a forum post. Recompute every
  number (clock counts, addresses, encodings) with a script rather than in your head.
- **The article never names its reference.** No VHDL, file names, signal or process names, line numbers,
  quoted source or "the VHDL says", anywhere: text, tables, figures, captions, alt texts. State each fact
  as a fact about the machine. The FPGA as a chip may be named. Klive's own source is named only in "How
  Klive does it". Before publishing, search the page for `vhd`, `VHDL`, `_input`, `next-fpga` and
  `snake_case` names.
- **Where Klive and the hardware differ, fix the core or state the difference.** A core fix is its own
  commit with a `fix` changeset, before the article's commit; the article commit gets an `internal`
  changeset. Existing tests can be blind to a difference (a Radastan test used offset `$0E`, for which
  the right and the wrong rule agree): when a test passes but you doubt it, add a case that tells the two
  rules apart and watch it fail first.
- **Suspect behaviour inherited from another machine's emulator.** A core that grew out of an older one
  can keep that machine's quirks: the Next's port `$FE` bit 6 kept the 48K's analogue EAR decay, which the
  Next's logic does not have, and a parity test pinned it. Check every read-back and timing rule an article
  states against the reference, even where an existing test agrees with Klive.
- **Prove subtle claims on the emulated machine before writing them**, with a checked test (for the Next,
  `test/zxnext-hw/layers/next-display-scene.test.ts`). A claim such as "the left border still counts as
  the line above" gets a test that turns a colour on exactly there. Make the test able to fail: a check on
  a blank dot, or on a pattern that looks the same after the change, proves nothing.
- **Never write about the testing inside an article.** "A test runs all six on the machine" confused the
  reader (which machine? why tests?). One callout near the top may say the pictures come from checked
  tests; nothing else about how the facts were verified belongs in the text.

## Structure

- An **opening hook** (a puzzle or familiar observation), then, **first of all**, a short paragraph on
  why the subject matters in practice (for sprites: why games need them), then the audience and what to
  read first.
- **"How this article is organised"**: a linked list of the Parts, one line each, and "if you read only one
  part" where it fits.
- A `<Callout type="info">` naming the configuration the numbers are for (timing, rate, CPU speed).
- `## Part N: …` with `### …` subsections; short paragraphs; plain words first, the register's name
  second; **bold the one term a paragraph introduces**.
- End with **"How Klive does it"** (the matching code, the IDE view, a "Where to read the code" table)
  and a **Summary**. A series ends with a part that ties all its articles together.

## Explaining

- **Define every term where it is first needed, and say what a phrase means**, not only what it is
  called: "the beam is in the sprite's window" needed its own sentence saying "at the moment the engine
  gets to that sprite, the dot being shown is one of those dots".
- **Name a concept by what it does.** A bare "window" did not bind to anything; "cut-off window" did.
  Avoid words that read two ways: "a sprite may not start in the window" was read as a screen position
  when it meant a moment in time. Say "the engine gets to a sprite" for time, "the sprite's X" for place.
- **Keep space and time apart.** Never put a stretch of the screen and a stretch of time in one
  sentence as if one explained the other (a 38-dot gap next to "26 clocks" invited the comparison).
- **Remind the reader of a symbol when it comes back in a later Part**, in words: not "N6" but "N6, the
  lowest bit of a 4-bit pattern's number".
- **Tricky mechanisms go step by step**: a numbered list of what happens, in order, then one or two worked
  examples with real numbers (clock 1,278, beam at dot 318). Each example gets its own explanation; "the
  same case as before" is not enough.
- **Tables need headers a reader understands on their own.** A two-column table of bare numbers ("1,824 |
  clocks in a line") was unreadable; use a bulleted list of full sentences instead.
- **Be explicit about conditions and edge cases**: what counts as a collision (both dots opaque, the same
  dot, both drawn), when a flag is set and when it is cleared, what happens past the last instruction,
  which values never match.
- **Give practical uses** for modes and options: what each is for in a real program, not only what it
  does. A list with a sentence of application each beat a state diagram.
- **Show real code for effects**: a commented listing (`text` fence), then "how it works" as numbered
  steps or bullets. Check the listing's numbers against the program the test actually runs.
- **Explain why**, briefly: why the hardware is shaped this way, why a list writes in the border of the
  line before instead of at dot 0.
- When an earlier article's fact turns out wrong or too general, correct it in the same change, and link
  rather than repeat.

## Examples and pictures

- **Use one realistic example throughout an article**: a spaceship a game could use, not an "F" borrowed
  from another article, in every Part where a sprite is drawn. Pick colours that do not merge with the
  background (a white paper hid the ship's light hull).
- **Machine pictures are generated, never hand-captured**, by a test that first asserts the dots the
  article describes, and are written only after they were checked by eye. When viewing them, enlarge with
  `sharp(...).resize(w, h, { kernel: "nearest", fit: "fill" })`: without `fit: "fill"`, sharp crops to
  fill and you see only the middle of the picture.
- A picture meant to show a difference must show it: a LoRes/Radastan comparison needs more than 16
  colours in the LoRes picture. If the difference stays small, say so honestly in the text.

## Figures

- **Place a figure right after the sentence that introduces it**, then explain it. Never several
  paragraphs of explanation followed by the figure.
- **Every figure must help.** One that does not (a mode state diagram) is replaced by a list; two figures
  showing the same cases twice are merged; a figure with two cases is split into two figures, each with a
  one-line lead-in.
- Inline `<figure><svg viewBox="0 0 700 H" role="img" aria-label="…" style={{ width: "100%", maxWidth:
  "700px", height: "auto" }}>` with a `<figcaption>`; the `aria-label` describes the figure fully.
  Neutral strokes and text in `currentColor`; highlight colours `#e8912d` orange, `#3b82f6` blue,
  `#a855f7` purple, `#30a46c` green, `#e5484d` red. One colour per subject across a series (for the Next:
  ULA/LoRes blue, Layer 2 orange, tilemap green, sprites purple, border grey, winner/transparency marks
  red).
- Draw to scale where scale carries meaning, and say so. Put two things on one scale when the reader
  must line them up (a picture and the beam's timeline under it, dot 320 on both).
- **Make close-ups big**: a magnified detail takes most of the figure's width.
- **Contrast**, checked in light and dark mode in the browser, zoomed in:
  - no red on red or pink, no label on a coloured band;
  - marks drawn over a picture: a white outline with a dark core (or the reverse), which shows on any
    background in both themes;
  - fine grid or dashed lines over a picture in white, clearly visible; lines inside a key in white;
  - labels must fit their boxes and the viewBox; split long labels into explicit lines.
- Generate figures with coordinates from a small script (scratchpad) when they are to scale or have many
  parts; edit the generator, not the generated MDX, and regenerate.

## Wording rules of the Next series

- A register is always a register: "NextReg `$15`", its bits "NextReg `$15` bits 4–2", a port "port
  `$123B`". The first mention in each Part gives the official name from the register list ("the Sprite and
  Layers System register, NextReg `$15`"); after that "NextReg `$15`". A bare hex number is a value.
  Never invent an official name you cannot cite.
- Relaxed and direct, never chatty.

## Mechanics

- Pages and links: absolute links (`/en/...`); a page not yet written is mentioned in plain text, and
  linked once it exists, so search the series for "article N" and "the X article" after each new page.
  Check every anchor against the built HTML ids (`docs/out/.../index.html`), not a hand-made slug rule.
- A new page updates its folder's `_meta.ts`, `.plans/docs-routes.golden.txt` and
  `.plans/docs-assets.golden.txt` (sorted), and the plan's status with an "As built" note of the facts
  the article established.
- Verify with `npm run doc:build && npm run doc:check`, then look at every figure in the browser
  (`docs-serve` preview) in both colour schemes. After a series is finished, re-check all cross-links and
  every fact more than one article states.
