# ZX Spectrum Classic TypeScript Removal Plan

Created: 2026-08-23

## Goal

Remove the TypeScript emulator implementations for the classic ZX Spectrum
machines now covered by mature full-machine WASM backends:

- ZX Spectrum 48K / 16K / NTSC family (`sp48`)
- ZX Spectrum 128K (`sp128`)
- ZX Spectrum +2E/+3E (`spp3e`)

Keep the ZX Spectrum Next TypeScript implementation and its
`zxnextImplementation: "typescript"` model, because Next WASM parity is not
fully tested yet.

Before deleting the classic TypeScript implementations, create and push a tag so
the old implementation can be checked later.

Suggested tag:

```sh
git tag -a pre-classic-spectrum-ts-removal-2026-08-23 -m "Before removing classic ZX Spectrum TypeScript backends"
git push origin pre-classic-spectrum-ts-removal-2026-08-23
```

## Current State

- Classic Spectrum factories still expose `"typescript" | "wasm"` switches:
  - `src/emu/machines/zxSpectrum48/ZxSpectrum48Implementation.ts`
  - `src/emu/machines/zxSpectrum128/ZxSpectrum128Implementation.ts`
  - `src/emu/machines/zxSpectrumP3e/ZxSpectrumP3eImplementation.ts`
- Classic WASM adapters currently subclass the TypeScript machine classes:
  - `ZxSpectrum48WasmV2Machine extends ZxSpectrum48Machine`
  - `ZxSpectrum128WasmV2Machine extends ZxSpectrum128Machine`
  - `ZxSpectrumP3eWasmV2Machine extends ZxSpectrumP3EMachine`
- This means removal must first split reusable host/API shell behavior from
  TypeScript-owned emulation behavior.
- ZX Spectrum Next still imports the TypeScript PSG chip through
  `src/emu/machines/zxNext/TurboSoundDevice.ts`, so `PsgChip` cannot simply be
  deleted with the 128K folder. Move or preserve it as shared Next-compatible
  code.

## Keep Boundaries

Keep:

- ZX Spectrum Next TypeScript files under `src/emu/machines/zxNext/`
- `MC_ZXNEXT_IMPLEMENTATION`, `ZxNextImplementation.ts`,
  `ZxNextMachineFactory.ts`, and the Next compatibility model
- Next tests under `test/zxnext` and `test/wasm/zxNext`
- shared abstractions and UI-facing state types, including `PsgChipState`
- classic WASM C sources, loaders, build scripts, size checks, and production
  adapter tests

Remove or collapse only after replacement:

- classic `"typescript"` implementation switches and fallback factory branches
- classic TypeScript machine behavior classes and floating-bus/device classes
- parity/oracle tests comparing classic TypeScript to WASM
- TypeScript-only classic unit tests whose useful assertions have WASM coverage

## Test Inventory

### Parity Tests To Remove After Tag

These compare classic TypeScript machines to WASM and should be deleted or
converted to WASM-only assertions once the oracle is gone:

- `test/wasm/zxSpectrum/wasm-screen-floating-bus.test.ts`
- `test/wasm/zxSpectrum/wasm-contention.test.ts`
- `test/wasm/zxSpectrum/wasm-oracle-programs.test.ts`
- `test/wasm/zxSpectrum/wasm-machine-lifecycle.test.ts`
- `test/wasm/zxSpectrum/wasm-tape.test.ts`
- `test/wasm/zxSpectrum/wasm-psg-audio.test.ts`
- `test/wasm/zxSpectrum/wasm-partition-labels.test.ts`
- oracle helper classes in `test/wasm/zxSpectrum/wasm-test-helpers.ts`

Also remove the TypeScript-parity cases embedded in otherwise useful loader or
adapter files:

- `test/zxSpectrum/sp128-wasm-v2-loader.test.ts`
  - timing/contention table parity
  - floating-bus parity and repeated `IN A,(C)` parity
- `test/zxSpectrum/spp3e-wasm-v2-loader.test.ts`
  - timing/contention table parity
  - TypeScript FDC Sense Drive parity
- `test/zxSpectrum/ZxSpectrum128WasmV2Machine.test.ts`
  - representative paging/port parity
  - RAMSOFT floatspy boundary parity
- `test/zxSpectrum/ZxSpectrumP3eWasmV2Machine.test.ts`
  - update text and behavior for the debug path currently described as
    TypeScript-backed

### TypeScript Tests With Existing WASM Counterparts

These can be removed or slimmed once the WASM tests are kept:

- Classic partition parsing in `test/memory/partition-parsing.test.ts`
  - WASM counterpart: `test/wasm/zxSpectrum/wasm-partition-labels.test.ts`
  - keep the ZX Spectrum Next cases in a Next-specific test.
- Factory fallback tests in:
  - `test/zxSpectrum/ZxSpectrum48MachineFactory.test.ts`
  - `test/zxSpectrum/ZxSpectrum128MachineFactory.test.ts`
  - `test/zxSpectrum/ZxSpectrumP3eMachineFactory.test.ts`
  - update them to assert only the WASM default and product-oriented registry.

