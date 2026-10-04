# Copper Debugging Plan: List Viewer, Copper Breakpoints and `.copper` Pragmas

Status: **decisions recorded** (2026-10-04): D1–D9 accepted, and the §8 questions answered as
proposed (D10–D17). No phase started. Q4 and Q5 are deferred to
[NEXTREG_NAMES_AND_COPPER_SHORTHANDS_PLAN.md](NEXTREG_NAMES_AND_COPPER_SHORTHANDS_PLAN.md).

Scope:
- [CLOSING_THE_GAPS_PLAN.md](CLOSING_THE_GAPS_PLAN.md) **G3.1**, the Copper list viewer.
- The **Copper half of G3.8**: stop when the Copper reaches an instruction. Sprite-attribute
  breakpoints, the other half of G3.8, are not in this plan.
- A new item proposed for the roadmap: a **`.copper` pragma** in the Klive Z80 Assembler, modelled on
  the `.dma` pragma.

Mockup: [mockups/copper-debugging.html](mockups/copper-debugging.html). It shows the side-bar panel,
the Copper List document with the raster ruler, a Copper breakpoint stop, the breakpoint dialog's
Copper kind, and the `.copper` source with hover.

Related plans:
- [NEXTREG_WRITE_BREAKPOINTS_PLAN.md](NEXTREG_WRITE_BREAKPOINTS_PLAN.md). It is implemented, and it is
  the template for this plan's core watch table, latch and key. It already gives `nr:$xx -c`
  ("also break on Copper writes"), which this plan does not duplicate.
- [CONDITIONAL_BREAKPOINTS_PLAN.md](CONDITIONAL_BREAKPOINTS_PLAN.md) and
  [ASSERTIONS_WATCHPOINTS_ONE_SHOT_PLAN.md](ASSERTIONS_WATCHPOINTS_ONE_SHOT_PLAN.md). Hit counts,
  conditions and one-shots (`runTo`) apply to Copper breakpoints unchanged.
- The `.dma` pragma's original plan, which survives only in git history:
  `git show ecca1fa1a:src/main/z80-compiler/plan.md`.

Hardware reference: `_input/next-fpga/` (`copper.vhd`, `zxnext.vhd`, `zxula_timing.vhd`). The C
engine `src/emu/machines/zxNext/wasm/zxnext/zxnext-copper.c` already mirrors it and is not changed
except for the hooks in §4.6.

---

## 1. What is being added, and why

The Copper is the Next feature that is hardest to debug blind:
- It runs a program of up to 1024 two-byte instructions from its own 2K RAM, which the Z80 cannot
  read back.
- It runs at 28 MHz, locked to the beam, so its effects are tied to a raster position, not to a
  point in the Z80 program.
- A mistake shows only as a wrong picture. Typical mistakes are an off-by-one WAIT, a MOVE to the
  wrong register, a list without a terminating HALT, or a CPU upload that tears a running list.

Today Klive shows **nothing** of the Copper:
- No panel reads its state, although the core exports most of it (`zxnextGetCopper*`,
  `zxnextCopperRead`). Only `test/wasm/zxNext/wasm-next-copper-integration.test.ts` calls those
  exports.
- The only Copper-aware debugging is `bp-set nr:$xx -c`, which stops when the Copper writes a given
  register.
- The only assembler support is `.savenex copper "file"`. Lists are written as raw `.defb` bytes.
  Klive's own visual tests define `CuWait`/`CuMove`/`CuHalt` macros
  (`test/visual/copper/_include/copper-macros.z80asm`) to get around that.

The competitive analysis names Copper inspection as part of the "Next IDE" credibility item (G3).
ZEsarUX has a Copper viewer, but no tool combines a viewer with Copper breakpoints and a
source-level Copper DSL. This plan delivers all three as one feature:
1. **See** the list and the Copper's live state (G3.1).
2. **Stop** on a Copper instruction (G3.8, Copper half).
3. **Write** lists readably, with the viewer and breakpoints mapping back to that source.

### 1.1 Decisions

