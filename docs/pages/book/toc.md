# Table of Contents — Plan & Rationale

This document is a **planning artifact**, not part of the book. It proposes a
complete chapter structure for *Inside the ZX Spectrum Next*, explains the
ordering rationale, and lays out concrete steps to evolve the current draft
into the proposed structure.

Read top to bottom: first the proposed TOC, then the dependency map, then the
discussion of dilemmas, then the migration plan from today's state to the
target.

---

## 1. Guiding Principles

The TOC is built around four constraints:

1. **Hardware coverage.** Every significant piece of hardware that a typical
   Next owner has out of the box (CPU, memory, video layers, sprites, audio,
   storage, joysticks, mouse, keyboard, RTC, UART, Copper, DMA) gets at least
   one chapter or a clearly named section.
2. **Klive-only exercises.** Every exercise must be runnable on a stock ZX
   Spectrum Next as emulated by Klive — no hardware extensions, no peripherals
   that Klive doesn't model. Code uses the Klive Z80 Assembly dialect
   (`.kz80.asm`).
3. **Progressive dependency.** Each chapter should build on a small, named set
   of earlier chapters. The reader should never need to "skip ahead" to make
   sense of a current example.
4. **One concept, one home.** Cross-cutting concerns (interrupts, NextRegs,
   palettes) live in a single primary chapter and are *referenced* — not
   re-explained — from later chapters.

---

## 2. Proposed Table of Contents

### Front Matter
- **Preface** *(existing)*
- **Introduction** *(existing)*
- **Flying Start** *(existing)* — Klive setup, project structure, the example pack

### Part I — The CPU and the Bus

1. **Z80N: The Next's Z80 CPU** *(existing — `z80n.mdx`)*
   - Registers, flags, machine cycles, undocumented behaviour, Z80N extension
     instructions, hardware multiplier.
2. **Talking to the Hardware: I/O Ports and NextRegs**
   *(split out from the current `next-hardware.mdx`)*
   - How `IN`/`OUT` decode addresses on the Next, partial decoding, the
     NextReg `0x243B`/`0x253B` pair, the `NEXTREG` Z80N instructions, reading
     vs. writing NextRegs, the "current register" state.
   - This is the chapter every later chapter cross-references.

### Part II — Memory

3. **Memory Architecture: ROM, RAM, Banks, and the MMU**
   - 16-bit Z80 address space vs. 21-bit physical (2 MB).
   - The 8 MMU slots × 8 KB pages, NextRegs `0x50`–`0x57`.
   - Legacy paging compatibility: `0x7FFD`, `0x1FFD`, `0xDFFD`.
   - Memory regions vs. banks vs. pages vs. slots (consistent with the
     glossary).
   - Divmmc and the alt-ROM mechanism (overview only — full discussion when we
     reach storage).
   - **Exercises**: page in a high bank and write a signature; build a small
     "memory probe" that walks the 2 MB and prints the first byte of each
     8 KB page.

### Part III — Time and Events

4. **Interrupts: IM1, IM2, and the Next's Multi-Source Interrupt System**
   - Z80 interrupt modes (IM0/IM1/IM2), the I register, the IM2 vector table.
   - Maskable vs. non-maskable, the NMI button on real hardware (Klive
     emulates the press).
   - The Next's interrupt control: NextRegs `0xC0`–`0xC8`, line interrupt,
     ULA frame interrupt, CTC interrupts, UART interrupts, DMA interrupts.
   - Writing a clean IM2 handler in Z80N assembly.
   - **Why this comes before CTC, video, and audio:** every later chapter
     uses interrupts in some form. We pay the conceptual cost once.
   - **Exercises**: a 50 Hz frame counter; a colour-cycling border using only
     the frame interrupt; an IM2 handler that dispatches to two different
     sources.

