# Videoton TVC: Decisions, As-Built Notes and What Is Open

The Videoton TV Computer plan was closed on 2026-11-04, with every phase done: both models (64K with
BASIC 1.2, 64K+ with BASIC 2.2) run in the app with tapes, VT-DOS disks on the HBF card,
Run/Debug/Export, the debugger, history, profiling, reverse debugging and a virtual keyboard. The
plan, with its design discussion and phase log, is in git history at `dev/plans/VIDEOTON_TVC_PLAN.md`.

This note keeps what a later session needs and the two READMEs do not say:
- `src/emu/machines/tvc/wasm/README.md`: the core. Its layout, the time base, the clock stretch, the
  video steps, sound, tape, the HBF card and the test files. Read it first.
- `test/harness/tvc/` (`session.ts`, `bare.ts`): the harness. It has no README; its header comments
  are the reference.
- The research pack `dev/research/videoton-tvc/`: `TVC_HARDWARE_OVERVIEW.md`, `TVC_VIDEO_GENERATION.md` and
  `TVC_CLOCK_STRETCH_FIGURES.md`. Every hardware fact in the core comes from these.
- The ROM annotations: `dev/ai/rom-annotations/tvc-authoring-guide.md`.
- Lessons for the next non-Spectrum machine: `dev/ai/wasm-migration-intent-and-lessons.md`, "A Machine
  Whose Video Chip Stretches The CPU: The Videoton TVC".

## Decisions

Accepted by the project author on 2026-10-27. Code cites them by ID.

- **D1, provenance:** Klive's own code from the research pack. See "Provenance" below.
- **D2, one machine ID:** `MI_TVC = "tvc"`, display name "Videoton TV Computer (TVC)", with two models:

  | Model | Board | Video RAM | ROMs | M1 WAIT |
  |---|---|---|---|---|
  | `tvc64` | HBA-1 | 16K | BASIC 1.2 (`tvc12-d4`, `d3`, `d7`) | yes |
  | `tvc64p` | HBA-2 | 4 x 16K | BASIC 2.2 (`tvc22-d6`, `d4`, `d7`) | no (the HBA-2 has no WAIT circuit) |

  One WASM artifact runs both; `tvcConfigure` picks the model. `MC_TVC_HBF` plugs in the HBF card
  (off by default, a restart); `MC_TVC_COLOUR` reports a colour or monochrome monitor in port 59h
  bit 6, which the ROM uses to pick its default palette.
- **D3, ROMs:** shipped in `src/public/roms/` with `tvc-roms-readme.txt` and a
  `THIRD_PARTY_NOTICES.md` section, removed on a rights holder's request. ROM loading stays behind
  `TvcRoms.ts`, so a user-supplied ROM setting would be a change there only.
  `test/machines/tvc-rom-images.test.ts` pins every image by CRC. The VT-DOS ROM is v1.1 by MAME's
  CRC (`d_tvcdos.128`), though the pack's file name says 1.2.
- **D4, the TV window:** 560 x 288 (70 characters of 8 dots), aspect about 0.59, the paper centred for
  the ROM's CRTC values, no blanked dot showing. It was first 608 x 288, which showed the last 2.5
  blanked characters as a black stripe on the left.
- **D5, time:** `cpu.tacts` stays in whole T-states; a half-T clock beside it carries the stretch.
  Counting tacts in half-T units was rejected: it would double every tact number in the IDE and in
  the shared debug loop.
- **D6, the 6845:** Hitachi type 0 by default (R12-R13 readable, VS width from R3's high nibble), with
  a Motorola flag (`tvcCrtcSetMotorola`, journaled as `CrtcSetMotorola`).
- **D7:** the HBF card and VT-DOS were part of this plan, not a separate one.

## Provenance

- **rtvc** (`dev/research/videoton-tvc/rtvc/`, MIT) and **MAME's TVC files** (BSD-3-Clause) were read only
  for interface facts: the CAS container and pulse rules, the HBF register map, the keyboard matrix.
  No code was ported, so no Klive file carries their notice. rtvc's CRTC and video generator are not
  a model: `TVC_VIDEO_GENERATION.md` Part 12 lists where they differ from the hardware.
- **rtvc's ROM listings never feed a shipped `.rom.dis`**, names included (`rtvc/roms/*.asm`,
  `rom_comments_1_2.json`, `rom_symbols_1_2.json`). Their routine names and comments come from
  published books, so the ROM-annotation rule D4 (`dev/ai/rom-annotations/README.md`) rules them out.
  They could be read during emulation work to understand behaviour (the CRTC table, the palette
  defaults). Some names in Klive's code came from there (`KB_CHIN` in `tvcMachineInfo.ts` and the
  harness); they are not evidence for a sidecar.
