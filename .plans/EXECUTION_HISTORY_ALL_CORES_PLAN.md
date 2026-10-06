# Execution History in Every Core Plan

Status: **decisions recorded** (2026-10-06). Depends on [EXECUTION_HISTORY_VIEWER_PLAN.md](EXECUTION_HISTORY_VIEWER_PLAN.md)
(G4.1), which designs the recorder, the record format, the reader and the viewer. D1–D12 are the
decisions; the author accepted the suggested answers to all §7 questions, folded into D2 and D10–D12.

Scope:
- [CLOSING_THE_GAPS_PLAN.md](CLOSING_THE_GAPS_PLAN.md) **G4.2**: the same history recording for the
  48K/16K, 128K (and its Pentagon model and the Scorpion ZS-256), +2E/+3E/+2A/+3, Timex
  (TC2048/TC2068/TS2068), Cambridge Z88 and ZX80/ZX81 cores.
- The roadmap calls G4.2 "the groundwork for G4.4": after it, every Z80 machine has a ring of
  sequence-numbered, timestamped records that a reverse-debugging engine can index.

Not in scope: the C64 (a TypeScript 6510 machine, no Z80, no WASM core). The viewer's empty state
already says "This machine does not record history".

---

## 1. What is being added, and why

G4.1 puts the recorder in the **shared Z80** (`src/emu/z80/wasm/z80.c` + `z80-history.c`), behind
hook macros with empty defaults, and wires it into the Next. Every other core compiles the same
`z80.c` (enforced by `scripts/check-wasm-cpu-contract.cjs`), so the hooks are already there; they
just do nothing until a core defines them.

G4.2 is therefore **per-core wiring, not new design**. For each core:
1. define the hook macros and the four core-provided macros (`Z80_HISTORY_CAPACITY`,
   `Z80_HISTORY_PEEK`, `Z80_HISTORY_CONTEXT`, `Z80_HISTORY_FRAME`/`_FRAME_TACT`);
2. add the shared exports and volatile symbols to its build script, and grow its linear memory;
3. implement `IExecutionHistorySource` on its machine class (a few lines over `WasmHistoryReader`);
4. write a context decoder in `src/common/history/contexts/`;
5. set `MF_EXEC_HISTORY` for its machine ids.

The viewer, the commands, the menu and (later) G4.3's step back then work on that machine with no UI
change. That is the payoff of G4.1's D11 and D12.

### 1.1 Decisions

| # | Decision |
| --- | --- |
| D1 | **No core-specific recorder code.** If a core seems to need one, the shared module grows a macro instead. The contract test asserts every core that defines one history hook defines all of them. |
| D2 | **Capacity 65,536 records (4 MB) for every 3.5 MHz-class core.** At roughly 8 T-states per instruction and 70,000 T-states per frame, that is about 7–8 frames (~150 ms) of a 48K program (Q1: kept over 32,768, which would save only 2 MB), comparable to the Next's two frames at 28 MHz. The Z88 (3.2768 MHz) and ZX80/81 (3.25 MHz) get the same. |
| D3 | **Linear memory grows by 4 MB per core** (§2.2): the measured headroom (0.5–2.6 MB) cannot hold the ring. The memory size is part of the layout fingerprint, which changes anyway (T6). |
| D4 | **One machine context per core**, 16 bytes, defined in §3. Its decoder's invariant is the same as the Next's: at any point, `partitionFor(context, address)` equals the live machine's `getPartition(address)`. One test per core asserts it. |
| D5 | **Models share their core's context.** Pentagon and Scorpion use the 128K context (the Scorpion's extra fields fit its spare bytes); the Timex models use the 48K core with `SP48_SCLD` and a Timex context; 16K uses the 48K context. |
| D6 | **ZX80/81 display fetches coalesce.** On a stock ZX81 every M1 fetch from the display file above 32K returns a forced NOP (`zx8081-memory.c:25-50`). Those become one record of kind *forced-NOP run* per display line, with the repeat count, not 32 NOP records per line (T2). |
| D7 | **The order follows usage, not effort.** 48K (and Timex, which shares its source) → 128K/Pentagon/Scorpion → +3E → Z88 → ZX80/81. Each core is a separate, shippable change. |
| D8 | **RZX playback records history.** A desync stop (G2.7) is exactly where "how did I get here?" matters. `sp48ExecutePlayInstruction` runs the same `z80ExecuteCpuCycle`, so the hook covers it; a test proves it. |
| D9 | **The Z88's in-core run loop needs nothing special.** `z88ExecuteUntilStop` (`z88.c:223`) loops `z80ExecuteCpuCycle` in C, so the hook records there too, without a TypeScript round trip. Its performance budget is therefore the strictest (T5). |
| D10 | **Interrupt service is collapsed, not hidden** (Q2). The viewer folds each INT/NMI … `RETI`/`RETN` span (paired with `flowKind`) into one expandable row, "▸ NMI service, 14 instructions, 96 T", so nothing becomes invisible and the step numbering stays continuous. The toggle exists on every machine, defaults to **on** for `zx80`/`zx81` and **off** elsewhere, and is remembered per machine id. With it on, G4.3's Step Back treats a collapsed service as one step ([LITE_STEP_BACK_PLAN.md](LITE_STEP_BACK_PLAN.md) D8). |
| D11 | **Land per core on `main`, release together; a partial release is safe** (Q3). `MF_EXEC_HISTORY` gates the viewer per machine, so a release cut midway ships the finished cores only. The **48K lands first**, because G4.3 uses it as its second test machine after the Next. |
| D12 | **The ZX81 "M1NOT" modification needs nothing** (Q4). The recorder records the byte the CPU decoded, so it stays correct if M1NOT is ever modelled. |

