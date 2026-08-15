# ZX Spectrum +3/+3E WASM Migration Plan

Created: 2026-08-09

Completed: 2026-08-09

## Completion Summary

The +2E/+3E WASM v2 backend is implemented as the rollout default, with the
TypeScript backend retained as an explicit fallback. The production build emits
only `zx-spectrum-p3e.wasm`, and the focused factory, adapter, loader, build,
size, TypeScript, and whitespace checks pass.

## Goal

Migrate the existing ZX Spectrum +2E/+3E machine family (`spp3e`) from the
current TypeScript-only implementation to a full-machine C/WASM backend. Keep
the TypeScript backend available behind a two-value runtime switch during
rollout, and make the WASM backend the production default only after memory,
video, audio, tape, disk, and debug parity are covered.

This plan uses the V2 lessons from the 48K and 128K migrations:

- keep the normal frame path inside WASM with one frame export;
- compose shared Spectrum C devices instead of duplicating ULA, keyboard,
  beeper, and tape code;
- use TypeScript machines as the migration oracle;
- expose typed views for large buffers and avoid per-frame copies;
- preserve frame overshoot, timing-table contracts, and model-specific
  contention/floating-bus behavior;
- make performance decisions from benchmarks after correctness is stable.

## Current State

- The +3E TypeScript implementation lives in
  `src/emu/machines/zxSpectrumP3e/ZxSpectrumP3eMachine.ts`.
- The machine family is registered as `MI_SPECTRUM_3E = "spp3e"` and presents
  product-oriented models:
  - `nofdd`: ZX Spectrum +2E
  - `fdd1`: ZX Spectrum +3E (1 FDD)
  - `fdd2`: ZX Spectrum +3E (2 FDDs)
- `machine-renderer-registry.ts` currently constructs
  `new ZxSpectrumP3EMachine(model!)` directly, so there is no +3E backend
  switch yet.
- The +3E TypeScript machine extends `ZxSpectrumBase` and composes:
  - `PagedMemory(4, 8)` for four ROMs and eight RAM banks;
  - `CommonScreenDevice.ZxSpectrumP3EScreenConfiguration`;
  - shared Spectrum keyboard, beeper, and tape devices;
  - 128K PSG/AY device;
  - `FloppyControllerDevice` when disk support is enabled;
  - `ZxSpectrumP3eFloatingBusDevice`.
- The 128K WASM backend is now a production full-machine V2 implementation.
  Reuse its adapter, loader, build, timing, PSG, tape, and optimization
  patterns wherever the +3E contract is identical.

## MAME Reference Findings

Use MAME as a secondary hardware-behavior reference, not as a drop-in source
tree. The local checkout is useful, but the upstream GitHub tree has newer
paths and extra reusable device sources, so check both when implementing.

Local files inspected:

- `/Users/dotneteer/source/mame/src/mame/sinclair/spec128.cpp`
- `/Users/dotneteer/source/mame/src/mame/sinclair/spec128.h`
- `/Users/dotneteer/source/mame/src/mame/sinclair/spectrum_ula.cpp`
- `/Users/dotneteer/source/mame/src/mame/sinclair/spectrum_ula.h`
- `/Users/dotneteer/source/mame/src/mame/sinclair/specnext.cpp`
- `/Users/dotneteer/source/mame/src/devices/sound/ay8910.cpp`
- `/Users/dotneteer/source/mame/src/devices/sound/ay8910.h`

Upstream GitHub references:

- `https://github.com/mamedev/mame/blob/master/src/mame/sinclair/spec128.cpp`
- `https://github.com/mamedev/mame/blob/master/src/mame/sinclair/spectrum_ula.cpp`
- `https://github.com/mamedev/mame/blob/master/src/mame/sinclair/spectrum_ula.h`
- `https://github.com/mamedev/mame/blob/master/src/mame/sinclair/next/specnext.cpp`
- `https://github.com/mamedev/mame/blob/master/src/devices/sound/ay8910.cpp`
- `https://github.com/mamedev/mame/blob/master/src/devices/sound/ay8910.h`
- `https://github.com/mamedev/mame/blob/master/src/devices/machine/upd765.cpp`
- `https://github.com/mamedev/mame/blob/master/src/devices/machine/upd765.h`
- `https://github.com/mamedev/mame/blob/master/src/lib/formats/upd765_dsk.cpp`
- `https://github.com/mamedev/mame/blob/master/src/lib/formats/upd765_dsk.h`
- `https://github.com/mamedev/mame/blob/master/docs/source/techspecs/floppy.rst`

Concrete takeaways:

- MAME's `spec128.cpp` documents the 128K/+2/+2A/+3 frame as 70908 T-states
  at about 50.021 Hz, describes the +3/+2A two-port paging split, and includes
  +3E background links. It is a useful +3 hardware reference even though Klive's
  `spp3e` target remains the +2E/+3E family already modeled in TypeScript.
- MAME models the +2A/+3 ULA as a distinct contended ULA type
  (`SPECTRUM_ULA_PLUS2A`) with a different contention sequence from 48K/128K
  and a later base timing offset. Use this as a cross-check when building +3E
  timing tables and floating-bus offsets.
- MAME's +2A/+3 contention rule agrees with the current TypeScript direction:
  `0x4000-0x7fff` is contended, and `0xc000-0xffff` is contended when bank 4,
  5, 6, or 7 is paged at the top slot.
- MAME's current upstream ZX Next compatibility path moved to
  `src/mame/sinclair/next/specnext.cpp`. It derives +3 special-memory layouts
  from `1ffd` bits at an 8K MMU page level rather than hard-coding only four
  16K labels. Keep Klive's current TypeScript layouts as the oracle, but use
  this bit derivation as a review reference for `spp3e` C paging code.
- MAME's Next path also records +3-oriented timing details that are good
  cross-checks: a 32-cycle IRQ pulse for 48K/+3 timing versus 36 cycles for
  128K/Pentagon timing, and a slightly different +3 interrupt X position from
  the 128K case.
- MAME keeps +3 FDC I/O traps at the expected `0x2ffd`/`0x3ffd`-style decoded
  port ranges in the Next path. The current upstream repo also exposes reusable
  uPD765-family sources and UPD765 disk-format helpers. Use these as a
  behavioral checklist for status bits, command/result phases, IRQ/DRQ/TC,
  sector matching, read/write/format commands, and DSK geometry. Do not copy
  them directly into Klive's freestanding WASM build; `FloppyControllerDevice`
  remains the primary parity oracle.
- The MAME AY/YM implementation remains the best algorithmic reference for PSG
  tone, noise, envelope, register masks, and mixer behavior, matching the lesson
  recorded in the shared WASM migration guide.

## Architecture Direction

Build the +3E backend as a full machine in C/WASM, not as a fast Z80 core with
TypeScript-owned devices.

Normal frame flow:

1. Sync changed app-owned inputs into WASM:
   - keyboard rows;
   - audio sample rate and target clock multiplier;
   - tape controls;
   - disk insert/eject/write-protect changes.
2. Call one exported frame function, for example `spp3eExecuteFrame()`.
3. Read stable typed views and cheap counters:
   - flat 64K memory snapshot;
   - ROM/RAM partitions;
   - pixel bytes;
   - mixed stereo audio samples;
   - disk change buffers or revision counters;
   - frame/tact counters and diagnostic state.

Do not cross the JS/WASM boundary per tact, per instruction, per memory access,
per port access, per scanline, per PSG tick, or per FDC byte during normal
running.

## Proposed Files