- **ROM addresses in the code are behaviour facts** read from the ROMs or seen on the running machine
  (the key waits, the sign-on loops, the token tables, `RST 30h`). That is allowed under D1.
- **GPL emulators** (ep128emu) may be run as oracles only, recording observed results in Klive's
  words. Their source is not read.
- **`rtvc/progs/`** and **`dev/research/tvc-software/`** have no usable licence: never test fixtures, never in
  `src/public/` or the docs site. Test programs are written for Klive.

## Open hardware questions

Each has one constant or define in the core, with its default. None is settled by a real machine.

| # | Question | Default |
|---|---|---|
| Q1 | Hitachi type-0 or Motorola 6845 | type 0 (D6) |
| Q2 | First sound interrupt after a restart: 8 periods (the manual) or 16 (the emulators) | 16 (`TVC_SOUND_FIRST_IT_PERIODS`). The ROM times its tape with it, so a real recording's frequencies would decide it (the wasm README, "Tape") |
| Q3 | Does a refresh cycle in video RAM stretch the clock? | no |
| Q4 | The 64K's WAIT jumpers TB1/TB9: is the system ROM slow? | the cartridge is slow, the system ROM is not, no card is slow (the factory setting is not on the sheets read) |
| Q5 | Sub-character timing (LOAD, the 74LS298/273 clocks) | everything at character granularity |
| Q6 | Keyboard rows 9-10 | not mapped |
| Q7 | DEB phase after reset | 0 |
| Q8 | The HBA-2's R38, printed 68k | 6.8k, the same blank as the HBA |
| Q9 | 64K+ refresh of the 4164's upper 128 rows | no effect (DRAM decay is not modelled) |

## The shared Z80 hook H1

`Z80_DELAY_OPCODE_FETCH(address)` was added to `src/emu/z80/wasm/z80.c` for the TVC, where an M1
stretches differently from a data read and takes the 64K's WAIT. It replaces the memory-read delay of
every M1 (the unprefixed opcode, the opcode after a `CB`/`ED`/`DD`/`FD` prefix, each repeated
`DD`/`FD`, and the halted cycle), not operand bytes, displacements or the `DDCB`/`FDCB` opcode read.
It is compiled only under `#ifdef`, so every other core rebuilt byte-identical. It is documented in
`src/emu/z80/wasm/README.md`, listed in `dev/scripts/check-wasm-cpu-contract.cjs`, and tested by
`test/wasm/z80-hooks/z80-opcode-fetch.test.ts` (call counts 1, 2, 2, 3, 2 for `NOP`, `CB 00`,
`DD 21 nn nn`, `DD DD 00`, `DD CB d 06`).

## Memory partitions, history and profile

- U0-U3 are partitions 0-3, VID0-VID3 4-7 (physical offset = partition x 16K), SYS -1, CART -2,
  EXT -3 (the card window, then EXTH). The HBF card's ROM pages are -4 to -7 ("HBF0"-"HBF3") and its
  RAM -8 ("HBFR").
- The history context decoder (`src/common/history/contexts/tvcContext.ts`, which records port 03h
  and the card's page), the profile layout and the annotation bank space (`bankSpace.ts`, `tvc`) use
  these numbers. `test/tvc-hw/profile.test.ts` checks the decoder against `getPartition` for every
  paging.
- State files, reverse debugging, history and profile all work from the core's image; the export
  contract's one TVC-specific entry is `CrtcSetMotorola`. The journal-replay determinism test passes,
  so `MF_REVERSE_DEBUG` is on. Fast load runs extra core frames inside one displayed frame; the replay
  counts core frames, so it is unaffected.

## Keyboard and typing

- The host keyboard maps by key position (`TvcKeyMappings.ts`); the Hungarian accented letters sit on
  F1-F9. Row 8 holds INS, the cursor keys and Tab, which BASIC's `JOY` reads as joystick 1 (Tab is
  FIRE). INS was missing from the documented matrix and was found in MAME's `LINE.8`.
- The typer (`TvcTyper.ts`) was built from what keys were seen to type: lower case plain, upper case
  with SHIFT, the shifted digits `' " + ! % / = ( )`, the punctuation pairs, the accented letters.
  SHIFT+0's glyph was unclear and is left out. It waits 12 frames after RETURN, because BASIC 2.2
  drops the first keys of a line typed while it is still storing a long one.
