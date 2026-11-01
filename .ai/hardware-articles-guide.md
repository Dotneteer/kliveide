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
- **Every fact is checked against the reference** (for the Next, the VHDL in `vendor/next-fpga/3.02.01/` and its
  `nextreg.txt` / `ports.txt`) before it is written, never from memory or a forum post. Recompute every
  number (clock counts, addresses, encodings) with a script rather than in your head.
- **The article never names its reference.** No VHDL, file names, signal or process names, line numbers,
  quoted source or "the VHDL says", anywhere: text, tables, figures, captions, alt texts. State each fact
  as a fact about the machine. The FPGA as a chip may be named. Klive's own source is not named in a
  chapter about the hardware. Before publishing, search the page for `vhd`, `VHDL`, `_input`, `next-fpga` and
  `snake_case` names.
- **Where Klive and the hardware differ, fix the core.** The chapters describe the machine, not Klive, so a
  difference is no longer stated in the text: it is fixed, or recorded in the core's own README. A core fix is its own
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
- **When a capture test fails, find out whether the machine or your expectation is wrong before changing
  either.** An AY chord test failed because it assumed a channel with tone and noise off is silent; it plays
  its volume as a steady level. The expectation was wrong, and the finding became a point in the article.
- **A hanging label belongs to the next instruction, even across an `.org`.** In Klive's assembler, `End:` alone
  on a line followed by `.org $C000` takes the value `$C000`, so `ld b,End-Start` in a scene program counted 234
  bytes instead of 16 and the DMA ran garbage. End a block's label on the same line as its last byte, or write
  the length out.
- **Never write about the testing inside an article.** "A test runs all six on the machine" confused the
  reader (which machine? why tests?). One callout near the top may say the pictures come from checked
  tests; nothing else about how the facts were verified belongs in the text.

## Structure

The articles are also meant to be printed as a **book for engineers**: each article is a chapter, and a
topic such as Sound or Screen is a part of the book that groups its chapters. The project author set the
rules below on the TurboSound chapter (`next-audio/turbosound.mdx`, the model), and every Next chapter
now follows them, text and figures: Sound (`computer-sound.mdx`, `next-audio/`) and Screen
(`next-display/`). The other machines' pages (`spectrum-display.mdx`, `zx81-display.mdx`, `crt-display.mdx`,
...) still follow the old shape (`## Part N`, a linked list of Parts, a bulleted Summary, small figures)
until they are reworked. A new chapter starts in the new shape.
- **Vary the conversational openers across chapters.** Read as a book, the same line in every chapter
  becomes a tic: "So, what have we got?" once opened 16 closing retellings and "Hey, notice" sat in 12
  chapters, and "my friend" ended three. Use each such phrase in a few chapters at most, and give each
  closing its own first line.

- **The title names the chapter's subject, without the machine** ("TurboSound: Three AY Chips Behind Two
  Ports", not "ZX Spectrum Next: TurboSound Next"): the book's part says which machine. Specific enough to
  stand in a table of contents beside its neighbours.
- An **opening hook** (a puzzle or familiar observation), then, **first of all**, a short paragraph on
  why the subject matters in practice (for sprites: why games need them), then what to read first, as
  "the previous chapter" or by title, not "article N".