5. **The CTC: Counter/Timer Circuit**
   *(split out from the current `next-hardware.mdx`)*
   - The four CTC channels, their clock sources, prescalers, time constants.
   - **Three uses, one chapter:**
     - Measuring code execution time (polling the down-counter).
     - Generating periodic ticks (interrupt-driven, references Chapter 4).
     - Cascading channels for long intervals.
   - Cross-references audio (Part VI) for sample-rate generation, but does
     not duplicate that material.
   - **Exercises**: cycle-accurate stopwatch around an `LDIR`; 1 kHz tick
     handler that increments a counter visible in the IDE watch window.

6. **The zxnDMA: Moving Data Without the CPU** *(existing — `zxndma.md`)*
   - Already covers Port A/B model, transfer modes, real patterns.
   - **Add**: short cross-references to interrupts (DMA-end interrupt) and to
     audio (DMA-driven sample feeding) once those chapters exist.

### Part IV — Input

7. **Input Devices: Keyboard, Joysticks, Mouse**
   - Reading port `0xFE` and the keyboard matrix (already touched in the
     existing I/O chapter — moved here in full).
   - Kempston joystick port `0x1F`, Sinclair joysticks via the keyboard
     matrix, Kempston mouse on `0xFADF`/`0xFBDF`/`0xFFDF`.
   - Joystick mode selection via NextReg `0x05`.
   - **Exercises**: paint a tile under the mouse cursor; a small "input
     monitor" overlay that shows the live state of all three input devices.

### Part V — Video

This is the largest part. It is ordered from "what the original Spectrum had"
outward, because every later layer composes on top of earlier concepts.

8. **The ULA Screen and Border**
   - The classic 256×192 bitmap, attribute layout, attribute colour clash,
     border port `0xFE`, the FLASH bit, the BRIGHT bit.
   - Screen address arithmetic and the bitmap's interleaved layout.
   - **Exercises**: print text using the ROM character set; a border-bar
     timing demo driven from the frame interrupt (uses Chapter 4).

9. **Palettes and Colour on the Next**
   - The 9-bit palette format, the palette index register, palette select
     (NextReg `0x43`), the eight palette banks (ULA, Layer 2, Sprites,
     Tilemap, each with a "first" and "second" palette).
   - Per-pixel priority bit.
   - **Why a dedicated chapter:** every video layer that follows uses the
     same palette mechanism. Explain it once, reference it everywhere.
   - **Exercises**: palette-shift a ULA screen without redrawing it;
     animate by rotating palette entries.

10. **LoRes Mode**
    - 128×96, two colours per 4×8 block, NextReg `0x15` bit 7.
    - Trade-offs vs. ULA, scrolling LoRes (NextRegs `0x32`/`0x33`).
    - **Exercises**: draw a LoRes scene; smooth-scroll it horizontally.

11. **Layer 2: True-Colour Bitmap**
    - 256×192/256, 320×256/256, 640×256/16. Memory layout, paging Layer 2
      RAM into the Z80 address space (NextReg `0x12`/`0x13`).
    - Scrolling, clipping window, priority over ULA.
    - **Exercises**: load a Layer 2 image (provided in the example pack);
      vertical split-screen using the line interrupt (uses Chapter 4).

12. **The Tilemap**
    - 40×32 and 80×32 layouts, tile definitions, tilemap palette, attribute
      bytes, transparency.
    - Tilemap scrolling, clipping window, ULA-over-tilemap and
      tilemap-over-ULA modes.
    - **Exercises**: build a small text console using tilemap mode; a
      side-scrolling background.

13. **Hardware Sprites**
    - 128 sprites, 16×16 patterns, 4-bit and 8-bit modes, anchor sprites and
      relative sprites, scaling, mirroring, rotation, "over border".
    - Sprite collision register.
    - **Exercises**: bouncing sprite; sprite swarm using anchor + relative
      sprites.

14. **The Copper: Graphics Co-Processor**
    - The Copper instruction set (`WAIT`, `MOVE`), Copper memory, run modes,
      using the Copper to change palette/scroll registers mid-frame.
    - **Why this comes after every video layer:** the Copper's main job is
      to retime register writes to specific raster positions, which means
      the reader needs to already know which registers are interesting.
    - **Exercises**: Copper-driven gradient sky; mid-screen palette swap
      that would be impossible from Z80 code alone.