- `src/emu/machines/zxSpectrumP3e/ZxSpectrumP3eImplementation.ts`
- `src/emu/machines/zxSpectrumP3e/ZxSpectrumP3eMachineFactory.ts`
- `src/emu/machines/zxSpectrumP3e/ZxSpectrumP3eWasmV2Machine.ts`
- `src/emu/machines/zxSpectrumP3e/wasm/SpP3eWasmV2Loader.ts`
- `src/emu/machines/zxSpectrumP3e/wasm/README.md`
- `src/emu/machines/zxSpectrumP3e/wasm/spp3e/spp3e.c`
- `src/emu/machines/zxSpectrumP3e/wasm/spp3e/spp3e-memory.c`
- `src/emu/machines/zxSpectrumP3e/wasm/spp3e/spp3e-ports.c`
- `src/emu/machines/zxSpectrumP3e/wasm/spp3e/spp3e-ula.c`
- `src/emu/machines/zxSpectrumP3e/wasm/spp3e/spp3e-psg.c`
- `src/emu/machines/zxSpectrumP3e/wasm/spp3e/spp3e-floppy.c`
- `scripts/build-spp3e-wasm.cjs`
- `scripts/build-spp3e-wasm.d.cts`
- `scripts/check-spp3e-wasm-size.cjs`
- `test/zxSpectrum/ZxSpectrumP3eMachineFactory.test.ts`
- `test/zxSpectrum/ZxSpectrumP3eWasmV2Machine.test.ts`
- `test/zxSpectrum/spp3e-wasm-v2-loader.test.ts`
- `test/zxSpectrum/spp3e-wasm-build.test.ts`

Reuse these existing shared C sources instead of copying their logic:

- `src/emu/machines/zxSpectrum/wasm/common/`
- `src/emu/z80/wasm/z80.c`
- 128K PSG code as the starting point for AY-compatible behavior

Move code to a neutral shared C location only when +3E and 128K both need the
same physical implementation and the move can be validated against both
backends in the same slice.

## Runtime Switch Plan

Mirror the 48K and 128K implementation-switch pattern:

- Add `MC_SPP3E_IMPLEMENTATION = "spp3eImplementation"` to
  `src/common/machines/constants.ts`.
- Add `ZxSpectrumP3eImplementation.ts` with:
  - `type ZxSpectrumP3eImplementation = "typescript" | "wasm"`;
  - `SPP3E_IMPLEMENTATION = MC_SPP3E_IMPLEMENTATION`;
  - `DEFAULT_SPP3E_IMPLEMENTATION = "wasm"` after the Step 15 parity gate;
  - `getZxSpectrumP3eImplementation(config?: Record<string, unknown>)`.
- Add `createZxSpectrumP3eMachine(model?, config?)`.
- Update `machine-renderer-registry.ts` so `spp3e` routes through the factory
  and forwards `model` and `config`.
- Keep model picker entries backend-neutral. Do not add "WASM" or
  "TypeScript" product models.

## C/WASM Machine Scope

### Memory and Paging

- Allocate static memory:
  - `uint8_t spp3eRam[8][0x4000]`;
  - `uint8_t spp3eRom[4][0x4000]`;
  - a flat 64K mirror if existing UI/debugger consumers require a stable view.
- Implement reset mapping:
  - ROM 0 at `0x0000-0x3fff`;
  - RAM 5 at `0x4000-0x7fff`;
  - RAM 2 at `0x8000-0xbfff`;
  - RAM 0 at `0xc000-0xffff`.
- Implement normal `0x7ffd` paging:
  - bits 0-2: selected RAM bank at `0xc000`;
  - bit 3: shadow screen bank 7 when set, bank 5 when clear;
  - bit 4: low ROM-select bit;
  - bit 5: paging disable.
- Implement +3E special paging via the `0x1ffd`-decoded port
  `(address & 0xf002) === 0x1000`:
  - bit 0: special paging mode enabled;
  - bits 1-2: special config mode;
  - bit 3: disk motor;
  - selected ROM high bit from `specialConfigMode & 0x02`.
- Match TypeScript special memory layouts:
  - mode 0: banks `0, 1, 2, 3`;
  - mode 1: banks `4, 5, 6, 7`;
  - mode 2: banks `4, 5, 6, 3`;
  - mode 3: banks `4, 7, 6, 3`.
