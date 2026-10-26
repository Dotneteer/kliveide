# ZX Spectrum Next: How the Screen Is Drawn — article series plan

A series of *Under the hood* articles that explain, in the style of
`spectrum-display.mdx` and `zx81-display.mdx`, how the ZX Spectrum Next produces its picture:
every video mode, the palettes, the layers and how they are composed into one pixel.

Status: **articles 1, 2, 3 and 9 written** (`next-display/overview.mdx`, `timing.mdx`,
`palettes.mdx`, `composition.mdx`). Articles 4–8 and 10 to go, in the writing order of §1 (next: 4,
the ULA layer).

### As built (article 1)

- **The book is not linked** (decision D6 of `DOCS_SITE_MODERNIZATION_PLAN.md`: the book has no
  public links). Where §0.1 says "link to the book chapter", link the Guides page for the IDE view
  instead (e.g. `/en/guides/next/layers/`), or say nothing.
- **The pipeline has four stages in the VHDL, not three**: stage 3 only delays the colour (three
  CLK_14 ticks for retiming) and adds blanking. Articles describe "three stages that decide, and a
  fourth that delays"; the colour leaves four 7 MHz periods after stage 0.
- **Screen pictures come from the Next test harness, not an Electron recipe.** The machine's own
  picture and the per-layer solo views (the same layer debug view the IDE uses) are rendered
  headlessly by a checked test, `test/zxnext-hw/layers/next-display-scene.test.ts`, from a scene in
  `next-display-scene.z80asm` beside it. `NEXT_DISPLAY_SHOTS=docs/public/images` writes the figure
  (lossless WebP) after the picture was checked by eye. Later articles add their scenes the same way;
  `scripts/doc-shots/` stays for pictures of the IDE itself (inspector panels).
- Links to articles not yet written are plain text; add the links when the article exists.
- Q1 is settled as proposed (subfolder `next-display/`), Q3 as "per article", Q4 as "in scope":
  article 2 covers RGB, the scan doubler, VGA modes and HDMI at the level of what each does to the
  frame. Klive emulates none of the output stage; the article says so.
