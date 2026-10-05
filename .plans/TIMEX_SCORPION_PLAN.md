# Timex TC2048 / TC2068 / TS2068 and Scorpion ZS-256 (G9.4)

Status: **G9.4a ✅ done** (2026-10-05; main, unreleased; see §10). G9.4b (TC2068/TS2068) is next;
G9.4c (Scorpion) can start, since G9.1b is done.
Base plan: [CLOSING_THE_GAPS_PLAN.md](CLOSING_THE_GAPS_PLAN.md), §G9 (G9.4, "long-tail clones",
size L each, low priority).
Related: [PENTAGON_128_PLAN.md](PENTAGON_128_PLAN.md) (G9.1, done: a clone as a timing profile of
an existing core) and [BETA128_TRDOS_PLAN.md](BETA128_TRDOS_PLAN.md) (G9.1b: the Scorpion needs it).

> **Standing rule (from the base plan):** when a machine of this plan ships, update §2 ("Other
> machines", the snapshot row) and §4 (W9) of
> [LANDING_PAGE_COMPETITIVE_ANALYSIS.md](LANDING_PAGE_COMPETITIVE_ANALYSIS.md) and mark its part of
> G9.4 done in the base plan, in the same change. A visual change also updates
> `.ai/ui-theming-intent-and-lessons.md`.

---

## 1. What is being added

G9.4 is three machines in two families. They share little hardware, so this plan delivers them as
**three parts, each shippable on its own** (P1), in this order:

| Part | Machine(s) | What makes it different from what Klive has | Depends on |
|---|---|---|---|
| **G9.4a** | Timex **TC2048** | A 48K with Timex's SCLD chip: extended screen modes (second screen, 8×1 hi-colour attributes, 512×192 hi-res), port `$FF`, a built-in Kempston port | — |
| **G9.4b** | Timex **TC2068** (PAL, Portugal) and **TS2068** (NTSC, USA) | The SCLD modes plus a 24K ROM (16K HOME + 8K EXROM), bank switching in 8K chunks (port `$F4`) between HOME, DOCK and EXROM, an AY on ports `$F5`/`$F6`, joysticks through the AY, the cartridge DOCK (`.dck`) | G9.4a (the SCLD) |
| **G9.4c** | **Scorpion ZS-256** | A 128K clone with 256K RAM, a second paging port (`$1FFD`), four ROMs (128K editor, 48K BASIC, TR-DOS, a service monitor), a built-in Beta 128 | G9.1b (the Beta 128) |

The hardware facts in this table are the starting point for each part's Phase 0, which confirms
them against primary documentation and records them with their sources (P7) before any code relies
on them. Frame timings in particular are not stated here: each part measures or sources its own.

Everything that works on the Spectrum models should work on these: run and debug, code injection
where the ROM allows it, tapes, snapshots, Klive state files, the memory and disassembly views.

**Out of scope:** the TS2068's and TC2068's rarer peripherals (the 2040 printer beyond what the
Spectrum printer support already does, the 2050 modem), the Scorpion's ProfROM variants and its
SMUC/IDE extension, the Timex FDD (TOS) system, and the TS1500/TS1000 (ZX81 clones; G9.3 covers
the ZX81).

## 2. What the code looks like today (the foundation)

- **Cores.** `sp48` (48K/16K, PAL/NTSC: `sp48HardReset(is16k, isNtsc)`), `sp128` (128K and, since
  G9.1, the Pentagon: `sp128HardReset(timing)`), `spp3e`, `zxnext`, `zx8081`. The Spectrum cores
  share C pieces by `#include` with macro renaming: `zxSpectrum/wasm/common/zx-spectrum-ula.c`
  (timing tables, rendering, contention, floating bus), `-psg.c`, `-tape.c`, `-beeper.c`,
  `-keyboard.c`, `-ports.c`.
- **The picture is 352 pixels wide.** `sp48`/`sp128` render one buffer pixel per Spectrum pixel
  (`SP48_SCREEN_BUFFER_WIDTH_MAX 352`). The TC2048's 512×192 hi-res mode needs two buffer pixels per
  Spectrum pixel. The Next already does this: its buffer is 720 wide, and the emulator panel scales
  by the machine's reported size (`screenWidthInPixels`).
- **The Next already emulates the Timex screen modes**, from its FPGA source
  (`_input/next-fpga/src/video/zxula.vhd` ~191-437): port `$FF` bits 0-2 select the mode, bits 3-5
  the hi-res ink, and the pixel and attribute addresses of each mode. `test/zxnext-hw/ula/
  timex-modes.test.ts` and `timex-port.test.ts` pin them. That is the Next's *implementation* of the
  SCLD, not the SCLD itself, so it is a cross-check for G9.4a, not its specification (P7).
- **Registry features are per machine, not per model:** `MF_ROM` (ROM pages) and `MF_BANK` (RAM banks)
  drive the memory and disassembly views and the breakpoint forms
  (`useDisassemblyMachineSetup.ts`, `breakpoint-form.ts`). A Scorpion (4 ROMs, 16 banks) therefore
  cannot be just a model of the 128K machine (2 ROMs, 8 banks) the way the Pentagon is (P3).
- **Snapshots already name these machines:** `.szx` machine ids 8 (TC2048), 9 (TC2068), 10 (Scorpion),
  12 (TS2068) and `.z80` hardware modes 10 (Scorpion), 14 (TC2048), 15 (TC2068), 128 (TS2068) parse
  as "unsupported" (`szxFile.ts`, `z80File.ts`); `spectrumSnapshotMapping.ts` refuses them. TZX's
  hardware-type block lists them too (`TzxComputerType.ts`).
- **Test harnesses:** `test/harness/sp48/` and `test/harness/sp128/` (real ROMs, keys, flows,
  snapshots, screen text); hardware tests in `test/sp128-hw/` run each check on a machine with known
  results first (the G9.1 pattern: the 48K or 128K proves the method, then the clone is measured).
- **ROMs** ship with a readme and a CRC test per set (`spp3-roms-readme.txt`,
  `test/machines/p3-rom-images.test.ts`); G9.1b set the rule for ROMs whose rights are unclear: the
  user supplies them.

## 3. Decisions (accepted by the author, 2026-10-04; see §9)

- **P1. Three parts, shipped separately.** Each part has its own phases, tests, docs and roadmap
  update; the competitive analysis changes when a part ships, not at the end. G9.4c waits for G9.1b.
- **P2. One Timex core for G9.4a and G9.4b** (Q2): a new C core `timex`
  (`src/emu/machines/timex/wasm/`), machine id `timex`, models `tc2048`, `tc2068`, `ts2068`. It is
  built from the shared Spectrum C pieces plus a new shared `zx-spectrum-scld.c` (the screen modes and
  port `$FF`), with the 2068 memory map and the AY switched on by the model. The TC2048 is *not* a
  model of the 48K: its SCLD changes the renderer and the picture size, and the 2068 needs the same
  SCLD; one core keeps the SCLD in one place.
- **P3. The Scorpion is its own machine on the `sp128` core** (Q3): machine id `scorpion`, its own
  registry entry (`MF_ROM: 4`, `MF_BANK: 16`), built from the same `sp128.c` with a third timing
  profile and a `$1FFD`/256K memory mode switched on at hard reset (`sp128HardReset(timing, ...)`),
  and the Beta 128 device from G9.1b. One C core, two machine ids - unlike the Pentagon, which needed
  no new registry features.
- **P4. Timex pictures are 704 pixels wide** (two buffer pixels per Spectrum pixel, always), so the
  hi-res mode needs no size change mid-frame; the panel scales as it does for the Next. The 48K and
  128K keep 352.
- **P5. ROMs follow G9.1b's rule** (Q1): shipped with a readme, a notice and a CRC test when a source
  with clear permission to distribute them with emulators is found; otherwise named by the user in
  the settings, with the machine's features explaining why it cannot start.
- **P6. ROM addresses by observation.** Code-injection and tape flows on the Timex and Scorpion ROMs
  wait at addresses found by running each ROM in the harness, recorded in a per-machine table like
  `p3RomSets.ts`; no third-party ROM disassembly is copied (as G9.2 P5).
- **P7. Provenance.** Hardware facts come from the manufacturers' technical manuals and data sheets,
  added to `_input/` where they may be; the Next's SCLD implementation is a cross-check only. No code
  from other emulators (Fuse, ZEsarUX, Unreal Speccy: GPL) is copied or translated; behaviour is
  recorded in Klive's words.

## 4. G9.4a — Timex TC2048 (L)

### Behaviour to emulate (confirmed in Phase 0)
1. Port `$FF` (SCLD control): bits 0-2 screen mode (standard, second screen at `$6000`, hi-colour
   8×1 attributes, 512×192 hi-res), bits 3-5 the hi-res ink/paper pair, bit 6 interrupt disable;
   reading it back.
2. The modes' pixel and attribute addresses, the hi-res colours (ink and its complement, border
   included), and the timing of a mode change within a frame.
