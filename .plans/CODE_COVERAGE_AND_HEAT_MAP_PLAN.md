# Code Coverage and Memory Heat Map Plan

Status: **decisions recorded** (2026-10-08). D1–D16 are the decisions; the author accepted the suggested answers to all §8 questions, which the decisions already assume.
Nothing is implemented.

Scope:
- [CLOSING_THE_GAPS_PLAN.md](CLOSING_THE_GAPS_PLAN.md) **G5.1**: a per-address (and per-bank)
  "executed" map in the core. Executed lines are marked in the editor and the disassembly, and the
  map can be reset.
- **G5.2**: read, write and execute counts per address, shown as a heat map in the memory view. It
  also flags self-modifying code.
- The **shared in-core access profile** (`z80-profile.c`). It holds the coverage flags, the
  counters, and the per-instruction time that the flat profiler
  ([PROFILER_PLAN.md](PROFILER_PLAN.md), G5.3) reads. G5.3 therefore adds no core work for its flat
  half.

Builds on:
- [EXECUTION_HISTORY_VIEWER_PLAN.md](EXECUTION_HISTORY_VIEWER_PLAN.md) /
  [EXECUTION_HISTORY_ALL_CORES_PLAN.md](EXECUTION_HISTORY_ALL_CORES_PLAN.md) (G4.1/G4.2). Their
  pattern is reused: a module in the shared Z80, hook macros with empty defaults, per-core wiring,
  a shared export list, volatile symbols and a capability interface. The recorder's
  `Z80_HISTORY_BEGIN` site is also where an instruction starts.
- [REVERSE_DEBUGGING_PLAN.md](REVERSE_DEBUGGING_PLAN.md) (G4.4). Its replay must not count twice
  (T4).

Used later by:
- G5.3/G5.4 ([PROFILER_PLAN.md](PROFILER_PLAN.md)).
- G5.5 "run tests with coverage" ([Z80_UNIT_TESTS_PLAN.md](Z80_UNIT_TESTS_PLAN.md)).
- G5.6 LCOV output ([UNIT_TESTS_CLI_PLAN.md](UNIT_TESTS_CLI_PLAN.md)).
- G7.3 code/data auto-detection. It needs the *code* flag (operand bytes fetched as code), not only
  the instruction starts, so D3 records both.

Not in scope:
- The C64: a TypeScript 6510 core, not WASM.
- Coverage of Klive BASIC *statements* as a separate concept. Statement coverage falls out of
  address coverage through the statement map (D11), so nothing extra is needed.
- Branch coverage, i.e. "this conditional jump was taken / not taken". §1.2 keeps the hook.

---

## 1. What is being added, and why

DeZog's coverage is its second most-cited feature after reverse debugging. Executed source lines get
a green background, the disassembly is marked, and a command clears the marks. ZEsarUX offers
`cpu-code-coverage` (executed addresses) and "visual memory" (read, write and executed counters).
Neither tool keeps per-bank information: ZEsarUX documents that its 16-bit coverage goes wrong when
slots change. Klive can do better at little extra cost, because every core already knows its
physical memory layout and its partitions.

Four things are missing:

1. **Counters in the core.** No core counts anything per address today; only breakpoint hit counts
   exist (`DebugSupport`).
2. **A mapping from a logical access to a physical byte.** Each core needs it, and the read and
   write mappings must be kept apart (T2).
3. **Readers and an Emu API** to fetch the flags and counters in pages.
4. **Presentation:**
   - a coverage strip in the Monaco editor;
   - a coverage cell in the disassembly;
   - a heat overlay in the memory view;
   - a self-modifying-code report;
   - commands, menu items and exports.

### 1.1 Decisions

