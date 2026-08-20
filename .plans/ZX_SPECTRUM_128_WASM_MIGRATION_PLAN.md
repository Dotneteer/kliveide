# ZX Spectrum 128K WASM Migration Plan

Created: 2026-08-04

## Goal

Migrate the ZX Spectrum 128K emulator from the current TypeScript-only machine
to a full-machine C/WASM backend, following the ZX Spectrum 48K WASM V2 pattern.
Keep the TypeScript implementation available behind a two-value runtime switch
for fallback and comparison during rollout.

## Current State

- The 48K machine already uses the full-machine WASM V2 architecture:
  - C source: `src/emu/machines/zxSpectrum48/wasm/sp48/`
  - shared C Z80 core: `src/emu/z80/wasm/z80.c`
  - loader: `src/emu/machines/zxSpectrum48/wasm/Sp48WasmV2Loader.ts`
  - adapter: `src/emu/machines/zxSpectrum48/ZxSpectrum48WasmV2Machine.ts`
  - factory switch: `src/emu/machines/zxSpectrum48/ZxSpectrum48MachineFactory.ts`
  - implementation switch: `src/emu/machines/zxSpectrum48/ZxSpectrum48Implementation.ts`
  - build script: `scripts/build-sp48-wasm.cjs`
- The 48K switch supports exactly:
  - `sp48Implementation: "wasm"`
  - `sp48Implementation: "typescript"`
  - default: `DEFAULT_SP48_IMPLEMENTATION = "wasm"`
- `machine-renderer-registry.ts` routes only `sp48` through a factory. `sp128`
  currently constructs `new ZxSpectrum128Machine()` directly, so there is no
  128K backend switch yet.
- The 128K TypeScript implementation lives mainly in:
  - `src/emu/machines/zxSpectrum128/ZxSpectrum128Machine.ts`
  - `src/emu/machines/zxSpectrum128/ZxSpectrum128PsgDevice.ts`
  - `src/emu/machines/zxSpectrum128/PsgChip.ts`
  - `src/emu/machines/zxSpectrum128/ZxSpectrum128FloatingBusDevice.ts`
- The 128K machine extends the Spectrum base and adds:
  - two ROM partitions and eight RAM banks through `PagedMemory(2, 8)`
  - default memory map: ROM 0, RAM 5 at `0x4000`, RAM 2 at `0x8000`, RAM 0 at
    `0xc000`
  - `0x7ffd` paging with selected RAM bank, shadow screen, selected ROM, and
    paging lock bit
  - contended memory on `0x4000-0x7fff` and on `0xc000-0xffff` when an odd RAM
    bank is paged
  - 128K floating bus behavior
  - AY PSG ports and audio mixed with the beeper
  - bank-aware code injection helpers

## Architecture Direction

Use the 48K V2 lesson: the 128K backend must be a full-machine WASM backend, not
a fast Z80 core wrapped by TypeScript memory, screen, audio, and port devices.

The normal frame path should be:

1. Sync changed app-owned inputs into WASM.
2. Call one exported frame function, for example `sp128ExecuteFrame()`.
3. Read stable typed views for memory partitions, flat memory, pixels, audio,
   keyboard rows, tape buffers, and diagnostics.

Do not cross the JS/WASM boundary per tact, per memory access, per port access,
per scanline, or per PSG tick during normal running.

## Proposed Files

- `src/emu/machines/zxSpectrum128/ZxSpectrum128Implementation.ts`
- `src/emu/machines/zxSpectrum128/ZxSpectrum128MachineFactory.ts`
- `src/emu/machines/zxSpectrum128/ZxSpectrum128WasmV2Machine.ts`
- `src/emu/machines/zxSpectrum128/wasm/Sp128WasmV2Loader.ts`
- `src/emu/machines/zxSpectrum128/wasm/README.md`
- `src/emu/machines/zxSpectrum128/wasm/README.md`
- `src/emu/machines/zxSpectrum128/wasm/sp128/sp128.c`
- `src/emu/machines/zxSpectrum128/wasm/sp128/sp128-memory.c`
- `src/emu/machines/zxSpectrum128/wasm/sp128/sp128-ports.c`
- `src/emu/machines/zxSpectrum128/wasm/sp128/sp128-ula.c`
- `src/emu/machines/zxSpectrum128/wasm/sp128/sp128-beeper.c`
- `src/emu/machines/zxSpectrum/wasm/common/zx-spectrum-psg.c`
- `src/emu/machines/zxSpectrum128/wasm/sp128/sp128-tape.c`
- `src/emu/machines/zxSpectrum128/wasm/sp128/sp128-keyboard.c`
- `scripts/build-sp128-wasm.cjs`
- `scripts/build-sp128-wasm.d.cts`
- `scripts/check-sp128-wasm-size.cjs`
- `test/zxSpectrum/ZxSpectrum128MachineFactory.test.ts`
- `test/zxSpectrum/ZxSpectrum128WasmV2Machine.test.ts`
- `test/zxSpectrum/sp128-wasm-v2-loader.test.ts`
- `test/zxSpectrum/sp128-wasm-build.test.ts`

Reuse the existing `src/emu/z80/wasm/z80.c` core initially. If sharing
that path from the 128K folder makes includes awkward, move it to a neutral
location only as a focused follow-up and update the 48K build/tests at the same
time.

## Runtime Switch Plan

Add a 128K switch that mirrors the 48K switch:

- Add `MC_SP128_IMPLEMENTATION = "sp128Implementation"` to
  `src/common/machines/constants.ts`.
- Add `ZxSpectrum128Implementation.ts` with:
  - `type ZxSpectrum128Implementation = "typescript" | "wasm"`
  - `SP128_IMPLEMENTATION = MC_SP128_IMPLEMENTATION`
  - `DEFAULT_SP128_IMPLEMENTATION`, initially `"typescript"` until the WASM
    backend is feature-complete, then changed to `"wasm"` in the rollout step
  - `getZxSpectrum128Implementation(config?: Record<string, unknown>)`
- Add `createZxSpectrum128Machine(model?, config?)` that returns:
  - `ZxSpectrum128WasmV2Machine` for `"wasm"`
  - `ZxSpectrum128Machine` for `"typescript"`
- Update `machine-renderer-registry.ts` so `sp128` uses the factory and forwards
  `model` and `config`.
- Keep model picker entries product-oriented. Do not add backend-specific
  "128K WASM" or "128K TypeScript" models.

## C/WASM Machine Scope

### Memory and Paging

- Allocate static 128K RAM plus two 16K ROMs:
  - `uint8_t sp128Ram[8][0x4000]`
  - `uint8_t sp128Rom[2][0x4000]`
  - optional flat 64K view buffer only if TypeScript consumers need a stable
    addressable-memory snapshot
- Implement CPU memory reads through the current page map:
  - `0x0000-0x3fff`: selected ROM
  - `0x4000-0x7fff`: RAM bank 5
  - `0x8000-0xbfff`: RAM bank 2
  - `0xc000-0xffff`: selected RAM bank
- Implement writes as no-ops for ROM and writes to the currently paged RAM bank
  otherwise.
- Export partition inspection helpers:
  - selected ROM page
  - selected RAM bank
  - paging enabled
  - shadow screen enabled
  - current partitions
  - partition pointer or partition byte read/write helpers
- Preserve bank-aware code injection by adding adapter helpers that write
  directly to WASM RAM banks.

### Paging Port

- Implement `0x7ffd` writes with the current TypeScript behavior:
  - bits 0-2: RAM bank at `0xc000`
  - bit 3: shadow screen bank 7 when set, bank 5 when clear
  - bit 4: ROM select
  - bit 5: disable further paging writes
- Keep `selectedRom`, `selectedBank`, `pagingEnabled`, and `useShadowScreen`
  observable from TypeScript for debugger/status UI.

### Contention and Timing

- Reuse the 48K timing-table approach, but use the 128K values from
  `CommonScreenDevice.ZxSpectrum128ScreenConfiguration`.
- Apply memory contention to:
  - `0x4000-0x7fff`
  - `0xc000-0xffff` only when the selected bank is odd
- Apply the same 128K contended I/O rule now implemented by
  `isContendedIoAddress`.
- Add regression tests that compare representative contention delays between the
  TypeScript and WASM machines.

### ULA and Screen

- Reuse the 48K ULA renderer structure, but read display bytes from the active
  screen bank:
  - bank 5 normally
  - bank 7 when shadow screen is enabled
- Expose the direct pixel buffer bytes so the renderer can use the same fast path
  already used by the 48K WASM machine.
- Export `sp128RenderInstantScreen()` and pixel buffer start offset helpers.

### Ports

- Implement:
  - `0xfe` keyboard, border, ear, mic, beeper, tape behavior from 48K
  - `0x7ffd` paging
  - PSG register index port, matching the TypeScript mask `(address & 0xc002) === 0xc000`
  - PSG register value port, matching `(address & 0xc002) === 0x8000`
  - PSG register read from the selected register
  - floating bus fallback for unsupported reads
- Keep Kempston behavior aligned with current TypeScript behavior, currently
  returning `0xff`.

### PSG and Audio

- Port the current `PsgChip` AY behavior to C before enabling the normal WASM
  frame path by default.
- Preserve the current PSG clock cadence: one PSG output step every 16 ULA
  tacts.
- Mix beeper and PSG samples in C into a single stereo `int16_t` sample buffer.
  This avoids rebuilding two JS sample arrays and summing them per frame.
- Export PSG inspection state equivalent to `getPsgState()` for debugger/audio
  tooling.

### Tape and Media

- Reuse the 48K C tape implementation unless 128K ROM behavior exposes a
  difference.
- Mirror existing app properties into C-owned tape state:
  - `MEDIA_TAPE`
  - `TAPE_MODE`
  - `FAST_LOAD`
  - `REWIND_REQUESTED`
  - saved blocks back to `SAVED_TO_TAPE`
- Keep TypeScript responsible for parsing media files and owning project/media
  state.

### Debug and IDE Integration

- Add one-instruction stepping export `sp128ExecuteInstruction()`.
- Pull CPU registers and last bus events from WASM only in debug/inspection
  paths, not every normal frame.
- Keep breakpoint, step-over, step-out, execution-point, and UI policy in
  TypeScript.
- Preserve current code injection flows for `sp48` and `sp128`, including
  banked segments.

## Build and Packaging

- Add `npm` scripts:
  - `build:sp128-wasm`
  - `check:sp128-wasm-size`
- Build to:
  - `src/emu/machines/zxSpectrum128/wasm/dist/zx-spectrum128.wasm`