---

## 2. Current code paths this touches

### 2.1 Per core

| Core | Main source; Z80 include | Instruction wrapper | Opcode hooks already defined | Machine class / loader |
| --- | --- | --- | --- | --- |
| 48K/16K | `zxSpectrum48/wasm/sp48/sp48.c`; `z80.c` at `:354` | `sp48ExecuteInstruction` `:720` (one *cycle* per call); RZX play `:691` | `Z80_REFRESH`, `Z80_INT_ACK` (RZX) | `ZxSpectrum48WasmV2Machine.ts`, `Sp48WasmV2Loader.ts` |
| Timex | `timex/wasm/timex/timex.c` includes `sp48.c` (`:48`) with `SP48_SCLD` | inherited | inherited | `TimexWasmV2Machine` (extends the 48K machine), 48K loader |
| 128K, Pentagon, Scorpion | `zxSpectrum128/wasm/sp128/sp128.c`; `z80.c` at `:917` | `sp128ExecuteInstruction` `:1469` | `Z80_BEFORE_OPCODE_FETCH` (Beta 128), `Z80_REFRESH`, `Z80_INT_ACK` | `ZxSpectrum128WasmV2Machine.ts`, `Sp128WasmV2Loader.ts` |
| +2E/+3E/+2A/+3 | `zxSpectrumP3e/wasm/spp3e/spp3e.c`; `z80.c` at `:797` | `spp3eExecuteInstruction` `:1918` | `Z80_REFRESH`, `Z80_INT_ACK` | `ZxSpectrumP3eWasmV2Machine.ts`, `SpP3eWasmV2Loader.ts` |
| Z88 | `z88/wasm/z88/z88.c`; `z80.c` at `:124` (CMOS) | `z88ExecuteInstruction` `:189`; `z88ExecuteUntilStop` `:223` | `Z80_BEFORE_OPCODE_FETCH` | `Z88WasmV2Machine.ts`, `Z88WasmV2Loader.ts` |
| ZX80/81 | `zx8081/wasm/zx8081/zx8081.c`; `z80.c` at `:152` | `zx8081ExecuteInstruction` `:221`; `zx8081ExecuteUntilStop` `:249` | `Z80_BEFORE_OPCODE_FETCH` (M1 marker for the forced NOP), `Z80_REFRESH`, `Z80_INT_ACK` | `Zx8081WasmV2Machine.ts`, `Zx8081WasmV2Loader.ts` |

Build scripts: `scripts/build-{sp48,timex,sp128,spp3e,z88,zx8081}-wasm.cjs` (each has a
`*_VOLATILE_SYMBOLS` list and `productionExports`, and adds `RZX_VOLATILE_SYMBOLS` where relevant;
the history list joins them the same way).

### 2.2 Memory headroom (from each `dist/*.wasm`'s `klive.layout` section, last volatile range end)

| Core | Memory now | Approx. free | Proposed |
| --- | --- | --- | --- |
| sp48 | 8 MB | 1.7 MB | 12 MB |
| timex | 8 MB | 1.3 MB | 12 MB |
| sp128 | 9 MB | 1.0 MB | 13 MB |
| spp3e | 8 MB | 0.5 MB | 12 MB |
| z88 | 8 MB | 2.6 MB | 12 MB |
| zx8081 | 2 MB | 1.3 MB | 6 MB |

The figures are an upper bound on what is free (the stack and anything after the last volatile
symbol are not counted); Phase 0 confirms them from the linker maps. The ring is volatile, so `.kls`
files grow only by the deflated size of 4 MB of zeros (a few KB).

### 2.3 Shared pieces (from G4.1)