- Expose selected ROM, selected RAM bank, paging enabled, shadow screen,
  special paging mode, special config mode, disk motor, current partitions, and
  ROM flags.
- Preserve bank-aware code injection helpers for both +3E and 48K-compatible
  injection flows.

### Timing and Contention

- Use `CommonScreenDevice.ZxSpectrumP3EScreenConfiguration` values:
  - same visible geometry shape as the 128K configuration;
  - +3E contention sequence `[0, 7, 6, 5, 4, 3, 2, 1]`.
- Keep the machine frame length aligned with the current TypeScript +3E
  configuration, and cross-check the 128K/+2/+2A/+3 MAME reference value of
  70908 T-states per frame before locking tests.
- Cross-check the timing tables against MAME's `SPECTRUM_ULA_PLUS2A` behavior:
  - MAME's +2A/+3 ULA uses a shifted pattern equivalent to
    `[1, 0, 7, 6, 5, 4, 3, 2]` in its local timing coordinate system;
  - MAME sets the +2A/+3 contended ULA base offset later than 48K/128K;
  - MAME's upstream Next compatibility path distinguishes +3 timing from 128K
    timing for interrupt pulse width and interrupt X position;
  - document any coordinate conversion needed to reconcile MAME's local pattern
    with Klive's `CommonScreenDevice.ZxSpectrumP3EScreenConfiguration`.
- Export timing-table helpers like the 48K/128K WASM backends:
  - rendering phase;
  - pixel address;
  - attribute address;
  - pixel buffer index;
  - contention value.
- Match TypeScript contention rules:
  - normal mode: `0x4000-0x7fff` is contended;
  - normal mode: `0xc000-0xffff` is contended when selected bank is 4-7;
  - special mode 0: no pages are contended;
  - special mode 1: all four 16K slots are contended;
  - special modes 2 and 3: slots below `0xc000` are contended, the top slot is
    not.
- Apply the same rules for contended I/O addresses.

### ULA and Floating Bus

- Reuse the shared ULA renderer structure and +3E timing configuration.
- Read display bytes from bank 5 normally and bank 7 when shadow screen is
  selected.
- Expose direct pixel bytes and instant-screen rendering.
- Implement +3E floating bus behavior:
  - sample with `currentFrameTact - 3`;
  - return `lastContendedValue | 0x01` during border/none/display B1/B2 phases;
  - return `lastUlaReadValue` during ULA fetch phases;
  - only apply the +2/+3 floating bus port set `4 * n + 1` while paging is
    enabled; otherwise return `0xff` for unsupported reads.

### Ports

Implement the TypeScript port decoding contract:

- low address bit clear: `0xfe` keyboard, border, EAR/MIC, beeper, and tape EAR;
- `(address & 0x00e0) === 0`: current Kempston placeholder returns `0xff`;
- `(address & 0xc002) === 0xc000`: PSG register index write and PSG selected
  register read;
- `(address & 0xc002) === 0x8000`: PSG selected register value write;
- `(address & 0xc002) === 0x4000`: `0x7ffd` memory paging;
- `(address & 0xf002) === 0x1000`: +3E special memory and disk motor control;
- `(address & 0xf002) === 0x2000`: FDC main status register read;
- `(address & 0xf002) === 0x3000`: FDC data register read/write;
- unsupported reads: +2/+3 floating bus when eligible, otherwise `0xff`.
- Review but do not blindly adopt MAME's port quirks:
  - `spec128.cpp` maps `0x7ffd` with `(A15 | A1) == 0` and notes that reading
    from that decoded port writes the data-bus value;
  - upstream `specnext.cpp` gates `0x7ffd` and `0x1ffd` writes by lock and
    feature enables;
  - the first WASM version should preserve Klive TypeScript behavior unless a
    focused compatibility test proves a deliberate correction is needed.

### PSG and Audio