| # | Decision |
| --- | --- |
| D1 | **Two views, one data source.** A compact **Copper side-bar panel** (Next only) shows the live state and a few instructions around the Copper PC. A **Copper List document** (`$copper`, a singleton special document like `$memory`) shows all 1024 slots with the raster ruler. Both read one `CopperState` snapshot from the emulator. |
| D2 | **One pure decoder**, `src/common/zxnext/copper/copperDecoder.ts`. It decodes WAIT, MOVE, NOP and HALT, the paper-x of a WAIT, NextReg names from `NEXT_REG_DESCRIPTORS`, and the end-of-list analysis. The viewer, the stop message, the Breakpoints panel and the assembler's hover all share it. It has no React and no Node dependency. |
| D3 | **A Copper breakpoint names a Copper list index**, `cu:$000`–`cu:$3FF`. It is an *event* breakpoint like `nr:`: it has no Z80 address, no partition and no gutter in the Z80 disassembly. Its key is `CU:$00B`. |
| D4 | **When it fires:** a MOVE (or NOP) fires when the Copper fetches and issues it. A WAIT fires when its condition is **satisfied**, i.e. when the Copper moves past it, not when it starts waiting. Arriving at a WAIT is the same moment as completing the instruction before it, which can already carry a breakpoint. Completing the WAIT is the moment the user cares about: "the raster has reached line 96". |
| D5 | **The core does the matching**, as for NextReg writes. It keeps a 1024-bit watch table, latches the *first* hit with its beam position, and the debug loop takes it after each Z80 instruction. The machine stops at the end of that Z80 instruction. The Copper keeps running to the end of the instruction, so emulation stays exact, and the stop message and viewer report the **hit** instruction and beam separately from where the Copper is now (trap T1). |
| D6 | **G1 features apply as they are.** Hit counts (`-hit`), conditions, logpoints and one-shots work on `cu:` breakpoints with no new code beyond the dispatch through `DebugSupport.handleHit`. "Run to here" in the Copper List is a one-shot `cu:` breakpoint (`runTo`), and **Step Copper** is a one-shot on "any index" (§4.6). |
| D7 | **`.copper` is a single pragma with sub-commands**, exactly like `.dma`: `wait`, `move`, `nop`, `halt`, `word`. It needs `.model next`. Words are emitted **big-endian** (high byte first), as the Copper reads them. |
| D8 | **The assembler records Copper blocks in the debug info.** A Copper block is a maximal run of consecutive `.copper` emissions. The viewer matches the live Copper RAM against these blocks **by instruction shape** (WAIT vs MOVE plus the register), so a list whose values the CPU patches at runtime still maps to its source. Patched operands are highlighted as *patched* (§4.9). |
| D9 | **The Copper engine is not changed.** It is already cycle-checked against the VHDL by `test/visual/copper/` and `test/zxnext-hw/`. The only additions are the watch hooks, the hit latch and read-only exports. |
| D10 | (Q1) **A WAIT breakpoint fires only on satisfaction** (D4). There is no "on arrival" option; `-a` can be added later if users ask for it. |
| D11 | (Q2) **The Copper List shows a source column** from shape-matched `.copper` blocks (D8, Phase 10). |
| D12 | (Q3) **A gutter click on a matched `.copper` source line creates a `cu:` breakpoint**, resolved when the debugger stops, like a label-anchored breakpoint (§4.9). |
| D13 | (Q4) **No symbolic NextReg names in this plan.** `.copper move` and `nextreg` take numeric registers. Names are a follow-up: [NEXTREG_NAMES_AND_COPPER_SHORTHANDS_PLAN.md](NEXTREG_NAMES_AND_COPPER_SHORTHANDS_PLAN.md) Part A. |
| D14 | (Q5) **No convenience sub-commands in this plan.** The base `.copper` sub-commands stay one-to-one with the hardware encoding, like `.dma`. Shorthands such as `palette` and `waitx` are a follow-up in the same plan, Part B, and expand only to base words. |
| D15 | (Q6) **The assembler does not warn about a block without `halt`**: it cannot know a block is the whole list. The viewer always flags a list that does not end in a HALT (`analyzeCopperList`, §4.1). |
| D16 | (Q7) **The Copper side-bar panel sits next to the Next Registers panel**, in `nextRegPanel`'s host activity. |
| D17 | (Q8) **`test/visual/copper/` keeps its `Cu*` macros.** The fixtures stay stable, and the Phase 1 parity test proves that `.copper` emits the same bytes. |

### 1.2 Out of scope

- Sprite-attribute breakpoints (the other half of G3.8), G3.7 (beam-position overlay on the
  emulator screen) and G3.6 (layer composition). The raster ruler (§4.5) is deliberately
  self-contained, so G3.7 can later reuse its beam data.
- Editing the Copper RAM from the viewer. It is read-only, like the Next Registers panel.
- Decoding Copper lists inside the Z80 disassembly or memory views. A NEX annotation region with
  `rowBytes: 2` already gives a readable layout. Decoding it there is a later, separate change.
- Symbolic NextReg names in assembler expressions (`move NR.PALETTE_INDEX, 16`) and `.copper`
  shorthand sub-commands (D13, D14). Both are in
  [NEXTREG_NAMES_AND_COPPER_SHORTHANDS_PLAN.md](NEXTREG_NAMES_AND_COPPER_SHORTHANDS_PLAN.md).

---

## 2. Current code paths this touches