- The virtual keyboard (`src/renderer/appEmu/Keyboard/TvcKeyboard.tsx`) is drawn from a photo of a
  TVC 64K: five rows stepped to the right, the shifted legend above the plain one, the joystick on the
  right (its directions are row 8's cursor keys, its knob is FIRE). Zones work as the HT-1080Z's. Its
  colours are tokens (`keyTvc` and the rest in `palette.ts`).
- Charset: BASIC stores the Hungarian letters ÁÉÍÓÖŐÚÜŰ at 00h-08h and the lower case at 10h-18h
  (`char-codes.ts`).

## Tape, disks and files

- A `.cas` goes in the deck from the tape menu, the media strip, File > Open, a drop or `tape-load`
  (`src/main/open-file.ts` refuses it on other machines). A bare `.cas` is the HT-1080Z's by default;
  the viewer (`DocumentPanels/TvcTape/`) and `detectCasFormat` read which machine from the bytes.
- **Fast load is a turbo, not a ROM trap.** While the tape plays with the motor on, a displayed frame
  runs 25 machine frames. A trap would have had to replace the ROM's pilot calibration, its CRC (kept
  in IY) and its sector checks (EXTH F77Bh-F95Ch). The turbo stays exact and costs nothing to keep.
- SAVE is decoded from the output toggles; two traps found on the way are in the wasm README, "Tape".
- Disks: a raw `.dsk` whose geometry comes from the FAT12 boot sector (`TvcDiskImage.ts`). The
  guest's writes are published as the whole image (`DSK_WHOLE_IMAGE_KEY`); the main process writes
  it beside the file and renames it over. Machine > Disks has the HBF switch and, with it on, drives
  A and B (insert, eject, write-protect).
