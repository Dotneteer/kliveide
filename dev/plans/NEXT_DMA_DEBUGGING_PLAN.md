# ZX Spectrum Next DMA Debugging Plan

Status: **Phases 1 and 2 shipped** (PRs #1664, #1665). **Phase 3, the port write log, implemented, in review**
(2026-11-19, branch `dma-port-log`; §11). This plan
details **Phase 1, the DMA side bar panel**; the later tools are listed in §8 and get their own phases
here after Phase 1 is reviewed. §9 records what was built where it differs from the text below, and the
answers taken for §5.
Mockups: `dev/plans/dma-debugging/DMA_DEBUGGING_MOCKUPS.html` (open in a browser; every value is
synthetic). Phase 1 is its tool 1; §3.6 lists where Phase 1 differs from that mockup.
Background: the article *DMA: One Bus, Two Masters*
(`docs/content/en/under-the-hood/emulator-internals/next-dma.mdx`), core 3.02.01, and its last section
for core 3.03's zxnDDMA.
Precedent: `dev/plans/NEXT_INTERRUPTS_DEBUGGING_PLAN.md`, whose Phase 1 built the Interrupts panel the
same way (one side-effect-free snapshot export, a pure view model, a converted state panel).

## 1. Goal

Make the DMA's state **visible** at a pause, so that the traps the article describes are recognised from
one look at a panel:

- "Why did my transfer copy the wrong bytes?": the addresses written to WR0/WR4 are not the working
  addresses until `$CF`; an enable without a load carries on from the last transfer.
- "Why does the DMA ignore me?": WR4 bit 4 left it deaf, a register group is still waiting for followers,
  or port `$6B`/`$0B` is switched off in NextReg `$82`/`$85`.
- "Why is my program frozen?": auto restart in continuous mode never gives the bus back; a prescaler in
  continuous mode keeps the bus while it waits.
- "Why is the count off by one?": the dialect (the port touched last) and a block length of 0.
- "What rate will this prescaler give?": the nominal 875 kHz ÷ *P* and the exact period at the current
  CPU speed.
- "What is still switched on from the last zxnDDMA transfer?" (core 3.03 profiles).

Next only. No other Klive machine has a DMA.

## 2. What exists today

| Value | Where it lives in the core (`zxnext-dma.c`) | Reachable from the IDE today? |
|---|---|---|
| Dialect (zxnDMA / Z80 DMA) | `dmaMode` | `zxnextGetDmaMode` export, used only by tests |
| WR0-WR5: direction, port A/B start, length, kind, step, timing, prescaler, operating mode, auto restart | `dmaDirAtoB`, `dmaPortAStart`, `dmaBlockLength`, `dmaPortA*`, `dmaPortB*`, `dmaPrescaler`, `dmaTransferMode`, `dmaAutoRestart` | no |
| Working addresses, counter | `dmaSrc`, `dmaDest`, `dmaCounter` | `zxnextGetDmaAddressA/B`, `zxnextGetDmaByteCounter`, tests only |
| Transfer state machine | `dmaSeq` (IDLE / START / TRANSFER / BURST_WAIT) | `zxnextGetDmaSeq`, tests only |
| Status byte | `dmaEndOfBlockN`, `dmaAtLeastOne` | only by reading port `$6B`, which advances the read sequence |
| Read sequence, read mask | `dmaRdSeq`, `dmaReadMask` | no |
| Register write sequencer (followers expected, deaf) | `dmaWrSeq`, `dmaRegTemp`; `DMA_WR_R4_BYTE_2` is "deaf until reset" | no |
| Bus | `dmaBusRequested`, `dmaBusAcknowledged`, `dmaGrantAfterNextM1`, `dmaWasDelayed` | no |
| zxnDDMA (3.03 builds only, `ZXNEXT_CORE_VERSION >= 30300`) | `dmaExtA/B`, `dmaFlags`, `dmaRowLength`, `dmaRowCount`, `dmaStrideA/B`, `dmaTransparent`, `dmaFill`, `dmaSrcHi`, `dmaDestHi`, `dmaRow`, `dmaRowByte`, `dmaXCmd`/`dmaXCount`/`dmaXIndex` | no |
| Port enables | NextReg `$82` bit 5 (`$6B`), `$85` bit 1 (`$0B`) | as NextRegs |
| Step-aside enables | NextRegs `$CC`-`$CE` | as NextRegs (and the Interrupts panel) |

Elsewhere: the disassembly decodes DMA program regions (`decode: "dma"`, `src/common/zxnext/dma/dmaDecoder.ts`);
port and NextReg breakpoints report a hit made by the DMA; the Execution History records each DMA hold
(`zxnextHistoryDmaHold`, reverse debugging plan D15).

**What a pause can see.** Before every instruction the CPU loop runs the DMA for as long as it holds or
requests the bus (`zxnextCpuRunDma`, `zxnext-cpu.c`). A pause therefore lands between instructions with
the DMA idle, waiting for its prescaler in burst mode, or stepped aside for an interrupt. It sees a
transfer **holding the bus** only when the loop stopped at a frame boundary (`frameCompleted`): a
continuous transfer longer than the rest of the frame, or an auto-restart lock. The panel must say which
of these it is showing; stepping the DMA a byte at a time needs a stop inside that loop and is a later
phase (§8).

## 3. Phase 1: the DMA side bar panel

Mockup tool 1.

### 3.1 Content

Sections, top to bottom (labels are the panel's, all through `t()`):

- **Header badge**: the derived state (§3.3): *idle*, *holding the bus*, *waiting (prescaler, bus free)*,
  *stepped aside for an interrupt*, *deaf*, *locked*.
- **Transfer**: dialect with its port and counting rule ("zxnDMA, $6B, N bytes" / "Z80 DMA, $0B, N + 1
  bytes"); operating mode (byte mode shown as "byte (= continuous)", burst without a prescaler as
  "burst (= continuous)"); direction; progress as bytes moved of bytes to move, with a bar (the counter
  and the block length, adjusted for the dialect; 0 means one byte); auto restart.
- **Ports**: a two-column table, port A and port B, rows *start*, *working*, *kind* (memory / I/O),
  *step* (down / up / fixed), *cycle* (2, 3 or 4 clocks). Working addresses are shown under their port
  names whatever the direction, as the read sequence names them. A working address that differs from its
  start takes `--color-state-value-alt`. In 3.03 physical mode the addresses are 22-bit
  (`$` + 6 digits) with "RAM page *n* + offset" as secondary text.
- **Pacing** (only when the prescaler is not 0): the prescaler and its port; the nominal rate
  875 kHz ÷ *P*; the exact period at the current CPU speed and the rate it gives (§3.4); "no effect at
  this speed" when the wait is not longer than the byte.
- **Status and read-back**: the status byte (computed, never read through the port), its eight bits with
  E and T marked, and their meaning in words; the read mask; the read sequence as seven chips with the
  next one marked; the write decoder ("ready" or "WR*n*: *k* more bytes: *names*").
- **Steps aside for**: the sources enabled in NextRegs `$CC`-`$CE` (and the NMI, `$CC` bit 7), or
  "none: interrupts wait for the end of the block". Hardware IM2 mode off is noted, since the enables
  then do nothing.
- **zxnDDMA** (only on a profile whose core is 3.03 or later): the `$DF` flags as named chips, both
  extended bytes, row length × rows and the current row/byte, both strides, the transparent colour and the
  fill value. On older profiles the section is absent, not empty.
- **Diagnostics**: a short list of messages above the sections (§3.3), each naming its evidence.

No actions in Phase 1: every row is read only. (The mockup's "Step byte" and "To end of block" belong to
the stops phase, §8.)

### 3.2 Plumbing

The Interrupts panel's pattern:

- **Core**: `zxnextGetDmaStatePtr()` fills one fixed struct in WASM memory (about 64 bytes; every field
  of the table in §2 plus the two diagnostic flags below) and returns its address. **Side-effect free**:
  it reads statics only, never calls `zxnextDmaReadStatusByte` (which advances `dmaRdSeq`). The struct
  carries a `hasDdma` byte so one TypeScript decoder serves every core version; on pre-3.03 builds the
  zxnDDMA fields are 0.
- **Two diagnostic flags** the core does not keep today, both set and cleared only in `zxnext-dma.c` and
  placed among the **volatile** statics (`src/emu/z80/wasm/README.md`, "Anything a debug run writes..."),
  so keyframes, checkpoints and machine state files keep their layout:
  - `dmaStartsSinceLoad`: set when a WR0 follower writes port A's start or a WR4 follower writes port B's;
    cleared by `$CF` and by reset.
  - `dmaEnableNote`: latched at an enable (`$87` or WR3 bit 6): bit 0 = `dmaStartsSinceLoad` was set,
    bit 1 = the end of block had been reached and not cleared since (the "one more byte" case). Cleared by
    `$CF`, `$D3`, `$C3` and reset.
  After a state load or a rewind both read 0, so the panel can miss the warning but never shows a false
  one; §3.3 says so in the diagnostic's tooltip.
- **Export contract**: `GetDmaStatePtr` classified `pure` in `src/emu/machines/reverse/exportContract.ts`;
  `test/wasm/reverse/export-contract.test.ts` then proves it.
- **Loader**: `ZxNextWasmV2Loader.ts` gains the export, an `assertViewRange` and a `dmaState` view, like
  `interruptState`.
- **Types and decoding**: `src/common/zxnext/dma/dmaState.ts` (pure, beside `dmaDecoder.ts`): the
  `NextDmaState` type, `decodeDmaState(bytes, extra)`, and the shared helpers the view model and tests use:
  `dmaCycleClocks(timingCode)`, `dmaStatusByte(state)`, `dmaPendingFollowers(wrSeq, regTemp)` (names
  taken from `dmaDecoder.ts`'s `DmaFieldRole`, so the panel and the decoder agree), `dmaPacing(prescaler,
  cpuSpeed, byteClocks)`.
- **Machine and messaging**: `getDmaState()` on `IZxNextIdeMachine` (and its type guard),
  `ZxNextWasmV2Machine`, `MainToEmuProcessor` and `EmuApi`. The machine adds what is outside the DMA:
  the effective CPU speed, NextRegs `$82`, `$85`, `$C0` (hardware IM2 mode), `$CC`-`$CE` through
  `zxnextPeekNextRegister`, the profile's core version, and whether the last stop was at a frame
  boundary with the bus held.
- **View model**: `src/renderer/features/dma/dmaViewModel.ts`: the derived state, the rows' texts as i18n
  keys with arguments, and the diagnostics; tested without rendering, like `interruptsViewModel.ts`.
- **Panel**: `src/renderer/appIde/SideBarPanels/DmaPanel.tsx`, registered in `src/renderer/registry.ts`
  as `nextDmaPanel` in `ACTIVITY_MACHINE_INFO_ID` directly below `nextInterruptsPanel`,
  `restrictTo: [MI_ZXNEXT]`, title through `withTexts`. Refreshes on `useEmuStateListener`.
- Built on `@renderer/controls/data` (`DataPanel`, `DataRow`, `DataLabel`, `DataValue`, `EmptyState`), a
  **converted state panel**: values in `--color-state-value`, changed working addresses in
  `--color-state-value-alt`; widths in `ch` (M2), row heights from `rowSizes.ts` (M3); the badge, the
  bit cells, the progress bar and the diagnostic stripes from tokens, aliased at L4 if new, never literals.
  Update `dev/ai/ui-theming-intent-and-lessons.md` with the rule the badge and bit cells teach.
- **Optional, same phase**: an IDE command `dma` that prints the view model's rows as text (mockup tool 7),
  for doc-shot recipes, tests and AI sessions. Its name follows the existing commands' style; check
  `src/renderer/appIde/commands/` for a clash first.

### 3.3 Derived state and diagnostics

The header state, first match wins:

| State | Condition |
|---|---|
| deaf | `wrSeq` = `DMA_WR_R4_BYTE_2` |
| locked | active, auto restart on, operating mode byte or continuous |
| holding the bus | `busAcknowledged` (a frame-boundary pause) |
| stepped aside | active and `wasDelayed` or the interrupt request that delays it is active |
| waiting | `seq` = BURST_WAIT |
| starting | `seq` = START |
| idle | otherwise; with "block finished" as secondary text when E = 0 |

Diagnostics, each a pure function of the state with a test. Severity is *warning* or *info*; none is an
error (they are hints with a reason, as in the Interrupts plan's D6):

| Id | Severity | Condition | Message (gist) |
|---|---|---|---|
| DMA-DEAF | warning | `wrSeq` = `DMA_WR_R4_BYTE_2` | "WR4 bit 4 without port B's address: the DMA ignores every byte until a reset" |
| DMA-LOCK | warning | the *locked* state | "Auto restart in continuous mode: the CPU will not get the bus back; only a reset or a `$CC`-`$CE` interrupt ends it" (names the enabled step-aside sources, or says there are none) |
| DMA-NOLOAD | warning | `dmaEnableNote` bit 0 | "Enabled after new start addresses without `$CF`: it uses the old working addresses (*A*, *B*)" |
| DMA-AFTEREND | warning | `dmaEnableNote` bit 1 | "Enabled after a finished block without `$CF` or `$D3`: it moves one more byte, from just past the end" |
| DMA-PARTIAL | warning | `wrSeq` neither idle nor deaf | "WR*n* expects *k* more bytes (*names*): the next byte written is taken as one of them" |
| DMA-PRESC-CONT | warning | prescaler > 0, operating mode byte or continuous, and active or enabled-ready | "The DMA keeps the bus while it waits: the CPU is frozen for about *x* frames for this block" (remaining bytes × exact period ÷ frame length) |
| DMA-PORT-OFF | warning | the dialect's port disabled in `$82` bit 5 / `$85` bit 1 | "Port `$6B` is switched off: writes to it reach nothing" |
| DMA-STEPASIDE-IM | info | any of `$CC`-`$CE` set, hardware IM2 mode off | "The step-aside enables work only in hardware IM2 mode" |
| DMA-DDMA-ON | info | 3.03, idle, `dmaFlags` ≠ 0 or a rectangle/stride set | "zxnDDMA settings stay until `$C3`: the next transfer uses *physical, 2D, ...*" |
| DMA-PRESC-NONE | info | prescaler > 0, exact wait not longer than the byte at this speed | "Prescaler *P* changes nothing at *speed*" |
| DMA-Z80 | info | dialect Z80 DMA | "Z80 DMA mode moves N + 1 bytes: this block moves *n*" |
| DMA-ZEROLEN | info | length 0 (or rectangle size 0 on 3.03) | "A length of 0 moves one byte" |
| DMA-FRAMEPAUSE | info | the *holding the bus* state | "Paused at the end of a frame in the middle of a transfer; the CPU has not run since *T*" |

### 3.4 Pacing numbers

From the article, and to be pinned by a harness test against the core rather than trusted:

- Cycle clocks per port from the timing code: `00` and `11` = 4, `01` = 3, `10` = 2. A byte takes port
  A's plus port B's cycle clocks (6 after a reset); a 3.03 fill has no read cycle.
- The prescaler timer counts 28 MHz time: the wait ends 32 × *P* master clocks after the byte began, which
  is 32 × *P* ÷ *s* CPU clocks with *s* = 8, 4, 2, 1 at 3.5, 7, 14, 28 MHz.
- Exact period = 32 × *P* ÷ *s* + 3 CPU clocks when 32 × *P* ÷ *s* is longer than the byte; otherwise
  the prescaler has no effect. Rate = CPU clock ÷ period.
- Nominal rate = 875 kHz ÷ *P* at every speed.
- Wait states (contention at 3.5 MHz, the SD card port, 28 MHz memory on 3.02 cores) stretch real bytes;
  the panel's figure is labelled "exact (no wait states)". Measured periods come with the timeline (§8).

### 3.5 Done when

- `test/wasm/zxNext/wasm-next-dma-state.test.ts`: the struct layout pinned against the core on a 3.02 and
  a 3.03 profile (`forEachProfile`); reading the state twice around no execution leaves the machine
  byte-identical (a checkpoint compare); `zxnextGetDmaStatePtr` does not move the read sequence.
- `test/zxnext-hw/dma/dma-debugging.test.ts`, through the harness (a new `dmaState()` session method, per
  the harness README's "Adding a method"), one program per scenario, paused at a known point, asserting on
  `getDmaState()` and the view model's state and diagnostics:
  1. the article's sample player mid-play (waiting, burst, P = 55);
  2. a 16K continuous copy paused at a frame boundary (holding the bus, DMA-FRAMEPAUSE);
  3. `$91` after `$C3` (deaf, DMA-DEAF);
  4. new start addresses then `$87` without `$CF` (DMA-NOLOAD), and an enable after a finished block
     (DMA-AFTEREND, and the extra byte moved);
  5. `$7D` followed by two bytes only (DMA-PARTIAL, two names);
  6. auto restart in continuous mode (locked, DMA-LOCK);
  7. a Z80 DMA mode load through `$0B` (DMA-Z80);
  8. on a 3.03 profile, `$DF $01` left on after a physical copy (DMA-DDMA-ON, 22-bit addresses).
- The pacing function agrees with the core's measured period at all four CPU speeds for P = 1, 55 and 100
  (extending DMA-009's measurements).
- `test/renderer/dmaViewModel.test.ts` covers every row of §3.3's tables.
- `npm run i18n:keys`, `i18n:check`, `build:check`, `lint:renderer` pass; the export contract test
  passes; `npx electron-vite build --config build/electron.vite.config.ts` builds.
- The panel checked in the running app on scenarios 1, 2 and 3 (CDP recipe in
  `dev/ai/ui-theming-intent-and-lessons.md`), not in a replica.
- A guide page `docs/content/en/guides/next/dma.mdx` with a generated screenshot (a `guides-dma` doc-shot
  recipe), linked from the article and from `guides/next/_meta.ts`; `doc:build` and `doc:check` pass.

### 3.6 Differences from the mockup

The mockup's tool 1 shows three things Phase 1 cannot provide: the **Step byte** and **To end of block**
buttons (a DMA stop inside `zxnextCpuRunDma`, §8 phase 4), and the **Measured** period and **CPU keeps**
share (a per-byte trace, §8 phase 5). Phase 1 shows the exact period instead, labelled as computed.

## 4. Decisions (proposed; confirm or change)

| Id | Decision |
|---|---|
| D1 | Next only; the panel is absent on other machines. |
| D2 | The state comes from one side-effect-free core export, not from reading port `$6B` (which advances the read sequence) and not from many single-value getters. The old `zxnextGetDma*` getters stay for the tests that use them. |
| D3 | Enable-without-load is detected by two volatile core flags (§3.2), not inferred later from a port write log, so Phase 1 can warn without recording anything. |
| D4 | Diagnostics are warnings or information with their evidence, never errors. |
| D5 | The panel is a converted state panel (`--color-state-value`). |
| D6 | The panel is read only in Phase 1; anything that changes the DMA or the bus comes with the stops phase. |
| D7 | Pacing figures are computed and labelled so; measured figures arrive with the timeline. |
| D8 | One decoder for every core version (`hasDdma` in the struct); the zxnDDMA section exists only on 3.03+ profiles. |

## 5. Questions for the project author

1. Placement: Machine info activity, below Interrupts? (Proposed: yes.)
2. D3: are two new volatile statics in `zxnext-dma.c` acceptable, given that they read 0 after a state
   load or rewind? The alternative is to drop DMA-NOLOAD and DMA-AFTEREND until the port write log exists.
3. Include the `dma` text command in Phase 1? (Proposed: yes; it is small and helps recipes and tests.)
4. Should the later tools (§8) become phases of this plan or plans of their own? (Proposed: phases here,
   written after Phase 1's review.)

## 6. Effort (rough)

| Phase | Core | TS/UI | Tests/docs |
|---|---|---|---|
| 1 Panel | 0.5 day | 2 days | 1.5 days |

## 7. When finished

A changeset (`feature`) in the commit that completes the plan (not after Phase 1 alone, if more phases
are added; see `AGENTS.md`); a "DMA debugging" line in the comparison table (§2) and gap table (§4) of
`dev/plans/LANDING_PAGE_COMPETITIVE_ANALYSIS.md`; all UI text through `t()` with translator context
(`dev/ai/i18n-guide.md`).

## 8. Later tools (outline only; mockup tools 2-7)

In the order the mockup page suggests, each reusing what the earlier ones add:

2. **Editor support**: a `.dma` pragma like `.copper`, a code lens with the transfer's summary, a hover
   with the decoded groups, and lint rules for the traps visible in the bytes alone. No core work;
   `dmaDecoder.ts` and the decoded region kind `dma` already exist.
3. **Port write log** (a document): every access to `$6B`/`$0B` with frame, T-state, PC and the
   sequencer state, grouped into setups and decoded. Needs a core ring of port accesses, on only while
   the document is open or a stop needs it (like the interrupt event ring, D4 there).
4. **DMA stops and stepping**: enable, load, end of block, auto-restart wrap, counter value, memory and
   port access by the DMA, bus held longer than *n* T, and a decoder anomaly; plus "Step DMA byte",
   "Run to end of block" and "Run until the CPU has the bus". Needs a stop inside `zxnextCpuRunDma`
   (a frame-boundary-like return with the DMA mid-transfer), a latch in `Z80_DEBUG_LOOP_STOP` as the
   interrupt stops did, and `debug-loop-equivalence` tests. Memory breakpoints gain a CPU / DMA / both
   choice.
5. **Bus timeline** (a document): the DMA's share of each frame, lost pulse-mode interrupts, and a
   to-scale view of bytes, prescaler waits and grant waits; the measured period and jitter. Needs a
   per-byte trace with request, grant and release times; check first how much the Execution History's
   DMA hold records already give.
6. **Transfers and memory overlay**: one row per transfer, and the source and destination tinted in the
   Memory panel. No core work beyond 3 and 5.

## 9. As built (2026-11-19, Phase 1)

**Answers taken for §5** (change them in review): (1) Machine info activity, directly below Interrupts;
(2) see the first difference below; (3) the `dma` command is in; (4) proposed, not decided.

**Where it lives**

| Part | Files |
|---|---|
| Core | `zxnext-dma.c`: `zxnextGetDmaStatePtr` (64 bytes), `dmaStartsSinceLoad`, `dmaEnableNote`; `dev/scripts/build-zxnext-wasm.cjs` (export, `zxnextIdeDmaState` volatile) |
| Types and decoding | `src/common/zxnext/dma/dmaState.ts` (`decodeDmaState`, `dmaPendingFollowers`, `dmaPacing`, `dmaByteClocks`, `dmaBytesToMove`/`Moved`, `dmaStatusByte`) |
| Machine and messaging | `ZxNextWasmV2Loader.ts` (`dmaState` view), `ZxNextWasmV2Machine.getDmaState`, `IZxNextIdeMachine`, `EmuApi`, `MainToEmuProcessor` |
| Panel | `SideBarPanels/DmaPanel.tsx` + `.module.scss`, `features/dma/dmaViewModel.ts`, registry `nextDmaPanel`; tokens `--*-dma-*` |
| Command | `commands/DmaCommands.ts` (`dma`), text in `features/dma/dmaText.ts` (console output, English) |
| Tests | `test/wasm/zxNext/wasm-next-dma-state.test.ts`, `test/zxnext-hw/dma/dma-debugging.test.ts`, `test/renderer/dmaViewModel.test.ts`, harness `dmaState()` with a self-test |
| Docs | `docs/content/en/guides/next/dma.mdx` (screenshot: `dev/scripts/doc-shots/recipes/guides-dma.cjs`), linked from the DMA article |

**Differences from the text above**

- **The two diagnostic flags are machine state, not volatile** (D3 changed). A volatile static keeps the
  live core's bytes when a state is restored or a rewind lands, which could show a *false* warning from
  the future. As machine state they are deterministic and come back right with the rest of the DMA. Any
  new static changes the core's layout fingerprint anyway, as the interrupt snapshot did. Only the
  64-byte snapshot buffer is volatile.
- **The prescaler formula holds at every speed**: `dma-debugging.test.ts` measures P = 1, 55 and 100 at
  all four CPU speeds against `dmaPacing` (exact period within 1.5 clocks a byte). P = 1 at 3.5 MHz has no
  effect, as the article says; at 7 MHz and above it does.
- **No "Show in memory" link**: the panel is read only and has no actions (D6).
- **Diagnostic `stepAsideIm` ignores the NMI bit** (`$CC` bit 7), whose stepping aside does not depend on
  hardware IM2 mode.
- **Found while reading for the later phases**: the assembler already has DMA pragmas (`.dma` and the
  `DmaWr*Pragma` nodes in `src/main/compiler-common/`). Phase 2 (editor support) builds on them rather
  than adding a pragma.

**Shipped on its own** (the author's decision): Phase 1 carries the changeset and the competitive
analysis line (§7). The tools of §8, if built, are follow-up features with changesets of their own.

## 10. Phase 2: editor support for `.dma` programs

Mockup tool 6. The assembler already has the `.dma` statement language (one line per register group or
command, `docs/content/en/reference/z80-assembler/zx-next-dma.mdx`), completions for it, and the
decoded `dma` region kind in annotations; the mockup's proposed `.dma` block pragma is therefore not
needed. Phase 2 adds what the editor and the build do not yet say about such a program.

### 10.1 What a program is

A **`.dma` program** is a run of `.dma` lines in one output segment whose bytes are contiguous, with the
data bytes between them (the runtime patching pattern's `.dw` lines) counted in. Two `.dma` lines
belong to one program when nothing but the follow bytes the DMA still expects lies between them: the
gap between the first line's end and the second line's start is at most the number of follow bytes
pending after decoding the program so far. A longer gap (code, unrelated data) starts a new program.
Raw `.defb` programs are not analysed: nothing marks them as DMA programs.

### 10.2 Build warnings (the assembler)

After the fixups, a post-pass (`checkDmaPrograms`, beside `collectCopperBlocks`) decodes each program's
bytes with `dmaDecoder.ts` and reports warnings, never errors, so a build never fails on them. They reach
the editor as squiggles through the background compile, the build output and `klive` CLI builds.

| Code | When | Line |
|---|---|---|
| Z0388 | A `.dma` line's first byte is taken as a follow byte of an earlier group (an omitted WR0 or WR4 value without its `.dw`) | the swallowed line |
| Z0389 | An enable (`.dma enable`, `.dma wr3 dma_enable`, or `$87` through `.dma cmd`) after a WR0/WR4 start address with no `.dma load` between | the enable |
| Z0390 | Auto restart while the program's mode keeps the bus (byte or continuous, or burst without a prescaler): the CPU never gets the bus back | WR5 |
| Z0391 | A prescaler in byte or continuous mode: the DMA keeps the bus while it waits | WR2 |
| Z0392 | A setting the Next's DMA ignores: a search transfer type, `int_enable`, `stop_on_match`, mask or match | the line |

A group that still expects bytes where a program ends is not reported: whether the bytes after a
program are its `.dw` values or unrelated code cannot be told from the bytes.

Z0390/Z0391 use the program's last WR4; without one, they are not checked.

### 10.3 The editor

- **Hover on a `.dma` line** (`computeDmaHover`, beside `computeCopperHover`): the line's decoded group
  (`formatDmaCommand`, `describeDmaCommand`), then the program's summary. The bytes come from the last
  build (`getLineAddress`), as the Copper hover does; before a build there is no DMA hover.
- **A code lens on a program's first `.dma` line** with its summary: direction, port A and port B
  addresses (or "patched at run time" when a value comes from a `.dw` the program writes as 0), bytes
  to move, mode, and with a prescaler its exact period and rate at 3.5 MHz (`dmaPacing`). Refreshed when
  a build's language data arrives.
- Both are computed by one pure module, `src/common/zxnext/dma/dmaProgram.ts` (program grouping from
  per-line bytes, the summary and the lint rules), used by the assembler's post-pass and the editor, so
  they agree.

### 10.4 Done when

- `test/zxnext-hw/...` is not needed: everything is byte-level. Unit tests for `dmaProgram.ts` (grouping,
  each rule, the summary) and assembler tests that compile sources with each rule's trap and check the
  warning code and line, and that the reference page's examples compile with no warning.
- Provider tests for the hover and the code lens text.
- The reference page `zx-next-dma.mdx` gains a "Warnings" table (Z0388-Z0392) and a note on the hover and
  code lens; the guide `guides/next/dma.mdx` links to it.
- Checked in the running app: squiggles from the background compile, the hover, the code lens.

### 10.5 As built (2026-11-19)

- **The editor's programs come from the assembler, not from per-line bytes.** Pragma lines have no
  listing items, so the language data's `lineInfo` holds no bytes for `.dma` lines (nor for `.copper`
  lines: `computeCopperHover`'s compiled-bytes fallback is never fed, and only its literal decoding
  works). The assembler's post-pass therefore exports its programs as `AssemblerOutput.dmaPrograms`
  (`DmaProgramRecord`: the program's address, its bytes after the fixups, and each `.dma` line's
  offset and length); `extractIntelData` passes them on, and `LanguageIntelService.getDmaPrograms`
  regroups them per file with `dmaProgramsOfFile`. The editor and the warnings use one grouping.
- **Five warnings, Z0388-Z0392.** A group still missing bytes where a program ends was dropped (§10.2).
- **The code lens title is translated** (`panels.feature.dmaLens.*`); the hover's decoded text is the
  decoder's English, as the disassembly shows it, like the Copper hover.
- **The pacing in the summary assumes 3-clock cycles at 3.5 MHz**; a timing byte that shortens the
  cycles only matters for prescalers too small to have an effect.
- **The reference page's operating-mode table was corrected**: it described `byte` and `burst` the
  Zilog way; on the Next, byte mode is continuous and burst mode frees the bus only while the prescaler
  waits.
- Files: `src/common/zxnext/dma/dmaProgram.ts`; `common-assembler.ts` (`_dmaEmissions`,
  `checkDmaPrograms`); `assembler-errors.ts`, `compiler.json` (Z0388-Z0392);
  `src/renderer/appIde/services/dma-editor.ts` and `z80-providers.ts` (hover, code lens);
  tests `test/z80-assembler/dma-warnings.test.ts`, `dma-editor.test.ts`; docs `zx-next-dma.mdx`
  (Warnings, In the editor), `guides/next/dma.mdx` (screenshots: `guides-dma-editor` recipe).

## 11. Phase 3: the DMA Port Log

Mockup tool 2. A document that lists every write to and read from the DMA's ports, as the DMA took it,
so a setup's mistake shows where it was made rather than later as a wrong transfer.

### 11.1 Recording in the core

A ring of port accesses in `zxnext-dma.c`, beside the sequencer whose state it records, recording only
while the document is open (the interrupt ring's D4). 32K records of 16 bytes (512 KB); the count only
grows, record `n` lives at `n % capacity`, read with `copyRingRecords`.

| Offset | Field |
|---|---|
| +0 u32 | frame |
| +4 u32 | position in the frame, 28 MHz clocks |
| +8 u16 | PC of the instruction (every Z80 I/O instruction is two bytes, so `PC − 2` during its I/O cycle) |
| +10 u8 | the byte written or read |
| +11 u8 | flags: bit 0 read, bit 1 port `$0B`, bit 2 from the host (not an instruction: a test, the IDE), bits 5-4 CPU speed |
| +12 u8 | write: the write sequencer before the byte; read: the read entry it returned |
| +13 u8 | write: the write sequencer after the byte |
| +14 u8 | write: the base byte of the group in progress after the byte (`dmaRegTemp`) |
| +15 u8 | write: `dmaStartsSinceLoad` after the byte (bit 0) |

Exports `zxnextDmaLogPtr`, `...GetCapacity`, `...GetCount`, `...SetEnabled`, `...GetEnabled`,
`...Clear`; all statics volatile; classified in the export contract like the interrupt ring's. A write
is recorded even when the sequencer ignores it (deaf, an unknown byte): that is the point.

### 11.2 The model

`src/common/zxnext/dma/dmaLog.ts` (pure): decodes records, then builds rows from them.

- **Commands come from the sequencer, not from guessing.** A write whose sequencer-before is idle is a
  base byte; the writes after it whose sequencer-before is not idle are its follow bytes, decoded together
  with `decodeDmaCommand`. So a swallowed byte shows as the follow byte the DMA took it as.
- **Setups**: a run of writes ending with an enable (`$87`, WR3 D6); the writes after the last enable are
  an open setup. A setup's header names its first PC, its byte count and its dialect.
- **Reads** are rows of their own: the entry the read returned (status, counter, port A/B) and, for the
  status, what E and T say.
- **Anomalies**, each a flag on the row: a write while deaf; a byte that matches no group (ignored); an
  enable while start addresses were written after the last `$CF` (from +15); a WR4 that leaves the DMA
  deaf.

### 11.3 The document

**DMA Port Log** (`$dmaLog`), opened by `show-dma-log` / closed by `hide-dma-log`, Debug › DMA Port Log
on the Next, and a link in the DMA panel's footer. A header with recording on/off, Clear and the record
count; filters All / Writes / Reads / Anomalies and "Group into setups"; a table with frame, T-state in
the frame, PC (click: the disassembly there), port, byte, group and meaning, newest last, the last 1,000
rows. A setup header copies the setup as `.dma` source (`formatDmaCommand`).

### 11.4 Done when

- Harness tests (`test/zxnext-hw/dma/dma-port-log.test.ts`, session `recordDmaLog`/`dmaLog`): an `OTIR`
  setup recorded byte by byte with the `OTIR`'s PC; the sequencer states of a base byte and its
  follow bytes; host writes flagged; reads with their entries; nothing recorded while off; recording
  leaves the machine byte-identical; the ring wraps.
- Unit tests for `dmaLog.ts` (commands, setups, anomalies, reads) and the export contract.
- The guide `guides/next/dma.mdx` gains a section and a generated screenshot.
- Checked in the running app.

### 11.5 As built (2026-11-19)

- **The PC is `PC − 2` at the I/O cycle**, as designed: the harness test checks every byte of an `OTIR`
  setup carries the `OTIR`'s own address, and an `IN A,(C)` its own.
- **The ring is 32K records (512 KB); the core's memory stays at 58 MB.**
- **Read-back commands outside a setup stand alone.** A `$BF`, `$A7`, `$8B` or `$BB` (with its mask)
  written when no setup is open is not configuration, so it does not open a setup of its own.
- **A 16-bit value's two bytes are labelled low and high** (`portALo`/`portAHi`, ...).
- **No `dma-log` text command**: the document and the harness's `dmaLog()` cover it.
- Files: `zxnext-dma.c` (`zxnextDmaLog*`, the write/read wrappers), `build-zxnext-wasm.cjs`,
  `exportContract.ts`; `src/common/zxnext/dma/dmaLog.ts`; machine, `EmuApi`, `MainToEmuProcessor`;
  `DocumentPanels/DmaPortLog/`; `show-dma-log`/`hide-dma-log` in `DmaCommands.ts`; Debug › DMA Port Log;
  the DMA panel's footer link; tests `test/zxnext-hw/dma/dma-port-log.test.ts`; docs `guides/next/dma.mdx`
  (screenshot in the `guides-dma` recipe).
