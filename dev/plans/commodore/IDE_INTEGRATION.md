# IDE integration for the Commodore machines

Part of `COMMODORE_PLAN.md` (Phase 7 for the C64; repeated per machine in Phases 9–11). The debugger's
CPU-neutral work is `CPU_NEUTRAL_DEBUGGING.md`; this file covers everything else a machine touches.

## 1. Registry, build, packaging (per machine)
As in `dev/ai/videoton-tvc.md` "Integration checklist"; **(2×)** marks a list kept in two places.
- `constants.ts`: `MI_C64` (added back), `MI_VIC20`, `MI_C264`, `MI_C128`; the `MC_*` keys (`MC_VIC20_RAM`,
  `MC_CBM_DRIVE8/9`, `MC_CBM_SID_MODEL`, `MC_CBM_ROM_SET`, `MC_C128_SCREEN`); `MEDIA_INFO_MACHINE_IDS`,
  `BEAM_POSITION_MACHINE_IDS`.
- `machine-registry.ts`: the `cpus` descriptor (CPU_NEUTRAL_DEBUGGING.md §3.1), features (`MF_TAPE_SUPPORT`,
  `MF_INJECT_SUPPORT`, `MF_EXEC_HISTORY`, `MF_REVERSE_DEBUG`, `MF_PROFILE`, `MF_BANK` where banking applies),
  models, media ids (drive 8/9, tape, cartridge), tool info (`createDisassembler`, the machine's custom
  disassembler), `charSet` read from the character ROM at run time (none is shipped, D2).
- `machine-renderer-registry.ts`, `hardware-specs.ts` (+ `hardware.*` i18n keys), `NewProjectModel.ts`
  `MACHINE_FAMILIES` (a new "Commodore" family), templates in `src/public/project-templates/<machine>/`.
- `dev/scripts/build-<m>-wasm.cjs` (from `build-sam-wasm.cjs`: export allow-list, volatile symbols, build
  lock, layout stamp), `check-<m>-wasm-size.cjs`, `benchmark-<m>-wasm.cjs`; `package.json` `build:<m>-wasm`,
  `check:<m>-wasm-size`, `build:all-wasm` and `extraResources` → `wasm/<m>` **(2×)**;
  `check-wasm-cpu-contract.cjs`, `wasmArtifacts.ts`, `unitTestMachines.ts`, `headlessMachines.ts` +
  `HeadlessMachineFactory.ts`, `reverse/exportContract.ts`.
- State: `STATE_MACHINES` in `state-menus.ts` **and** `MachineStateCommands.ts` **(2×)**; `coreIdOfMachine`.
- Menus: `machine-menu-registry.ts` + `<m>-menus.ts` (drives, eject, write protect, tape, cartridge, SID
  model, joystick port swap, VDC/VIC view on the C128, RAM configuration on the VIC-20).
- Messaging: `MainToEmuProcessor.ts`/`EmuApi.ts` getters for each chip panel.
- Tests infrastructure: `test/vitest.setup.ts` `CORE_EXPORT`; `build/e2e-tests.ts` (`test/<m>-hw/**`).

## 2. ROM sets (decision D2)
- `src/common/commodore/cbmRomSets.json`: every ROM with part number, size, CRC32, SHA-1, the machines,
  models and roles that use it (hashes from the research pack; recomputed from good images where the pack
  says so, VIC20 OQ10, TED OQ8). A `test/machines/cbm-rom-sets.test.ts` checks the manifest's shape.
- **ROM manager dialog** (Model/Controller/View, `dev/ai/ui-mvc-guide.md`): pick files or a folder, match by
  hash, show what each machine/model still lacks, copy into user data; opened automatically when a machine
  starts without its set. All texts through `t()`.
- `cbmRomFile(id)` in tests and tools; `npm run cbm-roms:check` lists `.local/commodore/roms/` against the
  manifest.