| Concern | Where |
| --- | --- |
| Copper engine | `src/emu/machines/zxNext/wasm/zxnext/zxnext-copper.c`. WAIT decode at `:265-273` (`line = d & 0x1ff`, `hc = ((d>>9)&0x3f)*8+12`); MOVE at `:274-279` (register 0 = NOP, no pulse); start modes at `:250-258` and `$62` writes at `:105-118`; the write site at `:286-293` |
| Existing exports | `zxnext.c:634-642`; loader `ZxNextWasmV2Loader.ts:213-221` and `:580-588`; build list `scripts/build-zxnext-wasm.cjs:230-237`. **A new export goes in all three.** |
| Pattern to copy for the watch | `zxnextNextRegWatch` + `zxnextNextRegHit*` (`zxnext.c:40-88`), `zxnextNextRegWatchPtr`/`zxnextTakeNextRegHit` (`:488-516`), `zxnextNextRegCheckWatch` (`zxnext-nextreg.c:445-466`) |
| Debug loop | `ZxNextWasmV2Machine.ts:708-715` (push the watch on entry), `:763-777` (take the hit after each instruction), `acceptWasmV2NextRegHit` `:892-920`, `getCpuState` `:1334-1342` |
| Machine contract | `src/emu/machines/zxNext/IZxNextIdeMachine.ts:19-55`; template for "read exports into an object": `getPaletteDeviceInfo` (`ZxNextWasmV2Machine.ts:1400-1420`) |
| Emu API | `src/common/messaging/EmuApi.ts` (`getNextRegState` `:334-350`, `NextRegWriteEvent` `:589-614`); handler `src/renderer/appEmu/MainToEmuProcessor.ts:753-789` |
| Stop message | `MachineController.describeDebugStop` (`MachineController.ts:1396-1434`) |
| Breakpoint model | `BreakpointInfo.ts:66-368` (`nextReg*` at `:239-266`), key `src/common/utils/breakpoints.ts:177-178`, predicates `breakpoint-scope.ts:156`, `DebugSupport.ts:163-183, 446-538, 672-675` |
| Command grammar | `BreakpointCommands.ts`: the `nr:` spec parse `:336-416`, validation `:539-571`, round-trip `:799-822` |
| Dialog and panel | `BreakpointDialog.tsx:171, 284-367`, `utils/breakpoint-form.ts`, `BreakpointsPanel.tsx:100-151, 905-915`, `utils/breakpoint-grouping.ts` |
| Side-bar panels | `registry.ts:231-253` (`nextRegPanel` is the template: `restrictTo: [MI_ZXNEXT]`, `useScrollViewer: false`), `NextRegPanel.tsx`, refresh through `useEmuStateListener` (`useStateRefresh.ts:8-92`) |
| Special documents | `src/renderer/features/documents/specialDocuments.ts:23-59`, `show-memory`/`show-disass` in `ToolCommands.ts:49-130` |
| `.dma` pragma (template) | token `common-tokens.ts:84, 356-359, 684`; parser `common-asm-parser.ts:792-793, 2447-2707`; nodes `tree-nodes.ts:1100-1197`; emission `common-assembler.ts:1982-2021, 3327-3531`; errors `assembler-errors.ts:95-104, 292-301`; highlighting `asmKz80LanguageProvider.ts:313-316, 782, 861-867`; completion `z80-completion-data.ts:231`, `z80-providers.ts:333-490`; tests `test/z80-assembler/dma-*.test.ts` |
| Docs | `docs/content/z80-assembly/zx-next-dma.mdx` (the page shape to copy), `zx-next.mdx:445-460` (`.savenex copper`), `commands-reference.mdx` |

---

## 3. The traps

1. **T1: The Copper outruns the stop.** The Copper advances lazily inside the CPU's tact hooks
   (`zxnextCopperAdvanceTo`, called from `zxnext-cpu.c:86, 112`). One long Z80 instruction can cover
   up to about 23 T-states × 8 = 184 Copper ticks, which is enough for dozens of MOVEs. So when the
   machine stops, the Copper PC may be well past the breakpoint. **Freezing the Copper at the hit is
   rejected:** its NextReg writes are tied to its own tact (`zxnextNextRegWriteTactOverride`) and to
   the lazy raster's catch-up, and a frozen-then-resumed Copper would draw a different picture from
   an undebugged run. The latch therefore records the hit index **and** the beam (`cvc`, `hc_ula`).
   The viewer shows "hit `$00B`" and "now `$00D`" as two separate markers.
2. **T2: The first hit, not the last.** The latch uses the same rule as `zxnextNextRegHit`: a burst of
   watched instructions in one Z80 instruction reports the earliest. The next one is reported on the
   next run. A test must cover a burst.
3. **T3: The hot path.** `zxnextCopperExecuteTick` runs 4× per horizontal position while the Copper is
   active. The watch test must cost nothing when no `cu:` breakpoint is armed: a single
   `zxnextCopperWatchArmed` byte guards it, and the bit test runs only at instruction boundaries (the
   `else` branches at `:265-279`), never on idle ticks.