`src/emu/z80/wasm/z80-history.c`, `scripts/z80-history-exports.cjs`,
`src/emu/machines/history/WasmHistoryReader.ts`, `src/emu/abstractions/IExecutionHistorySource.ts`,
`src/common/history/` (decoder, register diff, flow kind, contexts), `MF_EXEC_HISTORY`.

---

## 3. Machine contexts (16 bytes each)

| Core | Bytes |
| --- | --- |
| 48K/16K | 0: model (16K/48K); the rest reserved. No paging: the partition is always the flat RAM/ROM one. |
| Timex | 0: port `$F4` (HSR), 1: port `$FF` (DEC, incl. the EXROM/DOCK select bit), 2: chunk-source bitmap for the 8 × 8K chunks (2 bits each: HOME/DOCK/EXROM, packed into bytes 2–3), 4: model. From `timexRebuildChunkMap`'s inputs, not its pointers. |
| 128K, Pentagon | 0: port `$7FFD`, 1: selected ROM, 2: selected bank, 3: flags (bit 0 Beta 128 TR-DOS ROM paged, bit 1 paging locked), 4: model. |
| Scorpion | As 128K, plus 5: port `$1FFD` (RAM bank high bits, ROM select R0–R3, all-RAM). |
| +2E/+3E/+2A/+3 | 0: `$7FFD`, 1: `$1FFD`, 2–5: `spp3eMemorySlotPartition[0..3]` (already the partition per slot), 6: flags (special paging mode). |
| Z88 | 0–3: SR0–SR3 (segment registers), 4–11: `z88PageBank[0..7]` (bank per 8K page, which covers the split segment 0), 12: COM register bits that affect segment 0 (RAMS), 13: flags. |
| ZX80/81 | 0: model and RAM size (1K/16K/32K/64K), 1: flags (bit 0 inside the NMI service, bit 1 SLOW mode as last observed). No banking. |

Rules that apply to all of them:
- The context is captured **after** the M1 fetch (G4.1 T3), so a TR-DOS page-in at `$3Dxx` is the
  map that fetched the instruction.
- The decoder lives beside the machine's own `getPartition` override and is tested against it (D4).

---

## 4. The traps

1. **T1: The 48K-family wrapper runs a cycle, not an instruction.** Already handled by hooking
   `z80ExecuteCpuCycle` (G4.1 D2), but these cores are where it bites. Each core gets the `DD CB d op`
   one-record test.
2. **T2: ZX81 display execution floods the ring.** The CPU "executes" the display file: each M1 above
   32K with bit 6 clear returns `$00` to the CPU while the ULA latches the byte. Without D6 a
   SLOW-mode frame writes about 24 × 33 NOP records plus the NMI service. The core marks these
   fetches (it already knows: `zx8081M1Fetch` and the forced-NOP branch in `zx8081-memory.c`) through
   a new optional macro `Z80_HISTORY_FORCED_NOP()` that the shared recorder uses to merge them into
   one *forced-NOP run* record per line. The recorded byte 0 is `$00`, which is what the CPU decoded
   (G4.1 T3), and the record's PC is the display address where the run started.
3. **T3: ZX81 NMIs are frequent but genuine.** In SLOW mode an NMI arrives every scan line during
   the picture, and the ROM's NMI service runs each time. These are real instructions and are
   recorded. The ZX80 has no NMI generator, but takes an INT on every display line, so its `$0038`
   service interleaves with the forced-NOP runs. Both are handled by collapsing interrupt service
   (D10), on by default for these two machines.
4. **T4: Tact epochs.** sp48, sp128 and spp3e rebase their tact origin (`sp48ShiftTactOrigin` and
   the mirrors). The record stores the frame counter (`sp48Frames`, `zx8081Frames`, …) and the tact
   within the frame, never an absolute tact (G4.1 T10). Where a core lacks a frame counter, one is
   added as a **volatile** static (it is debug bookkeeping, not machine state), so the state image
   is unchanged.
5. **T5: Performance in the cores without a TypeScript loop.** On the Spectrum cores, debug runs
   already pay a TS round trip per instruction (`executeWasmV2DebugLoop`), so the recorder's cost is
   small there. On the Z88 and ZX80/81, `…ExecuteUntilStop` runs the debug loop in C, so the recorder
   is a visible fraction of it. Budget: **≤ 15%** in those C loops, **≤ 8%** in the TS loops,
   **within noise** when off; each core gets a performance-boundary test.
6. **T6: Every core's fingerprint changes.** `.kls` files saved by earlier builds will not restore on
   that core. For the Spectrum family the `.szx` fallback (G2.6) still loads them; for the Z88 and
   ZX80/81 it is the existing per-build policy, which any release that adds a static to a core
   triggers anyway, so the release note is routine (D11).