- Article 2's frame figures were generated once from each timing's counter values, so they are to
  scale; later edits are made in the SVG itself, keeping the scale (one unit = one dot or line, times
  the figure's stated factor). Its 50/60 Hz pictures come from the scene test like article 1's.
- Article 3's machine pictures show that Layer 2's colour-based transparency is tested after the
  palette offset: an offset moves the "empty" `$E3` byte to an opaque entry. Later articles (6, 9)
  can point back to Part 4 and Part 6 of article 3 instead of re-explaining it.
- Article 9 is checked on the machine: the scene scrolled so every pair of layers overlaps, four test
  dots whose winner the test asserts in all six orders, the priority bit, and blend mode 110. The
  blend picture showed two facts the plan did not list, now in the article: the blend source shows only
  through Layer 2 (even the border disappears), and the tilemap can rise above the sprites. Its worked
  example is the A–D table rather than five separate dots.

---

## 0. Ground rules

### 0.1 What this series is, and what it is not

- **It is the hardware's view: how the FPGA draws the picture, and why it is built that way.** The
  book (`docs/content/en/book/08-ula-screen.mdx` … `15-compositing.mdx`) is the *programmer's* view —
  how to drive each layer from assembly, with demos. The two must not duplicate each other: these
  articles explain the machinery (counters, fetches, pipeline stages, bit fields, the decisions made per
  pixel) and link to the book chapter for "how do I program it".
- **The VHDL is the reference for every fact** (`_input/next-fpga/src/video/*.vhd`, the video pipeline
  in `_input/next-fpga/src/zxnext.vhd` ~line 6700 onwards, `nextreg.txt`, `ports.txt`). Every number,
  bit layout and rule in an article is checked against it before it is written — never from memory or
  from a forum post. Where the VHDL and Klive's core differ, the article says so, as a difference in
  behaviour (or the core is fixed first). The VHDL is where facts are *checked*, never what the
  article *cites*: see the next rule.
- **The articles never refer to the VHDL or the FPGA source files** (a rule of the project author).
  They state every fact as a fact about the machine, in their own words. No file names
  (`zxnext.vhd`, `sprites.vhd`, `nextreg.txt`, `_input/next-fpga/...`), no module, process or signal
  names, no source comments or section titles ("VIDEO PIPELINE STAGE 0"), no line numbers, no quoted
  VHDL, and no "the VHDL says" or "written against the VHDL" - in the text, the tables, the figures,
  the captions, the alt texts and the "Where to read the code" tables alike. The FPGA as a chip is
  hardware and may be named ("block RAM inside the FPGA", "the FPGA's clocks"); NextReg and port
  numbers and their bits are the machine's programming interface and are named as usual ("NextReg
  `$15` bits 4–2", "port `$123B`"). Klive's own source (the C core, the IDE)
  is still named in "How Klive does it". File and line references belong in the working notes
  (`docs/authoring/`) only.
- **It builds on what already exists, it does not repeat it.** `crt-display.mdx` explains the beam,
  sync and colour; `spectrum-display.mdx` explains the ULA screen, the scrambled bitmap, contention and
  the floating bus; `next-core.mdx` explains the C core and the VHDL. The Next articles link to these
  and re-explain only what the Next changes.

### 0.2 Style (taken from the two model articles)

- **An opening hook** — a puzzle or a familiar observation that the article then explains (the
  Spectrum article opens with the "venetian blind" of a loading screen).
- An audience paragraph: what the reader needs to know, which article to read first.
- **"How this article is organised"**: a bulleted list of the parts, each linked, with one line on
  what it covers, and a "if you read only one part, read this one" pointer where it fits.
- An `<Callout type="info">` stating which configuration the numbers are for (e.g. "50 Hz, 128K/+3
  timing, HDMI off") and that Klive emulates it the same way.
- `## Part N: …` sections, with `### …` subsections; short paragraphs; plain words first, the name of
  the register second. Bold the one term a paragraph introduces.
- **"Three numbers that make it fit"**-style summaries where a few numbers explain a design.
- Tables for register bit fields and for layouts; `text` fences for bit diagrams.
- Every article ends with **"How Klive does it"** (the matching C code, what the raster does, which IDE
  panel shows this state) with a **"Where to read the code"** table, and a **Summary**.
- Relaxed and direct, never chatty: explain *why* the hardware is shaped this way, not only *what* it
  does.
- **A register is always called a register** (a decision of the project author). A Next register is
  never a bare `` `$15` ``: it is "NextReg `$15`", its bits "NextReg `$15` bits 4–2", and an I/O port is
  "port `$123B`". The first time a register appears in a Part, it gets its official name from the
  register list (`nextreg.txt`), in plain words: "the Sprite and Layers System register, NextReg
  `$15`"; after that, "NextReg `$15`". A bare hex number such as `$E3` is then always a **value**. The
  same holds in tables, figure labels and alt texts (a table may name the register in a cell as
  "NextReg `$15`" without the official name).

### 0.3 Figures — many more than the model articles

The model articles have four or five figures each; these articles get **8–14 figures each**. The
subject is visual (layers stacked on top of each other, pixel streams, memory maps) and is hard to
follow in prose alone.

Figure conventions (match the existing articles exactly so they theme correctly in light and dark):

- Inline `<figure><svg viewBox="0 0 700 H" role="img" aria-label="…" style={{ width: "100%",
  maxWidth: "700px", height: "auto" }}>` with a `<figcaption>`. The `aria-label` describes the figure
  fully in words.
- Neutral strokes and text use `currentColor` (with `fillOpacity`/`strokeOpacity`); highlight colours
  are the fixed set already in use: orange `#e8912d`, blue `#3b82f6`, purple `#a855f7`, green
  `#30a46c`, red `#e5484d`.
- **One colour per layer across the whole series** so a reader learns it once:
  ULA/LoRes = blue, Layer 2 = orange, tilemap = green, sprites = purple, border/fallback = grey
  (`currentColor`), "this pixel wins" / transparency marks = red.
- Drawn to scale where scale carries meaning (frames, memory maps), and the caption says so.
- Screenshots of the real machine come from `scripts/doc-shots/` recipes (generated, never
  hand-captured — `.ai/doc-screenshots-guide.md`), shown with `<Shot>`. Use them for "what it looks
  like" next to the SVG "how it works" figures; a recipe can load a small test program that shows one
  layer, then the composed picture.

Figure kinds that recur:
- **Exploded layer stacks** (isometric planes, one per layer, with a pixel ray going through them).
- **Bit-field strips** (like the Spectrum article's address-bit figure).
- **Memory maps** drawn to scale (banks, 16K pages, the order bytes are stored in).
- **Pixel-pipeline timelines** (clock ticks across, pipeline stages down).
- **Before/after pairs** (a register value changed, what the picture does).

### 0.4 Placement and mechanics

- Pages go under `docs/content/en/under-the-hood/emulator-internals/next-display/` (a subfolder with
  its own `_meta.ts`, linked from the parent `_meta.ts` as "ZX Spectrum Next: how the screen is
  drawn"), because nine pages would swamp the flat list. *(Open question Q1.)*
- They are new pages, so no `docs/redirects.json` entries; the route golden
  (`.plans/docs-routes.golden.txt`) is updated with each page.
- Links are absolute (`/en/under-the-hood/emulator-internals/next-display/...`).
- `under-the-hood/` is not translated, so no i18n work.
- Each article: `npm run doc:build && npm run doc:check` before it is done.
- One article per change; a `.changes/` entry (`internal`, docs only) is decided with the author when
  committing.

---

## 1. The series at a glance

| # | Slug | Title | Core question it answers |
|---|---|---|---|
| 1 | `overview` | The big picture | What are the layers, and how does one pixel come out of six sources? |
| 2 | `timing` | The frame and the beam | What counts the beam, how big is the frame, and why 28 MHz? |
| 3 | `palettes` | Colours and palettes | How does an 8-bit index become a 9-bit colour, and why eight palettes? |
| 4 | `ula` | The ULA layer, extended | What did the Next add to the Spectrum screen (Timex, ULANext, ULA+, scroll, clip)? |
| 5 | `lores` | LoRes and Radastan | How does a 128 × 96 mode take the ULA's place? |
| 6 | `layer2` | Layer 2 | How does a byte-per-pixel bitmap fit in memory, in three resolutions? |
| 7 | `tilemap` | The tilemap | How are 8 × 8 tiles fetched, flipped, rotated and placed above or below the ULA? |
| 8 | `sprites` | Sprites | How does hardware draw 128 sprites, line by line, with a time budget? |
| 9 | `composition` | Putting it together | How are the layers ordered, made transparent, blended and stencilled? |
| 10 | `raster-effects` | Changing the picture mid-frame | Copper, line interrupts, and how Klive's raster keeps up |

Reading order is the table order; 1 and 2 are prerequisites for all others, 3 for 4–9, and 9 needs
4–8. Articles 4–8 can be read in any order after 3.

Writing order: 1 → 2 → 3 → 9 (composition early, so the layer articles can point at a finished
pipeline description) → 4 → 6 → 7 → 8 → 5 → 10.

---

## 2. Article 1 — The big picture

**Hook:** Load a modern Next game and you see a tile-based playfield scrolling smoothly, a
256-colour parallax background, dozens of sprites, and a Spectrum-style score panel — all at once,
from a machine that still runs 48K software untouched. How do six independent picture sources become
one stream of dots at 28 MHz?

**Audience:** the reader of `spectrum-display.mdx`; links to `crt-display.mdx` and `next-core.mdx`.

Topics:
- **From one chip to a pipeline.** The 48K had one source of pixels (the ULA). The Next keeps that
  ULA, bit-compatible, and adds four more producers that run in parallel with it, each reading its own
  memory and producing a candidate pixel for the same screen position.
- **The cast**: the ULA (with Timex modes, ULANext, ULA+), LoRes (shares the ULA's slot), Layer 2,
  the tilemap, sprites — plus the border and the fallback colour. One paragraph and one thumbnail each,
  pointing to its article.
- **The display area and the "wide" area**: the 256 × 192 ULA paper inside the 320 × 256 area that
  Layer 2 (320/640 modes), the tilemap and sprites can use; the border is not a separate thing but
  where the ULA layer draws its border colour.
- **Every layer answers two questions per pixel**: "what colour index?" and "am I transparent here?".
  The compositor only ever sees these answers — this framing carries the whole series.
- **The three pipeline stages**: stage 0 gather the layers' pixels, stage 1
  palette lookup, stage 2 decide the final pixel. A first, simplified walk-through of one pixel.
- **Colour depth**: everything ends as 9-bit RGB333 (512 colours); why 9 bits, and where the 8-bit
  palette entries come in (preview of article 3).
- **Clocks**: the 28 MHz master, 7 MHz pixel clock for 256-wide layers, 14 MHz for 512/640-wide
  pixels; the CPU's 3.5/7/14/28 MHz speeds are independent of the picture.
- **What stays the same as the Spectrum**: the beam timing modes, the ULA's memory fetches, contention
  at 3.5 MHz — and what changes when the CPU runs faster.
- **The series map** with one line per article.
- How Klive does it (short): one C file per layer, per-layer pixel buffers, one compose function.

Figures (≈ 9):
1. The 48K's single path (memory → ULA → TV) beside the Next's five producers feeding one compositor.
2. **Hero figure**: an exploded isometric layer stack (border/ULA, tilemap, Layer 2, sprites) with the
   composed picture at the bottom and one pixel ray going through all planes.
3. Display area 256 × 192 inside the 320 × 256 wide area inside the full frame, to scale.
4. Five thumbnails of the same scene, one per layer, then the composed scene (doc-shots).
5. "Two answers per pixel": each layer box outputs (index, transparent?).
6. The three-stage pipeline as a block diagram, with the NextRegs that feed each stage.
7. Clock tree: 28 MHz → 14 → 7 MHz, which layer runs off which.
8. RGB333 colour cube (512 colours) vs the Spectrum's 15 colours.
9. Map of the series (a stylised version of figure 2 with article numbers on each plane).

Verify: pipeline stage boundaries and clocks in `zxnext.vhd` 6700–7600; which layers can reach the
border area.

---

## 3. Article 2 — The frame and the beam

**Hook:** The Next can show the same game as a 48K, a 128K or a Pentagon would — down to the exact
T-state the beam reaches a given dot — and it can also send a 60 Hz HDMI picture to a modern monitor.
One set of counters does all of it.

Topics:
- **The horizontal and vertical counters** (`hc`, `vc` in `zxula_timing.vhd`): what they count
  (pixels at 7 MHz), where they wrap, how blanking and sync are carved out of them.
- **Machine timing modes** (NextReg `$03`, `$05`): 48K (448 × 312), 128K/+3 (456 × 311),
  Pentagon (448 × 320), and the 60 Hz variant (264 lines). A table of all of them with T-states per
  line and per frame, compared to the original machines from `spectrum-display.mdx`.
- **Where the display starts**: the paper's position in `hc`/`vc` for each mode; the wide 320 × 256
  area's position; why 60 Hz loses the top and bottom border rows of the wide area.
- **50 Hz vs 60 Hz**: what changes (lines, interrupt rate), what does not.
- **The frame interrupt and the line interrupt** (NextRegs `$22`/`$23`): which counter value raises
  them, and the offset relative to the paper.
- **Pixel rates**: one `hc` step is two dots at 14 MHz or one at 7 MHz; how 512-wide (Timex hi-res)
  and 640-wide (Layer 2) modes fit in the same line.
- **From counters to cables**: VGA modes 0–6 (frequency steps), the scan doubler
  (`video/vga/scan_convert.vhd`) that turns 15 kHz lines into 31 kHz, RGB/composite output, and the
  HDMI path (`video/hdmi/`) with its own fixed timing; what that does to the 50/60 Hz choice.
- **Contention at speed**: memory contention exists only at 3.5 MHz; the faster CPU speeds turn it
  off — link to Part 5 of `spectrum-display.mdx` rather than re-explaining it.
- How Klive does it: the core's frame and tact counters, the tact-to-pixel table (456 HC per line,
  bitmap row 0 at VC 16, bitmap x 0 at HC 96), and the machine-timing choices it supports.

Figures (≈ 10):
1. The Next frame drawn to scale for 128K/+3 50 Hz (like the 48K frame figure), with paper,
   wide area, border, blanking and sync.
2. The same for 60 Hz, side by side, showing the lost rows.
3. `hc` and `vc` as a counter strip with the events on it (blank start, sync, paper start, wrap).
4. The four machine-timing frames overlaid at the same scale.
5. Where frame and line interrupts fire, marked on the frame.
6. One line at 7 MHz vs 14 MHz pixels: 256-wide vs 512/640-wide in the same time.
7. The output chain: counters → RGB → scan doubler → VGA, and → HDMI encoder.
8. Scan doubling: each 15 kHz line written once, read twice (two line buffers).
9. Timeline of CPU T-states vs dots at 3.5/7/14/28 MHz CPU speed.
10. Table-as-figure: T-states per line/frame for every timing mode.

Verify: every `c_max_*` constant in `zxula_timing.vhd`; interrupt positions; VGA mode list in
`nextreg.txt` (`$11`); HDMI timing.

---

## 4. Article 3 — Colours and palettes

**Hook:** The Next can show 512 colours, yet every layer speaks in 8-bit indices — and the same index
`$E3` means "transparent" almost everywhere. Why both, and how?

Topics:
- **RGB333**: 3 bits per channel, 512 colours; the 8-bit RRRGGGBB form and how the missing blue bit
  is made (the 9th bit = B1 OR B0 for 8-bit writes, or written explicitly with the 9-bit form).
- **Eight palettes**: ULA, Layer 2, sprites, tilemap — two of each (first/second), and the select bits
  in NextReg `$43` (which palette is edited, which one each layer shows).
- **Writing palettes**: the index (`$40`), 8-bit (`$41`) and 9-bit (`$44`, two writes) data
  registers, auto-increment and its disable bit; reading them back.
- **What indexes each palette**: ULA ink/paper/border/bright through the default mapping; ULANext
  (`$42` ink mask) and ULA+ (64 colours) — previewed here, detailed in article 4; Layer 2's byte (with
  palette offset); 4-bit sprites/tiles plus the 4-bit palette offset.
- **The Layer 2 priority bit**: bit 15 of a 9-bit write (bit 7 of the second `$44` byte) — the palette
  entry itself carries "draw me above everything"; preview of article 9.
- **Transparency**: the global transparent colour (`$14`, compared against the *colour*, upper 8 bits,
  after lookup) for ULA/LoRes/Layer 2; the *index*-based transparency for sprites (`$4B`) and the
  tilemap (`$4C`) — why two different rules exist and when each is checked in the pipeline.
- **The fallback colour** (`$4A`): what is shown when every layer is transparent.
- **Default palettes after reset**: the identity-like RGB332 ramp, the ULA's Spectrum colours.
- **Palette tricks**: palette cycling, fading, and changing palettes mid-frame (preview of article 10).
- **From RGB333 to the screen**: the VGA DAC's 3 bits per channel, HDMI's 8 bits per channel (how 3
  bits are stretched), and why the Next's colours look slightly different on VGA and HDMI.
- How Klive does it: `zxnext-palette.c`, the 9-bit expansion, the IDE's palette panel.

Figures (≈ 11):
1. The RGB333 cube, with the Spectrum's 15 colours marked in it.
2. Bit strip: RRRGGGBB → 9-bit RGB, showing how B0 is derived.
3. Bit strip: the two-byte 9-bit write (`$44`), with the Layer 2 priority bit.
4. The eight palettes as a 4 × 2 grid, with the `$43` select bits pointing at the edited one and the
   shown ones.
5. Palette write sequence: index register, data writes, auto-increment arrow.
6. "Index → lookup → colour" per layer: four lanes, each with its index source and palette.
7. Palette offset: a 4-bit pixel plus a 4-bit offset → 8-bit index, as a bank-of-16 picture.
8. Two transparency rules: colour comparison after lookup vs index comparison before it, drawn on the
   pipeline figure.
9. Default ULA palette swatches (normal/bright) next to their RGB333 values.
10. Palette cycling demo (before/after strip).
11. 3-bit → 8-bit channel scaling for HDMI, as a small ramp chart.

Verify: `$43` bit layout, 9-bit expansion rule, `$14` comparison width (`transparent_rgb` uses
`rgb(8 downto 1)` in `zxnext.vhd`), defaults in `nextreg.txt`.

---

## 5. Article 4 — The ULA layer, extended

**Hook:** Every 48K program still sees exactly the screen it expects — yet the same ULA can show 512
dots across, a colour for every 8 × 1 dots, 64 colours at once, and scroll smoothly. All of it is
hidden behind switches that old software never touches.

Builds on `spectrum-display.mdx` (bitmap, attributes, the address order, contention, floating bus);
this article covers only what the Next adds.

Topics:
- **What is unchanged**: the fetch pattern, the bitmap/attribute layout, FLASH, the border — one
  paragraph and a link.
- **Where the ULA reads**: bank 5 and the shadow screen in bank 7 (port `$7FFD` bit 3), and the
  ULA's direct path to that memory.
- **The Timex modes** (port `$FF`): the second display file at `$6000`; **hi-colour** (attributes per
  8 × 1 dots from the second file); **hi-res** (512 × 192 mono, the two files interleaved, ink/paper
  from bits 5–3); how each changes the ULA's four reads per 16 dots.
- **ULANext** (`$42`, `$43` bit 0): reinterpreting the attribute byte — the ink mask, the 1/3/7/15/31/
  63/127/255-ink formats, FLASH replaced by more ink bits, the full-ink mode where paper is the
  fallback.
- **ULA+** (ports `$BF3B`/`$FF3B`, NextReg `$68` bit 3): 64 colours, 4 CLUTs selected by FLASH/BRIGHT.
- **The border**: still port `$FE`; where it is drawn in the 320 × 256 area; its palette entry.
- **Hardware scroll** (`$26`, `$27`) and the half-pixel scroll (`$68` bit 2) — why the scroll is in
  pixel/line units and how it wraps inside 256 × 192.
- **The clip window** (`$1A`, `$1C`): four coordinates, which coordinate system they use.
- **Turning the ULA off** (`$68` bit 7) — and why the blend modes still read it (article 9).
- **Contention, the floating bus and snow on the Next**: what survives and when.
- How Klive does it: `zxnext-ula.c` render paths for standard/hi-colour/hi-res, the latches that apply
  port writes at the beam position.

Figures (≈ 12):
1. The ULA's memory: bank 5 and bank 7 screens, the Timex second file at `$6000`, to scale.
2. Four reads per 16 dots in standard mode (recap of the Spectrum figure, compact).
3. The same in hi-colour mode: bitmap from file 1, colour from file 2.
4. The same in hi-res mode: two bitmap bytes interleaved → 16 dots at 14 MHz.
5. Visual comparison: the same 16 × 16 area in standard / hi-colour / hi-res (doc-shots).
6. Attribute byte bit strips: standard, ULANext with masks `$07`, `$0F`, `$3F`, `$FF`.
7. ULANext index computation: ink → palette 0+, paper → 128+, drawn as two arrows into the palette.
8. ULA+ attribute → 64-colour index (FLASH/BRIGHT select one of four 16-entry CLUTs).
9. The border's position in the wide area, with the paper inside.
10. Hardware scroll: the screen as a torus, the scroll offsets, where the wrap seam appears.
11. Clip window coordinates over the ULA area.
12. Port `$FF` and NextReg bit strips (`$68`, `$6A` where relevant) in one reference figure.

Verify: `zxula.vhd` fetch addresses and mode decoding; ULANext formats and the full-ink case; ULA+
enable path; scroll ranges; clip coordinate units.

---

## 6. Article 5 — LoRes and Radastan

**Hook:** A 128 × 96 screen sounds like a step backwards — but every dot can be any of 256 colours,
the whole screen fits in 12K, and it scrolls in both directions for free.

Topics:
- **LoRes** (`$15` bit 7): 128 × 96, one byte per 2 × 2-dot block, 256 colours through the ULA
  palette; memory at `$4000` (two halves at `$4000`/`$6000`).
- **It replaces the ULA**: LoRes is the ULA layer's source, not a sixth layer — so it obeys the ULA's
  priority, clip window and transparency.
- **Radastan mode** (`$6A`): 128 × 96 at 4 bits per dot, 6K, the palette offset, and the Timex
  display-file bit that selects which half.
- **Scrolling** (`$32`, `$33`) and its wrap.
- **Clip window**: shares the ULA's; LoRes has no clip window of its own (worth a sentence).
- **Why a mode like this exists**: memory bandwidth and CPU time to update a full-colour screen at
  3.5 MHz.
- How Klive does it: the LoRes branch in `zxnext-ula.c` and `lores.vhd`.

Figures (≈ 8):
1. 2 × 2 dot blocks: one LoRes pixel over four ULA dots.
2. LoRes memory layout: two 6K halves, top and bottom of the screen.
3. Radastan memory layout: 4 bits per pixel, two pixels per byte.
4. The pixel-index path: byte → (palette offset for Radastan) → ULA palette.
5. LoRes taking the ULA's slot in the layer stack (stack figure with the ULA plane swapped).
6. Scroll in both axes with wrap.
7. Memory-and-time comparison: ULA vs LoRes vs Radastan vs Layer 2 (bytes per frame, bars).
8. Doc-shot: the same image in LoRes and Radastan.

Verify: `lores.vhd` address generation; `$6A` bits; the 12K/6K layouts; Radastan + Timex coexistence.

---

## 7. Article 6 — Layer 2

**Hook:** Layer 2 is the simplest idea on the Next — one byte, one dot, any colour — and the one with
the most surprising memory layout: in two of its three modes, the bytes run *down* the screen, not
across it.

Topics:
- **The idea**: a linear 8-bit bitmap, one palette index per dot; why that needed a new layer and
  not a new ULA mode (memory bandwidth, the Spectrum's RAM layout).
- **Where it lives**: 16K banks, the active and shadow banks (`$12`, `$13`), how many banks each mode
  uses, and what happens when a mode runs past the end of RAM (the "no pixel" case in Klive's core).
- **Three resolutions** (`$70` bits 5–4):
  - **256 × 192 × 8 bpp**: 48K, row-major, three 16K thirds.
  - **320 × 256 × 8 bpp**: 80K, **column-major** — why: 256 rows = one byte of address, so a column
    is one 256-byte page and x selects the page.
  - **640 × 256 × 4 bpp**: 80K, column-major, two dots per byte at 14 MHz, palette offset supplies the
    top 4 bits.
- **Mapping it into the CPU's view**: port `$123B` (write-over-ROM paging, the shadow-bank bit, the
  "which third/16K segment" bits) and the MMU alternative.
- **Palette offset** (`$70` bits 3–0) and the Layer 2 palettes.
- **Scrolling** (`$16`, `$17`, `$71` bit 0 for x ≥ 256) and wrap in each mode.
- **Clip window** (`$18`): its units differ per mode (x doubled in 320 mode, quadrupled in 640).
- **Transparency** via the global colour (`$14`) and the **priority bit** from the palette.
- **How it is fetched**: the Layer 2 memory port, the fetch pipeline, and why the 640 mode needs two
  dots per 7 MHz period.
- How Klive does it: `zxnext-layer2.c`, the three render loops in `zxnext-ula.c`.

Figures (≈ 12):
1. Layer 2 vs ULA for the same scene: one byte per dot vs bitmap+attributes.
2. Memory map: 256 × 192 → three 16K banks, row-major, to scale.
3. Memory map: 320 × 256 → five 16K banks, column-major, to scale.
4. Why column-major: address bit strip, x → high byte, y → low byte (in the style of the Spectrum
   address figure).
5. Byte order arrows on a small screen: row-major vs column-major.
6. 640 mode: one byte → two 4-bit dots → palette offset.
7. The bank registers and port `$123B` bit strip.
8. Mapping Layer 2 into `$0000`–`$3FFF` vs into an MMU slot.
9. Scroll with wrap for each mode (three small tori/strips).
10. Clip window in each mode's units.
11. Priority bit: a Layer 2 dot rising above the sprite plane (stack figure).
12. Doc-shots of the three modes.

Verify: `layer2.vhd` address formation for each mode; `$70` layout; `$123B` bits; clip scaling;
scroll ranges.

---

## 8. Article 7 — The tilemap

**Hook:** A 320 × 256 picture in 2.5K: the tilemap draws a full-width screen from a grid of 8 × 8
tiles, each of which can be mirrored, rotated, recoloured and placed above or below the ULA — tile by
tile.

Topics:
- **Why tiles**: repeated graphics, memory, and CPU time; the classic console idea on a Spectrum.
- **The map and the tiles** (`$6E`, `$6F`): both in bank 5, at offsets; 40 × 32 and 80 × 32 grids
  (`$6B` bit 6); the map's entry format.
- **The tile entry**: tile number + attribute byte — palette offset (4 bits), X mirror, Y mirror,
  rotate, and "ULA over tilemap" bit (or the 9th tile-number bit in 512-tile mode).
- **Attribute-less mode** (`$6B` bit 5) and the default attribute (`$6C`).
- **Tile definitions**: 4 bpp, 32 bytes per tile; the **text mode** (`$6B` bit 3): 1 bpp, 8 bytes per
  tile, with the palette offset as colour.
- **512-tile mode** (`$6B` bit 1).
- **How a tile pixel is fetched**: map entry → tile row address → nibble; how mirror and rotate change
  the address bits (rotate = swap x and y, then mirror).
- **Above or below the ULA**: per-tile bit vs `$6B` bit 0 (tilemap over ULA); how "below" is passed
  to the compositor as a flag.
- **Transparency** by index (`$4C`) — before palette lookup.
- **Scroll** (`$2F`, `$30`, `$31`) and wrap; **clip** (`$1B`, x in units of 2 in 40-column mode).
- **The 80-column mode** at 14 MHz dots.
- How Klive does it: `zxnext-tilemap.c` and the tilemap inspector panel.

Figures (≈ 12):
1. Tile grid over the 320 × 256 area, with one tile magnified to 8 × 8 dots.
2. Memory: map and tile definitions in bank 5, sizes to scale.
3. Map entry bit strip (normal and 512-tile mode).
4. Attribute byte bit strip.
5. The eight orientations of one tile (mirror X/Y × rotate), as a 2 × 4 grid — the clearest way to show
   the transforms.
6. How rotate/mirror rewrite the pixel address bits (bit strip with arrows).
7. 4 bpp tile row → nibbles → palette offset → index.
8. Text mode: 1 bpp glyph tile and its colour.
9. 40 × 32 vs 80 × 32 grids at the same physical size.
10. Above/below the ULA per tile (stack figure, some tiles above, some below the ULA plane).
11. Scroll with wrap, and the clip window.
12. Doc-shot: a tile-based screen and the tilemap inspector.

Verify: `tilemap.vhd` fetch timing and address generation, rotate/mirror order, `$6B` bit meanings,
clip units.

---

## 9. Article 8 — Sprites

**Hook:** 128 sprites, each up to 16 × 16 at up to 8 × magnification, linked into giant composite
objects — and yet the hardware never holds a full-screen sprite picture. It draws each line just in
time, and if a line has too many sprites, it simply runs out of time.

Topics:
- **The sprite system**: 128 sprites, pattern memory (16K: 64 patterns × 256 bytes at 8 bpp, or 128 ×
  128 bytes at 4 bpp), the attribute table.
- **Uploading**: ports `$303B` (select), `$57` (attributes), `$5B` (patterns), NextRegs `$34`–`$39`/
  `$75`–`$79`; the auto-increment.
- **The attribute bytes** (4 or 5): X (9 bits), Y (9 bits), palette offset, mirror X/Y, rotate,
  visible, pattern number, 4-bit flag, scale X/Y (1/2/4/8×).
- **4-bit patterns** and the N6 bit.
- **Anchors and relative sprites**: composite vs unified relative sprites — what is inherited (position,
  visibility, palette offset, pattern, mirror/rotate/scale for unified), what is relative. A worked
  example with three sprites.
- **The line buffer**: during each line the sprite engine scans the table, draws the visible
  sprites' rows for the *next* line into a line buffer, and the buffer is read out while the beam draws.
  Double buffering, why the drawing order sets priority.
- **The time budget**: the clocks per line, what happens when sprites do not fit, the "max sprites per
  line" flag in `$303B` bit 1.
- **Priority between sprites** (`$15` bit 6: sprite 0 on top or 127 on top).
- **Transparency** by index (`$4B`), 4 bpp transparency with palette offset.
- **Over the border** (`$15` bit 1) and **clipping** (`$19`, `$15` bit 5): the coordinate system
  (sprite space 320 × 256, origin at the wide area's corner) and clip units.
- **Collisions** (`$303B` bit 0).
- How Klive does it: `zxnext-sprites.c`, `zxnextResolveSpritesForIde`, the sprite inspector.

Figures (≈ 14):
1. Sprite space (320 × 256 plus the off-screen 512 × 512 wrap) with the display area inside.
2. Pattern memory map: 8 bpp and 4 bpp patterns, to scale.
3. Attribute bytes 0–4 as bit strips.
4. Scaling 1×, 2×, 4×, 8× (and the mixed X/Y case).
5. The eight orientations (shared with the tilemap figure, re-drawn for 16 × 16).
6. 4-bit pattern → palette offset → index.
7. Anchor + relative sprites: composite (positions relative, rest own) vs unified (rotate/scale as a
   whole) — a before/after with the anchor rotated.
8. Sprite engine timeline: scan the table → render rows into line buffer A while buffer B is shown.
9. Double line buffer, ping-pong arrows per line.
10. Time budget: a line with a few sprites (fits) vs too many (last sprites cut off, flag set).
11. Priority between overlapping sprites, both settings of `$15` bit 6.
12. Over-the-border and clip window, drawn on the wide area.
13. Collision flag: two sprites' opaque pixels overlapping.
14. Doc-shot: the sprite inspector with a composite object.

Verify: `sprites.vhd` (state machine, line buffer, time-out rule `spr_cur_notime`), attribute
layouts, relative-sprite inheritance rules, scale, clip units.

---

## 10. Article 9 — Putting it together: priorities, transparency, blending

**Hook:** Six candidates for every dot, and one winner. The rules that pick it fit in a few hundred
lines of VHDL, yet they give the Next stencils, colour blending and per-dot priority that the original
designers of the Spectrum could not have imagined.

If a reader reads only one article after the overview, this one.

Topics:
- **The three stages in detail**: what each stage holds,
  and why registers are latched once per pixel period (changing `$15` mid-line takes effect at the
  next pixel).
- **Stage 0 — gather**: each layer's index plus flags (clipped, below, priority, border).
- **Stage 1 — palette lookup**: each index through its palette; the fallback colour enters here for
  the ULA.
- **Stage 2 — decide**: per layer "transparent?" — the colour rule (ULA, LoRes, Layer 2: compared with
  `$14`), the index rule (sprites `$4B`, tilemap `$4C`), clip windows, layer enables.
- **The ULA/tilemap pair first**: they are mixed into one "U" layer before the main ordering — the
  tilemap-below flag, `$6B` bit 0 — and stencil mode (`$68` bit 0: a dot is drawn only where both are
  opaque, ULA AND tilemap).
- **Layer order** (`$15` bits 4–2): SLU, LSU, SUL, LUS, USL, ULS — six orders, each with a stack
  figure.
- **The Layer 2 priority bit** punching a Layer 2 dot above the sprites whatever the order.
- **Blend modes** (`$15` = 110 and 111): Layer 2 + U, saturated, or Layer 2 + U − 5 clamped; the
  blend source chosen by `$68` bits 6–5 (ULA, ULA/tilemap mix, tilemap, none); per-channel arithmetic
  in 3 bits.
- **Nothing opaque**: the fallback colour (`$4A`).
- **The border** as part of the ULA layer, and what that means for priorities (sprites over border,
  Layer 2 over border in 320/640 modes).
- **Worked examples**: a game screen decoded pixel by pixel — five sample dots, each traced through
  the stages.
- How Klive does it: per-layer 16-bit buffers (`ZXNEXT_PX_OPAQUE`, `_L2_PRIORITY`, `_TM_BELOW`,
  `_BORDER`), `zxnextUlaCompose` and its fast path, the "why" codes the IDE's Layers panel shows for
  a dot.

Figures (≈ 14):
1. The full pipeline: five layers → stage 0 → stage 1 (four palettes) → stage 2 → RGB, with every
   NextReg that feeds it.
2. Pipeline timing: one pixel moving through the stages over three 7 MHz ticks.
3. Transparency decision tree per layer (colour rule vs index rule, clip, enable).
4. The ULA + tilemap mix: tilemap above, below, per-tile — three small stacks.
5. Stencil mode: ULA mask AND tilemap mask = result (three panels).
6. **The six layer orders**: six small exploded stacks in a 3 × 2 grid, with the same scene
   composed under each.
7. The priority bit: Layer 2 dot rising above sprites in an LSU/SLU stack.
8. Blend mode 110: channel-wise add with saturation, worked on two colours (bar figure per channel).
9. Blend mode 111: add then subtract 5, with clamp.
10. Blend source choices for `$68` bits 6–5, four lanes.
11. Fallback colour: every layer transparent → `$4A`.
12. Border and wide area: which layers can draw where (map of the frame with layer coverage).
13. Worked example: a composed game screen with five numbered dots, and a trace table per dot.
14. Doc-shot: the Layers panel explaining why a dot has its colour.

Verify: `zxnext.vhd` 7038–7300 (the `case` on priorities and `ula_blend_mode_2`), the blend
arithmetic and clamping, which flags are latched per stage, border coverage per layer.

---

## 11. Article 10 — Changing the picture mid-frame

**Hook:** Everything so far assumed the registers stay still while a frame is drawn. They do not
have to. Change a palette entry, a scroll offset or the layer order at the right line, and one screen
becomes several — and the Next has a co-processor whose only job is to do that on time.

Topics:
- **The beam as a clock**: any register write takes effect from the pixel the beam is drawing — a
  recap of the stage-0 latch from article 9.
- **The line interrupt** (`$22`, `$23`): splitting the screen from the CPU, and the jitter it brings.
- **The Copper** (`$60`–`$64`): WAIT (line, horizontal position) and MOVE (NextReg, value); the 1K
  instruction memory; its modes (stop, run once, loop, restart at frame); why its timing is exact where
  the CPU's is not; the line/position units.
- **Typical effects**: split-screen scroll, per-line palette (sky gradients), changing layer order
  per band, multiplexing sprites by rewriting them below the beam, changing Layer 2 bank per region.
- **What can and cannot change mid-line**: register latching per pixel vs per line vs per frame
  (e.g. the ULA latches border/scroll writes at specific points).
- **How Klive does it**: the beam-racing raster — renderers kept whole-frame but called lazily: just
  before a write that changes the picture, the rows the beam has passed are rendered with the old
  state; memory writes catch up to the start of the current row; the one-line difference this allows
  and why it was accepted; the Copper in `zxnext-copper.c`; the visual-test harness
  (`test/visual/`) that proves effects against goldens.
- **Series wrap-up**: one page that ties the whole picture together.

Figures (≈ 10):
1. A frame with three bands, each with a different register state, and the writes marked at the
   band edges.
2. Line interrupt vs Copper timing: CPU split jitters by a few pixels, the Copper's does not.
3. Copper instruction bit strips (WAIT, MOVE) and the program memory.
4. Copper modes as a small state diagram.
5. Sky gradient: one palette entry rewritten every line (doc-shot + the Copper list beside it).
6. Split scroll: playfield scrolls, status bar does not.
7. Sprite multiplexing: the same eight hardware sprites reused in four bands.
8. Latching: which registers apply at the next pixel, next line, next frame (a timeline with three
   lanes).
9. Klive's lazy raster: the beam position, the rendered-so-far rows, a write, the catch-up render.
10. The one-row difference for memory writes (hardware per-cell fetch vs Klive per-row catch-up).

Verify: Copper timing units and the `$63`/`$64` semantics in the VHDL; which ULA writes are latched
when (`zxnext-ula.c` latch comments vs `zxula.vhd`); line-interrupt offset.

---

## 12. Fact-checking checklist (per article, before it is published)

- Every NextReg/port bit meaning traced to `nextreg.txt`/`ports.txt` **and** the VHDL that uses it.
- No reference to the VHDL or the FPGA source files anywhere in the article (§0.1): search the page
  for `vhd`, `VHDL`, `_input`, `next-fpga` and signal-style `snake_case` names before publishing.
- Every number (sizes, counts, counter limits, clock rates) found in the VHDL, with the file and line
  noted in the draft's working notes (`docs/authoring/`, off the public site).
- Every behaviour shown in a doc-shot runs in Klive, and Klive's result agrees with the VHDL; where the
  core differs, the difference is fixed or stated in the article.
- Figures re-checked against the text after every edit (counts, bit positions, labels).
- `npm run doc:build && npm run doc:check` green.

## 13. Open questions for the author

- **Q1** — Subfolder `next-display/` (proposed) or flat `next-*.mdx` pages beside `zx81-*` and
  `spectrum-*`?
- **Q2** — Ten articles as listed, or merge LoRes into the ULA article (it is short and *is* the ULA's
  slot) and the mid-frame article into the composition article?
- **Q3** — Should the doc-shot recipes and their small test programs be built per article (one PR
  each) or all up front?
- **Q4** — Is Article 2's HDMI/VGA/scan-doubler material in scope, or should the series stop at the
  RGB the pipeline produces?
