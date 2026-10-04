# Pentagon 128 (G9.1)

Status: ✅ **done** (2026-10-04; main, unreleased). See §10 for what was built and where it departs
from the plan.
Base plan: [CLOSING_THE_GAPS_PLAN.md](CLOSING_THE_GAPS_PLAN.md), §G9 (G9.1, size M).

> **Standing rule (from the base plan):** when this ships, update §2 (the "Other machines" /
> Spectrum-models rows) and §4 (W9) of
> [LANDING_PAGE_COMPETITIVE_ANALYSIS.md](LANDING_PAGE_COMPETITIVE_ANALYSIS.md) and mark G9.1 done
> in the base plan, in the same change. A visual change (the machine list, the larger border of the
> Pentagon picture) also updates `.ai/ui-theming-intent-and-lessons.md`.

---

## 1. What is being added

The Pentagon 128 is a Russian 128K clone that much of the demoscene and the Russian games scene
targets. To software it is a ZX Spectrum 128K with the same `$7FFD` paging, ROMs and AY. The
differences are all in the **timing**:

| | ZX Spectrum 128K (today) | Pentagon 128 |
|---|---|---|
| CPU clock | 3 546 900 Hz | 3 500 000 Hz |
| Line / frame | 228 T × 311 lines = 70 908 T | 224 T × 320 lines = 71 680 T (≈ 48.8 Hz) |
| Memory and I/O contention | yes (banks 1/3/5/7, ULA ports) | **none** |
| Floating bus | yes | none (unattached ports read `$FF`) |
| Display start after INT | 64 lines | 80 lines |
| INT position and length | frame tact 0, 32 T (in Klive's core) | the last tact of the frame, length to be confirmed (§5, Phase 0) |
| AY clock | 1.7734 MHz | 1.75 MHz (CPU / 2, as today; it follows the tact clock) |

The numbers in the right-hand column are **starting points to confirm, not facts to code from**.
The repository already holds one authoritative description of Pentagon timing: the ZX Spectrum
Next's own Pentagon mode in `_input/next-fpga/` (`zxula_timing.vhd`: 448 × 320 7 MHz clocks,
`vactive` 80, interrupt at (319, 439); `zxnext.vhd` ~1968–2000: a 36-cycle pulse), which the Next
core and `test/zxnext-hw/video/video-timing.test.ts` already follow. Phase 0 records the values
Klive uses, in Klive's words, and where each came from.

After this change the machine list offers:

| Machine | Model id | Display name | Notes |
|---|---|---|---|
| `sp128` | `sp128` | ZX Spectrum 128K | today's machine, unchanged (default) |
| `sp128` | `pentagon` | Pentagon 128 | the new model (P1) |

Everything that works on the 128K works on the Pentagon: run/debug, code injection, the tape
Loader, snapshots, Klive state files, the compilers (sjasmplus, Pasta/80 and Klive BASIC select by
machine id and keep their 128K target).

**Out of scope (Q2, decided):** the Beta 128 disk interface and TR-DOS (`.trd`/`.scl` images, a WD1793 FDC,
the TR-DOS ROM paging trap at `$3Dxx`). Most Pentagon *disk* software needs it, but it is a disk
subsystem of its own, not part of the clone's timing. It is proposed as **G9.1b**, with its own plan,
once this lands. Until then a snapshot with the TR-DOS ROM paged keeps today's warning
(`spectrumSnapshotMapping.ts`: "Klive has no Beta 128 interface").

Also out of scope: Pentagon 512/1024 memory (the `$7FFD` bits 6–7 / bit 5 extensions), Pentagon's
"multicolour" and 16-colour video modes of later boards, turbo modes.

## 2. What the code looks like today (the foundation)