7. **T7: The Beta 128 and the Timex DOCK change the map *at* the fetch.** The 128K's
   `Z80_BEFORE_OPCODE_FETCH` pages the TR-DOS ROM in for fetches at `$3D00`–`$3DFF` and out above
   `$3FFF`. The record's bytes and context must be the paged-in ones; a test runs a `RANDOMIZE USR
   15616` style entry and checks the record names the TR-DOS partition.
8. **T8: Z88 snooze and coma.** In snooze the CPU is HALTed (coalesced, G4.1 T6); in coma the clock
   stops and no cycle runs, so nothing is recorded. The viewer shows the frame gap through the frame
   hairline, which is the honest picture. A test puts the Z88 to sleep and wakes it.
9. **T9: RZX playback and recording.** Playback replaces IN values and counts fetches for the
   interrupt (`Z80_REFRESH`, `Z80_INT_ACK`); the recorder only reads registers, so it cannot disturb
   either. A test plays a recording with history on and asserts the RZX round-trip test still yields
   identical RAM and registers (D8).
10. **T10: Determinism.** `test/wasm/state/machine-state-determinism.test.ts` must still pass on every
    core with recording **on**, which proves the recorder touches only volatile memory.

---

## 5. Phases

Each phase is one core and one shippable change, except Phase 0.

| Phase | Work | Done when |
| --- | --- | --- |
| 0 | Confirm headroom from the linker maps; add `Z80_HISTORY_FORCED_NOP` to `z80-history.c` with a unit test in the Next build (unused there). | §2.2 figures confirmed; the contract test still passes. |
| 1 | **48K/16K and Timex** (one source): hooks, peek over `sp48Memory` / the Timex chunk map, contexts, exports, memory, machine source, decoders, `MF_EXEC_HISTORY`. | The §6 core tests pass for `sp48` and `timex`; RZX playback test (T9). |
| 2 | **128K, Pentagon, Scorpion**: peek over `sp128MemorySlotBase`, contexts, TR-DOS test (T7). | Tests pass for `sp128`, `pentagon`, `scorpion`. |
| 3 | **+2E/+3E/+2A/+3**: peek over `spp3eMemorySlotBase`, context from the partition table, special paging test. | Tests pass for all `spp3e` models. |
| 4 | **Z88**: peek through `z88PageOffset`, context, snooze test (T8), C-loop performance (T5). | Tests pass; performance within budget. |
| 5 | **ZX80/81**: forced-NOP runs (T2), collapsed interrupt service in the viewer, default on (D10, T3), C-loop performance. | A SLOW-mode frame produces one forced-NOP record per display line; tests pass for `zx80` and `zx81`. |
| 6 | Verification in the running IDE on each machine; docs; competitive analysis §2/§4 and the roadmap. | A screenshot per machine family. |

---

## 6. Tests (per core)

Shared test bodies in `test/wasm/history/historyCoreSuite.ts`, instantiated once per core with its
harness (`test/harness/{sp48,sp128,timex,z88,zx81}`) so each core runs the same checks:
- one record per instruction, including `DD CB d op` (T1);
- registers before each instruction equal those seen by single-stepping;
- INT/NMI records and the ISR's first instruction;
- HALT coalescing;
- ring wrap and sequence continuity;
- recording off writes nothing;
- the context decoder's partition equals `getPartition` at random points (D4);
- the history is cleared by a state restore and survives a step and a pause;
- `machine-state-determinism` with recording on (T10).

Core-specific: TR-DOS page-in (T7), Timex DOCK/EXROM chunks, +3 special paging, Z88 snooze (T8),
ZX81 forced-NOP runs and SLOW-mode NMIs (T2, T3), RZX playback (T9).

All of them instantiate cores, so they live under `test/wasm/**` (already in `E2E_CORE_TESTS`'s
globs) or are added to `build/e2e-tests.ts`.

---

## 7. Questions (all answered, 2026-10-06)

1. **Q1 — Ring size.** 65,536 records (4 MB) for every 3.5 MHz-class core (D2).
2. **Q2 — ZX80/81 interrupt service.** Collapsed into expandable rows, on by default for ZX80/81
   only, remembered per machine; Step Back treats a collapsed service as one step (D10).
3. **Q3 — Release.** Per core on `main`, released together; a partial release is safe; the 48K first
   (D11).
4. **Q4 — ZX81 "M1NOT".** Closed: nothing to do (D12).

## 8. Effort

**M**, as the roadmap estimated: about two to three days per core family once G4.1's recorder
exists, most of it in tests and contexts. The ZX80/81 is the largest because of T2 and T3.
