# WASM V2 Machine Migration Guide

This note captures the practical lessons from replacing the ZX Spectrum 48K
hybrid WASM backend with a full-machine WASM V2 backend, then migrating the ZX
Spectrum 128K backend onto the same shared-device C/WASM model. Use it when
migrating another machine or model to WASM.

## Start Here

Read these files before changing code:

- `AGENTS.md`
- `src/emu/machines/zxSpectrum48/ZxSpectrum48Implementation.ts`
- `src/emu/machines/zxSpectrum48/ZxSpectrum48MachineFactory.ts`
- `src/emu/machines/zxSpectrum48/ZxSpectrum48WasmV2Machine.ts`
- `src/emu/machines/zxSpectrum48/wasm/Sp48WasmV2Loader.ts`
- `src/emu/machines/zxSpectrum/wasm/v2/common/`
- `src/emu/machines/zxSpectrum128/ZxSpectrum128WasmV2Machine.ts`
- `src/emu/machines/zxSpectrum128/wasm/Sp128WasmV2Loader.ts`
- `src/emu/machines/zxSpectrum128/wasm/v2/sp128/sp128.c`
- `scripts/build-sp48-wasm.cjs`
- `scripts/build-sp128-wasm.cjs`
- `.plans/ZX_SPECTRUM_48_WASM_V2_MIGRATION_PLAN.md`
- `.plans/ZX_SPECTRUM_128_WASM_MIGRATION_PLAN.md`

The old hybrid SP48 WASM path, old layout ABI, standalone Z80 WASM harness, and
comparison-only model picker entries were intentionally removed. Do not restore
that architecture for new machines.

## Core Principle

A performant emulator WASM backend must be a full-machine backend, not a fast
CPU wrapped by TypeScript devices.

The normal frame path should be:

1. Sync only changed external inputs into WASM.
2. Call one exported frame function, such as `machineExecuteFrame()`.
3. Read typed views for pixels, audio, memory, and diagnostic state.

Avoid designs that cross the JS/WASM boundary per tact, per instruction, per
memory access, per port access, or per rendered scanline during normal running.

## ZX Spectrum Model Composition

When migrating another ZX Spectrum model, follow the same composition model as
the TypeScript machines.

The shared Spectrum devices should be one physical C implementation reused by
all compatible Spectrum models:

- ULA/video timing and rendering
- keyboard matrix and keyboard port reads
- beeper/audio output
- tape playback and save capture
- shared Spectrum port helpers where behavior is genuinely common

The shared C sources currently live under
`src/emu/machines/zxSpectrum/wasm/v2/common/`. Do not copy these files into each
model folder and then edit the copies. Per-model C files should compose these
shared devices with model-specific configuration, just as TypeScript machines
compose shared devices.

Create model-specific C only for behavior that is actually different:

- memory size and paging
- contended memory page rules
- model-specific port decoding
- PSG/AY devices
- model-specific floating bus offset or displayed screen bank behavior
- model-specific ROM defaults and reset wiring

For example, ZX Spectrum 48K and 128K both use the same shared ULA, keyboard,
beeper, and tape implementations. The 128K backend adds bank paging, PSG, 128K
contention rules, and the 128K floating bus behavior.

## Frame Lifecycle Invariants

Use the working `sp48.c` lifecycle as the template for new Spectrum WASM
machines. Do not invent a new frame loop until tests prove it is equivalent.

The C machine should have the same basic shape:

- `beginMachineFrame()` captures the current frame length and clears the
  frame-completed flag.
- `executeFrame()` runs instructions until the next frame boundary is crossed.
- `completeMachineFrame()` renders/finishes the frame and advances the frame
  origin exactly once.
- `executeInstruction()` also detects frame completion when debugging steps cross
  a frame boundary.
- instruction overshoot is preserved across the frame boundary.
- `setTacts()` sets the absolute machine and Z80 tact counters only; it must not
  realign the next frame origin.