- **Core.** `src/emu/machines/zxSpectrum128/wasm/sp128/sp128.c` (2 242 lines) plus the shared
  Spectrum pieces it `#include`s with macro renaming: `zx-spectrum-ula.c` (timing tables, rendering,
  contention, floating bus), `-psg.c`, `-tape.c`, `-beeper.c`, `-keyboard.c`, `-ports.c`.
  - The ULA geometry is a `Sp128ScreenConfig` constant, `sp128UlaConfig`, passed to
    `initializeTimingTables(config)`. That function already takes the config at run time: the 48K
    core picks `sp48PalConfig` or `sp48NtscConfig` in `sp48HardReset(is16k, isNtsc)`. **This is the
    precedent G9.1 follows.**
  - The contention table is built from `config->contentionValues`, so a config whose eight values
    are all zero yields no memory contention. I/O contention (`sp128DelayPortAccess`) calls the same
    `applyContentionDelay()` and so also becomes zero, but the extra checks on the hot path are
    avoidable (P4).
  - **Compile-time constants that must become run-time values:** `SP128_TACTS_PER_FRAME` (70 908)
    sizes the five per-tact tables and is returned by `sp128GetTactsInFrame()`;
    `SP128_BASE_CLOCK_FREQUENCY` feeds the audio sample length (`sp48BaseClockFrequency` macro) and
    `sp128GetBaseClockFrequency()`; `shouldRaiseInterrupt()` hard-codes `currentFrameTact() < 32u`;
    `sp128ReadNonFePort` returns the floating bus for unattached ports.
  - `isContendedMemoryAddress` encodes the 128K's contended banks (1, 3, 5, 7).
- **Host.** `ZxSpectrum128WasmHost.ts` hard-codes `baseClockFrequency = 3_546_900` and the screen
  device's `CommonScreenDevice.ZxSpectrum128ScreenConfiguration`; `machineId` is the literal `"sp128"`
  and the model info is ignored (`_modelInfo`). `ZxSpectrum128WasmV2Machine.hardResetWasmV2` calls
  `sp128HardReset()` with no arguments and then reads `sp128GetTactsInFrame()`.
- **Registry.** `MI_SPECTRUM_128` has no `models` today; the 48K (`pal`/`ntsc`/`pal-16k` via
  `MC_SCREEN_FREQ`) and the `spp3e` (`P3_MODELS`, `MC_SP3_ROM_SET`) show the two patterns for
  model config. `getModelConfig(machineId, undefined)` returns the machine's own `config`.
- **ROMs.** `sp128-0.rom`/`sp128-1.rom`. The code-injection and tape flows wait for
  `SP128_MAIN_WAITING_LOOP` / `SP128_RETURN_TO_EDITOR` in those ROMs (`ZxSpectrumBase.ts`).
- **Snapshots.** `SnapshotMachineKind` has no Pentagon: `.szx` machine id 7 and `.z80` hardware
  mode 9 parse as "unsupported: Pentagon 128" (`szxFile.ts`, `z80File.ts`). A 128K `.sna` carries no
  machine identity. The mapping (`spectrumSnapshotMapping.ts`) sends `128k`/`plus2` to
  `MI_SPECTRUM_128` with `modelIds: [undefined]`.
- **State files.** A state is the core's whole linear memory, valid only for the same layout
  fingerprint (state-files plan D7). Any change to `sp128.c`'s statics changes the fingerprint, so
  128K states saved before this change load through their embedded `.szx` (D9) with the usual
  warning. That is expected and needs no migration.
- **Harness.** `test/harness/sp128/` (`createSp128Session(model)`) runs the real core with the real
  ROMs and exposes `frameTact()`, `runTo`, `paging()`, `psgRegister`, the screen text, snapshots.
- **IDE lists keyed by `MI_SPECTRUM_128`** (no change expected with P1): `machine-menu-registry.ts`,
  `state-menus.ts`, `zx-specrum-menus.ts`, `tool-registry.tsx`, `machine-renderer-registry.ts`,
  `hardware-specs.ts`, `machine-favorites.ts`, the snapshot/state/tape commands.

## 3. Decisions (accepted by the author, 2026-10-04; see §8)

- **P1. Same machine, new model.** The Pentagon is a model of `MI_SPECTRUM_128`, as the +2A/+3
  became models of `spp3e` (G9.2 P1). A separate machine id would duplicate the registry, menu,
  state, tool and compiler entries for a machine that differs only in timing. The 128K gets
  `models: [{ modelId: "sp128", ... }, { modelId: "pentagon", ... }]`.
