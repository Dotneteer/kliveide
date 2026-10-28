# Videoton TV Computer (TVC) on the WASM Core — Implementation Plan

**Status:** Phases 0-5 done (2026-10-27), except Phase 4's virtual keyboard, which waits for a
design (§17). Both models boot BASIC in the app; tapes load and save. Next: Phase 6 (IDE). What was
built and how it differs from this plan is in §17.
**Input:** the research pack `_input/videoton-tvc/`. Read these three first:
- `TVC_HARDWARE_OVERVIEW.md`: the machine's blocks, timing, sound, and what the emulators get wrong;
- `TVC_VIDEO_GENERATION.md`: the video path, checked against the manual and the board schematics;
- `TVC_CLOCK_STRETCH_FIGURES.md`: the CPU clock stretch on video RAM access.

Beside them: the 1988 hardware manual (`tvchardver.pdf`), the HBA and HBA-2 schematics, the ROM
book, `rtvc/` (an MIT-licensed Rust emulator, commit in `rtvc/SOURCE_COMMIT.txt`) and the TVC files
of MAME (BSD-3-Clause, `mame/SOURCE_COMMIT.txt`).

**Shape of the result:** one new C translation unit that `#include`s the shared Z80 core
`src/emu/z80/wasm/z80.c`, exactly as the ZX81 and the HT-1080Z do. There is no second CPU, no copy of
`z80.c`, and no TypeScript TVC machine. The HT-1080Z is the closest template: it is the newest core,
it has audio, tape, models chosen at run time and the most complete IDE wiring.

---

## 0. Ground rules

### 0.1 Licence and provenance
- **rtvc is MIT.** Porting from it is allowed. Every Klive file derived from an rtvc file keeps the
  copyright and permission notice in a header comment that names the upstream file, and
  `THIRD_PARTY_NOTICES.md` gets an rtvc section. The useful parts are the CAS container and pulse
  rules, the HBF card's register map and the keyboard matrix. Its CRTC and video generator are
  *not* a model to copy: `TVC_VIDEO_GENERATION.md` Part 12 lists where they differ from the
  hardware.
- **MAME's TVC files are BSD-3-Clause.** Reading them for interface facts is allowed, and so is
  porting with the notice. In practice nothing needs porting: rtvc and the research pack cover more.
- **GPL emulators** (ep128emu, which also emulates the TVC) may be **run** as behavioural oracles.
  Their source is **not** read for design and **no** code is taken. This is the same rule as the
  ZX81 plan's.
- **The default is Klive's own code**, written from the hardware facts in the research pack. That
  is how the HT-1080Z core was built, and it keeps the provenance simple.
- **ROMs:** see decision D3. rtvc's ROM listings (`rtvc/roms/*.asm`, `rom_comments_1_2.json`) take
  their routine names and comments from two published books. Under the ROM-annotation rule D4
  (`.ai/rom-annotations/README.md`) they must **not** feed Klive's shipped `.rom.dis` sidecars, names
  included. They may be read to understand behaviour during emulation work, as this plan already
  did for the CRTC table and the palette defaults.

### 0.2 Reuse rules for the CPU
These come from `.ai/wasm-migration-intent-and-lessons.md`, "Shared CPU Intent".
- The machine configures `z80.c` through `#define Z80_*` hooks before the `#include`, and never
  forks it.
- Anything the TVC needs that `z80.c` lacks goes into `z80.c` as a **default-no-op macro hook**. It is
  added to `scripts/check-wasm-cpu-contract.cjs`, and then **every existing core is rebuilt and
  retested**. A hook that no machine defines must leave every core tact-identical.

### 0.3 Documents to read before working on this
- `src/emu/z80/wasm/README.md`, before adding a hook (§5).
- `.ai/wasm-v2-machine-migration-guide.md` and `.ai/wasm-migration-intent-and-lessons.md`.
- `src/emu/machines/ht1080z/wasm/README.md`: the template core.
- `.plans/ZX8081_WASM_PLAN.md` §11–§13 and §17: the integration checklist and what went wrong last
  time.
- `.ai/i18n-guide.md` (every new UI text), `.ai/ui-theming-intent-and-lessons.md` (the virtual
  keyboard and any panel), `.ai/rom-annotations/README.md` (before any ROM sidecar),
  `.ai/visual-tests-guide.md` (screen goldens).

---

## 1. Goals and non-goals

### Goals
1. **TVC 64K with BASIC 1.2** and **TVC 64K+ with BASIC 2.2**, booting to the `OK` prompt, with
   keyboard, colour picture and sound.
2. **Video at the precision the research established**:
   - the CRTC advanced one character per two T-states;
   - the three colour modes with the schematic's bit order;
   - palette and border writes visible mid-line;
   - the one-character display-enable delay;
   - horizontal blanking from a 14.4 µs monostable, vertical blanking from VS until MA9;
   - the cursor frame interrupt, set at the end of the cursor pulse;
   - the 64K+ display banks.
3. **CPU timing**: the clock stretch on every video RAM access, in half-T-state steps, and the
   one-WAIT-per-M1 circuit of the HBA/HBA-1 boards. No current TVC emulator models either.
4. **Tape**: open a `.cas` file and load it, by default through a fast-load trap and on request in
   real time, with motor control. SAVE produces a `.cas` file.
5. **Sound**: the 12-bit divider, the square-wave and direct-DAC modes, the sound timer interrupt.
6. **IDE**: debugger and disassembly, memory partitions, a TVC video panel, BASIC listing, virtual
   keyboard, machine states, history and profiling, as the other WASM cores have.
7. **Assembler**: `.model TVC`, Run/Debug code injection, `.cas` export.
8. **Floppy** (a later phase, §9.4): the HBF card with VT-DOS and raw `.dsk` images.

### Non-goals (possible follow-ups, §14)
- The TVC 32K, ROM 1.1 and other ROM revisions.
- Cartridges other than the VT-DOS one, and expansion cards other than the HBF.
- The printer port, the light pen, the external colour inputs (`EC0–EC3`) and the RGB TTL outputs.
- A PAL composite signal model (subcarrier artefacts). Colours come from the IGRB levels.
- Klive BASIC or z88dk targeting the TVC.

---

## 2. Inventory: what the research pack gives and where it goes

| Topic | Source in `_input/videoton-tvc/` | Klive destination |
|---|---|---|
| Memory map, ports 02h / 03h / 0Ch–0Fh, EXT/EXTH | `rtvc/info/tvc.md` "Memory Map"; HW pp.81–95 | `tvc-memory.c` |
| I/O map and mirrors | `rtvc/info/tvc.md` "I/O Map"; HW pp.125–130 | `tvc-ports.c` |
| CRTC behaviour and the boot register values | `TVC_VIDEO_GENERATION.md` Part 3; HW pp.163–194 | `tvc-crtc.c` |
| Video RAM wiring, pixel path, blanking, sync, interrupt | `TVC_VIDEO_GENERATION.md` Parts 4–10 | `tvc-video.c` |
| Clock stretch, WAIT | `TVC_CLOCK_STRETCH_FIGURES.md`; overview §3 | `tvc-timing.c` + the new core hook (§5) |
| Sound and timer | overview §5; HW pp.99–103; `rtvc/src/emulator/sound.rs` | `tvc-audio.c` |
| Keyboard matrix | `rtvc/info/tvc.md` "Keyboard"; HW p.97 | `tvc-keyboard.c`, `TvcKeyCode.ts` |
| Cassette I/O, CAS format | `rtvc/info/tvc.md` "Cassette", "CAS"; `rtvc/src/emulator/cas.rs` (MIT) | `tvc-tape.c`, `TvcCasFile.ts` |
| HBF card, raw DSK | `rtvc/info/tvc.md` "HBF", "Raw DSK"; `rtvc/src/emulator/hbf.rs` (MIT) | phase 8 (§9.4) |
| ROM images | `rtvc/roms/` | `src/public/roms/tvc-*.rom` (decision D3) |
| Test programs | `rtvc/coding/` (MIT, probe programs); `rtvc/progs/` (**unknown licences: not usable as fixtures**) | `test/tvc-hw/` |