15. **Compositing, Priorities, and Layer Combinations**
    - NextReg `0x15` (layer priority), `0x68` (ULA disable), per-pixel
      priority, transparency colour (NextReg `0x14`/`0x4A`).
    - Putting ULA + Tilemap + Layer 2 + Sprites together in one frame.
    - **Exercises**: a mini scene that uses all four layer types
      simultaneously.

### Part VI — Audio

16. **The Beeper and the Border-Sound Heritage**
    - Bit 4 of port `0xFE`, the original Spectrum beeper trick, and why it
      still matters on the Next.
    - **Exercises**: square-wave melody; PWM tone using a tight CTC-paced
      loop (references Chapter 5).

17. **The AY-3-8912 Family: Three Chips, Nine Channels**
    - The classic AY register set, port `0xFFFD`/`0xBFFD`, Turbosound
      selection via NextReg-aware port behaviour, stereo modes (ABC/ACB).
    - **Exercises**: play a tone on each of the three AYs; envelope demo;
      load and play a tracker tune from the example pack.

18. **DACs and Sample Playback**
    - The four 8-bit DACs (left/right, A/B/C/D) on ports `0xFB`/`0xB3`/etc.
    - Driving the DAC from a CTC interrupt (references Chapters 4 and 5).
    - Driving the DAC from the zxnDMA (references Chapter 6).
    - **Why DAC-via-CTC lives here, not in the CTC chapter:** the CTC
      chapter teaches the timer; this chapter applies it. Splitting them
      keeps each chapter focused.
    - **Exercises**: play an 8 kHz raw sample with a CTC interrupt; replay
      the same sample using DMA and compare CPU load.

### Part VII — Storage and the Outside World

19. **NextZXOS, esxDOS, and the SD Card**
    - The dot-command interface, the M_GETSETDRV-style hooks, opening and
      reading files from Z80 code.
    - DivMMC and the alt-ROM (callback to Chapter 3).
    - **Exercises**: read a file from the SD card and display its first
      line; write a small dot-command.

20. **The UART and the ESP WiFi Module**
    - The UART ports (`0x143B`/`0x133B`), baud rate via NextReg, basic
      framing.
    - Talking to the ESP at AT-command level.
    - **Klive note:** Klive emulates the UART loopback / a configurable
      virtual peer; exercises target that surface.
    - **Exercises**: echo characters between a Z80 program and the host
      via the Klive-emulated UART.

21. **The Real-Time Clock and I²C**
    - The I²C bus exposed via NextReg `0x103B`/`0x113B`, reading and
      setting the RTC.
    - **Exercises**: print the current emulated date and time on screen.

### Part VIII — Putting It All Together

22. **Building a Small Game**
    - A capstone chapter that combines: tilemap background, sprite
      character, AY music, DAC sound effects, joystick input, line-interrupt
      status bar. No new hardware — only composition.

### Appendices *(existing, lightly extended)*

- **Appendix A: The NEX File Format** *(existing)*
- **Appendix B: NextReg Reference** *(existing)*
- **Appendix C: I/O Ports Reference** *(existing)*
- **Appendix D: Klive Z80 Assembly Quick Reference** *(new)* —
  directives, expressions, macros, and Klive-specific syntax features
  used throughout the book.
- **Appendix E: Glossary** *(new)* — already required by the writing
  guidelines (`book-writing-guidelines.md`), currently missing.

---

## 3. Dependency Map

A compact view of which chapters each chapter assumes. "→" means "builds on".