- Reuse the 128K WASM PSG implementation as the starting point, and keep
  MAME's `ay8910.cpp`/`ay8910.h` as the algorithmic reference when checking
  tone, noise, envelope, register masks, and mixer output.
- Keep AY stepping cadence at one PSG output update every 16 ULA tacts.
- Mix beeper and PSG in C into one bounded stereo `int16_t` audio sample
  buffer.
- Keep audio sample-rate synchronization change-based.
- Preserve debugger/diagnostic state equivalent to current `getPsgState()`
  consumers.

### Tape

- Reuse the shared C tape model used by 48K and 128K unless +3E ROM behavior
  proves a difference.
- Mirror app-level properties into C-owned tape state:
  - `MEDIA_TAPE`;
  - `TAPE_MODE`;
  - `FAST_LOAD`;
  - `REWIND_REQUESTED`;
  - saved blocks back to `SAVED_TO_TAPE`.
- Keep media parsing and project ownership in TypeScript.

### Floppy and Disk Media

Treat disk support as the main +3E-specific migration risk. The goal is to move
hot FDC/drive state into WASM while keeping app-owned disk files and persistence
in TypeScript.

- Support all current model variants:
  - no FDD: FDC ports return `0xff` and disk controls are inert;
  - one FDD: drive A is active;
  - two FDDs: drives A and B are active.
- Port or share the NEC uPD765-compatible controller behavior currently in
  `FloppyControllerDevice`. This TypeScript device is the primary oracle.
  Upstream MAME's `upd765.cpp`/`upd765.h` and `upd765_dsk.cpp`/`upd765_dsk.h`
  are secondary references for edge cases, not direct source material.
- Keep deterministic state in C/WASM:
  - main status register and result phases;
  - command bytes and command descriptors;
  - command, execution, and result phase transitions;
  - status registers;
  - selected unit/head/cylinder/sector;
  - motor/head/ready state;
  - IRQ, DRQ, terminal count, and busy state;
  - read/write data offsets;
  - dirty-sector tracking or a bounded change journal.
- Keep unbounded and file-format ownership in TypeScript initially:
  - DSK/EDSK parsing in `disk-readers.ts`;
  - project media properties `MEDIA_DISK_A` and `MEDIA_DISK_B`;
  - final save through `DISK_A_CHANGES` and `DISK_B_CHANGES`.
- Add a narrow disk-upload ABI:
  - upload parsed disk geometry and track/sector metadata into bounded WASM
    tables;
  - upload sector bytes into a bounded disk-data buffer;
  - update write-protect flags by drive;
  - publish changed sectors only when a WASM disk revision counter changes.
- If porting the full disk parser to C becomes necessary for performance, treat
  it as a separate follow-up after a working parsed-disk upload path exists.
- Preserve existing frame-level motor behavior: call the WASM equivalent of
  `onFrameCompleted()` once per completed machine frame.
- Before porting command execution, review MAME's uPD765 command table and
  UPD765 DSK format helper for status-byte and geometry edge cases, then encode
  only the behavior needed to match Klive's existing tests and TypeScript
  runtime.

### Debug and IDE Integration

- Export `spp3eExecuteInstruction()` for one-instruction stepping.
- Keep breakpoint, step-over, step-out, execution-point, and UI policy in
  TypeScript.
- Pull CPU registers and last bus events only for setup, reset, pause/debug, or
  explicit `getCpuState()`.
- Keep normal frames on the single frame export once frame-completion helpers
  are present.
- Preserve code injection flows:
  - `sp48` flow through the +3E ROM menu and ROM 3 entry point;
  - `spp3e` flow through ROM 0 to ROM 1 editor return point.

## Build, Packaging, and Performance

- Add npm scripts:
  - `build:spp3e-wasm`;
  - `check:spp3e-wasm-size`.
- Build to
  `src/emu/machines/zxSpectrumP3e/wasm/dist/zx-spectrum-p3e.wasm`.