- **P2. The timing is model config.** A new key `MC_SP128_TIMING = "sp128Timing"` with values
  `"sp128"` (also the meaning of an absent key, so existing projects, favorites and state files are
  unchanged) and `"pentagon"`. Both models state the key explicitly, so a config merge cannot carry
  `pentagon` onto the 128K model (the lesson of G9.2 §9).
- **P3. One profile table owns the numbers.** `src/emu/machines/zxSpectrum128/sp128Timings.ts`
  maps each timing to `{ clockHz, tactsPerFrame, screenConfig, interruptTacts, floatingBus,
  contention, snapshotKind }`. The host, the screen device, `hardware-specs.ts` and the snapshot
  capture read it; no timing literal is added anywhere else. The C core gets the matching
  `Sp128ScreenConfig` constants and a profile index, and a unit test pins the two sides to each
  other (tacts per frame, clock, screen size) so they cannot drift.
- **P4. The core selects the profile at hard reset.** `sp128HardReset(timing)` (0 = 128K,
  1 = Pentagon), like `sp48HardReset(is16k, isNtsc)`. It sets the screen config, the clock, the
  interrupt length, a `sp128Contended` flag and a `sp128HasFloatingBus` flag. The per-tact tables
  are sized to the larger frame (`SP128_TACTS_PER_FRAME_MAX = 71 680`). With `sp128Contended == 0`,
  `sp128DelayMemoryAccess`, `sp128CpuDelayAddressBusAccess` and `sp128DelayPortAccess` take the
  uncontended path at once (one well-predicted branch on the 128K path, measured in Phase 1).
- **P5. The ROMs are the 128K's own (Q3).** The Pentagon model boots `sp128-0/1.rom`, so the
  injection and tape flows, the system variables and Klive BASIC's ROM-switch runtime are unchanged.
  A Pentagon-specific ROM image is a later, optional addition through the same `romId` override
  that G9.2 used.
- **P6. Timing values are found by observation and cited.** Each number in the profile table carries
  a comment naming its source (the Next VHDL line, a measurement in the harness). No code from other
  emulators is copied or translated; facts only, recorded in Klive's words (as for D4 and G9.2's P5).
- **P7. The 128K stays byte-for-byte the same.** A golden of the 128K's behaviour (frame tact
  counts, a screen hash and an audio hash over a fixed program, the contention totals) is recorded
  *before* the core changes, and Phase 1 must reproduce it exactly.

## 4. Behaviour to emulate (to be confirmed in Phase 0)

1. **Frame.** 320 lines of 224 T. INT at the frame boundary (Klive's frame tact 0 convention: the
   frame starts with the interrupt), the first display line 80 lines after it.
2. **No contention** anywhere: memory (any bank), I/O (`$FE`, `$7FFD`, AY), the address-bus
   "delayed" accesses of `IR`-style cycles.
3. **No floating bus.** Unattached ports read `$FF`; the reading of `$FF` on port `$FF` that 128K
   games use for raster sync does not exist (games written for the Pentagon do not use it).
4. **Paging.** `$7FFD` as on the 128K, including the bit-5 lock (the Next VHDL keeps the lock in
   its Pentagon 512 mode and drops it only in Pentagon 1024; the 128 has no extra bits).
5. **Port decoding.** `$FE`, `$7FFD`, `$FFFD`/`$BFFD` as on the 128K for the purposes of this plan;
   any difference found in Phase 0 is recorded and, if it changes software behaviour, implemented.
6. **Rendering.** The picture keeps the 128K's visible window (352 × 296: 48-pixel borders) so the
   screen device, recordings and screenshots keep their size; the Pentagon's extra border lines fall
   in the non-visible part (Q5). The border, paper and attribute fetches follow the Pentagon's
   frame: a border change or a screen write at a given tact lands on the pixel the Pentagon shows.
