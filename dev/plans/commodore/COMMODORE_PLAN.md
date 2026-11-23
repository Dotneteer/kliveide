# Commodore 8-bit Machines on WASM Cores — Implementation Plan

**Status:** Proposed on 2026-11-23 (branch `commodore-plan`). Decisions D1–D16 (§9) wait for the project
author, except D4: the old TypeScript C64 and its ROMs were removed on 2026-11-23
(CPU_NEUTRAL_DEBUGGING.md §6). Nothing else is implemented.
**Input:** the research pack `dev/research/commodore/` (read its `README.md` first) and the map of Klive's
Z80 assumptions in `CPU_NEUTRAL_DEBUGGING.md` §1 of this folder.

**Scope of the first round** (the project author's choice): the **C64 in all its models**, the
**VIC-20**, the **C16/C116/Plus/4** and the **C128**, with an **accurate 1541** (true drive emulation that
runs fast loaders and protected disks). Klive's earlier TypeScript C64 (`src/emu/m6510Va/`,
`src/emu/machines/c64/`, the 6510 assembler and disassembler) is treated as if it did not exist; D4 removes
it.

## The plan's files

| File | Covers |
|---|---|
| `COMMODORE_PLAN.md` (this) | Ground rules, goals, architecture, phases, decisions, risks |
| [CPU_6502_CORE.md](CPU_6502_CORE.md) | The shared cycle-stepped 6502-family core in C, its variants and its tests |
| [CPU_NEUTRAL_DEBUGGING.md](CPU_NEUTRAL_DEBUGGING.md) | Making Klive's shared debugger machinery (C and TypeScript) work for a second CPU family and for machines with several CPUs, keeping every Z80 core byte-identical |
| [C64.md](C64.md) | The C64 core: time base, PLA, VIC-II, CIAs, SID, input, tape, cartridges, models |
| [DRIVE_1541.md](DRIVE_1541.md) | The IEC bus, the VIA, the 1541 core, the bit-level disk, images, scheduling against the host |
| [VIC20.md](VIC20.md) | The VIC-20 core |
| [TED_C16_PLUS4.md](TED_C16_PLUS4.md) | The C16/C116/Plus/4 core |
| [C128.md](C128.md) | The C128 core: 8502 + Z80, MMU, VIC-IIe, VDC, C64 mode, the 1571 |
| [IDE_INTEGRATION.md](IDE_INTEGRATION.md) | Registry, ROM sets, panels, assembler, Run/Debug/export, file types, tests infrastructure, docs |

**Shape of the result:** a new shared CPU, `src/emu/m6502/wasm/m6502.c`, included by four new machine
translation units, plus one shared drive module included by each of them:

```
src/emu/m6502/wasm/            the 6502 family core + its debug modules (the Z80's counterparts)
src/emu/machines/commodore/
  common/wasm/                 VIA 6522, CIA 6526, IEC bus, 1541 drive, GCR disk, tape (TAP), SID
  c64/wasm/                    c64.c (TU), PLA, VIC-II, ... ; C64/SX-64/C64GS/... as models
  vic20/wasm/                  vic20.c, VIC 6560/6561
  c264/wasm/                   c264.c, TED 7360/8360 (C16, C116, Plus/4)
  c128/wasm/                   c128.c, MMU, VIC-IIe, VDC, + the shared Z80 (src/emu/z80/wasm/z80.c)
  <machine>/*.ts               hosts, adapters, loaders (the Enterprise/SAM pattern)
```

---

## 0. Ground rules

### 0.1 Licence and provenance (decision D1)
- **The default is Klive's own code**, written from the research pack and the primary documents it
  cites. Klive is MIT.
- **Permissive sources may be read for design and ported in named pieces**, each with its notice in
  `THIRD_PARTY_NOTICES.md` and the copyright line kept in the derived file:
  - MAME, **per file** (most of the relevant drivers are BSD-3-Clause; check each header: MAME is mixed);
  - Clock Signal (MIT; its file headers' "All rights reserved" against the MIT LICENCE is EXISTING OQ5,
    settled in Phase 0 before anything is ported);
  - floooh/chips (zlib), Peddle (MIT).