- Package resources from `zxSpectrumP3e/wasm/dist` to `wasm/zxSpectrumP3e`.
- Use the current freestanding clang pattern:
  - `--target=wasm32`;
  - `-std=c11`;
  - `-O3 -Wl,--strip-all` for the default speed profile;
  - fixed initial/max memory;
  - explicit production exports.
- Remove stale experimental artifacts from the dist folder before each build.
- Set the size ceiling only after the first measured production artifact and
  record the reason in `check-spp3e-wasm-size.cjs`.
- Extend `scripts/benchmark-spectrum-wasm.cjs` after correctness lands:
  - add +3E no-FDD baseline loops;
  - add +3E special-paging loops;
  - add FDC status/data port loops;
  - add disk read/write command scenarios with loaded disk images.

## Small Testable Work Items

Build this migration as narrow slices. Each slice should compile, include
focused tests, and leave the default +3E implementation as TypeScript until the
rollout slice.

### 1. Add the +3E Implementation Switch

Files:

- `src/common/machines/constants.ts`
- `src/emu/machines/zxSpectrumP3e/ZxSpectrumP3eImplementation.ts`
- `src/emu/machines/zxSpectrumP3e/ZxSpectrumP3eMachineFactory.ts`
- `src/common/machines/machine-renderer-registry.ts`
- `test/zxSpectrum/ZxSpectrumP3eMachineFactory.test.ts`

Done when:

- default selection creates the WASM machine;
- explicit `"typescript"` creates the TypeScript machine;
- explicit `"wasm"` creates the WASM adapter;
- unknown values fall back to the default;
- no backend-specific model picker entries are added.

Validation:

```sh
npm test -- --project jsdom test/zxSpectrum/ZxSpectrumP3eMachineFactory.test.ts
npm run build:check
git diff --check
```

### 2. Add Build, Packaging, and Loader Skeleton

Files:

- `package.json`
- `scripts/build-spp3e-wasm.cjs`
- `scripts/build-spp3e-wasm.d.cts`
- `scripts/check-spp3e-wasm-size.cjs`
- `src/emu/machines/zxSpectrumP3e/wasm/SpP3eWasmV2Loader.ts`
- `src/emu/machines/zxSpectrumP3e/wasm/README.md`
- `src/emu/machines/zxSpectrumP3e/wasm/spp3e/spp3e.c`
- `test/zxSpectrum/spp3e-wasm-v2-loader.test.ts`
- `test/zxSpectrum/spp3e-wasm-build.test.ts`

Done when:

- `npm run build:spp3e-wasm` emits only `zx-spectrum-p3e.wasm`;
- loader validation rejects missing exports;
- typed views are bounds-checked against exported memory;
- the build test instantiates the production artifact.

### 3. Port Static Memory, ROM Uploads, and Reset Mapping

Done when:

- four ROMs and eight RAM banks are statically allocated;
- reset partitions match TypeScript labels and ROM flags;
- ROM writes are blocked through normal writes;
- direct partition helpers can upload all four ROMs and inspect all banks;
- flat 64K memory reflects the current mapping.

### 4. Implement Normal and Special Paging Ports

Done when:

- `0x7ffd` RAM bank, shadow screen, ROM low bit, and paging lock match
  TypeScript;
- `0x1ffd` special paging mode, config mode, ROM high bit, and disk motor match
  TypeScript;
- special-mode bank layouts match modes 0-3;
- the special-mode implementation has been compared against MAME's
  upstream `src/mame/sinclair/next/specnext.cpp` `1ffd` bit-derived 8K mapping
  as a secondary review reference;
- paging lock prevents further `0x7ffd` updates but does not break current
  TypeScript `0x1ffd` behavior;
- any intentional difference from MAME's `0x7ffd` read-side-effect and
  `0x1ffd` lock-gating behavior is documented in tests or code comments.

### 5. Integrate the Z80 Core

Done when:

- the shared C Z80 core executes a simple RAM instruction stream;
- memory and port callbacks route through +3E C logic;
- register getters/setters and `spp3eExecuteInstruction()` work;
- last memory and port bus events update in debug stepping paths.

