# ZX Spectrum Next TypeScript Removal Plan

Created: 2026-09-19
Revised: 2026-09-19 (separation-first rule, decisions D1-D7 resolved)

## Governing Rule

**No removal of the TypeScript implementation starts until the WASM implementation is totally
separated from it and is in parity with it.** Separation comes first, and it is most of the work.

- *Totally separated* means that `ZxNextWasmV2Machine` has no TypeScript Next class in its prototype
  chain or module graph. It constructs, resets and reads no TypeScript Next device, and it never falls
  back to TypeScript behaviour. The two implementations share only neutral metadata modules and a
  common IDE-facing interface.
- *In parity* is defined by the gate in Step 7. It is measured with the dual-core harness, which is
  why the TypeScript core stays fully working and tested throughout Phase A.
- Phase A (Steps 0-6) only adds, extracts and rewires. It deletes nothing that belongs to the
  TypeScript implementation, and it keeps the "ZX Spectrum Next Compatibility" model working.
- Step 7 is a hard gate that needs the project author's explicit go-ahead. Phase B (Steps 8-15), the
  removal, must not begin before that sign-off.

## Goal

Once the gate has passed, remove the TypeScript emulator implementation of the ZX Spectrum Next,
together with its tests, tooling and documentation, so the Next runs only through the WASM backend
(`ZxNextWasmV2Machine` + `src/emu/machines/zxNext/wasm/`).

This is the Next counterpart of `ZX_SPECTRUM_CLASSIC_TYPESCRIPT_REMOVAL_PLAN.md` (done 2026-08-23).

Before the first destructive step (Step 8), create and push a tag so the old implementation stays
reachable:

```sh
git tag -a pre-zxnext-ts-removal-<yyyy-mm-dd> -m "Before removing the ZX Spectrum Next TypeScript backend"
git push origin pre-zxnext-ts-removal-<yyyy-mm-dd>
```

## Why Separation Is The Hard Part

The inventory (2026-09-19) found that the TypeScript Next is not a side-by-side fallback; the WASM
machine is built on top of it.

1. **`ZxNextWasmV2Machine extends ZxNextMachine`** (`ZxNextWasmV2Machine.ts:141`). The chain is
   `ZxNextWasmV2Machine -> ZxNextMachine -> Z80NMachineBase -> Z80NCpu -> Z80Cpu`. `super()` runs the
   whole TypeScript constructor, which builds all ~25 TypeScript devices: a 2 MiB `MemoryDevice` buffer,
   the composed screen buffer, `NextIoPortManager`, 256 NextReg descriptors with closures, and the audio
   chain. Every WASM `reset`/`hardReset` resets them all again.
2. **The WASM path still executes TypeScript behaviour:**
   - Register getters are `super.xxx` reads of `Z80Cpu` storage, mirrored by `syncCpuFromWasmV2`.
   - `getCpuState` takes `sigINT`, `snoozed`, `opStartAddress` and `tactsAtLastStart` from TypeScript
     fields that are never synced from WASM.
   - Keyboard: the TypeScript `NextKeyboardDevice` is the source of truth, and `syncKeyboardToWasmV2`
     copies it into the core every frame. NEX loading works by typing `.nexload` through the TypeScript
     key queue.
   - Code injection: `injectCodeToRun` (`ZxNextMachine.ts:1782`) goes through the TypeScript
     `writeMemory`, then TypeScript contention, `tactPlusN`, and the TypeScript `onTactIncremented`
     (copper, screen, audio). Only the final `doWriteMemory` reaches WASM.
   - The debug loop calls the TypeScript `onInitNewFrame` (`ZxNextWasmV2Machine.ts:732`).
   - `tactsInFrame` and `tactsInDisplayLine` come from the TypeScript `NextComposedScreenDevice` and
     `TimingConfig`, and `MachineController.ts:694` paces frames with `tactsInFrame`.
     `clockMultiplier` is never updated on WASM.
   - `nextRegDevice` and `memoryDevice` are TypeScript instances *patched in place*
     (`installWasmNextRegFacade`, `installWasmMemoryMappingFacade`); `getDescriptors()` is deliberately
     the TypeScript one.
   - Inherited behaviour and metadata: partition labels/descriptions/groups, call stack, sysvars, key
     mapping, cursor mode, code-injection flow, disassembly sections, frame command, machine properties.
   - `executeCustomCommand` and `processFrameCommand` fall through to TypeScript for anything they do
     not handle.
   - Before `setup()` finishes, `executeMachineFrame` and `isOsInitialized` fall back to TypeScript.
3. **The harness is dual-core.** `test/harness/zxnext` (`CoreName = "ts" | "wasm"`, `ALL_CORES`,
   `onEachCore`, core-parity oracle, per-core goldens) drives 72 of the 79 `test/zxnext-hw` files and
   all 22 visual cases on both cores. This is the parity instrument, and it stays intact until Phase B.
4. **The TypeScript machine is still a shipped model.** `machine-registry.ts:185-190` offers
   "ZX Spectrum Next Compatibility" with `zxnextImplementation: "typescript"`. Users and project files
   may have it saved as `modelId`.

## Live Bugs Found During The Inventory

These affect the production WASM default today. Fixing them is part of separation:

- **Palette panel / sprite-editor palette show stale data.** `MainToEmuProcessor.getPalettedDeviceInfo`
  (815-838) casts to `ZxNextMachine` and reads the TypeScript `paletteDevice`, `spriteDevice`,
  `tilemapDevice` and `composedScreenDevice`, which WASM never updates.
- **ULA panel reads TypeScript state.** `getUlaState` (285-338) reads the TypeScript
  `beeperDevice.earBit`, TypeScript contention counters and a stub `renderingTactTable`, and it calls the
  floating-bus facade, which is a real port read with side effects. `ZxNextWasmV2Machine.getWasmV2UlaState()`
  (1164) exists, but nothing in `src` calls it.
- **Next screen menu items do nothing on WASM.** `zx-next-menus.ts:100/109/147` (F2 scandoubler,
  F3 50/60 Hz, F7 scanline weight) issue `toggleScandoubler`, `toggle5060Hz` and `adjustScanlineWeight`.
  On TypeScript these flip `composedScreenDevice.scandoublerEnabled` (NextReg `$05` bit 0),
  `is60HzMode` (`$05` bit 2, gated by `hotkey50_60HzEnabled`) and `scanlineWeight` (0-3; the menu maps
  it to `SETTING_EMU_SCANLINE_EFFECT`). The WASM `executeCustomCommand` falls through to those
  TypeScript objects, so the WASM output never changes.
- **Tape:** the registry lists `mediaIds: [MEDIA_TAPE]` for the Next, but the WASM machine has only a
  mode/EAR/MIC facade, and `setMachineProperty` has no TAPE_DATA upload path. Establish whether tape
  loading on the Next works on either core. Parity requires WASM to match TypeScript here.

## Decisions (Resolved 2026-09-19)