| # | Decision |
| --- | --- |
| D1 | **One shared module, `src/emu/z80/wasm/z80-profile.c` + `.h`.** It sits beside `z80-history.c`, behind hook macros with empty defaults in `z80.c`, and is wired per core like the recorder (G4.2 D1: no core-specific profile code; a core supplies only the address-mapping macros of D4). `scripts/check-wasm-cpu-contract.cjs` asserts that every core defining one profile macro defines all of them. |
| D2 | **Two levels: a flag byte per physical byte, and a counter pool.** **Flags** (always present when profiling is on) are one byte per physical ROM/RAM byte. That costs 64 KB on the 48K, 2 MB on the Next and 4 MB on the Z88 (T6). **Counters** are 24-byte entries (`exec u32`, `read u32`, `write u32`, `time u64`, `pad u32`) in a **pool of 8 KB physical pages, allocated on first touch**. The pool's size is fixed per core (D5). When the pool is full, further pages keep their flags but no counts, and the header reports `pagesDropped` so the UI can say so (T6). |
| D3 | **What a flag byte holds.** It has six bits: **E** (an instruction *started* here, i.e. M1 of the first opcode or prefix byte), **C** (fetched as code: opcode, prefix, displacement or operand bytes), **R** (data read), **W** (data write), **S** (self-modified, D9) and **X** (executed in an interrupt service). *Coverage* in the UI is **E** (G5.1). **C** exists for G7.3, so that an instruction's operand bytes count as code. |
| D4 | **Counting sits at the `z80.c` funnels, not in the cores' memory functions.** The hooks are `Z80_PROFILE_FETCH(addr, m1)` in `readCodeMemory`/`fetchCodeByte` (the Next and Z88 use `Z80_FETCH_CODE_BYTE`), `Z80_PROFILE_READ(addr)` in `readMemory` and `Z80_PROFILE_WRITE(addr)` in `writeMemory`. The cores' own read/write functions also serve side-effect-free paths (`z80PeekMemory`, `COND_PEEK`, `Z80_HISTORY_PEEK`, IDE reads), and counting there would count the debugger itself (T1). The core supplies two mapping macros, `Z80_PROFILE_PHYS_READ(addr)` and `Z80_PROFILE_PHYS_WRITE(addr)`. Each returns the physical offset into the core's flag array, or `-1` for "not backed by memory" (the Next's floating/error page, a Z88 empty slot). |
| D5 | **Sizes per core.** Flags cover the core's physical arrays (§2.2). The counter pool is **4 MB (170 pages = 1.33 MB of touched memory)** on the 3.5 MHz-class cores and **8 MB (341 pages)** on the Next and the Z88. Linear memory grows by the flags plus the pool: +4.1 MB on sp48, +4.3 MB on sp128, +10 MB on the Next, +12 MB on the Z88 (whose `_Static_assert` budget in `z88.c` moves with it). The 48K's whole 64 KB fits the pool eight times over. A typical 128K or Next program touches far fewer pages than the pool holds. |
| D6 | **Off by default; one switch per session; the fast path counts too.** `z80ProfileHeader.enabled` gates every hook, and each hook is `if (enabled)` like the history macros. Unlike history, profiling is **not** limited to debug sessions. Coverage of a full-speed run is the common case ("which code did the game actually use?"), and the hooks sit in `z80.c`, which both the fast frame and the per-instruction loops run. Switching it on is the user's act: Debug → Code Coverage, or `coverage on`. It is not tied to starting a debug session. The setting `emuOptions.profiling.resetOnStart` (default **on**, matching DeZog) clears the data when a machine starts from Stopped. |
| D7 | **Instruction time is recorded by the same module** for G5.3. `Z80_PROFILE_BEGIN()` sits at the recorder's BEGIN site (the M1 of an unprefixed fetch, before the R increment) and stores the start PC's physical offset and `cpu.tacts`. `Z80_PROFILE_END()` sits at the end of `z80ExecuteCpuCycle` when `cpu.prefix == NONE`, so a prefixed instruction is still one span, and adds the delta to the entry's `time`. Contention and the Next's 28 MHz wait states are therefore included. Three kinds of time are **not** charged to an address. They go into header buckets instead: interrupt acknowledge cycles (`timeIntAck`, `timeNmiAck`), the Next's DMA bus holds (`timeDma`, which run before the instruction, T5) and the Z88's snooze (`timeSnooze`). HALT cycles **are** charged to the HALT's address but are also summed in `timeHalt`, so the profiler can show "idle" apart (G5.3 D4). |
| D8 | **The time unit is the core's frame-tact unit.** That means CPU T-states, except on the Next, where it is 28 MHz ticks (`frameTacts28` deltas), so that time stays comparable across speed changes. `historyContextDecoder(machineId).frameTactUnit` already names the unit. `time` is a `u64` because a 28 MHz busy loop overflows 32 bits in 2.5 minutes. |
| D9 | **Self-modifying code is a flag, not a heuristic.** A write to a byte that has **C** set sets **S**. A code fetch from a byte that has **W** set sets **S**. The SMC report (`coverage smc`) lists runs of **S** bytes with their partition, the nearest label, and (with counters) the write and fetch counts. A byte that was only loaded by the IDE (code injection, `setMemory`) is never W, because those paths do not go through `writeMemory` (T1). That is why a program that was merely injected does not appear self-modifying. |
| D10 | **Replay does not count.** While `z80HistoryHeader.verifyState != 0` (G4.4's `replayTo` and replay runs), the profile hooks return early. Counting therefore always describes the *present's* run, and stepping back and forth does not move the numbers. **Take over here** keeps the counts of the abandoned future. They really happened, and resetting is one click away. The status line says "includes N instructions from an abandoned future" until the next reset (Q4). |
| D11 | **Coverage is presented through the existing source maps, with a partition.** An address is turned into a line with `locateSource` / `listItemsAtPc` and the *partition the byte lives in*. A banked line is covered only if its own bank's byte has **E**, not whatever else was mapped at that address. Klive BASIC uses its statement map (`addressToStatement`): a statement is covered when any of its addresses has **E**, and fully covered when every instruction start in it has **E** (T8). |
| D12 | **Editor presentation.** A separate `createDecorationsCollection` uses `linesDecorationsClassName`, the narrow strip between the line numbers and the text. The glyph margin stays for breakpoints. It has three states: **covered** (filled bar), **not covered** (hollow bar: the line emitted code that never started) and nothing (the line emitted no code). An optional **line tint** (setting, default off) gives DeZog's half-transparent background. It refreshes on the editor's existing breakpoint trigger and on a new `profileVersion` in the emulator state. Hovering the strip shows "executed 1,234 times" when counters exist. |
| D13 | **Disassembly presentation.** A 1ch **coverage cell** next to the branch gutter is reserved on every row when the listing's `showCoverage` flag is on (the branch gutter's alignment pattern). A per-refresh `Map<address, CoverageMark>` is passed as a prop so the memoized row stays stable. The row's partition decides which bank's flags are read (D11). |
| D14 | **Memory view presentation.** A **Heat** selector in the memory toolbar offers Off · Executed · Read · Written · All. It draws a per-byte overlay with the existing `changedByteOverlay` mechanism, in a **five-step ramp** on log₂ of the count. "All" uses three hues (exec, read, write) at the dominant count's step. Without counters for a page (pool full) the flags alone are drawn at step 1, and the row tooltip says "counts not kept for this page". The tooltip adds `E 12 · R 340 · W 2` and an SMC marker. New tokens: `--color-heat-{exec,read,write}-{1..5}` (L4 aliases over an L2 ramp, both themes derived; T9). |
| D15 | **Commands, one family.** `coverage on|off|reset|status`, `coverage export <file> [-format lcov|csv|klive]` and `coverage smc`; aliases `cov`, `covr`. The heat map needs no command beyond the memory view's selector and `memory-heat <mode>` for scripts. **Debug → Code Coverage** is a check item gated on a new `MF_PROFILE` feature flag, and **Debug → Reset Coverage** sits below it. Both are also exposed to KSX through `executeCommand`. |
| D16 | **Exports.** **LCOV** (`SF:`/`DA:`/`LH:`/`LF:` per source file, line hits taken from the instruction-start counts, or 1 per flag without counters). That is the format Codecov, Coveralls and GitLab read, and G5.6 reuses it. **CSV** has one row per touched physical byte: partition, address, flags, exec, read, write, time. **`.kcov`**, a Klive-specific JSON with the run's machine id and layout fingerprint, can be loaded back to *merge* runs (`coverage load`). |

