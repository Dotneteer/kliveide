# Sprite-Attribute Breakpoints: the Sprite Half of G3.8

Status: **implemented** (2026-10-08). The decisions below were made during the implementation,
following the Copper half's shape ([COPPER_DEBUGGING_PLAN.md](COPPER_DEBUGGING_PLAN.md) §4.6–§4.8)
and the NextReg write breakpoints ([NEXTREG_WRITE_BREAKPOINTS_PLAN.md](NEXTREG_WRITE_BREAKPOINTS_PLAN.md)).

Scope: [CLOSING_THE_GAPS_PLAN.md](CLOSING_THE_GAPS_PLAN.md) **G3.8**, the half left open by the Copper
plan: *stop when a sprite attribute is written*. It fills the Sprite Inspector's reserved row-menu
slot ([SPRITE_INSPECTOR_PLAN.md](SPRITE_INSPECTOR_PLAN.md) §1.2).

Hardware reference: `_input/next-fpga/src/video/sprites.vhd` (port `$57` ~641-664, the mirrors
~596-616). The C engine `zxnext-sprites.c` mirrors it and is changed only by the watch hook.

---

## 1. Why `nr:` was not enough

The stop-gap was a NextReg write breakpoint on the attribute mirrors (`nr:$35`-`$39`, `$75`-`$79`).
It missed most writes: the usual upload path is port `$57` (`OUT`/`OTIR`, or the DMA streaming a
table into it), and a mirror breakpoint names a register, not a sprite - the sprite is whatever `$34`
selected, so "stop when sprite 12 moves" could not be said at all.

## 2. Decisions

| # | Decision |
| --- | --- |
| D1 | **A sprite breakpoint names a sprite**, `sp:$00`-`sp:$7F`. Key `SP:$0C`. An event breakpoint like `nr:` and `cu:`: no address, no partition, no gutter (`isEventBreakpoint`). |
| D2 | **It fires on every store of an attribute byte**: port `$57` by the CPU or the DMA, and the `$35`-`$39`/`$75`-`$79` mirrors by the CPU, the DMA or the Copper. Selecting a sprite (`$303B`, `$34`) is not a write. Writes with no origin (the IDE's direct NextReg writes, reset branches) are never reported, as with `nr:`. |
| D3 | **All writers report by default**, unlike `nr:`'s CPU-only default. A Copper or DMA writing sprite attributes is deliberate multiplexing, and "who changed sprite 12?" is the question; the stop message names the writer. |
| D4 | **`-attr <list>` narrows it to some of the five bytes** (`0,1`, `0-3`). Stored as `spriteAttrMask` (bit *n* = byte *n*), absent for all five. **Not part of the identity**, like `nextRegCopper`: `bp-set` on the same sprite updates it in place, so `bp-del sp:$0C` needs no filter. |
| D5 | **A four-byte sprite's skipped attr4 is not a write** (the hardware advances past it without storing), so a breakpoint on byte 4 does not fire for it. |
| D6 | **The core does the matching** (128 bytes, one 5-bit mask per sprite, exact) and latches the **first** hit since it was last taken, with the byte's previous value and the origin. The debug loop takes it after each Z80 instruction; the machine stops at its end. A DMA burst or an `OTIR` reports the earliest write; the next is reported on the next run. |
| D7 | **G1 features apply unchanged** through `DebugSupport.handleHit`: hit counts, logpoints, one-shots. In a condition `ADDR` is the attribute byte (0-4) and `VAL` the value written (access kind `"sprite"`; the checker bounds `ADDR` to 4). |
| D8 | **`run-to sp:<sprite>`** is a one-shot, the Sprite Inspector's *Run until attribute write*. |
| D9 | **The Sprite Inspector's row menu** offers *Break on attribute write* / *Remove attribute-write breakpoint*, *Edit breakpoint…* and *Run until attribute write*; a sprite with a breakpoint shows the Copper List's gutter dot before its number. Every action goes through the `bp-*` commands. |

## 3. Implementation map

| Concern | Where |
| --- | --- |
| Watch, latch, origin | `zxnext.c` (`zxnextSpriteWatch[128]`, `zxnextSpriteWatchArmed`, `zxnextSpriteHit`, `zxnextSpriteWriteFromDma`; exports `zxnextSpriteWatchPtr`, `zxnextSetSpriteWatchArmed`, `zxnextTakeSpriteHit`); hook `zxnextSpritesCheckWatch` in `zxnext-sprites.c` on both store paths; the DMA labels its I/O write in `zxnext-dma.c` |
| Packing | bit 31 present; 26-28 origin (1 port/CPU, 2 DMA, 3 mirror/CPU, 4 mirror/Copper); 18-25 new; 10-17 old; 7-9 attribute; 0-6 sprite |
| Build and contract | `scripts/build-zxnext-wasm.cjs` (exports, volatile statics: debugging state, never restored), loader view `spriteWatch`, `reverse/exportContract.ts` (`debug`) |
| Model | `BreakpointInfo.spriteIndex` / `spriteAttrMask`; `isSpriteBreakpoint`, `spriteAttrMaskOf` (`breakpoint-scope.ts`); key in `breakpoints.ts` |
| Host | `DebugSupport.hasSpriteBreakpoints` / `buildSpriteWatch` / `hasSpriteHit`; `ZxNextWasmV2Machine` pushes the watch on loop entry, `acceptWasmV2SpriteHit`, `lastSpriteWrite` in `getCpuState` (`SpriteWriteEvent`); stop message `describeSpriteStop` (`common/zxnext/sprites/spriteBreakpoints.ts`) |
| UI | `BreakpointCommands` (`sp:`, `-attr`), `RunToCursorCommand`, `breakpoint-form` (kind `sprite`), `BreakpointDialog` (sprite field + five byte checkboxes), Breakpoints panel group *Sprite attribute* with the hit's `attr n $old → $new` and writer, icon `bp-sprite`, `useSpriteBreakpoints` + `SpritesTable` |
| Tests | `test/zxnext-hw/sprites/attribute-watch.test.ts` (core, every writer), `test/wasm/zxNext/wasm-next-sprite-breakpoint.test.ts` (debug loop), `test/debug/spriteBreakpoints.test.ts`, `test/commands/SpriteBreakpointCommands.test.ts`, form/dialog/grouping/inspector additions |
| Docs | `working-with-ide/breakpoints.mdx` (Sprite Attribute Breakpoints), `sprite-inspector.mdx`, `commands-reference.mdx` |

Reverse Continue needed nothing of its own: it replays the past through the same debug loop, so it
finds the last sprite write as it finds the last NextReg write
(`test/emu/reverse-next-breakpoints-controller.test.ts`).

## 4. Not done

- **Pattern writes** (port `$5B`) are not watched. Pattern uploads are usually one-off and large; a
  memory-style "break on pattern N written" can follow if asked for.