3. The TC2048's frame, contention and floating-bus behaviour (Phase 0 decides from documentation
   whether they equal the 48K's; the harness then measures them against that statement).
4. The built-in Kempston joystick port; the ROM (a modified 48K ROM).

### Phases
- **0 — references and ROM (S):** SCLD documentation and the TC2048 technical manual into `_input/`
  if their licence allows, facts with sources in §8; the ROM (P5); boot it in a minimal harness and
  record the flow addresses (P6).
- **1 — the core (M):** `timex.c` with the shared Spectrum pieces; `zx-spectrum-scld.c`; the 704-wide
  renderer for all four modes; port `$FF`; the Kempston port; `timexHardReset(model)`; the build
  script, loader, export list and layout fingerprint, as for `sp48`.
- **2 — host, registry, harness (M):** `TimexWasmHost` / `TimexWasmV2Machine` (keyboard, beeper, tape,
  floating bus, flows, sysvars, partitions), the machine and model in the registry and
  `hardware-specs.ts`, menus (tape, snapshot), `test/harness/timex/` (or the sp48 harness extended:
  decided in Phase 1 by how much it can share).
- **3 — hardware tests (M):** `test/timex-hw/`: each screen mode by pixel probes against the
  documented addresses and colours (cross-checked with the Next's results for the same writes), mode
  changes mid-frame, port `$FF` readback and the interrupt-disable bit, frame and contention
  measured as G9.1 measured the Pentagon's, the Kempston port, booting, code injection, tape loading.
- **4 — snapshots and state (S–M):** `.szx` machine 8 with its `SCLD` block, `.z80` mode 14; capture
  and restore of port `$FF`; Klive state files (the core's memory image).
- **5 — IDE, docs, roadmap (S):** machine-select dialog and favourites (Q4), new-project templates
  (`project-templates/timex`, from `sp48`'s), `docs/content/machine-types.mdx`, the competitive
  analysis, G9.4a ✅.

## 5. G9.4b — Timex TC2068 and TS2068 (L)

### Behaviour to emulate (confirmed in Phase 0)
1. The 24K ROM: 16K HOME ROM plus the 8K EXROM; the two models' ROMs (the TS2068's US ROM is not
   Spectrum-compatible; the TC2068's is closer).
2. Memory: eight 8K chunks, each mapped by port `$F4` to HOME or to the bank port `$FF` bit 7
   selects (DOCK or EXROM); the DOCK cartridge's RAM/ROM chunks.
3. The AY on `$F5` (register select) / `$F6` (data), its clock, and the joysticks read through it.
4. The TS2068's 60 Hz NTSC frame and the TC2068's 50 Hz PAL frame; contention; the SCLD from G9.4a.
5. `.dck` cartridge images: their chunk map and contents.

### Phases
- **0 — references and ROMs (S):** the TS2068 technical manual and the cartridge format's
  documentation, facts with sources in §8; the two ROM sets (P5); flow addresses (P6), including how
  a program is injected when the ROM's BASIC differs (the TS2068).
- **1 — the core (M):** models `tc2068`, `ts2068` on the Timex core: the chunk map, `$F4`, `$FF`
  bit 7, the AY (`zx-spectrum-psg.c` on the new ports), the joysticks, the 24K ROM upload.
- **2 — the DOCK (M):** `.dck` reader; a Machine-menu "Insert cartridge" with the media strip; the
  cartridge's chunks in WASM memory; eject; state files carry it.
- **3 — host, registry, debugger (M):** models and hardware specs; the memory and disassembly views for
  8K chunks across HOME/DOCK/EXROM (partition labels, `MF_ROM`/`MF_BANK` semantics for chunks - the
  first machine whose pages are 8K, Q5); sysvars.
- **4 — hardware tests (M):** `$F4` mapping of every chunk, DOCK/EXROM selection, the AY on its ports
  and its tone frequency, joysticks, frame and contention per model, booting both ROMs, a `.dck`
  that runs, code injection and tape loading where the ROM supports them.
- **5 — snapshots and state (S–M):** `.szx` machines 9 and 12 with `SCLD` and `DOCK` blocks, `.z80`
  modes 15 and 128; Klive state files.
- **6 — IDE, docs, roadmap (S):** as G9.4a; G9.4b ✅.

## 6. G9.4c — Scorpion ZS-256 (L, after G9.1b)

### Behaviour to emulate (confirmed in Phase 0)
1. 256K RAM in 16 banks: `$7FFD` as on the 128K plus `$1FFD` (an extra bank bit, RAM at `$0000`,
   the service-monitor ROM), and how the two ports combine.
2. Four ROMs and how they are selected: 128K editor, 48K BASIC, TR-DOS (through the Beta 128's
   paging trap from G9.1b) and the service monitor.
3. The Scorpion's frame, contention (or its absence) and floating bus: a third `sp128` timing profile.
4. The built-in Beta 128 (G9.1b's device), two drives.

### Phases
- **0 — references and ROMs (S):** the Scorpion's documentation, facts with sources in §8; the ROM set
  (P5); flow addresses (P6).
- **1 — the core (M):** `sp128.c`: 256K, `$1FFD`, four ROM pages, the Scorpion timing profile; the
  128K golden and the Pentagon tests stay green (G9.1 P7), the speed check repeated.
- **2 — machine, host, registry (M):** machine id `scorpion` (P3) on the `sp128` core; host
  (partitions R0-R3, B0-B15, flows, sysvars), hardware specs, disk menus and media from G9.1b.
- **3 — hardware tests (M):** in `test/sp128-hw/`: paging through both ports for all 16 banks and 4
  ROMs, RAM at `$0000`, the timing profile measured as the Pentagon's was, TR-DOS paging, booting,
  code injection, tape and the Disk Loader.
- **4 — snapshots and state (S–M):** `.szx` machine 10, `.z80` mode 10, with `$1FFD` and the 16 banks;
  the Beta 128 blocks from G9.1b; Klive state files.
- **5 — IDE, docs, roadmap (S):** as G9.4a; G9.4c ✅, and G9.4 ✅ in the base plan.

## 7. Risks

| Risk | Mitigation |
|---|---|
| The Timex or Scorpion ROMs cannot be shipped | P5: the user supplies them; the machine says why it cannot start without them |
| Primary documentation is thin (the TC2048, the Scorpion) | Phase 0 records each fact's source; a fact without one is measured on known software or left out, as `hardware-specs.ts` does |
| A 704-wide picture costs speed or breaks screen consumers (recordings, thumbnails, screenshots, the RZX player) | measured in G9.4a Phase 1; those consumers already handle the Next's 720 |
| 8K chunks do not fit the memory views' 16K partitions | Q5; G9.4b Phase 3 is where it is solved, and the cost is known before that part starts |
| The Scorpion's changes to `sp128.c` disturb the 128K or the Pentagon | the 128K golden and the Pentagon timing tests (G9.1) gate Phase 1 |
| The TS2068's ROM makes code injection impractical | Phase 0 finds out; a TS2068 without injection (load by tape only) is acceptable and documented |

## 8. Reference values (filled in each part's Phase 0)

| Machine | Value | Klive | Source |
|---|---|---|---|
| TC2048 | port `$FF` bits 0-2 | 000 primary display file `$4000`; 001 second file `$6000` (its attributes at `$7800`); 010 extended colour: pixels `$4000`, an attribute per 8 × 1 at `$6000` + the pixel offset; 110 64 columns: even columns `$4000`, odd `$6000`. "Other combinations may produce unpredictable results": Klive decodes the bits one by one as the Next does (bit 0 the second file, bit 1 the attribute from the second file's pixel address, bit 2 two bytes as 16 narrow pixels) | [TM] 2.1.13.1, 5.2.1-5.2.3; cross-check: zxula.vhd ~230-260 |
| TC2048 | port `$FF` bits 3-5 | 64-column ink: 000 black/white … 111 white/black, paper the complement (ink ^ 7); the border shows the paper colour; FLASH 0 | [TM] 2.1.13.1, table 3.2.2-1, 5.2.3 |
| TC2048 | 64-column BRIGHT | **BRIGHT**, border included. [TM] says BRIGHT is fixed at 0 (the TS2068); [FAQ] (the TC2048) says every colour, the border too, is BRIGHT, and the Next agrees. Klive keeps it per model (`timexModels.ts` `hiresBright`); G9.4b decides the 2068s | [FAQ]; [TM] 5.2.3; zxula.vhd ~431 |
| TC2048 | port `$FF` bit 6, bit 7 | bit 6 = 1 inhibits the frame interrupt (0 enables); bit 7 the EXROM/DOCK select (no effect on the TC2048) | [TM] 2.1.8.4, 2.1.13.1 |
| TC2048 | port `$FF` read, decoding | returns the last value written; Klive decodes the full low byte (`$xxFF`), as [TM] lists the ports | [FAQ]; [TM] I/O port table |
| TC2048 | Kempston port | built in; Klive decodes A5 low (with A0 high), the Kempston interface's decoding: no source gives the TC2048's | [FAQ] ("Kempston joystick port"); decoding: Klive's choice |
| TC2048 | CPU clock | 3.528 MHz (14.112 MHz / 4) | [TM] 2.1.8.2; [FAQ] (European models) |
| TC2048 | frame, contention, floating bus | 224 T × 312 lines = 69,888 T, the 48K's contention pattern from tact 14,335, the 48K's floating bus (except port `$FF` and the Kempston port, which answer themselves). [TM] gives the SCLD's line as 896 crystal clocks = 224 T and memory contention by stopping the CPU clock; no source gives the TC2048's line count ([FAQ]: "311 or 312", unmeasured), so the 48K's stands | [TM] 2.1.8.2-2.1.8.3; [FAQ] |
| TC2048 | ROM | the Sinclair 48K ROM with 7 bytes changed: the CALL at `$1299` (the start-up/NEW path's copyright message, after `XOR A`) goes to `$386E`, which does `OUT ($FF),A` and the original CALL `$0C0A`. CRC32 of the copy checked: `f1b5fa67` (the same file the Next's distribution carries). Not shipped (P5): see §10 | observed by running and comparing (P6) |
| TC2068 / TS2068 | `$F4` chunk map; `$FF` bit 7; AY ports and clock | | |
| TC2068 / TS2068 | frame per model | | |
| Scorpion | `$7FFD` + `$1FFD` bits; ROM selection | | |
| Scorpion | frame, contention, floating bus | | |
| all | ROM versions and CRC32s | TC2048 above | |

Sources: **[TM]** Timex Sinclair 2068 Technical Manual (Timex, 1983; text at
retromaniek.pl/wp-content/uploads/2019/09/Timex-Sinclair-2068-Technical-Manual-best.pdf);
**[FAQ]** World of Spectrum, "Timex Technical Information"
(worldofspectrum.org/faq/reference/tmxreference.htm). Snapshot formats: zx-state `SCLD` block
(spectaculator.com/docs/zx-state/scld.shtml: `chF4`, `chFf`); `.z80` hardware mode 14 = TC2048, bytes
35 and 36 the last OUTs to `$F4` and `$FF` in a Timex mode (worldofspectrum.org/faq/reference/z80format.htm).

## 9. Decisions from the author (2026-10-04)

All proposals accepted:

- **Q1. ROMs:** G9.1b's rule for all three parts (P5) - a ROM set ships only with clear permission to
  distribute it with emulators; otherwise the user names the files in the settings, and the machine
  says why it cannot start without them.
- **Q2. Timex architecture:** one new Timex core for the TC2048, TC2068 and TS2068, with the SCLD in a
  shared `zx-spectrum-scld.c` (P2).
- **Q3. Scorpion architecture:** its own machine id, `scorpion`, on the `sp128` core (P3).
- **Q4. Order and scope:** G9.4a, then G9.4b, then G9.4c after G9.1b, each its own change. The TS2068
  stays in G9.4b (without code injection if its ROM makes that impractical, §7). No new default
  favourites.
- **Q5. 8K pages in the debugger:** the 2068's memory is shown as 8K chunks with their own labels
  (`H0`-`H7`, `D0`-`D7`, `X0`-`X7`), extending the partition model in G9.4b Phase 3.

## 10. G9.4a as built (2026-10-05)

**The core (Phase 1).** `src/emu/machines/timex/wasm/timex/timex.c` is the 48K machine (`sp48.c`)
compiled with `SP48_SCLD`, two buffer pixels per Spectrum pixel and the 3.528 MHz clock; the SCLD is
the shared `zx-spectrum-scld.c`, which `zx-spectrum-ula.c` includes in place of its renderers. The
48K, 128K and +3E cores build bit-identical to before (checked against `HEAD` builds). The 48K's
exports keep their `sp48` names in the Timex core, so `TimexWasmV2Machine` extends
`ZxSpectrum48WasmV2Machine` through four protected hooks (`hardResetCore`, `loadMachineRom`,
`stateCoreId`, the snapshot extras) and loads through the 48K loader with its own artifact
(`zx-timex.wasm`). **Departure from P2's wording:** no separate copy of the machine loop - the 48K's
`sp48.c` is itself the shared piece; G9.4b's memory map will hang off the same switch. Speed: about
6% slower per frame than the 48K core in the standard mode, 8% in the 64-column mode (≈0.5 ms per
20 ms frame, measured in Node).

**The ROM (P5, Q1).** The TC2048 ROM is "Copyright Sinclair Research Ltd. and Timex"; Amstrad's
permission covers only Sinclair and Amstrad code and says to ask Timex for the rest, so the rights
are not clear and Klive does not ship it. **Departure:** instead of refusing to start, the TC2048
boots the shipped Sinclair 48K ROM until the user names a TC2048 ROM (setting
`emuOptions.tc2048RomFile`, **Machine > TC2048 ROM**): the TC2048 ROM differs only by clearing port
`$FF` at start-up, so every flow, test and program works on either, and CI needs no ROM. The
ROM-gated tests run with `KLIVE_TC2048_ROM` set.

**Host, registry, harness (Phase 2).** Machine `timex`, model `tc2048` (`timexModels.ts`, config
`MC_TIMEX_MODEL`), after the Next in the registry; hardware sheet (the raster given in Spectrum
pixels, 352 × 288); the 48K's keyboard, tape, snapshot and state menus plus **Kempston Joystick**
(joystick 1's bindings, `setJoystickState`) and **TC2048 ROM**; the media strip; tape loading from
the IDE. The panel shows the 704-wide buffer at `[0.5, 1]`. The harness is
`test/harness/timex/` - the 48K harness's session class with SCLD probes (decided in Phase 1: it
shares everything else).

**Tests (Phase 3).** `test/timex-hw/`: every mode by pixel probes, mirroring the Next's TMX-001 -
TMX-005 and TMX-013 cases (the P7 cross-check), the eight 64-column inks, FLASH, a mode change
mid-frame, port `$FF` readback and decoding, the interrupt inhibit, the Kempston port and its
decoding, the model table against the core, contention tact for tact against the 48K core and a
contended loop measured on both, the floating bus following the selected display file, injection,
tape loading, and the ROM's start-up hook (ROM-gated).

**Snapshots and state (Phase 4).** `.szx` machine 8 with the `SCLD` block, `.z80` hardware mode 14
with `$F4`/`$FF` in bytes 35/36, both loading onto the TC2048 with the screen mode and both written
by it; a `.sna` is written as a 48K and names the lost port `$FF`. Klive state files record the core
as `timex`; the determinism test covers it.

**IDE and docs (Phase 5).** No new default favourite (Q4). `project-templates/timex` from the 48K's.
`docs/content/machine-types.mdx` has a TC2048 section. No style or theming change, so
`.ai/ui-theming-intent-and-lessons.md` is unchanged.