| # | Decision | Resolution |
|---|---|---|
| D1 | Screen menu toggles (F2 scandoubler, F3 50/60 Hz, F7 scanline weight) | **Implement them for WASM** (Step 1). The core owns the `$05` scandoubler and 50/60 Hz bits (`zxnext-nextreg.c:215-231`, taking effect at the frame start as in the VHDL). The toggles must honour `hotkey50_60HzEnabled` exactly as TypeScript does, 60 Hz must change the WASM frame timing, and the scanline weight must be held and returned with the same 0-3 cycle. |
| D2 | `Z80NCpu` / `IZ80NCpu` | **Keep.** It is a CPU, not the Next machine. `test/z80/test-z80.ts` (`Z80NTestCpu`, the `ext-op*` Z80N suites) and `test/z80-assembler/test-helpers.ts` use it. Detach it from the Next machine chain only. |
| D3 | Keyboard | **Keep a slimmed host-side key state** in the new WASM host: key matrix, extended keys, keystroke queue, `convertAsciiStringToNextKeyCodes`. It is input plumbing, not emulation, and it must not depend on the TypeScript `NextKeyboardDevice`. |
| D4 | Saved `modelId: "compatibility"` | Map it to `standard` in `MachineService.ts:60-67` and the main-process restore paths, and log once. Never throw at startup. (Phase B, together with the model's removal.) |
| D5 | The ~1,390 TypeScript-only `it`s in `test/zxnext/` | Port behaviour visible at the hardware boundary (ports, NextRegs, memory, picture, audio) into `test/zxnext-hw` in the thin areas; drop assertions on TypeScript-internal state. Record each file's disposition in this plan. |
| D6 | Parity blockers: `ZXNEXT_WASM_V2_DEFAULT_READY = false` with four ULA/screen blockers; the ULA parity audit; bug B8 ("sampled registers open") | Re-audit each one against the VHDL and close it, so that both cores agree (see the gate for how to treat a TypeScript-side bug). These items are part of the Step 7 gate and must not be silently dropped. |
| D7 | Hardware notes in the TypeScript folder (`debug.txt`, `mmc.txt`, `bootsequence.txt`, `rominfo.txt`, `screen-info.txt`, `tb_blue_refs.txt`, `screen/screen_rendering.md`, `screen/sprites.md`, `tilemap-plan.md`) | Move the hardware knowledge to `src/emu/machines/zxNext/notes/`, and drop the sections specific to the TypeScript implementation. Delete `tilemap-plan.md` (a MAME-vs-TypeScript diff). (Phase B.) |

## Target Architecture After Separation (End Of Phase A)

```
Z80Cpu -> Z80MachineBase -> ZxNextWasmHost -> ZxNextWasmV2Machine     (production, WASM)
Z80Cpu -> Z80NCpu -> Z80NMachineBase -> ZxNextMachine                 (compatibility, TS; unchanged behaviour)

Both implement IZxNextIdeMachine (the IDE-facing contract), and both import only the neutral
metadata modules (nextMemoryLayout, nextRegDescriptors, nextPalette, nextRtc, nextKeyCodes,
nextCoreVersion, ZxNextSysVars, z80nInstructionLengths, frameTraceLayout).
```

- `ZxNextWasmHost`, following `ZxSpectrum48WasmHost`, carries the machine plumbing and the Next
  specifics: `setTactsInFrame`, `frameTactMultiplier = 8`, the extended instruction length table,
  `uiFrameFrequency`, the slimmed key state, partition labels, call stack, code-injection flow, sysvars,
  frame command, machine properties and the event queue.
- `IZxNextIdeMachine` replaces today's `IZxNextMachine`, which exposes 22 TypeScript device types. It
  holds only what the IDE needs: NextReg state and descriptors, memory mappings, palette info, ULA
  state, sysvars and screen toggles. The TypeScript machine implements it from its devices and the WASM
  machine from core exports, so the IDE never needs to know which core is running, and the
  Compatibility model keeps working until Phase B.

## Keep Boundaries

**During Phase A**, everything in the TypeScript implementation is kept and must keep passing its
tests. The only permitted changes to TypeScript files are:

- importing metadata from the new neutral modules instead of defining it locally
- implementing `IZxNextIdeMachine`
- fixes needed to reach parity, when the VHDL shows TypeScript is the wrong side

**Kept permanently:**

- `ZxNextWasmV2Machine.ts`, the new `ZxNextWasmHost.ts`, `wasm/ZxNextWasmV2Loader.ts`,
  `wasm/zxnext/*.c|h`, `wasm/dist`, the build and contract scripts (`build-zxnext-wasm.cjs`,
  `check-wasm-cpu-contract.cjs`)
- `ZxNextMachineFactory.ts` (WASM-only after Phase B) and its wiring in `machine-renderer-registry.ts`
- the neutral metadata modules extracted in Step 3:
  - memory layout: `OFFS_*`, `UNPAGED_PARTITION_LABEL`, `allRamBanksFor`, `bank16kForPartition`,
    `MemoryPageInfo`
  - NextReg: descriptor/slice/state types, `EMULATED_CORE_VERSION`, `CORE_VERSION_*`, a static
    descriptor table
  - palette: `palette.ts`, `zxNextRgb333Codes`, `zxNextBgra`, `TBBLUE_DEF_TRANSPARENT_COLOR`
  - RTC: `toBcd`, `fromBcd`, `rtcRegistersFromDate`
  - key codes: `NextExtraKeyCode`, `convertAsciiStringToNextKeyCodes`
  - `ZxNextSysVars`
  - the `ZXNEXT_FRAME_TRACE_*` layout constants
  - `extendedInstructionLenghts`
- `Z80NCpu` / `IZ80NCpu` (D2)
- shared machine code: `Z80MachineBase`, `Z80Cpu`, `DebugStepDecision`, `MachineController`,
  `BeeperDevice`, `PsgChipState`
- the harness, `test/zxnext-hw`, `test/visual` (made WASM-only in Phase B), and the WASM-only tests in
  `test/wasm/zxNext`

**Removed in Phase B only:**

- `ZxNextMachine.ts`, `Z80NMachineBase.ts`, `ZxNextImplementation.ts`
- the TypeScript device classes: `AudioControlDevice`, `AudioMixerDevice`, `Clock28`,
  `CopperDevice`, `CpuSpeedDevice`, `CtcDevice`, `DacDevice`, `DacNextRegDevice`, `DacPortDevice`,
  `DivMmcDevice`, `DmaDevice`, `ExpansionBusDevice`, `I2cDevice`, `InterruptDevice`, `JoystickDevice`,
  `MemoryDevice`, `MouseDevice`, `MultifaceDevice`, `NextKeyboardDevice`, `NextPsgChip`,
  `NextRegDevice`, `NextSoundDevice`, `PaletteDevice`, `SdCardDevice`, `SpriteDevice`, `TilemapDevice`,
  `TurboSoundDevice`, `UartDevice`, `UlaDevice`, and `nextRegReadMux.ts`
- `io-ports/`, `screen/NextComposedScreenDevice.ts`, `storage/` (already dead)
- the frame-trace recorder/compare/format
- the `compatibility` model, `MC_ZXNEXT_IMPLEMENTATION`, the rollout constants, the `IZxNextMachine`
  union in `BeeperDevice` / `ISpectrumBeeperDevice` / `ISpectrumKeyboardDevice` /
  `SpectrumKeyboardDevice`, and the `machineId === "zxnext"` branch in `BeeperDevice.ts:85` (reached only
  by the TypeScript Next)
- the TypeScript/WASM parity tests, the TypeScript-core harness branches, the `ts` goldens, the
  frame-diff runner, and the TypeScript side of the benchmark

## Inventory

### Production consumers outside `src/emu/machines/zxNext`

| File | What it uses | Phase A action | Phase B action |
|---|---|---|---|
| `src/renderer/appEmu/MainToEmuProcessor.ts:28,41` | `IZxNextMachine`, a value import of `ZxNextMachine` (pulls the TypeScript machine into the emu bundle) | Type against `IZxNextIdeMachine` | none left |
| `MainToEmuProcessor.ts:711` | `nextRegDevice.getDescriptors()` | Static descriptor table | - |
| `MainToEmuProcessor.ts:724,739` | `nextRegDevice.getNextRegDeviceState()`, `memoryDevice.getMemoryMappings()` (patched facades) | `IZxNextIdeMachine` methods | - |
| `MainToEmuProcessor.ts:815-838` | TypeScript palette/sprite/tilemap/screen devices (**stale bug**) | `IZxNextIdeMachine.getPaletteInfo()`: WASM uses `zxnextGetPaletteEntry`, `zxnextGetPaletteStoredValue`, `zxnextGetSpriteTransparencyIndex`, NextRegs `$42/$43/$4B/$4C/$6B` | - |
| `MainToEmuProcessor.ts:285-338` | ULA state via a `ZxSpectrumBase` cast (**stale bug**) | `IZxNextIdeMachine.getUlaState()`; WASM uses `getWasmV2UlaState()` | - |
| `MainToEmuProcessor.ts:559` | `.sysVars` | Neutral `ZxNextSysVars` | - |
| `src/renderer/abstractions/IZxNextMachine.ts` | Types from 22 TypeScript device classes | Superseded by `IZxNextIdeMachine`; left for the TypeScript devices only | Delete |
| `src/emu/machines/BeeperDevice.ts:3,17,31,85`, `zxSpectrum/ISpectrumBeeperDevice.ts`, `ISpectrumKeyboardDevice.ts`, `SpectrumKeyboardDevice.ts` | `IZxNextMachine` union, the `zxnext` branch | Keep (the TypeScript Next uses them) | Drop the Next half and the branch |
| `src/common/messaging/EmuApi.ts:10`, `appIde/DocumentPanels/Next/nexBankReveal.ts`, `nextBankLocation.ts` | `MemoryPageInfo` | Re-point to neutral module | - |
| `src/renderer/appIde/SideBarPanels/NextRegPanel.tsx:10-14` | NextReg types | Re-point | - |
| `src/renderer/appIde/disassemblers/z80-disassembler/z80-disassembler.ts:1,50,594` | `getNextRegisters()` (constructs a full TypeScript `NextRegDevice`) | Static table | - |
| `src/renderer/appIde/DocumentPanels/Next/NexFileViewerPanel.tsx:32` | `EMULATED_CORE_VERSION` | Re-point (the C core duplicates the value at `zxnext-nextreg.c:52`; add a contract test that they match) | - |
| `NexFileViewerPanel`, `NexBankSpritesView`, `PaletteEditor`, `PalettePanel`, `NextPaletteViewer`, sprite-editor `SpriteStatusBar`, `ColorSample`, `SpriteEditorGrid`, `SpriteImage`, `useSpritePalette` | `palette.ts` helpers | Re-point if `palette.ts` moves | - |
| `src/main/machine-menus/zx-next-menus.ts:100,109,147` | Screen toggles | Implemented for WASM (D1) | - |
| `src/common/machines/machine-registry.ts:32,179-191` | `standard` / `compatibility` models | Keep | Delete `compatibility` |
| `src/common/machines/constants.ts:24` | `MC_ZXNEXT_IMPLEMENTATION` | Keep | Delete |
| `src/renderer/appEmu/MachineService.ts:60-67`, `src/main/index.ts:343-347`, `src/main/projects.ts:173-177` | Restore the saved `modelId` | - | Fallback `compatibility -> standard` (D4) |
| Comments in `Z80Cpu.ts:440`, `Z80NCpu.ts:9,46`, `DebugStepDecision.ts:137`, `disassemblers/common-types.ts:94`, `EmuApi.ts:522` | Mention `Z80NMachineBase` / `ZxNextMachine` | Update when their subject moves | Final text pass |

### Tests

| Area | Files | Disposition |
|---|---|---|
| `test/zxnext/` | 40 test files (~1,390 `it`s) + `TestNextMachine.ts`, `FileProvider.ts`, `sprite-collision-scenarios.ts`, `sprite-fpga-scenarios.ts`. All TypeScript-only; none use the harness. | Phase A: port coverage (Step 2), and move the pure-function tests (`AllRamBanks`, `I2cDevice` BCD/RTC, `NextKeyCodeMapping`, `palette-codec`) with the metadata (Step 3). Phase B: delete the rest, and first move `FileProvider.ts` and the two scenario files. |
| `test/wasm/zxNext/` oracle tests (37) | Through the oracle harness: `access-breakpoint`, `audio-mixer`, `beeper-audio`, `cpu`, `debug-step`, `divmmc`, `frame-runner`, `interrupts`, `keyboard-ula`, `memory-mmu`, `nextreg`, `nmi`, `partition-labels`, `ports`, `screen-ula`, `sd-spi`, `storage-commands`, `tape`, `scaffold-diagnostics`, `sprites`, `tilemap`, `test-helpers.test`. Boot trace: `early-boot`, `start-menu`, `full-boot`. With `createTestNextMachine`: `copper`, `copper-integration`, `expansion-multiface`, `frame-diff-runner`, `layer2-lores`, `palette-ulaplus`, `performance-boundary`. `ide-scaffold` (`new ZxNextMachine`). TypeScript devices as reference: `ctc`, `psg-audio`, `dac-audio`, `dma`. | Phase A: they are parity evidence and **must be green at the gate**. Phase B: convert to fixed WASM expectations where the scenario has value; delete pure comparisons. |
| `test/wasm/zxNext/` helpers | `wasm-next-test-helpers.ts` (`createZxNextOracleHarness`, `createOracleZxNextMachine`, `createZxNextOracleComparison`), `wasm-next-oracle-types.ts`, `wasm-next-boot-trace.ts` | Phase B: keep only `createTestZxNextWasmMachine`, and replace the `TestZxNextMachine` type (imported by ~20 files). |
| `test/wasm/zxNext/` factory tests | `rollout`, `public-adapter` | Phase B: rewrite for WASM-only |
| `test/wasm/zxNext/` meta tests | `full-matrix` (requires `test/zxnext/*.test.ts` to equal its `MATRIX`), `device-completeness` (requires `CtcDevice.test.ts`, `I2cDevice.test.ts`, `ExpansionBus*.test.ts`, `Multiface*.test.ts` to exist) | Phase A: update them when the pure-function tests move in Step 3. Phase B: rewrite or delete them **in the same commit** as the first `test/zxnext` deletion. |
| `test/wasm/zxNext/` pure WASM (19) | `audio-debug-loop`, `raster-sprite-cost`, `build`, `checkpoint`, `injection-keyboard`, `machine-lifecycle`, `screen-composition`, `shared-z80n-cpu`, `step-out-stack`, `visual-smoke`, `loader`, `shared-source-contract`, `sprites-collision`, `sprites-fpga`, `checkpoint-flow`, `debug-tools-scaffold`, `status-bar-scaffold`, ... | Keep; fix imports as modules move. |
| `test/zxnext-hw/` | 72 files use `describe.each(ALL_CORES)`; `parity/` (5 files) compares the cores; `sd/nextzxos-boot.test.ts` boots both cores; `nextreg/identity.test.ts` imports `CORE_VERSION_*` | Phase A: the main parity instrument; grows in Step 2. Phase B: WASM-only. |
| `test/harness/zxnext/` | `core/machines.ts`, `script/{session,mouse,joystick,uart-peer}.ts`, `core/{frame,load-nex-direct}.ts`, `cases/{run-case,case,golden}.ts`, `cli/run.ts` + `run.cjs`, `index.ts`, `self-tests/*` | Phase A: retype against `IZxNextIdeMachine`/the host where it references TypeScript classes only for typing. Phase B: WASM-only. |
| `test/visual/` | 22 `golden.json` files with a `ts` key (today the `ts` hashes equal the `wasm` hashes in every case) | Phase A: must stay equal (gate). Phase B: drop the `ts` key. |
| `test/audio/` | 23 of 26 files use the TypeScript Next: 10 via `TestNextMachine` (including the two `*.perf.test.ts` files), 13 via TypeScript device objects | Phase A: disposition in Step 2. Phase B: delete. Keep `AudioDeviceBase`, `AudioIntegration` (Z88), `BeeperDevice`. |
| `test/memory/partition-{descriptions,label-round-trip,parsing}.test.ts` | `new ZxNextMachine()` | Phase A: add the same cases against the WASM host (the partition methods move there). Phase B: drop the TypeScript cases. |
| `test/controls/EmulatorAudioRendering.test.ts` | `createTestNextMachine` | Phase B: retarget |
| `test/emu/z80n-step-over-lengths.test.ts`, `test/z80-disassembler/extended-ops.test.ts`, `test/renderer/nexBankReveal.test.ts`, `nextBankLocation.test.ts`, `test/controls/NextPaletteViewer.test.tsx` | Metadata imports | Phase A: re-point (Step 3) |
| `test/zxnext/ZxNextMachineFactory.test.ts:53` | Guard: no TypeScript fallback removal "without a separate deprecation plan" | Keep through Phase A; delete in Phase B (this plan is that deprecation plan) |

### Scripts, package.json, baselines (Phase B unless noted)

| Item | Action |
|---|---|
| `scripts/run-zxnext-frame-diff.ts`, `.cjs`; `diff:zxnext-machine` | **Phase A: a parity tool, use it at the gate.** Phase B: delete. |
| `scripts/benchmark-zxnext-wasm.cjs` (TypeScript baseline at 208-227, 275-279, 496, 585, 632-639; speed ratios at 18-19); `benchmark:zxnext-wasm` | Phase B: WASM-only with absolute frame-time budgets |
| `package.json` `test:visual` | Phase B: drop `--core` |
| `package.json` `test:zxnext-wasm-acceptance`, `test:zxnext-wasm-matrix` | Phase A: switch `--project jsdom` to `--project node` (they pass `.test.ts` files, which jsdom does not include, so today they probably run nothing). Phase B: remove deleted files from them. |
| `build/type-errors-baseline.json:16-19` (`DacPortDevice`, `NextRegDevice`, `AyRegPortHandler`, `NextIoPortManager`) | Phase B: clear with `npm run build:check -- --update` |

### Documentation (Phase B unless noted)

| File | Action |
|---|---|
| `src/emu/machines/zxNext/wasm/README.md` | Phase A: document the host/IDE-interface split. Phase B: WASM is the only backend. |
| `test/harness/zxnext/README.md` (lines 3-4, 30, 39-40, 52-56, 75-76, 101, 105, 115, 133, 147-163, 182) | WASM-only |
| `AGENTS.md` (Next harness section) | WASM-only; the mock-based migration note becomes "done" |
| `.ai/visual-tests-guide.md` (4, 15, 31, 43, 84), `.ai/README.md` (35, 39) | WASM-only |
| `.ai/wasm-migration-intent-and-lessons.md` (12, 54-61, 126, 151-163), `.ai/wasm-v2-machine-migration-guide.md` (176-240, 300-315) | Phase A: record the separation lesson (the WASM machine must not subclass the TypeScript machine). Phase B: the TypeScript oracle is gone; the VHDL is the reference. |
| `.ai/zx-spectrum-next-wasm-parity-audit.md` | Phase A: use it for the D6 re-audit. Phase B: delete, or fold open facts into the bugs handover. |
| `.plans/ZX_SPECTRUM_NEXT_WASM_MIGRATION_PLAN.md` (Step 28), `ZX_SPECTRUM_NEXT_ULA_WASM_PARITY_AUDIT.md`, `ZX_SPECTRUM_NEXT_FRAME_DIFF_RUNNER_PLAN.md`, `ZX_NEXT_EMULATOR_BUGS_HANDOVER.md`, `CSPECT_DIFFERENTIAL_DEBUGGING_PLAN.md` (l.11, 288, 749, 778) | Phase A: a status note pointing here. Phase B: mark the frame-diff runner retired and drop the TypeScript-to-WASM tier from the CSpect proposal. |
| TypeScript-folder notes (D7) | Relocate |
| `CHANGELOG.md` | Phase A: an entry for the IDE bug fixes and screen toggles. Phase B: the Compatibility model is removed, and saved selections fall back to the standard model. |

---

# Phase A - Separation And Parity

Nothing in Phase A deletes TypeScript implementation code. After every step, both cores pass the full
harness, and the Compatibility model still runs.

**Execution order.** Separation comes first (the project author's priority, 2026-09-19): Steps 0, 1,
3, 4, 5 and 6 run before Step 2. Step 2 (porting TypeScript-only coverage into the harness) is
additive, needs both cores, and only has to be complete by the Step 7 gate.

## 0. Baseline And Parity Audit

Status: In progress. Baseline recorded 2026-09-19 at `f61b60ed2`; the D6 re-audit, the tape status and
the frame-diff survey are still open.

Baseline (both cores, clean worktree):

- `npm test -- --project node test/zxnext test/wasm/zxNext test/zxnext-hw test/harness/zxnext test/audio test/memory`:
  209 files, 7268 passed, 1 skipped.
- `npm run test:visual`: 21/21 cases pass, all golden matches (the inventory's "22" counted a folder
  that holds no case).
- `npm run build:check`: no new type errors (121 known).
- The bugs handover's "uncommitted TS fixes" note (line 45) is stale: the worktree was clean.

Work:

- Make sure no uncommitted TypeScript-only fixes are pending (the bugs handover, line 45, mentions
  some).
- Run the full current suite on both cores and record the green baseline (counts per suite) here.
- D6: re-audit the four `ZXNEXT_WASM_V2_DEFAULT_BLOCKERS` (`ula-screen-tact-pipeline-parity`,
  `ula-timex-mode-rendering-parity`, `ula-next-plus-rendering-parity`,
  `screen-layer-composition-parity`), the open gaps in `ZX_SPECTRUM_NEXT_ULA_WASM_PARITY_AUDIT.md`, and
  B8's open part (per-pixel vs per-cell `$68` latch; sampled registers). For each one, record whether
  it is already closed (with the test that proves it) or still open (with a failing harness test on the
  divergent core).
- Establish the tape status on both cores (see *Live Bugs*).
- Use the frame-diff runner on the standard boot to NextZXOS and on the visual demo programs, and record
  the first divergences, if any.

Validation:

```sh
git status --short
npm test -- --project node test/zxnext test/wasm/zxNext test/zxnext-hw test/harness/zxnext test/audio test/memory
npm run test:visual
npm run diff:zxnext-machine
npm run build:check
```

Done when: the baseline is recorded, and every known TypeScript/WASM difference is listed in the
*Parity Ledger* below, with a test.

## 1. IDE Bugs And Screen Toggles On WASM

Status: Done 2026-09-19 (merged with the interface part of Step 4).

Result:

- F2/F3/F7 work on WASM: `executeCustomCommand` sets `$05` bit 0 / `$05` bit 2 (gated by `$06`
  bit 5) / `$09` bits 1-0 through `zxnextSetNextRegisterDirect`, reading the *stored* `$05` bits
  (the readback shows the effective ones, which change only at the frame start). Tests:
  `test/zxnext-hw/video/display-hotkeys.test.ts` HK-001..HK-006, both cores; 4 of them failed on WASM
  before the fix. The harness `pressHotkey` gained F2/F3/F7 and `lastHotkeyResult`.
- The palette, ULA, Next Registers and Memory Mapping handlers now go through `IZxNextIdeMachine`
  (Step 4), with PAR-006 (`test/zxnext-hw/parity/ide-parity.test.ts`) proving both cores report the
  same panel state.

Work:

- `getPalettedDeviceInfo`: for the WASM Next, read palettes, the stored value, `$43`, the sprite and
  tilemap transparency index, `$6B` and the ULANext format from WASM exports and NextRegs.
- `getUlaState`: for the WASM Next, use `getWasmV2UlaState()`, with no side-effecting port read.
- D1 (F2/F3/F7 toggles):
  - `toggleScandoubler` flips the core's `$05` bit 0.
  - `toggle5060Hz` flips `$05` bit 2 only when the hotkey-enable bit allows it; the change takes effect
    at the next frame start and changes the WASM frame length.
  - `adjustScanlineWeight` cycles 0-3 and returns the value, as TypeScript does.
  - Add C exports if needed, and rebuild the WASM.
- Harness tests on **both cores** for each toggle: the return value, the `$05` readback, the frame
  length after F3, and the picture where the scandoubler or scanline weight affects it. Write the tests
  first and see them fail on WASM.
- jsdom tests for the palette and ULA panels that fail today on WASM.

Validation:

```sh
npm test -- --project node test/zxnext-hw <new toggle tests>
npm test -- --project jsdom <new panel tests>
npm run build:check && npm run lint:renderer
```

Done when: no IDE panel shows TypeScript device state while running WASM, and the F2/F3/F7 toggles
behave identically on both cores.

## 2. Close Coverage Gaps In The Harness

Status: Not started.

Work:

- For each `test/zxnext/*.test.ts` and each Next file in `test/audio/`, add a row to the *Test
  Disposition Table*: *covered by `<harness file>`*, *ported to `<new harness file>`*, or *obsolete
  (TypeScript-internal)*.
- Priority areas, where harness coverage is thin relative to the TypeScript tests:
  - DivMMC (~165 `it`s vs ~20)
  - NextReg per-register behaviour and port gating (~259 vs ~94)
  - Interrupts (84 vs ~19)
  - Sprites attribute/anchor/pattern detail (~370 vs ~19 + the shared scenarios)
  - SD protocol (34 vs ~17)
  - Expansion bus/Multiface/NMI (124 vs ~44)
  - Audio: PSG, TurboSound, DAC, mixer
- Every new test uses `describe.each(ALL_CORES)`. A disagreement between the cores is a parity finding:
  add it to the *Parity Ledger*, and settle it against the VHDL.

Validation:

```sh
npm test -- --project node test/zxnext-hw
```

Done when: every file has a disposition, and every *ported* row exists and passes on both cores.

## 3. Extract Neutral Metadata Modules

Status: Done 2026-09-19.

Result (all under `src/emu/machines/zxNext/`; importers point at them directly, no re-exports):

- `nextMemoryLayout.ts`: `OFFS_*`, `UNPAGED_PARTITION_LABEL`, `allRamBanksFor`, `bank16kForPartition`,
  `MemoryPageInfo`. The WASM machine's private copies of the offsets are gone.
- `nextRegDescriptors.ts`: the NextReg types and the static `NEXT_REG_DESCRIPTORS` table (141
  registers, generated from `NextRegDevice`; no holes), `getNextRegDescriptor`. Both cores'
  `getNextRegDescriptors()` and the disassembler read it.
- `nextCoreVersion.ts`, `nextRtc.ts`, `nextKeyCodes.ts` (with `EXTRA_KEY_COMBOS`),
  `nextColorTables.ts` (`zxNextRgb333Codes`, `zxNextBgra`, `TBBLUE_DEF_TRANSPARENT_COLOR`; separate from
  `palette.ts`, which imports renderer code), `z80nInstructionLengths.ts`, `wasm/frameTraceLayout.ts`.
- Tests of the neutral modules live in `test/zxnext-shared/` (they survive Phase B):
  `nextMemoryLayout`, `palette-codec`, `nextRtc`, `nextKeyCodes` (moved from `test/zxnext/`) and
  `nextRegDescriptors` (new; checks the static table against `NextRegDevice` until Phase B). The
  full-matrix and device-completeness meta tests were updated.
- `getNextRegisters()` stays in `NextRegDevice.ts` (unused now) until Phase B, per the governing rule.
- Verified: 257 node test files / 8550 tests, jsdom controls, `build:check`, the Vite build.

Work:

- Create TypeScript-emulation-free modules under `src/emu/machines/zxNext/` (suggested:
  `nextMemoryLayout.ts`, `nextRegDescriptors.ts`, `nextPalette.ts`, `nextRtc.ts`, `nextKeyCodes.ts`,
  `nextCoreVersion.ts`, `z80nInstructionLengths.ts`, `wasm/frameTraceLayout.ts`).
- Build the static NextReg descriptor table (id, name, description, slices, access flags) without the
  read/write closures. Add a test that it matches `NextRegDevice.getDescriptors()` field for field.
- Point **both** the TypeScript machine/devices and every other consumer at the new modules. Per
  AGENTS.md, use direct imports with no re-export wrappers; the TypeScript files keep their behaviour
  and only lose their local copies of the data.
- Move the pure-function tests next to their new modules, and update the `full-matrix` and
  `device-completeness` meta tests accordingly.
- Add a contract test that `EMULATED_CORE_VERSION` equals the C core's value.

Validation:

```sh
npm test -- --project node test/z80-disassembler test/renderer test/emu test/wasm/zxNext test/zxnext test/zxnext-hw
npm test -- --project jsdom test/controls
npm run build:check && npm run lint:renderer
```

Done when: `ZxNextWasmV2Machine`, its loader, the renderer, common and main import metadata only from
the neutral modules.

## 4. Introduce `IZxNextIdeMachine` And Rewire The IDE

Status: Mostly done 2026-09-19. `src/emu/machines/zxNext/IZxNextIdeMachine.ts` defines the contract;
both machines implement it; `MainToEmuProcessor` no longer imports `ZxNextMachine` or
`IZxNextMachine` and dispatches on `isZxNextIdeMachine`. The harness exposes it as
`s.ideState()`, and PAR-006 is the dual-machine IDE parity test (in place of jsdom tests: it runs the
real cores). Remaining: `getNextRegDescriptors` on WASM still comes from the inherited TypeScript
`NextRegDevice` until Step 3's static table; the remaining `IZxNextMachine` users belong to the
TypeScript devices and go in Phase B.

New WASM exports added for it: `zxnextGetTimingTotalHc/Vc`, `zxnextGetTotalContentionDelaySinceStart`,
`zxnextGetContentionDelaySincePause`, `zxnextGetNextRegisterLastWrite` (CPU writes only, as the
TypeScript `writeRegister` records them), `zxnextPeekNextRegister` (a `$253B` read without selecting),
`zxnextGetMemoryPort7ffd/Dffd/1ffd/Eff7`.

Work:

- Define `IZxNextIdeMachine`: NextReg state and descriptors, memory mappings, palette info, ULA state,
  sysvars, and the screen toggle commands.
- Implement it on `ZxNextMachine` (from its devices) and on `ZxNextWasmV2Machine` (from core exports).
- `MainToEmuProcessor`: drop the `ZxNextMachine` value import and all device-field casts, and call only
  `IZxNextIdeMachine`.
- Add jsdom tests that run each Next IDE handler against both machines and compare the results. This
  is IDE-level parity.

Validation:

```sh
rg "ZxNextMachine\b|nextRegDevice|memoryDevice|paletteDevice|composedScreenDevice|spriteDevice|tilemapDevice" src/renderer src/common src/main
npm test -- --project jsdom test/controls test/renderer
npm run build:check && npm run lint:renderer
```

Done when: no renderer, common or main file references a TypeScript Next class or device field, and the
IDE shows the same data for both cores.

## 5. Build `ZxNextWasmHost` And Detach The WASM Machine

Status: Done 2026-09-19, except the parts of the app smoke test not yet driven (below).

App smoke test (2026-09-19, Playwright's Electron driver as in `scripts/doc-shots/`, an isolated
settings file and a *copy* of the SD card image): on both the standard (WASM) and the Compatibility
(TypeScript) model NextZXOS boots from the card to the main menu, the RTC shows the host time, frames
pace at 50 Hz, the cursor keys move the menu selection, and the renderer logs no errors. The status bar
showed 3.5 MHz on WASM and 28 MHz on TypeScript while NextZXOS ran at 28 MHz (P18, fixed). **Not yet
driven in the app:** `.nexload`/code injection of a project, the debugger (step, step over/out,
breakpoints), the Next panels, checkpoints, the F-key menu items - these are covered by the test suites
(`wasm-next-debug-step`, `-access-breakpoint`, `-step-out-stack`, `-checkpoint-flow`, PAR-006,
`display-hotkeys`), but should get one manual pass before the gate.

Result:

- `ZxNextWasmHost extends Z80MachineBase` (`ZxNextWasmHost.ts`): frame units (`frameTactMultiplier`
  8, 3.5 MHz base clock), frame command, the slimmed key-stroke queue (D3: keys go straight to the core
  through `setKeyStatus`; no `NextKeyboardDevice`, no per-frame matrix sync), code injection writing
  through `doWriteMemory` (no TypeScript contention or tact path), partition names, disassembly
  sections, sysvars, `getCallInstructionLength`, `onInitNewFrame` (the rendering mark only).
- The logic both machines share moved to the neutral `nextMachineInfo.ts` (partition naming,
  disassembly sections, the NextZXOS code-injection flow, `z80nCallInstructionLength`); the TypeScript
  machine delegates to it. `test/zxnext-shared/nextMachineInfo.test.ts` pins both machines to it.
- `ZxNextWasmV2Machine extends ZxNextWasmHost implements IZxNextIdeMachine`. Gone: the TypeScript
  device construction and resets, the in-place `nextRegDevice`/`memoryDevice` patches, the keyboard
  mirror, the pre-`setup()` fallback to the TypeScript frame runner (it now throws), the TypeScript
  `onInitNewFrame` in the debug loop. `tactsInFrame` (frame pacing, the key queue), `tactsInDisplayLine`,
  `sigINT` (new export `zxnextGetCpuSigInt`) and the contention counters come from the core;
  `opStartAddress` is recorded before each debug-loop instruction when access breakpoints are watched.
  The tape and floating-bus facades have local types (the Spectrum device interfaces' type graph
  reached every TypeScript Next device).
- `Z80MachineBase.frameTactMultiplier` is typed `number` (was the literal `1`).
- Separation guards: `test/wasm/zxNext/wasm-next-separation.test.ts` - no TypeScript Next class in the
  prototype chain, no TypeScript Next emulation file reachable from `ZxNextWasmV2Machine.ts` or the
  loader through any import (type imports included), no TypeScript device on an instance.
- WASM tests moved off the removed facades (NextRegs through `$243B`/`$253B`, state through
  `getNextRegState()`); the harness types its machine as `NextMachine` (the union); no new harness
  type errors (61 before and after).

Work:

- Create `ZxNextWasmHost extends Z80MachineBase`, following `ZxSpectrum48WasmHost`, with the Next
  specifics listed under *Target Architecture*.
- Change `ZxNextWasmV2Machine` to extend the host instead of `ZxNextMachine`. Re-home every dependency
  from *Why Separation Is The Hard Part*, reading WASM state rather than TypeScript state:
  - Registers: read from the runtime, or keep a `Z80Cpu`-storage mirror; do not use `Z80NCpu`.
  - `getCpuState`: take `sigINT`, `snoozed`, `opStartAddress` and `tactsAtLastStart` from WASM (add
    exports if missing).
  - `tactsInFrame` / `tactsInDisplayLine` / `clockMultiplier` from `zxnextGetTactsInFrame` and the CPU
    speed, so that `MachineController` pacing is right at 50 and 60 Hz and at every CPU speed.
  - Keyboard (D3): the slimmed host key state and queue, with no `NextKeyboardDevice`.
  - Code injection: `getCodeInjectionFlow` / `injectCodeToRun` write straight to WASM memory, with no
    TypeScript contention or tact path. Verify NEX/autoexec injection end to end.
  - Debug loop: replace the TypeScript `onInitNewFrame` with the WASM frame-start equivalent.
  - Partition labels, descriptions and groups, call stack, `getCallInstructionLength`, `romId`,
    `isSpectrum48RomSelected`, `sysVars`, `getDisassemblySections`, the frame command, machine
    properties, `loadRomFromFile`, the event queue, `dispose` / `onStop`.
  - `executeCustomCommand` / `processFrameCommand`: no fall-through; handle every command TypeScript
    handles (`cycleCpuSpeed`, the expansion-bus commands, the NMIs, the `sd-*` commands, the D1
    toggles), and report unknown ones explicitly.
  - Replace the in-place `nextRegDevice` / `memoryDevice` patches with host methods behind
    `IZxNextIdeMachine`.
  - Pre-`setup()`: `executeMachineFrame` and `isOsInitialized` must not fall back; wait for the runtime.
  - Tape / floating bus / screen facades: keep what the IDE reads, and bring tape to parity with the
    TypeScript core (the Step 0 finding).
- Add separation guard tests (these later stay as permanent architecture tests):
  - `ZxNextWasmV2Machine`'s prototype chain contains no class from the TypeScript Next files.
  - The module graph of `ZxNextWasmV2Machine.ts` and `ZxNextWasmV2Loader.ts` imports no TypeScript
    Next device, `ZxNextMachine`, `Z80NMachineBase` or `Z80NCpu` (a static import-scan test).
  - Constructing and hard-resetting the WASM machine instantiates no TypeScript Next device.
- Add the partition label/description tests against the WASM host (mirroring `test/memory`).

Validation:

```sh
npm test -- --project node test/wasm/zxNext test/zxnext-hw test/zxnext test/emu test/memory
npm run test:visual
npm run build:check
npx electron-vite build --config build/electron.vite.config.ts
```

Also run the app on **both** models (Next and Next Compatibility):

- boot NextZXOS from the SD card and `.nexload` a program
- the debugger: step, step over, step out, breakpoints, memory and I/O breakpoints
- code injection
- the F2-F8 hotkeys
- the Next Registers, Memory Mapping, Palette and sprite-editor panels
- checkpoints
- tape

Done when: the separation guard tests pass, the full dual-core suite is green, and the app smoke test
passes on both models.

## 6. Documentation For The Separated State

Status: Not started.

Work:

- `wasm/README.md`: the host and IDE-interface architecture.
- `.ai/wasm-migration-intent-and-lessons.md`: the durable lesson (a WASM machine must not subclass the
  TypeScript machine; share metadata modules and an IDE interface instead).
- A status note in the related `.plans/` files pointing here.
- `CHANGELOG.md`: the IDE fixes and the working screen toggles on WASM.

Done when: a reader of the docs would build the next machine migration separated from the start.

## 7. GATE - Separation And Parity Sign-Off

Status: Not started. **Phase B requires the project author's explicit go-ahead after this gate.**

All of the following must hold, with evidence recorded in this plan:

1. **Separation:** the Step 5 guard tests pass. `rg "ZxNextMachine\b|Z80NMachineBase|NextRegDevice|MemoryDevice|NextKeyboardDevice" src/emu/machines/zxNext/ZxNextWasmV2Machine.ts src/emu/machines/zxNext/ZxNextWasmHost.ts src/emu/machines/zxNext/wasm`
   finds nothing but comments.
2. **Harness parity:** every `test/zxnext-hw` file, including `parity/` and `sd/nextzxos-boot` when the
   card image is present, passes on both cores, with no core-specific skips or `knownFailures` other
   than the documented WASM-only features (checkpoints).
3. **Visual parity:** `npm run test:visual` passes with exact core parity in all 22 cases, and
   `ts == wasm` in every golden.
4. **Oracle-test parity:** all 37 TypeScript/WASM oracle tests in `test/wasm/zxNext` pass.
5. **Frame-diff parity:** the frame-diff runner reports no divergence over the NextZXOS boot and the
   demo set, or only divergences listed and resolved in the ledger.
6. **Ledger closed:** every *Parity Ledger* row is *Resolved*. When the VHDL shows the TypeScript core
   is the wrong side, fix TypeScript too, so the cores agree. An item may be *Accepted* only with the
   project author's explicit agreement, recorded in the row.
7. **D6 closed:** the four `DEFAULT_BLOCKERS` and B8 are resolved.
   `ZXNEXT_WASM_V2_DEFAULT_READY` is set to `true` and `ZXNEXT_WASM_V2_DEFAULT_BLOCKERS` is empty; this
   commit is the formal parity declaration.
8. **IDE parity:** the Step 4 dual-machine IDE handler tests pass.
9. **Coverage:** the *Test Disposition Table* is complete.
10. **Green build:** `npm run build:check`, `npm run lint:renderer` and the Vite build pass, and the
    Step 5 app smoke test passes on both models.

Done when: all ten points hold and the project author has approved moving to Phase B.

---

# Phase B - Removal (only after the Step 7 gate)

## 8. Tag The Last Commit With The TypeScript Next

Status: Not started.

- Commit Phase A and check the tag name for collisions.
- Create and push `pre-zxnext-ts-removal-<yyyy-mm-dd>`, pointing at the gate commit, where both cores
  pass.

```sh
git status --short
git tag --list 'pre-zxnext-ts-removal-*'
git push origin pre-zxnext-ts-removal-<yyyy-mm-dd>
```

## 9. Make The Harness WASM-Only

Status: Not started.

- **Pass 1 (behavioural):** set `ALL_CORES = ["wasm"]`.
  - Remove the TypeScript branches in `core/machines.ts` (`createCore`, `readNextRegDirect`),
    `script/{mouse,joystick,uart-peer}.ts`, and `script/session.ts` (`setRtcTime`, the `step()`
    `DebugSupport` workaround, the checkpoint guards).
  - Delete `onEachCore`, the core-parity oracle (`cases/run-case.ts:217-240`), `coreParity`,
    `KnownFailure.core`, and `longOnly` if it existed only for the slow TypeScript core.
  - Remove `--core` (`cli/run.ts`, `cli/run.cjs`, `package.json` `test:visual`).
- **Pass 2 (mechanical):** drop the `core` parameter from `createSession`, replace
  `describe.each(ALL_CORES)` in the 72 `test/zxnext-hw` files, and delete `CoreName` / `ALL_CORES`.
- Remove the `ts` key from the 22 goldens, and update `cases/golden.ts`.
- `test/zxnext-hw/parity/`: delete the pure comparisons. Keep `checkpoint-parity` as a WASM
  self-consistency test. Convert `sd/nextzxos-boot.test.ts` to WASM-only expectations.
- Update `self-tests/session.test.ts`, `self-tests/harness.test.ts`, the harness README,
  `.ai/visual-tests-guide.md`, `.ai/README.md` and the AGENTS.md harness section.

```sh
npm test -- --project node test/harness/zxnext test/zxnext-hw
npm run test:visual
rg '"ts"|CoreName|ALL_CORES|onEachCore|coreParity' test/harness test/zxnext-hw test/visual
```

## 10. Convert Or Delete The `test/wasm/zxNext` Oracle Tests

Status: Not started.

- Replace the oracle helpers with WASM-only helpers, and replace the `TestZxNextMachine` type.
- Pin valuable scenarios (boot traces, debug-step, partition labels, storage commands, tape, DMA) as
  fixed WASM expectations. Delete pure comparisons, `frame-diff-runner`, and the TypeScript half of
  `performance-boundary`.
- Rewrite `rollout` / `public-adapter` for WASM-only.
- Delete the rollout constants and the diagnostics fields that carry them, and update
  `machine-lifecycle`, `shared-source-contract` and `ide-scaffold`.
- Rewrite or delete the `full-matrix` and `device-completeness` meta tests.

```sh
rg "createZxNextOracle|createOracleZxNextMachine|TestZxNextMachine|createTestNextMachine|ZxNextOracleBackend" test
npm test -- --project node test/wasm/zxNext
```

## 11. Delete The Remaining TypeScript-Only Tests

Status: Not started.

- Move `FileProvider.ts` and the two sprite scenario files to the WASM test helpers first.
- Following the disposition table, delete the `test/zxnext/` tests and `TestNextMachine.ts`, and the
  Next `test/audio/` files (both `*.perf.test.ts` included).
- Drop the TypeScript cases from `test/memory/partition-*.test.ts`, and retarget
  `test/controls/EmulatorAudioRendering.test.ts`.
- Delete `test/zxnext/ZxNextMachineFactory.test.ts` and its guard. Update `test/audio/README.md`.

```sh
rg "test/zxnext/|\.\./zxnext/|TestNextMachine" test scripts package.json
npm test -- --project node test/memory test/audio test/wasm/zxNext
npm test -- --project jsdom test/controls
```

## 12. Remove The Implementation Switch And The Compatibility Model

Status: Not started.

- Delete `ZxNextImplementation.ts` and `MC_ZXNEXT_IMPLEMENTATION`. `createZxNextMachine` always returns
  the WASM machine, and its return type changes accordingly.
- Delete the `compatibility` model; keep `standard` and its id.
- D4: add the `compatibility -> standard` fallback in `MachineService.ts` and the main-process restore
  paths, with tests that load settings and a project saved with `modelId: "compatibility"`.

```sh
rg "zxnextImplementation|MC_ZXNEXT_IMPLEMENTATION|getZxNextImplementation" src test
npm run build:check
```

## 13. Delete The TypeScript Next Implementation

Status: Not started.

- Delete everything listed under *Keep Boundaries -> Removed in Phase B only*.
- Delete `IZxNextMachine` and remove it from `BeeperDevice`, `ISpectrumBeeperDevice`,
  `ISpectrumKeyboardDevice` and `SpectrumKeyboardDevice`; delete the `BeeperDevice.ts:85` Next branch.
- Delete the descriptor-equivalence test from Step 3. Keep the Step 5 separation guards, retargeted as
  "no module imports a deleted file".
- Keep `Z80NCpu` (D2). Relocate the notes (D7).
- Delete `run-zxnext-frame-diff.ts`, `.cjs` and `diff:zxnext-machine`. Make `benchmark-zxnext-wasm.cjs`
  WASM-only, and trim the acceptance/matrix scripts.
- Clear the type-errors baseline entries with `npm run build:check -- --update`.

```sh
rg "ZxNextMachine\b|Z80NMachineBase|IZxNextMachine\b|NextComposedScreenDevice|NextIoPortManager|TurboSoundDevice|NextPsgChip|CopperDevice|SpriteDevice|TilemapDevice|nextRegReadMux|ZxNextFrameTraceRecorder" src test scripts
npm run build:check
npx electron-vite build --config build/electron.vite.config.ts
```

## 14. Documentation, Plans And Changelog

Status: Not started.

- Rewrite `wasm/README.md` for the WASM-only Next.
- Update the `.ai/` files, and delete or fold `.ai/zx-spectrum-next-wasm-parity-audit.md`.
- Mark the frame-diff runner plan retired, and drop the TypeScript tier from the CSpect proposal.
- `CHANGELOG.md`: the Compatibility model is removed, and saved selections fall back to the standard
  model.

Done when: `rg -i "typescript (core|backend|fallback|oracle)|compatibility model|ts core" AGENTS.md .ai .docs test/harness src/emu/machines/zxNext`
returns only intentional historical mentions.

## 15. Final Full Verification

Status: Not started.

```sh
npm test -- --project node
npm test -- --project jsdom
npm run test:visual
npm run build:check
npm run lint:renderer
npx electron-vite build --config build/electron.vite.config.ts
npm run benchmark:zxnext-wasm
git diff --check
```

Also repeat the Step 5 app smoke test on the Next model, switch between the Next and the classic
machines, and open a project saved with the old Compatibility model.

## Completion Criteria

- The Step 7 gate passed, with recorded evidence and the author's approval, before any removal.
- The `pre-zxnext-ts-removal-*` tag is pushed and points at the gate commit.
- `createZxNextMachine` always returns the WASM machine; there is no backend switch or Compatibility
  model, and saved selections fall back cleanly.
- No TypeScript Next machine, device or port handler remains in `src/`, and `Z80NCpu` remains as a
  standalone CPU.
- The IDE reads WASM state through `IZxNextIdeMachine` (or its successor); the F2/F3/F7 toggles work.
- The harness, `test/zxnext-hw` and the visual cases are WASM-only.
- Every deleted TypeScript-only test is covered by a harness/WASM test or recorded as obsolete.
- Docs, `.ai` notes, AGENTS.md, plans and the changelog describe the WASM-only Next.

## Parity Ledger

Filled in from Step 0 onward. One row per known TypeScript/WASM difference.

| Id | Difference | Proving test | VHDL verdict (which core is right) | Fix (core / commit) | Status |
|---|---|---|---|---|---|
| P1 | B8: `$68` half-pixel scroll latched per pixel-write (WASM) vs per 8-pixel cell (TS); sampled registers open | | | | Open |
| P2 | Default blocker `ula-screen-tact-pipeline-parity` | | | | To audit |
| P3 | Default blocker `ula-timex-mode-rendering-parity` | | | | To audit |
| P4 | Default blocker `ula-next-plus-rendering-parity` | | | | To audit |
| P5 | Default blocker `screen-layer-composition-parity` | | | | To audit |
| P6 | F2/F3/F7 screen toggles have no effect on WASM | `display-hotkeys.test.ts` HK-001..006 | n/a (host feature) | WASM sets `$05`/`$09` | Resolved |
| P7 | Palette/ULA IDE panels read TypeScript state on WASM | PAR-006 | n/a (IDE) | `IZxNextIdeMachine` | Resolved |
| P8 | Tape loading on WASM (no TAPE_DATA path) | | | | To audit |
| P9 | TS Palettes panel showed `$4C`/`$6B` from dead `TilemapDevice` fields (defaults, never written) | PAR-006 | n/a (IDE) | read `composedScreenDevice` | Resolved |
| P10 | TS ULA & I/O panel threw on the TS Next (no `screenDevice`); both reported ROM/RAM 0 | PAR-006 | n/a (IDE) | `getNextUlaState` on both | Resolved |
| P11 | WASM Memory Mapping: logical instead of physical offsets, ROM `bank16k` -1, paging ports rebuilt from `$8E`, `$EFF7`/DivMMC hard-coded 0 | PAR-006 | n/a (IDE) | core page table + port exports | Resolved |
| P12 | WASM contention counters (ULA panel, `getCpuState`) never mirrored | PAR-006 | n/a | counter exports, mirrored like sp48 | Resolved |
| P13 | Next Registers panel: WASM showed raw stored bytes for all 256 ids and a last write for read-only ones; TS showed unmasked read functions | PAR-006 | both now show the `$253B` readback (read mux) and CPU last writes | `zxnextPeekNextRegister`, `zxnextGetNextRegisterLastWrite` | Resolved |
| P14 | TS `getDescriptors()` returns an array with trailing holes (sorts a sparse table) | `nextRegDescriptors.test.ts` | n/a | Step 3 static table | Resolved |
| P15 | `getRomFlags()`: TS reported all 8 pages as RAM (the memory editor then treated the ROM as writable), WASM pages 0-1 as ROM | `nextMachineInfo.test.ts` | n/a (IDE; static by design, like the classic machines) | shared `NEXT_ROM_FLAGS` | Resolved |
| P16 | `getCpuState().snoozed` (CPU held by the DMA): TS reports it, WASM never does | | n/a (debug view) | | Open |
| P17 | `opStartAddress` (Breakpoints panel, memory/I/O hits): WASM never set it | `wasm-next-access-breakpoint.test.ts` | n/a | recorded in the debug loop | Resolved |
| P18 | Status bar CPU speed: WASM never updated `clockMultiplier` (showed 3.5 MHz while NextZXOS ran at 28 MHz) | `wasm-next-clock-report.test.ts` | effective speed, `$07` bits 5-4 | mirrored in `syncCpuFromWasmV2` | Resolved |

## Test Disposition Table

Filled in during Step 2. One row per `test/zxnext/*.test.ts` and per Next file in `test/audio/`.

| TypeScript test file | Disposition | Harness / WASM replacement |
|---|---|---|
| | | |
