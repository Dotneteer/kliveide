# Next Palette Debugging Plan (palette breakpoints and the Palette document)

Status: **accepted** (2026-11-20; §9 answered). Phases 1 and 2 built (§5.1, §3.5) on `feature/next-palette-debugging`; Phase 3 next. Mockups:
`dev/plans/palette-debugging/PALETTE_DEBUGGING_MOCKUPS.html`.

## 1. What exists today

### 1.1 Does the Next Palettes panel follow palette changes?

**Yes, by polling, never by event.** `PalettePanel` (`src/renderer/appIde/SideBarPanels/PalettePanel.tsx`)
subscribes to `useEmuStateListener` (`src/renderer/appIde/useStateRefresh.ts`), the shared 100 ms poll
of `getCpuStateChunk`. Each refresh re-reads all eight banks (`getPalettedDeviceInfo`, 2048 entries)
and re-renders:

| Machine state | When the panel refreshes |
| --- | --- |
| Paused (a stop, a step) | at once, because PC/tacts changed |
| Running | at most every 750 ms |
| Nothing changed | every 5 s |

So the panel *is* current after every stop, but:

- **While running it shows one sample in ~40 frames.** A fade, a palette cycle or a Copper raster
  effect (a `$41` write per line) is invisible: the panel shows whatever the palette was at the sample.
- **It cannot say *what* changed.** There is no previous-state diff, no write counter and no record
  of who wrote. After a stop you see the new colours and have to remember the old ones.
- **A change that moves no CPU state is picked up only by the 5 s fallback** (an IDE-side write while
  paused, e.g. a script or the palette editor writing the machine).
- The `useNextDevicePalette` hook (Sprite/Tilemap/Layer 2 inspectors) has the same cadence.

### 1.2 How the machine writes a palette

All in `src/emu/machines/zxNext/wasm/zxnext/zxnext-palette.c`. Eight 256-entry banks (slots):
0 ULA 1, 1 Layer 2 1, 2 Sprites 1, 3 Tilemap 1, 4 ULA 2, 5 Layer 2 2, 6 Sprites 2, 7 Tilemap 2.
An entry is written through an **indirect protocol**, which is the reason a plain NextReg breakpoint
is a poor tool here:

| Path | What it writes | Who can drive it |
| --- | --- | --- |
| `$41` | the entry at `$40`'s index in the bank `$43` bits 6-4 select (8-bit colour) | CPU (port `$253B`, `NEXTREG`), Copper |
| `$44`, 2nd byte | the same entry, 9-bit colour plus the Layer 2 priority bits; the 1st byte is only stored | CPU, Copper |
| port `$FF3B` (ULA+) | ULA entries `$C0-$FF` of the bank `$43` bit 6 selects | CPU, DMA |

And the **live bank** (what the screen draws with) moves without any entry being written: `$43`
bits 1-3 (ULA, Layer 2, Sprites) and `$6B` bit 4 (Tilemap).

`bp-set NR:$41` exists today, but it stops on *every* palette write, cannot say which device, bank or
entry is meant (that depends on `$40` and `$43` at the moment of the write), misses the second `$44`
byte's meaning and ULA+ entirely.

## 2. Does a palette change deserve a breakpoint?

**Yes.** The reasons, in the order they matter:

1. **The question is real and common.** "Who turned my background magenta?", "which routine
   overwrites sprite colour 3?", "why does the fade stop half way?". The answer is a PC and a call
   stack at the moment of one particular write, which only a stop can give.
2. **Nothing else answers it.** The target is computed state (`$40` index + `$43` select at write
   time), not an address or a register, so neither a memory, an I/O nor an `NR:` breakpoint can name it.
   This is exactly the case the sprite-attribute breakpoints (`SP:`) were built for: a machine *event*
   with an identity of its own.
3. **It is cheap in the core.** The sprite watch is the template: a watch table pushed by the host, an
   armed flag that keeps the write path free when no `PAL:` breakpoint exists, and a first-hit latch.
   For palettes the table is one bit per entry: 8 x 256 bits = 256 bytes.
4. **It completes the Next hardware stops.** NextReg, Copper, sprite, interrupt and DMA stops exist;
   the palette is the remaining display state a program changes behind your back.

A **live-bank flip** (`$43`/`$6B`) deserves a stop too, as an option of the same kind: switching banks
changes every colour on screen without one entry write.