### 1.2 Out of scope, and the hooks left for later

- **Branch coverage.** `Z80_PROFILE_END` sees the PC after a conditional jump, call or return. A
  later item can record "taken / not taken" bits per instruction start. The flag byte keeps bits 6–7
  spare for that.
- **Coverage across sessions by default.** D16's `.kcov` merge makes it opt-in instead.
- **Counting DMA and Copper accesses on the Next.** These are not CPU accesses. The Copper never
  touches memory, and the DMA writes physical memory directly. A later `Z80_PROFILE_DMA_*` pair
  could feed the heat map, and the flag byte would need a "device write" bit.

---

## 2. Current code paths this touches

### 2.1 Shared

| Concern | Where |
| --- | --- |
| CPU entry point | `src/emu/z80/wasm/z80.c` `z80ExecuteCpuCycle` (l.3236–3360): NMI l.3251, INT l.3257, HALT l.3265, BEGIN l.3275, COMMIT l.3283 |
| Funnels | `readCodeMemory` l.400–408, `readMemory` l.410–416, `writeMemory` l.418–428, `fetchCodeByte` l.474 (`Z80_FETCH_CODE_BYTE` on the Next and Z88) |
| Tact counting | `tactPlusN` l.288 → `Z80_TACT_PLUS_N`; `cpu.tacts` (uint32) |
| Shadow stack / interrupt depth | `callCore` l.824, `rstCore` l.834, `pushPcForInterrupt` l.853, `retCore` l.812 (the X flag uses `interruptDepth`) |
| Hook-macro precedent | `z80-history.h` (macros l.62–79), `z80-history.c` (header, ring, exports) |
| Export lists | `scripts/z80-history-exports.cjs` (new sibling `scripts/z80-profile-exports.cjs`) |
| Contract | `scripts/check-wasm-cpu-contract.cjs` |
| Export classification | `src/emu/machines/reverse/exportContract.ts` (`SHARED` gains `[/^z80Profile/, "debug"]`), `test/wasm/reverse/export-contract.test.ts` |
| Layout / state files | `scripts/wasm-layout.cjs` (`computeWasmLayout`), `src/emu/machines/state/wasmStateImage.ts`; volatile lists in each build script |
| Replay | `src/emu/machines/reverse/ReplayEngine.ts` (verify on during `replayTo`, l.171), `Timeline.ts` |
| TS reader precedent | `src/emu/machines/history/WasmHistoryReader.ts`, `WasmHistorySource.ts`, `IExecutionHistorySource.ts` |
| Emu API | `src/common/messaging/EmuApi.ts` (stubs, `UNBOUNDED_EMU_METHODS`), `src/renderer/appEmu/MainToEmuProcessor.ts` |
| Feature flags | `src/common/machines/constants.ts` (new `MF_PROFILE`), `machine-registry.ts` |