---

## 3. The design problems

### 3.1 Half-T-state CPU timing
The CPU clock is stopped for **one to four half-T-states** (160 ns units) when the CPU touches video
RAM. The amount depends on the phase of the cycle's T1 against DEB, the 1.5625 MHz slot signal. It
also differs between a memory read/write and an opcode fetch (overview §3; the stretch file).
Klive's `cpu.tacts` counts whole T-states.

**Proposal (decision D5): keep `cpu.tacts` in whole T-states and add a machine-side half-T phase
bit.**
- Machine time in half-T units is `2 · cpu.tacts + tvcHalfPhase`.
- A stretch of *k* units adds `(k + tvcHalfPhase) >> 1` to the tacts and leaves
  `(k + tvcHalfPhase) & 1` as the new phase. The DEB phase seen by the next access is
  `(2 · tacts + phase) mod 4`.
- Everything Klive shows in T-states (the CPU panel, frame tacts, breakpoints on tacts) stays in
  real T-states. The half step is visible only in the video and sound timing, which run on the
  fixed clock.
- *Rejected:* counting `cpu.tacts` in half-T units through `Z80_TACT_PLUS_N`. It would double every
  tact number in the IDE and in the shared debug loop's tact arithmetic.

### 3.2 Opcode fetches stretch differently, and the core can't tell them apart
`z80.c` times an opcode fetch through `delayMemoryRead`, the same funnel as a data read
(`readOpcodeMemory`, `z80.c` around line 520). The TVC stretch differs:
- for a read or write, the clock is held high in T3;
- for an M1, it is held low in T2, which needs half a clock less.

The HBA's WAIT circuit also adds one wait state to every M1 from a slow source. Both M1s of a
prefixed instruction are M1 cycles with /M1 low; the DDCB/FDCB displacement and opcode reads are
not. A new hook settles this (§5).

### 3.3 The frame is whatever the CRTC says
The frame is 62,800 T with the ROM's values, but software can reprogram the CRTC, and before the
ROM programs it the registers hold nothing useful. **The machine frame ends at the CRTC's frame
wrap**: the row counter passing R4 plus the R5 adjust lines. That is the ZX81's sync-driven frame
idea, applied to the CRTC.
- A safety cap (two nominal frames, 125,600 T) ends a frame if the CRTC never wraps.
- Host pacing uses the measured frame length, so the TVC runs at 49.76 Hz, not 50.
- The cursor interrupt is raised where the CRTC puts it, not at the frame boundary.

### 3.4 Video is a per-character catch-up renderer
The video generator advances once per character (2 T). It follows the HT-1080Z's catch-up pattern:
- before any access that can change the picture, the renderer catches up to `now`. Those accesses
  are video RAM writes, ports `00h`, `06h`, `0Ch–0Fh`, `60h–63h` and `70h–7Fh`;
- at the end of a frame, the renderer catches up to the frame end.

Each character produces eight pixels of final colour through the real pipeline: fetch → shift
registers → palette or direct → paper/border selector (DE one character late) → blanking clear.
Palette, border and mode changes therefore land at the character they happen in. Landing them at
the exact pixel inside a character is a refinement (§14) that needs the sub-character timing still
open in `TVC_VIDEO_GENERATION.md` Part 13 item 6.

---

## 4. Architecture and file layout

### 4.1 C (one artifact; the model chosen at run time)
```
src/emu/machines/tvc/wasm/
  README.md                 build, ABI, exports, the hardware model (copy the HT-1080Z README's shape)
  TvcWasmV2Loader.ts
  dist/tvc.wasm
  tvc/
    tvc.c                   the TU: state, Z80_* hooks, #include z80.c, frame loop, exports,
                            debug loop, condition evaluator, history, profile
    tvc-memory.c            the mapper (port 02h), EXT/EXTH, CART, U0-U3, VID0-3, ROM upload, peek/poke
    tvc-ports.c             the I/O decode, mirrors, status port 59h, the expansion bus stubs
    tvc-timing.c            the half-T phase, DEB phase, clock stretch, WAIT (§3.1, §3.2)
    tvc-crtc.c              a 6845 (variant flag: Hitachi type 0 / Motorola, decision D6)
    tvc-video.c             the pixel pipeline, blanking, sync monostables, TV window, IT flip-flop
    tvc-keyboard.c          the 11 x 8 matrix (ports 03h / 58h)
    tvc-audio.c             divider, 4-bit counter, DAC, sound IT, DC high-pass, sample buffer
    tvc-tape.c              pulse player (ECIN), output toggle recorder, motor, fast-load and SAVE traps
scripts/build-tvc-wasm.cjs (+ .d.cts)
scripts/check-tvc-wasm-size.cjs
scripts/benchmark-tvc-wasm.cjs
```

The hook block in `tvc.c` (names illustrative):

```c
#define Z80_EXTERNAL_BUS 1
#define Z80_READ_MEMORY(a)          tvcReadMemory(a)
#define Z80_WRITE_MEMORY(a, v)      tvcWriteMemory(a, v)      /* catches video up before a VRAM write */
#define Z80_READ_PORT(a)            tvcReadPort(a)
#define Z80_WRITE_PORT(a, v)        tvcWritePort(a, v)
#define Z80_DELAY_MEMORY_READ(a)    tvcDelayMemory(a, 0)      /* 3 T + stretch if VRAM */
#define Z80_DELAY_MEMORY_WRITE(a)   tvcDelayMemory(a, 0)
#define Z80_DELAY_OPCODE_FETCH(a)   tvcDelayMemory(a, 1)      /* new hook H1 (§5): M1 stretch + WAIT */
#define Z80_TACT_PLUS_N(n)          tvcAdvanceTacts(n)        /* sound divider, tape edges; video lazily */
#define Z80_INT_ACK()               ((void)0)                 /* the IT flip-flop is cleared by OUT (07h) only */
#include "../../../../z80/wasm/z80.c"
```

No refresh hook is needed. A refresh cycle is not a memory read, and the stretch circuit decodes
`/MREQ` with the video RAM select, so a refresh whose address falls in video RAM might trigger a
stretch. That is an open hardware question (overview §6; stretch file "Open points"). The proposal
is to assume it does not, record the choice, and leave a define to switch it.