7. **Audio.** Beeper and AY sample at the 3.5 MHz clock; the AY's own clock already follows the tact
   counter (`SP128_PSG_CLOCK_STEP` = 16 T), so it becomes 1.75 MHz without a change.
8. **Frame pacing.** ≈ 48.83 frames per second (3 500 000 / 71 680). Check that
   `MachineFrameRunner` and the audio pipeline derive the rate from `tactsInFrame` and
   `baseClockFrequency`, not from a 50 Hz assumption.

## 5. Phases

### Phase 0 — reference values and the 128K golden (S)
1. Read the Pentagon timing in `_input/next-fpga/src/video/zxula_timing.vhd` and `zxnext.vhd`
   (frame, `vactive`, `hactive`, interrupt position and pulse) and write the profile's numbers with
   their citations into this plan (§9).
2. Derive the `Sp128ScreenConfig` for the Pentagon (vertical sync, non-visible and visible border
   lines, border and blanking times, prefetch times) so that the frame is 320 × 224, the display
   starts 80 lines after the interrupt and the visible window is 352 × 296.
3. Record the 128K golden of P7 (a test in the e2e-cores tier, kept afterwards as a regression).
4. Record the INT pulse length: 36 cycles, from the Next VHDL (Q4).

### Phase 1 — core: run-time timing profile (M)
1. `sp128.c`: `SP128_TACTS_PER_FRAME_MAX`; the tables sized to it; `sp128BaseClockFrequency`,
   `sp128InterruptTacts`, `sp128Contended`, `sp128HasFloatingBus` as statics set by
   `sp128HardReset(timing)`; `sp128GetTactsInFrame()`, `sp128GetBaseClockFrequency()`,
   `sp128SetContentionValue` and the contention getter use the run-time values; the
   `sp48BaseClockFrequency` macro points at the variable.
2. The Pentagon `Sp128ScreenConfig` with eight zero contention values; `shouldRaiseInterrupt()`
   uses `sp128InterruptTacts`; `sp128ReadNonFePort` returns `$FF` without a floating bus;
   `sp128ReadFloatingBus()` (the export) returns `$FF` too.
3. The uncontended fast path of P4.
4. `npm run build:sp128-wasm`; the layout fingerprint changes (expected, §2).
5. The P7 golden passes unchanged on the 128K; `test/wasm/` 128K tests stay green; measure the
   frame time of the 128K before and after (no measurable regression).

### Phase 2 — registry, host and specs (S)
1. `constants.ts`: `MC_SP128_TIMING`. `machine-registry.ts`: the two models of §1 (P1, P2).
2. `sp128Timings.ts` (P3). `ZxSpectrum128WasmHost` reads the timing from the model config: the
   clock, the screen device configuration (a new
   `CommonScreenDevice.PentagonScreenConfiguration` built from the profile), and passes it to
   `hardReset`. `ZxSpectrum128WasmV2Machine.hardResetWasmV2` calls `sp128HardReset(timing)`.
   `WasmFloatingBusDevice` reports nothing on the Pentagon.
3. Projects, favorites and state files without a model id still resolve to the 128K (test).
   Switching between the two models rebuilds the machine (clock and frame length change).
4. `hardware-specs.ts`: a per-model override for the Pentagon (clock, frame, "no contention",
   "no floating bus", the AY clock); extend `test/machines/hardware-specs.test.ts`.
5. A unit test pins `sp128Timings.ts` to the core's getters (P3).

### Phase 3 — hardware tests through the harness (S–M)
`createSp128Session("pentagon")`; tests in a new `test/sp128-hw/` folder (the 128K's counterpart of
`test/zxnext-hw/`), registered in `build/e2e-tests.ts`'s e2e-cores tier. Each test states the value
it expects and its source (P6):
1. **Frame:** tacts between two interrupts = 71 680; `HALT` loop count per frame; ≈ 48.8 Hz.
2. **No memory contention:** the same timed loop in bank 0, 1, 5 and 7, and in `$4000–$7FFF`, takes
   the same tacts (on the 128K the contended banks are slower: the same test parameterised over
   both models proves the switch).