### 2.2 Per core

| Core | Physical arrays (flag size) | Mapping macro source | Build script / memory now |
| --- | --- | --- | --- |
| 48K/16K | `sp48Memory[0x10000]` (64 KB) | identity | `build-sp48-wasm.cjs`, 12 MB |
| Timex | HOME 64K + EXROM 8K + DOCK 64K (136 KB) | `sp48TimexChunkBase` | `build-timex-wasm.cjs`, 12 MB |
| 128K/Pentagon/Scorpion | `sp128Ram[0x40000]` + `sp128Rom[0xC000]` + `sp128TrdosRom[0x4000]` (320 KB) | `sp128MemorySlotBase[4]` (not the flat `sp128Memory` copy, T3) | `build-sp128-wasm.cjs`, 13 MB |
| +2A/+3/+2E/+3E | `spp3eRam[0x20000]` + `spp3eRom[0x10000]` (192 KB) | `spp3eMemorySlotBase` (special paging included) | `build-spp3e-wasm.cjs`, 12 MB |
| Next | `zxnextMemory` (2,105,344 B) | `pageReadOffset[8]` / `pageWriteOffset[8]` and the Layer 2 write mapping (`zxnextMemoryResolveLayer2Offset`) | `build-zxnext-wasm.cjs`, 40 MB |
| Z88 | `z88Memory[0x400000]` (4 MB) | `z88PageOffset[8]` | `build-z88-wasm.cjs`, 12 MB |
| ZX80/81 | `zx8081Rom[0x2000]` + `zx8081Ram[0x10000]` (72 KB) | the ROM/RAM decode in `zx8081CpuReadMemory` | `build-zx8081-wasm.cjs`, 6 MB |