- **An opening overview** under an inviting heading of its own ("The road ahead", not "What's in this
  chapter"): a short flowing paragraph that walks through what follows in order and says where the key idea
  is, **with no links and no list**.
- A `<Callout type="info">` naming the configuration the numbers are for (timing, rate, CPU speed).
- **No "Part"** anywhere: sections are `##` headings that name their subject ("Panning a whole chip"), and
  cross-references name the section or chapter ("the mixer chapter's Headroom"). **Balanced headings**: no
  `###` that would be the only one under its `##`; prefer one level throughout. Short paragraphs; plain
  words first, the register's name second; **bold the one term a paragraph introduces**.
- **No "How Klive does it" section.** The project author decided the hardware chapters do not need one:
  a chapter is about the machine, and ends with **a closing retelling** under an inviting heading ("What to
  take home", not "The chapter in a nutshell"): a few fluent paragraphs with the key numbers, not a bulleted
  list. A chapter whose subject is Klive itself (the sound series' "From the Machine to Your Speakers") stays
  a chapter of its own.
- **"Chapter" is a technical word**: use it only when you point at a chapter ("the previous chapter", "the
  mixer chapter's Headroom"), not to talk about the text the reader is in ("everything here builds on…",
  "these pages"). A series ends with a chapter that ties
  all its chapters together.
- **Tone: playful, for engineers.** Light humour and images ("the other two politely look the other way",
  "an empty room in an old house", "a crackle that no musician ordered") keep rigid topics readable; the
  numbers stay exact. A joke never replaces a fact, never needs a date or a claim you cannot check, and
  never sits in a register description or a figure.
- **A company of friends discussing engineering.** The author writes as "I", talking to "you": "I" for an
  opinion, a piece of advice or a warning ("here is my advice", "let me warn you", "I always remember them
  like this"), never for an invented experience ("I have seen this bite many programs" is fiction).
- **The author has opinions, and says so often.** Reviewing the memory and ports chapter, the project author
  asked for "I" far more often than one per section: the text should read as the author talking about the
  hardware, judging it as he goes ("I find this the cleverest trick in the machine", "I am not a fan of",
  "if you ask me", "my rule of thumb"). Aim for "I" in most sections, several times in a long one, always as
  an opinion, a preference, a confession of taste or a piece of advice, never as a fact about the machine
  in disguise.
- **Give the hardware's characters names.** A nickname makes a mechanism memorable when it fits what the
  thing does: the DivMMC is "the butler" (always there when you ring, gone when you are done), the boot ROM
  "the stagehand" (sets the scene and leaves before the curtain rises), port `$7FFD` "the interpreter" (it
  speaks 128K and translates into MMU). Introduce the name once with the reason it fits, then use it now and
  then beside the real name, never instead of it in a rule, a register description or a figure. Use a
  few conversational openers where they fit ("Hey, notice…", "Have you ever…?", "Uhm", "Well", "So, what
  have we got?") and questions to the reader, and mix short sentences with longer ones. Sparingly: a handful
  per section, not one per paragraph.
- Changing a heading changes its anchor: search the other pages for links to the old one and update them.

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
- **Show real code for effects**: a commented listing in a `z80klive` fence for Z80 code, so the site
  highlights it (a `text` fence for anything the Z80 grammar does not know, such as a Copper list, and for bit
  diagrams), then "how it works" as numbered
  steps or bullets. Check the listing's numbers against the program the test actually runs. Keep every
  listing line to **64 characters** at most, comments included: the article's measure is 70ch of prose,
  and the code face is wider, so an 80-character line scrolls sideways. Shorten the comment rather than
  wrap the code.
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

- **Figures are printed too**, in a book column about 16 cm wide, which shrinks a 700-unit figure to roughly
  0.23 mm per unit. Size them for that: **no text under 13.5 units** (about 10 pt in print; labels 15,
  titles 16.5), and **use the whole width**: drawings and plots run from x = 0 to 700, label columns are
  narrow (about 130 units, with labels broken over two lines), and nothing leaves an empty margin. The
  TurboSound generator (`docs/authoring/next-audio/turbosound-figures.cjs`) has the sizes as constants.
  The page does its part: a figure has no panel, border or background (`article figure:not([class])`
  in `docs/app/[lang]/(docs)/custom.css`), and the SVG has no `maxWidth`, so the drawing stands on the
  page and fills the whole column, like a figure in a printed book. A thin rule separates the caption.
- **Place a figure right after the sentence that introduces it**, then explain it. Never several
  paragraphs of explanation followed by the figure.
- **Every figure must help.** One that does not (a mode state diagram) is replaced by a list; two figures
  showing the same cases twice are merged; a figure with two cases is split into two figures, each with a
  one-line lead-in.
- Inline `<figure><svg viewBox="0 0 700 H" role="img" aria-label="…" style={{ width: "100%", height:
  "auto" }}>` (older figures still carry `maxWidth: "700px"`; drop it when reworking them) with a `<figcaption>`; the `aria-label` describes the figure fully.
  Neutral strokes and text in `currentColor`; highlight colours `#e8912d` orange, `#3b82f6` blue,
  `#a855f7` purple, `#30a46c` green, `#e5484d` red. One colour per subject across a series (for the Next:
  ULA/LoRes blue, Layer 2 orange, tilemap green, sprites purple, border grey, winner/transparency marks
  red).
- **Arrows run horizontally and vertically** wherever the layout allows: a line that is almost level or almost
  upright reads as a drawing slip, so route it in straight runs with right-angle turns. And give every arrow a
  last straight run longer than its arrowhead (about 13 units at stroke 1.8), or the head swallows the line and
  looks stunted: leave enough room between boxes for it.
- **No stroke on the viewBox's edge.** A box drawn at x = 0 or ending at x = 700 loses the outer half of its
  border to the viewBox and looks thinner than the others. Keep the drawing at 0–700 but give the viewBox
  2 units of room on every side (`viewBox="-2 -2 704 H+4"`, as `docs/authoring/next-memory/memory-io-figures.cjs`
  does).
- Draw to scale where scale carries meaning, and say so. Put two things on one scale when the reader
  must line them up (a picture and the beam's timeline under it, dot 320 on both).
- **Make close-ups big**: a magnified detail takes most of the figure's width.
- **Contrast**, checked in light and dark mode in the browser, zoomed in:
  - no red on red or pink, no label on a coloured band;
  - marks drawn over a picture: a white outline with a dark core (or the reverse), which shows on any
    background in both themes;
  - fine grid or dashed lines over a picture in white, clearly visible; lines inside a key in white;
  - labels must fit their boxes and the viewBox; split long labels into explicit lines.
- **Leader lines do not cross.** When several narrow parts of a strip need labels under it, give each
  leader its own height: a leader whose drop lies inside another leader's level run must turn above it. Then
  no drop crosses a run, and the labels can sit in one row.
- **A label never sits on an arrow or a box edge.** "configures the other two" first ran across a dashed
  arrow and the edge of a box; place a label in open space beside the line it explains. An arrow that must
  reach a box ends on the box's edge, never in the space beside it.
- **Leave no empty band.** A figure whose rows end well above its viewBox's bottom (the port decode grid) has
  a gap a reader takes for a missing part: size the height from the last row.
- Generate figures with coordinates from a small script when they are to scale or have many parts; edit the
  generator, not the generated MDX, and regenerate. Keep the generator in the repository
  (`docs/authoring/<series>/*-figures.cjs`, on the shared `docs/authoring/next-audio/_svg.cjs`): the screen
  series' generators lived in a scratchpad and are lost, so its figures can only be edited by hand.
- **Look at every figure as a picture before publishing**, both themes. The quickest check needs no browser
  pane: take each `<svg>` from the built page (`docs/out/.../index.html`), swap `currentColor` for a dark and a
  light ink, put a background rect behind it and render it with `sharp` to a PNG at 1400 px. Convert from the
  built HTML, not from the MDX: a regex that turns JSX's camelCase into SVG attributes also mangles
  `currentColor` and words such as "DivMMC", and shows faults that are not there. That render uses a
  fallback font, though: the site's own (Overpass) is wider, so two labels that clear each other in the PNG
  can touch on the page (`$000000` and a centred `$040000` 87.5 units apart did). Check tight label spacing
  in the browser with `getBoundingClientRect()` on the `<text>` elements, and start a label at its tick
  rather than centring it when its neighbour is close.

## Wording rules of the Next series

- A register is always a register: "NextReg `$15`", its bits "NextReg `$15` bits 4–2", a port "port
  `$123B`". The first mention in each Part gives the official name from the register list ("the Sprite and
  Layers System register, NextReg `$15`"); after that "NextReg `$15`". A bare hex number is a value.
  Never invent an official name you cannot cite.
- Relaxed and direct, never chatty.
- **Talk to the reader, not into the air.** The project author found the audio articles growing sterile, a
  neutral voice describing the machine to nobody, and asked for the voice of the ZX81 display article: "you"
  and "your program" ("Switch TurboSound on, select chip 2, and chip 2 stays selected"), "let's" for a worked
  example, an imperative for what the reader should do ("set NextReg `$08` yourself"), and a word of
  admiration or warning where the hardware earns one ("Notice how neat this is", "this catches almost everyone
  out"). Keep the facts, the precision and the structure; change who is being spoken to. Captions may say
  "you" too. Not every sentence: a register's bits are still stated plainly.

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