- **Klive test ROMs** (one per machine, Klive's 6502 source in `src/public/commodore/test-roms/`, built by a
  script with Klive's assembler, image pinned by a test): reset/IRQ/NMI vectors, a frame-interrupt handler,
  a "test done" trap. They make the CI tier independent of Commodore ROMs.

## 3. The assembler (decision D10)
- **A new Klive 6502 assembler**, `src/main/m6502-compiler/`, built on `compiler-common` (the shared
  parser, expressions and fixups the Z80 assembler uses), written fresh (the old `m6510-compiler` is removed
  by D4).
  - Syntax and directives follow the Klive Z80 assembler where they apply (`.org`, `.defb`, `.defw`,
    `.include`, macros, `.if`, structs, `.model`), so a Klive user meets one language; 6502 mnemonics and
    addressing modes with the common `#`, `(zp,X)`, `(zp),Y` forms; undocumented opcodes behind an option
    with their usual names; zero-page optimisation of absolute operands with an override.
  - `.model C64 | VIC20 | C264 | C128` (`VALID_MODELS`, a new `CbmModelType` set beside
    `SpectrumModelTypes.ts`), choosing the default load address, the BASIC stub (`.basicstart` emits the
    `SYS` line; the address follows the model and RAM configuration) and the export formats.
  - Output: segments with load addresses, a list file, a symbol table, and source maps for the debugger
    (the same model the Z80 assembler feeds the IDE: breakpoints on lines, the disassembly's labels).
  - Language provider and completion data (`m6502-completion-data.ts`); the file type `.asm` in a
  Commodore project (no special extension needed: the project's machine decides), `.s` for ca65.
- **ca65/ld65 integration** (zlib) in `src/main/compiler-integration/` like the SjasmPlus integration: a
  user-installed cc65, project build settings, VICE-label (`-Ln`) and `--dbgfile` import so breakpoints and
  source mapping work on ca65 projects (EXISTING §6.1). KickAssembler, ACME and 64tass are follow-ups.
- **Label files:** import and export VICE label files (`al C:xxxx .name`), the de-facto exchange format.

## 4. Run, Debug, export (decision D11)
- `src/common/commodore/codePlacement.ts`: per machine and configuration, the BASIC start, the BASIC
  pointers to set after an injected load (C64 §9.5: $2B/$2C start, $2D/$2E, $2F, $31, $AE end; the
  VIC-20's, the Plus/4's and the C128's from their packs, confirmed by running each ROM), the keyboard
  buffer address and length (C64 $0277/$C6), and the rule for `RUN` vs `SYS <entry>`.
- **Run/Debug:** boot to the READY landmark (found by running the ROM; harness `bootToBasic` logic shared
  with the IDE), inject the segments, fix the pointers, type `RUN` or `SYS`; Debug stops at the entry point.
  One code path for Run, the CLI (`klive run --machine c64`) and unit tests.
- **Run from disk** (a project setting and a command): build a D64 with the program (`cbmdos.ts`), insert it
  in drive 8, type `LOAD"*",8,1` and `RUN`: the true drive does the loading.
- **Export:** PRG (all machines), D64, TAP (KERNAL format), CRT for the C64 (normal 8K/16K, from `.org $8000`
  segments), and VIC-20 `.prg` cartridges at $A000.
- **Load and Run** for dropped/opened `.prg`, `.p00`, `.t64` (extract), `.d64`/`.g64` (attach and `LOAD"*"`),
  `.tap` (attach and `LOAD`), `.crt` (attach and reset); `dropped-file-action.ts`, `src/main/open-file.ts`,
  `sniff-content-kind.ts`.

## 5. Debug formats and tools (EXISTING §6)
- VICE label files and cc65 `.dbg` import (§3).
- The disassembler's custom hooks per machine: KERNAL jump-table names as labels (names written by Klive
  from the Programmer's Reference Guide's documented API, never from a commented disassembly).
- A VICE binary-monitor server is a follow-up (COMMODORE_PLAN §8).

## 6. Panels (Debug activity, `restrictTo` the machine)
All on `@renderer/controls/data`, `ch` widths, row-size tokens (M1–M3), `--color-state-value`, i18n through
`t()`; any visual change records its rule in `dev/ai/ui-theming-intent-and-lessons.md`.
- **6502 CPU** (shared; CPU_NEUTRAL_DEBUGGING.md §3.3), with a CPU selector on multi-CPU machines.
- **VIC-II:** raster line/cycle, BA/AEC, display/idle, VC/RC/VMLI, border flip-flops, mode, bank and
  pointers, the 8 sprites (position, pointer, MC, DMA, expansion, colours), IRQ sources, the light pen.
- **CIA 1/2:** timers with mode and latch, ICR, TOD, SDR, ports with direction.
- **SID:** per voice frequency (Hz), pulse width, waveform, gate, ADSR and envelope phase/level, OSC3/ENV3,
  filter cutoff/resonance/routing, volume, the chip model.
- **Drive:** the drive CPU (through the CPU selector), VIA1/VIA2, head track/half-track, motor, LED, zone,
  SYNC, the byte under the head, the image and its write state.
- **VIC (VIC-20), TED, MMU, VDC** in their milestones.
- **Memory panel:** the CPU's view and each address space (RAM under ROM, colour RAM, the drive, the VDC
  RAM, C128 banks) through partitions and `bankSpace.ts` entries.
- **SysVars / BASIC listing:** BASIC V2/3.5/7.0 token tables (documented in the Programmer's Reference
  Guides) for a detokenised listing in `BasicPanel.tsx`; zero-page variables by their documented names.
- **Virtual keyboards** per machine from photographs (after design approval), colours as tokens.
- **Emulator status bar:** drive LED and track, tape counter and motor.

## 7. Documentation (each milestone)
- `docs/content/en/guides/machines/commodore-64.mdx` (and `vic-20`, `commodore-16-plus4`, `commodore-128`),
  screenshots from `guides-<m>.cjs` doc-shots recipes; `reference/machine-types.mdx`;
  `reference/m6502-assembler/` (the language); the ROM manager in "Get started"; the Under the Hood articles
  (the VIC-II's badlines, the 1541's read logic) under `dev/ai/hardware-articles-guide.md`.
- Docs name ROMs as user-supplied (D2) and explain where to get legal copies only in general terms (the
  owner's licensed products), never links to ROM downloads.
- `dev/plans/LANDING_PAGE_COMPETITIVE_ANALYSIS.md` (machine table) and `docs/landing/features.ts`
  (`since`); its claim that every shipped ROM is annotated stays true (no Commodore ROM ships).
- `AGENTS.md`: a "Commodore machines" section like the SAM's; `dev/ai/commodore.md` for decisions, as-built
  notes and open items.

## 8. i18n
Every new UI text through `t()` with an English entry and translator context in
`src/common/i18n/locales/en/`; `npm run i18n:keys`; no translations written by hand.
