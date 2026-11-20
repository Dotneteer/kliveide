# SAM Coupé on the WASM Core — Implementation Plan

**Status:** Draft (2026-11-18; ROM rights updated 2026-11-20). Nothing implemented. Decisions D1–D10
(§16) are **proposed** and wait for the project author. D3 (ROM rights) is settled by Andy Wright's
2008 grant (§16).
**Input:** the research pack `dev/research/sam-coupe/`. Read these first:
- `README.md`: the machine at a glance, the disagreements table and the ROM position;
- `ASIC_VIDEO_MEMORY_TIMING.md` §1–§5 (the frame, paging, modes, **contention**, interrupts) and §8;
- `SOUND_INPUT_IO.md` §1 (the SAA 1099), §3–§5 (keyboard, mouse, tape);
- `STORAGE_FIRMWARE_SOFTWARE.md` §2.3 (ROM rights), §3.2 (boot), §4 (disk), §6 (loading code);
- `EXISTING_EMULATORS.md` §1 and §10.

The pack holds no downloaded documents and no third-party source yet. Its "Reference documents" lists
say what to fetch (Phase 0, with permission).

**Shape of the result:** one new C translation unit that `#include`s the shared Z80 core
`src/emu/z80/wasm/z80.c`, as the ZX81, the HT-1080Z, the TVC and the Enterprise do. No second CPU, no
copy of `z80.c`, no TypeScript SAM machine. **The Enterprise is the template** (`dev/plans/ENTERPRISE_PLAN.md`,
its §18 record and `src/emu/machines/enterprise/wasm/README.md`): the newest core, with paging, a
stereo sound chip, a disk card on the shared WD1793, a host-side program loader and the full IDE wiring.
The SAM is simpler in two places — **one clock** (the CPU and the ASIC both come from the 24 MHz
crystal, so there is no rational phase and no half-T clock) and **a Spectrum-like contention model** —
and harder in one: **there is no permissively licensed SAM emulator to port from**.

---

## 0. Ground rules

### 0.1 Licence and provenance (decision D1)
- **The default is Klive's own code**, written from the hardware facts in the research pack, the
  Technical Manual and Simon Owen's published measurements (recorded in Klive's words; the pages carry
  no licence, so their tables are never copied, only cited as facts).
- **Portable (with notices in `THIRD_PARTY_NOTICES.md`):**
  - **SAASound** (BSD-3, © Dave Hooper and Simon Owen) for the SAA 1099: the model SimCoupé uses,
    tuned against a real chip (SOUND §1.7). Ported from C++ to C into the core; derived files keep the
    copyright lines and name the upstream file. MAME's `saa1099.cpp` (BSD-3) is the second view where
    they disagree (SOUND §1.5).
  - **SAMdisk** (MIT, Simon Owen) and **mgtdisklib** (MIT) for disk-image containers and the SAM
    directory format (TypeScript side); MAME's `coupe_{mgt,sad,sdf}.cpp` (BSD-3) as an alternative.
  - The floppy controller is Klive's own `src/emu/machines/common/wasm/wd1793.c`.
- **GPL and unlicensed sources are not read for design and no code is taken:** SimCoupé (GPL-2.0+, and
  its derivatives SamCoupeWeb, libretro, PSPSIM), **MAME's `samcoupe.cpp` and `bus/samcoupe/*`
  (GPL-2.0+, not BSD)**, ZEsarUX (GPL-3+), the MiST/MiSTer cores (GPL), pyz80 (GPL-2.0). The research pack
  records the facts it needed from them, with citations; the implementation works from the pack.
  **The ZX-Uno core has no licence at all**: nothing beyond the pack's notes.