```
1 Z80N        → (none beyond Flying Start)
2 I/O+NextReg → 1
3 Memory/MMU  → 1, 2
4 Interrupts  → 1, 2
5 CTC         → 2, 4
6 zxnDMA      → 2, 4
7 Input       → 2
8 ULA         → 2, 3, 4
9 Palettes    → 2
10 LoRes      → 2, 8, 9
11 Layer 2    → 2, 3, 4, 9
12 Tilemap    → 2, 3, 9
13 Sprites    → 2, 3, 9
14 Copper     → 2, 4, 9, 11, 12, 13
15 Compositing→ 8, 9, 10, 11, 12, 13
16 Beeper     → 2, 5
17 AY         → 2
18 DAC        → 2, 4, 5, 6
19 Storage    → 2, 3
20 UART       → 2
21 RTC/I²C    → 2
22 Game       → 7, 12, 13, 17, 18, plus interrupts
```

Every back-reference is one or two chapters away at most, except where a
later chapter (Copper, Compositing, Game) deliberately ties many threads
together.

---

## 4. Resolving the Stated Dilemmas

### CTC vs. Interrupts vs. DAC

Your specific question: should CTC live inside Interrupts? Inside DAC?
Should it be split?

**Recommendation: keep one CTC chapter, place it after Interrupts, and
have Audio/DAC reference it.**

Reasoning:

- **CTC is a peripheral, not an interrupt source.** Its three real jobs —
  measuring elapsed time, generating periodic events, and cascading for
  long intervals — are all coherent under one roof. Splitting "CTC for
  timing" from "CTC for interrupts" forces the reader to learn the same
  register layout twice.
- **Interrupts are a CPU concept.** The Interrupts chapter belongs to the
  CPU side: IM0/IM1/IM2, the I register, the Next's interrupt controller.
  It teaches the *mechanism*. CTC is one of many *sources*.