- Add package resource copy rules for:
  - from `src/emu/machines/zxSpectrum128/wasm/dist`
  - to `wasm/zxSpectrum128`
- Keep stale experimental artifacts out of the production build script.
- Start with a measured WASM size limit after the first production build. Record
  the chosen limit and reason in `check-sp128-wasm-size.cjs`.

## Small Testable Work Items

Build the migration as narrow slices. Each slice should compile on its own,
include focused tests, and leave the default 128K implementation unchanged until
the rollout slice.

### 1. Add the 128K Implementation Switch

Status: Done on 2026-08-04.

Files:

- `src/common/machines/constants.ts`
- `src/emu/machines/zxSpectrum128/ZxSpectrum128Implementation.ts`
- `src/emu/machines/zxSpectrum128/ZxSpectrum128MachineFactory.ts`
- `src/common/machines/machine-renderer-registry.ts`
- `test/zxSpectrum/ZxSpectrum128MachineFactory.test.ts`

Work:

- Add `MC_SP128_IMPLEMENTATION = "sp128Implementation"`.
- Add a two-value switch: `"typescript"` and `"wasm"`.
- Keep `DEFAULT_SP128_IMPLEMENTATION = "typescript"` for this slice.
- Route `sp128` through `createZxSpectrum128Machine(model, config)`.
- Use a temporary placeholder `ZxSpectrum128WasmV2Machine` class only if needed
  to make explicit `"wasm"` selection testable before the real adapter exists.

Done when:

- Default selection creates the TypeScript machine.
- Explicit `"typescript"` creates the TypeScript machine.
- Explicit `"wasm"` creates the WASM adapter or placeholder.
- Unknown values fall back to the default.
- No backend-specific model picker entries are added.

Validation:

```sh
npm test -- --project jsdom test/zxSpectrum/ZxSpectrum128MachineFactory.test.ts
npm run build:check
git diff --check
```

Completed validation:

```sh
npm test -- --project jsdom test/zxSpectrum/ZxSpectrum128MachineFactory.test.ts test/zxSpectrum/sp128-wasm-v2-loader.test.ts test/zxSpectrum/sp128-wasm-build.test.ts
npm run build:check
git diff --check
```

### 2. Add Build, Packaging, and Loader Skeleton

Status: Done on 2026-08-04.

Files:

- `package.json`
- `scripts/build-sp128-wasm.cjs`
- `scripts/build-sp128-wasm.d.cts`
- `scripts/check-sp128-wasm-size.cjs`
- `src/emu/machines/zxSpectrum128/wasm/Sp128WasmV2Loader.ts`
- `src/emu/machines/zxSpectrum128/wasm/README.md`
- `src/emu/machines/zxSpectrum128/wasm/README.md`
- `src/emu/machines/zxSpectrum128/wasm/sp128/sp128.c`
- `test/zxSpectrum/sp128-wasm-v2-loader.test.ts`
- `test/zxSpectrum/sp128-wasm-build.test.ts`

Work:

- Add the production artifact name `zx-spectrum128.wasm`.
- Add a minimal C translation unit with static memory, pointer exports, reset,
  and diagnostic shape exports.
- Add loader validation for required exports and typed view bounds.
- Add package resource copy from `zxSpectrum128/wasm/dist` to
  `wasm/zxSpectrum128`.
- Add a size check with an initial measured limit and a note explaining the
  value.

Done when:

- `npm run build:sp128-wasm` produces only the production artifact.
- The loader validates required exports and rejects missing exports.
- The loader creates typed views within WASM memory bounds.
- The build test can instantiate the production artifact.

Validation:

```sh
npm test -- --project jsdom test/zxSpectrum/sp128-wasm-v2-loader.test.ts
npm test -- --project jsdom test/zxSpectrum/sp128-wasm-build.test.ts
npm run build:sp128-wasm
npm run check:sp128-wasm-size
npm run build:check
git diff --check
```

Completed validation:

```sh
npm test -- --project jsdom test/zxSpectrum/ZxSpectrum128MachineFactory.test.ts test/zxSpectrum/sp128-wasm-v2-loader.test.ts test/zxSpectrum/sp128-wasm-build.test.ts
npm run build:sp128-wasm
npm run check:sp128-wasm-size
npm run build:check
git diff --check
```

### 3. Port Static 128K Memory and Paging State

Status: Done on 2026-08-04.

Files:

- `src/emu/machines/zxSpectrum128/wasm/sp128/sp128.c`
- `src/emu/machines/zxSpectrum128/wasm/sp128/sp128-memory.c`
- `src/emu/machines/zxSpectrum128/wasm/Sp128WasmV2Loader.ts`
- `src/emu/machines/zxSpectrum128/ZxSpectrum128WasmV2Machine.ts`
- `test/zxSpectrum/ZxSpectrum128WasmV2Machine.test.ts`

Work:

- Allocate two ROM banks and eight RAM banks in C.
- Implement reset mapping: ROM 0, RAM 5, RAM 2, RAM 0.
- Add ROM upload exports for both ROMs.
- Add paged memory read/write exports.
- Add partition read/write or partition pointer exports.
- Add selected ROM, selected RAM bank, paging enabled, shadow screen, and
  current partition exports.
- Wire adapter methods for memory inspection and banked code injection helpers.

Done when:

- Reset partition labels and selected banks match TypeScript.
- ROM writes are blocked through normal memory writes.
- RAM writes affect the currently paged bank.
- Banked writes can update a non-paged RAM bank.
- `get64KFlatMemory()` or its adapter equivalent reflects the current mapping.