- **Running** SimCoupé 1.2.17 as a behavioural oracle is allowed (the Klive BASIC plan's D12, the
  Enterprise's D1): only the observed results of Klive's own test programs are recorded, never generated
  code, and never in CI. The MiSTer core is a second opinion if someone runs it on hardware.
- **ROMs: settled, decision D3** (§16): bundled under Andy Wright's 2008 grant, which names the ROMs
  ("all my SAM Coupé titles (including ROMs)… freely (re)distributed"). Recorded in
  `src/public/roms/sam-roms-readme.txt`.
- **ROM annotations:** none in this plan. A published annotated ROM 3.0 disassembly exists
  (worldofsam); under `dev/ai/rom-annotations/README.md` rule D4 it is **never fetched into the repository
  or read for this work**. Facts the emulator needs from the ROM (the memory-size probe, the boot and
  editor landmarks, the system variables' values after boot) come from running the ROM in Klive's core.
  System-variable *names* come from MGT's Technical Manual, not from SimCoupé's GPL `samrom.map`
  (STORAGE OQ6).

### 0.2 Reuse rules for the CPU
From `dev/ai/wasm-migration-intent-and-lessons.md` ("Shared CPU Intent") and the Enterprise's §0.2:
- The machine configures `z80.c` through `#define Z80_*` hooks before the `#include` and never forks it.
- **No new hook is expected.** `Z80_DELAY_MEMORY_READ` / `_WRITE` and `Z80_DELAY_OPCODE_FETCH` own a
  cycle's whole 3 (or 4) T (`delayMemoryRead` in `z80.c` calls the hook *instead of* `tactPlusN(3)`), so
  the SAM hook adds its wait states at T2, where the hardware samples /WAIT (kosarev/z80 issue #10, a
  logic-analyser trace; EXISTING §2). `Z80_DELAY_PORT_READ` / `_WRITE` and their `_TAIL` variants
  place the I/O wait at TW. `Z80_TACT_PLUS_N` drives the ASIC; `cpu.interruptVector` sets the IM 2 bus
  value.
- If one is still needed, it goes in as its own phase, compiled only under `#ifdef`, with every existing
  core rebuilt **byte-identical** first (the TVC's H1 rule).

### 0.3 Documents to read before working on this
- `src/emu/z80/wasm/README.md` (hooks, the debug loop, the volatile-state rule).
- `src/emu/machines/enterprise/wasm/README.md` and `dev/plans/ENTERPRISE_PLAN.md` §18: the template.
- `dev/ai/videoton-tvc.md` "Integration checklist" (every file a new machine touches).
- `dev/ai/wasm-v2-machine-migration-guide.md`, `dev/ai/wasm-migration-intent-and-lessons.md`.
- `dev/ai/i18n-guide.md`, `dev/ai/ui-theming-intent-and-lessons.md`, `dev/ai/visual-tests-guide.md`,
  `dev/ai/doc-screenshots-guide.md`, `dev/ai/file-manager.md` (the MGT file system, §10.4).

---

## 1. Goals and non-goals

### Goals
1. **SAM Coupé 512K with ROM 3.0/3.1**, booting through the memory test to the copyright screen and SAM
   BASIC, with keyboard, colour picture and stereo sound. A **256K** model as the second model.
2. **ASIC at the precision the research established:**
   - the 384 × 312 T frame (119 808 T, 50.08 Hz), one clock, no drift;
   - modes 1–4 rendered per 8-T cell from the registers *at that cell*, so mid-line palette, border,
     mode and VMPR changes land where the hardware puts them;
   - the CLUT and the 128-colour palette, the mode-3 pixel swap, BRIGHT as CLUT 8–15, FLASH every 16
     frames, SOFF in modes 3/4;
   - the ATTR, LPEN and HPEN reads (beam position, the last screen attribute in the border);
   - frame and line interrupts as live STATUS pulses.
3. **Contention:** internal RAM 1-in-4 in the border and 1-in-8 in the screen, the mode-1 stripes, SOFF,
   ASIC ports F8h–FFh 1-in-8, ROM and external RAM never; matching Owen's measured instruction timings.
4. **Sound:** the SAA 1099 (6 tones, 2 noise, 2 envelopes, stereo) and the beeper, through Klive's audio
   mixer with per-source gains and taps.
5. **Disks:** two VL1772 drives on the shared WD1793 (a 1772 variant), `.mgt`/raw `.dsk` (gzipped or
   not), `.sad`, EDSK `.dsk` and `.sbt` images, F9/`BOOT` booting the DOS on the disk.
6. **Program loading:** a Klive-written boot loader (§9.3) so Run/Debug and `.mgt` export work **without
   bundling SAMDOS**.
7. **IDE:** debugger and disassembler (RST 8 hooks), page-aware memory views, ASIC and SAA panels,
   virtual keyboard, SysVars, machine states, history, profiling, reverse debugging, as the other WASM
   cores have.
8. **Assembler:** `.model SAMCOUPE`, Run/Debug, `.mgt` and `.sbt` export, a project template.
9. **Tape** (a later phase): TZX/TAP/CSW/WAV through Klive's existing tape player, at 6 MHz timing.
10. **Mouse and joysticks:** the MGT mouse on FFFEh and both Interface 2 joysticks.

### Non-goals (possible follow-ups, §15)
- External memory packs beyond one config switch (Phase 9 adds 1 MB packs; the TopGun demo needs one).
- Atom / Atom Lite IDE and `.hdf`, B-DOS records, Trinity, the S D Software IDE, the SAMBUS and Dallas
  clocks, MIDI devices (the ports and the STATUS bits exist; nothing is attached), printer, Comms
  interface, Messenger, the light pen itself (the pen ports report the beam).
- The ASIC's mode-change artefact cell (ASIC §3.7, OQ16): only SimCoupé models it, from unpublished test
  results. Default: no artefact, one switch in the renderer.
- The SAM Élite (ROM 3.5), ROMs before 3.0, the ATOM/AL BOOT ROMs.
- Spectrum mode (running a 48K ROM on the SAM), `.z80` snapshots for the SAM.
- A PAL composite model: RGB only.
- Klive BASIC, Boriel BASIC or z88dk targeting the SAM.

---

## 2. Inventory: what the research pack gives and where it goes

| Topic | Source in `dev/research/sam-coupe/` | Klive destination |
|---|---|---|
| Clocks, frame, line layout, `hc`/`vc` | ASIC §1 | `sam.c`, `sam-timing.c` |
| LMPR/HMPR/VMPR, page wrap, write protect, external memory | ASIC §2.1–§2.5 | `sam-memory.c` |
| Missing RAM, power-on RAM, reset values | ASIC §2.6–§2.8 | `sam-memory.c`, `sam.c` |
| Modes 1–4, attributes, mode-3 swap, CLUT, palette levels | ASIC §3.1–§3.4 | `sam-video.c` |
| Border, SOFF, ATTR, LPEN/HPEN | ASIC §3.5–§3.9 | `sam-video.c`, `sam-ports.c` |
| Contention rules, Owen's timings, sampling point | ASIC §4 | `sam-timing.c` |
| Frame/line/MIDI interrupts, STATUS | ASIC §5 | `sam-asic.c` |
| Port map, KEYBOARD read | ASIC §6; SOUND §7 | `sam-ports.c` |
| SAA 1099 | SOUND §1; SAASound (BSD-3) | `sam-saa.c` |
| Beeper, MIC | SOUND §2 | `sam-audio.c` |
| Keyboard matrix, joysticks | SOUND §3 | `sam-keyboard.c`, `SamKeyCode.ts` |
| Mouse | SOUND §4 | `sam-mouse.c` |
| Tape hardware and the ROM's format | SOUND §5 | `sam-tape.c`, `SamTapeFile.ts` |
| ROMs, versions, CRCs, rights | STORAGE §2 | `src/public/roms/sam-*.rom`, `sam-roms-readme.txt`, `SamRoms.ts`, §16 D3 |
| Boot sequence, landmarks, jump table, sysvars | STORAGE §3 | §9.3 loader, §11 debugger, `SamSysVars.ts` |
| VL1772 ports, directory, file header, images | STORAGE §4 | `sam-fdc.c` on `common/wasm/wd1793.c`, `SamDiskImage.ts`, `mgtfs.ts` |
| Loading code without a disk, user code placement | STORAGE §6 | §12 |
| Assemblers, developer expectations | STORAGE §7 | §12 export formats |
| Test software | STORAGE §8; EXISTING §9 | oracle runs only (licences per title) |

---

## 3. The design problems

### 3.1 One clock, a frame that starts at the frame interrupt (decision D4)
The CPU (24 MHz / 4) and the ASIC's cell counter (8 T) run from the same crystal, so the time base is
**whole T-states** and the raster position is a pure function of the frame tact: `hc = t % 384`,
`vc = (t / 384 + 244) % 312` (ASIC §1.4).
- **The machine frame starts at the frame interrupt** (`vc` 244, `hc` 0), as the Spectrum cores' frames
  start at theirs. Interrupt timing then never depends on a frame boundary, and the debugger's
  "frame tact" means the same as SimCoupé's frame cycle, which makes oracle comparisons direct.
- **The ASIC steps eagerly, one cell (8 T) at a time, inside `Z80_TACT_PLUS_N`** (the TVC's and
  Enterprise's lesson: eager stepping is cheap and exact): 48 cells × 312 lines ≈ 15 000 cell steps per
  frame. A cell step fetches and renders 16 pixel clocks, raises or drops the interrupt pulses, and
  steps the mouse timeout and MIDI timers.
- The frame overshoot (an instruction that ends past 119 808) carries into the next frame.

### 3.2 Contention (decision D5)
The rules are settled by measurement (ASIC §4.2): internal RAM accesses are held to **one in every 4 T
in the border and one in every 8 T in the screen area** (lines 0–191, from 4 T before the screen
fetch); **mode 1 adds 64-T stripes** every 128 T across the whole line, border included; **SOFF** (modes
3/4) makes the whole frame border; **ASIC ports F8h–FFh are one in every 8 T**, always; ROM and external
RAM are never held. What is not settled is *where in the machine cycle* the ASIC samples the request
(ASIC OQ4) and the mode-1 stripe phase (OQ2).
- **Proposal:** a closed-form wait, not a table: `wait = (mask − ((t + SAM_MEM_PHASE) & mask))` with
  `mask` 3 or 7 from the region test, applied at T2 of the cycle. `SAM_MEM_PHASE`, `SAM_IO_PHASE`,
  `SAM_SCREEN_CONTENTION_LEAD` (4 T) and `SAM_MODE1_STRIPE_PHASE` are **named constants in one table**,
  defaulting to the values that reproduce Owen's published instruction timings (ASIC §4.3, §4.5).
  The region test is per page flag (`internal RAM`) and per cell, so the hot path is one compare and one
  mask.
- Which cycles: M1 fetches and data reads and writes are held alike (Owen's NOP = 8 T on screen). The
  refresh cycle is not (one constant, recorded in the README). The interrupt acknowledge is not held
  (open; one constant).
- **Proof (§13):** Klive-written timing loops of the instructions in Owen's table, in border and screen,
  in modes 1–4 and with SOFF, with code and data in internal RAM, ROM and external RAM, measured with the
  line interrupt. The test expectations are the published values, cited as facts. Oracle runs in
  SimCoupé record the same programs' totals and border-bar pictures in the core README.

### 3.3 The picture (decision D6)
The ASIC's pixel clock is 12 MHz: a mode-3 pixel is one clock, a mode 1/2/4 pixel two.
- **Render at the 12 MHz clock**, so mode 3 needs no special path and mixed-mode screens (a line
  interrupt switching between mode 4 and mode 3) keep their pixels.
- **TV window: 640 × 288** — 256 T of screen plus 32 T of border each side (`hc` 96–127 and 0–31, one
  constant), and 48 lines above and below the screen. The sources disagree on the blanking (ASIC §1.2,
  OQ3): the constants follow ZX-Uno/MIST's unblanked area and are one line of code to widen.
- Aspect ratio against Klive's square 7 MHz Spectrum pixel: 7 / 12 ≈ 0.583 (the TVC/Enterprise rule).
- **Beam position:** `getBeamPosition`, `BEAM_POSITION_MACHINE_IDS`; line-interrupt palette and mode
  splits are the SAM's main raster trick.

### 3.4 Running code without a DOS licence (decision D7)
The ROM boots nothing by itself; F9/`BOOT` loads track 4 sector 1 into the page below the screen at
8000h and jumps to 8009h if bytes 256–259 say "BOOT" (STORAGE §3.2). Everything after that is the DOS on
the disk — SAMDOS, whose rights are unknown (STORAGE §2.3, OQ2).
- Andy Wright's 2008 grant (D3) covers his DOSes too (MasterDOS; and SAMDOS if it is his: MGT
  contracted him for "the ROM and DOS", while Spectrum Computing credits SAMDOS to Bruce Gordon,
  STORAGE OQ2). Even so, Run should not depend on which DOS a user has, and an exported disk should boot
  with nothing else on it.
- **Proposal: a Klive-written boot loader**, as the Enterprise got its own `FILE:` ROM: Z80 source in the
  repository (`src/public/sam/sam-klive-boot.asm`), built to a boot file by Klive's own assembler in a
  script, with a test that the shipped image matches the source.
  - It is the first file of the disk, carries the "BOOT" tag, and **loads the program file(s) that follow
    it through the VL1772 itself** (a small sector reader walking the MGT link bytes), pages them as the
    file header says, sets the stack and jumps to the entry point. No DOS stays resident.
  - Run and Debug build an in-memory MGT image (loader + program) and press F9 at the copyright screen,
    so the ROM's own boot and the emulated controller do the work (the TVC's lesson: make the ROM do it).
  - Export writes the same image as `.mgt`, bootable on a real SAM or in SimCoupé.
- The alternative, injecting the code after the copyright screen and setting the paging and PC by hand,
  is kept as the **fast path for unit tests** and for `klive run` without a disk (§12), not for Run.

---

## 4. Architecture and file layout

### 4.1 C (one artifact; the model chosen at run time)
```
src/emu/machines/samcoupe/wasm/
  README.md                 build, ABI, exports, the hardware model (the Enterprise README's shape)
  SamWasmV2Loader.ts
  dist/sam.wasm
  sam/
    sam.c                   the TU: state, Z80_* hooks, #include z80.c, frame loop, exports, debug loop,
                            condition evaluator, history, profile
    sam-memory.c            32 internal pages, ROM0/ROM1, LMPR/HMPR, write protect, external packs,
                            missing pages, peek/poke
    sam-ports.c             the I/O decode (16-bit where the high byte matters), unmapped reads
    sam-timing.c            the cell stepper, the contention waits, the region flags
    sam-asic.c              STATUS, frame/line pulses, LINE register, MIDI timers, reset
    sam-video.c             modes 1-4, CLUT, palette, border, SOFF, FLASH, ATTR, LPEN/HPEN
    sam-saa.c               the SAA 1099 (ported from SAASound, BSD-3)
    sam-audio.c             beeper, SAA catch-up, mixing to stereo, the audio-channels taps
    sam-keyboard.c          the 9-row matrix, F9h bits 5-7, joysticks
    sam-mouse.c             the 9-nibble protocol and its timeout
    sam-tape.c              EAR/MIC, the tape player, motor-less play (Phase 8)
    sam-fdc.c               two VL1772s on common/wasm/wd1793.c (WD1793_VARIANT 1772)
dev/scripts/build-sam-wasm.cjs (+ .d.cts)
dev/scripts/check-sam-wasm-size.cjs
dev/scripts/benchmark-sam-wasm.cjs
```

The hook block in `sam.c` (names illustrative):

```c
#define Z80_EXTERNAL_BUS 1
#define Z80_READ_MEMORY(a)          samReadMemory(a)
#define Z80_WRITE_MEMORY(a, v)      samWriteMemory(a, v)
#define Z80_READ_PORT(a)            samReadPort(a)
#define Z80_WRITE_PORT(a, v)        samWritePort(a, v)
#define Z80_DELAY_MEMORY_READ(a)    samDelayMemory(a, SAM_CYCLE_READ)    /* 3 T + ASIC wait at T2 */
#define Z80_DELAY_MEMORY_WRITE(a)   samDelayMemory(a, SAM_CYCLE_WRITE)
#define Z80_DELAY_OPCODE_FETCH(a)   samDelayMemory(a, SAM_CYCLE_M1)
#define Z80_DELAY_PORT_READ(a)      samDelayPort(a)                      /* F8h-FFh: 1 in 8 at TW */
#define Z80_DELAY_PORT_WRITE(a)     samDelayPort(a)
#define Z80_TACT_PLUS_N(n)          samAdvanceTacts(n)                   /* cell stepper */
#include "../../../../z80/wasm/z80.c"
```

The memory map is a 4-entry table of page pointers plus per-section flags (ROM, internal, external,
write-protected, missing), refreshed on LMPR/HMPR and 80h/81h writes, so the hot path is one table look-up
and one flag test.

### 4.2 TypeScript (the Enterprise pattern)
```
src/emu/machines/samcoupe/
  SamWasmHost.ts            abstract host: keys, typer, partitions, sysVars, injection flow
  SamWasmV2Machine.ts       the adapter: registers proxied to the core, screen, audio, disks, tape, state,
                            IExecutionHistorySource, IAccessProfileSource
  SamMachineFactory.ts
  samMachineInfo.ts         models (§4.3), clocks, ROM ids
  SamRoms.ts                ROM sets per model (name, size, CRC32), the user-ROM setting (D3)
  SamKeyCode.ts             the matrix keys and their legends
  SamKeyMappings.ts         host key -> matrix
  SamTyper.ts               auto-type
  SamDiskImage.ts           .mgt/.dsk (raw, gzip), .sad, EDSK, .sbt -> the canonical layout and back
  SamDisks.ts               the two drives, write-back as whole images
  SamTapeFile.ts            TZX/TAP/CSW recognition with SAM headers, for the viewer (Phase 8)
  SamSysVars.ts             SAM BASIC system variables (names from the Technical Manual)
  SamBootDisk.ts            builds the Run/export MGT image around the Klive loader (§3.4)
```
A separation test like the Enterprise's: the host imports no TS device code.

### 4.3 Machine ID and models (decision D2)
**One machine ID, `MI_SAM_COUPE = "sam"`, display name "SAM Coupé":**

| Model id | RAM | ROM | Notes |
|---|---|---|---|
| `sam512` (default) | 512K (pages 0–31) | 3.0 (D3) | The common machine; most software assumes 512K |
| `sam256` | 256K (pages 0–15) | same | Pages 16–31 read FFh (OQ1 default) |

Machine config keys:
- `MC_SAM_DRIVES`: 0, 1 (default) or 2 internal drives.
- `MC_SAM_EXTMEM`: 0 (default) to 4 MB of external packs (Phase 9).
- `MC_SAM_MOUSE` (on by default): the mouse interface on FFFEh.
- `MC_SAM_ROM`: the bundled ROM 3.0 (default) or 3.1, or a user-supplied file (an Élite's 3.5, a
  boot ROM).

---

## 5. Memory and ports (`sam-memory.c`, `sam-ports.c`)

- **Sections (ASIC §2.2–§2.5):** A = ROM0 unless LMPR bit 5, else page LMPR[4:0]; B = page LMPR+1; C =
  page HMPR[4:0]; D = ROM1 if LMPR bit 6, else page HMPR+1; HMPR bit 7 replaces C/D with external pages
  80h/81h, and **external RAM wins over ROM1** (inference from both emulators, one constant). Page
  numbers wrap at 32. LMPR bit 7 write-protects section A (ROM writes are always dropped).
- **Missing pages** on `sam256`: read FFh, writes dropped (OQ1 default; the ROM's size probe, observed in
  Phase 1, confirms the machine reports 256K).
- **Power-on RAM:** a fixed pattern (all FFh with 80h zero bytes per 256, SimCoupé's convenience; one
  constant), so runs are reproducible; the reset button keeps RAM.
- **Reset values:** LMPR = HMPR = VMPR = border = 0, LINE = FFh, STATUS idle (OQ9: MAME's values are not
  supported by any other source). The CLUT is not reset (Unofficial manual); power-on CLUT contents use a
  fixed seed. The SAA is not reset by the reset button (SOUND §1.1).
- **Ports (ASIC §6.1, SOUND §7):**
  - F8h: write CLUT[A11:A8]; read LPEN (A8 = 0) / HPEN (A8 = 1);
  - F9h: write LINE; read STATUS with keyboard bits 5–7 from the rows on A8–A15;
  - FAh/FBh/FCh: LMPR/HMPR/VMPR, read/write; VMPR bit 7 reads MIDI IN (idle 1);
  - FDh: MIDI data (write starts the 320 µs transmit timer and its interrupt; read FFh, nothing attached);
  - FEh: write border/MIC/BEEP/THROM/SOFF; read keyboard (A8–A15 rows, FFh = row 8 and the mouse), EAR
    bit 6, SPEN bit 5, SOFF bit 7;
  - FFh: read ATTR; write SAA data (A8 = 0) or address (A8 = 1);
  - E0h–E7h / F0h–F7h: drive 1 / drive 2 (A0–A1 register, A2 side);
  - 80h/81h: external page registers (Phase 9);
  - everything else reads FFh outside the screen area and the current fetch byte inside it (SimCoupé's
    floating-bus rule; one constant, OQ15).
- **ASIC start-up delay** (OQ10): SimCoupé's optional ~49 ms in which ASIC ports read 00h. Off by default,
  one constant.

---

## 6. CPU timing (`sam-timing.c`)

1. **Memory:** per §3.2, applied inside the delay hooks at T2: `3 + wait` T for reads and writes, `4 + wait`
   for M1, with `wait` from the section's flag and the cell's region (screen, border, mode-1 stripe, SOFF).
2. **I/O:** ports with low byte F8h–FFh wait to the 1-in-8 grid at TW; other ports are not held (OQ14:
   ZX-Uno holds every port; three sources say F8h–FFh only).
3. **Interrupt acknowledge, refresh:** not held (constants).
4. **Region changes take effect at a cell boundary:** a VMPR mode change or a border SOFF write changes
   the contention region from the next cell (SimCoupé's one-cell delay for VMPR, ASIC §2.5).

**Proof (§13):** the Owen-table loops above; `debug-loop-equivalence.test.ts` gets the SAM; one expected
finding, as on the Spectrum: code in internal RAM running in the screen area locks to the 8-T grid.

---

## 7. ASIC video and interrupts (`sam-video.c`, `sam-asic.c`)

### 7.1 The cell stepper
- Each 8-T cell of a screen line (`hc` 128–383 on lines 0–191) fetches 4 bytes (modes 3/4) or 1 data + 1
  attribute byte (modes 1/2) from the VMPR page (modes 3/4: the even page and the next), and renders the
  cell one cell later (the 8-T pipeline before display, ASIC §1.2).
- Border cells use the border CLUT entry `(bit 5 << 3) | bits 2–0`; blanked cells are not rendered.
- **Registers are sampled per cell**: CLUT writes "take effect immediately on the next pixel" (manual);
  Klive takes them at the next cell (one constant, `SAM_CLUT_LATENCY`), and border writes "at the next
  screen memory sync" (Unofficial manual).
- FLASH: a 5-bit frame counter, swap on bit 4 (16 frames).

### 7.2 Modes and colours
- Mode 1: the Spectrum address layout at the page start, attributes at +1800h; mode 2: linear, attributes
  at +2000h; ink = BRIGHT × 8 + INK, paper = BRIGHT × 8 + PAPER.
- Mode 3: 4 pixels a byte, bits 7–6 leftmost, **pixel value 01 → CLUT index 2 and 10 → 1** (ASIC §3.3;
  three sources against MAME), index bits 3–2 from HMPR bits 6–5.
- Mode 4: 2 pixels a byte, the high nibble left.
- **Palette:** GRBbrgI → three 3-bit guns (high bit 4 units, low bit 2, BRIGHT 1 unit on all three),
  linear 0–7 by default (OQ12: no measured levels), one table.
- **SOFF:** border bit 7 and VMPR MDE1: black output (not CLUT 0), no fetch, no screen contention; ATTR
  keeps the latched value; LPEN/HPEN freeze (OQ6 default, the Unofficial manual).

### 7.3 ATTR, LPEN, HPEN
- ATTR (FFh read): the attribute (modes 1/2) or the third byte of the cell (modes 3/4) being fetched;
  in the border, **the last screen attribute fetched** (Owen measured; OQ15).
- LPEN: `(hc − 128) & FCh` in the screen area, bit 0 the CLUT index bit 0 of the pixel under the beam,
  bit 1 TXFMST; HPEN: the screen line, 192 in the border.

### 7.4 Interrupts
- Frame: STATUS bit 3 low from `vc` 244 `hc` 0 for `SAM_INT_PULSE_T` (default **128 T**; OQ5: the manual's
  "about 20 µs" is 120 T).
- Line: LINE = 0–191 → bit 0 low at `vc` = LINE, `hc` 0 (the start of the right border after line
  LINE − 1), for the same pulse; 192–255 off. A LINE write during the pulse ends it (SimCoupé's
  behaviour; OQ5, one constant).
- MIDI OUT: bit 4 low for 96 T after the byte's transmission timer (OQ7: start or end of the 320 µs; the
  default follows the manual's wording, end of transmission). MIDI IN never fires (the production ASIC's
  MIDI IN does not work, ASIC §5.4).
- /INT is the AND of the active-low bits; the Z80 sees it level-triggered, so a pulse missed with
  interrupts disabled is lost (ASIC §5.1). IM 2 reads **FFh** (OQ13; one constant).

---

## 8. Sound (`sam-saa.c`, `sam-audio.c`)

### 8.1 The SAA 1099
- Ported from SAASound (D1, D8) into C: the 6 tone generators (`f = 15625 · 2^oct / (511 − N)`), the
  2 noise generators (31.25 / 15.625 / 7.8125 kHz or tone 0/3), the 18-bit noise LFSR, the 2 envelope
  generators (8 shapes, 3/4-bit, clocked by tone 1/4 or by an address write of 18h/19h), the
  sync/reset bit and the sound-enable bit (SOUND §1).
- **SAASound's behaviour is the default where it and MAME disagree** (envelope on channels 2 and 5 only,
  buffered octave/offset and envelope writes, the PDM amplitude model). Each disagreement is one
  constant, recorded in the README with SAASound's real-chip reason (SOUND §1.7).
- **Cycle order:** the SAA runs in catch-up, before every write to FFh/1FFh and at frame end, at its
  8 MHz clock expressed in CPU tacts (exactly 4/3 SAA clocks per T); samples are integrated over each
  host sample (the TVC's integration), not taken from SAASound's own output-rate loop.
- Writes take 1-in-8 contention (the ASIC port rule); whether /DTACK adds waits is open (SOUND OQ3,
  default none).

### 8.2 Beeper and mixing
- FEh bit 4 (BEEP) into left and right; MIC (bit 3) is not audible (SOUND OQ5, default).
- Sources for the audio mixer (`common/wasm/audio-channels.c`, `KLIVE_AUDIO_CHANNELS`): SAA left, SAA right,
  beeper, tape. The relative levels of the beeper and the SAA are unmeasured (SOUND OQ4): one table.
- A DC high-pass at the output (≈ 5 Hz, SAASound's optional filter, and the board's coupling).

---

## 9. Keyboard, mouse, program loading, tape

### 9.1 Keyboard and joysticks (SOUND §3)
- Rows 0–7: A8–A15 select (0 = selected); bits 0–4 on FEh are the Spectrum's matrix, bits 5–7 (the SAM's
  extra keys) on F9h. Row 8 (CNTRL, the cursor keys…) when A8–A15 are all 1 (FFFEh), shared with the
  mouse.
- Joysticks in Interface 2 order: stick 1 on A12 (6–0), stick 2 on A11 (1–5); wired to Klive's joystick
  input.
- Host mapping: UK layout by position; F0–F9 on the host's function keys; EDIT, INV, CNTRL, SYMBOL, DELETE
  on keys chosen for the editor's use. `SamKeyMappings.ts` is data and tested.
- **Virtual keyboard** drawn from a photograph (the TVC/Enterprise way), `SamKeyboard.tsx`, colours as
  tokens, an entry in `dev/ai/ui-theming-intent-and-lessons.md`.

### 9.2 Mouse (SOUND §4)
- Nine nibble reads at FFFEh: strobe, dummy, buttons, Y (3 nibbles), X (3 nibbles) as 12-bit deltas, then
  back to the dummy; it resets after `SAM_MOUSE_TIMEOUT_T` (38 µs SimCoupé / 50 µs MAME, OQ8; default
  SimCoupé's). The host captures the pointer as the Next's mouse support does (check
  `IZxNextHostInputMachine` for the shared path; if it is Next-only, generalise it in its own commit).

### 9.3 The Klive boot loader (decision D7)
- `src/public/sam/sam-klive-boot.asm` → `sam-klive-boot.bin`, built by `dev/scripts/build-sam-boot.cjs`
  with Klive's assembler; `test/machines/sam-klive-boot.test.ts` checks the image matches the source.
- Layout: an MGT CODE file at track 4 sector 1 (the 9-byte header, then "BOOT" at offset 256), loaded by
  the ROM to the page below the screen and entered at 8009h.
- It reads the next directory entries, loads each program file's sectors (510 data bytes + the link)
  to its page/offset, sets LMPR/HMPR for the entry point (default: the program at page 1 offset 8000h,
  section C, the convention of pyz80 and `.sbt`, STORAGE §6), and jumps. It talks to the VL1772 directly
  (Restore, Seek, Read Sector with DRQ polling) and needs no DOS and no ROM routine but the boot itself.
- Errors (no program file, a read error) print through the ROM's RST 10h and return to BASIC.

### 9.4 Tape (Phase 8; SOUND §5)
- Through Klive's existing tape layer (`src/emu/machines/tape`): TZX (hardware ID 09), TAP, CSW and WAV,
  edges scaled from 3.5 MHz to 6 MHz with the remainder carried. SAM headers (flag 01h, 82-byte block)
  and Spectrum headers both recognised for the viewer.
- EAR on FEh bit 6; the turbo (extra machine frames while the tape plays) as on the TVC; no ROM trap
  (the ROM decodes the real signal), unless the turbo is too slow.
- SAVE: MIC transitions recorded and rebuilt into TZX blocks (the SAM's speeds become turbo blocks 10h/11h);
  a round-trip test settles the ROM's real timings (SOUND OQ9: the TZX formulas' sync value does not fit).

---

## 10. Disks (`sam-fdc.c`, `SamDiskImage.ts`)

### 10.1 The controller
- `src/emu/machines/common/wasm/wd1793.c` gains **`WD1793_VARIANT 1772`**: the 1770's behaviour with the
  1772's step rates (6, 12, 2, 3 ms; the file's header already names them). Its own commit; the Beta 128,
  TVC and Enterprise cores rebuild **byte-identical**.
- **Two controllers**, one per drive, as on the SAM board: `wd1793.c` included twice with
  `WD1793_PREFIX` `samFdc1` and `samFdc2` (one drive each). If the file does not allow a second inclusion
  in one TU, making it do so is part of the variant commit (still byte-identical for the others).
- Ports: E0h–E7h drive 1, F0h–F7h drive 2; A0–A1 the register, A2 the side line (STORAGE §4.1). The
  controllers run at 8 MHz from the board clock; INTRQ/DRQ are polled (no interrupt line).
- The ASIC does not pass reset to the controllers (ASIC §7 item 7): the reset button leaves them alone.

### 10.2 Images (STORAGE §4.4)
- `.mgt` and raw `.dsk` (819 200 bytes, cylinder-major with the heads interleaved — already the shared
  canonical layout), gzip-compressed as pyz80 writes them; `.sad` (22-byte header, side-major data);
  EDSK `.dsk` (by its signature), normal-format disks only in this plan; `.sbt` wrapped as a one-file
  bootable virtual disk (read-only); `.sdf` and `.td0` refused with a message.
- Readers written from SAMdisk's (MIT) descriptions, or ported with its notice where that is quicker.
- The guest's writes are published as the whole image (`DSK_WHOLE_IMAGE_KEY`, the TVC's way); a `.sbt`
  or EDSK with non-standard tracks is read-only.

### 10.3 Booting
- Drop or open a disk at the copyright screen: Klive presses F9 at the editor's key wait, a landmark found
  by running the ROM (the harness's `bootToBasic`, §13), not by a ROM address table.
- A disk without a DOS boots only if it has a boot file. **No SAMDOS is bundled** (D9); users bring their
  own DOS disks. B-DOS (freeware) could be bundled later with Atom Lite support.

### 10.4 The File Manager
`src/common/diskfs/mgtfs.ts` reads +D (G+DOS) files only. Add the SAM types (16–21, and 5, 9–11), the
SAM 9-byte header in page/offset form, the directory bytes 236–244 (start page, length, exec), the
protected/hidden bits, and the SAM DOS detection (B-DOS at 232, MasterDOS by byte 210, else SAMDOS),
so a SAM disk is browsable and files can be copied in and out (STORAGE §4.3). Update `dev/ai/file-manager.md`.

---

## 11. IDE integration checklist
As in `dev/ai/videoton-tvc.md` "Integration checklist"; **(2×)** marks a list kept in two places.

- **Registry:**
  - `constants.ts`: `MI_SAM_COUPE`, the `MC_SAM_*` keys, `MEDIA_INFO_MACHINE_IDS`,
    `BEAM_POSITION_MACHINE_IDS`.
  - `machine-registry.ts`: features `MF_Z80`, `MF_TAPE_SUPPORT` (Phase 8), `MF_INJECT_SUPPORT`,
    `MF_EXEC_HISTORY`, `MF_REVERSE_DEBUG`, `MF_PROFILE`, **`MF_BANK: 32`** so the memory panel offers its
    page matrix; models; media ids (two drives, tape); tool info with the custom disassembler; a SAM
    `charSet` read from the ROM's own character set.
  - `machine-renderer-registry.ts`, `hardware-specs.ts` (+ `hardware.*` i18n keys), `NewProjectModel.ts`
    `MACHINE_FAMILIES`, a project template under `src/public/project-templates/samcoupe/`.
- **Build and packaging:** `dev/scripts/build-sam-wasm.cjs` copies `build-ep-wasm.cjs` (the export
  allow-list scripts, a `SAM_VOLATILE_SYMBOLS` list, the build lock, the layout stamp); `package.json`
  `build:sam-wasm`, `check:sam-wasm-size`, `build:all-wasm` **and** `extraResources` → `wasm/sam` **(2×)**;
  `check-wasm-cpu-contract.cjs`, `src/main/unit-tests/wasmArtifacts.ts`, `unitTestMachines.ts`,
  `headlessMachines.ts` + `HeadlessMachineFactory.ts`, `src/emu/machines/reverse/exportContract.ts`.
- **Tests:** `test/vitest.setup.ts` `CORE_EXPORT` gets the `sam` prefix; `build/e2e-tests.ts` gets
  `test/sam-hw/**`; `test/harness/samcoupe/` with a README.
- **Messaging and panels:** `MainToEmuProcessor.ts` and `EmuApi.ts` get `getSamAsicState` /
  `getSamSaaState`; panels in `src/renderer/registry.ts`; `MachineSelectView*` proportions;
  `tool-registry.tsx` media strip; `dropped-file-action.ts`, `src/main/open-file.ts`,
  `sniff-content-kind.ts` for `.mgt`, `.sad`, `.sbt`, the SAM `.dsk` kinds (told apart from CPC/+3 EDSK by
  the machine in use, not the file) and, in Phase 8, `.tzx`/`.tap`/`.csw`.
- **State:** `STATE_MACHINES` in `state-menus.ts` **and** `MachineStateCommands.ts` **(2×)**;
  `coreIdOfMachine` in `machineStateFile.ts`.
- **Menus:** `machine-menu-registry.ts` + `sam-menus.ts` (drives, eject, write protect, mouse, tape, ROM).
- **Debugger:**
  - **memory partitions are pages:** ROM0, ROM1, RAM 0–31, external 0–255 (Phase 9), with labels, through
    `getPartitionLabels` / `getPartition` / `getPartitionDescriptions` / `getPartitionGroups`, and a
    `samBankSpace` in `bankSpace.ts` (16K pages);
  - history and profile contexts record LMPR/HMPR (and 80h/81h) (`src/common/history/contexts/samContext.ts`,
    `src/common/profile/layouts/sam.ts`);
  - a custom disassembler (`disassemblers/z80-disassembler/sam-disassembler.ts`): **`RST 8` is followed by
    a byte** (an error code, or a DOS hook code 128+), listed as data with the hook's name from the
    Technical Manual, and `getCallInstructionLength` returns 2 so Step Over stops after it (the TVC's
    `RST 30h` lesson); RST 28h's calculator literals as the Spectrum disassembler treats them, if the SAM
    calculator's encoding matches (check in Phase 7);
  - a **SAM BASIC variables** SysVars view (`SamSysVars.ts`, names from the Technical Manual).
- **An ASIC panel** (Debug activity, `restrictTo: [MI_SAM_COUPE]`): LMPR/HMPR/VMPR decoded (pages,
  ROM0/ROM1, write protect, mode, mode-3 colour bits, external), the 16 CLUT entries as swatches with
  their 7-bit values, the border and SOFF, LINE and STATUS (each source, pulse active or not), `hc`/`vc`
  and the cell, HPEN/LPEN, FLASH phase, the contention region at the beam. Built on
  `@renderer/controls/data`, `ch` widths, row-size tokens (M1–M3), `--color-state-value`.
- **An SAA panel:** the 32 registers decoded per channel (frequency in Hz, octave, amplitude L/R, tone and
  noise enables), the noise generators' sources, the envelopes (shape, resolution, clock source, mirrored
  right), sync and sound enable.
- **Assembler:** `.model SAMCOUPE` in `VALID_MODELS`, `SpectrumModelTypes.ts` (`SamCoupe = 10`, name map,
  `isSamCoupeModelType`), `compile-code.ts`, `UnitTestRunner.ts`, `z80-completion-data.ts`.
- **CLI:** `src/cli/run/inputs.ts`, `src/cli/verbs/run.ts` `--machine sam`, `unitTestMachines.ts`.
- **i18n:** every new UI text through `t()` with an English entry and translator context, then
  `npm run i18n:keys`.
- **Feature roadmap:** `dev/plans/LANDING_PAGE_COMPETITIVE_ANALYSIS.md` lists Klive's machines (§2 "Other
  machines") **and claims every shipped ROM is annotated to level 2**. Shipping the SAM ROM without
  annotations breaks that sentence: the change either annotates it (a separate ROM-annotation plan) or
  rewords the claim (D10).

### 11.1 SAM BASIC listing (conditional)
The token table is not in any public document found (STORAGE OQ5). In Phase 7, type lines into the running
ROM and read the stored bytes (keywords 85h–FEh, functions FFh + 3Bh–83h; Klive's own observation, as the
TVC's and Enterprise's tables were). If the table is complete, add a detokeniser for `BasicPanel.tsx`.

---

## 12. Run, Debug and export (`src/common/samcoupe/codePlacement.ts`)

- **`.model SAMCOUPE`**: code with no `.org` goes to 8000h in **page 1** (BASIC address 32768, section C
  under BASIC's paging; STORAGE §6). Z-codes warn about code below 8000h (BASIC and the system variables
  live there) and about a block crossing a 16K page boundary.
- **Pages:** the assembler's existing page syntax maps a `.org` in section C/D to a page; the export
  writes each page's bytes to the file header's page/offset form (`address = page × 16384 + offset − 4000h`,
  STORAGE §3.1).
- **Run and Debug** (D7): boot to the copyright screen (the harness's landmark), build the MGT image (Klive
  loader + the program as a CODE file with its exec address), insert it in drive 1, press F9. The
  debugger stops on the program's first instruction when asked to.
- **Fast inject** (unit tests, `klive run --no-disk`): write the pages directly after the copyright
  screen, set LMPR/HMPR as the loader would, and jump. One code path shared with the loader's paging
  rules (`codePlacement.ts`).
- **Export:** `.mgt` (bootable through the Klive loader), `.sbt` (single-file self-boot, when the program
  fits the format), raw `.bin` with its page/offset.
- **Load and Run** for `.mgt`/`.dsk`/`.sad`/`.sbt` (boot), and in Phase 8 tapes (`LOAD ""`).

---

## 13. Tests

All tests run the real WASM machine.
- **Harness `test/harness/samcoupe/`** (copy `test/harness/enterprise/`):
  - `bootToBasic(model)`: reaches the copyright screen's key wait, observed by the stack and the
    keyboard state, not pixels; `pressF9`, `typeKeys`, `runFrames`, `runTo`, `step`, `peek`/`poke`
    (physical and paged), `pages()`;
  - `asic()` (registers, `hc`/`vc`, STATUS, the region at the beam), `saa()`, `audio()`, `disks()`;
  - a **bare machine** (`bare.ts`): CPU parked in RAM with the paging set by the test, no ROM boot.
- **Hardware tests (`test/sam-hw/`)**, one file per topic:
  - memory: every LMPR/HMPR combination over ROM0/ROM1/RAM, write protect, page wrap 31 → 0, 256K missing
    pages, external RAM over ROM1;
  - timing: the Owen-table instructions in border/screen, mode 1 stripes, mode 2–4, SOFF, code and data in
    ROM, internal and external RAM, ASIC and non-ASIC ports; a phase sweep (a test-only export places the
    CPU at a chosen frame tact, as `tvcSetHalfClock` did);
  - video: each mode on a worked byte, the mode-3 swap, BRIGHT as CLUT 8–15, FLASH period, border bits,
    SOFF black and its latency, a mid-line CLUT change landing on the right cell, a line-interrupt mode
    split, ATTR in the border, LPEN/HPEN;
  - interrupts: frame at `vc` 244, line at `vc` N `hc` 0 for N = 0, 1, 191, off at 192+, pulse length,
    a LINE write during the pulse, MIDI OUT timing, a missed pulse with DI;
  - sound: pitch from octave/offset, the noise rates and LFSR period, each envelope shape, sync, sound
    enable, the beeper, stereo independence, a tone through to the host's samples;
  - keyboard, joysticks, mouse protocol and timeout;
  - disk: the 1772 variant's step rates, both drives, read/write sector, a directory listing of an `.mgt`,
    the ROM's F9 boot of the Klive loader, `.sad`/EDSK/`.sbt` loading, write-back, write protection;
  - tape (Phase 8): SAVE/LOAD round trip at speed 112 and a fast speed, with and without the turbo.
- **Boot goldens:** the copyright screen and the BASIC prompt on both models (picture hashes recorded only
  after checking them by eye); the ROM's ALLOCT and paging after boot dumped as a fixture (answers
  STORAGE OQ4 by observation).