- The WD1793 is shared with the Beta 128 (`src/emu/machines/common/wasm/wd1793.c`; a name-prefix
  macro kept the Beta 128's symbols, and the 128K core rebuilt byte-identical). It is also the
  Enterprise EXDOS's controller.

## IDE integration

- **Booting.** BASIC 1.2 tests every RAM page (about 250 frames), shows an animated sign-on that
  waits for a key, then prints its banner ("42255 bytes free"; 2.2 says "42155"). The whole boot is
  about 6 s of machine time. The prompt landmarks: 1.2 loops at D61Bh inside its key routine
  (D618h-D62Ch), 2.2 at CA9Fh (there is no 2.2 listing; found by running it). The sign-on animation
  does not use the prompt's key wait (1.2 CAB7h, 2.2 F2EEh, first reached at frame 252/254).
- **`RST 30h` is a 2-byte call.** Both ROMs vector it through RAM (0030h: `JP 0B23h`) to a handler
  that takes the byte after the RST and returns past it. The 1.2 dispatcher at C363h splits the byte:
  bit 7 a table, bits 6-4 the device (BASIC's peripheral numbers; 2 is the editor), bits 3-0 the
  function; 21h prints C at the cursor. So the custom disassembler (`tvc-disassembler.ts`) lists the
  byte after it as data everywhere, and `getCallInstructionLength` returns 2 for it, or Step Over
  would wait at RST+1.
- **BASIC listing** (`tvcBasicListing.ts`): the token tables are the ROMs' own (1.2 at DE6Dh, 2.2 at
  D73Ah, tokens FEh down to 95h; 2.2 fills seven free slots: AUTO, FKEY, RENUMBER, EXCEPTION,
  ELLIPSE, RECTANGLE, POLYGON). Spaces are stored as typed; `:` is a token; REM/`!` tails, strings
  and DATA up to an unquoted colon are literal. The program starts at TEXT (1722h), which `LOMEM`
  moves. rtvc's `basic.rs` was not used.
- **The TVC Video panel** (`TvcVideoPanel.tsx`, Debug activity, TVC only): R0-R17 and the address
  register, the counters and MA, the mode, palette, border, the vertical blank latch, the interrupt
  flip-flop, and on the 64K+ ports 02h/0Ch and the displayed bank. Values use `--color-state-value`.
- **Beam position:** `getBeamPosition` uses a fixed map for the ROM's CRTC values (100 x 314). A
  program that reprograms the CRTC moves the picture, and the overlay no longer matches it.
- Write-only CRTC registers read 00h, an assumption recorded in `tvc-crtc.c`.

## Run, Debug and export

- **BASIC calls the code; Run does not set PC.** The flow waits for the sign-on animation and presses
  Space 10 frames in, waits for the prompt's key wait and writes the code, then types `LOMEM <end>` and
  `C=USR(<entry>)` 10 frames later (a key that arrives the moment BASIC starts waiting is lost; the
  `TypeText` step has `delayFrames` for this). A `RET` lands back in BASIC, with no ROM address to know.
- The code must lie in 1A30h-BBFFh. The rule is one module, `src/common/tvc/codePlacement.ts`, shared
  by Run, Inject and the export; Z0384/Z0385 warn outside it, and `.model TVC` with no `.org` places
  code at 1A30h.
- **Export:** a `.cas` program file with autostart: the one-line launcher `10 C=USR(entry)` at 19EFh,
  zeros, then the code where it was assembled. `LOAD` runs it.
- **Load and Run** (`tape-load -r`/`-d`, the `.cas` tab bar and Explorer menu, `klive run --machine tvc
  x.cas`): the same boot, then `LOAD`; `RUN` is typed once BASIC is idle unless the tape starts itself.
  `-e` is refused: a TVC tape names no start address.
- **CLI and unit tests:** `klive run` takes a TVC project or a `.cas` with `--machine tvc`; `klive test`
  runs on both models, its flow stopping at BASIC's prompt (`unitTestMachines.ts`). The runner's
  "wrapper in ROM" guard uses 1A30h on the TVC.

## Integration checklist

The files a new machine touched, kept for the next one. **(2x)** marks a list kept in two places.

- Registry: `constants.ts` (`MI_TVC`, `MC_TVC_*`, `MEDIA_INFO_MACHINE_IDS`, `BEAM_POSITION_MACHINE_IDS`),
  `machine-registry.ts` (features, models, media, tool info, custom disassembler, `charSet`),
  `machine-renderer-registry.ts`, `hardware-specs.ts` (+ `hardware.*` i18n keys),
  `NewProjectModel.ts` `MACHINE_FAMILIES`, a template in `src/public/project-templates/tvc/`.
- Build: `package.json` `build:tvc-wasm`, `check:tvc-wasm-size`, `build:all-wasm` **and**
  `extraResources` **(2x)**; `dev/scripts/check-wasm-cpu-contract.cjs`, `src/main/unit-tests/wasmArtifacts.ts`,
  `src/common/headless/headlessMachines.ts` + `HeadlessMachineFactory.ts`,
  `src/emu/machines/reverse/exportContract.ts`.
- Tests: `test/vitest.setup.ts` `CORE_EXPORT`, `build/e2e-tests.ts`; `dev/scripts/run-tests.cjs` now counts
  every `test/*-hw` folder as a core input.
- State: `STATE_MACHINES` in `state-menus.ts` **and** `MachineStateCommands.ts` **(2x)**, plus
  `coreIdOfMachine` in `machineStateFile.ts`.
- Menus: `machine-menu-registry.ts` + `tvc-menus.ts`.
- Assembler: `VALID_MODELS`, `SpectrumModelTypes.ts` (`isTvcModelType`), `compile-code.ts`,
  `UnitTestRunner.ts`, `z80-completion-data.ts`.
- CLI: `src/cli/run/inputs.ts`, `src/cli/verbs/run.ts`, `unitTestMachines.ts`.
- Cross-core suites that list every core: the CPU contract, state determinism and layout, reverse
  journal and export contract, history, profile, `debug-recording-cores`, `hardware-specs`,
  machine-select, new-project, menu structure, `runner-machines`, CLI e2e, and
  `test/wasm/debug-loop-equivalence.test.ts`.

## Open

Checked against the code on 2026-11-04.

- **A TVC disk viewer.** A `.dsk` has no document view for the TVC (the Disk Explorer serves the
  Spectrum's formats). The TVC tape viewer is done (`DocumentPanels/TvcTape/`).
- **The annotation bank space does not cover the HBF card's pages** (-4 to -8): addresses there
  cannot be annotated.
- **The beam overlay assumes the ROM's CRTC values** (see "IDE integration").
- **The hardware questions Q1-Q9** stay at their defaults until a real machine is measured; Q2 and Q4
  are the ones a measurement would most likely change.
- **ROM annotations:** BASIC 1.2's three chips have sidecars (`tvc12-*.rom.dis`); BASIC 2.2 and VT-DOS
  have none (`dev/ai/rom-annotations/tvc-authoring-guide.md`).
- **Not built, by the original scope:** pixel-exact (sub-character) palette, border and mode changes
  (Q5); the TVC 32K and other ROM revisions; cartridges other than VT-DOS; other expansion cards; the
  printer, light pen and external colour inputs; a PAL composite model; Klive BASIC or z88dk targets;
  a host joystick for the TVC (the built-in joystick is row 8 of the matrix); keyboard rows 9-10 (Q6).
- **Not checked:** a packaged installer (the built app was run instead).