4. **T4: Copper lines are `cvc`, not raw lines.** WAIT compares against the offset counter: `cvc 0` is
   the first paper line, and `$64` shifts it. The ruler and every message must use `cvc`, through
   `zxnextCopperLineAt`. The total line count **varies by timing mode**: `zxnextTimingDisplayYStart`
   is 64, 40 or 80 depending on 50/60 Hz and model (`zxnext-nextreg.c:240-252`). So the beam export
   must include the live total, and the frame size must not be hard-coded at 311.
5. **T5: "Never matches" depends on timing.** `WAIT 511,63` (`$FFFF`) is the HALT idiom, but any line
   past the frame's last `cvc`, and any horizontal position with `h*8+12` past the last `hc_ula`, also
   never matches. The assembler cannot know the timing, so **it does not warn**. The viewer flags
   such WAITs as *parks* under the current timing.
6. **T6: Big-endian fixups.** `.copper` words are big-endian, the opposite of `.dw`, so the existing
   `FixupType.Bit16` is unusable. A WAIT also packs a 9-bit line and a 6-bit position across both
   bytes. Forward references, such as a line computed from a later `.equ`, therefore need new fixup
   kinds: `CopperWait`, `CopperMove` and `Bit16BigEndian`. Do not evaluate eagerly and reject forward
   references: `.dma` supports them, and users will expect parity.
7. **T7: MOVE can address only `$00-$7F`.** The register field is 7 bits. `.copper move $80, x` must be
   an error, never silently masked, because masking would turn a typo into a write to `$00`.
   `move 0, x` is legal and is a NOP. The assembler emits it as written, and the decoder shows it as
   `NOP` with a note that the value is ignored.
8. **T8: Reading 2K across the WASM boundary.** 2048 `zxnextCopperRead` calls on each 100 ms refresh
   is wasteful. Add `zxnextCopperMemoryPtr()` and copy with one `subarray().slice()`, following the
   `zxnextNextRegWatchPtr` pattern.
9. **T9: The list RAM is not cleared by a soft reset** (`zxnextCopperReset` keeps it;
   `zxnextCopperHardReset` clears it). After a soft reset the viewer shows the previous program's
   list. This is correct hardware behaviour; the panel says so with a "stopped, list retained" state
   rather than looking stale.
10. **T10: Source matching is heuristic.** Two programs may upload different blocks over time, or one
    block at an offset other than 0 (the `$61`/`$62` write address). Matching (§4.9) is
    shape-based, takes the best block per contiguous run of RAM, and **never claims a match below a
    minimum run length** (proposed: 3 instructions). An unmatched list still shows fully decoded,
    just without a source column.

---

## 4. Design

### 4.1 The decoder: `src/common/zxnext/copper/copperDecoder.ts` (D2)

```ts
export type CopperInstruction =
  | { kind: "wait"; index: number; word: number; line: number; hpos: number; hc: number; paperX: number }
  | { kind: "move"; index: number; word: number; reg: number; value: number; regName?: string }
  | { kind: "nop"; index: number; word: number; value: number }   // MOVE to register 0
  | { kind: "halt"; index: number; word: 0xffff };                 // WAIT 511,63

export function decodeCopperWord(index: number, word: number): CopperInstruction;
export function decodeCopperList(ram: Uint8Array): CopperInstruction[];   // 1024 entries
export function analyzeCopperList(list: CopperInstruction[], timing: CopperTiming): CopperListSummary;
export function formatCopperInstruction(i: CopperInstruction, opts?: { hex?: boolean }): string;
```

- `hc = hpos*8 + 12` and `paperX = hpos*8`. The comment cites `copper.vhd` and the existing test
  macros.
- `analyzeCopperList` returns:
  - the **used length**: the last non-zero word, plus the HALT if there is one;
  - whether a HALT terminates the list;
  - the trailing run of zero words, which are NOPs, collapsed in the view;
  - the WAITs that never match under the given timing (T5);
  - **order warnings**: a WAIT for a line earlier than the previous WAIT's line. That is legal, but in
    mode `01`/`11` it waits for the next frame, which is a classic bug.
- MOVE value decoding reuses the `NextRegPanel` slice helpers (`NextRegPanel.tsx:87-116`). Move them
  into the decoder's folder, or into a shared `nextRegSlices.ts`, rather than importing from a panel.
- Palette writes (`$41`, `$44`) carry a colour swatch (RRRGGGBB, and 9-bit for `$44`).

### 4.2 Core exports (D9, T8)

Add to `zxnext.c`, the loader and `build-zxnext-wasm.cjs`:

| Export | Returns |
| --- | --- |
| `zxnextCopperMemoryPtr()` | Pointer to `zxnextCopperMemory[0x800]` |
| `zxnextGetCopperBeam()` | Packed: `cvc` (9 bits), `hc_ula` (9 bits), and whether the Copper is in a WAIT, at the **CPU's** current tact (the place the Copper has been advanced to). Uses `zxnextCopperLineAt`/`HcAt`. |
| `zxnextGetCopperTiming()` | Packed: total `cvc` lines and total `hc` for the live timing (T4) |