- **Cross-core suites** that list every core: the contract test, state determinism and layout, reverse
  journal and export contract, history, profile, `debug-recording-cores`, `hardware-specs`, machine-select,
  new-project, menu structure, `runner-machines`, CLI e2e, `debug-loop-equivalence`.
- **Oracle runs (manual, never in CI):** the same Klive-written programs in SimCoupé 1.2.17; compare
  screens, cycle totals (via the line interrupt and border bars), interrupt positions and sound. Record
  observed results in Klive's words in the core README; where Klive and the oracle disagree, the research
  pack decides and the README says why. Third-party demos (Defender, the BSD demo, the FRED 59 Space demo,
  SAM DICE, SAM Mines; STORAGE §8) are run by hand for confidence and **never become fixtures** unless a
  title's licence allows it (worldofsam's copyright index).
- **Performance:** `benchmark:sam-wasm` must show more than 10× real time.
- **Tiers:** every core test goes in `build/e2e-tests.ts`; a file over 20 s moves to `E2E_SLOW_TESTS`. The
  ROM's memory test takes seconds of machine time: most tests use the bare machine or a saved booted state.

---

## 14. Open hardware questions that affect the code

Each gets one constant or define, its default and its reason in the core README. None blocks a phase.

| # | Question | Default | Where it is discussed |
|---|---|---|---|
| Q1 | Pages 16–31 on a 256K machine | FFh, writes dropped | ASIC §2.6, OQ1 |
| Q2 | Mode-1 stripe phase | SimCoupé's (matches Owen's measurement) | ASIC §4.4, OQ2 |
| Q3 | Blanking / visible border | ZX-Uno/MIST unblanked area, 32 T and 48 lines | ASIC §1.2–§1.3, OQ3 |
| Q4 | Where the ASIC samples a cycle | T2 for memory, TW for I/O; phase constants fitted to Owen's table | ASIC §4.3, §4.7, OQ4; kosarev #10 |
| Q5 | Interrupt pulse length; LINE write during it | 128 T; ends it | ASIC §5.2–§5.3, OQ5 |
| Q6 | HPEN/LPEN with SOFF | frozen | ASIC §3.6, OQ6 |
| Q7 | MIDI OUT interrupt time | end of transmission | ASIC §5.4, OQ7 |
| Q8 | Ports 80h/81h readable | no (FFh) | ASIC OQ8 |
| Q9 | Paging register reset values | zero | ASIC §2.8, OQ9 |
| Q10 | ASIC start-up delay | off | ASIC OQ10 |
| Q11 | Palette levels | linear 0–7 per gun | ASIC §3.4, OQ12 |
| Q12 | IM 2 vector | FFh | ASIC §5.5, OQ13 |
| Q13 | I/O contention scope | F8h–FFh only | ASIC §4.6, OQ14 |
| Q14 | Unmapped port reads | fetch byte on screen, FFh elsewhere | ASIC §6.1, OQ15 |
| Q15 | Mode-change artefact cell | none | ASIC §3.7, OQ16 |
| Q16 | SAA envelope scope, buffering, amplitude model | SAASound's | SOUND §1.5–§1.7, OQ1–OQ2 |
| Q17 | SAA /DTACK waits; beeper/SAA levels | none; one table | SOUND OQ3–OQ4 |
| Q18 | Mouse timeout | 38 µs | SOUND §4, OQ8 |
| Q19 | FEh read bit 7 | SOFF | ASIC §6.2; SOUND OQ6 |
| Q20 | Refresh and interrupt-acknowledge contention | none | ASIC §4.7 |