### 4.2 TypeScript (the HT-1080Z pattern)
```
src/emu/machines/tvc/
  TvcWasmHost.ts            abstract host: keys, typer, partitions, sysVars, injection flow
  TvcWasmV2Machine.ts       the adapter: registers proxied to the core, screen, audio, tape, state,
                            IExecutionHistorySource, IAccessProfileSource
  TvcMachineFactory.ts
  tvcMachineInfo.ts         models (§4.3), clocks, ROM ids
  TvcRoms.ts                ROM sets per model (the HT1080Z_ROM_SETS shape)
  TvcKeyCode.ts             the matrix keys and their legends (Hungarian keyboard)
  TvcKeyMappings.ts         host key → matrix
  TvcTyper.ts               auto-type
  TvcCasFile.ts             .cas recognition, header parsing, program name and type
  TvcSysVars.ts             system variables for the SysVars panel
```
Add a separation test like `test/zx8081/zx8081-separation.test.ts`: the host imports no TS machine
device code.

### 4.3 Machine ID and models (decision D2)
**One machine ID, `MI_TVC = "tvc"`, display name "Videoton TV Computer (TVC)":**

| Model id | Board | RAM / video RAM | ROMs | WAIT circuit |
|---|---|---|---|---|
| `tvc64` | HBA-1 | 64K / 16K | BASIC 1.2 (`TVC12_D4`, `D3`, `D7`) | yes (jumper default, §13 Q4) |
| `tvc64p` | HBA-2 | 64K / 4 × 16K | BASIC 2.2 (`TVC22_D6`, `D4`, `D7`) | no: the HBA-2 has none (HW p.95) |

- `MC_TVC_HBF` (off by default) plugs the HBF card into slot 0 (phase 8).
- `MC_TVC_COLOUR` reports a colour (default) or monochrome monitor in port `59h` bit 6. The ROM uses
  it to pick its default palette.

---

## 5. Shared Z80 core change (Phase 1, before any TVC code)

**H1 — `Z80_DELAY_OPCODE_FETCH(address)`**, by default `delayMemoryRead(address)`.
- `readOpcodeMemory` calls it instead of `delayMemoryRead` for the fetch of every M1:
  - the unprefixed opcode;
  - the opcode after a `CB`/`ED`/`DD`/`FD` prefix;
  - each further `DD`/`FD` repeated as a prefix.
- It is **not** used for operand bytes, displacements or the `DDCB`/`FDCB` opcode read. Those keep
  `delayMemoryRead` through `readCodeMemory`.
- Undefined, it expands to exactly today's call, so every core is tact-identical by construction.
- Prove it anyway: rebuild every core and run its suites. The 48K/128K/+3E contention tests, the
  Next and Z88 goldens, the ZX81 and HT-1080Z screen goldens and
  `test/wasm/debug-loop-equivalence.test.ts` must stay identical.
- Document H1 in `src/emu/z80/wasm/README.md` ("Contention hooks"), add it to
  `scripts/check-wasm-cpu-contract.cjs`, and add a WASM-only test TU in `test/wasm/z80/hooks/`. The
  test counts H1 calls for `NOP`, `CB 00`, `DD 21 nn nn`, `DD DD 00` and `DD CB d 06`, with the
  expected counts 1, 2, 2, 3 and 2.
- **No TS mirror is needed.** `Z80Cpu.ts` has no WASM macros, and H1 changes no behaviour of a
  machine that doesn't define it. This matches the ZX81 plan's rule for C2.

---

## 6. CPU timing: the stretch and the WAIT (`tvc-timing.c`)

The rules come from `TVC_CLOCK_STRETCH_FIGURES.md` (figures 20–22) and HW pp.53–55:
1. Video RAM is "addressed" when the address falls in a page that the mapper currently maps to
   VID: page 2 on every model; page 1 on the 64K+ when port `02h` bit 2 is set.
2. For a data read/write of video RAM, the stretch is 2, 1, 4 or 3 half-T for a T1 phase of 0, 1, 2
   or 3 relative to the start of the CPU slot. For an M1 it is 3, 2, 1 or 4.
3. `tvcDelayMemory(a, m1)` adds 3 T for a read/write. For an M1 it adds 3 T for the fetch's first
   three tacts (the core adds the refresh tact). It then adds the stretch if rule 1 holds, carrying
   the half phase as in §3.1.
4. **WAIT (64K only, decision on jumpers in §13 Q4):** one extra T on an M1 whose address is the
   cartridge, an expansion card, or the system ROM if the jumpers select it (HW pp.95–96). An M1
   from video RAM gets the stretch only.
5. **DEB phase at reset** is fixed by the reset logic (HW p.49), but its value isn't printed.
   Choose phase 0, record it in the README, and make it a single constant.

**Proof:** a test program for each of the four phases. It aligns itself to DEB using the cursor
interrupt, then times a loop of `LD A,(8000h)` against the same loop on `LD A,(4000h)` through the
sound timer interrupt, and checks the predicted T-state totals. This puts the stretch table under
test. It isn't verified on real hardware: record the oracle comparison (ep128emu, which models
cycle-level video RAM sync) in Klive's words.

---

## 7. The CRTC and the video generator (`tvc-crtc.c`, `tvc-video.c`)

Every fact here is in `TVC_VIDEO_GENERATION.md`; the part numbers point there.
- **CRTC (Part 3):**
  - ports `70h–7Fh` mirrored on A0;
  - R12–R15 readable (type 0) and R16–R17 read-only;
  - counters per the generic 6845 rules: MA counts through the border, and R12–R13 are reloaded
    at the frame restart;
  - VS width from R3's high nibble on the Hitachi variant, fixed at 16 lines on the Motorola one
    (D6);
  - R8 interlace and skew are ignored, and the README records it.
- **Address (Part 4):** VRAM = RA0–1 → A6–7, MA0–5 → A0–5, MA6–11 → A8–13, applied to every
  character's MA, so odd R1 values and start addresses show as on hardware. On the 64K+, the
  displayed bank comes from port `0Ch` bits 4–5, latched at the next CRTC slot.
- **Pixels (Part 6):**
  - 2-colour: bit 7 first;
  - 4-colour: pixel *n* = 2·bit(3−*n*) + bit(7−*n*);
  - 16-colour: left = bits 7/5/3/1, right = 6/4/2/0, as I/G/R/B;
  - mode `11` = 16-colour.
- **Colour (Part 7):** palette byte `xIxGxRxB`, border byte `IxGxRxBx`. The palette is not reset and
  the border is. "Bright black" is black.
- **RGB levels:** derive them from the 270 Ω / 360 Ω network, not `7Fh`/`FFh`. Put them in one table
  so a later measurement can replace them.
- **Paper/border (Part 8):** DE is delayed one character, and the fetched byte is shown one
  character after its fetch.
- **Blanking (Part 8):**
  - a 14.4 µs (22.5 characters) horizontal blank from HS rising;
  - a vertical blank latch set by the VS monostable and cleared while MA9 is 1;
  - blanking forces the colour to 0.
- **Sync (Part 9):**
  - line sync 4.5 µs from HS falling;
  - frame sync 135 µs from VS rising;
  - the widths are constants in one table, with their R and C values in a comment.
- **Interrupt (Part 10):**
  - the IT flip-flop is clocked by the falling edge of NOR(cursor, sound IT), which is the end of
    the cursor pulse. A held sound IT therefore masks the cursor edge;
  - port `59h` bit 4 reads the flip-flop (active low);
  - any `OUT (07h)` clears it.