`zxnextGetCopperStartMode`, `...ListAddress` (the PC), `...InstructionAddress` (the CPU write
pointer) and `...VerticalLineOffset` already exist.

### 4.3 Machine and Emu API

```ts
// src/common/messaging/EmuApi.ts
export type CopperState = {
  ram: Uint8Array;          // 2048 bytes, a copy
  startMode: 0 | 1 | 2 | 3; // $62 bits 7-6
  pc: number;               // list address, 0..$3FF
  writeAddress: number;     // the CPU's $60/$63 pointer, 0..$7FF (bytes)
  lineOffset: number;       // $64
  beam: { line: number; hc: number; waiting: boolean };
  timing: { lines: number; hcs: number };
  lastHit?: CopperHitEvent; // the stop's hit, when the last stop was a Copper breakpoint
};
```

- `IZxNextIdeMachine.getCopperState()` is implemented in `ZxNextWasmV2Machine`.
- `EmuApiImpl.getCopperState()` is a stub that the proxy implements.
- `MainToEmuProcessor` handles it through `isZxNextIdeMachine`, as `getNextRegState` does.

### 4.4 The Copper side-bar panel (G3.1)

- **Registration:** `nextCopperPanel` in `sideBarPanelRegistry` beside `nextRegPanel`, with
  `restrictTo: [MI_ZXNEXT]` and `useScrollViewer: false`.
- **Refresh:** `useEmuStateListener`, exactly as `NextRegPanel` refreshes.
- **Content** (top to bottom, built from `DataPanel`/`DataRow`/`DataLabel`/`HexValue` in
  `@renderer/controls/data`):
  - **Mode:** `$62` mode as a short phrase, with the full `valueSet` text from the `$62` descriptor
    as its tooltip. Example: `11 · loop, restart at (0,0)`.
  - **State:** one of `Stopped`, `Stopped · list retained` (T9), `Waiting for line 96, x 64`,
    `Running`, or `Halted at $011`.
  - **PC**, **Write ptr**, **Line offset `$64`**, and **Beam** (`cvc`, `hc`).
  - **Window:** a 7-row decoded window centred on the PC, with the current instruction highlighted
    with the `--color-state-value` treatment (the panel is a converted state panel, see AGENTS.md).
  - **Footer:** a summary chip, e.g. `22 used · HALT at $015 · 1002 NOP`, and an **Open Copper
    List** link.

### 4.5 The Copper List document (G3.1)

- **Opening:** a singleton special document, `COPPER_PANEL_ID = "$copper"`, in
  `specialDocuments.ts`. It is opened by:
  - the command `show-copper` (alias `shcop`), `show-copper <index>` to reveal a slot;
  - the panel link;
  - the **Machine → ZX Spectrum Next** menu.

  It is workspace-restorable, like `$memory`.
- **Layout:** two columns.
  - **Instruction table** (a `VirtualizedList`), with these columns:

    | Column | Shows |
    | --- | --- |
    | gutter | breakpoint dot, toggled by click |
    | index | `$00B` |
    | word | `$BE78` |
    | mnemonic | `WAIT` / `MOVE` / `NOP` / `HALT` |
    | operands | `120, 31` / `$41, $FC` |
    | meaning | `line 120 · x 248` / `Palette Value (8 bit) ← $FC ■` |
    | source | `program.asm:30`, with the D8 match |

    - The PC row and the hit row have distinct markers (T1).
    - Trailing NOPs collapse into one "1002 × NOP ($016–$3FF)" row, which expands on click.
  - **Raster ruler:** a vertical strip of `timing.lines` rows, scaled to the panel height.
    - Shaded zones: paper (`cvc` 0–191), lower border and blanking, upper border.
    - A tick for each WAIT, at its line, coloured by whether it ever matches.
    - The live beam line, and the hit line when stopped on a Copper breakpoint.
    - Hovering a tick names the instruction; clicking it selects the row.
    - It answers "where in the frame does this list act" at a glance, which the table alone does
      not.
- **Toolbar:** Follow PC (on by default), Show source, Hex/decimal operands, **Step Copper**
  (§4.6), and the summary chip.
- **Context menu on a row:** Toggle breakpoint, Edit breakpoint…, Run to here (a one-shot), and Go
  to source (when matched).

### 4.6 The core watch and the hit latch (G3.8, D3–D5)

```c
static uint8_t zxnextCopperWatch[128];      /* one bit per list index; pushed whole by the host */
static uint8_t zxnextCopperWatchArmed;      /* T3: the hot-path guard */
static uint8_t zxnextCopperWatchAny;        /* Step Copper: every index matches */
static uint32_t zxnextCopperHit;            /* packed, see below; 0 = none */
```