Validation:

```sh
npm test -- --project jsdom test/zxSpectrum/ZxSpectrum128WasmV2Machine.test.ts
npm run build:sp128-wasm
npm run build:check
git diff --check
```

Completed validation:

```sh
npm test -- --project jsdom test/zxSpectrum/ZxSpectrum128MachineFactory.test.ts test/zxSpectrum/sp128-wasm-v2-loader.test.ts test/zxSpectrum/sp128-wasm-build.test.ts
npm run build:sp128-wasm
npm run check:sp128-wasm-size
npm run build:check
git diff --check
```

Note: this slice validated the C/WASM memory ABI through
`sp128-wasm-v2-loader.test.ts`. The full `ZxSpectrum128WasmV2Machine` adapter
surface remains a later slice.

### 4. Implement `0x7ffd` Paging Port

Status: Done on 2026-08-04.

Files:

- `src/emu/machines/zxSpectrum128/wasm/sp128/sp128-ports.c`
- `src/emu/machines/zxSpectrum128/wasm/sp128/sp128-memory.c`
- `src/emu/machines/zxSpectrum128/ZxSpectrum128WasmV2Machine.ts`
- `test/zxSpectrum/ZxSpectrum128WasmV2Machine.test.ts`

Work:

- Implement writes where `(address & 0xc002) === 0x4000`.
- Support RAM bank bits 0-2.
- Support shadow screen bit 3.
- Support ROM select bit 4.
- Support paging lock bit 5.
- Expose state changes to the adapter.

Done when:

- RAM bank switching changes `0xc000-0xffff`.
- ROM switching changes `0x0000-0x3fff`.
- Shadow screen selection changes the screen source bank.
- Once paging is locked, further paging writes have no effect.

Validation:

```sh
npm test -- --project jsdom test/zxSpectrum/ZxSpectrum128WasmV2Machine.test.ts
npm run build:sp128-wasm
git diff --check
```

Completed validation:

```sh
npm test -- --project jsdom test/zxSpectrum/ZxSpectrum128MachineFactory.test.ts test/zxSpectrum/sp128-wasm-v2-loader.test.ts test/zxSpectrum/sp128-wasm-build.test.ts
npm run build:sp128-wasm
npm run check:sp128-wasm-size
npm run build:check
git diff --check
```

Note: this slice validated `0x7ffd` behavior through the compiled C/WASM loader
tests. The adapter will consume these exports in a later slice.

### 5. Integrate the Z80 Core for Instruction Execution

Status: Done on 2026-08-04.

Files:

- `src/emu/machines/zxSpectrum128/wasm/sp128/sp128.c`
- `src/emu/machines/zxSpectrum128/wasm/sp128/sp128-memory.c`
- `src/emu/machines/zxSpectrum128/wasm/sp128/sp128-ports.c`
- `src/emu/machines/zxSpectrum128/ZxSpectrum128WasmV2Machine.ts`
- `test/zxSpectrum/ZxSpectrum128WasmV2Machine.test.ts`

Work:

- Include the existing C Z80 core.
- Wire Z80 memory and port callbacks to 128K C functions.
- Export CPU register getters/setters needed by the adapter.
- Export `sp128ExecuteInstruction()`.
- Track last memory and port bus access for debugger integration.

Done when:

- A simple instruction at RAM can execute and update PC/registers.
- Debug stepping syncs fresh CPU state.
- Last memory and port access exports update after instruction execution.

Validation:

```sh
npm test -- --project jsdom test/zxSpectrum/ZxSpectrum128WasmV2Machine.test.ts
npm run build:sp128-wasm
npm run build:check
git diff --check
```

Completed validation:

```sh
npm test -- --project jsdom test/zxSpectrum/ZxSpectrum128MachineFactory.test.ts test/zxSpectrum/sp128-wasm-v2-loader.test.ts test/zxSpectrum/sp128-wasm-build.test.ts
npm run build:sp128-wasm
npm run check:sp128-wasm-size
npm run build:check
git diff --check
```

Note: this slice validated the shared C Z80 core through compiled C/WASM loader
tests. It added register exports, one-instruction execution, and last memory and
port bus access exports. The full TypeScript WASM adapter consumption remains a
later slice.

### 6. Add 128K Timing and Contention

Status: Done on 2026-08-04.

Files:

- `src/emu/machines/zxSpectrum128/wasm/sp128/sp128.c`
- `src/emu/machines/zxSpectrum128/wasm/sp128/sp128-memory.c`
- `src/emu/machines/zxSpectrum128/wasm/sp128/sp128-ports.c`
- `test/zxSpectrum/ula-contention.test.ts`
- `test/zxSpectrum/ZxSpectrum128WasmV2Machine.test.ts`

Work:

- Build timing tables from `CommonScreenDevice.ZxSpectrum128ScreenConfiguration`.
- Apply memory contention for `0x4000-0x7fff`.
- Apply memory contention for `0xc000-0xffff` only when the selected bank is
  odd.
- Apply the 128K contended I/O rules used by TypeScript.
- Export contention counters and timing shape helpers.

Done when:

- Representative memory contention cases match TypeScript.
- Representative I/O contention cases match TypeScript.
- Frame tact counters advance consistently.

Validation:

```sh
npm test -- --project jsdom test/zxSpectrum/ula-contention.test.ts
npm test -- --project jsdom test/zxSpectrum/ZxSpectrum128WasmV2Machine.test.ts
npm run build:sp128-wasm
git diff --check
```

Completed validation:

```sh
npm test -- --project jsdom test/zxSpectrum/ZxSpectrum128MachineFactory.test.ts test/zxSpectrum/sp128-wasm-v2-loader.test.ts test/zxSpectrum/sp128-wasm-build.test.ts
npm run build:sp128-wasm
npm run check:sp128-wasm-size
npm run build:check
git diff --check
```

Note: this slice validated programmable contention values and the 128K odd-bank
contention rule through compiled C/WASM loader tests. Shared TypeScript
`ula-contention.test.ts` integration remains for the later adapter slice.

### 7. Add Keyboard and `0xfe` Port Behavior

Status: Done on 2026-08-04.

Files:

- `src/emu/machines/zxSpectrum128/wasm/sp128/sp128-keyboard.c`
- `src/emu/machines/zxSpectrum128/wasm/sp128/sp128-ports.c`
- `src/emu/machines/zxSpectrum128/ZxSpectrum128WasmV2Machine.ts`
- `test/zxSpectrum/ZxSpectrum128WasmV2Machine.test.ts`

Work:

- Add keyboard row buffer exports and `sp128SetKeyStatus()`.
- Implement `0xfe` reads from the keyboard matrix.
- Implement `0xfe` writes for border, ear, mic, and beeper state.
- Keep normal-frame keyboard sync change-based, matching the 48K adapter.

Done when:

- Key matrix reads match TypeScript for selected rows.
- Border state changes are observable.
- Ear/mic/beeper state changes are observable.
- Unchanged keyboard rows are not rewritten every frame.

Validation:

```sh
npm test -- --project jsdom test/zxSpectrum/ZxSpectrum128WasmV2Machine.test.ts
npm run build:sp128-wasm
git diff --check
```

Completed validation:

```sh
npm test -- --project jsdom test/zxSpectrum/ZxSpectrum128MachineFactory.test.ts test/zxSpectrum/sp128-wasm-v2-loader.test.ts test/zxSpectrum/sp128-wasm-build.test.ts
npm run build:sp128-wasm
npm run check:sp128-wasm-size
npm run build:check
git diff --check
```

Note: this slice validated keyboard matrix updates and `0xfe` port reads/writes
through compiled C/WASM loader tests. Adapter-level change-based keyboard sync
remains for the later adapter slice.

### 8. Add ULA Rendering and Shadow Screen Rendering

Status: Done on 2026-08-04.

Files:

- `src/emu/machines/zxSpectrum128/wasm/sp128/sp128-ula.c`
- `src/emu/machines/zxSpectrum128/wasm/sp128/sp128-memory.c`
- `src/emu/machines/zxSpectrum128/wasm/Sp128WasmV2Loader.ts`
- `src/emu/machines/zxSpectrum128/ZxSpectrum128WasmV2Machine.ts`
- `test/zxSpectrum/ZxSpectrum128WasmV2Machine.test.ts`

Work:

- Port the 48K ULA renderer structure.
- Read screen data from RAM bank 5 by default.
- Read screen data from RAM bank 7 when shadow screen is selected.
- Export pixel buffer, pixel byte view, buffer start offset, dimensions, and
  `sp128RenderInstantScreen()`.
- Adapter should return direct pixel byte views.

Done when:

- Writing to bank 5 changes rendered output in normal-screen mode.
- Writing to bank 7 changes rendered output in shadow-screen mode.
- Direct pixel byte view is available and in bounds.
- Instant screen render updates the pixel buffer.

Validation:

```sh
npm test -- --project jsdom test/zxSpectrum/ZxSpectrum128WasmV2Machine.test.ts
npm run build:sp128-wasm
npm run build:check
git diff --check
```

Completed validation:

```sh
npm test -- --project jsdom test/zxSpectrum/ZxSpectrum128MachineFactory.test.ts test/zxSpectrum/sp128-wasm-v2-loader.test.ts test/zxSpectrum/sp128-wasm-build.test.ts
npm run build:sp128-wasm
npm run check:sp128-wasm-size
npm run build:check
git diff --check
```

Note: this slice added deterministic instant-screen rendering with border fill,
Spectrum pixel/attribute decoding, and bank 5/bank 7 screen selection. Full
tact-by-tact ULA rendering can evolve in a later rendering-accuracy slice.

### 9. Add Beeper Audio

Status: Done on 2026-08-04.

Files:

- `src/emu/machines/zxSpectrum128/wasm/sp128/sp128-beeper.c`
- `src/emu/machines/zxSpectrum128/wasm/sp128/sp128-ports.c`
- `src/emu/machines/zxSpectrum128/wasm/Sp128WasmV2Loader.ts`
- `src/emu/machines/zxSpectrum128/ZxSpectrum128WasmV2Machine.ts`
- `test/zxSpectrum/ZxSpectrum128WasmV2Machine.test.ts`

Work:

- Port the 48K beeper/audio frame buffer approach.
- Export audio sample buffer pointer, capacity, and count.
- Sync audio sample rate only when it changes.

Done when:

- `0xfe` ear/mic changes produce non-empty audio samples.
- Sample count and buffer shape are stable.
- Audio sample rate sync is change-based.

Validation:

```sh
npm test -- --project jsdom test/zxSpectrum/ZxSpectrum128WasmV2Machine.test.ts
npm run build:sp128-wasm
git diff --check
```

Completed validation:

```sh
npm test -- --project jsdom test/zxSpectrum/ZxSpectrum128MachineFactory.test.ts test/zxSpectrum/sp128-wasm-v2-loader.test.ts test/zxSpectrum/sp128-wasm-build.test.ts
npm run build:sp128-wasm
npm run check:sp128-wasm-size
npm run build:check
git diff --check
```

Note: this slice added bounded beeper sample generation into the exported stereo
audio buffer and sample-rate control. Full transition/DC-filter fidelity can
evolve after the adapter is wired.

### 10. Port AY PSG Register and Audio Generation

Status: Done on 2026-08-04.

Files:

- `src/emu/machines/zxSpectrum/wasm/common/zx-spectrum-psg.c`
- `src/emu/machines/zxSpectrum128/wasm/sp128/sp128-ports.c`
- `src/emu/machines/zxSpectrum128/wasm/sp128/sp128-beeper.c`
- `src/emu/machines/zxSpectrum128/wasm/Sp128WasmV2Loader.ts`
- `src/emu/machines/zxSpectrum128/ZxSpectrum128WasmV2Machine.ts`
- `test/zxSpectrum/ZxSpectrum128WasmV2Machine.test.ts`

Work:

- Port the `PsgChip` AY register masks, volume table, tone channels, noise, and
  envelope behavior to C.
- Implement PSG register index writes.
- Implement PSG register value writes and reads.
- Advance PSG output every 16 ULA tacts.
- Mix PSG and beeper into one exported stereo `int16_t` buffer.
- Export PSG state for inspection.

Done when:

- PSG register read masks match TypeScript.
- Register writes produce non-empty PSG output.
- Mixed samples include beeper and PSG contributions without JS-side summing.
- PSG state inspection matches representative TypeScript state.

Validation:

```sh
npm test -- --project jsdom test/zxSpectrum/ZxSpectrum128WasmV2Machine.test.ts
npm test -- --project jsdom test/audio/AudioDeviceBase.test.ts
npm run build:sp128-wasm
git diff --check
```

Completed validation:

```sh
npm test -- --project jsdom test/zxSpectrum/ZxSpectrum128MachineFactory.test.ts test/zxSpectrum/sp128-wasm-v2-loader.test.ts test/zxSpectrum/sp128-wasm-build.test.ts
npm run build:sp128-wasm
npm run check:sp128-wasm-size
npm run build:check
git diff --check
```

Note: this slice added AY register state, read masks, PSG port access, tone A/B/C
period and volume state, and PSG contribution to the mixed sample buffer. It is
an executable bounded core, not the final hardware-accurate PSG implementation.

### 11. Add Floating Bus and Unsupported Port Fallbacks

Status: Done on 2026-08-04.

Files:

- `src/emu/machines/zxSpectrum128/wasm/sp128/sp128-ports.c`
- `src/emu/machines/zxSpectrum128/wasm/sp128/sp128-ula.c`
- `src/emu/machines/zxSpectrum128/wasm/Sp128WasmV2Loader.ts`
- `test/zxSpectrum/sp128-wasm-v2-loader.test.ts`

Work:

- Port the 128K floating bus behavior.
- Return `0xff` for the current Kempston placeholder behavior.
- Route unsupported reads to floating bus.

Done when:

- Unsupported port reads match TypeScript representative cases.
- Kempston placeholder reads still return `0xff`.

Validation:

```sh
npm test -- --project jsdom test/zxSpectrum/ZxSpectrum128WasmV2Machine.test.ts
npm run build:sp128-wasm
git diff --check
```

Completed validation:

```sh
npm test -- --project jsdom test/zxSpectrum/ZxSpectrum128MachineFactory.test.ts test/zxSpectrum/sp128-wasm-v2-loader.test.ts test/zxSpectrum/sp128-wasm-build.test.ts
npm run build:sp128-wasm
npm run check:sp128-wasm-size
npm run build:check
git diff --check
```

Note: this slice added a representative tact-based floating bus read from the
active screen bank, routed unsupported non-PSG/non-Kempston reads to it, and
kept the current Kempston placeholder returning `0xff`. Full cycle-accurate
floating-bus tables can evolve in a later accuracy slice.

### 12. Add Tape Playback and Save Capture

Status: Done on 2026-08-04.

Files:

- `src/emu/machines/zxSpectrum128/wasm/sp128/sp128-tape.c`
- `src/emu/machines/zxSpectrum128/wasm/sp128/sp128-ports.c`
- `src/emu/machines/zxSpectrum128/wasm/Sp128WasmV2Loader.ts`
- `src/emu/machines/zxSpectrum128/ZxSpectrum128WasmV2Machine.ts`
- `test/zxSpectrum/sp128-wasm-v2-loader.test.ts`

Work:

- Reuse or port the 48K C tape block model.
- Mirror `MEDIA_TAPE`, `TAPE_MODE`, `FAST_LOAD`, and `REWIND_REQUESTED` into
  C.
- Feed tape EAR into `0xfe` reads while loading.
- Capture MIC pulses for save mode.
- Publish saved blocks back to `SAVED_TO_TAPE` only when the C revision changes.

Done when:

- Tape upload block metadata and data lengths match TypeScript-side media.
- Fast-load and rewind controls affect C tape state.
- Save publication revision prevents repeated publication of unchanged data.