- **TV window (decision D4):** proposal: **608 × 288** (76 characters × 8 pixels, 288 lines).
  - The window is placed relative to the shaped syncs as a TV would place it, with the paper
    centred for the ROM's values. With those values the window holds 6 characters of left border,
    of which about 2.5 are still blanked (black), and 6 characters of right border.
  - The aspect ratio is about 0.59 (52 µs of active line at 12.5 MHz against 288 lines on 4:3).
  - When a program's sync falls outside a TV's capture range, show the signal-lost picture, as
    the HT-1080Z does with `isVideoSignalLost`.
- **Beam position:** expose `getBeamPosition` and join `BEAM_POSITION_MACHINE_IDS`. Raster work is
  the TVC's main trick, so the IDE should show where the beam is.

---

## 8. Keyboard
- An 11 × 8 active-low matrix. Port `03h` bits 0–3 select the row (bits 6–7 select the EXT card)
  and port `58h` reads it. Rows 0–8 are documented in `rtvc/info/tvc.md`.
  - Row 8 carries the cursor keys and "Tab/Fire", which BASIC's `JOY` reads as joystick 1.
  - Rows 9–10 are open (§13 Q6). Find them in the ROM's key scan, or in the keyboard schematic
    sheet, before mapping a second joystick.
- Host mapping:
  - letters and digits by position on a Hungarian QWERTZ layout;
  - the accented keys (`á é í ó ö ő ú ü ű`) by character when the host layout has them, and on
    unused positions otherwise;
  - Lock, Alt, Esc, Ctrl and Shift mapped one to one;
  - cursor keys to row 8.
- **Virtual keyboard:** design it first and get it approved, as the ZX81's was (a mockup under
  `.plans/tvc/`, then the `KeyboardPanel.tsx` branch). Remember its two edits: the render branch and
  the exclusion list. Colours go in `palette.ts` / `semantic.ts` / `componentAliases.ts` as tokens,
  and the theming lessons file gets a short TVC entry.
- Wire the joystick into Klive's joystick input, if the joystick plan's abstraction allows it.
  Otherwise list it as a follow-up.

---

## 9. Tape, files and disks

### 9.1 Opening files (TS)
`TvcCasFile.ts` recognises a `.cas` file by its 144-byte header and reads the name, type, length and
autostart. Wire it into:
- `MainToEmuProcessor.ts`, `TapeLoadCommand.ts`, `TapeLaunchMenu.tsx` and `dropped-file-action.ts`;
- `src/main/open-file.ts` (a `common.filter.tvcTapes` filter) and `sniff-content-kind.ts`;
- a CAS viewer panel like `DocumentPanels/Ht1080zTape/`, showing the header and a hex view;
- the media tool strip in `tool-registry.tsx`.

### 9.2 Fast load (ROM trap)
Trap the ROM's block-read routine and copy the CAS payload in directly. This needs the cassette
read entry points of BASIC 1.2 and 2.2, read from the ROM (the HW ROM book and the ROM listings
are allowed for this, as behaviour, §0.1). The trap must:
- restore the border colour the loader changes;
- leave the sound timer state as the ROM would;
- set the same system variables as a real load.

**Proof:** a fast load and a real-time load of the same file end in identical RAM and system
variables.

### 9.3 Real-time load and SAVE
- **Load:** `tvc-tape.c` plays the CAS file as pulses on port `59h` bit 5 (ECIN), using rtvc's
  pulse lengths (pilot 1,276 T, sync 2,410 T, bit 0 1,558 T, bit 1 1,134 T per period) and its block
  layout and CRC. Edges land at their exact T-state, and motor control (port `05h` bits 6–7) pauses
  the tape.
- **SAVE:** record the output toggles (any access to `50h–57h`), decode the FSK back into blocks,
  check the CRC, and publish a `.cas` file through `SAVED_TO_TAPE`, as the ZX81 and HT-1080Z do.

### 9.4 Phase 8: the HBF card and VT-DOS
- **Extract the WD1793** from `src/emu/machines/zxSpectrum/wasm/common/zx-spectrum-beta128.c` into
  a shared `src/emu/machines/common/wasm/wd1793.c`. Its geometry (Beta 128: 16 × 256-byte sectors)
  becomes a parameter. The refactor is its own commit, and the Beta 128 tests must stay identical.
- The HBF card:
  - slot 0, I/O `10h–1Fh`, card ID 2;
  - 16K ROM in four 4K pages at `C000h`, and 4K RAM at `D000h`;
  - the drive parameter register and the fast status port.
- Raw `.dsk` images, with geometry taken from the FAT12 boot sector (360K and 720K).
- VT-DOS boots. `MC_TVC_HBF` switches the card on, and the VT-DOS ROM becomes part of the model's
  ROM set.
- VT-DOS moves the cursor interrupt to line 175, and the video tests must still pass afterwards.

---

## 10. Sound (`tvc-audio.c`)
- The 12-bit divider at 3.125 MHz counts 4096 − *n*. Its carry drives a 4-bit counter, and bit 3 of
  that counter is the square wave.
- Port `05h` bit 4 gates the 4-bit amplitude (port `06h` bits 2–5) with the square wave. With the
  bit clear, the DAC level goes straight out.
- Port `05h` bit 5 lets a counter wrap raise the shared IT. `IN (5Bh)`/`(5Fh)` restarts the divider
  and the counter.
- The first interrupt after a restart is open: the manual says 8 periods, the emulators 16
  (§13 Q2). Make it one constant, defaulting to 16, and record the choice.
- The output is mono, with the DC high-pass and stereo buffer of `ht1080z-audio.c`, read through
  `getAudioSamples()`.
- Port `06h` is shared by the mode bits, the amplitude and the printer strobe. Each consumer takes
  only its own bits.

---

## 11. IDE integration checklist
These are grouped as in the HT-1080Z's wiring. The easily missed items are marked **(2×)**, a list
kept in two places.

- **Registry:**
  - `constants.ts`: `MI_TVC`, the `MC_TVC_*` keys, and `MEDIA_INFO_MACHINE_IDS` /
    `BEAM_POSITION_MACHINE_IDS`.
  - `machine-registry.ts`: features `MF_Z80`, `MF_TAPE_SUPPORT`, `MF_INJECT_SUPPORT`,
    `MF_EXEC_HISTORY`, `MF_REVERSE_DEBUG`, `MF_PROFILE`; models; media ids; tool info with a
    custom disassembler; a TVC `charSet` (`char-codes.ts`, including the Hungarian letters).
  - `machine-renderer-registry.ts`, `hardware-specs.ts` (+ `hardware.*` i18n keys),
    `NewProjectModel.ts` `MACHINE_FAMILIES`, and a project template under
    `src/public/project-templates/tvc/`.
- **Build and packaging:**
  - `package.json`: `build:tvc-wasm` and `check:tvc-wasm-size`, plus an entry in `build:all-wasm`
    **and** in `extraResources` **(2×)**.
  - `scripts/check-wasm-cpu-contract.cjs`, `src/main/unit-tests/wasmArtifacts.ts`,
    `src/common/headless/headlessMachines.ts` + `HeadlessMachineFactory.ts`,
    `src/emu/machines/reverse/exportContract.ts`.