- **Hooks**, both at instruction boundaries in `zxnextCopperExecuteTick`:
  - **WAIT:** inside `if (cvc == waitLine && hc >= waitHc)`, before the address increments.
  - **MOVE/NOP:** in the MOVE branch, before the increment.
- **Packing**, like `zxnextTakeNextRegHit`:
  - bit 31: present
  - bits 28–29: kind (1 WAIT, 2 MOVE, 3 NOP)
  - bits 19–27: `hc_ula`
  - bits 10–18: `cvc`
  - bits 0–9: index
- **The first hit is latched** (T2).
- **Exports:** `zxnextCopperWatchPtr()`, `zxnextSetCopperWatchMode(armed, any)` and
  `zxnextTakeCopperHit()`.
- **Step Copper** arms `any` as a one-shot. The machine stops after the Z80 instruction during which
  the Copper completes its next instruction.

### 4.7 Breakpoint model, key, `DebugSupport`, the loop

- **Model.** Add `copperIndex?: number` to `BreakpointInfo`; it is the discriminator
  (`isCopperBreakpoint`), in the same way `nextReg` is.
  - `exec` is false. Update the "not an exec breakpoint" sites listed in NextReg plan §4.1:
    `DebugSupport.addBreakpoint` and the three `bpDef` literals.
  - List `copperIndex` in `addBreakpoint`'s field-by-field rebuild, which has bitten three times
    before.
- **Key.** `CU:$00B`, built after the `NR:` branch. It cannot collide with a partition label (check
  `parseNextPartitionLabel`, as the NextReg plan did).
- **`DebugSupport`.** Add three methods:
  - `hasCopperBreakpoints()`;
  - `buildCopperWatch()`, which returns 128 bytes;
  - `hasCopperHit(index, kind, line, hc)`, which runs `handleHit`, so hit counts, conditions and
    logpoints apply (D6).
- **Loop** (`ZxNextWasmV2Machine`): push the watch on entry beside the NextReg watch, then call
  `acceptWasmV2CopperHit(wasm.zxnextTakeCopperHit())` after each instruction, next to the NextReg
  check. It stores `lastCopperHit = { index, kind, word, line, hc, pc: opStartAddress, partition }`.
  `getCpuState` returns it, and `CopperState.lastHit` mirrors it.
- **Stop message** (`describeDebugStop`), after the NextReg branch:
  ```
  Copper breakpoint: $00B WAIT 120,31 satisfied at line 120, hc 262 (x 250); CPU at $8012 in R0
  Copper breakpoint: $00D MOVE $41,$FC (Palette Value (8 bit)) at line 120, hc 270; CPU at $8012
  ```

### 4.8 Command, dialog and panel

- **Command.** The `cu:` spec joins the shared `<address-spec>`, beside `nr:`, before the partition
  gate, and is Next-only:
  ```
  bp-set cu:$00B             break when the Copper completes list index $00B
  bp-set cu:11 -hit 50       the 50th time (the 50th frame, for a once-per-frame WAIT)
  bp-set cu:$00B -once       one-shot
  bp-del cu:$00B
  bp-en  cu:$00B -d
  ```
  - Range `$000-$3FF`.
  - `-r`/`-w`/`-i`/`-o`/`-c`/`-v`/`-m` with `cu:` are errors: "A Copper breakpoint watches a list
    index, not memory, a port or a register".
  - `breakpointCommandSpec` round-trips it.
- **Dialog.** A seventh kind in the radio group, **Copper instruction**. It has an index field (hex),
  a live preview of the decoded instruction at that index from `getCopperState`, and the existing
  hit-count and condition sections.
- **Breakpoints panel.** A new **Copper** group after **NextReg write** in `breakpoint-grouping.ts`.
  - Rows read `CU:$00B  WAIT 120,31`, decoded from the live RAM when available.
  - The hit row shows `line 120 · hc 262`.

### 4.9 The `.copper` pragma (D7)

```z80klive
.copper wait <line>, <hpos>     ; 1HHHHHHL LLLLLLLL   line 0..511, hpos 0..63 (paper x = 8*hpos)
.copper move <reg>, <value>     ; 0RRRRRRR VVVVVVVV   reg $00..$7F (0 = NOP), value 8-bit
.copper nop                     ; $00 $00
.copper halt                    ; $FF $FF  (WAIT 511,63: the Copper parks until the next restart)
.copper word <expr>             ; any 16-bit word, big-endian (escape hatch, like .dma cmd)
```

Example: the `test/visual/copper/C03` list, rewritten.

```z80klive
List:
    .copper move $40, 16        ; palette index 16
    .copper move $41, $00       ;   black
    .copper wait 96, 8          ; line 96, paper x 64
    .copper move $40, 16
    .copper move $41, $1C       ;   green
    .copper halt
ListEnd:
```