The flag array is indexed by the core's **profile offset**. That is a single linear space laid over
its arrays (e.g. sp128: RAM 0–$3FFFF, ROM $40000–$4BFFF, TR-DOS $4C000–$4FFFF). The TS side turns a
profile offset into a partition and address with a per-core table (D11).

### 2.3 Renderer

| Concern | Where |
| --- | --- |
| Editor decorations | `src/renderer/features/editor/monaco/MonacoEditor.tsx` (collections l.236–241, trigger effect l.417–419, `refreshBreakpoints` l.1146–1272), `MonacoEditor.module.scss` |
| Address → line | `src/renderer/appIde/utils/source-location.ts` (`locateSource`, `listItemsAtPc`), `common/utils/source-breakpoint-partition` |
| Klive BASIC statements | `CompilerInfo.ts` l.668–813 (`StatementDebugInfo`, `addressToStatement`, `partitionedAddressMap`) |
| Disassembly | `DocumentPanels/DisassemblyPanel.tsx` (branch gutter pattern l.497–527), `DisassemblyRow.tsx` (row DOM l.518–749), `useDisassemblyRefresh.ts` |
| Memory view | `features/memory/MemoryPanel.tsx`, `MemoryDumpSection.tsx` (overlays l.368–441, hand-written memo comparators l.139–186 and l.465–502), `MemoryToolbar.tsx`, `useMemoryRefresh.ts` |
| Tokens | `theming/tokens/palette.ts` (no sequential ramp today), `semantic.ts`, `componentAliases.ts` |
| Commands / menu | `appIde/IdeCommands.ts`, `main/menus/debug-menu.ts` (feature-gated items l.78–115) |
| Settings | `common/settings/setting-const.ts`, `setting-definitions.ts`, `settings-pages.ts` ("debugging" page) |

---

## 3. The traps

1. **T1: Counting the debugger.** Panels, conditions, the history recorder's byte peeks and the IDE's
   memory reads all go through the cores' read functions. Only the three `z80.c` funnels are CPU
   accesses (D4). A test runs a frame with the memory view, the Watch panel and a condition all
   reading, and asserts that the counts equal a run without them.
2. **T2: Reads and writes map differently.** On the Next, Layer 2 can map *writes only* over
   $0000–$3FFF (and reads separately), and the ROM area is write-mapped elsewhere or nowhere. The +3's
   special paging and the Timex DOCK are read/write-asymmetric too. Hence two macros (D4). One
   per-core test asserts that `PHYS_READ`/`PHYS_WRITE` agree with `getPartition`, and with the Next's
   Layer 2 write window, for every mapping state the core's own tests already enumerate.
3. **T3: The 128K's flat copy.** `sp128Memory[0x10000]` is a mirror rebuilt on paging, not physical
   memory. Indexing flags by it would credit bank 5 and bank 7 to the same bytes. The mapping uses
   `sp128MemorySlotBase`. The same applies to the +3E's flat copy.
4. **T4: Replay double counting.** G4.4 replays from keyframes with the fast frame. Profile buffers
   are **volatile** (excluded from keyframes and state files, like the history ring), so a replay
   would add every replayed instruction again. D10 mutes the hooks while `verifyState != 0`. A test
   steps back 1,000 instructions and forward again and asserts the counts did not change.
5. **T5: DMA time before the instruction.** On the Next, `zxnextCpuRunDma` runs inside
   `zxnextCpuExecuteInstruction` *before* the CPU cycle and adds to `cpu.tacts`. If END were measured
   as "next BEGIN minus this BEGIN", the hold would be charged to the previous instruction. D7
   measures BEGIN→END inside one call, and the DMA hook adds to `timeDma`.
6. **T6: Memory.** The Next's 2 MB of flags is fine. Full counters for 2 MB (48 MB) are not, hence
   the pool. A pool that fills up must be **visible**, not silently wrong. The header's
   `pagesDropped` and `firstDroppedPage` go into `coverage status`, the memory view tooltip and the
   profiler's header (G5.3). A Z88 with three 1 MB cards could touch more than 341 pages only by
   running code across most of them, which is implausible.
