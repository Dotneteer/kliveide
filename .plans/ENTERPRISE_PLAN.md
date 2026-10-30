# Enterprise 64/128 on the WASM Core — Implementation Plan

**Status:** Phases 1–2 done (2026-10-30): EXOS 2.1 boots to IS-BASIC 2.1 on the core, with DAVE's
interrupts, NICK's LPT walker, the wait states and the clock stretch; no pixels or sound yet (§18).
D1–D9 accepted (§16). Still open in Phase 0: reading EP64 schematic sheet 1 for Q1 (the VINT edge).
**Input:** the research pack `_input/enterprise128/`. Read these first:
- `README.md`: the machine at a glance, the disagreements table and the ROM decision;
- `NICK_VIDEO.md`, then `NICK_VIDEO_BACKGROUND.md` §1–§2 (the original design documents settle most
  of the first file's open questions);
- `DAVE_MEMORY_IO.md`, then `DAVE_AUDIO_BACKGROUND.md` §1–§2 and §7, and its §2.8 corrections to the
  first file;
- `STORAGE_FIRMWARE_SOFTWARE.md` §2–§6 (ROMs, EXOS, tape, EXDOS, file formats);
- `EXISTING_EMULATORS.md` §1, §2 and §10.

Beside them: the reference documents in `docs/` and the MIT-licensed Clock Signal sources in `clk/`
(commit in `clk/COMMIT`). The original Intelligent Software/AMI scans (`docs/hardware/`) are not in
the repository; the research README gives the Wayback Machine index to fetch them again, and the
background files cite them by document and page.

**Shape of the result:** one new C translation unit that `#include`s the shared Z80 core
`src/emu/z80/wasm/z80.c`, as the ZX81, the HT-1080Z and the TVC do. There is no second CPU, no copy of
`z80.c`, and no TypeScript Enterprise machine. **The Videoton TVC is the template**: it is the newest
core, it has a video chip that stretches the CPU clock in half-T steps (the Enterprise's NICK does the
same), audio, tape, a floppy card on the shared WD1793, and the most complete IDE wiring.

---

## 0. Ground rules

### 0.1 Licence and provenance (decision D1)
- **The default is Klive's own code**, written from the hardware facts in the research pack. That is
  how the HT-1080Z and the TVC were built.
- **Clock Signal (CLK) is MIT** (`_input/enterprise128/clk/`). Porting from it is allowed: a derived
  file keeps "Copyright (c) 2015 Thomas Harte" and the permission notice in a header comment naming
  the upstream file, and `THIRD_PARTY_NOTICES.md` already has a CLK section (the ZX80/81 port) that
  gains the Enterprise files. **But CLK is a weak model of this machine**, and the research shows it
  wrong in several places: it reads the LPB once per block (NICK_VIDEO_BACKGROUND §2.6), gives the Z80
  the first six clocks of a slot (§2.3), has no pixel pipeline delay (§2.5), runs the noise clock at
  62.5 kHz (DAVE_AUDIO_BACKGROUND §1 A), and calls its own wait timing a guess. Useful parts: the
  keyboard matrix table, the EXDOS control register, and the host-file ROM idea (§9.2).
- **MAME (BSD-3)** may be read for interface facts and ported with its notice. Nothing is expected to
  need porting.
- **GPL sources** (ep128emu, its libretro and Ep128web derivatives, Xemu/Xep128, the Kyp069 FPGA
  core) are **not read for design and no code is taken.** The research pack already records the
  facts it needed from them in its own words, with their citations; the implementation works from
  those notes, not from the sources. Where the pack records a *number* (for example ep128emu's
  contention latencies, §6.3), it is used as a fact with its citation.
- **Running** ep128emu as a behavioural oracle is allowed (the Klive BASIC plan's D12, the TVC plan's
  D1): only the observed results of Klive's own test programs are recorded, never generated code, and
  never in CI.
- **ROMs** are settled (§16 D3): bundled under the rights holder's free-use permission.
- **ROM annotations:** none in this plan. Writing EXOS or IS-BASIC sidecars is ROM-annotation work
  under `.ai/rom-annotations/README.md` (rule D4). No commented disassembly, published or remembered,
  feeds them.

### 0.2 Reuse rules for the CPU
From `.ai/wasm-migration-intent-and-lessons.md` ("Shared CPU Intent", and the TVC section):
- The machine configures `z80.c` through `#define Z80_*` hooks before the `#include` and never forks it.
- **No new hook is expected.** The hooks the Enterprise needs already exist:
  - `Z80_DELAY_MEMORY_READ` / `_WRITE` for DAVE's waits and NICK's video-RAM stretch;
  - `Z80_DELAY_OPCODE_FETCH` (H1, added for the TVC) for M1 cycles. Its M1 set is exactly DAVE's
    ("an M1 is the first opcode byte, and the byte after `CB`/`ED`/`DD`/`FD`, but not the `DD CB d op`
    displacement or opcode", DAVE_MEMORY_IO §1.1);
  - `Z80_DELAY_PORT_READ` / `_WRITE` and their `_TAIL` variants for the NICK port synchronisation;
  - `Z80_TACT_PLUS_N` for the clock tree, `Z80_INT_ACK`, and `cpu.interruptVector` (FFh) for IM 2.
- If one is still needed, it goes in as its own phase, compiled only under `#ifdef`, with every existing
  core rebuilt **byte-identical** before any Enterprise code lands (the TVC's H1 rule).

### 0.3 Documents to read before working on this
- `src/emu/z80/wasm/README.md`, before touching a hook or the debug loop.
- `src/emu/machines/tvc/wasm/README.md`: the template core (time base, stretch, sound, tape, HBF).
- `.plans/VIDEOTON_TVC_PLAN.md` §11–§17: the integration checklist and what was learned.
- `.ai/wasm-v2-machine-migration-guide.md`, `.ai/wasm-migration-intent-and-lessons.md`.
- `.ai/i18n-guide.md` (every UI text), `.ai/ui-theming-intent-and-lessons.md` (the virtual keyboard and
  the panels), `.ai/visual-tests-guide.md` (screen goldens), `.ai/doc-screenshots-guide.md` (Phase 10).

---

## 1. Goals and non-goals

### Goals
1. **Enterprise 128 with EXOS 2.1 and IS-BASIC 2.1** and **Enterprise 64 with EXOS 2.0 and IS-BASIC
   2.0**, booting through the RAM test and the flashing ENTERPRISE banner to the IS-BASIC prompt, with
   keyboard, colour picture and stereo sound.
2. **NICK at the precision the research established:**
   - the exact clock (14 237 536.27 Hz, 912 clocks = 284 subcarrier cycles), asynchronous to the CPU;
   - the 57-slot line; HSYNC, burst and blanking at their slots;
   - the LPB re-read on every line; all seven modes in 2/4/16/256 colours with the ALT bits;
   - the one-slot fetch-to-pixel pipeline; port writes landing at a slot boundary;
   - FIXBIAS, border, the floating data bus on port reads, the 83h reload sequence;
   - VSYNC lines (including mid-line sync for interlace), and VINT.
3. **CPU timing:** NICK's clock stretch on every video-RAM access and NICK port access, in half-T
   steps, against the asynchronous slot grid; DAVE's wait states (BFh) as Tw states.
4. **DAVE:** paging, the four interrupt sources with their latches, the 1 Hz / 50 Hz / 1 kHz / tone
   timers, and the full sound generator (tones, polynomial distortion, noise, filters, ring modulation,
   D/A mode), mixed to stereo.
5. **Program loading without disks or tapes:** a Klive-written `FILE:` EXOS extension ROM that reads
   and writes host files, so `.com` and `.bas` load at once (§9.2).
6. **Tape:** `.tap` (both formats) and `.wav`, played in real time with motor control and a turbo,
   and SAVE to a file.
7. **IDE:** debugger and disassembly with EXOS calls, segment-aware memory views, NICK and DAVE panels,
   virtual keyboard, machine states, history and profiling, as the other WASM cores have.
8. **Assembler:** `.model ENTERPRISE`, Run/Debug through EXOS's own loader, `.com` export.
9. **Floppy** (a later phase): the EXDOS card on the shared WD1793 in its WD1770 variant, raw
   `.img`/`.dsk` FAT12 images, EXDOS 1.3.

### Non-goals (possible follow-ups, §15)
- Interlaced display as a woven 576-line picture (the core detects fields; presentation is one field).
- Expansion RAM beyond 128K, EXOS 2.2–2.4, language ROMs (`brd.rom`, `hun.rom`), the EXDOS 1.4 + IS-DOS
  ROM, SDEXT, IDE, RTC, EnterMice, the Spectrum emulator card, network, printer and serial.
- The external colour inputs (EC0–EC3, /EXTC): inert on a bare machine (NICK OQ10).
- A PAL composite model (the LM1886 matrix): RGB only.
- Turbo machines (a 6 MHz Z80). DAVE is still timed from its own input clock, so this can be added later.
- An IS-BASIC listing panel, unless its token table is found during Phase 7 (§11.4).
- Klive BASIC or z88dk targeting the Enterprise.

---

## 2. Inventory: what the research pack gives and where it goes

| Topic | Source in `_input/enterprise128/` | Klive destination |
|---|---|---|
| Segment map, B0h–B3h, ROM/cart/RAM layout, unmapped reads | DAVE_MEMORY_IO §2 | `ep-memory.c` |
| Reset, DAVE register reset values | DAVE_MEMORY_IO §3; DAVE_AUDIO_BACKGROUND §1 L | `ep.c` |
| Interrupts, B4h, edge rules | DAVE_MEMORY_IO §4 | `ep-dave.c` |
| Wait states (BFh), DAVE wait = Tw | DAVE_MEMORY_IO §1.1; DAVE_AUDIO_BACKGROUND §2.7 | `ep-timing.c` |
| NICK clock, slot map, in-slot windows, stretch | NICK_VIDEO_BACKGROUND §2.2–§2.4 | `ep-timing.c`, `ep-nick.c` |
| LPT, LPB, margins, LD1/LD2, VRES, 83h | NICK_VIDEO §3; NICK_VIDEO_BACKGROUND §2.5–§2.7 | `ep-nick.c` |
| Modes, colour modes, ALT bits, palette, FIXBIAS, border | NICK_VIDEO §4–§5; NICK_VIDEO_BACKGROUND §2.8–§2.10 | `ep-nick.c` |
| RGB levels (resistor DAC) | NICK_VIDEO_BACKGROUND §3.3 | `ep-nick.c` palette table |
| Sound generator | DAVE_MEMORY_IO §5; DAVE_AUDIO_BACKGROUND §1–§3 | `ep-dave-sound.c` |
| Analogue path, mixing, DC | DAVE_AUDIO_BACKGROUND §4, §7.2 | `ep-dave-sound.c` |
| Keyboard matrix, joysticks, B5h/B6h/B7h | DAVE_MEMORY_IO §6–§7.1; CLK `Keyboard.cpp` | `ep-keyboard.c`, `EpKeyCode.ts` |
| Tape signal, chunk layout, CRC, image formats | DAVE_MEMORY_IO §7.2–§7.5; STORAGE §4 | `ep-tape.c`, `EpTapeFile.ts` |
| EXOS: boot, module header, RST 30h, system segment | STORAGE §3 | §9.2 ROM, §11 debugger, §12 Run |
| Host file device | STORAGE §5.4; CLK `HostFS/` (MIT) | Klive's own `FILE:` ROM (§9.2) |
| EXDOS card, WD1770, FAT12 | DAVE_MEMORY_IO §9.2; STORAGE §5.1–§5.2 | `ep-exdos.c` on `common/wasm/wd1793.c` |
| ROM images | `src/public/roms/ep-*.rom` (already added) | `EpRoms.ts` |
| Test software | NICK_VIDEO_BACKGROUND §7; DAVE_AUDIO_BACKGROUND §8; STORAGE §8 | oracle runs only (licences unknown) |

---

## 3. The design problems

### 3.1 Two clocks that never line up (decision D4)
The Z80 runs at 4 MHz from the 8 MHz crystal. NICK runs from its own phase-locked oscillator at
14 237 536.27 Hz (exactly 4 433 618.75 × 912 / 284). **NICK also makes the Z80 clock**: it divides
the 8 MHz input by two and stretches it by inhibiting the toggle, so a stretch is a whole number of
8 MHz periods, i.e. half-T steps (NICK_VIDEO_BACKGROUND §2.2).

**Proposal: the TVC's time base, with an exact rational NICK phase.**
- Keep `cpu.tacts` in whole T-states and keep a **half-T clock** beside it (`epHalfClock`, 125 ns
  units = the 8 MHz crystal), exactly as the TVC's D5. DAVE runs on this clock (its input is the
  8 MHz crystal): one DAVE tick every 32 half-T (16 T), or 48 with BFh bit 1 set.
- **NICK's position is a rational function of the half-T clock.** NICK clocks per 8 MHz period =
  40 434 603 / 22 720 000, exactly. Keep an integer accumulator: each half-T adds 40 434 603; a NICK
  clock passes for every 22 720 000, a **slot** for every 363 520 000. No floating point, no drift.
  - A slot is 8.990 half-T (4.495 T); a line 512.45 half-T (256.22 T); 312 lines 79 941.9 T (50.036 Hz).
- **NICK steps eagerly, one slot at a time, inside `Z80_TACT_PLUS_N`**, as the TVC's CRTC does
  (its §17 found eager stepping cheap and exact). At 889 846 slots per second that is about 17 800
  slot steps per frame.
- Rejected: counting `cpu.tacts` in half-T (doubles every tact in the IDE); a floating-point phase
  (drifts, and two runs of a replay could round differently).

### 3.2 The frame is whatever the LPT says
The frame length is set by the program's LPT, normally 312 lines, and it is not a whole number of
T-states. **The machine frame ends where vertical sync starts**: the slot at which a VSYNC-mode line's
left margin turns `/VSYNC` on. That is what a TV locks to.
- A safety cap ends a frame if no sync starts within two nominal frames (160 000 T): before EXOS
  programs NICK the LPT pointer is random (NICK_VIDEO §3.6).
- Host pacing uses the measured frame length (≈ 50.04 Hz with EXOS's table).
- **Interlace:** the slot at which sync starts tells the fields apart. Record the field parity in the
  frame info; presentation shows each field as it comes (a woven picture is a follow-up).
- The frame boundary does not move any interrupt: VINT is wherever the LPT puts it.

### 3.3 Contention against an asynchronous grid (decision D5)
Each 16-clock slot is NICK read 1 (clocks 0–4), NICK read 2 (5–9), then the **Z80 window, clocks
10–15** (NICK_VIDEO_BACKGROUND §2.3). A Z80 access to video RAM (a page mapped to segments FCh–FFh),
or to ports 80h–8Fh, is held until it lines up with a window; the hold is in half-T steps.
- What the documents do not give (N11): the point inside the machine cycle where NICK samples the
  request, and so how many half-T steps each phase costs. The missing IS documents DPC08/09 describe
  the stretch unit.
- **Proposal:** model the rule directly — the access's data point is moved to the next Z80 window, in
  half-T steps — with the request point of each cycle type as a **named constant**:
  - M1 at T2.0, memory read/write at T2.5, I/O at T3.5 (the EXOS book's measured access points,
    DAVE_MEMORY_IO §1.2);
  - the latency constants the pack records for ep128emu (≈ 359 ns memory, 356 ns M1, 363 ns I/O,
    NICK_VIDEO §8.2) as the defaults, so the totals match the community's reference.
- Proof: Klive-written timing loops (§13) whose T-state totals are compared with ep128emu runs; the
  observed totals are recorded in Klive's words. The constants are one table, so a measurement on
  real hardware is a one-line change.
- DAVE's waits never apply to video RAM ("would conflict with Z80 clock stretch").

### 3.4 Pixels: one slot late, sixteen at a time
NICK puts out 16 pixels per slot at the 14 MHz dot clock. The design documents settle that the bytes
fetched in slot *n* are shifted out in slot *n* + 1, picture and "active" alike
(NICK_VIDEO_BACKGROUND §2.5); ep128emu, CLK and MAME show them in the fetch slot. For a static picture
the difference is a uniform 16-pixel shift; it matters for mid-line writes.
- Each slot step: margin compares → LPB fetch or display fetch or refresh → shift the *previous*
  slot's buffers out through the current mode's renderer → blank (slots 56 and 0–9 output colour 0,
  whatever the margins) → write 16 pixels.
- A port write lands in clocks 10–15 of the slot the Z80's window falls in, so it takes effect from
  the next slot boundary.
- Renderers are lookup-table driven (2/4/16-colour bit interleaving, ALT offsets OR-ed in), one per
  mode × colour mode, with a generic path for the undefined combinations (§7.5).

### 3.5 Where the VINT interrupt lands (decision D6)
NICK's side is settled: `/VIRQ` falls in slot 0 of a VINT block's first line and rises in slot 0 of
the line after the block. DAVE latches INT1 on a **falling** edge (all three spec issues). That gives
an interrupt at the **start** of the block — but ep128emu, Xemu and the EXOS book appendix (IstvanV,
who worked from real-machine tests) put it at the **end** of the block.
- *Inference, to check:* both are right if the board inverts `/VIRQ` on its way to DAVE's `/INT1`.
  The EP64 schematic sheet 1 (`EP64-1-0.jpg`) shows that net; reading it is Phase 0 work.
- **Proposal:** one constant, `EP_VINT_AT_BLOCK_END`, defaulting to **end of block** (the measured
  behaviour) until the schematic is read. B4h bit 4 reads the INT1 pin level either way.

---

## 4. Architecture and file layout

### 4.1 C (one artifact; the model chosen at run time)
```
src/emu/machines/enterprise/wasm/
  README.md                 build, ABI, exports, the hardware model (the TVC README's shape)
  EpWasmV2Loader.ts
  dist/ep.wasm
  ep/
    ep.c                    the TU: state, time base, Z80_* hooks, #include z80.c, frame loop, exports,
                            debug loop, condition evaluator, history, profile
    ep-memory.c             the 256-segment map, B0h-B3h, ROM upload, RAM sizes, unmapped FFh, peek/poke
    ep-ports.c              the 8-bit I/O decode, write-only and unmapped reads
    ep-timing.c             the half-T clock, the NICK phase accumulator, the stretch, DAVE waits
    ep-nick.c               slot stepper, LPT walker, renderers, palette, FIXBIAS, border, VINT, VSYNC
    ep-dave.c               interrupt latches and timers (1 Hz, 50 Hz/1 kHz/TG), B4h, BFh
    ep-dave-sound.c         tone/noise channels, polys, filters, ring, D/A, mixing, sample buffer
    ep-keyboard.c           the 10 x 8 matrix, B5h/B6h, external joysticks
    ep-tape.c               tape player (B6h bits 6-7), motor (REM1/REM2), SAVE recorder (left D/A)
    ep-hostfs.c             the FILE: device traps and their host channel (§9.2)
    ep-exdos.c              the EXDOS card on the shared WD1793 (Phase 9)
scripts/build-ep-wasm.cjs (+ .d.cts)
scripts/check-ep-wasm-size.cjs
scripts/benchmark-ep-wasm.cjs
```

The hook block in `ep.c` (names illustrative):

```c
#define Z80_EXTERNAL_BUS 1
#define Z80_READ_MEMORY(a)          epReadMemory(a)
#define Z80_WRITE_MEMORY(a, v)      epWriteMemory(a, v)
#define Z80_READ_PORT(a)            epReadPort(a)
#define Z80_WRITE_PORT(a, v)        epWritePort(a, v)
#define Z80_DELAY_MEMORY_READ(a)    epDelayMemory(a, EP_CYCLE_READ)   /* 3 T + DAVE wait | NICK stretch */
#define Z80_DELAY_MEMORY_WRITE(a)   epDelayMemory(a, EP_CYCLE_WRITE)
#define Z80_DELAY_OPCODE_FETCH(a)   epDelayMemory(a, EP_CYCLE_M1)     /* H1 */
#define Z80_DELAY_PORT_READ(a)      epDelayPort(a)                    /* NICK ports 80h-8Fh stretch */
#define Z80_DELAY_PORT_WRITE(a)     epDelayPort(a)
#define Z80_TACT_PLUS_N(n)          epAdvanceTacts(n)                 /* half-T clock, NICK slots, DAVE ticks */
#define Z80_BEFORE_OPCODE_FETCH()   epCheckHostFsTrap()               /* §9.2, only inside the FILE: ROM */
#include "../../../../z80/wasm/z80.c"
```

The memory map is a 4-entry page table of segment numbers plus per-page flags (ROM, video,
unmapped), refreshed on B0h–B3h and BFh writes, so the hot path is one table look-up and one compare.

### 4.2 TypeScript (the TVC pattern)
```
src/emu/machines/enterprise/
  EpWasmHost.ts             abstract host: keys, typer, partitions, sysVars, injection flow
  EpWasmV2Machine.ts        the adapter: registers proxied to the core, screen, audio, tape, state,
                            IExecutionHistorySource, IAccessProfileSource
  EpMachineFactory.ts
  epMachineInfo.ts          models (§4.3), clocks, ROM ids
  EpRoms.ts                 ROM sets per model (the TVC/HT-1080Z shape: name, size, CRC32)
  EpKeyCode.ts              the matrix keys and their legends
  EpKeyMappings.ts          host key -> matrix
  EpTyper.ts                auto-type
  EpTapeFile.ts             .tap (ep128emu and EPTE) and .wav recognition, chunk decoding for the viewer
  EpComFile.ts              EXOS module header (16 bytes): type, length, start
  EpSysVars.ts              EXOS variables for the SysVars panel
  EpHostFs.ts               the FILE: device's host side (§9.2)
```
Add a separation test like `test/zx8081/zx8081-separation.test.ts`: the host imports no TS device code.
`test/machines/ep-rom-images.test.ts` (already in the repository) moves to the `EpRoms.ts` table, as the
HT-1080Z's test reads `HT1080Z_ROM_SETS`.

### 4.3 Machine ID and models (decision D2)
**One machine ID, `MI_ENTERPRISE = "ep"`, display name "Enterprise 64/128":**

| Model id | RAM (segments) | ROMs | Notes |
|---|---|---|---|
| `ep128` (default) | 128K (F8h–FFh) | EXOS 2.1 at 00h–01h, IS-BASIC 2.1 at 04h | The standard target |
| `ep64` | 64K (FCh–FFh) | EXOS 2.0 at 00h–01h, IS-BASIC 2.0 at 04h | |

Machine config keys:
- `MC_EP_CARTRIDGE` (on by default): IS-BASIC in the cartridge slot. Off boots to the word processor.
- `MC_EP_EXDOS` (off by default, Phase 9): the EXDOS card and its ROM at 20h–21h.
- `MC_EP_HOSTFS` (on by default): Klive's `FILE:` ROM at segment 10h.
- `MC_EP_PALETTE`: `resistor` (default, the board's DAC, NICK_VIDEO_BACKGROUND §3.3) or `linear`
  (the guide's formula).

---

## 5. Memory and ports (`ep-memory.c`, `ep-ports.c`)

- **Segments:** physical = `B0h–B3h[A15:A14] << 14 | A13–A0`. ROM 00h–01h (EXOS), 04h (BASIC), 10h
  (`FILE:`), 20h–21h (EXDOS); RAM counted down from FFh (FCh–FFh on the 64, F8h–FFh on the 128); video
  RAM FCh–FFh; everything else reads FFh and ignores writes (DAVE_MEMORY_IO §2.4).
  - Segments 02h–03h on a 32K-ROM machine: mirror or open bus is open (DAVE OQ2). Default: FFh
    (unmapped), recorded in the README.
  - BFh bit 0 = 1 ("16K on-board"): only FFh is video RAM. Implement it (it is one flag), but it never
    happens on a sold machine.
- **B0h–B3h** are read/write. Reset clears them to 00h, so the Z80 starts in EXOS segment 0.
- **Ports:** 8-bit decode (`port & FFh`).
  - 80h–8Fh NICK (A0–A1 select; reads return NICK's last fetched byte, the floating video bus, and are
    synchronised like writes);
  - A0h–AFh DAVE sound (write-only), B0h–B3h paging, B4h interrupts, B5h/B6h/B7h, BFh config
    (write-only; the scans head R31 **W**, DAVE_AUDIO_BACKGROUND §2.8);
  - 10h–1Fh EXDOS when the card is in (Phase 9);
  - reads of write-only or undefined ports return FFh (the emulators' value; the real bus is open,
    DAVE OQ5). One constant.
- **Reset:** DAVE clears all 22 registers (sound silent, interrupts off, BFh = 0 so every memory access
  waits, B5h = 0), then the B4h "AAh" semantics. NICK's four port registers are random at power-on
  (the reason for EXOS's forced reload); use a fixed seed so runs are reproducible, and a test that
  EXOS boots from several seeds. The reset button keeps RAM: EXOS decides warm or cold from `RST_ADDR`.

---

## 6. CPU timing (`ep-timing.c`)

1. **DAVE waits (BFh bits 3–2):** 00 every non-video memory access, 01 M1 only (EXOS's default after
   boot), 10/11 none. One wait = **1 T**, inserted as a Tw after T2 (DAVE pulls /WAIT;
   DAVE_AUDIO_BACKGROUND §2.7). BFh bit 1 does not change it. I/O cycles get none.
2. **NICK stretch:** a memory access whose page maps FCh–FFh, or an I/O access to 80h–8Fh, is held until
   its data point falls in clocks 10–15 of a slot (§3.3). The hold is a whole number of half-T steps;
   the half-T phase carries to the next cycle as in the TVC.
3. **M1 from video RAM** gets the stretch only, never the DAVE wait; the refresh cycle that follows is
   not stretched (NICK does its own refresh in slots 54–56). Record the refresh choice in the README.
4. **Interrupt acknowledge:** no stretch; the bus reads FFh (`cpu.interruptVector`).
5. **NICK phase at reset:** not documented. Choose 0, make it one constant, record it.

**Proof (§13):** loops of `LD A,(nn)` / `LD (nn),A` / `NOP` sleds / `IN A,(80h)` in video RAM and in
ordinary RAM, timed with the DAVE 1 kHz interrupt, at every BFh wait mode; the totals checked against
the model and recorded against ep128emu oracle runs. One expected finding, as on the TVC: code that
keeps touching video RAM locks to the slot grid (≈ 4.5 T per access).

---

## 7. NICK (`ep-nick.c`)

Every fact here is in `NICK_VIDEO.md` and `NICK_VIDEO_BACKGROUND.md` §2; the section numbers point there.

### 7.1 The slot stepper
- **Slot map (BG §2.4):** 0–7 LPB fetch (two bytes per slot: SC/MB, LM/RM, LD1, LD2, COL0–7);
  8–53 display fetches; 54–56 DRAM refresh; slot 56 is the counter reset.
- **Sync and blank (BG §2.4):** `/HSYNC` slots 0–3, `/BURST` 6–9 (inhibited on VSYNC lines), `/BLNK`
  from slot 56 through slot 9. Blanked slots output colour 0, not the border.
- **Margins (NICK §3.3, BG §2.5):** 6-bit, compared with the slot counter; display from LM up to RM; a
  right margin ≥ 57 never matches, so display or sync runs on into the next line. The compares happen in
  blanked slots too and still clock LD1.
- **The LPB is fetched on every line (BG §2.6).** What happens only on a block's first line: the line
  counter loads, LD2 loads, and LD1 loads (also on every line when VRES = 0).
- **LD1/LD2 (NICK §3.4, BG §2.5):** LD1 counts once per active slot (twice in PIXEL), including active
  control slots (0–7, 54–56) where nothing is fetched; LD2 counts per active slot in ATTRIBUTE and once
  per line (at the line end) in the character modes. With VRES = 0 only LD1 reloads (ep128emu's rule,
  N10; the final text's "and LD2" is taken as loose wording).
- **The pipeline (BG §2.5, N2):** slot *n*'s bytes appear in slot *n* + 1. Slots where the buffers are
  not reloaded (54, 55 when the margins reach them) re-show the last display bytes.
- **The renderer is latched at the left margin** (NICK §11 item 2): a mode-byte change takes effect at the
  next left margin.
- **The LPT pointer and port 83h (BG §2.7):** a loadable counter. It advances by 16 after a block's last
  line, or reloads the base after a RELOAD block. Bit 7 = 0 holds LOAD; bit 6 = 0 blocks the block-end
  clock, and its 0→1 write supplies one clock. The visible behaviour is ep128emu's flag model, which the
  pack describes step by step (NICK §3.5); follow it.

### 7.2 Modes and colours (NICK §4–§5, BG §2.8–§2.10)
- Modes: VSYNC, PIXEL (2 bytes/slot), ATTRIBUTE, CH256/CH128/CH64, LPIXEL (one byte, both halves), and
  VM 6 (open, OQ6: the generic path with glyph address FFFFh).
- Bit order: 2-colour bit 7 first; 4-colour pixel *k* (0–3, leftmost first) takes its high bit from
  b(3−k) and its low bit from b(7−k); 16-colour left pixel = b1,b5,b3,b7 as index bits 3..0, right =
  b0,b4,b2,b6 (the Nov 84 edition, the guide and every emulator agree; NICK §4.2).
- ALT bits: LM bit 7 MSBALT (+2), bit 6 LSBALT (+4); RM: **ALTIND1 on bit 6, ALTIND0 on bit 7** — the
  guide's and ep128emu's assignment, which the final ET1/1 edition contradicts (N8). Settle it in Phase 3
  by EXOS's own text screen: IS-BASIC colours 2/3 and 4–7 swap if it is wrong. One constant.
- Palette: COL0–7 from the LPB every line; 8–15 = FIXBIAS bits 4–0 × 8 + index. 256-colour bypasses it.
- **Colour levels (BG §3.3):** the board's resistor DAC (R, G: 100/220/470 Ω; B: 82/220 Ω), not the
  linear formula, as the default; one table, so a measurement replaces it (N3). Blue is visibly non-linear.
- FIXBIAS bits 5–6 (external colour priority) and bit 7 (VC1, the speaker mute) are stored for the
  debugger; bit 7 mutes only the internal speaker, which Klive does not model separately (§8.4).

### 7.3 VSYNC and VINT
- On a VSYNC-mode line, sync turns on at LM and off at RM (or at slot 0 of a non-VSYNC line), and the
  output is blank. The frame ends where sync turns on (§3.2).
- VINT: MB bit 7 drives `/VIRQ` per line; DAVE's INT1 latch takes the edge chosen by D6 (§3.5).

### 7.4 The TV window (decision D7)
- Render the unblanked part of each line, **slots 10–55 = 736 pixels**, and **288 lines** placed after
  sync as a TV would place them, centred on EXOS's picture.
- Aspect ratio against Klive's square 7 MHz Spectrum pixel: 7 / 14.2375 ≈ 0.49 (the TVC's rule).
- A program whose sync falls outside a TV's capture range shows the signal-lost picture
  (`isVideoSignalLost`, as the HT-1080Z and TVC do).
- **Beam position:** expose `getBeamPosition`, join `BEAM_POSITION_MACHINE_IDS`; raster effects are the
  Enterprise's main trick.

### 7.5 Undefined combinations
ALT bits in 4/16-colour modes, ATTRIBUTE with more than two colours, VM 6: the palette-bus bits that a
mode does not drive are 0 and the ALT offsets are OR-ed in (BG §2.8, DPC12 p. 14). Write one generic
renderer from that rule; the specialised ones are speed paths that must agree with it (a test runs both).

---

## 8. DAVE (`ep-dave.c`, `ep-dave-sound.c`)

### 8.1 Interrupts (DAVE_MEMORY_IO §4)
- Four latches: the selectable source (1 kHz / 50 Hz / tone 0 / tone 1, A7h bits 6–5), 1 Hz, INT1 (NICK),
  INT2 (serial/net STATUS IN; inert without a peripheral). `/INT` is the OR of the latched sources:
  level-triggered, IM 1.
- B4h write: enables on bits 0/2/4/6; a 1 in bits 1/3/5/7 clears that latch; disabling a source clears
  its latch. Read: divider state, latch, pin level, latch — interleaved (Issue 5 layout).
- Timers latch on **every** toggle of their divider. 50 Hz = 5000 DAVE ticks = 80 000 T, **not**
  locked to the video frame. Tone-generator mode interrupts at 250 000 / (n + 1).
- External inputs latch on the falling edge while enabled (and see D6 for VINT).

### 8.2 The sound generator (DAVE_MEMORY_IO §5; DAVE_AUDIO_BACKGROUND §1–§3)
One step per DAVE tick (16 T at BFh bit 1 = 0, 24 T at 1), on the half-T clock, catching up before any
A0h–AFh or B4h access:
- tone channels: 12-bit down counters reloading with *n* (period *n* + 1); pure tone toggles, distortion
  samples the 4/5/7-bit or variable poly at each reload; a new code takes effect at the next reload;
- sync (A7h bits 0–2): counter held at its code, output 0, no TG interrupt while held; count from the next
  tick after release (§1 C);
- noise: clock 31.25 kHz (one poly step per 8 ticks) or a tone channel's falling edge; 17/15/11/9-bit
  variable poly; the 7/17 swap (A6h bit 4); low-pass by ch2 (ep128emu semantics, §1 H), high-pass by
  ch0, ring by ch1, in that order;
- tone high-pass by the next channel, ring by its partner, applied continuously;
- polys reset to their cleared state on power-on (§1 B; all ones in ep128emu — the phase only shifts the
  noise). Period 2ⁿ − 1 (the gate plan's extra NOR term is open, §9 item 9). One constant each;
- the tick order follows the pack's ep128emu description (§3.1), the validated reference; the gate plan's
  "every partner sees the previous tick" is recorded as a known one-tick skew (§9 item 3).

### 8.3 Output (DAVE_AUDIO_BACKGROUND §4, §7.2)
- Per side: the sum of the amplitudes (A8h–AFh, 6-bit) of the channels whose output is 1, 0–252; D/A mode
  (A7h bits 3/4) outputs **4 × A8h / ACh** (§1 F).
- Tape monitor: with B5h bit 5 = 0 and a tape playing, add 63 × (input high) to both sides.
- A one-pole low-pass at the board's ≈ 22.6 kHz pole, run at the tick rate, then each host sample is the
  average over its interval (the TVC's integration), then a ≈ 10 Hz DC high-pass for the output coupling.
- **Stereo**: the left and right sums are independent; the host gets both (§11 checks Klive's audio path).

### 8.4 What is not modelled
The DAC's resistor-pack non-linearity (values unknown, §9 item 1; linear), the 8 µs output multiplex, the
LM386 speaker path and its mute (VC1). A tone code 0 toggles every tick (125 kHz, the design intent).

---

## 9. Keyboard, program loading, tape

### 9.1 Keyboard and joysticks (DAVE_MEMORY_IO §6)
- The 10 × 8 active-low matrix: B5h bits 3–0 select the row, the B5h read returns it; rows A–F read FFh.
- The built-in joystick is the cursor keys (row 7); its fire is SPACE.
- External joysticks on B6h bit 0 ("J" column), rows 0–4 joystick 1 and 5–9 joystick 2; the K/L columns
  (bits 1–2) for the extra fire buttons. Wire into Klive's joystick input if the joystick plan's
  abstraction allows it, otherwise a follow-up.
- Host mapping: a UK layout by position, the Enterprise's extra keys (STOP, HOLD, ERASE, INS, DEL, ALT,
  the eight function keys, LOCK) on host keys chosen for the editor's use. The table is data
  (`EpKeyMappings.ts`) and tested.
- **Virtual keyboard:** drawn from a photograph of the real keyboard (the TVC's way, §17 of its plan),
  `EpKeyboard.tsx`, with the joystick. Colours as tokens in `palette.ts`; a short entry in
  `.ai/ui-theming-intent-and-lessons.md`.

### 9.2 The `FILE:` device (decision D8)
The community loads most software as loose files (`.com`, `.bas`), not tapes. Both CLK and ep128emu do
it with an EXOS extension ROM whose device-driver entry points trap to the host.
- **Klive writes its own ROM**, as Z80 source in the repository (`src/public/roms/ep-klive-fileio.asm`,
  built to `ep-klive-fileio.rom` by Klive's own assembler in a script, checked by a test that the
  shipped image matches the source). It carries the `EXOS_ROM` signature, registers device `FILE`, and
  each driver entry point is a trap site.
- **The trap is by address**, not by a special opcode: `Z80_BEFORE_OPCODE_FETCH` checks whether the PC
  is one of the ROM's trap addresses *and* page 3 (or the page the ROM runs in) maps segment 10h. The
  addresses come from the assembler's listing at build time. No `z80.c` change, no undocumented opcode.
- **The host side** (`EpHostFs.ts`) implements the EXOS device functions (open, create, close, read
  and write character and block, status, position) on one host folder: the project's output folder by
  default. The core suspends on a trap, the host answers through the machine's existing
  core-to-host request path, and the core resumes with A (status) and the registers set.
- CLK's `hostfs.z80s` (MIT) is the model for the EXOS side and may be ported with its notice if that
  is quicker than writing it; the function numbering follows the EXOS device-driver specification
  (`docs/EXOS20_Technical_Information.pdf`), not either emulator.
- **Use:** `LOAD "FILE:GAME.COM"` from IS-BASIC loads and starts a `$$APP`; `:LOAD` from EXOS likewise.
  Files dropped onto the machine, or opened through File > Open, are staged into the folder and typed.

### 9.3 Tape (`ep-tape.c`, `EpTapeFile.ts`)
- **Formats (STORAGE §4.2):** the ep128emu native `.tap` (a sample stream with a 4096-byte header),
  the EPTE/TAPir `.tap` (decoded chunks, magic at offset 128), and `.wav`. Detect by magic: ep128emu
  first, then EPTE, then WAV.
- **Playing:** the host turns a file into a tape program (the TVC's word format: silence, runs of equal
  cycles, data bytes); an EPTE file's chunks are synthesised at the EXOS fast timings (leader 424 µs,
  1 = 344 µs, 0 = 504 µs, sync 696 µs, full cycles, LSB first; DAVE_MEMORY_IO §7.4); a sample stream
  plays as edges. B6h bit 7 is the data comparator, bit 6 the level comparator.
- **Motor:** REM1 (B5h bit 6) or REM2 (bit 7) runs the tape; EXOS stops it between chunks.
- **Fast load: a turbo, as on the TVC** (its §17): extra machine frames per displayed frame while the
  tape plays with its motor on. EXOS decodes the real signal.
- **SAVE:** EXOS writes through DAVE's left D/A (A7h bit 3, levels to A8h). Record the left D/A level's
  transitions while a motor runs, classify full cycles against the measured leader, rebuild chunks and
  blocks, check every CRC (16-bit, 0810h feedback, DAVE_MEMORY_IO §7.4), and publish through
  `SAVED_TO_TAPE`. Output format: an ep128emu native 1-bit `.tap` (lossless, readable by both Klive and
  ep128emu); decision D9.
- The header chunk's protection byte polarity is open (DAVE OQ7); the SAVE round-trip test settles
  what EXOS writes and reads, whatever the documents say.

---

## 10. EXDOS and disks (Phase 9, `ep-exdos.c`)

- **The controller** is a WD1770 (8 MHz). Use the shared `src/emu/machines/common/wasm/wd1793.c`
  (extracted for the TVC's HBF card) with a **1770 variant flag**: motor-on control instead of
  head-load and READY, the 1770's step rates, no side-compare flag. The variant is its own commit; the
  Beta 128 and TVC cores rebuild **byte-identical**.
- **Ports (DAVE_MEMORY_IO §9.2):** 10h–13h the controller (mirrored at 14h–17h); 18h the control
  register (write: drive select 0–3, side, /DDEN, disk-change reset, LED; read: INTRQ bit 1, disk change
  bit 6, DRQ bit 7). The decode differs between emulators (STORAGE OQ4): take 18h–1Fh as one register
  (CLK, MIT), record it.
- **ROM:** `ep-exdos13.rom` at 20h–21h. Its CRC differs from MAME's `exdos13.rom` (the readme notes it);
  if EXDOS misbehaves, compare with the MAME image before debugging the controller.
- **Disks:** raw `.img`/`.dsk`, geometry from the FAT12 boot sector (720K 80 × 2 × 9 × 512 the norm;
  40-track and 10-sector variants accepted). The guest's writes are published as the whole image, as on
  the TVC (`DSK_WHOLE_IMAGE_KEY`).
- `EXDOS.INI` runs at every restart, so a disk with one auto-boots.

---

## 11. IDE integration checklist
Grouped as in the TVC's §11; **(2×)** marks a list kept in two places.

- **Registry:**
  - `constants.ts`: `MI_ENTERPRISE`, the `MC_EP_*` keys, `MEDIA_INFO_MACHINE_IDS`,
    `BEAM_POSITION_MACHINE_IDS`.
  - `machine-registry.ts`: features `MF_Z80`, `MF_TAPE_SUPPORT`, `MF_INJECT_SUPPORT`, `MF_EXEC_HISTORY`,
    `MF_REVERSE_DEBUG`, `MF_PROFILE`; models; media ids; tool info with the custom disassembler; an
    Enterprise `charSet` (`char-codes.ts`, read from EXOS's own character set, not from a table).
  - `machine-renderer-registry.ts`, `hardware-specs.ts` (+ `hardware.*` i18n keys), `NewProjectModel.ts`
    `MACHINE_FAMILIES`, a project template under `src/public/project-templates/enterprise/`.
- **Build and packaging:** `scripts/build-ep-wasm.cjs` copies `build-tvc-wasm.cjs` (plain `clang` for
  wasm32; the export allow-list from `z80-cpu-exports.cjs`, `z80-condition-exports.cjs`,
  `z80-history-exports.cjs`, `z80-profile-exports.cjs`; an `EP_VOLATILE_SYMBOLS` list; the build lock and
  layout stamp). `package.json` `build:ep-wasm`, `check:ep-wasm-size` (set the ceiling from the first
  build, with its reason), an entry in `build:all-wasm` **and** an `extraResources` mapping to
  `wasm/ep` **(2×)**; `scripts/check-wasm-cpu-contract.cjs`, `src/main/unit-tests/wasmArtifacts.ts`,
  `unitTestMachines.ts`, `src/common/headless/headlessMachines.ts` + `HeadlessMachineFactory.ts`,
  `src/emu/machines/reverse/exportContract.ts`.
- **Tests:** `test/vitest.setup.ts` `CORE_EXPORT` gets the `ep` prefix; `build/e2e-tests.ts` gets
  `test/ep-hw/**` in `E2E_CORE_TESTS` (`scripts/run-tests.cjs` already counts any `test/*-hw/` folder and
  `build-*-wasm.cjs` as core inputs). Give `test/harness/enterprise/` the README its `index.ts` points to
  (the TVC harness lacks one).
- **Messaging and panels:** `MainToEmuProcessor.ts` and `src/common/messaging/EmuApi.ts` get
  `getEpNickState` / `getEpDaveState` (the `getTvcVideoState` pattern); the panels register in
  `src/renderer/registry.ts`; `MachineSelectView.tsx` / `MachineSelectViewModel.ts` get the screen
  proportions; `tool-registry.tsx` the media tool strip; `TapeLoadCommand.ts`, `TapeLaunchMenu.tsx`,
  `dropped-file-action.ts` and `src/main/open-file.ts` (with `sniff-content-kind.ts`) the `.tap`, `.com`,
  `.bas` and `.img` files.
- **State:** `STATE_MACHINES` in `src/main/machine-menus/state-menus.ts` **and** `MachineStateCommands.ts`
  **(2×)**; `coreIdOfMachine` in `machineStateFile.ts`. The state is the core's image, as on the TVC.
- **Menus:** `machine-menu-registry.ts` + `ep-menus.ts` (tape, the cartridge, `FILE:`, EXDOS and its
  drives, palette).
- **Debugger:**
  - **memory partitions are segments**: 0–255 by number, with labels (EXOS0/1, BASIC, FILE, EXDOS0/1, the
    RAM segments, VRAM0–3), through `getPartitionLabels` / `getPartition`, and an `epBankSpace` in
    `bankSpace.ts` (16K pages). Unlike the TVC, set **`MF_BANK: 256`** in the registry, as the Z88 does,
    so the memory panel offers its bank matrix (`memoryViewModel.ts` enables it only with `MF_ROM` or
    `MF_BANK`); implement `getPartitionDescriptions` / `getPartitionGroups` (only the Next has them
    today) so the 256 segments group as ROM, cartridge, expansion ROMs, RAM and video RAM;
  - history and profile contexts record B0h–B3h (`src/common/history/contexts/epContext.ts`,
    `src/common/profile/layouts/ep.ts`, registered in its `index.ts`);
  - a custom disassembler (`disassemblers/z80-disassembler/ep-disassembler.ts`): **`RST 30h` is followed
    by a function byte** (an EXOS call); list it as data with the function's name from the EXOS
    specification, and make `getCallInstructionLength` return 2 so Step Over stops after it (the TVC's
    `RST 30h` lesson);
  - an **EXOS variables** SysVars view (`EpSysVars.ts`, from the EXOS specification's variable list:
    `LP_POINTER`, `RST_ADDR`, `PORTB5`, `USER_ISR`, …).
- **A NICK panel** (Debug activity, `restrictTo: [MI_ENTERPRISE]`): the four ports as written (the core
  keeps them for the debugger), the LPT base and current LPB address, the current line and slot, the
  decoded current LPB (lines, mode, colour mode, VRES, VINT, RELOAD, margins and ALT bits, LD1/LD2,
  COL0–7), LD1/LD2 live values, FIXBIAS and border swatches, and an **LPT list** (every LPB to the
  RELOAD one, decoded, the current one marked). Built on `@renderer/controls/data`, `ch` widths,
  row-size tokens (M1–M3), `--color-state-value`.
- **A DAVE panel:** the page registers with segment labels, the interrupt enables, latches and pin
  levels, BFh decoded, and the sound registers decoded per channel (frequency in Hz, distortion,
  filters, ring, volumes), the noise setup and the D/A bits.
- **Assembler:** `.model ENTERPRISE` in `VALID_MODELS`, `SpectrumModelTypes.ts` (enum, name map,
  `isEnterpriseModelType`), `compile-code.ts`, `UnitTestRunner.ts`, `z80-completion-data.ts`.
- **CLI:** `src/cli/run/inputs.ts`, `src/cli/verbs/run.ts` `--machine ep`, `unitTestMachines.ts`.
- **i18n:** every new UI text through `t()` with an English entry and translator context, then
  `npm run i18n:keys`.
- **Feature roadmap:** if `.plans/CLOSING_THE_GAPS_PLAN.md` or the competitive analysis lists machine
  coverage, update its tables in the same change (AGENTS.md's standing instruction).

### 11.4 IS-BASIC listing (conditional)
IS-BASIC's token table and line layout are not documented (STORAGE OQ1). In Phase 7, look for the table
in the running ROM (type lines, read the stored bytes; Klive's own observation, as the TVC's tables
were). If it is found, add a detokeniser for `BasicPanel.tsx`; if not, it stays a follow-up.

---

## 12. Run, Debug and export (`src/common/enterprise/codePlacement.ts`)

- **The program is an EXOS `$$APP`** (module type 5): a 16-byte header (`00 05 lenLo lenHi`, twelve
  zeros) and the body loaded at 0100h, up to BFFFh (STORAGE §3.7). `.model ENTERPRISE` puts code with no
  `.org` at 0100h; Z-codes warn about code outside 0100h–BFFFh.
- **Run and Debug go through EXOS's own loader** (the TVC's lesson: make the ROM do the work):
  1. boot to IS-BASIC's prompt (skip the banner with a key, wait for the editor's key wait, found by
     running the ROM — the harness's landmark, §13);
  2. stage the assembled `.com` in the `FILE:` folder;
  3. type `LOAD "FILE:KLIVE.COM"`. EXOS loads it, resets with user RAM kept, and jumps to 0100h, so the
     debugger stops on the program's first instruction when asked to.
  - No ROM address is needed for the return path: a `$$APP` exits through EXOS.
  - With `MC_EP_HOSTFS` off, Run is refused with a message saying why.
- **Export:** a `.com` file (header + body) through `ExportCodeModel.ts`; and, as an option, an EPTE or
  ep128emu `.tap` holding it (the tape writer of §9.3).
- **Load and Run** for `.com`, `.bas` (`LOAD "FILE:…"` then `RUN`), `.tap` (`LOAD` with the tape playing)
  and, in Phase 9, disks (auto-boot).

---

## 13. Tests

All tests run the real WASM machine.
- **Harness `test/harness/enterprise/`** (copy `test/harness/tvc/`):
  - `bootToBasic(model)`: waits for IS-BASIC's prompt, observed through the editor's state and video
    RAM, not pixels;
  - `typeKeys`, `runFrames`, `runTo`, `step`, `peek`/`poke` (physical and paged), `segments()`;
  - `nick()` (ports, LPT pointer, line, slot, LD1/LD2, the decoded LPB) and `beam()`;
  - `dave()` (registers, latches, timers, channel outputs), `audio()`;
  - a **bare machine** (`bare.ts`, the TVC's): CPU parked in RAM, the LPT written by the test, no EXOS.
- **Hardware tests (`test/ep-hw/`)**, one file per topic:
  - memory: every page register combination over ROM, RAM, video and unmapped segments; 64K vs 128K;
    BFh bit 0;
  - timing: DAVE waits in each BFh mode for M1 and data cycles; the NICK stretch for read, write, M1
    and port I/O at a sweep of slot phases (a test-only export places the CPU at a chosen phase, as
    `tvcSetHalfClock` did); the lock-to-grid NOP sled; `debug-loop-equivalence.test.ts` gets the
    Enterprise;
  - NICK: the slot map (sync, burst, blank at their slots); each mode × colour mode on a worked byte;
    the ALT bits; FIXBIAS 8–15; the one-slot pipeline (LM = 31, RM = 32 puts 16 pixels in slot 32);
    margins ≥ 57 running on; LD1 counting in active control slots; the LPB re-read (a palette byte
    rewritten mid-block shows on the next line); the 83h forced-reload sequence step by step;
    mid-line border and FIXBIAS writes landing on the right slot; port reads returning the last fetch;
    the IS 1984 demo's 312-line LPT (NICK_VIDEO_BACKGROUND §6.1) as a second picture golden;
  - interrupts: each source, enable/clear/disable semantics, the 1 Hz/50 Hz/1 kHz periods, TG mode at
    250 000/(n + 1), VINT at the D6 edge, two consecutive VINT blocks giving one interrupt;
  - sound: pitch from *n*, each distortion's sequence period, noise clock sources, sync hold and release,
    high-pass and ring cases, D/A ×4, stereo independence, BFh bit 1's ×2/3;
  - keyboard: every matrix key typed and seen by EXOS; the joysticks through B6h;
  - `FILE:`: `LOAD "FILE:x.com"` starts a program; SAVE from BASIC writes a host file; the ROM image
    matches its source;
  - tape: SAVE to `.tap`, LOAD in a fresh machine, with and without the turbo, at fast and slow speed;
    an EPTE file loads; motor pause;
  - EXDOS (Phase 9): directory of a disk, SAVE/LOAD round trip, write protection, `EXDOS.INI` boot.
- **Boot goldens:** the EXOS banner and the IS-BASIC prompt on both models (picture hashes recorded only
  after checking them by eye); **EXOS's LPT dumped from the running machine** (`LP_POINTER` at BFF4h,
  to the RELOAD LPB) as a fixture — this answers N4 (what EXOS's stock table is) and is allowed as an
  observation of the ROM.
- **Cross-core suites** that list every core: the contract test, state determinism and layout, reverse
  journal and export contract, history drivers, profile, `debug-recording-cores`, `hardware-specs`,
  machine-select, new-project, menu structure, `runner-machines`, CLI e2e.
- **Oracle runs (manual, never in CI):** run the same Klive-written programs in ep128emu; compare
  screens, cycle totals, interrupt positions and sound. Record observed results in Klive's words in the
  core README. Where Klive and the oracle disagree, the research pack decides, and the README says why.
  Third-party demos (Bad Apple!, the interlace demos, PJV Raster) are run by hand for confidence; their
  licences are unknown, so **they never become fixtures**.
- **Performance:** `benchmark:ep-wasm` must show more than 10× real time. The slot stepper and the
  per-tick DAVE are the hot paths.
- **Tiers:** every core test goes in `build/e2e-tests.ts`; a file over 20 s moves to `E2E_SLOW_TESTS`.
  EXOS's cold boot (RAM test, banner) is several seconds of machine time: most tests use the bare
  machine or a booted state.

---

## 14. Open hardware questions that affect the code

Each gets one constant or define, its default and its reason in the core README. None blocks a phase.

| # | Question | Default | Where it is discussed |
|---|---|---|---|
| Q1 | VINT at the start or the end of the block (does the board invert `/VIRQ`?) | end (ep128emu, measured) — revisit after reading EP64 sheet 1 | §3.5; NICK BG §2.6, N9 |
| Q2 | Which RM bit is ALTIND1 | bit 6 (guide, ep128emu); checked by EXOS's text colours in Phase 3 | NICK BG §2.9, N8 |
| Q3 | Where NICK samples a CPU request; cost per phase | the EXOS book's access points + ep128emu's latencies | §3.3; NICK BG N11 |
| Q4 | VM 6 and undefined combinations | generic renderer (unused bits 0, ALT OR-ed) | NICK OQ6; BG §2.8 |
| Q5 | With VRES = 0, does LD2 also reload | no (LD1 only) | NICK BG §2.6, N10 |
| Q6 | Measured RGB levels | resistor DAC values | NICK BG §3.3, N3 |
| Q7 | Poly period 2ⁿ or 2ⁿ − 1; poly reset state | 2ⁿ − 1; cleared at power-on | DAVE BG §2.6, §9 items 5, 9 |
| Q8 | DAVE tick order vs "everyone sees the previous tick" | ep128emu's order | DAVE BG §3.1, §9 item 3 |
| Q9 | High-pass with a distorted channel | ep128emu's rule | DAVE BG §9 item 10 |
| Q10 | DAC non-linearity | linear | DAVE BG §9 item 1 |
| Q11 | Segments 02h–03h on a 32K ROM | unmapped (FFh) | DAVE OQ2 |
| Q12 | Reads of write-only/undefined ports | FFh | DAVE OQ5 |
| Q13 | NICK phase at reset; NICK port values at power-on | 0; a fixed seed | §5, §6 |
| Q14 | Speaker mute: FIXBIAS bit 7 or 5 | bit 7 (stored only) | NICK BG N5 |
| Q15 | EXDOS control-register decode | 18h–1Fh | STORAGE OQ4 |
| Q16 | Tape header protection byte polarity | whatever EXOS writes (round trip) | DAVE OQ7 |
| Q17 | EXDOS 1.3 image vs MAME's | ship ours; compare if EXDOS misbehaves | `ep-roms-readme.txt` |

---

## 15. Phases and exit criteria

| Phase | Content | Exit criteria |
|---|---|---|
| **0. Decisions** | Settle D1–D9 (§16) with the project author. Read EP64 schematic sheet 1 for Q1 (fetch the scan again). | D1–D9 accepted 2026-10-30 (§16). Q1 still to read; its default (end of block) stands until then. |
| **1. Skeleton** | `ep.c` TU; segments and paging; ROM upload; ports; DAVE interrupts and timers; the half-T clock and NICK phase accumulator; NICK's slot stepper with the LPT walker and VINT but no pixels; a frame loop ending at VSYNC; loader; host; registry entry for `ep128` only; build and contract scripts. | Done 2026-10-30 (§18): `bootToBasic()` reaches IS-BASIC 2.1's "ok" (read from the LPT and video RAM); `boot.test.ts` pins EXOS's LPT; `dave.test.ts`, `nick-lpt.test.ts`. |
| **2. Timing** | §6: DAVE waits, the NICK stretch, the phase sweep export. | Done 2026-10-30 (§18): `timing.test.ts`; the Enterprise in `debug-loop-equivalence.test.ts`. The oracle comparison with ep128emu is not done yet (it needs a manual run). |
| **3. Picture** | §7: renderers, palette and levels, the pipeline, blanking, the TV window, beam position, VSYNC frame and field detection. | The boot picture's hash (checked by eye); `nick.test.ts`; Q2 settled by EXOS's text colours; the IS 1984 demo LPT golden. |
| **4. Sound** | §8.2–§8.3, stereo out. | `sound.test.ts`; the EXOS keyclick and `SOUND` statements heard in the running app; Klive's audio path carries stereo. |
| **5. Keyboard and `FILE:`** | §9.1, §9.2: matrix, host mapping, joysticks, the `FILE:` ROM and host side; the virtual keyboard after its design is approved. | `keyboard.test.ts`, `hostfs.test.ts`; a `.com` loads with `LOAD "FILE:…"` in the running app. |
| **6. 64K model** | `ep64`: EXOS 2.0, IS-BASIC 2.0, 64K. | `ep64.test.ts` (boot picture hash checked by eye; RAM size). |
| **7. IDE** | Partitions, the NICK and DAVE panels, disassembler (`RST 30h`), SysVars, charset, menus, state files, history, profile, CLI; the IS-BASIC listing if §11.4 finds the table. | Debug tests, the Enterprise in every cross-core suite; `MF_EXEC_HISTORY`, `MF_PROFILE`, `MF_REVERSE_DEBUG` on. |
| **8. Assembler and tape** | §12 (`.model ENTERPRISE`, Run/Debug through `FILE:`, `.com` export, project template), §9.3 (tape formats, playing, turbo, SAVE). | `code-injection.test.ts`, `project-templates.test.ts` (runs checked by eye), `tape.test.ts`; `klive run` and `klive test` on the Enterprise. |
| **9. EXDOS** | §10: the WD1770 variant (its own commit, Beta 128 and TVC byte-identical), the card, disks. | `exdos.test.ts`; EXDOS lists a disk in the running app. |
| **10. Ship** | Notices (`THIRD_PARTY_NOTICES.md`: CLK files if any were ported; the ROM readme), docs pages, an `AGENTS.md` section, the landing page's machine table (`docs/landing/LandingPage.tsx`, gated by release version), `README.md`'s machine list, the lessons in `.ai/wasm-migration-intent-and-lessons.md`, one `feature` changeset. `npm run test:slow` before release. | Gates and `doc:build` + `doc:check` green; both models, Run, tape and EXDOS checked in the built app. |

The changeset comes with the commit that completes the plan (AGENTS.md); phase commits carry none.
Docs for Phase 10:
- `docs/content/en/guides/machines/enterprise.mdx`, `reference/machine-types.mdx`,
  `reference/z80-assembler/enterprise.mdx`; screenshots from a `scripts/doc-shots/recipes/guides-enterprise.cjs`
  recipe;
- an "Under the hood" series on NICK (the slot, the LPT, the pipeline, contention) adapted from the
  research under `.ai/hardware-articles-guide.md`: sources unnamed, facts proved on the emulated machine.

### Follow-ups (not in this plan)
- A woven interlaced picture; expansion RAM; EXOS 2.2–2.4 and the language ROMs; EXDOS 1.4 + IS-DOS.
- SDEXT, IDE, RTC, EnterMice; printer, serial and network.
- ROM annotations for EXOS and IS-BASIC written from scratch (`.ai/rom-annotations/` rules).
- A turbo (6 MHz) option, timing DAVE from its own input clock.
- The IS-BASIC listing, if Phase 7 does not find the token table.

---

## 16. Decisions (accepted by the project author on 2026-10-30)

All nine recommendations were accepted as written. The questions and recommendations follow for the
record.

- **D1 — provenance.** *Recommendation:* Klive's own code from the research pack; CLK (MIT) ported with
  its notice only where it saves work (keyboard table, EXDOS register, the `FILE:` ROM's shape);
  MAME for interface facts; GPL sources not read for design (the pack already holds their facts);
  ep128emu run as an oracle only.
- **D2 — one machine ID, `ep`, with the models `ep128` (default) and `ep64`** (§4.3). *Recommendation:
  yes.* They differ in ROMs and RAM, not in how users think of the machine.
- **D3 — ROMs.** *Settled 2026-10-30:* bundled under Werner Lindner's free-use permission (no charge,
  original company names kept); `src/public/roms/ep-roms-readme.txt`.
- **D4 — time base:** whole T-states plus a half-T clock (the TVC's D5), NICK as an exact rational
  phase, NICK stepped eagerly per slot (§3.1). *Recommendation: yes.*
- **D5 — contention:** the "next Z80 window" rule with named access-point and latency constants,
  defaulting to the EXOS book's points and ep128emu's recorded latencies (§3.3). *Recommendation:
  yes.*
- **D6 — VINT edge:** end of block by default, one constant, revisited after reading the schematic
  (§3.5). *Recommendation: yes.*
- **D7 — the picture:** 736 × 288 (slots 10–55), aspect ≈ 0.49, the one-slot pipeline, resistor DAC
  levels by default (§7). *Recommendation: yes.*
- **D8 — program loading:** a Klive-written `FILE:` EXOS ROM in the repository, trapped by address
  (§9.2); Run and Debug through it. *Recommendation: yes.* The alternative — injecting the program
  and imitating EXOS's start procedure — would duplicate EXOS's reset, segment allocation and channel
  setup, and break with every EXOS version.
- **D9 — tape SAVE format:** ep128emu's native 1-bit `.tap` (§9.3). *Recommendation: yes*; EPTE is
  read-only in the tools that know it.

---

## 17. Risks

- **The slot stepper and the per-tick DAVE are the hot path** (≈ 17 800 slots and 5 000 ticks per frame).
  Keep both table-driven, keep the per-access video check to one compare on the page flags, and measure
  with the benchmark from Phase 1.
- **Contention constants are tuned, not derived** (Q3). The model must keep them in one table; tests pin
  the *model's* behaviour, and the oracle comparison is recorded, so a later measurement changes data,
  not code.
- **Two clocks:** any drift between the half-T clock and the NICK phase breaks replays. Integer
  arithmetic only (§3.1); the debug loop's volatile-state rule (`src/emu/z80/wasm/README.md`) applies to
  the NICK accumulator and the DAVE tick phase.
- **EXOS's boot is long** (RAM test, ROM scan, banner). Tests start from a booted state or a bare
  machine; only the boot tests pay for it.
- **`FILE:` suspends the core on a host call.** Keep the request path synchronous inside a frame (the
  host answers before the next frame) and make the trap a no-op when the ROM is not paged in, so a
  program that happens to jump to the same address in another segment is unaffected.
- **ROM rights:** if a rights holder objects, the ROMs must be removable. Keep loading behind
  `EpRoms.ts`, so a user-supplied ROM setting is a settings change, not a rewrite.
- **No real hardware to check against.** The research pack is the reference; record every case where
  the oracle and the pack disagree, and its resolution, in the core README.

---

## 18. Implementation record

The core's README (`src/emu/machines/enterprise/wasm/README.md`) is the reference for how it works now.

### Phases 1–2 (2026-10-30)

- **No new Z80 hook.** H1 (`Z80_DELAY_OPCODE_FETCH`) gives DAVE's M1 set exactly; the port delay hooks
  and their `_TAIL` halves let a write to NICK land at the I/O access point. Every other core is
  untouched.
- **Time (D4):** as planned. `epHalfClock` beside `cpu.tacts`; NICK's position an integer accumulator
  (40 434 603 per half-T, a slot every 363 520 000); NICK stepped eagerly per slot, DAVE per tick. The
  core is 175 KB; the whole boot (about 440 frames) runs in well under a second in the tests.
- **What booting takes (observed):** EXOS 2.1 tests the RAM, showing `EXOS 2.1  TESTING  xx` as it counts
  the segments down (FFh to F8h, about 300 frames), then the ENTERPRISE banner with "1985 Intelligent
  Software Ltd" under it, which waits for a key. After a key, IS-BASIC prints `IS-BASIC program 0`,
  `131072 bytes in system`, `116121 bytes unused`, `ok`. The harness reads all of this from the LPT and
  video RAM (`screenText()`), so Phase 1 needed no pixels.
- **Findings:**
  - **EXOS sets BFh = 04h** (waits on M1 only) during boot: OQ9 of NICK_VIDEO.md is settled.
  - **EXOS 2.1's LPT (N4)**, pinned in `boot.test.ts`: 34 LPBs, 312 lines. 28 CH128 rows of 9 lines (the
    status line and 27 text rows), then a 14-line blank PIXEL block with VINT, then three VSYNC blocks
    (3 lines; 4 lines with sync on from slot 6; 1 line with sync off at slot 32: 4.5 lines of sync), a
    4-line blank block and a 34-line RELOAD block. So EXOS's video interrupt (at the end of its VINT
    block, D6) comes three lines before vertical sync, and the frame ends during its handler.
  - EXOS boots whatever NICK's ports hold at power-on (three seeds tested).
- **The stretch model (D5, Q3):** the access points are the EXOS book's (M1 at T2.0, memory T2.5,
  I/O T3.5), held to NICK clocks 10–15 of a slot. ep128emu's latency constants were *not* used: the
  model's window already reproduces the lock to the grid, and the single-access costs wait for the
  oracle comparison.
- **Pulled forward:** the keyboard matrix (Phase 5; the banner needs a key) and DAVE's tone counters
  (Phase 4; the tone-generator interrupt needs them).
- **Registry:** `ep128` only (`machine-select.test.ts` counts the Enterprise as a one-model leaf until
  Phase 6). No hardware-sheet media until tapes (Phase 8); no history, profile or reverse debugging in
  the IDE until Phase 7, though the core carries the recorder and the profile. `MF_INJECT_SUPPORT` is
  false until Phase 8. The hardware sheet has its texts (`hardware.*.enterprise`).
- **Not checked in the running app:** with no pixels yet, the emulator panel shows a black screen.
  Phase 3 checks the app.