**Implementation** (it mirrors `.dma`, §2):
- **Tokens.** `CopperPragma` in `common-tokens.ts`, with spellings `.copper`, `.COPPER`, `copper` and
  `COPPER`. Check that the bare `copper` keyword does not break `.savenex copper`, whose sub-command
  is parsed as an identifier. If it does, register only the dotted forms.
- **Parser.** `parseCopperPragma`, with sub-commands as identifiers.
- **Nodes.** `CopperWaitPragma`, `CopperMovePragma`, `CopperNopPragma`, `CopperHaltPragma` and
  `CopperWordPragma`.
- **Emission.** In `common-assembler.ts`, with the T6 fixups.
- **Errors.** A new range, `Z0371–Z0377` (free today; check again at implementation):

  | Code | Message |
  | --- | --- |
  | Z0371 | Unknown .copper sub-command: '{0}' |
  | Z0372 | The `.copper` pragma requires the Next model (`.model next`) |
  | Z0373 | Copper WAIT line {0} is out of range (0..511) |
  | Z0374 | Copper WAIT horizontal position {0} is out of range (0..63) |
  | Z0375 | Copper MOVE can write only NextRegs $00..$7F, not {0} (T7) |
  | Z0376 | Copper MOVE value {0} does not fit in 8 bits |
  | Z0377 | Copper block at {0} is {1} instructions long; the Copper holds at most 1024 |

- **Debug info (D8).** The assembler collects `copperBlocks: { address, length, entries: { line,
  fileIndex, shape }[] }[]` into the compilation's debug output, next to `debugAnnotations`. The
  renderer matches them against the live RAM in `copperSourceMatch.ts`, a pure module next to the
  decoder, under these rules:
  - matching is on shape;
  - operand differences are marked **patched**;
  - a match needs at least 3 instructions (T10);
  - the best block wins.

  A matched row's **Go to source** opens the line.
- **Language support:**
  - **Highlighting.** A Monarch `copperSubcmd` state, copying `dmaSubcmd`.
  - **Completion.** The sub-commands; after `move `, NextRegs `$00-$7F` with their descriptions as
    detail; after `wait `, a snippet `${1:line}, ${2:hpos}`.
  - **Hover.** The decoded word and its meaning (`$BE78 · WAIT line 120, x 248`), plus the NextReg
    description for a MOVE. This is the first pragma with hover; it uses the shared decoder.
- **Source-line Copper breakpoints (D12).** When a source line is a matched `.copper` instruction, a
  gutter click there creates `cu:<index>` rather than an exec breakpoint. This depends on the live
  match, so it resolves when the debugger stops, in the same way label-anchored breakpoints resolve.

---

## 5. Phases

There are two independent tracks. **Track A** (the assembler, Phases 1–2) needs nothing from Track B
and can ship first: it is the smallest user-visible win, and it gives the viewer phases real source
to test against.

### Track A: the `.copper` pragma

**Phase 1: pragma, emission and errors.**
- Work: tokens, parser, nodes, emission with the T6 fixups, and errors Z0371–Z0377.
- Tests: `test/z80-assembler/copper-pragma.test.ts`. Cover every sub-command's bytes, the forward
  references, the T7 boundaries, the model guard, Z0377, and `.savenex copper` still parsing.
- Parity test: `.copper` output is byte-identical to the `CuWait`/`CuMove`/`CuHalt` macros for C03 and
  C05.

**Phase 2: language support and docs.**
- Work: highlighting, completion and hover.
- Tests: `copper-highlight.test.ts` and `copper-providers.test.ts`.
- Docs: a new page, `docs/content/z80-assembly/zx-next-copper.mdx`, in the shape of
  `zx-next-dma.mdx`, linked from `zx-next.mdx`. Check it with `npm run doc:build && npm run doc:check`.

### Track B: the viewer and the breakpoints

**Phase 3: the decoder (nothing user-visible).**
- Work: `copperDecoder.ts`, `analyzeCopperList`, and the move of the slice helpers.
- Tests: `node` project tests for every encoding edge (NOP vs MOVE 0, HALT, hpos 63, line 511),
  paper-x, order warnings, and parks under 50 and 60 Hz timing (T5).

**Phase 4: core exports and the `CopperState` read path.**
- Work: §4.2 and §4.3.
- Tests: harness tests in `test/zxnext-hw/copper/`. Add a `session.copperState()` method (harness
  README, "Adding a method"); run a C03-like program; assert the PC, the WAIT state and the beam at
  known frame tacts; and assert that a soft reset keeps the RAM (T9).
- Register the new test in `build/e2e-tests.ts` (it runs a core).

**Phase 5: the side-bar panel.**
- Work: §4.4.
- Tests: jsdom tests on the panel model.
- Check it in the running IDE with the CDP recipe from `.ai/ui-theming-intent-and-lessons.md`, and
  update that file in the same change (a standing rule).

**Phase 6: the Copper List document and the raster ruler.**
- Work: §4.5 without the breakpoint gutter; `show-copper`/`shcop`; the menu item.
- Tests: the ruler geometry and the row model in pure modules.

