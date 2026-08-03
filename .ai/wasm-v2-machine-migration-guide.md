# WASM V2 Machine Migration Guide

This note captures the practical lessons from replacing the ZX Spectrum 48K
hybrid WASM backend with a full-machine WASM V2 backend. Use it when migrating
another machine or model to WASM.

## Start Here

Read these files before changing code:

- `AGENTS.md`
- `src/emu/machines/zxSpectrum48/ZxSpectrum48Implementation.ts`
- `src/emu/machines/zxSpectrum48/ZxSpectrum48MachineFactory.ts`
- `src/emu/machines/zxSpectrum48/ZxSpectrum48WasmV2Machine.ts`
- `src/emu/machines/zxSpectrum48/wasm/Sp48WasmV2Loader.ts`
- `scripts/build-sp48-wasm.cjs`
- `.plans/ZX_SPECTRUM_48_WASM_V2_MIGRATION_PLAN.md`

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

## Common Failure Modes

- A "WASM" backend is slow because only the CPU is in WASM.
- TypeScript still renders the screen from memory after C already rendered it.
- The adapter copies full pixel/audio/memory buffers every frame.
- The adapter syncs full CPU registers every frame in normal mode.
- Tape/audio/video event traces are replayed in TypeScript every frame.
- Debug-only logs are imported during normal running.
- Model picker entries expose backend experiments as product models.
- Build scripts keep producing stale experimental artifacts that packaging copies.
- Tests continue to protect removed migration infrastructure instead of the
  current production contract.

When performance disappoints, inspect the normal frame path first. Count JS/WASM
crossings and large copies before changing CPU code.