- **Tests:**
  - `test/vitest.setup.ts` `CORE_EXPORT` gets the `tvc` prefix;
  - `build/e2e-tests.ts` gets `test/tvc-hw/**`;
  - `scripts/run-tests.cjs` `CORE_INPUTS` should also cover `test/tvc-hw`. It doesn't for the
    existing `-hw` folders: fix that for all of them in the same change.
- **State:** `STATE_MACHINES` in `src/main/machine-menus/state-menus.ts` **and**
  `MachineStateCommands.ts` **(2×)**, plus `coreIdOfMachine` in `machineStateFile.ts`.
- **Menus:** `machine-menu-registry.ts` + `tvc-menus.ts` (tape, the HBF switch, the monitor type).
- **Debugger:**
  - memory partitions: SYS, CART, EXTH, U0–U3, VID0–3 and HBF ROM/RAM, through
    `getPartitionLabels` / `getPartition` and `bankSpace.ts`;
  - history and profile contexts (`src/common/history/contexts/`, `src/common/profile/layouts/`);
  - a custom disassembler that knows the ROM's `RST` argument conventions, once they are read
    from the ROM.
- **A TVC video panel** (new, `restrictTo: [MI_TVC]`):
  - the CRTC registers with their meaning;
  - the counters (row, raster, character, MA);
  - the mode, palette, border and 64K+ banks;
  - the cursor-interrupt line;
  - the blank-latch state.

  Build it on `@renderer/controls/data`, with `ch` widths and row-size tokens (rules M1–M3), and
  with `--color-state-value` like the other converted state panels.
- **BASIC listing:** a TVC BASIC detokeniser for `BasicPanel.tsx`. The token table must be read from
  the ROM, in Klive's own code. rtvc's `basic.rs` is MIT and may be ported with its notice.
- **ROM annotations:** none in this plan. Writing TVC ROM sidecars is ROM-annotation work under its
  own rules (§14).
- **Assembler:**
  - `.model TVC` in `VALID_MODELS`, `SpectrumModelTypes.ts` (enum, name map,
    `isTvcModelType`), `compile-code.ts` and `UnitTestRunner.ts`;
  - the completion list in `z80-completion-data.ts`. HT1080Z is missing from it today: add both.
- **Run/Debug injection:** boot to `OK`, place the code in U-RAM, set PC. The placement rules (where
  BASIC's workspace starts) live in `src/common/tvc/codePlacement.ts`, modelled on the HT-1080Z's.
  Export to `.cas` as a machine-code file with autostart, through `ExportCodeModel.ts`.
- **CLI:** `src/cli/run/inputs.ts` and `src/cli/verbs/run.ts` `--machine tvc`, plus
  `unitTestMachines.ts`.
- **i18n:** every new UI text goes through `t()` with an English entry and translator context, then
  `npm run i18n:keys`. Expect keys in `emu`, `menu`, `panels`, `panels-media`, `dialogs`,
  `hardware`, `common` and `compiler`.

---

## 12. Tests
All tests run the real WASM machine.
- **Core (Phase 1):** the H1 test TU (§5), and every existing core rebuilt and green.
- **Harness `test/harness/tvc/`** (copy `test/harness/ht1080z/`):
  - `bootToBasic()` waits for `OK`, observed through screen memory and the editor's system
    variables, not pixels;
  - `typeKeys`, `runFrames`, `runTo`, `step`, `peek`/`poke`, `loadCas(file)`, `screenPixels()`;
  - `crtc()` (registers and counters) and `beam()`.
- **Hardware tests (`test/tvc-hw/`)**, one file per topic:
  - memory map: every port `02h` combination, `0Ch` banking on the 64K+, the EXT/EXTH split, the
    page-0 `11b` alias on the 64K;
  - CRTC: 100 × 314 with the ROM's values; DE, HS and VS at their characters and lines; the R12
    reload at the frame restart; a cursor interrupt at 47,928 T after the frame start; VT-DOS's
    `0AFFh` at line 175 (phase 8);
  - video pipeline: one test per colour mode with the worked byte `B4h`; a palette change and a
    border change mid-line landing on the right character; DE one character late; the horizontal
    blank of 22.5 characters; vertical blank release at lines 284 / 280 / 268 for start addresses
    `0000h` / `0040h` / `0100h`, and none for `0200h`;
  - interrupt: masking by a held sound IT; `OUT (07h)` clears; port `59h` bit 4;
  - timing: the four stretch phases for read, write and M1 (§6); WAIT on the 64K only; the debug
    loop stops exactly where single-stepping does (`test/wasm/debug-loop-equivalence.test.ts` gets
    the TVC);
  - sound: pitch from *n*, DAC mode, the timer interrupt period and the restart;
  - tape: fast load and real-time load give identical RAM; motor pause; SAVE round-trip.
- **Screen goldens** (`.ai/visual-tests-guide.md`): the boot screen (64K and 64K+), each colour
  mode, a border-stripe raster program, a palette split, and the 64K+ bank flip. Record goldens
  only after checking them by eye.
  - Test programs are **written for Klive** (typed through the harness or assembled), or taken from
    `rtvc/coding/` with its MIT notice.
  - `rtvc/progs/` games have no licence information and **must not** become fixtures.
- **Cross-core suites** that list every core: the contract test, state determinism and layout,
  reverse journal and export contract, history drivers, profile, `debug-recording-cores`,
  `hardware-specs`, machine-select, new-project, menu structure, `runner-machines`, CLI e2e.
- **Oracle runs (manual, never in CI):** run the same Klive-written programs in rtvc (built from
  `_input/videoton-tvc/rtvc`), MAME and ep128emu, and compare screens and interrupt timing. Record
  the observed results in Klive's words. Where Klive and the oracles disagree, the research pack
  decides, and the README says why.
- **Performance:** `benchmark:tvc-wasm` must show more than 10× real time. The per-character
  renderer is the hot path.
- **Tiers:** every core test goes in `build/e2e-tests.ts`. A file over 20 s moves to
  `E2E_SLOW_TESTS`.

---

## 13. Open hardware questions that affect the code
Each gets one constant or define, its default and its reason in the core README. None blocks a
phase.

| # | Question | Default | Where it is discussed |
|---|---|---|---|
| Q1 | Hitachi type-0 or Motorola 6845 | type 0 (R12–R13 readable, VS width from R3) | video article Part 3, Part 13 item 1 |
| Q2 | First sound IT after a restart: 8 or 16 periods | 16. New evidence (§17): the ROM times its tape with this, so a real recording's frequencies would decide it | overview §6 item 2 |
| Q3 | Does a refresh cycle that falls in video RAM stretch the clock? | no | stretch file "Open points" |
| Q4 | The WAIT jumpers TB1/TB9 on the 64K: is the system ROM slow? | Not settled in Phase 3 (the factory setting is not on the sheets read). As built: the cartridge is slow, the system ROM is not, no card is plugged in | HW pp.95–96 |
| Q5 | Exact sub-character timing (LOAD, the 74LS298/273 clocks) | everything at character granularity | video article Part 13 item 6 |
| Q6 | Keyboard rows 9–10 | not mapped | `rtvc/info/tvc.md` "Matrix" |
| Q7 | DEB phase after reset | 0 | §6 rule 5 |
| Q8 | The HBA-2's R38 printed 68k | 6.8k, the same blank as the HBA | video article Part 9 |
| Q9 | 64K+ refresh of the 4164's upper 128 rows | no effect (the emulator doesn't model DRAM decay) | video article Part 4 |