### 6. Add +3E Timing and Contention

Done when:

- timing table exports match the TypeScript `ZxSpectrumP3EScreenConfiguration`;
- MAME's `SPECTRUM_ULA_PLUS2A` contention pattern and base-offset convention
  have been reviewed, with any Klive/MAME coordinate differences documented in
  comments or tests;
- MAME's 70908-T-state frame note and upstream +3 interrupt-position details
  have been checked against Klive's +3E screen configuration;
- memory and I/O contention match normal and special paging modes;
- representative HALT and repeated I/O loops match TypeScript tact counts.

### 7. Add Keyboard and `0xfe` Port Behavior

Done when:

- keyboard matrix reads match TypeScript for selected row combinations;
- unchanged keyboard rows are not rewritten every frame;
- border, EAR, MIC, beeper, and tape EAR behavior match the current machine.

### 8. Add ULA Rendering, Shadow Screen, and Floating Bus

Done when:

- bank 5 and bank 7 screen sources render correctly;
- pixel byte view and instant-screen render are exposed and bounds-checked;
- floating bus direct helper tests and CPU-level repeated `IN A,(C)` tests
  match TypeScript for +2/+3 floating bus ports.

### 9. Add Beeper and PSG Audio

Done when:

- beeper and PSG samples are mixed in C into one stereo sample buffer;
- AY register masks, tone/noise/envelope behavior, and sample cadence match the
  128K WASM backend;
- sample-rate sync is change-based;
- basic audio frames are non-empty and unclipped in representative cases.

### 10. Add Tape Playback and Save Capture

Done when:

- tape upload/control/save publication mirrors the 128K WASM adapter pattern;
- fast load, rewind, passive/load/save modes, and saved revision counters are
  covered by loader or adapter tests.

### 11. Add FDC Skeleton and No-Disk Port Behavior

Done when:

- no-FDD model returns `0xff` on FDC status/data ports;
- one-FDD and two-FDD models expose enabled drive counts;
- FDC reset state, main status register, result phase, and data register are
  observable;
- motor control through `0x1ffd` updates WASM drive state.
- MAME's uPD765 main-status/result-phase behavior has been reviewed as a
  secondary checklist before finalizing status-register tests.

### 12. Port Disk Insert/Eject and Drive State

Done when:

- `MEDIA_DISK_A` and `MEDIA_DISK_B` changes upload/eject parsed disk data;
- write-protect flags sync to WASM;
- drive A/B selection, head load, motor speed, ready, track 0, cylinder, and head
  state match TypeScript representative cases;
- frame completion advances motor speed once per frame.

### 13. Port FDC Command Execution

Done when:

- command, execution, and result phases match TypeScript for representative
  commands;
- read-data, write-data, seek/recalibrate, sense interrupt/status, read ID, and
  scan paths are covered by focused parity tests;
- MAME's uPD765 command decoding, IRQ/DRQ/TC, sector matching, and
  read/write/format behaviors have been reviewed for edge cases and any
  accepted Klive differences have been recorded;
- dirty-sector changes are journaled in WASM and published back to
  `DISK_A_CHANGES` / `DISK_B_CHANGES` only when revision counters change.

### 14. Use the WASM Normal Frame Path

Done when:

- `executeMachineFrame()` calls `spp3eExecuteFrame()` in normal running;
- keyboard, audio, tape, disk, and target clock multiplier sync only when
  changed;
- normal frames sync frame counters only;
- debug and non-normal modes use one-instruction stepping with fresh CPU state.

### 15. Automated and Manual Parity Pass

Done when:

- automated parity covers reset mapping, normal paging, special paging,
  contention, screen source, floating bus, keyboard, PSG, tape controls, no-FDD
  behavior, one-FDD behavior, and two-FDD behavior;
- manual app smoke verifies +2E boot, +3E boot, BASIC menu flow, keyboard,
  shadow screen, PSG/beeper audio, tape loading, disk catalog/load/save, banked
  code injection, and debugger stepping.