3. **No I/O contention:** `IN`/`OUT` to `$FE` and `$7FFD` cost their base timing at every tact.
4. **No floating bus:** `IN A,($FF)` reads `$FF` at every tact of the frame.
5. **INT:** position (frame tact 0) and length; an `EI; HALT` program's acceptance tact.
6. **Display position:** a screen write at a tact just before / after the line's fetch is / is not
   visible in that frame; a border colour change at a known tact appears at the expected pixel
   (screen probes, not goldens).
7. **Paging:** `$7FFD` banks, ROM, shadow screen and the bit-5 lock, as on the 128K.
8. **AY:** a tone register setting produces the expected period at 1.75 MHz (sample-count probe).
9. **Boot:** the Pentagon boots to the 128K menu; the code-injection and tape-Loader flows reach
   their return points (the 128K flows, unchanged, P5).

### Phase 4 — snapshots and state files (S)
1. `spectrumSnapshot.ts`: a `pentagon` `SnapshotMachineKind`. `szxFile.ts` machine id 7 and
   `z80File.ts` hardware mode 9 parse to it (512/1024 stay unsupported).
2. Mapping: `pentagon` → `MI_SPECTRUM_128`, `modelIds: ["pentagon"]`, kliveName "Pentagon 128";
   `128k`/`plus2` → `["sp128", "pentagon"]`, so a 128K `.sna` keeps a project that is on the Pentagon
   on the Pentagon (`fitSpectrumMachine` already keeps the current model when it is listed), with a
   warning that the snapshot does not say which machine it came from.
3. Capture reports `pentagon` from the profile's `snapshotKind`; the writers emit `.szx` machine id 7
   and `.z80` v3 hardware mode 9; `.sna` is written as today (it has no machine field).
4. Restore: the frame tact from a snapshot is clamped to the Pentagon's frame.
5. State files: a Pentagon state restores as `pentagon` (model + config round-trip); its embedded
   `.szx` (D9) is a Pentagon `.szx` and loads back as one.
6. Tests: extend `test/spectrum/snapshot/*` (parse, load, save, flow) and
   `test/wasm/state/machine-state-flow.test.ts` for the new model.

### Phase 5 — IDE surfaces and compilers (S)
1. Machine-select dialog: the 128K now has two models; check the layout and update
   `test/dialogs/machineSelect/*`. No new favorite (Q6).
2. Menus, tool and renderer registries: no change expected (P1); verify the 128K menus appear on the
   Pentagon.
3. New-project dialog: the `sp128` templates work on the Pentagon (`test/dialogs/newProject/`).
4. Compilers: a Klive BASIC `zx128k` corpus program and a Klive Z80 assembly program run on
   the Pentagon. One corpus program uses a timing loop whose output differs between the two models,
   proving the model reached the core.
5. Running IDE check (CDP recipe in `.ai/ui-theming-intent-and-lessons.md`): switching between the
   128K and the Pentagon changes the border geometry and the frame rate without a restart, and the
   frame/tact read-outs in the status bar and the CPU panel show 71 680.

### Phase 6 — documentation and roadmap (S)
1. `docs/content/machine-types.mdx`: the Pentagon model, what it is for, and what it does not have
   yet (TR-DOS).
2. `LANDING_PAGE_COMPETITIVE_ANALYSIS.md`: §2 "Other machines" row gains "Pentagon 128"; §4 W9 moves
   Pentagon to closed.
3. Mark G9.1 ✅ in `CLOSING_THE_GAPS_PLAN.md`; set this plan's status to done with an "as built"
   section (§9).
4. `.ai/ui-theming-intent-and-lessons.md` only if Phase 5 changed a visual rule (machine-select
   layout).
5. `npm run doc:build && npm run doc:check`.

## 6. Verification

Focused tests per phase, then `npm run build:check`, `npm run lint:renderer` (Phase 5 touches the
dialog), `npm run test:e2e` for the core tiers, and
`npx electron-vite build --config build/electron.vite.config.ts`.

## 7. Risks