---

## 14. Phases and exit criteria

| Phase | Content | Exit criteria |
|---|---|---|
| **0. Decisions** | Settle D1–D7 (§15) with the project author. | Done 2026-10-27: recorded in §15. |
| **1. Core hook** | H1 (§5). | Done 2026-10-27. H1 is compiled only under `#ifdef`, on both M1 paths (the fetch and the halted cycle). All eight core artifacts rebuilt **byte-identical** to the ones built from the previous `z80.c`. `test:fast` green (1,366 files); `build:check` no new errors. Test: `test/wasm/z80-hooks/z80-opcode-fetch.test.ts`. |
| **2. Skeleton** | `tvc.c` TU; mapper; ROM upload; ports; keyboard; the CRTC counters and the cursor IT (no pixels yet); a frame loop ending at the CRTC wrap; loader; host; registry entry for `tvc64` only; build and contract scripts. | Done 2026-10-27 (with Phase 3): `bootToBasic()` reaches BASIC 1.2's `ok`; `test/tvc-hw/boot.test.ts`. |
| **3. Video + timing** | §6 and §7: the pixel pipeline, blanking, sync, TV window, beam position, the stretch and WAIT. | Done 2026-10-27: the boot picture's hash (checked by eye); `video.test.ts`, `timing.test.ts`, `programs.test.ts` (`PRINT "HELLO"`, a stable interrupt-driven border band); the TVC in `debug-loop-equivalence.test.ts`. |
| **4. Sound + tape + keyboard** | §8, §9.1–9.3, §10: host mapping, the virtual keyboard (after its design is approved), `.cas` open, fast and real-time load, SAVE, motor, sound. | Done 2026-10-27, except the virtual keyboard: `sound.test.ts`, `tape.test.ts` (SAVE to `.cas`, LOAD + RUN in a fresh machine), `keyboard.test.ts`; a `.cas` inserted from the IDE loads with BASIC's `LOAD` in the running app. |
| **5. 64K+** | The `tvc64p` model, BASIC 2.2, four video banks, no WAIT. | Done 2026-10-27: `plus.test.ts` (the boot picture's hash, checked by eye; port 0Ch's CPU and display banks; page 0 = U3); the 64K+ boots and loads a tape in the running app. |
| **6. IDE** | Partitions, the TVC video panel, BASIC listing, charset, disassembler, menus, state files, history, profile, CLI. | Done 2026-10-28 (§17): `test/tvc-hw/debug.test.ts`, `profile.test.ts`, `basic-listing.test.ts`, `charset.test.ts`; the TVC in every cross-core suite (history, profile, state determinism, export contract, journal replay, debug recordings, hardware specs); `MF_EXEC_HISTORY`, `MF_PROFILE` and `MF_REVERSE_DEBUG` on. |
| **7. Assembler** | `.model TVC`, injection, `.cas` export, project template. | Done 2026-10-28 (§17): `test/tvc-hw/code-injection.test.ts`, `project-templates.test.ts` (both runs checked by eye), `tape-load-flow.test.ts`; `klive run` and `klive test` on the TVC. |
| **8. HBF + VT-DOS** | §9.4: the WD1793 extraction (its own commit, Beta 128 tests identical), the HBF card, `.dsk`. | Done 2026-10-28 (§17): the extraction (605e69775) rebuilds the 128K core byte-identical; `test/tvc-hw/hbf.test.ts` lists the system disk's directory (checked by eye), round-trips a program through the disk and through the published image, and finds the interrupt on line 175. |
| **9. Ship** | Notices (`THIRD_PARTY_NOTICES.md`, the ROM readme), docs pages, an `AGENTS.md` section, the landing-page machine table (also missing the HT-1080Z), `README.md`'s machine list, a `.ai/` note in `wasm-migration-intent-and-lessons.md`, one `feature` changeset. Run `npm run test:slow` before release. | A packaged build runs both models; `build:check`, `lint:renderer`, `i18n:check`, `doc:build` + `doc:check` are green. |

The changeset comes with the commit that completes the plan (AGENTS.md). Phase commits before that
carry none. Docs for phase 9:
- `docs/content/en/guides/machines/tvc.mdx`, `reference/machine-types.mdx` and
  `reference/z80-assembler/tvc.mdx`;
- an "Under the hood" article on the TVC picture, adapted from `TVC_VIDEO_GENERATION.md` under
  `.ai/hardware-articles-guide.md`. In the published article the sources stay unnamed and the
  facts are proved on the emulated machine;
- the route and asset goldens;
- screenshots from a `scripts/doc-shots/recipes/tvc.cjs` recipe.

### Follow-ups (not in this plan)
- Pixel-exact (sub-character) palette, border and mode changes (Q5).
- ROM annotations for BASIC 1.2 / 2.2 written from scratch (`.ai/rom-annotations/` rules).
- The TVC 32K and other ROM revisions; cartridges; other expansion cards; the printer.
- A PAL composite model with the LM1886's limits and subcarrier artefacts.
- Klive BASIC or z88dk targets for the TVC.

---

## 15. Decisions (accepted by the project author on 2026-10-27)

All seven recommendations were accepted as written:
- **D1:** Klive's own code; rtvc ported with its notice where useful; MAME for interface facts;
  GPL emulators as oracles only; rtvc's ROM listings never used for sidecars.
- **D2:** one machine ID, `tvc`, with the models `tvc64` and `tvc64p`.
- **D3:** ship the ROMs with a readme and a notice section, removed on request.
- **D4:** a 608 × 288 window, aspect about 0.59, paper centred.
- **D5:** whole T-states plus a half-T phase bit.
- **D6:** a Hitachi type-0 6845 by default, with a Motorola flag.
- **D7:** HBF and VT-DOS as phase 8 of this plan.

The original questions follow for the record.

- **D1 — provenance.** *Recommendation:*
  - Klive's own code from the research pack;
  - rtvc (MIT) may be ported with its notice where it saves work: CAS, HBF, the BASIC detokeniser;
  - MAME is read for interface facts;
  - GPL emulators are run as oracles only;
  - rtvc's ROM listings are never used for shipped sidecars.
- **D2 — one machine ID (`tvc`) with the models `tvc64` and `tvc64p`** (§4.3). *Recommendation:
  yes.* The two models differ in ROM, video RAM and WAIT, not in how users think of the machine.
- **D3 — ship the ROMs?** Nothing in the pack states their licence.
  - *Recommendation:* ship them under the policy already applied to the HT-1080Z and Interface 1
    ROMs. That means a `tvc-roms-readme.txt` stating their origin, a `THIRD_PARTY_NOTICES.md`
    section, and removal on request from a rights holder.
  - The alternative is a user-supplied ROM setting (the Timex pattern). It would also keep the ROMs
    out of CI, which would gut the test plan.
- **D4 — the visible window: 608 × 288 at the 12.5 MHz dot pitch, aspect about 0.59, paper
  centred** (§7). *Recommendation: yes.*
- **D5 — CPU timing as whole T-states plus a half-T phase bit** (§3.1). *Recommendation: yes.*
- **D6 — the 6845 variant: Hitachi type 0 by default, with a Motorola flag** (Q1). *Recommendation:
  yes.* The manual describes type-0 behaviour, and the flag costs one branch.