### 16. Flip the Default to WASM

Done when:

- `DEFAULT_SPP3E_IMPLEMENTATION` is `"wasm"`;
- explicit `"typescript"` remains covered as fallback;
- product model entries remain backend-neutral.

### 17. Clean Up Migration-Only Artifacts

Done when:

- temporary placeholders and stale WASM artifacts are removed;
- build scripts emit only production artifacts;
- tests protect the production contract rather than comparison scaffolding.

## Oracle Tests to Add

- Factory selection for default, explicit `"wasm"`, explicit `"typescript"`,
  and unknown values.
- Loader tests for required exports, typed view ranges, module cache, artifact
  naming, disk buffer bounds, and clear load errors.
- Timing-table parity against TypeScript:
  - rendering phase;
  - pixel address;
  - attribute address;
  - pixel buffer index;
  - contention value.
- Contention parity for normal and special memory modes.
- Floating-bus direct helper tests plus CPU-level repeated `ED 78` loops with
  ports in the +2/+3 floating-bus set.
- Memory paging parity for `0x7ffd`, `0x1ffd`, special modes 0-3, ROM selection,
  RAM bank selection, shadow screen, and paging lock.
- Adapter sync tests for keyboard, audio rate, tape controls, disk media, and
  disk write-protect changes.
- FDC parity tests against `FloppyControllerDevice` for representative command
  sequences and result bytes.
- Supplemental FDC edge-case tests inspired by MAME uPD765 behavior, limited to
  cases that Klive intentionally supports.
- Disk change publication tests for dirty-sector revision behavior.
- Debug tests for one-instruction stepping, register freshness, and last bus
  events.

## Validation Commands

Run focused checks as milestones become runnable:

```sh
npm test -- --project jsdom test/zxSpectrum/ZxSpectrumP3eMachineFactory.test.ts
npm test -- --project jsdom test/zxSpectrum/spp3e-wasm-v2-loader.test.ts
npm test -- --project jsdom test/zxSpectrum/spp3e-wasm-build.test.ts
npm test -- --project jsdom test/zxSpectrum/ZxSpectrumP3eWasmV2Machine.test.ts
npm test -- --project jsdom test/zxSpectrum/ula-contention.test.ts
npm run build:spp3e-wasm
npm run check:spp3e-wasm-size
npm run build:check
git diff --check
```

When shared C code changes, also run the existing Spectrum WASM checks:

```sh
npm test -- --project jsdom test/zxSpectrum/sp48-wasm-v2-loader.test.ts test/zxSpectrum/sp128-wasm-v2-loader.test.ts
npm test -- --project jsdom test/zxSpectrum/ZxSpectrum48WasmV2Machine.test.ts test/zxSpectrum/ZxSpectrum128WasmV2Machine.test.ts
npm run build:sp48-wasm
npm run build:sp128-wasm
npm run check:sp48-wasm-size
npm run check:sp128-wasm-size
```

For Z80 core changes, run:

```sh
npm test -- --project jsdom test/z80
```

For PSG changes, run relevant audio coverage in addition to +3E tests.

## Risks and Watch Points

- Disk/FDC behavior is the largest new surface compared with 128K. Keep parser
  ownership in TypeScript first and port the deterministic controller path
  behind a bounded upload/change-journal ABI.
- Special paging changes contention, ROM selection, screen source, debugger
  partitions, and code injection. Validate it as a first-class feature, not as a
  small extension to `0x7ffd`.
- The +3E floating bus uses the 128K-style `-3` tact offset but a different port
  eligibility rule. CPU-level port-read tests are required.
- Screen dimension exports must return timing-derived visible dimensions, not
  backing-buffer capacity.
- Normal-frame performance depends on avoiding full disk, memory, pixel, audio,
  register, and diagnostic copies every frame.
- Keep all model labels product-oriented. Backend choice belongs in config, not
  in the model registry.