Do not clamp the machine tact counter to the exact end of the frame. That loses
instruction overshoot and can shift every current-frame tact calculation after a
boundary.

The TypeScript adapter should sync frame counters from the C backend, including
the active frame length and current-frame tact. Avoid recomputing these values
from static constants in the adapter when the C machine already owns frame
timing.

## Screen Timing And Dimensions

Expose visible screen dimensions from the shared ULA timing configuration, not
from maximum backing-buffer capacity constants.

The ZX Spectrum 128K migration exposed this trap: the backing buffer could hold
296 lines, but the rendered 128K timing configuration exposed 287 visible lines
(`borderTopLines + displayLines + borderBottomLines - 1`). Returning the backing
capacity produced dark, unpainted bottom lines in the rendered screen and was a
signal that the adapter was not using the same timing contract as TypeScript.

For Spectrum models, screen width/height exports should initialize timing tables
on demand and then return the timing-derived visible dimensions used by the ULA.

## Floating Bus And Contention

Treat floating bus as model-specific even when most ULA code is shared.

Known Spectrum differences from the 48K and 128K migrations:

- ZX Spectrum 48K samples the floating bus using `currentFrameTact - 5`.
- ZX Spectrum 128K samples the floating bus using `currentFrameTact - 3`.
- 128K floating bus reads screen bytes from the currently displayed screen bank,
  normally bank 5 or bank 7 depending on paging state.
- 128K contended I/O includes the `0x4000-0x7fff` page and the
  `0xc000-0xffff` page only when the currently paged RAM bank is odd.
- Port `0x00ff` has its low address bit set, so it is not itself a contended
  low-bit-clear ULA port.

If a floating bus utility fails on a new model while the 48K WASM backend passes
the same utility, suspect model glue first:

- current-frame tact calculation
- frame lifecycle and instruction overshoot
- visible screen timing values
- displayed screen bank selection
- model-specific floating bus sample offset
- model-specific memory and I/O contention rules

Do not start by rewriting the Z80 core when another WASM machine using that core
passes the same CPU-level utility.

### ZX Spectrum +2E/+3E Floating Bus Parity Lessons

The +3E parity work exposed an important distinction: matching the
`readFloatingBus()` formula is not enough. The producer of the bus byte must
also be in parity.

For the TypeScript +3E machine, the ULA byte is produced this way:

- `CommonScreenDevice` advances ULA rendering tact-by-tact;
- ULA fetch phases call `machine.readScreenMemory(pixelAddress)` or
  `machine.readScreenMemory(attributeAddress)`;
- `ZxSpectrumP3eMachine.readScreenMemory` reads from the currently displayed
  screen bank and writes that byte into `lastUlaReadValue`;
- during CPU execution, TypeScript advances rendering from tact increments, so
  the remembered ULA byte is current when a floating-bus port is sampled.

For WASM +3E, keep these invariants:

- `spp3eReadScreenMemoryOffset` must update `spp3eLastUlaReadValue`;
- `spp3eReadFloatingBus` must advance ULA rendering to the current tact before
  sampling `spp3eLastUlaReadValue`;
- the adapter must import `spp3eLastContendedValue` and
  `spp3eLastUlaReadValue` into the inherited TypeScript-visible fields after
  public memory/port/screen operations;
- tests should verify both raw WASM behavior and the TypeScript-facing adapter
  state, because the IDE and debugger often read through public machine APIs.

The +2/+3 eligible floating-bus port shape is `4 * n + 1` while paging is
enabled. Do not blindly reuse 128K floatspy ports such as `0x00ff` for +3E
parity; `0x00ff & 3 == 3`, so it is not a +2/+3 floating-bus port under the
current TypeScript oracle.

## Oracle Tests For Spectrum Migrations

Use the TypeScript machine as the oracle while migrating the WASM backend. Static
table parity is necessary, but it is not enough.

Add timing-table comparisons for a representative frame:

- TypeScript `screenDevice.renderingTactTable[tact].phase`
- TypeScript `pixelAddress`
- TypeScript `attributeAddress`
- TypeScript `pixelBufferIndex`
- matching WASM exports such as `machineGetRenderingPhase(tact)`,
  `machineGetRenderingPixelAddress(tact)`,
  `machineGetRenderingAttributeAddress(tact)`, and
  `machineGetRenderingPixelIndex(tact)`

Add contention comparisons:

- TypeScript `machine.getContentionValue(tact)`
- matching WASM `machineGetContentionValue(tact)`
- separate checks for memory contention and I/O contention when the model has
  model-specific paging rules

Add a floatspy-style floating bus test:

- seed the displayed screen memory with byte pattern `offset & 0xff`
- compare TypeScript `floatingBusDevice.readFloatingBus()` with the WASM
  floating bus export across active display tacts
- test exact port `0x00ff`; RAMSOFT floatspy displays this port and catches real
  regressions
- run a CPU-level repeated `ED 78` (`IN A,(C)`) loop with `BC = 0x00ff`, not
  only direct helper calls

The CPU-level repeated `IN A,(C)` loop was the missing test that reproduced the
128K floatspy failure most faithfully. It catches mistakes in the interaction
between frame timing, port handling, contention, Z80 tact advancement, and the
floating bus.

For +3E parity, use the same principle with a +2/+3-eligible port such as
`0x1235`. Include tests that:

- compare the timing tables and rendering addresses first;
- seed displayed screen banks 5 and 7 with different bytes;
- verify `readScreenMemory` updates the TypeScript-facing `lastUlaReadValue`;
- deliberately seed a stale WASM ULA byte, advance the TypeScript oracle ULA to
  the sampled tact, and then verify the WASM floating-bus read refreshes before
  returning;
- run a repeated `ED 78` (`IN A,(C)`) CPU loop with `BC` set to the eligible
  +2/+3 port, comparing port address, port value, tacts, and stored result
  after each instruction;
- use public adapter APIs such as `doReadMemory`, `doWriteMemory`,
  `doReadPort`, `readScreenMemory`, `get64KFlatMemory`, and
  `getCurrentPartitions` when validating IDE-facing parity.

Be careful with synthetic direct WASM helper tests. Raw helper exports are
useful for isolating C behavior, but they can bypass adapter synchronization.
If a bug is visible in the IDE or debugger, add at least one assertion through
the public machine API that the IDE uses.

When comparing a TypeScript oracle value that depends on the remembered ULA
byte, advance the TypeScript screen renderer to the sampled tact before
asserting. Setting `currentFrameTact` alone does not perform the ULA fetch.

## What Belongs In WASM

Move hot, deterministic machine state into C/WASM:

- CPU core and CPU registers
- 64K or model-specific memory map
- memory paging and memory contention
- port reads/writes and latched port state
- keyboard matrix rows consumed by port reads
- ULA/video timing and pixel buffer
- border state and display timing tables
- beeper/audio sample generation
- tape playback state and save capture
- frame counters, tact counters, interrupt state
- last memory/port access for simple debugger integration

Keep unbounded or app-owned concerns in TypeScript:

- file system and media file parsing
- project/media store ownership
- UI/debugger policy
- Redux/messaging/controller state
- model picker labels and app settings
- optional high-level diagnostics and test helpers

## WASM Memory Shape

Prefer static allocation in C:

- no `malloc`, `calloc`, `realloc`, or `free`
- bounded arrays for memory, pixels, audio, keyboard, tape, and diagnostics
- explicit overflow diagnostics for bounded buffers
- pointer exports for high-volume buffers

The TypeScript loader should validate:

- the `memory` export
- every required function export
- every typed view range against `memory.buffer`
- artifact name and load errors with clear messages

For high-volume data, expose typed views once:

- `Uint8Array` for memory and keyboard rows
- `Uint8ClampedArray` or `Uint32Array` for pixel buffers
- `Int16Array` for stereo audio samples
- `Uint8Array` for tape upload/save buffers