- **D7 — HBF/VT-DOS in this plan, as phase 8, or as a plan of its own.** *Recommendation: in this
  plan.* It shares the machine's test harness, and VT-DOS's moved cursor interrupt is a real test of
  the video model.

---

## 16. Risks
- **The per-character video work and the per-access stretch check are the hot path.** Keep the
  video RAM test to one compare on a precomputed page mask, and let the renderer catch up lazily (at
  port writes, VRAM writes and the frame end), not in `Z80_TACT_PLUS_N`.
- **No real hardware to check against.** The research pack is the reference, and every fact in it
  cites the manual or the schematic. Where the oracles agree with each other and disagree with the
  pack, it isn't automatically the pack that is wrong: the video article lists behaviour that
  neither emulator models. Record each such case and its resolution in the core README.
- **The H1 hook touches the shared CPU.** It is its own phase, with every core rebuilt, before any
  TVC code lands.
- **Debug-run state.** Anything the in-core debug loop writes that a fast frame does not (the half
  phase included) must be volatile, or replays stop matching the runs they replay
  (`src/emu/z80/wasm/README.md`).
- **The Hungarian keyboard** on non-Hungarian hosts. Keep the mapping data-driven and testable
  (`TvcKeyMappings.ts`), and give the accented keys a visible place on the virtual keyboard.
- **ROM rights (D3).** If a rights holder objects, the user-supplied ROM path must be easy to add.
  Keep ROM loading behind `TvcRoms.ts`, so that path is a settings change and not a rewrite.

---

## 17. Implementation record

### Phases 1-3 (2026-10-27)

The core's README (`src/emu/machines/tvc/wasm/README.md`) is the reference for how it works now.
Phases 2 and 3 were built together: the ROM cannot reach its prompt without the CRTC's interrupt,
and its sign-on needs the picture to be checked.

- **Phase 1:** H1 is compiled only under `#ifdef Z80_DELAY_OPCODE_FETCH`, on both M1 paths (the
  fetch, and the halted cycle, which is an M1 too). The `DDCB`/`FDCB` displacement keeps the plain
  read. All eight existing artifacts rebuilt byte-identical.
- **Time (§3.1, D5):** as planned: `cpu.tacts` plus `tvcHalfClock`, whose lowest bit is the half-T
  phase. The CRTC runs eagerly, one character every 4 half-T units, inside `Z80_TACT_PLUS_N`, not
  lazily as §3.4 proposed. It is simpler, it makes palette, border, mode and video RAM writes exact
  to the character without catch-up calls. The core is 170 KB; the boot test runs BASIC's 320
  boot frames (6.4 s of machine time) in under 0.2 s.
- **What booting takes:** BASIC 1.2 tests every RAM page destructively (about 250 frames, 5 s, the
  video RAM pages slowed by the stretch), then shows an animated VIDEOTON sign-on and waits for any
  key, then prints `TV COMPUTER BASIC 1.2 / Copyright 1985 VIDEOTON / 42255 bytes free / ok`. The
  harness's landmark is "palette 0 black and the ROM in KB_CHIN (D618h-D62Ch)"; the sign-on polls the
  keyboard through the same routine, and BASIC loops inside it, never re-entering at D618h.
- **A finding, from the stretch table:** a stretch leaves the CPU at a fixed phase relative to the
  slots, so code that keeps touching video RAM locks to them. A NOP sled in video RAM settles at
  phase 3, at 6 T per NOP (`timing.test.ts`). Worth an "Under the hood" paragraph in Phase 9.
- **Tests that only the hook makes possible:** `tvcSetHalfClock` (an export for tests and the
  debugger) places an access at a chosen phase, so every row of the stretch table is checked.
- **Deviations:**
  - The registry lists only `tvc64` until Phase 5 tests BASIC 2.2 (`machine-select.test.ts` counts
    the TVC as a one-model leaf until then). The 64K+'s core path (four banks, no WAIT) is in place
    and the WAIT test runs on it.
  - The beam position (`getBeamPosition`) uses a fixed map for the ROM's CRTC values; a program that
    reprograms the CRTC moves the picture and the overlay no longer matches it.
  - The core carries the history recorder and the access profile (the debug loop needs the history),
    but the TypeScript side does not offer them yet (`MF_EXEC_HISTORY`, `MF_PROFILE` off): Phase 6,
    with partitions and state files.
  - The hardware sheet lists no media until the tape works (Phase 4).
  - The host keyboard: letters, digits and punctuation by key, the Hungarian accented letters on
    F1-F9 for now (`TvcKeyMappings.ts`); Phase 4's virtual keyboard settles the layout.
  - Write-only CRTC registers read 00h (an assumption, recorded in `tvc-crtc.c`).
- **Not done yet from §11:** state files, partitions, history and profile in the IDE, the video
  panel, menus, CLI, headless (`HEADLESS_MACHINES`), `wasmArtifacts.ts`, the project template, the
  assembler. They are Phases 6-7.

### Phases 4-5 (2026-10-27)

- **Sound:** as planned. The counter is a function of time (an anchor and a period), and the
  samples integrate the square wave in closed form. The interrupt input is QD in the NOR gate with
  the cursor. The ROM's own tape code is the most demanding user of it.
- **Tape, playing:** the host builds a tape program (silence, cycle runs, bytes) from the `.cas`;
  the core plays it on port 59h bit 5 while the motor runs. Both a tape at the established
  converter's timings and one this core saved load with BASIC's `LOAD`.
- **Tape, fast load: a turbo, not a ROM trap (a deviation from §9.2).** While the tape plays with
  its motor on, a displayed frame runs 25 machine frames. A trap would have had to replace the
  ROM's pilot calibration, CRC (kept in IY) and sector checks (EXTH F77Bh-F95Ch). The turbo keeps
  the load exact, costs nothing to maintain, and makes an 8-second load take about a third of a
  second.
- **Tape, SAVE:** decoded from the output toggles by half-periods, with thresholds relative to the
  measured pilot, then rebuilt into a `.cas` with every CRC checked. Two traps on the way:
  - the first toggle after a pause shifted the pairing of halves (so the decoder works on halves);
  - the ROM stops the motor between the header and the data (so a recording is published only after
    a data block).
- **A Q2 finding:** the ROM times each tape half-period with the sound timer (EXTH `CAS_SET_TIMING`:
  `HALT`, toggle, set the divisor, `IN 5Bh`). With the 16-period first interrupt it writes 1,466 T
  pilot cycles, against the established converter's 1,276 T. The divisors are 42, 34, 50 and 68
  counts for the pilot, 1, 0 and sync. Measuring a real TVC's recording would settle Q2.
- **The typer** (`TvcTyper.ts`) was built from what the keys were seen to type on the running
  machine: lower case plain, upper case with SHIFT; the shifted digits `' " + ! % / = ( )`; the
  punctuation pairs; the accented letters. SHIFT+0's glyph was unclear and is left out.
- **The IDE:**
  - a `.cas` on the TVC goes in the deck from the tape menu, the media strip, File > Open, a drop,
    or `tape-load`;
  - `tape-load -r`/`-d`/`-e` and "Load and Run" are not offered: starting the load needs the
    power-on flow through the sign-on, which comes with Phase 7's injection.
- **Not done: the virtual keyboard.** Its design needs the real keyboard's key positions (a
  photograph or the manual's keyboard figure) before a mockup can be approved (§8).