- **Provenance traps inside permissive code** (never ported, only the facts re-derived):
  - MAME's 1541 noise constants and seed, which match VICE's GPL code (DRIVE §8);
  - CLK's VIC-20 noise table, marked "Source: VICE. Not original." (VIC20 §8);
  - every permissive palette, all VICE-derived (VIC20 §8, TED §6): Klive computes its own.
- **GPL and similar sources are read for facts only** (recorded in Klive's words, with citations): VICE,
  reSID/reSIDfp/sidplayfp, Denise, Hoxs64, Frodo, Emu64, YAPE, plus4emu, Pi1541, 1541 Ultimate, the
  MiSTer cores, nibtools. VirtualC64 (MPL-2.0) is facts-only too unless D1 says otherwise (EXISTING OQ11).
- **Oracles, run and never read for design:** VICE 3.9+ (x64sc, xvic, xplus4, x128), sidplayfp. Only the
  observed results of Klive's own test programs are recorded, never generated code, never in CI (the Klive
  BASIC plan's D12 rule).
- **ROM annotations:** none in this plan. The commented C64 disassemblies already in `dev/research/`
  (`c64-rom.txt`, `c64_rom_disassembly.txt`) and any published one never feed Klive's sidecars or the
  emulator's landmarks (`dev/ai/rom-annotations/README.md`, D4). ROM landmarks (the READY prompt's key wait,
  the keyboard buffer) come from running the ROM in Klive's core.
- **Test material** follows its licence (D16): Lorenz's suite (public domain) and a sampled subset of
  Harte's 65x02 tests (MIT) may be committed; Dormann's tests (GPL-3), the full Harte set (~1 GB) and the
  VICE testprogs (no licence) are fetched into `.local/commodore/` and never committed.

### 0.2 ROMs (decision D2)
The research found **no grant to bundle** the Commodore ROMs (EXISTING §5, C64 §8); the owner of record,
Amiga Corporation (Cloanto), states they may be used only under licence. Until D2 is settled, everything
is built so that **no Commodore ROM is in the repository or the installer**:
- ROM sets are described by a manifest (`src/common/commodore/cbmRomSets.json`: id, part number, size,
  CRC32, SHA-1, the machines and models that use it), with hashes from the research pack (C64 §7, VIC20 §6,
  TED §5, C128 §7, DRIVE §7).
- The user imports ROMs once (a ROM manager dialog: a folder or files, matched by hash, copied into Klive's
  user data); a machine whose set is incomplete opens the dialog instead of starting.