7. **T7: Fingerprint and state files.** New statics change every core's layout fingerprint, so older
   `.kls` files are refused on the Next, Z88 and ZX80/81 and fall back to the embedded `.szx` on the
   Spectrum cores. G4.1 already accepted this as policy. It gets a release note. Landing all cores in
   one release (D-order in §5) means users see one fingerprint change instead of seven.
8. **T8: "Covered" for a multi-instruction line.** A Klive BASIC statement or a macro invocation
   line spans many instructions. The strip shows **partial** (half bar) when only some of the line's
   instruction starts have **E**, which is what tells the user a branch inside a statement was never
   taken. For asm lines (one instruction) partial cannot happen.
9. **T9: Heat colour in both themes.** A ramp built from the accent would collide with the
   changed-byte (secondary accent) and selection colours. The ramp is a fixed, accent-independent
   sequence. A test checks monotonic lightness in light and dark themes and ≥3:1 contrast of the
   value text over step 5. `.ai/ui-theming-intent-and-lessons.md` records the rule.
10. **T10: Performance.** The hooks are one predictable branch when off. When on, flags-only costs a
    mapping plus an OR per access; counters add a page lookup and an increment. The Z88's in-C
    run loop and the Next's 28 MHz frame are the strictest budgets. Phase 1 measures with
    `test/perf` before UI work starts. The gate is ≤ 2% when off, ≤ 10% flags-only and ≤ 25% with
    counters, at full speed on the Next. If counters miss the gate, D2's pool stays, but counting
    becomes a second switch (`coverage on -counts`).
11. **T11: ROM byte flags from the injection flow.** `ReachExecPoint` runs the ROM to its main loop
    before code is injected, so with `resetOnStart` the ROM's boot shows as covered. That is correct
    (it ran), but noisy for a user who wants their own code. The editor strip only shows source
    lines, so it is unaffected. The memory view and exports offer **Exclude ROM** (default off), and
    the reset happens *after* the injection flow when the setting `profiling.resetAfterInjection` is
    on (default on, Q3).

---

## 4. Design

### 4.1 Core module (`z80-profile.h` / `.c`)

```c
typedef struct {
  char     magic[4];        // "KPRF"
  uint16_t version, entrySize;  // 1, 24
  uint8_t  enabled, countersOn;
  uint8_t  muted;           // mirrors verifyState != 0, set by the hooks themselves
  uint8_t  pad;
  uint32_t flagBytes;       // size of z80ProfileFlags (the core's physical span)
  uint32_t poolPages, pagesUsed, pagesDropped, firstDroppedPage;
  uint64_t timeIntAck, timeNmiAck, timeDma, timeSnooze, timeHalt, timeTotal;
  uint32_t generation;      // bumped on reset; the IDE's profileVersion
  uint32_t openPhys;        // BEGIN's physical offset (or -1)
  uint32_t openTacts;       // BEGIN's cpu.tacts
} Z80ProfileHeader;

#define Z80_PF_E 0x01  // instruction start
#define Z80_PF_C 0x02  // fetched as code
#define Z80_PF_R 0x04
#define Z80_PF_W 0x08
#define Z80_PF_S 0x10  // self-modified (D9)
#define Z80_PF_X 0x20  // in interrupt service

typedef struct { uint32_t exec, read, write, pad; uint64_t time; } Z80ProfileEntry; // 24 B
```

- `static uint8_t z80ProfileFlags[Z80_PROFILE_FLAG_BYTES];` holds the flags.
- `static uint16_t z80ProfilePageMap[Z80_PROFILE_FLAG_BYTES / 8192];` maps a physical 8K page to
  its pool slot + 1 (0 = none).
- `static Z80ProfileEntry z80ProfilePool[Z80_PROFILE_POOL_PAGES][8192];`
- The core provides `Z80_PROFILE_FLAG_BYTES`, `Z80_PROFILE_POOL_PAGES`, `Z80_PROFILE_PHYS_READ`,
  `Z80_PROFILE_PHYS_WRITE` and `Z80_PROFILE_FRAME_TICKS()` (the D8 unit; `cpu.tacts` except on the
  Next).