### TypeScript Tests Without Full WASM Counterparts Yet

Port these assertions before deleting the TypeScript tests:

- `test/zxSpectrum/ula-contention.test.ts`
  - TypeScript-only coverage for 48K HALT contention, M1 refresh contention,
    and contention counter accounting.
  - Add WASM-only coverage to `test/wasm/zxSpectrum/wasm-contention.test.ts`
    or a new classic WASM CPU-contention suite before removing this file.
- `test/audio/Psg*.test.ts`, `test/audio/Psg*.step*.test.ts`,
  `test/audio/AudioIntegration.test.ts`, and tests importing
  `src/emu/machines/zxSpectrum128/PsgChip.ts` or
  `ZxSpectrum128PsgDevice.ts`.
  - Production 128K/+3E WASM PSG behavior is covered by
    `test/wasm/zxSpectrum/wasm-psg-audio.test.ts` and loader tests.
  - These old tests include chip-level white-box invariants not covered one for
    one by WASM. Either port the valuable invariants to C/WASM export tests or
    document that they are retained only for the ZX Spectrum Next TypeScript
    `TurboSoundDevice`.
- `test/zxSpectrum/ZxSpectrumP3eMachineFactory.test.ts`
  - `keeps TypeScript disk media attached across machine reset` has no direct
    WASM-only counterpart in that file.
  - The behavior is partly covered by `ZxSpectrumP3eWasmV2Machine.test.ts`
    disk reset/media tests. Confirm lifecycle equivalence, then delete the
    TypeScript-specific assertion.

## Small Executable Steps

### 1. Tag The Current Classic TypeScript State

Status: Done on 2026-08-23.

Work:

- Verify the intended commit is present locally.
- Check for existing tag name collisions.
- Create an annotated tag:
  `pre-classic-spectrum-ts-removal-2026-08-23`.
- Push the tag to the default remote.

Validation:

```sh
git status --short
git tag --list pre-classic-spectrum-ts-removal-2026-08-23
git push origin pre-classic-spectrum-ts-removal-2026-08-23
```

Done when:

- The tag exists locally and on the remote.
- The tag points at the last commit that still has the classic TypeScript
  backends.

### 2. Create A WASM-Only Classic Machine Contract

Status: Done on 2026-08-23.

Work:

- Extract the non-emulation host/API surface currently reused through
  `ZxSpectrum48Machine`, `ZxSpectrum128Machine`, and `ZxSpectrumP3EMachine`
  into neutral classes or helpers.
- Keep app-owned responsibilities in TypeScript:
  - ROM/media loading
  - machine properties
  - debugger policy
  - code injection flow
  - partition label parsing
  - diagnostics state shape
- Move shared metadata if needed:
  - 48K/128K sysvar descriptions
  - partition label helpers
  - shared PSG state types
- Do not touch ZX Spectrum Next TypeScript behavior.

Validation:

```sh
npm test -- --project jsdom test/zxSpectrum/ZxSpectrum48WasmV2Machine.test.ts test/zxSpectrum/ZxSpectrum128WasmV2Machine.test.ts test/zxSpectrum/ZxSpectrumP3eWasmV2Machine.test.ts
npm run build:check
```

Done when:

- WASM adapters no longer need TypeScript emulation behavior for normal or
  debug execution.
- Public IDE APIs still compile against stable methods rather than concrete
  TypeScript machine classes.

### 3. Replace Renderer Concrete Casts With Stable Interfaces

Status: Done on 2026-08-23.

Work:

- Update `src/renderer/appEmu/MainToEmuProcessor.ts` so it does not import or
  cast to classic TypeScript machine classes.
- Replace current casts for selected ROM/RAM, PSG state, and +3E FDC logs with
  methods/properties on stable abstractions or machine-specific capability
  checks.
- Keep Next behavior unchanged.

Validation:

```sh
npm test -- --project jsdom test/zxSpectrum/ZxSpectrum128WasmV2Machine.test.ts test/zxSpectrum/ZxSpectrumP3eWasmV2Machine.test.ts
npm run build:check
```

Done when:

- No renderer production file imports the classic TypeScript machine classes.

### 4. Remove Classic Implementation Switches

Status: Done on 2026-08-23.

Work:

- Remove or collapse:
  - `ZxSpectrum48Implementation.ts`
  - `ZxSpectrum128Implementation.ts`
  - `ZxSpectrumP3eImplementation.ts`
  - `MC_SP48_IMPLEMENTATION`
  - `MC_SP128_IMPLEMENTATION`
  - `MC_SPP3E_IMPLEMENTATION`
- Update factories so classic models always return WASM machines.
- Preserve `MC_ZXNEXT_IMPLEMENTATION` and all Next factory/model behavior.
- Update classic WASM README files to remove fallback wording.

Validation:

```sh
npm test -- --project jsdom test/zxSpectrum/ZxSpectrum48MachineFactory.test.ts test/zxSpectrum/ZxSpectrum128MachineFactory.test.ts test/zxSpectrum/ZxSpectrumP3eMachineFactory.test.ts
npm run build:check
```

Done when:

- No classic product path accepts `"typescript"` as a backend selection.
- Next still accepts `"typescript"` and `"wasm"`.

### 5. Port TypeScript-Only Coverage Gaps

Status: Done on 2026-08-23.

Work:

- Add WASM-only replacements for the uncovered `ula-contention.test.ts`
  behaviors:
  - 48K HALT at contended and non-contended addresses
  - 48K M1 refresh contention via `IR`
  - contention counters count only real delays
- Decide the PSG test boundary:
  - If `PsgChip` remains for Next TypeScript, move it to a neutral shared path
    and keep/retarget its tests as Next/shared audio tests.
  - If any 128K/+3E-only PSG invariants are still valuable, port them to
    classic WASM export tests.
- Keep Next-specific partition parsing and PSG tests out of the classic cleanup.

Validation:

```sh
npm test -- --project jsdom test/wasm/zxSpectrum test/audio test/memory/partition-parsing.test.ts
npm run build:check
```

Done when:

- Every deleted TypeScript-only test is either covered by a WASM test or
  explicitly judged obsolete.

### 6. Convert Or Delete Parity Tests

Status: Done on 2026-08-23.

Work:

- Delete shared classic TypeScript oracle classes from
  `test/wasm/zxSpectrum/wasm-test-helpers.ts`.
- Convert retained shared tests to fixed WASM behavior tests where they still
  add value.
- Delete tests whose only purpose was TypeScript/WASM comparison.
- Keep pure WASM loader, build, adapter, lifecycle, media, audio, disk, and
  public API tests.

Validation:

```sh
npm test -- --project jsdom test/wasm/zxSpectrum test/zxSpectrum
npm run build:check
```

Done when:

- Classic Spectrum tests no longer instantiate classic TypeScript machines as
  oracles.
- WASM-only tests still cover memory, ports, contention, screen, audio, tape,
  disk, lifecycle, and debug stepping.

### 7. Delete Classic TypeScript Implementations

Status: Done on 2026-08-23.

Work:

- Delete classic TypeScript emulation behavior files that are no longer
  imported:
  - `src/emu/machines/zxSpectrum48/ZxSpectrum48Machine.ts`
  - `src/emu/machines/zxSpectrum48/ZxSpectrum48FloatingBusDevice.ts`
  - `src/emu/machines/zxSpectrum128/ZxSpectrum128Machine.ts`
  - `src/emu/machines/zxSpectrum128/ZxSpectrum128FloatingBusDevice.ts`
  - `src/emu/machines/zxSpectrum128/ZxSpectrum128PsgDevice.ts`, only after
    Next/shared PSG needs are moved
  - `src/emu/machines/zxSpectrumP3e/ZxSpectrumP3eMachine.ts`
  - `src/emu/machines/zxSpectrumP3e/ZxSpectrumP3eFloatingBusDevice.ts`
- Keep classic WASM adapters/loaders and C sources.
- Keep or move non-emulation metadata that is still consumed by WASM adapters or
  UI.

Validation:

```sh
rg "ZxSpectrum48Machine|ZxSpectrum128Machine|ZxSpectrumP3EMachine|ZxSpectrum48FloatingBusDevice|ZxSpectrum128FloatingBusDevice|ZxSpectrumP3eFloatingBusDevice" src test
npm test -- --project jsdom test/zxSpectrum test/wasm/zxSpectrum
npm run build:check
```

Done when:

- No production or test import points at deleted classic TypeScript machines.
- Next TypeScript still builds and tests.

### 8. Final Full Verification

Status: Done on 2026-08-23.

Work:

- Run focused classic WASM tests first.
- Run Next tests that protect the retained TypeScript implementation.
- Run global static checks.
- Run renderer lint because the cleanup touches renderer-facing machine APIs.
- Run Vite import analysis after file deletion.

Validation:

```sh
npm test -- --project jsdom test/zxSpectrum test/wasm/zxSpectrum test/zxnext test/wasm/zxNext
npm run build:check
npm run lint:renderer
npx electron-vite build --config build/electron.vite.config.ts
git diff --check
```

Done when:

- Classic machines run only through WASM.
- ZX Spectrum Next still offers its TypeScript compatibility implementation.
- The build has no stale imports, fallback switches, or parity-oracle tests for
  classic Spectrum machines.

## Completion Criteria

- The pre-removal tag is pushed.
- `sp48`, `sp128`, and `spp3e` factories always construct WASM machines.
- Classic TypeScript emulation behavior is gone or moved only where it is
  explicitly shared with Next.
- Classic TypeScript/WASM parity tests are gone.
- Any classic TypeScript-only tests without WASM counterparts have been ported
  or documented as obsolete.
- `zxnextImplementation: "typescript"` and the ZX Spectrum Next compatibility
  model remain intact.