**Phase 7: the core watch and the latch.**
- Work: §4.6.
- Tests (harness):
  - a WAIT fires on satisfaction, not arrival;
  - a MOVE fires on issue;
  - first-hit on a burst (T2);
  - Step Copper;
  - no slowdown when unarmed. Measure the frame time of a Copper-heavy program, armed vs not
    (T3).

**Phase 8: the breakpoint model, `DebugSupport`, loop and stop message.**
- Work: §4.7.
- Tests: key, predicates, `handleHit` with `-hit`, the stop message text, and `lastHit` in the
  viewer.

**Phase 9: grammar, dialog, panel group, and the viewer gutter and context menu.**
- Work: §4.8, plus the §4.5 gutter.
- Tests: `BreakpointCommands` parse and round-trip; `BreakpointDialog.test.tsx`; grouping.

**Phase 10: source mapping and source-line Copper breakpoints (D11, D12).**
- Work: the `copperBlocks` debug info, `copperSourceMatch.ts`, the source column with *patched*
  markers, Go to source, and source-line `cu:` breakpoints.
- Tests: matching on offset uploads, patched values, two candidate blocks, and below-minimum runs
  (T10).

**Phase 11: docs, roadmap and verification.**
- Docs: `working-with-ide` (the Copper panel, the list, Copper breakpoints) and `commands-reference`
  (`show-copper`, `cu:`).
- Roadmap: mark G3.1 and G3.8 (Copper half) as done in `CLOSING_THE_GAPS_PLAN.md`, and add the
  `.copper` pragma to it.
- Competitive analysis: update §2 and §4 of `LANDING_PAGE_COMPETITIVE_ANALYSIS.md` (a standing
  rule).
- Checks:
  - Run `npm run build:check`, `npm run lint:renderer`, and the Vite build check in AGENTS.md.
  - A manual pass in the IDE: build C03 with `.copper`, stop on `cu:$002`, step the Copper through
    the list, and confirm that the ruler, the stop message and the source column agree.

---

## 6. Effort

| Item | Phases | Estimate |
| --- | --- | --- |
| `.copper` pragma, errors, docs | 1–2 | S |
| Decoder, exports, read path | 3–4 | S |
| Side-bar panel + Copper List with ruler (G3.1) | 5–6 | S–M |
| Copper breakpoints end to end (G3.8, Copper half) | 7–9 | M |
| Source mapping and source-line Copper breakpoints | 10 | S–M |
| Docs, roadmap, verification | 11 | S |

The total is in line with the roadmap's **S–M** for G3.1 plus **M** for G3.8. G1 is already done,
which removes G3.8's "after G1" dependency.

---

## 7. Risks

| Risk | Mitigation |
| --- | --- |
| Users read the Copper PC at a stop as the breakpoint (T1) | The hit and now markers are separate in both views, and the stop message names the hit's beam |
| A once-per-line breakpoint stops constantly | That is normal for event breakpoints; `-hit` and conditions cover it (D6), and the docs show `cu:$xxx -hit 50` |
| Source matching shows a wrong block (T10) | Shape-based matching, a minimum run, no claim below it, and a "matched N of M" tooltip |
| `.copper` vs `.savenex copper` token clash | Phase 1 tests that `.savenex copper` still parses; fall back to the dotted forms only |
| Performance regression in the Copper hot loop (T3) | Armed-guard, boundary-only test, and a measured Phase 7 check |
| 60 Hz and other timing modes break the ruler (T4) | Timing comes from the core, never from a constant; a Phase 3 test covers both rates |

---

## 8. Questions answered (2026-10-04)

All eight were accepted as proposed and are recorded as D10–D17 in §1.1.

| # | Question | Answer |
| --- | --- | --- |
| Q1 | Should a WAIT breakpoint fire on **satisfaction** (D4), or also offer an "on arrival" option (`-a`)? | Satisfaction only; add `-a` later if asked (D10) |
| Q2 | Should the viewer show a **source column** from shape-matched `.copper` blocks? | Yes (D11) |
| Q3 | Should a gutter click on a `.copper` source line create a `cu:` breakpoint? | Yes, resolved at stop time like label-anchored breakpoints (D12) |
| Q4 | Should NextReg **symbolic names** be usable in `.copper move` (and `nextreg`)? | Not in this plan; a follow-up plan (D13) |
| Q5 | Should there be convenience sub-commands, e.g. `.copper palette` or `.copper waitx`? | Not in this plan; a follow-up plan (D14) |
| Q6 | Should the assembler warn when a Copper block does not end with `halt`? | No; the viewer flags it (D15) |
| Q7 | Debug activity, or next to the Next Registers? | Next to the Next Registers (D16) |
| Q8 | Migrate `test/visual/copper/` from the `Cu*` macros to `.copper`? | No; a parity test ties them together (D17) |