- Counters saturate at `UINT32_MAX`.
- **Exports:**
  - `z80ProfileGetHeaderOffset`, `SetEnabled(on, counters)`, `Reset`;
  - `GetFlagsOffset`, `GetPageMapOffset`, `GetPoolOffset`, which the TS reader views directly as the
    history reader does;
  - `z80ProfileSummarise(fromPhys, count, outPtr)`, which fills a scratch buffer with
    `{phys, flags, exec, read, write, time}` for touched bytes only, so that a page of 8K reads
    cheaply.
- All statics go on each core's volatile list (T4, T7).

### 4.2 TypeScript

- `IAccessProfileSource` (`src/emu/abstractions/IAccessProfileSource.ts`) and the
  `isAccessProfileSource` guard.
- `WasmProfileReader` (`src/emu/machines/profile/`) holds views over the header, flags, page map and
  pool, plus `profileOffsetToPartition(offset)` / `partitionToProfileOffset(partition, address)`
  from a per-core table (`src/common/profile/layouts/<core>.ts`, mirroring the history
  `contexts/`).
- **Emu API:**
  - `getProfileInfo()` returns the header plus the layout id;
  - `setProfiling({ enabled, counters })` and `resetProfile()`;
  - `getProfileFlags(partition | "64k")` returns the flags of a partition, or of the current 64K
    mapping assembled per 8K slot;
  - `getProfileEntries(partition | "64k")` returns `Uint32Array` exec/read/write plus a
    `Float64Array` time, or `undefined` for a page without counters;
  - `getProfileTouched()` returns a sparse list for exports and the SMC report.
- `MachineController` refreshes `profileVersion` (the header's `generation` plus a frame counter
  throttled like `publishBreakpointHits`, every 10 frames while running) into the emulator state, so
  panels refresh without polling.

### 4.3 Renderer

- `src/renderer/features/coverage/`:
  - `coverageModel.ts` (pure): flags plus a compilation give per-file line states
    `covered | partial | uncovered`, built from `listFileItems` with `codeStartIndex/codeLength` and
    a partition per segment, and from Klive BASIC's statement map;
  - `heatModel.ts` (pure): counts become ramp steps;
  - `lcov.ts` and `coverageCsv.ts` (pure exporters).
- Monaco: `coverageDecorations` collection (D12), styles `.coverageCovered`, `.coveragePartial`,
  `.coverageUncovered` in `MonacoEditor.module.scss`. The hover message comes from
  `getProfileEntries`.
- Disassembly: `showCoverage` listing flag, a `coverageMarks` map and a cell in `DisassemblyRow.tsx`
  after the branch gutter, with the cell width reserved via a `ch` column (M2).
- Memory view: the Heat selector in `MemoryToolbar.tsx`, a `heatSteps: Uint8Array | undefined` prop
  through `MemoryDumpSectionView` and `HexValues`. **Both memo comparators gain it** (the comment at
  `MemoryDumpSection.tsx:161` warns of exactly this). The overlay spans use the existing `ch`
  geometry.
- Commands: `src/renderer/appIde/commands/CoverageCommands.ts`.
- Menu: `debug-menu.ts` under `MF_PROFILE`.
- Settings (page "debugging", group "Coverage and profiling"):
  - `profiling.resetOnStart`;
  - `profiling.resetAfterInjection`;
  - `profiling.counters` (default on);
  - `coverage.lineTint` (default off).
  The settings rows need a new `when.kind: "feature"` for `MF_PROFILE` (`isSettingsRowApplicable`
  supports only machine ids today).

---

## 5. Phases