| Risk | Mitigation |
|---|---|
| The 128K changes behaviour when its timing becomes data | P7's golden recorded before any core change; Phase 1 must match it bit for bit |
| A hidden 50 Hz or 70 908 assumption in the TS side (frame runner, audio, recording, status bar) | grep for the constants and for `3_546_900` in Phase 2; the IDE check of Phase 5 |
| Interrupt-to-display alignment off by a few tacts, invisible in normal software | Phase 3's display-position probes; multicolour test programs (recorded by observation) |
| The per-tact branch slows the 128K | measured in Phase 1; fall back to two specialised delay functions selected at reset |
| Users expect TR-DOS with "Pentagon" | the docs and the machine description say so; G9.1b is the follow-up |
| Port decoding differs from the 128K in a way some software notices | Phase 0 records the decoding; Phase 3 tests the ports that matter |

## 8. Decisions from the author (2026-10-04)

All proposals accepted:

- **Q1. Model, not machine:** the Pentagon is model `pentagon` of `MI_SPECTRUM_128`, display name
  "Pentagon 128"; the 128K keeps model id `sp128` and its display name "ZX Spectrum 128K" (P1, P2).
- **Q2. TR-DOS / Beta 128 later:** out of scope here; it becomes **G9.1b** with its own plan (WD1793,
  `.trd`/`.scl`, the TR-DOS ROM trap, a disk menu, and a check of the TR-DOS ROM's distribution terms).
- **Q3. ROM:** the 128K's own `sp128-0/1.rom` (P5); a Pentagon-specific image may come later through
  a `romId` override.
- **Q4. INT length:** 36 CPU cycles, taken from the Next VHDL's Pentagon mode
  (`zxnext.vhd` ~1968–2000) and cited in the profile table.
- **Q5. Visible window:** the 128K's 352 × 296; the Pentagon's extra lines are non-visible.
- **Q6. Favorites:** unchanged; the Pentagon is reached through the machine-select dialog.

## 9. Reference values (recorded in Phase 0)

| Value | Klive | Source |
|---|---|---|
| Clock | 3 500 000 Hz | the Next's Pentagon mode runs the CPU at 3.5 MHz; plan §1 |
| T per line / lines | 224 / 320 (71 680 T, 48.83 Hz) | `zxula_timing.vhd` (Pentagon): `c_max_hc` 447, `c_max_vc` 319 in 7 MHz clocks |
| Blanking | 32 T (hc 0–63), 16 lines (vc 0–15) | `zxula_timing.vhd`: `c_max_hblank` 63, `c_max_vblank` 15 |
| First display line | line 80 of the raster | `zxula_timing.vhd`: `c_min_vactive` 80 |
| INT position | frame tact 0, which is 62 T before the raster's line 0 starts; paper starts at frame tact 17 982 | interrupt at (vc 319, hc 439) and first fetch at hc `c_min_hactive` − 12 = 116: 9 + 116 + 80 × 448 = 35 965 clocks = 17 982.5 T. The same reading of the 48K's VHDL values gives its 14 336 T exactly. |
| INT length | 36 T | `zxnext.vhd` ~1989 (`pulse_count_end`: 36 for 128K and Pentagon) |
| Contention | none | `zxnext.vhd` ~4461 (contention off in the Pentagon timing) |
| Floating bus | none (unattached ports read `$FF`) | plan §4 |
| `$7FFD` decoding / lock | as the 128K, bit 5 locks | the Next keeps the lock outside Pentagon 1024 (`zxnext.vhd` ~3749) |

## 10. As built (2026-10-04)

- **Core (`sp128.c`).** `sp128HardReset(timing)` (0 = 128K, which is also what a call without the
  argument passes; 1 = Pentagon) runs `sp128ApplyTiming`: the screen config, the clock, the INT
  length, contention and the floating bus. The per-tact tables are sized for 71 680 T. The
  Pentagon's interrupt does not fall at the start of a raster line, so the timing tables, built for a
  raster that starts with its first line, are **rotated by 62 T** after they are built
  (`SP128_PENTAGON_RASTER_SHIFT`): frame tact 0 stays the interrupt everywhere else in Klive. The
  contended-memory test became a per-slot mask updated on paging (`sp128ContendedSlots`, empty on
  the Pentagon). New exports: `sp128GetTiming`, `sp128GetInterruptTacts`.
- **The 128K is unchanged, bit for bit.** `test/sp128-hw/sp128-golden.test.ts` was recorded on the
  old core (24 frames of a program exercising interrupts, border, contended writes, the floating bus,
  paging, the AY and the beeper: picture, audio, tact and contention counters, CPU, RAM) and passes
  on the new one. Speed: a 1 000-frame run of that program went from about 510 ms to about 535 ms
  (≈ 0.02 ms a frame, about 0.1 % of a real 20 ms frame). No single change explained it - restoring
  any one of them did not bring it back - so it is recorded as the cost of the larger core.
- **Models (P1, P2).** `sp128Timings.ts` holds the table (P3) and `SP128_MODELS` (`sp128`,
  `pentagon`); the registry, `hardware-specs.ts` (a `pentagon` override), the host and the snapshot
  capture read it. The model's timing wins over a project's config in
  `mergeZxSpectrum128Config`, so a config cannot turn one model into the other.
- **References without a model id.** The 128K had none until now, so favourites, projects, sessions
  and state files saved it without one. `resolveModelId` maps a missing id to the machine's
  `implicitModelIds` entry (`sp128` → `sp128`); favourites, the machine-select dialog, the menu and
  the state loader all resolve through it. An old 128K state loads onto a running 128K without a
  rebuild and without the "model differs" warning.
- **Tests (`test/sp128-hw/`).** `sp128-timings.test.ts` pins the table to the core (frame, clock,
  INT, screen, where the paper starts, contention). `pentagon-timing.test.ts` runs every check on
  both models: frame length and interrupts per frame, memory contention by bank, I/O contention by
  port, the floating bus, the INT pulse swept tact by tact, the first paper fetch swept tact by tact,
  border changes against the geometry, paging and the lock, the AY tone frequency, booting, both
  code-injection flows and the tape Loader.
- **Found on the way:** the 128K's code-injection flow labelled its editor return point ROM 1; the
  128 BASIC editor runs in ROM 0 (the same mislabel G9.2 found on the +3E). It never mattered - the
  core matches the PC alone - but the label is now right.
- **Snapshots (Phase 4).** `.szx` machine 7 and `.z80` hardware mode 9 load as `pentagon` and are
  written for it; a 128K snapshot lists `["sp128", "pentagon"]`, so a Pentagon project keeps the
  Pentagon. The tests that used the Pentagon as their "unsupported machine" now use the Scorpion.
  A Pentagon state file restores as a Pentagon with a Pentagon `.szx` inside.
- **IDE (Phase 5).** Checked in the running app (the doc-shots Playwright driver): the machine-select
  dialog lists the Pentagon with its hardware sheet (224 T × 320 lines, 71 680 T, 48.83 Hz, the
  "no contention, no floating bus, no TR-DOS" note); switching to it boots the 128K menu, the status
  bar reads "Pentagon 128 (3.500 MHz)", and the frame counter advanced at 48.7 frames per second.
  A switch back to the 128K could not be driven in a later session: the app's menus came up empty
  for the scripted instance, and an unchanged `HEAD` build showed the same, so it is the environment,
  not this change.
- **Compilers.** `test/kbasic/codegen/targets.test.ts` runs a Klive BASIC `zx128k` program on the
  Pentagon (Float output through the 48K ROM, BANKM restored), and a loop that counts passes per
  frame: the Pentagon counts 2.8 % more than the 128K (1.1 % from the longer frame alone). sjasmplus
  and Pasta/80 are not installed here; they select by machine id, so the Pentagon gets the 128K's
  targets and templates unchanged.
- **Not done:** no `.ai/ui-theming-intent-and-lessons.md` entry - nothing visual changed but the
  machine list's contents. G9.1b (Beta 128 / TR-DOS) is the follow-up in the roadmap.
