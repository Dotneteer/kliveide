# ZX Spectrum 128K WASM Migration Plan

Created: 2026-08-04

## Goal

Migrate the ZX Spectrum 128K emulator from the current TypeScript-only machine
to a full-machine C/WASM backend, following the ZX Spectrum 48K WASM V2 pattern.
Keep the TypeScript implementation available behind a two-value runtime switch
for fallback and comparison during rollout.

## Current State

- The 48K machine already uses the full-machine WASM V2 architecture:
  - C source: `src/emu/machines/zxSpectrum48/wasm/v2/sp48/`
  - shared C Z80 core: `src/emu/machines/zxSpectrum48/wasm/v2/z80/z80.c`
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
- `src/emu/machines/zxSpectrum128/wasm/v2/README.md`
- `src/emu/machines/zxSpectrum128/wasm/v2/sp128/sp128.c`
- `src/emu/machines/zxSpectrum128/wasm/v2/sp128/sp128-memory.c`
- `src/emu/machines/zxSpectrum128/wasm/v2/sp128/sp128-ports.c`
- `src/emu/machines/zxSpectrum128/wasm/v2/sp128/sp128-ula.c`
- `src/emu/machines/zxSpectrum128/wasm/v2/sp128/sp128-beeper.c`
- `src/emu/machines/zxSpectrum128/wasm/v2/sp128/sp128-psg.c`
- `src/emu/machines/zxSpectrum128/wasm/v2/sp128/sp128-tape.c`
- `src/emu/machines/zxSpectrum128/wasm/v2/sp128/sp128-keyboard.c`
- `scripts/build-sp128-wasm.cjs`
- `scripts/build-sp128-wasm.d.cts`
- `scripts/check-sp128-wasm-size.cjs`
- `test/zxSpectrum/ZxSpectrum128MachineFactory.test.ts`
- `test/zxSpectrum/ZxSpectrum128WasmV2Machine.test.ts`
- `test/zxSpectrum/sp128-wasm-v2-loader.test.ts`
- `test/zxSpectrum/sp128-wasm-build.test.ts`

Reuse the existing `zxSpectrum48/wasm/v2/z80/z80.c` core initially. If sharing
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

## Migration Milestones

1. Scaffold switch and factory while keeping default `"typescript"`.
2. Scaffold 128K WASM source tree, loader, build script, size check, and README
   files.
3. Port static memory, ROM upload, paging state, memory read/write, partition
   exports, reset, and hard reset.
4. Port timing, contention, frame counters, interrupt state, and one-instruction
   execution using the existing C Z80 core.
5. Port ULA rendering with bank 5/bank 7 screen selection and direct pixel
   buffer exports.
6. Port `0xfe`, `0x7ffd`, PSG, and floating-bus port behavior.
7. Port beeper, AY PSG generation, audio mixing, and audio sample buffer
   exports.
8. Port tape playback/save capture and property mirroring.
9. Build `ZxSpectrum128WasmV2Machine` as a thin adapter selected by config.
10. Add focused tests and run side-by-side behavior checks against the
    TypeScript machine.
11. Manually run the app with `sp128Implementation: "wasm"` and verify boot,
    keyboard, BASIC menu flow, screen, sound, tape loading, banked code
    injection, and debugger stepping.
12. Flip `DEFAULT_SP128_IMPLEMENTATION` to `"wasm"` only after parity criteria
    pass.
13. Remove any temporary migration-only helpers and update documentation.

## Focused Tests

Add or update tests for:

- factory selection:
  - default uses TypeScript until rollout
  - explicit `"typescript"` uses `ZxSpectrum128Machine`
  - explicit `"wasm"` uses `ZxSpectrum128WasmV2Machine`
  - unknown values fall back to the default
- loader:
  - required export validation
  - typed view bounds
  - module cache behavior
  - production artifact name
- build:
  - production artifact exists
  - required exports are present
  - package resource path is configured
  - size check passes
- memory/paging:
  - reset partition map
  - ROM selection
  - RAM bank selection
  - paging lock
  - shadow screen selection
  - direct bank writes for code injection
- ports:
  - `0xfe` keyboard/border/beeper compatibility
  - `0x7ffd` paging writes
  - PSG register index/value/read
  - floating bus fallback
- timing:
  - representative 128K contention cases
  - frame length and frame counter updates
- screen:
  - normal and shadow screen reads
  - direct pixel byte view
  - instant screen render
- audio:
  - non-empty beeper samples
  - non-empty PSG samples after register writes
  - mixed output buffer shape
- media:
  - tape upload/control mirroring
  - rewind and fast-load flags
  - save publication revision
- debug:
  - one-instruction stepping
  - fresh CPU state after debug steps
  - last memory and port access state

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

Only change `DEFAULT_SP128_IMPLEMENTATION` to `"wasm"` after:

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
- If the shared C Z80 core remains under the 48K folder, document that it is
  intentionally shared. If that feels too confusing during implementation, move
  it once and update both machines together.