- **Phase 5:** BASIC 2.2 boots on the 64K+ to "42155 bytes free". The harness finds its prompt by
  where the ROM was seen looping (CA9Fh-CAABh); there is no 2.2 listing.

### Phases 6-7 (2026-10-28)

- **Partitions:** U0-U3 are 0-3, VID0-VID3 4-7 (physical offset = partition x 16K), SYS -1, CART -2,
  EXT -3 (the card window, then EXTH). The history context decoder, the profile layout and the
  annotation bank space all use them; `test/tvc-hw/profile.test.ts` checks the decoder against the
  machine's own `getPartition` for every paging.
- **State, reverse debugging, history, profile:** the whole state is the core's image, so these came
  with the export contract's one new entry (`CrtcSetMotorola` is journaled). The journal-replay
  determinism test passes, so `MF_REVERSE_DEBUG` is on. Fast load runs extra core frames inside one
  displayed frame; the replay counts core frames, so it is not a problem.
- **RST 30h is a 2-byte call.** Both ROMs vector it through RAM (0030h: JP 0B23h) to a handler that
  takes the byte after the RST and returns past it. The dispatcher at C363h (1.2) splits the code:
  bit 7 a table, bits 6-4 the device (BASIC's peripheral numbers: 2 is the editor), bits 3-0 the
  function. 21h prints C at the cursor; CR (13) is column 0, LF (10) a line down. Two consequences:
  - the custom disassembler lists the byte after it as data, everywhere (not gated on the ROM);
  - `getCallInstructionLength` returns 2 for it, or Step Over never stopped (it waited at RST+1).
- **Charset:** the Hungarian letters are where BASIC stores them, read back from a typed string:
  ÁÉÍÓÖŐÚÜŰ at 00h-08h, the lower case at 10h-18h.
- **BASIC listing:** the token tables are the ROMs' (1.2 at DE6Dh, 2.2 at D73Ah, tokens FEh down to
  95h; 2.2 fills seven free slots: AUTO, FKEY, RENUMBER, EXCEPTION, ELLIPSE, RECTANGLE, POLYGON).
  Spaces are stored as typed; `:` is a token; REM/`!` tails, strings and DATA up to an unquoted colon
  are literal. The program starts at TEXT (1722h), which `LOMEM` moves. rtvc's `basic.rs` was not
  needed.
- **The typer** waits 12 frames after RETURN: BASIC 2.2 dropped the first keys of a line typed while
  it was still storing a long one.
- **The TVC Video panel** (Debug activity, TVC only): R0-R17 and the address register, the counters
  and MA, the mode, palette, border, vertical blank latch, the IT flip-flop, ports 02h/0Ch and the
  displayed bank (the last two on the 64K+). Values in `--color-state-value` from the start.
- **Run and Debug: BASIC calls the code (a deviation from §11's "set PC").** The flow:
  1. waits for the sign-on animation (1.2 CAB7h, 2.2 F2EEh; it does *not* use the key wait, and is
     first reached at frame 252/254, after the RAM test) and presses Space 10 frames in;
  2. waits for the prompt's key wait (1.2 D61Bh, 2.2 CA9Fh) and writes the code;
  3. types `LOMEM <end>` and `C=USR(<entry>)` 10 frames later (a key arriving the moment BASIC starts
     to wait is lost). The `TypeText` step got a `delayFrames` for this.

  So a `RET` lands in BASIC with no ROM return address to know, and BASIC never reaches the code. The
  code must lie in 1A30h-BBFFh (`common/tvc/codePlacement.ts`), Z0384/Z0385 warn about the rest, and
  `.model TVC` puts code with no `.org` at 1A30h.
- **Export:** a `.cas` program file with autostart: the one-line launcher `10 C=USR(entry)` at 19EFh
  (rtvc's `BASIC_START` layout), zeros, and the code where it was assembled. `LOAD` runs it.
- **Load and Run** (`tape-load -r`/`-d`, the `.cas` tab bar and Explorer menu, `klive run --machine
  tvc x.cas`): the same boot, then `LOAD`; `RUN` is typed once BASIC is idle again unless the tape
  starts itself. `-e` is refused: a TVC tape names no start address.
- **CLI and unit tests:** `klive run` takes a TVC project (the fixture `test/cli/fixtures/runtvc`) or a
  `.cas` with `--machine tvc` (a bare `.cas` stays the HT-1080Z's); `klive test` runs on both models.
  The runner's "wrapper in ROM" guard now uses 1A30h on the TVC instead of the Spectrum's 4000h.
- **Not done:** the virtual keyboard (as before), and a TVC tape viewer: a `.cas` document still opens
  in the HT-1080Z tape viewer, which cannot show a TVC file.

### Phase 8 (2026-10-28)

- **The WD1793 is shared** (`src/emu/machines/common/wasm/wd1793.c`, its own commit). The includer
  sets a name prefix, the geometry (drives, cylinders, sectors, sector size and its ID code, the slot
  pitch on the raw track) and four lines it reads from its interface (drive, side, master reset,
  head-load timing). The Beta 128 keeps its symbol names, and the 128K core rebuilds
  **byte-identical**. The test tiers now count every `test/*-hw` folder as a core input (§11's note).
- **The HBF card** (`tvc-hbf.c`, MAME's `hbf.cpp` and rtvc's notes read for facts): slot 0, I/O
  10h-1Fh (10-13 the controller, 14 status / drive register, 18 the ROM page), type 2 in port 5Ah.
  Its 16K ROM shows a 4K page at C000h and its 4K RAM at D000h. **The mapper went from eight 8K to
  sixteen 4K slots** for it, and port 03h's card bits now remap. The core's memory grew to 10 MiB for
  the two drives.
- **The ROM is VT-DOS v1.1 by MAME's CRC** (`d_tvcdos.128`), though the pack's file says 1.2; it
  ships as `tvc-vtdos.rom` with the other TVC ROMs (readme, notices, CRC test).
- **Disks:** a raw `.dsk`, its geometry from the FAT12 boot sector; the pack's system disk is 720K
  (80 x 2 x 9 x 512) and `tvball.dsk` is single-sided (80 x 1), spread over side 0 in the controller.
  The guest's writes are published as the whole image (`DSK_WHOLE_IMAGE_KEY`): the main process
  writes it beside the file and renames it over.
- **What VT-DOS does:** with the card in, BASIC boots as before ("42255 bytes free"), `EXT2` starts
  "VT-DOS CLI 1.2" and `DIR` lists the system disk (13 files, 528K free); `SAVE"KLIVE"`, `NEW`,
  `LOAD"KLIVE"` round-trip a program. It moves the cursor address from 0EFFh to 0AFFh, so the
  interrupt comes on scan line 175 instead of 239, as the model predicts.
- **The IDE:** Machine > Disks has the "HBF Floppy Interface (VT-DOS)" switch (`MC_TVC_HBF`, a
  restart) and, with it on, drives A and B (insert, eject, write-protect); the media strip shows both
  drives. The HBF ROM pages are partitions -4 to -7 ("HBF0"-"HBF3") and its RAM -8 ("HBFR"), in the
  profile layout and the history context (which now records port 03h and the card's page).
- **Not done:** the annotation bank space does not know the HBF partitions; a TVC disk viewer.