Do not copy large buffers every frame unless the consumer requires a copy.

## Build Pattern

Each production machine backend should have one production artifact name that
packaging copies:

- build script emits `dist/<machine>.wasm`
- loader default artifact name matches that production artifact
- package resources copy the WASM dist folder
- stale experimental artifacts should be removed by the build script

Keep test-only and migration-only artifacts out of the production build script
unless they are still actively used. Old benchmark and ABI-compatibility
infrastructure becomes drag once the V2 backend is the only WASM backend.

## Implementation Switch Pattern

Use a two-value switch per machine family:

- `"wasm"` means the current WASM V2 backend
- `"typescript"` means the TypeScript backend

Avoid exposing versioned implementation strings such as `"wasm-v2"` in product
model configs after rollout. Version details can remain in class names or
diagnostics, for example `{ backend: "wasm", engine: "v2" }`.

Keep model picker entries product/model oriented, not backend oriented. For the
ZX Spectrum 48K, the menu intentionally shows only:

- ZX Spectrum 48K
- ZX Spectrum 48K (NTSC)
- ZX Spectrum 16K

The implementation choice is controlled by the switch in the implementation
file, not by extra comparison models.

## Adapter Pattern

The TypeScript WASM adapter should be thin.

Normal frame:

- emulate queued keystrokes if the base machine owns that UX behavior
- sync keyboard rows only when changed
- sync audio sample rate only when changed
- sync target clock multiplier only when changed
- call the C frame function
- sync frame counters only
- publish saved media only when a C revision counter changes

Avoid per-frame full CPU register export in normal running. Pull registers only
for setup, reset, pause/debug, and explicit `getCpuState()`.

Debug frame:

- use one C instruction export, such as `machineExecuteInstruction()`
- after each instruction, sync CPU state and last bus access
- let TypeScript keep breakpoint, step-over, step-out, and execution-point
  policy
- accept that debug stepping can be slower than normal running

## Renderer Pattern

Expose a direct pixel byte view when possible:

- machine API can offer `getPixelBufferBytes()`
- renderer can use the direct byte view when scanline effects are off
- keep the old pixel path for TypeScript machines or optional effects

Do not route a full WASM-rendered screen through an old TypeScript screen device
render path. That silently erases much of the V2 performance benefit.

## Media Pattern

Tape/media loading should preserve app-level properties while moving hot media
state into WASM.

For ZX Spectrum 48K, the V2 adapter mirrors:

- `MEDIA_TAPE` into the WASM tape data buffer and block metadata
- `TAPE_MODE` into the C tape mode
- `FAST_LOAD` into the C fast-load flag
- `REWIND_REQUESTED` into the C rewind function
- saved C tape blocks back into `SAVED_TO_TAPE`

For other machines, keep the same pattern: app properties stay stable, but the
normal emulation path reads media state from C-owned buffers.

### Disk/FDC Persistence Lessons

For disk-backed machines, distinguish three separate copies of media state:

- the app-owned media entry in the renderer `mediaStore`;
- the machine property such as `MEDIA_DISK_A` or `MEDIA_DISK_B`;
- the C/WASM disk buffer used by the hot FDC path.

All three must remain coherent. If a saved file appears only after restarting
Klive, the backing `.dsk` file was written successfully but the renderer's
attached in-memory disk image is stale. A machine restart can then re-upload the
old `mediaStore` contents into WASM and hide the saved file until the whole app
reloads the disk from the file system.

Use the existing TypeScript disk persistence contract as the shared ABI:

- disk writes publish `DISK_A_CHANGES` or `DISK_B_CHANGES`;
- the payload is a `SectorChanges` map;
- map keys use `trackIndex * 100 + sectorId`, where `trackIndex` indexes the
  parsed DSK track list and `sectorId` is the sector's logical `R` value;