- Developers and tests find ROMs in the git-ignored `.local/commodore/roms/` (filled by hand from the
  developer's own copies; `npm run cbm-roms:check` reports what is missing), through one function,
  `cbmRomFile(id)`, as tests find the Next ROMs through `nextRomFile()`.
- **Tests that need no ROM do not use one:** the fast tier runs bare machines and a **Klive-written test
  ROM** per machine (reset and interrupt vectors, a frame-interrupt handler, a "done" trap; Klive's own
  6502 source assembled by Klive's assembler, like the SAM's boot loader), so CI covers the hardware
  without Commodore code. Tests that boot the real KERNAL run where the ROMs are present (the developer's
  machine, the manual slow workflow if the author provides them privately) and skip with a message
  elsewhere.
- If D2 later grants bundling, only the manifest's "bundled" flag and the installer change.

### 0.3 Documents to read before working on this
- `src/emu/z80/wasm/README.md` and `dev/ai/wasm-core-debug.md` (the debug loop, the volatile-state rule,
  D1–D14, the traps T1–T11): the 6502 path must keep every rule there.
- `dev/plans/ENTERPRISE_PLAN.md` §18 and `dev/plans/SAM_COUPE_PLAN.md`: the newest machine plans, and
  `dev/ai/videoton-tvc.md` "Integration checklist" (every file a new machine touches).
- `dev/ai/zxnext-models.md`: model profiles (a C64 model is a profile of chip revisions, D3).
- `dev/ai/i18n-guide.md`, `dev/ai/ui-theming-intent-and-lessons.md`, `dev/ai/visual-tests-guide.md`,
  `dev/ai/doc-screenshots-guide.md`, `dev/ai/file-manager.md`.

---

## 1. Goals and non-goals

### Goals
1. **A shared 6502-family CPU** (6502, 6510, 8500, 8502, 7501/8501) in C, cycle-stepped, passing Tom
   Harte's per-cycle bus tests for all 256 opcodes, Dormann's functional test, Bruce Clark's decimal
   test and Lorenz's suite (CPU_6502_CORE.md).
2. **Klive's debugger working on it unchanged in behaviour:** breakpoints (execution, memory, conditions),
   step into/over/out, the call stack, execution history, profiling and coverage, reverse debugging,
   state files and `.klr` recordings, with in-core stops proven equal to per-instruction ones
   (CPU_NEUTRAL_DEBUGGING.md). **Several CPUs per machine** (C64 + 1541, C128's 8502 + Z80 + 1571).
3. **C64, all models** (C64.md §2): breadbin PAL/NTSC (6569R1/R3/R5, 6567R56A/R8), C64C (8565/8562,
   8580 SID, new CIA), SX-64, C64GS, Drean (6572), PAL-M (6573, with its timing as an open question),
   cycle-exact VIC-II, CIAs, SID 6581/8580, keyboard/joysticks/paddles/1351, Datasette (TAP), cartridges
   (CRT, the common types).
4. **An accurate 1541** (DRIVE_1541.md): the 1541/1541C/1541-II/SX-64 internal drive (and the 1540 for
   the VIC-20) running their DOS ROM on a second 6502, with VIAs, the bit-level read/write logic, half
   tracks, speed zones, D64 and G64 (and NIB/P64 read-only), fast loaders and common protections working.
5. **VIC-20** PAL/NTSC with every RAM configuration, sound, tape, cartridges, the 1540/1541 (VIC20.md).
6. **C16, C116, Plus/4** PAL/NTSC with the 3-plus-1 ROMs, tape and the 1541 (TED_C16_PLUS4.md).
7. **C128, C128D, C128DCR**: C128 mode, C64 mode, the Z80 and CP/M boot, the VDC with 16K/64K, the
   1571 (C128.md).
8. **IDE:** a Klive 6502 assembler (`.model C64 | VIC20 | C264 | C128`), Run/Debug/export (PRG, D64, TAP,
   CRT for the C64), project templates, machine panels (VIC-II, CIA, SID, VIA, TED, MMU, VDC, the drive),
   virtual keyboards, the file manager for D64/D71, ca65 integration with its debug info
   (IDE_INTEGRATION.md).

### Non-goals (possible follow-ups, §8)
- The 1581, the 1551, the 2031/IEEE-488 drives, the PET/CBM machines, the CBM-II, the C65.
- REU and GeoRAM (recorded in C64 §5; the DMA hook is designed so they can come later), freezer
  cartridges beyond Action Replay's basics, RS-232 user-port devices, printers, the parallel-cable
  speeders (SpeedDOS, Dolphin DOS) and JiffyDOS (commercial ROMs: a user ROM option only).
- KERNAL traps and "virtual drives" (VICE's fast non-hardware loading). Run uses injection (§3.6); disks
  always go through the true drive.
- Source-level debugging of a 6502 language (the shared Z80 back end and its source debugger stay Z80;
  ca65 `.dbg` line mapping is in scope as assembler source mapping only).
- A VICE binary-monitor server (EXISTING §6.2), BASIC compilers for these machines, cc65 C projects
  beyond running ca65/ld65 output.
- ROM annotations for any Commodore ROM.

---

## 2. Inventory: research → destination

| Topic | Research | Klive destination |
|---|---|---|
| 6502 family, bus sequences, interrupts, RDY/SO, decimal, undocumented, ports | CPU §1–§6 | `src/emu/m6502/wasm/m6502.c` (CPU_6502_CORE.md) |
| Debugger interaction (SYNC, JSR/RTS frames, BRK) | CPU §9 | `m6502-debug-*.c`, CPU_NEUTRAL_DEBUGGING.md |
| VIC-II timing, badlines, sprites, border, models | VIC-II §1–§9 | `c64/wasm/vic2.c` + cycle tables (C64.md §4) |
| PLA, banking, open bus, colour RAM | C64 §2 | `c64/wasm/c64-memory.c` |
| CIA 6526/8521 | C64 §3 | `common/wasm/cia6526.c` (C64 and C128) |
| Keyboard, joysticks, paddles, mouse | C64 §4; SID §5 | `c64-input.c`, host mappings |
| Cartridges, CRT | C64 §5 | `c64-cart.c`, `CrtFile.ts` |
| Tape, TAP | C64 §6; VIC20 §5; TED §4 | `common/wasm/cbm-tape.c`, `TapFile.ts` |
| ROMs, hashes, rights | C64 §7–§8; EXISTING §5 | `cbmRomSets.json`, the ROM manager (§0.2) |
| Program formats, autostart | C64 §9; VIC20 §6–§7; TED §5; C128 §7 | `src/common/commodore/codePlacement.ts` |
| SID | SID §1–§6 | `common/wasm/sid.c` (C64.md §6) |
| VIA 6522 | DRIVE §2; VIC20 §4 | `common/wasm/via6522.c` |
| 1541, disk surface, IEC, images, drive ROMs | DRIVE §1–§7, §9–§10 | `common/wasm/iec.c`, `drive1541.c`, `gcr-disk.c`, `D64/G64` readers (DRIVE_1541.md) |
| VIC 6560/6561, VIC-20 memory | VIC20 §2–§3 | `vic20/wasm/` (VIC20.md) |
| TED, C16/Plus/4 memory | TED §2–§3 | `c264/wasm/` (TED_C16_PLUS4.md) |
| C128 two CPUs, MMU, VDC | C128 §2–§5 | `c128/wasm/` (C128.md) |
| Tools, debug formats | EXISTING §6 | IDE_INTEGRATION.md §5 |

---

## 3. The architecture decisions in short

Each is argued in the part file named, and listed in §9 for acceptance.

### 3.1 A cycle-stepped CPU with an instance struct (D5; CPU_6502_CORE.md)
The VIC-II and the TED stall the CPU only on read cycles, after a 3-cycle warning (CPU §4); the 1541
signals bytes through SO (DRIVE §1); interrupts are polled on the second-to-last cycle (CPU §3). So the
CPU is **stepped one cycle at a time** and **publishes each cycle's bus request** (address, read/write,
SYNC) before the machine serves it, as floooh's `m6502.h` does (CPU §8.2). Unlike `z80.c`'s single
`static Z80State cpu`, the 6502's state is an **instance** (`M6502 *`), because a C64 with a 1541 runs two
of them and a C128 adds a Z80 beside its 8502.

### 3.2 One master tick per machine, chips stepped eagerly (D6)
The TVC's and Enterprise's lesson holds: eager stepping is cheap and exact.

| Machine | Master tick | In one tick |
|---|---|---|
| C64 | one φ0 cycle, split into φ1 and φ2 halves | VIC-II φ1 fetch + 8 pixels; CPU or VIC φ2 access; CIA and SID clocks |
| VIC-20 | one CPU cycle | VIC fetch (its own half) + 4 dots; CPU access; VIAs |
| C16/Plus/4 | half a TED single-clock cycle (4 dots) | TED; the CPU gets a cycle every 1 or 2 ticks (TED §7) |
| C128 | half a φ0 cycle | as the C64, plus the 8502's second access in 2 MHz mode or two Z80 T-states; the VDC caught up on access (C128 §10) |

The machine frame is a number of ticks; the debugger's "T-states" become the master tick count, and the
UI says which unit it shows (CPU_NEUTRAL_DEBUGGING.md §4).

### 3.3 The drive runs in lockstep, never ahead of the host (D7; DRIVE_1541.md §5)
The drive's 1 MHz is an independent crystal: the ratio to the host is an exact rational per model
(DRIVE §9). After each host master tick, the drive runs the cycles an exact rational accumulator yields
(0, 1 or 2). The CPUs meet only on the IEC lines, so this is exact to one drive cycle with no rollback.
VICE-style lazy catch-up is an optimisation for later, admitted only if an equivalence test proves the
machine state identical at every frame end.

### 3.4 The debugger becomes CPU-neutral without touching the Z80 cores (D8; CPU_NEUTRAL_DEBUGGING.md)
The shared C debug loop is already nearly neutral (its stop table, condition plan and `ExecuteUntilStop`);
the Z80-specific parts are the register exports, the history record, the profiler's call events, the
condition registers, and on the TypeScript side `Z80MachineBase extends Z80Cpu`, the `CpuState` union
without a discriminant and about ten places that construct a `Z80Disassembler` directly. The plan adds a
**`cpu` descriptor** to every machine, a 6502 counterpart of each Z80 module, and a CPU-neutral WASM
machine base, with **every Z80 core rebuilt byte-identical** as each step's gate.

### 3.5 A SID of Klive's own (D9; C64.md §6)
No high-accuracy SID is permissively licensed (SID §7). Klive writes its own: the **digital part cycle-exact
in every mode** (it is what the CPU reads), the **analog part** (DACs, filters, the board's external
filter, band-limiting) separable and switchable in quality, validated against sidplayfp/reSIDfp as an
oracle on Klive-written register sequences.

### 3.6 Run injects; disks always use the true drive (D11; IDE_INTEGRATION.md §4)
Run/Debug boots to the READY prompt (a landmark found by running the ROM), places the program in RAM,
fixes the BASIC pointers (C64 §9.5) and types `RUN` (or starts at `SYS` address) through the keyboard
buffer: fast and deterministic, the ZX81/TVC pattern. "Run from disk" builds a D64 holding the program and
types `LOAD"*",8,1` through the real 1541, which also proves the drive. Export writes PRG, D64, TAP and
(C64) CRT.

### 3.7 Machine IDs and models (D3)
| Machine ID | Display name | Models (profiles) |
|---|---|---|
| `c64` | Commodore 64 | `c64-pal` (default: breadbin 6569R3, 6581, old CIA), `c64-pal-r1`, `c64-ntsc` (6567R8), `c64-ntsc-old` (6567R56A), `c64c-pal` (8565, 8580, new CIA), `c64c-ntsc` (8562), `sx64` (PAL, internal drive, no Datasette), `c64gs`, `c64-drean` (6572), `c64-palm` (6573, provisional) |
| `vic20` | Commodore VIC-20 | `vic20-pal` (default), `vic20-ntsc`; RAM blocks as machine config (`MC_VIC20_RAM`: 3K, BLK1, BLK2, BLK3, BLK5) |
| `c264` | Commodore 16 / Plus/4 | `plus4-pal` (default), `plus4-ntsc`, `c16-pal`, `c16-ntsc`, `c116-pal` |
| `c128` | Commodore 128 | `c128-pal` (default), `c128-ntsc`, `c128d-pal`, `c128dcr-pal`, `c128dcr-ntsc` (8568 VDC, 64K VDC RAM) |

A model is a **profile of chip revisions and options** (`src/emu/machines/commodore/c64/c64Profiles.ts`,
the Next pattern): VIC-II revision, SID model, CIA type, glue logic, KERNAL revision, which peripherals
exist (C64 §1). Drives are machine config (`MC_CBM_DRIVE8`: none, 1541, 1541-II, 1571 on the C128;
`MC_CBM_DRIVE9`), not models.

---

## 4. Phases and exit criteria

Every phase leaves the Z80 cores byte-identical, `test:fast` green and, from Phase 3 on, a running
machine. Each machine milestone (M1–M4) is shippable on its own (D14).

| Phase | Content | Exit criteria |
|---|---|---|
| **0. Decisions and ground** | Settle D1–D16. Remove the old TypeScript C64 (D4, its own commit, every wiring point listed in CPU_NEUTRAL_DEBUGGING.md §6). `cbmRomSets.json`, `cbmRomFile()`, `npm run cbm-roms:check`. Fetch scripts for the test material into `.local/commodore/` (`npm run cbm-tests:fetch`). Settle EXISTING OQ5 (CLK headers) and OQ11 (MPL). | Decisions recorded; the old C64 gone with `build:check`, `lint:renderer`, `test:fast` and the Vite build green; ROM and test-material scripts working. |
| **1. The 6502 core** | `m6502.c` (CPU_6502_CORE.md): all opcodes cycle by cycle, interrupts, RDY, SO, ports per variant, ANE/LXA constants, JAM. A test-only bare machine (64K RAM, the core) in `test/harness/m6502/`. | Harte's committed subset in the fast tier and the full set via `npm run test:slow` with 0 mismatches; Dormann functional and Bruce Clark decimal pass; `benchmark:m6502` > 50 M cycles/s. |
| **2. CPU-neutral debugger** | CPU_NEUTRAL_DEBUGGING.md: the `cpu` descriptor, the 6502 debug modules (exports, history, profile, conditions), the neutral WASM machine base, the 6502 register panel and disassembler, step-over/out and the call stack for JSR/RTS/interrupts, multi-CPU addressing in the debug API. Proven on the bare machine. | `debug-loop-equivalence` covers the bare 6502; history, profile, reverse and state suites accept a 6502 core; every Z80 core byte-identical; budgets (wasm-core-debug D14) met on the bare core. |
| **3. C64 skeleton (M1 starts)** | `c64.c` TU: the master tick, PLA and banking, CIAs, keyboard, the VIC-II's text modes on the real cycle table (no sprites yet), ROM upload, the frame loop, host, adapter, registry entry for `c64-pal` (hidden behind the dev "experimental machines" setting until M1 ships). Harness `test/harness/c64/` with `bootToBasic()`. | Boots to READY on the real ROMs; the Klive test ROM runs in CI; typing in BASIC in the running app. |
| **4. VIC-II exact** | C64.md §4: badlines, BA/AEC, sprites, collisions, borders, all modes, the light pen, the per-revision flags, the palette stage. | VICE testprogs' VIC-II tests at the pass rate recorded in Phase 0 as the target (C64.md §9); demo effects (FLI, open borders, sprite multiplexing) seen by eye. |
| **5. CIA, input, SID** | C64.md §5–§6: CIA exactness (old/new), TOD, serial register; joysticks, paddles, 1351; the SID digital part, then the analog part. | Lorenz's suite passes (needs the KERNAL; local); CIA testprogs at target; SID register-sequence comparisons against sidplayfp within the tolerances C64.md §6.4 sets; heard by ear. |
| **6. IEC and the 1541** | DRIVE_1541.md: `iec.c`, `via6522.c`, the drive core, the bit-level disk, D64/G64, the lockstep scheduler, LED/motor/head sounds off by default. | LOAD/SAVE/directory through the real DOS; the drive testprogs at target; three fast loaders (Krill's, Spindle, Bitfire) and a G64 protection test load; the scheduler equivalence test. |
| **7. C64 IDE** | IDE_INTEGRATION.md: the assembler, Run/Debug/inject, exports, templates, panels (VIC-II, CIA, SID, drive), virtual keyboard, tape (TAP), CRT cartridges, file manager for D64, state files, history/profile/reverse on both CPUs, ca65 integration. | A new C64 project runs and debugs; the cross-core suites list `c64`; CLI `klive run --machine c64`. |
| **8. All C64 models; ship M1** | The remaining profiles (C64.md §2), SX-64's internal drive, C64GS, Drean, PAL-M provisional; docs and changeset for the C64. | Each model boots; per-model VIC-II testprogs; M1's gates (§4.1). |
| **9. VIC-20 (M2)** | VIC20.md: VIC chip video and sound, RAM blocks, VIAs, tape, cartridges, the 1540/1541 on the shared drive. | `bootToBasic` for every RAM configuration; VIC-20 testprogs at target; a fast loader; ship M2. |
| **10. C16/C116/Plus/4 (M3)** | TED_C16_PLUS4.md: the TED, the variable CPU clock, banking, 3-plus-1, ACIA, TAP v2, the 1541 via the CPU port. | `bootToBasic` per model; TED tests at target; the 3-plus-1 suite starts; ship M3. |
| **11. C128 (M4)** | C128.md: 8502 at 1/2 MHz, the Z80 from `z80.c` with the C128 hooks, MMU, VIC-IIe, VDC, C64 mode, the 1571 (GCR on the 1541 logic, MFM on `wd1793.c`'s 1770 variant), burst mode, two-CPU debugging. | Boots through the Z80 stage to C128 mode; C64 mode; CP/M boots from a user-supplied disk; the VDC tests; ship M4. |
| **12. Close** | `dev/ai/commodore.md` (decisions, as-built notes, open items), an AGENTS.md section, the Under the Hood articles, the landing page and competitive analysis, lessons in `dev/ai/wasm-migration-intent-and-lessons.md`. `npm run test:slow`. | All gates green; the plan marked closed. |

### 4.1 Gates of every machine milestone
`build:check`, `lint:renderer`, `i18n:check`, `test:fast`, `test:slow`, the Vite build, `doc:build` +
`doc:check`; the benchmark above 10× real time with the drive attached; the machine checked in the built
app (boot, Run, Debug, a disk, a tape); the changeset (D14).

---

## 5. Tests (shape; each part file has its own list)

- **Harnesses:** `test/harness/m6502/` (bare CPU), `test/harness/c64/`, `vic20/`, `c264/`, `c128/`, each with
  `bootToBasic(model)`, `typeText`, `runFrames`, `runTo`, `step`, `peek`/`poke`, chip state readers, and
  a bare machine (the Klive test ROM). READMEs like the SAM's and the Enterprise's.
- **Hardware tests:** `test/m6502-hw/`, `test/c64-hw/`, `test/drive-hw/`, `test/vic20-hw/`, `test/c264-hw/`,
  `test/c128-hw/`, listed in `build/e2e-tests.ts`; any file over 20 s moves to the slow tier.
- **External suites** (D16): Harte (subset committed, full fetched), Dormann, Clark, Lorenz, the VICE
  testprogs (fetched, run by a Klive driver that reads each test's result protocol: the debug cartridge
  register or the border/screen convention, EXISTING §3.1). Pass lists are recorded per machine in the
  core README and only ever grow.
- **Oracle runs** (manual): VICE and sidplayfp on Klive's own programs; recorded in the core READMEs.
- **Pictures** are pinned by hashes only after they were checked by eye (`C64_SHOTS_PNG=<dir>` etc.).
- **Cross-core suites** list each new core (the list in CPU_NEUTRAL_DEBUGGING.md §5).

---

## 6. Open hardware questions

Each becomes one constant with its default and reason in the core README; none blocks a phase. The part
files list them: C64.md §10, DRIVE_1541.md §9, VIC20.md §7, TED_C16_PLUS4.md §7, C128.md §8.

---

## 7. Risks

- **ROMs (D2).** Without a grant, users must bring ROMs; first-run friction and CI coverage are the cost.
  Mitigation: the Klive test ROMs (§0.2), the import dialog, and an early letter to Amiga Corporation.
- **The debugger refactor touches every core's host path.** Gate: byte-identical Z80 cores and the
  existing cross-core suites unchanged; the TypeScript split goes in small commits behind the existing
  tests (CPU_NEUTRAL_DEBUGGING.md §7).
- **Performance of cycle stepping.** A cycle-stepped CPU plus a cycle-exact VIC-II plus a second CPU plus a
  16 MHz disk process must stay above 10× real time in WASM. Phase 1 measures the CPU alone; Phase 6
  measures the full C64 with a drive; the analog SID and the drive's idle optimisation are the levers.
- **SID fidelity from scratch.** The 6581 filter is the hardest model in the plan; its quality is judged
  against an oracle and by ear, and it is staged (digital exact first).
- **Undocumented behaviour is chip-dependent** (ANE/LXA, port fade, CIA revisions, VIC-II colour latency):
  one constant per question, named in the profile, so a measurement changes data, not code.
- **Scope.** Four machines and four drives' worth of chips. The milestones are independent so the C64 can
  ship without the others; the C128 (two CPUs, VDC) is last because it depends on everything.
- **Provenance mistakes in permissive code** (VICE-derived constants in MAME or CLK). Every port records the
  upstream file and commit, and the review checks the provenance notes of §0.1.

---

## 8. Follow-ups (not in this plan)
- The 1581 (WD1772 on the shared `wd1793.c`), the 1551 (TCBM), parallel-cable speeders.
- REU 17xx and GeoRAM, freezer cartridges in full, EasyFlash writing.
- VICE binary-monitor compatibility (VS64 and other tools debugging Klive's cores).
- KickAssembler, ACME and 64tass integrations beside ca65; llvm-mos projects.
- ROM annotations, if D2 ever allows shipping a ROM.
- PET/CBM, CBM-II, C65.

---

## 9. Decisions (proposed, for the project author)

- **D1 — provenance** (§0.1). *Recommendation:* Klive's own code; MAME (per file, BSD-3), Clock Signal (MIT,
  after OQ5) and floooh (zlib) readable and portable in named pieces with notices; the listed traps never
  ported; GPL/MPL sources facts-only; VICE and sidplayfp as oracles.
- **D2 — ROMs** (§0.2; EXISTING §5.7 options A–D). *Recommendation:* **C, user-supplied ROMs**, with the
  manifest, the import dialog and Klive test ROMs for CI, **and in parallel option A**: the author asks
  Amiga Corporation for a written licence to distribute the C64, VIC-20, C16/Plus/4, C128 and 1541/1571
  ROMs with Klive (MIT, free of charge, unmodified). Option D (MEGA65 Open ROMs as a C64 fallback) is a
  follow-up: it cannot drive a true 1541 and its BASIC is incomplete. Option B (bundling without
  permission) is not recommended: unlike the SAM Coupé there is no grant to quote, and the owner says the
  opposite.
- **D3 — machine IDs and models** (§3.7): four IDs, `c64`, `vic20`, `c264`, `c128`; models as chip
  profiles; drives as config. *Recommendation: yes.*
- **D4 — remove the old TypeScript C64** (the machine, the 6510 CPU, its panels, the 6510 assembler and
  disassembler, the `.6510.asm` file type, the four C64 ROM files in `src/public/roms/`, their tests and
  docs mentions) in Phase 0, its own commit. *Recommendation: yes*: it is a second, interpreted C64 that
  the WASM core replaces, its machine ID is the one the new core takes, and `src/public/roms/c64-*.rom`
  are Commodore ROMs in the repository today, which D2 says should not be there.
- **D5 — the CPU core** (§3.1): cycle-stepped, instance-based, Klive's own C written from the research
  (floooh's pin-mask design as the readable reference). *Recommendation: yes.*
- **D6 — time base** (§3.2). *Recommendation: yes.*
- **D7 — drive scheduling** (§3.3): lockstep with an exact rational accumulator; lazy catch-up only behind
  an equivalence test. *Recommendation: yes.*
- **D8 — CPU-neutral debugging** (§3.4): a `cpu` descriptor, 6502 counterparts of the Z80 debug modules,
  a neutral WASM machine base, multi-CPU addressing in the debug API (a "debug target" CPU per machine,
  switchable in the UI). *Recommendation: yes.*
- **D9 — SID** (§3.5): Klive's own; digital exact; analog staged. *Recommendation: yes.*
- **D10 — the assembler** (IDE_INTEGRATION.md §3): a **new Klive 6502 assembler** on `compiler-common`,
  with the Klive Z80 assembler's syntax and directives where they apply, `.model` per machine, and **ca65
  integration** (zlib, with `.dbg` source mapping) as the external toolchain. *Recommendation: yes*;
  KickAssembler/ACME/64tass are follow-ups.
- **D11 — Run and export** (§3.6). *Recommendation: yes.*
- **D12 — drives in scope:** the 1541 family and the 1540 in this plan; the 1571 in the C128 milestone;
  the 1581 and 1551 later (§8). *Recommendation: yes.*
- **D13 — order:** C64 first, then VIC-20, C16/Plus/4, C128. *Recommendation: yes*: the C64's VIC-II and
  drive shape the CPU's RDY and the scheduler, which the others then reuse; the VIC-20 would be an easier
  first machine but would not test those designs.
- **D14 — shipping:** each machine milestone ships with its own `feature` changeset and docs, as a
  completed sub-plan (AGENTS.md "Changesets"); phase commits carry none. *Recommendation: yes.*
- **D15 — palettes:** Klive computes its own palettes from published measurements and models (Pepto's
  and colodore's methods for the VIC-II, the TED's 16 × 8 luminance model), recorded as facts; no
  VICE-derived palette file is reused. *Recommendation: yes.*
- **D16 — test material** (§0.1, §5). *Recommendation: yes.*
