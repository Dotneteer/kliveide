# Demo program for Volume 1

A Klive IDE project for the ZX Spectrum Next. It builds one `.nex` file, `book-demos.nex`: a
menu by part, and one demo for each chapter that has something to show. The plan for the whole program,
including the list of demos, is in [guidelines/examples-plan.md](../guidelines/examples-plan.md).

## Running it

Open this folder in Klive IDE as a project and use **Run**. Klive builds the `.nex` file, boots
NextZXOS and loads it. The first screen lists the four parts of the book; pick one with its key.
The part's screen lists its demos in book order, the ones not written yet in blue. Pick a demo
with its key, or press SPACE to go back to the parts. Every demo ends with "Press any key for the
menu", which returns to the part's screen.

From a terminal, with the `klive` command installed (Klive IDE › Install Command Line Tool...):

```bash
klive build examples
```

```bash
klive run examples --wait-frames 50 --keys 13 --frames 50 --screenshot demo.png
```

`klive run` injects the code into a reset machine instead of booting NextZXOS, so the shell
pages in the 48K ROM itself (it prints with that ROM's font).

## Layout

| Path | What it holds |
|---|---|
| `code/main.kz80.asm` | The entry point, the memory map, the bank table, the part and demo tables |
| `code/shell/` | The menu and the reset between demos |
| `code/lib/` | Routines the demos share: text, keys, NextReg reads, AY writes and silencing, and read-only SD access |
| `code/demos/1-machine/` … `4-world/` | One folder per part of the book; one file per demo, named after the demo |

Every demo the plan names already has its file. A demo that is not written yet is a stub: its
title, a header that names its chapter and what it will show, and an entry point that jumps to
`NotWritten`. Its entry in the demo table is marked `Planned`.

## The rules every demo follows

1. **Entry.** The shell calls the demo's entry point with the CPU at 28 MHz, interrupts on (IM2,
   one interrupt per frame, counted in `Frames`), the ULA screen cleared to PAPER 7, INK 0, and
   the 48K ROM paged in at `$0000`.
2. **Exit.** The demo ends with `call WaitForMenu` and `ret`, with the stack as it found it. A
   demo that runs until a key is pressed calls `ShowMenuFooter` and `WaitNoKey` before its loop
   (the menu's key may still be down), and ends with `jp WaitNoKey`; Input Monitor, which shows
   every key, ends on BREAK instead.
3. **Restore.** Before it returns, the demo undoes what it changed: NextRegs, palettes, clip
   windows, scroll offsets, sound chips, the DMA, the CTC. `shell/reset.kz80.asm` switches off
   the big switches as a safety net, but a demo must not rely on it.
4. **Memory.** Shell and demos live in bank 2 (`$8000`–`$BCFF`). `$BD00`–`$BFFF` belongs to the
   shell (stack, IM2 table, interrupt jump). A demo that needs more room or data gets banks of
   its own with `.bank`, listed in the bank table at the top of `main.kz80.asm`. Banked data
   goes in a separate file, `<demo-name>-data.kz80.asm`, included at the very end of
   `main.kz80.asm`: after a `.bank` pragma, everything that follows belongs to that bank. A demo
   that borrows an MMU slot reads its NextReg first and writes the old page back before it
   returns. Scratch buffers can use bank 0 at `$C000`, which the shell pages in. The build stops
   if code and data reach `$BD00` (`CodeEnd` in `main.kz80.asm`). A demo whose **code** does not fit
   keeps it at the start of a bank, in `<demo-name>-code.kz80.asm`, and its entry in bank 2 is two
   instructions: `ld a,<bank>` and `jp CallBank` (`lib/bank.kz80.asm`), which pages the bank in at
   `$C000` and calls it. Pi Audio and Jack Wrap do this. A file that ends in a label must not come
   just before a `.bank` pragma: the label would attach to it.
5. **Labels.** All labels are global. A demo's labels start with a short prefix of its own
   (`Cv` for Core Version, `Fs` for Four Speeds, `Bw` for Bank Window).
6. **Storage is never written.** No demo may write to, erase or reconfigure the SD cards, the
   FPGA's flash, the Wi-Fi module's flash or the clock's RAM. Only `lib/sd.kz80.asm` touches
   ports `$E7` and `$EB`, and only with read commands. No demo writes NextRegs `$02`, `$03`,
   `$A0`, `$A8` or `$A9`. The full rules are in §2.1 of the plan; `make examples-check`
   enforces them.
7. **Header.** Each demo file starts with its name, its chapter (the file under `content/`), what
   it shows, and what it changes.

## Writing a planned demo

1. Replace the stub's two lines after the entry label (`ld hl,...Title` and `jp NotWritten`)
   with the demo's code, and update its header.
2. In `code/main.kz80.asm`, change the demo's `.defb Planned` to `.defb Ready`.
3. If it needs banks, add them to the bank table and include its data file at the end.

## Adding a demo the plan does not name

1. Create `code/demos/<part-folder>/<demo-name>.kz80.asm` with a title (`.defn`) and an entry
   label.
2. `#include` it with its part's demos in `code/main.kz80.asm`.
3. Add `.defw Title, Entry` and `.defb Ready` to its part's demo table, in book order. A part
   screen has room for 16 demos, on keys 1–9, then A–G.