- **DAC-via-CTC is an application of CTC, not a redefinition of it.**
  Putting DAC sample playback inside the CTC chapter would derail the
  narrative ("we were learning about timers — why are we suddenly emitting
  audio?"). Putting it in the Audio chapter, with an explicit
  "this uses Chapter 5" reference, keeps both chapters readable on their
  own.

This is a direct application of principle #4 ("one concept, one home").

### NextRegs: dedicated chapter or scattered?

**Recommendation: dedicated chapter (Chapter 2), with a *reference table*
of "NextRegs introduced in this chapter" at the end of every later
chapter that touches new ones.**

NextRegs are touched by every other chapter. Explaining the access
mechanism repeatedly would be wasteful; relying on Appendix B alone would
be too cold. A short focused chapter plus a "NextRegs in this chapter"
recap gives the right rhythm.

### Palettes: with each video layer or standalone?

**Recommendation: standalone (Chapter 9), inserted between ULA and the
new layers.**

The same palette mechanism feeds ULA (when palette mode is enabled),
LoRes, Layer 2, Tilemap, and Sprites. Teaching it once, immediately after
the reader has seen *something* coloured (ULA in Chapter 8), means every
subsequent video chapter can say "configure its palette as in Chapter 9"
in a single sentence.

### Copper: where?

**Recommendation: after every regular video layer, before Compositing.**

The Copper has nothing interesting to do until the reader knows which
registers are worth retiming. Placing it last among the "single-layer"
chapters lets each Copper example actually demonstrate something
visually striking.

### Memory: one chapter or split?

**Recommendation: one chapter (Chapter 3).**

The MMU, legacy paging ports, and physical-vs-logical model are tightly
coupled. A single chapter that introduces all of them and finishes with a
"memory probe" exercise gives the reader a lasting mental model. Specific
uses (Layer 2 banks, sprite pattern storage, AY tracker memory) are
referenced inline from the relevant later chapters.

---

## 5. Migration Plan from Today's Draft

Current state of `docs/pages/book/`:

```
preface.mdx
introduction.mdx
flying-start.mdx
z80n.mdx
next-hardware.mdx           ← contains I/O + NextRegs + CTC together
zxndma.md
app-A-nex-file-format.md
app-B-nextreg-reference.md
app-C-io-ports-reference.md
book-writing-guidelines.md
```

### 5.1 Structural changes

1. **Split `next-hardware.mdx`** into two files:
   - `io-and-nextregs.mdx` — Chapter 2 of the proposed TOC. Keep all the
     I/O addressing and NextReg material; move the keyboard-row example
     out (it belongs in the future Input chapter — leave a placeholder
     stub or a TODO comment).
   - `ctc.mdx` — Chapter 5. Move the CTC sections here. Add the
     three-uses framing and a forward reference to the future Audio
     chapter.
2. **Rename for consistency:** all chapter files use `.mdx` (the existing
   `zxndma.md` and the appendices use `.md`). Decide one way and migrate.
   Recommended: `.mdx` for chapters (so they can use `<Callout>` and
   `<ClickableImage>`), `.md` for appendices that are pure reference.
   `zxndma.md` should become `zxndma.mdx`.
3. **Create stub files** for every new chapter listed in §2 above, even if
   only with a title and a one-paragraph "what this chapter will cover"
   note. This makes the TOC in `book.mdx` complete and lets the reader
   see the road ahead.
4. **Add `glossary.md`** in `docs/pages/book/`. The writing guidelines
   already require it; it doesn't exist yet. Seed it with the terms
   defined in `book-writing-guidelines.md` (Memory region, Bank, Page,
   Slot, MMU, NextReg) plus terms already used in the existing chapters
   (M1, T-state, ULA, Z80N, NEX, CTC, DMA, Layer 2, Tilemap, Copper).

### 5.2 Edits to existing chapters

- **`introduction.mdx`** — no structural change. Optional: trim the
  Kickstarter history if it grows further; it currently competes for
  attention with the technical introduction.
- **`flying-start.mdx`** — add a short "what each chapter assumes"
  paragraph mirroring the dependency map in §3.
- **`z80n.mdx`** — already in good shape for Chapter 1. Add a closing
  pointer to the new Chapter 2.
- **`next-hardware.mdx`** — to be split as described in §5.1.
- **`zxndma.md`** — already a strong Chapter 6. After Chapter 4
  (Interrupts) exists, add a short subsection on the DMA-end interrupt;
  after Chapter 18 (DAC) exists, add a forward pointer to the
  DMA-driven audio example.
- **Appendices** — no content change needed yet; add Appendix D and E as
  described in §2.

### 5.3 Update `book.mdx`

Replace the current short list with the full TOC of §2, grouped under
the eight parts. Each entry links to its file (real or stub). This makes
the reader's path through the book obvious from the landing page.

### 5.4 Suggested order of execution

A pragmatic sequence that keeps the published book usable at every step:

1. Add `toc.md` (this file). *Done by this change.*
2. Create `glossary.md` from the seed list above.
3. Split `next-hardware.mdx` into `io-and-nextregs.mdx` and `ctc.mdx`,
   update internal links.
4. Rewrite `book.mdx` with the full TOC and stubs for missing chapters.
5. Write Chapter 3 (Memory) — unblocks several later chapters.
6. Write Chapter 4 (Interrupts) — unblocks CTC, video, audio.
7. Write Part V (Video) end to end, ULA → Compositing.
8. Write Part VI (Audio).
9. Write Part VII (Storage / UART / RTC).
10. Write the capstone game chapter.
11. Backfill Appendices D and E as material settles.

---

## 6. Open Questions for You

Before any of the above is executed, please confirm or adjust:

1. **Scope of "stock Next."** Is the assumption "Issue 2 board, no Pi
   accelerator, no expansion peripherals" correct for the exercises? If
   the Pi accelerator is in scope, we should add a short chapter under
   Part VIII.
2. **NextZXOS depth.** Do you want Chapter 19 to teach writing dot
   commands in any detail, or just file I/O from a NEX program?
3. **Capstone game.** Is a top-down "walk a sprite around a tilemap"
   demo enough, or do you have a specific game-flavour in mind (shooter,
   platformer, puzzle)?
4. **Klive UART/RTC fidelity.** Do the exercises in Chapters 20 and 21
   need to be adjusted to match what Klive currently emulates, or are
   you planning to extend Klive to support them as you write the book?
5. **`.md` vs `.mdx` for appendices.** Confirm the recommendation in
   §5.1 is acceptable, or pick a single extension.