## 3. The breakpoint (`PAL:`)

### 3.1 Spec

```
bp-set PAL:<device>[<bank>][:<entries>] [-c] [-changed] [-hit ..] [-if ..] [-log ..]
bp-set PAL:<device>:LIVE             ; the device's live bank flips
```

| Part | Values | Meaning |
| --- | --- | --- |
| device | `ULA`, `L2`, `SPR`, `TM`, `ANY` | the palette-owning device |
| bank | `1`, `2`, absent | absent = both banks |
| entries | `$07`, `$00-$0F`, absent | absent = all 256 |
| `-c` | flag | also stop on Copper writes (as `NR:`'s `-c`); off by default |
| `-changed` | flag | stop only when the stored 9-bit value (plus priority bits) actually differs |

Examples: `PAL:SPR1:$03`, `PAL:L2:$00-$0F -changed`, `PAL:ULA2`, `PAL:TM:LIVE`, `PAL:ANY -c`.
`P` is not a hex digit, so `PAL` cannot collide with a partition label (the rule `SP:`/`DMA:` follow).

### 3.2 Identity

`BreakpointInfo.paletteStop?: string`, the normalized spec after `PAL:` (`SPR1:$03`,
`L2:$00-$0F`, `TM:LIVE`), like `interruptStop`/`dmaStop`: the binding, the discriminator and the
identity; `isPaletteStop` in `@common/utils/breakpoint-scope`. `-c` and `-changed` are **not** part of
the identity (a second breakpoint differing only in them is one breakpoint updated in place, the
`nextRegCopper`/`spriteAttrMask` precedent).

### 3.3 Core

- `zxnextPaletteWatch[8][32]` (one bit per entry), `zxnextPaletteWatchLive` (4 bits),
  `zxnextPaletteWatchArmed`, `zxnextPaletteWatchFlags` (Copper, changed-only) and a first-hit latch
  `zxnextPaletteHit` (slot, index, old value, new value, origin), pushed and armed like the sprite watch.
- Checked in the three write paths **before** storing, so the latch carries the old value. Writes with no
  origin (reset, the IDE's own writes) are never reported, as for every other Next stop.
- Origins: CPU via NextReg, Copper, CPU via `$FF3B`, DMA via `$FF3B` (and DMA via `$253B` if the core
  routes it, §9 Q4).
- The live-bank watch compares the device's bank bit before and after a `$43`/`$6B` write.
- A core candidate in `z80-debug-loop.c`, with `test/wasm/debug-loop-equivalence.test.ts` proving the
  in-core run stops where the instruction-by-instruction one does (the WASM rule). The watch tables are
  volatile.

### 3.4 What a stop says

```
Palette write: Sprites bank 1, entry $03   $1C7 -> $003   (CPU, NEXTREG $41)   at $8123
Palette bank flip: Tilemap now draws with bank 2   (Copper, $6B)   at $8F40
```

The Breakpoints panel lists it under the hardware stops; the condition language gets
`palIndex`, `palSlot`, `palOld`, `palNew` alongside the existing accessed-value names (§9 Q3).

### 3.5 As built (Phase 2, 2026-11-20)

- **Spec module** `src/common/zxnext/palette/paletteStops.ts`: parse/format, the core watch
  (`buildPaletteWatch`), the hit decoder, matching, `-c`/`-changed` (`passesPaletteOptions`), the
  condition packing (`paletteHitAccess`) and the stop message. `PAL:` key, `bp-set`/`bp-del`/`bp-en`
  (`-changed` is a new command option; `-c` now also means Copper for `pal:`), `bp-list` round trip.
- **Instruction by instruction, not a core candidate.** Like the sprite watch (`canRunInCore` is false
  while a `pal:` breakpoint is armed), so the stop names the writing instruction from `opStartAddress`
  and no debug-loop equivalence test was needed. A debug run with a palette breakpoint therefore runs
  in TypeScript; the plan's §3.3 core-candidate idea is not built.
- **Core** (`zxnext-palette.c`): `zxnextPaletteWatch` (one bit per entry), `zxnextPaletteWatchFlags`
  (armed, Copper, any-write, live devices in bits 4-7) and a first-hit latch with the old and new
  value; checked in `zxnextPaletteStore` (paths `$41`, `$44`, `$FF3B`), the `$43` live bits and
  `$6B` bit 4. All volatile; the exports are `debug`/`pure` in the reverse-debugging contract (and
  `ClearPaletteDirty` from Phase 1 moved from the default "journaled" to `debug`).
- **Origins** (§9 Q4 answered): the DMA flag the core raises around every DMA port write marks a DMA
  write to `$253B` or `$FF3B` as the DMA's; a CPU write through `$FF3B` is `port`.
- **Union filtering.** The core reports Copper writes when any armed breakpoint has `-c`, and writes of
  the stored value when any has no `-changed`; `DebugSupport.hasPaletteHit` applies each breakpoint's
  own. The latch keeps the first hit of an instruction, so in the rare case a rejected write precedes
  an accepted one in the same instruction, the second is not seen (as for the other Next latches).
- **Conditions**: `VAL` the new stored value (11 bits), `ADDR` = old << 16 | slot << 8 | entry;
  `palNew`, `palOld`, `palSlot`, `palIndex` resolve to expressions over them, only on a palette
  breakpoint (elsewhere they stay label names). No new evaluator opcode in any core.
- **UI**: the Breakpoints panel (Palette group, `bp-palette` glyph, the hit's before/after and
  writer, tooltip lines), the breakpoint dialog's palette kind (device, stop when, bank, entries,
  `-changed`, `-c`), `run-to` withdrawn on a `pal:` row.
- **Tests**: `test/commands/PaletteStopCommands.test.ts` (spec, conditions, command, form),
  `test/wasm/zxNext/wasm-next-palette-breakpoint.test.ts` (CPU writes, `$44`-free paths, ULA+, flips,
  `-changed`, conditions, hit counts), `test/zxnext-hw/palette/palette-breakpoint-copper.test.ts`
  (the Copper and `-c`). Checked in an isolated IDE run: `bp-set`, `bp-list`, two stops (an entry
  write, then a flip, the unchanged rewrite between them skipped) and the panel rows.
- **Not covered by a test**: a DMA write end to end (the decoder and the origin rule are tested
  separately).

## 4. The Palette document (popped out of the panel)

A machine document, `NEXT_PALETTE_EDITOR`, opened by a **pop-out button** in the Next Palettes
panel's header (and by `pal-open`). It can float like any document
(`FLOATING_DOCUMENT_WINDOWS_PLAN.md`, Phase 4 volatile documents).

Layout (mockup 2):

- **Device strip**: ULA / Layer 2 / Sprites / Tilemap tabs, each with its live-bank chip and a
  change dot when something was written since the last stop.
- **Banks side by side**: both banks of the selected device as 16x16 grids, the live one marked;
  transparency index outlined (sprites, tilemap) and `$14` matches hatched (ULA, Layer 2).
- **Changed since last stop**: entries written since the previous stop get an accent ring; the old
  colour shows as a corner triangle, so before/after is visible without a log.
- **Entry details**: index, 9-bit RGB333, `$41` byte, `$44` pair, Layer 2 priority, CSS colour,
  "last written at PC / frame / by", and the actions *Break on writes to this entry*, *Break when it
  changes*, *Copy `bp-set`*. Same actions in the swatch's context menu; watched entries carry a
  breakpoint dot.
- **Follow changes** toggle: on, the view jumps to the device and bank of the latest write.
- **Write log** (Phase 4, optional): a ring of recent writes (frame, line, PC, origin, slot, index,
  old, new), filterable by device; click a row to select the entry.

The sidebar panel stays the compact overview; the document is where palettes are debugged (the
Copper panel / Copper List split, `COPPER_DEBUGGING_PLAN.md` D16).

## 5. Fixing the refresh (cheap, independent)

- A **palette generation counter** in the core (incremented by every stored write and every live-bank
  flip) returned with the state chunk, so the panel and the inspectors refresh when it changes even
  if PC/tacts did not, and skip the 2048-entry read when it did not.
- A **dirty bitmap** (one bit per entry since the host last took it) so the panel and the document
  can mark "changed since last stop" without the host diffing 2048 values.

### 5.1 As built (Phase 1, 2026-11-20)

- **Core** (`zxnext-palette.c`): every entry store goes through `zxnextPaletteStore`, which counts
  `zxnextPaletteGeneration` and sets the entry's bit in `zxnextPaletteDirty` (slot * 32 + index / 8).
  The count also moves on a change of `$43` bits 0-3, of `$6B` bit 4 and on every reset; selecting a
  bank to write does not move it. The count is machine state (a fast frame and a debug run count the
  same writes); the bitmap is volatile (`build-zxnext-wasm.cjs`). Exports:
  `zxnextGetPaletteGeneration`, `zxnextGetPaletteDirtyByte`, `zxnextClearPaletteDirty` (returns
  whether any bit was set).
- **Version** (`ZxNextWasmV2Machine.getPaletteVersion`): `epoch * 2^32 + generation`. The epoch is
  shared by every Next instance and renewed on each of the three restore paths (`restoreHostState`,
  `loadMachineState`, `tryRestoreCheckpoint`) and when a run start clears marks, so a version a
  reader saw never names another palette: not across a machine rebuild, a restore that lands on the
  same write count, or a cleared bitmap.
- **"Since the last stop"**: `IAnyMachine.onRunStart` (new, optional), called by
  `MachineController.run` for every start, continue and step. While running the marks read "since
  the run started".
- **IDE**: `EmuApi.getPaletteVersion`; `CpuStateChunk.paletteVersion`, so the state listener
  refreshes panels when only the palette changed; `PaletteDeviceInfo.version` and `.written`.
  `readNextPalette` (`features/next-palette/nextPaletteRead.ts`) returns the previous read itself
  while the version is unchanged; the Next Palettes panel and `useNextDevicePalette` use it. The
  panel shows the `--color-state-changed` dot after a written device's name, the count per bank in
  its tooltip.
- **Tests**: `test/zxnext-hw/palette/palette-change-tracking.test.ts` (harness; `session.beginRun()`
  is the run start), `test/renderer/nextPaletteRead.test.ts`, `test/controls/PalettePanel.test.tsx`.
  Checked in the running IDE with an isolated launch: a program writing two sprite entries marked
  exactly those, and the next run cleared them.

## 6. Decisions (proposed; confirm or change in §9)

- **D1** One breakpoint kind, `PAL:`, with the live-bank flip as a sub-form, not two kinds.
- **D2** Copper writes are opt-in (`-c`), as for `NR:`; CPU and DMA writes always count.
- **D3** `-changed` filters same-value rewrites (a palette upload loop rewrites unchanged entries).
- **D4** The document is a viewer and debugger, not an editor; editing stays in the palette editor.
- **D5** No palette history in the core beyond the dirty bitmap and the optional write log ring;
  reverse debugging already restores palette state through checkpoints.

## 7. Phases

| Phase | Content | Visible result |
| --- | --- | --- |
| 1 | Generation counter, dirty bitmap, panel/inspector refresh on change | panel never stale after a stop, change dots |
| 2 | Core watch, latch, debug-loop candidate; `PAL:` in `bp-set`/`bp-list`, keys, Breakpoints panel, stop report, condition names | palette breakpoints |
| 3 | The Palette document, pop-out button, entry details, context-menu breakpoints, Follow | the document |
| 4 | Write log ring (volatile) and its table | who wrote what, in order |
| 5 | Docs (Guides page with generated shots), i18n keys, changeset, competitive analysis row | finished |

Tests: `test/zxnext-hw/palette/` through the harness (each write path and origin, `-changed`,
bank flips, every profile via `forEachProfile`), the equivalence test, spec parse/format round trips,
the document's view model without rendering.

## 8. Risks

- **Copper raster palettes hit every line.** Off by default (D2) and the latch reports the first hit
  per run, like the sprite watch.
- **`$44` is two writes.** Only the second stores; the stop is reported there, and its report shows
  both bytes.
- **ULA+ and ULANext indexing.** The entry is reported as the bank index the hardware stores, with a
  ULA+ note for `$C0-$FF`.

## 9. Questions for the project author (answered 2026-11-20: the proposals were accepted)

1. Spec spelling: **`PAL:SPR1:$03`** (device and bank glued).
2. **`-changed` is a flag, off by default** (D3); every write stops unless it is given.
3. **`palSlot`, `palIndex`, `palOld`, `palNew`** in the condition language.
4. DMA via `$253B`: **checked in Phase 2**; if the core routes it, it is a DMA origin.
5. **The write log stays, as the optional Phase 4.**
6. **Both stay**: the panel keeps its expand-to-grid as the compact overview; the document is where
   palettes are debugged.