- values are complete sector byte arrays;
- the main process applies those sectors to the backing DSK file using
  `readDiskData()` and each sector's `sectorDataPosition`.

The WASM adapter should convert C-owned dirty disk state into that same
`SectorChanges` shape. Keep DSK/EDSK parsing in TypeScript unless there is a
measured reason to move it: parse the attached disk in the adapter, upload a
bounded normalized sector buffer and geometry into WASM, then use that stored
geometry to translate dirty byte ranges back into sector changes.

Do not rely only on frame completion to publish disk writes. Stopping, pausing,
or restarting a machine can happen before another full frame completes, and
reset paths can clear drive/WASM state. Provide an explicit `flushDiskChanges()`
hook and have the machine controller call it at lifecycle boundaries before
reset/restart. WASM machines should expose a machine-level flush hook; TypeScript
device-based machines can expose the same hook from the floppy controller.

When the renderer receives disk sector changes, patch the attached in-memory DSK
bytes synchronously before awaiting the async main-process file write. This keeps
the next in-app machine restart coherent with the running machine even if the
file save response has not returned yet. Do not reinsert/re-upload the disk while
the machine is running just to update this copy; mutate the attached byte buffer
in place.

The C dirty journal must not be a single overwritten `{ offset, length }` slot.
+3DOS can write several sectors before the adapter drains the journal. Use a
bounded append-only list of dirty ranges, drain it in the adapter on frame
completion and lifecycle flush, then clear the journal after the ranges have
been converted to `SectorChanges`.

## Migration Order

Use small, manually checkable steps:

1. Vendor or create the V2 C source tree in an isolated folder.
2. Build a production WASM artifact from the V2 translation unit.
3. Add a loader with required export validation and typed views.
4. Add a parallel machine adapter selected by config.
5. Move the normal frame path fully into C.
6. Wire memory, keyboard, audio, video, and media buffers directly.
7. Add debug/inspection getters and one-instruction stepping.
8. Make `"wasm"` point to the V2 backend.
9. Remove old hybrid/helper infrastructure and backend-specific model entries.

Do not wait until the end to run the app manually. After each runnable step, use
`npm run dev` and check visible behavior.

## Tests To Add Or Keep

For a new machine, prioritize these focused tests:

- factory selection: default `"wasm"`, explicit `"wasm"`, explicit
  `"typescript"`, unknown value defaulting
- model registry: only product/model entries appear
- loader: required exports, typed view ranges, module cache, artifact name
- machine adapter: setup, reset, one normal frame, memory read/write
- keyboard/input sync: changed rows update, unchanged rows do not rewrite
- renderer: direct pixel byte path when available
- audio: sample buffer count and basic non-empty frame samples
- media: upload/control mirroring and save/download publication
- debug: one-instruction step and `getCpuState()` freshness
- build: production artifact exports and package resource path
- size check: update the byte limit only with a recorded reason

Run at least:

```sh
npm test -- --project jsdom <focused tests>
npm run build:check
npm run build:<machine>-wasm
npm run check:<machine>-wasm-size
git diff --check
```

For ZX Spectrum 48K specifically, the current commands are:

```sh
npm test -- --project jsdom test/zxSpectrum/ZxSpectrum48MachineFactory.test.ts
npm test -- --project jsdom test/zxSpectrum/ZxSpectrum48WasmV2Machine.test.ts
npm test -- --project jsdom test/zxSpectrum/sp48-wasm-v2-loader.test.ts
npm test -- --project jsdom test/zxSpectrum/sp48-wasm-build.test.ts
npm run build:check
npm run build:sp48-wasm
npm run check:sp48-wasm-size
```

## PSG/AY Audio Lessons

Do not use the old TypeScript PSG implementation as the reference for new PSG
work. It was useful as a compatibility surface, but both the TypeScript and the
initial WASM PSG paths had audible flaws. Use MAME's AY/YM implementation as the
algorithmic reference for tone, noise, envelope, and mixer behavior.

Keep the PSG chip core separate from the machine file:

- TypeScript: `src/emu/machines/zxSpectrum128/PsgChip.ts`
- WASM C: model-specific PSG code such as
  `src/emu/machines/zxSpectrum128/wasm/v2/sp128/sp128-psg.c`
- the machine/device file should handle port routing, clock cadence, sample-rate
  integration, and final beeper+PSG mixing

Important details that prevented regressions:

- ZX Spectrum 128K uses an AY-compatible chip clocked once per 16 ULA tacts.
- Register 7 should reset to `0xff`, so tone and noise channels start disabled.
- AY register reads use the AY read masks; YM reads keep the full byte behavior.
- Noise uses MAME's 17-bit LFSR with bit 0 XOR bit 3 feedback into bit 16 and a
  divide-by-two prescaler.
- Tone period `0`, noise period `0`, and envelope period `0` must still advance
  at the fastest useful rate instead of freezing.
- Envelope generation needs the MAME internal down-counter/step state, but the
  existing Klive public `posEnv` field is a forward diagnostic counter. Preserve
  both concepts when replacing the implementation.
- Save-state snapshots must clone the PSG register array. Returning the live
  `Uint8Array` lets later reset/write operations mutate the saved state.
- Keep rendered audio output separate from legacy diagnostic output. The UI and
  TurboSound tests may expect unsigned table values such as `0..65535`, while
  the 128K audio path should consume the signed/centered mixer output derived
  from the MAME resistor tables.
- For YM compatibility, fixed public volume levels historically map through the
  32-entry diagnostic table as `0` for volume `0`, otherwise `volume * 2 + 1`.
  Do not break this when replacing the audio algorithm.
- Mix the beeper and PSG with headroom. In the WASM path, add the PSG
  contribution after the beeper's DC/high-pass handling and clamp only at the
  final `int16_t` sample.

Useful regression tests:

- noise-only PSG output must produce non-silent samples
- all three PSG channels must contribute to the mixed sample
- beeper and PSG together must not clip under normal test levels
- high-nibble PSG register-select writes must still select the low 4-bit
  register number
- PSG state save/restore must preserve register values independently of later
  chip reset
- run the whole `test/audio` folder after a PSG rewrite, because ZX Spectrum 128K
  and ZX Next TurboSound share the same `PsgChip`

## Common Failure Modes

- A "WASM" backend is slow because only the CPU is in WASM.
- New Spectrum models duplicate common C devices instead of composing the shared
  ULA, keyboard, beeper, and tape implementations.
- TypeScript still renders the screen from memory after C already rendered it.
- The adapter copies full pixel/audio/memory buffers every frame.
- The adapter syncs full CPU registers every frame in normal mode.
- Tape/audio/video event traces are replayed in TypeScript every frame.
- Disk writes reach the backing DSK file, but the renderer `mediaStore` still
  holds stale disk bytes, so an in-app machine restart reloads old contents.
- Dirty disk ranges are published only on frame completion, so stop/restart can
  reset drive state before pending sectors are saved.
- A WASM FDC records only the last dirty sector/range, losing earlier writes
  before the TypeScript adapter drains them.
- Debug-only logs are imported during normal running.
- Model picker entries expose backend experiments as product models.
- Build scripts keep producing stale experimental artifacts that packaging copies.
- Tests continue to protect removed migration infrastructure instead of the
  current production contract.
- `setTacts()` realigns the frame origin instead of only setting absolute tacts.
- The frame loop snaps tacts to the exact frame end and loses instruction
  overshoot.
- Screen dimension exports return backing-buffer capacity instead of visible ULA
  dimensions.
- A new model reuses the 48K floating bus sample offset even though its
  TypeScript floating bus device uses a different offset.
- Timing-table tests pass, but no CPU-level repeated `IN A,(C)` test validates
  the real floating bus path used by diagnostic software.

When performance disappoints, inspect the normal frame path first. Count JS/WASM
crossings and large copies before changing CPU code.