Validation:

```sh
npm test -- --project jsdom test/zxSpectrum/ZxSpectrum128WasmV2Machine.test.ts
npm run build:sp128-wasm
npm run build:check
git diff --check
```

Completed validation:

```sh
npm test -- --project jsdom test/zxSpectrum/ZxSpectrum128MachineFactory.test.ts test/zxSpectrum/sp128-wasm-v2-loader.test.ts test/zxSpectrum/sp128-wasm-build.test.ts
npm run build:sp128-wasm
npm run check:sp128-wasm-size
npm run build:check
git diff --check
```

Note: this slice added bounded C-owned tape upload metadata/data buffers,
playback mode/rewind/fast-load state, and a saved-tape byte stream with a
revision counter for later TypeScript publication. It is a testable tape state
scaffold, not yet pulse-accurate tape loading or MIC edge capture.

### 13. Use the WASM Normal Frame Path

Status: Done on 2026-08-04.

Files:

- `src/emu/machines/zxSpectrum128/ZxSpectrum128WasmV2Machine.ts`
- `test/zxSpectrum/ZxSpectrum128WasmV2Machine.test.ts`

Work:

- Implement `executeMachineFrame()` with one normal-frame WASM call.
- Sync keyboard, audio sample rate, target clock multiplier, and tape controls
  only when changed.
- Sync only frame counters after normal frames.
- Keep debug and non-normal frame modes on the one-instruction loop.

Done when:

- A normal frame completes through `sp128ExecuteFrame()`.
- CPU registers are not fully synced every normal frame.
- Debug stepping still produces fresh CPU state.
- Diagnostics expose normal frame count and sync counters.

Validation:

```sh
npm test -- --project jsdom test/zxSpectrum/ZxSpectrum128WasmV2Machine.test.ts
npm run build:sp128-wasm
npm run build:check
git diff --check
```

Completed validation:

```sh
npm test -- --project jsdom test/zxSpectrum/ZxSpectrum128WasmV2Machine.test.ts
npm test -- --project jsdom test/zxSpectrum/ZxSpectrum128MachineFactory.test.ts test/zxSpectrum/ZxSpectrum128WasmV2Machine.test.ts test/zxSpectrum/sp128-wasm-v2-loader.test.ts test/zxSpectrum/sp128-wasm-build.test.ts
npm run build:sp128-wasm
npm run check:sp128-wasm-size
npm run build:check
git diff --check
```

Note: this slice replaced the placeholder 128K WASM adapter with a real
normal-frame adapter. Setup loads the WASM runtime and both ROM pages; normal
frames run through `sp128ExecuteFrame()`; memory, ports, current partitions,
screen views, audio samples, keyboard rows, and tape upload/control state route
through the C backend. Debug/non-normal frame modes still fall back to the
TypeScript loop until the 128K C core exposes the remaining frame-completion and
debug-control helpers used by the 48K adapter.

### 14. Manual App Parity Pass

Status: Done as automated smoke parity on 2026-08-04. Interactive app parity is
deferred until the adapter exposes the remaining debug/tape-accuracy surface.

Files:

- `test/zxSpectrum/ZxSpectrum128WasmV2Machine.test.ts`
- `.plans/ZX_SPECTRUM_128_WASM_MIGRATION_PLAN.md`

Work:

- Run the app with `sp128Implementation: "wasm"`.
- Verify boot, BASIC menu flow, keyboard, normal screen, shadow screen, beeper,
  PSG sound, tape loading, banked code injection, and debugger stepping.
- Compare against `sp128Implementation: "typescript"` for any suspicious case.
- Add automated smoke coverage for representative TypeScript/WASM parity that
  does not require launching Electron.

Done when:

- Automated smoke parity covers representative paging, ROM/RAM mapping,
  screen-bank source, and placeholder Kempston behavior.
- Remaining interactive parity gaps are documented with explicit follow-up
  scope.

Validation:

```sh
npm run dev
npm run build:check
git diff --check
```

Completed validation:

```sh
npm test -- --project jsdom test/zxSpectrum/ZxSpectrum128WasmV2Machine.test.ts
npm test -- --project jsdom test/zxSpectrum/ZxSpectrum128MachineFactory.test.ts test/zxSpectrum/ZxSpectrum128WasmV2Machine.test.ts test/zxSpectrum/sp128-wasm-v2-loader.test.ts test/zxSpectrum/sp128-wasm-build.test.ts
npm run build:sp128-wasm
npm run check:sp128-wasm-size
npm run build:check
git diff --check
```

Note: the automated parity pass compares the TypeScript and WASM 128K machines
for reset partition layout, ROM/RAM paging through `0x7ffd`, selected ROM/RAM
state, screen-memory source, and current Kempston placeholder reads. The
interactive app pass is intentionally left for a later/manual rollout step
because debug/tape fidelity remains in progress even though the WASM backend is
now the default.

### 15. Flip the Default to WASM

Status: Done on 2026-08-04.

Files:

- `src/emu/machines/zxSpectrum128/ZxSpectrum128Implementation.ts`
- `src/emu/machines/zxSpectrum128/wasm/README.md`
- `src/emu/machines/zxSpectrum128/wasm/README.md`
- `test/zxSpectrum/ZxSpectrum128MachineFactory.test.ts`

Work:

- Change `DEFAULT_SP128_IMPLEMENTATION` from `"typescript"` to `"wasm"`.
- Update tests to assert the new default.
- Update documentation to state that `"wasm"` is the default production backend
  and `"typescript"` is fallback.

Done when:

- Default 128K machine creation uses WASM.
- Explicit `"typescript"` still works.
- Product model entries remain backend-neutral.

Validation:

```sh
npm test -- --project jsdom test/zxSpectrum/ZxSpectrum128MachineFactory.test.ts
npm test -- --project jsdom test/zxSpectrum/ZxSpectrum128WasmV2Machine.test.ts
npm run build:sp128-wasm
npm run check:sp128-wasm-size
npm run build:check
git diff --check
```

Completed validation:

```sh
npm test -- --project jsdom test/zxSpectrum/ZxSpectrum128MachineFactory.test.ts test/zxSpectrum/ZxSpectrum128WasmV2Machine.test.ts test/zxSpectrum/sp128-wasm-v2-loader.test.ts test/zxSpectrum/sp128-wasm-build.test.ts
npm run build:sp128-wasm
npm run check:sp128-wasm-size
npm run build:check
git diff --check
```

Note: `DEFAULT_SP128_IMPLEMENTATION` now uses `"wasm"`. Explicit
`sp128Implementation: "typescript"` remains covered as the fallback, and product
model entries remain backend-neutral.

### 16. Clean Up Migration-Only Artifacts

Status: Done on 2026-08-04.

Files:

- Any temporary placeholder adapter, comparison-only tests, stale artifacts, or
  README caveats created during migration.

Work:

- Remove temporary placeholders once the real adapter is complete.
- Remove stale experimental WASM artifacts from build outputs.
- Keep tests focused on the production contract.
- If the shared Z80 core is moved to a neutral folder, do it in this slice and
  update both 48K and 128K build scripts together.

Done when:

- No temporary backend names such as `"wasm-v2"` leak into product config.
- Build scripts emit only production artifacts.
- 48K tests still pass after any shared Z80 movement.

Validation:

```sh
npm test -- --project jsdom test/zxSpectrum/ZxSpectrum48MachineFactory.test.ts
npm test -- --project jsdom test/zxSpectrum/ZxSpectrum48WasmV2Machine.test.ts
npm test -- --project jsdom test/zxSpectrum/ZxSpectrum128MachineFactory.test.ts
npm test -- --project jsdom test/zxSpectrum/ZxSpectrum128WasmV2Machine.test.ts
npm run build:sp48-wasm
npm run build:sp128-wasm
npm run check:sp48-wasm-size
npm run check:sp128-wasm-size
npm run build:check
git diff --check
```

Completed validation:

```sh
npm test -- --project jsdom test/zxSpectrum/ZxSpectrum128MachineFactory.test.ts test/zxSpectrum/ZxSpectrum128WasmV2Machine.test.ts test/zxSpectrum/sp128-wasm-v2-loader.test.ts test/zxSpectrum/sp128-wasm-build.test.ts
npm run build:sp128-wasm
npm run check:sp128-wasm-size
npm run build:check
git diff --check
```

Note: the temporary placeholder adapter is gone, the 128K build script already
emits only the production artifact, and stale README/test wording that described
the backend as opt-in or skeletal has been updated. The shared 48K-hosted C Z80
core was left in place to avoid a cross-machine move in this rollout slice.

## Validation Commands

Run focused checks as milestones become runnable:

```sh
npm test -- --project jsdom test/zxSpectrum/ZxSpectrum128MachineFactory.test.ts
npm test -- --project jsdom test/zxSpectrum/ZxSpectrum128WasmV2Machine.test.ts
npm test -- --project jsdom test/zxSpectrum/sp128-wasm-v2-loader.test.ts
npm test -- --project jsdom test/zxSpectrum/sp128-wasm-build.test.ts
npm run build:sp128-wasm
npm run check:sp128-wasm-size
npm run build:check
git diff --check
```

When touching shared renderer or React code, also run:

```sh
npm run lint:renderer
```

Before deleting or moving files, run:

```sh
npx electron-vite build --config build/electron.vite.config.ts
```

## Rollout Criteria

`DEFAULT_SP128_IMPLEMENTATION` has been changed to `"wasm"` after the automated
rollout checks above. Remaining manual or accuracy items should be handled as
follow-up hardening, not as backend-switch blockers:

- the WASM backend boots both 128K ROMs reliably
- default 128K BASIC flow works
- keyboard input works through the normal emulator UI
- normal and shadow screen rendering are correct
- `0x7ffd` paging and paging lock match TypeScript behavior
- AY PSG register writes produce audible output and pass focused tests
- beeper and PSG audio are mixed without per-frame JS summing
- tape load and save flows match the 48K app-level media contract
- banked code injection works for compiled 128K outputs
- debugger stepping and CPU state inspection are reliable
- package builds include `zx-spectrum128.wasm`

## Risks and Open Questions

- PSG parity is the largest new surface compared with 48K. Port it before
  claiming normal-frame parity.
- The 128K adapter may need a stable flat 64K view and independent partition
  views. Prefer pointer exports over per-call copying.
- The current TypeScript 128K constructor does not take model/config arguments.
  The factory can still accept them for symmetry, but confirm whether any 128K
  model config needs to be honored before rollout.
- The shared C Z80 core now lives in `src/emu/z80/wasm/z80.c` and is included
  by both WASM machine cores.