---

## 15. Phases and exit criteria

| Phase | Content | Exit criteria |
|---|---|---|
| **0. Decisions** | Settle D1–D10 (§16). Add ROM 3.0 and 3.1 to `src/public/roms/` from World of SAM's archive with `sam-roms-readme.txt` (the 2008 grant, its source, the CRCs) and a `test/machines/sam-rom-images.test.ts` like the Enterprise's. Fetch the reference documents the pack lists (the Technical Manual PDF or Drissen's transcription, the datasheets repository, the 1 MB pack manual), not the annotated ROM disassembly. Pin SAASound's commit into `dev/research/sam-coupe/saasound/`. | D1–D10 accepted; the ROMs committed with their readme and test. |
| **1. Skeleton** | `sam.c` TU; pages and LMPR/HMPR/VMPR; ROM upload; ports; the cell stepper with frame/line interrupts and STATUS but no pixels; keyboard matrix; frame loop from the frame interrupt; loader; host; registry entry for `sam512`; build and contract scripts. | `bootToBasic()` reaches the copyright screen's key wait; the ROM reports 512K (ALLOCT); `asic.test.ts`, `memory.test.ts`. |
| **2. Timing** | §6: memory and I/O contention, the phase sweep export. | `timing.test.ts` reproduces the Owen-table values; the SAM in `debug-loop-equivalence.test.ts`; an oracle comparison with SimCoupé recorded. |
| **3. Picture** | §7: the four modes, CLUT, palette, border, SOFF, FLASH, ATTR, LPEN/HPEN, the TV window, beam position. | The copyright screen and the BASIC prompt hashes (checked by eye); `video.test.ts`; a mode-3/mode-4 split screen and a line-interrupt palette effect seen in the running app. |
| **4. Sound** | §8: the SAA port, the beeper, the mixer channels. | `sound.test.ts`; the ROM's `BEEP` and a `SOUND` statement through to the host's samples. Heard by ear in the running app. |
| **5. Input** | §9.1–§9.2: host mapping, joysticks, mouse, the virtual keyboard after its design is approved. | `keyboard.test.ts`, `mouse.test.ts`, `test/controls/SamKeyboard.test.tsx`; typing BASIC in the running app. |
| **6. Disks** | §10: the 1772 variant (its own commit, Beta 128 / TVC / Enterprise byte-identical), two controllers, images, F9 boot, `mgtfs.ts` SAM types. | `fdc.test.ts`, `sam-disk-image.test.ts`, `mgtfs` tests; a SAMDOS disk the user owns boots and lists in the running app (oracle: the same disk in SimCoupé). |
| **7. IDE** | §11: partitions, ASIC and SAA panels, disassembler (`RST 8`), SysVars, charset, menus, state files, history, profile, reverse debugging; the BASIC listing if §11.1 finds the table. | History, profile, charset, debug-state tests; the SAM in the export contract, journal replay, state determinism, debug recordings and hardware-specs suites; panels and memory view seen in the running app. |
| **8. Assembler, Run and tape** | §9.3 loader, §12 (`.model SAMCOUPE`, Run/Debug, exports, template, CLI), §9.4 tape. | `sam-klive-boot.test.ts`, `code-injection.test.ts`, `project-templates.test.ts`, `tape.test.ts`; `klive run --machine sam`; a new project from the template runs; an exported `.mgt` boots in SimCoupé. |
| **9. 256K and external memory** | `sam256`; `MC_SAM_EXTMEM`, ports 80h/81h, uncontended external pages. | `sam256.test.ts` (the ROM reports 256K), `extmem.test.ts`; the TopGun demo by hand. |
| **10. Ship** | Notices (`THIRD_PARTY_NOTICES.md`: SAASound, SAMdisk if ported; the ROM readme and Andy Wright's grant), docs pages, an `AGENTS.md` section, `dev/ai/sam-coupe.md` (decisions, as-built notes, open items), the landing page's machine table, `README.md`'s machine list, the competitive analysis (D10), lessons in `dev/ai/wasm-migration-intent-and-lessons.md`, one `feature` changeset. `npm run test:slow` before release. | Gates, `test:fast`, `test:slow`, `doc:build` + `doc:check` green; both models, Run, disks and tape checked in the built app. |

The changeset comes with the commit that completes the plan (AGENTS.md); phase commits carry none.
Docs for Phase 10: `docs/content/en/guides/machines/sam-coupe.mdx` (screenshots from a
`guides-samcoupe.cjs` doc-shots recipe), `reference/machine-types.mdx`, `reference/z80-assembler/sam-coupe.mdx`;
an "Under the hood" article on the ASIC's contention and the line interrupt, written under
`dev/ai/hardware-articles-guide.md`.

### Follow-ups (not in this plan)
- Atom Lite + `.hdf` + B-DOS (and bundling freeware B-DOS); Trinity; the SAMBUS/Dallas clocks.
- MIDI OUT to the host's MIDI, printer, Comms interface.
- The mode-change artefact cell (Q15), once its bit routing is recorded from Klive's own tests on the oracle.
- ROM annotations for ROM 3.0 written from scratch (`dev/ai/rom-annotations/` rules; a per-ROM guide).
- z88dk `+sam` and Boriel BASIC targets; Spectrum mode; `.sdf`/`.td0`; protected EDSK tracks.
- The SAM Élite (ROM 3.5).

---

## 16. Decisions (proposed, for the project author)

- **D1 — provenance.** *Recommendation:* Klive's own code from the research pack; **SAASound (BSD-3)
  ported** for the SAA; SAMdisk/mgtdisklib (MIT) and MAME's BSD-3 `coupe_*` formats as port sources for the
  image readers; SimCoupé, MAME's (GPL) SAM driver, ZEsarUX, the MiST/MiSTer cores and pyz80 not read for
  design (the pack holds their facts); the unlicensed ZX-Uno core not read at all; SimCoupé run as an
  oracle only.
- **D2 — one machine ID, `sam`, with the models `sam512` (default) and `sam256`** (§4.3).
  *Recommendation: yes.*
- **D3 — ROMs.** *Settled 2026-11-20:* bundled. Dr Andrew J. A. Wright, the ROM's author, wrote on
  16 April 2008, in reply to Hans de Goede on the Fedora extras commits list (the thread "Sam Coupe
  ROM"): "I hereby allow all my SAM Coupé titles (including ROMs) and associated manuals to be freely
  (re)distributed." World of SAM reproduces it on its ROM page (https://www.worldofsam.org/products/rom,
  "Trivia"), beside the archive's own 2006 permission
  (https://www.worldofsam.org/copyrights/sam-coupe-rom-images). The grant names the ROMs and sets no
  conditions; Klive still ships the images unmodified, charges nothing and credits him, as it does the
  Enterprise's.
  - `src/public/roms/sam-roms-readme.txt` quotes the sentence with its date, recipient and both URLs,
    and lists the CRCs; `test/machines/sam-rom-images.test.ts` checks them.
  - **Still to do in Phase 0:** read the original message in the Red Hat archive
    (https://listman.redhat.com/archives/fedora-extras-commits/2008-April/msg07874.html, unreachable
    from the research environment on 2026-11-20) and record that the wording matches.
  - **Which images:** ROM **3.0** as the default (the last official release, and the one Simon Owen's
    `samrom` source builds), and **3.1** as an option (MAME's default and SimCoupé's bundled image; it
    differs only in the version byte and "PLC"). World of SAM offers both (`SAM30-PLC.zip`, `SAM31.zip`)
    and the SAM Computers 3.0 variant; record which 3.0 (the "plc" or "PLC" splash) matches MAME's CRC
    e535c25d. Not the 3.5 (West Coast's Élite ROM is not Wright's alone) or the third-party boot ROMs.
  - `SamRoms.ts` keeps a user-supplied ROM a setting, for the Élite and boot ROMs.
  - What the grant does **not** settle: using the ROM's *source* (`samrom`, GPL-2.0) to write Klive's
    annotations. That stays D10's question.
- **D4 — time base:** whole T-states, the frame starting at the frame interrupt, the ASIC stepped per 8-T
  cell inside `Z80_TACT_PLUS_N` (§3.1). *Recommendation: yes.*
- **D5 — contention:** the closed-form 4/8-T grid with named phase constants fitted to Owen's published
  timings; ROM and external RAM never held; ASIC ports only (§3.2). *Recommendation: yes.*
- **D6 — the picture:** rendered at 12 MHz, 640 × 288, aspect 7/12, per-cell register sampling (§3.3).
  *Recommendation: yes.*
- **D7 — program loading:** a Klive-written boot loader in the repository; Run builds an MGT image and
  presses F9; direct injection only for tests and the CLI (§3.4, §9.3). *Recommendation: yes.* The
  alternatives — making Run depend on a DOS (SAMDOS's authorship is unclear, and a user's DOS disk may
  be any of four) or injection for Run (skips the ROM's and the controller's real behaviour, and the
  export would not be the thing that was run) — are worse.
- **D8 — SAA model defaults:** SAASound's where it and MAME disagree (§8.1). *Recommendation: yes*; it is
  the only one checked against a chip.
- **D9 — no DOS bundled in this plan.** *Recommendation: yes.* Run and export use the Klive loader (D7),
  so no DOS is needed. Wright's 2008 grant would allow bundling MasterDOS (and SAMDOS, if STORAGE OQ2
  shows it is his), and B-DOS is freeware: offering a DOS disk with Klive is a follow-up, once the
  authorship of SAMDOS is settled.
- **D10 — the competitive analysis's ROM-annotation claim.** Either the SAM ships after a ROM 3.0/3.1
  annotation plan, or the claim names the SAM as the exception (as it already names IS-BASIC 2.0).
  *Recommendation:* name the exception; annotate in a follow-up plan. Wright's grant covers
  redistributing the ROM, not deriving annotations from its GPL-2.0 source (`samrom`): that follow-up
  either writes them from scratch (rule D4) or first asks him, as the Z88's OZ annotations were done
  from OZ's source with its author's permission.

---

## 17. Risks

- **ROM rights (D3).** The grant is an email reproduced on a fan site, not a licence file. Read the
  original in the Red Hat archive in Phase 0 and keep the readme's quote exact. Keep every ROM access
  behind `SamRoms.ts`, so a later objection means a settings dialog, not a rewrite.
- **No permissive reference.** Every ASIC behaviour is written from prose and measurements, and checked
  only against a GPL oracle we may run but not read. The research pack must carry every fact the code
  needs; a gap found during implementation is closed by a Klive test on the oracle, recorded in Klive's
  words, never by reading SimCoupé's source.
- **Contention constants are fitted** (Q2, Q4). Keep them in one table; tests pin the published timings,
  so a real-hardware measurement changes data, not code.
- **The boot loader talks to the emulated VL1772.** A controller bug shows as "Run does not work". Phase 6
  tests the controller with the ROM's own boot first; the loader comes in Phase 8 on a proven controller.
- **The 1772 variant touches three shipped cores' shared file.** Byte-identical rebuilds of the Beta 128,
  TVC and Enterprise cores are the gate for that commit.
- **The SAA's real behaviour is subtle** (PDM amplitude, buffered writes). Porting SAASound inherits its
  real-chip tuning; a from-scratch model would not have it.
- **Ambiguous `.dsk`.** A raw SAM `.dsk`, a gzipped one and an EDSK (also the +3's and the CPC's) share the
  extension. Detect by content and by the machine in use; never guess the machine from a `.dsk` alone.