| Phase | Work | Done when |
| --- | --- | --- |
| 0 | Spike on the 48K: module, hooks, mapping, flags only | `test/wasm/profile/sp48-profile.test.ts` (e2e tier): a known program gives exactly the expected E/C/R/W/S bytes; T1 (panel reads do not count) and T10 overhead measured and recorded in §9 |
| 1 | Counters, time buckets, replay muting; the 48K and the Next | Counts equal a hand count for a fixed loop; time per address sums to `timeTotal` minus the buckets; the Next's DMA hold lands in `timeDma` (T5); Layer 2 write mapping (T2); a G4.4 step back and forward leaves counts unchanged (T4); perf gate (T10) |
| 2 | Remaining cores in G4.2's order: Timex → 128K/Pentagon/Scorpion → +3E (special paging) → Z88 → ZX80/81 | One mapping test per core (T2/T3); `MF_PROFILE` set per machine id; the contract script passes |
| 3 | Reader, Emu API, commands (`coverage …`), `profileVersion` | `test/commands/CoverageCommands.test.ts` with a faked Emu API; `coverage status` reports pool usage and dropped pages |
| 4 | Editor strip and disassembly cell | `jsdom` tests of `coverageModel` (asm, sjasmplus, Klive BASIC statements, banked segments, partial lines); the decorations collection checked in the running IDE through CDP (the recipe in `.ai/ui-theming-intent-and-lessons.md`) |
| 5 | Memory heat map, tokens, SMC report | Ramp contract test (T9); the memo comparators carry `heatSteps`; a self-modifying 48K fixture lists its patched bytes |
| 6 | Exports (LCOV, CSV, `.kcov` + `coverage load`), docs, roadmap and competitive analysis | LCOV checked by `genhtml`-style parsing in a `node` test; the docs page; §7 updates |

---

## 6. Tests

- **Core** (`test/wasm/profile/`, listed in `build/e2e-tests.ts`): one file per core for the mapping
  (T2/T3), counts and flags for fixed programs, replay muting (T4) and the time buckets (D7).
- **Pure** (`test/common/profile/`, `test/renderer/coverage/`): the layout tables, `coverageModel`,
  `heatModel` and the exporters.
- **Commands** (`test/commands/`): faked Emu API.
- **Contract:** `export-contract.test.ts` covers the new `z80Profile*` exports as `debug` (the memory
  image is unchanged by every pure/debug export).
- **Perf:** a `perf` project case per core; its budget is recorded in §9 once measured.

---

## 7. Effort and the standing rule

**M**, as the roadmap says, but closer to its upper end: about three weeks. The core module and
the per-core mapping take a week, the reader and commands a few days, and the editor, disassembly
and memory views a week.

When it lands:
- mark G5.1 and G5.2 done in [CLOSING_THE_GAPS_PLAN.md](CLOSING_THE_GAPS_PLAN.md);
- update [LANDING_PAGE_COMPETITIVE_ANALYSIS.md](LANDING_PAGE_COMPETITIVE_ANALYSIS.md) §2 (the "Unit
  tests / code coverage / profiler" row: coverage per bank, the heat map and SMC detection) and §4
  (W3's text: coverage closed, profiler and tests still open);
- because the heat ramp is a new visual, update `.ai/ui-theming-intent-and-lessons.md` in the same
  change (the fixed ramp rule, T9).

---

## 8. Questions (all answered, 2026-10-08: the suggested answers)

1. **Q1: Counters on by default when coverage is switched on?** Suggested **yes** (D2/D6), with
   `-nocounts` for the leanest run. If Phase 1's measurement misses T10's gate, the default flips.
2. **Q2: Also count while not debugging?** Suggested **yes** (D6): "what did the game use?" is
   asked at full speed. The alternative, debug sessions only, matches the history recorder but
   loses that use.
3. **Q3: Reset after the injection flow?** Suggested **yes** (T11), so the ROM's boot to its main
   loop is not counted. The alternative keeps it and offers "Exclude ROM" in views only.
4. **Q4: Take over here and the abandoned future.** Suggested: keep the counts and say so (D10).
   The alternative is to reset on a fork, or to roll counts back by keeping a per-keyframe copy of
   the pool. That is 4–8 MB per keyframe, which G4.4's budget cannot absorb.
5. **Q5: Pool sizes.** 4 MB / 8 MB (D5) are suggested. A smaller pool (2 MB) would keep sp48's
   growth to 2 MB. The pool can grow later without a format change, because the reader reads
   `poolPages` from the header.
6. **Q6: `.kcov` merge format in this plan, or later?** Suggested: in Phase 6, because G5.5's "tests
   with coverage" merges per-test runs the same way.
