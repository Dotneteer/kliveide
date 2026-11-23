# Existing Commodore 8-bit Emulators, Test Suites, Tools and ROM Rights: Survey for Klive

Surveyed 2026-11-23 for the Commodore plan (C64 all models, VIC-20, C16/Plus/4, C128, a
cycle-accurate 1541). Klive itself is MIT (`LICENSE`, "MIT License"). Every licence marked
**(API)** was read from `gh api repos/OWNER/REPO` on 2026-11-23; every one marked **(header)** was
read from the file's own header through `gh api .../contents`. Nothing was cloned, downloaded into the
repository or copied. GPL sources were read only for facts (file lists, licence lines, documented
behaviour). Statements marked *inference* are my conclusions and were not read in a source. Where
sources disagree, both are kept.

This pack is facts, not a plan. It follows the shape of `dev/research/sam-coupe/EXISTING_EMULATORS.md`
and `dev/research/enterprise128/EXISTING_EMULATORS.md`, and uses the provenance vocabulary of
`dev/plans/SAM_COUPE_PLAN.md` §0.1 / §16 D1, D3: **port** (permissive, with notices), **facts only**
(GPL or similar: read for facts, recorded in Klive's words, no code), **oracle** (run the program,
record observed results of Klive's own test programs, never in CI), **not at all** (no licence, or
licence forbids).

---

## §1 Summary table

| # | Project | Licence (verified 2026-11-23) | Machines / components | Usable as |
|---|---|---|---|---|
| 1 | **VICE** 3.x (x64sc, x64, xvic, xplus4, x128, VSID, c1541 tool) | **GPL-2.0-or-later** (`vice/COPYING`, `vice/README`, header of `src/alarm.h`; API `null` on the svn-mirror) | Every Commodore 8-bit, 1541/1541-II/1570/1571/1581/2031/40x0/80x0/1001, TCBM 1551, CMD drives | **Oracle** (the reference) + facts only |
| 2 | **Clock Signal (CLK)** | **MIT** (API; `LICENCE`) | VIC-20, Plus/4 (C16 family), C1540/C1541; components 6560, 6522, 6526, SID, 6502 | **Port** |
| 3 | **MAME** Commodore drivers and devices | Project GPL-2.0+; the files listed in §2.3 are **BSD-3-Clause** (header, each checked); SID engine `3rdparty/residfp` is **GPL-2.0+** | c64, vic20, plus4, c128, vic10, c65, cbm2, pet; c1541/c1571/c1581; all MOS chips | **Port** (BSD-3 files only); residfp facts only |
| 4 | **floooh/chips** | **zlib** (API; `LICENSE`, every header) | m6502 (6502/6510), m6526, m6569, m6581, m6522, m6561; systems c64, vic20, c1530, c1541 | **Port** |
| 5 | floooh/chips-test | MIT (API) | Tests, examples; **contains Commodore ROMs as C arrays** (§5.4) | Read; never copy the ROM headers |
| 6 | **VirtualC64** (Dirk Hoffmann) v6.2 (2026-10-31) | App **GPL-3.0+**; core **MPL-2.0** (files dual "GPL-3.0-or-later OR MPL-2.0", header); CPU **Peddle MIT**; reSID GPL-2.0+ (`LICENSE`) | C64 (PAL/NTSC, VIC-II revisions), 1541, datasette | **Peddle: port.** Core: MPL-2.0 (file-level copyleft, §2.6). Oracle |
| 7 | **Peddle** (6502 family CPU) | **MIT** (API) | 6502/6507/6510/8502 family | **Port** |
| 8 | **Denise** | GPL-3.0 (SourceForge project page; AUR says GPL-3.0-or-later) | C64 + Amiga | Facts only; oracle |
| 9 | **Hoxs64** (David Horrocks) | **GPL-3.0** (API, `davidhorrocks/hoxs64`); third-party sites say "freeware, closed source" (older status) | C64 + 1541 | Facts only; oracle (Windows) |
| 10 | **Frodo 4** (Christian Bauer) | **GPL-2.0** (API, `cebix/frodo4`) | C64 + 1541 | Facts only; oracle |
| 11 | **Emu64** (Thorsten Kattanek) | **GPL-2.0** (API, `ThKattanek/emu64`) | C64 + 1541 | Facts only |
| 12 | **YAPE / yapeSDL** (Attila Grósz) | **GPL-2.0** (API, `calmopyrin/yapesdl`) | Plus/4 family, C64, VIC-20, 1541; embeds ROMs | Facts only; oracle for TED |
| 13 | tedplay (Attila Grósz) | **No licence file** in `calmopyrin/tedplay`; floooh's `m6581.h` says "used under Unlicense" (secondhand) | TED + SID sound | OQ6; treat as not usable until confirmed |
| 14 | micro64 (BeRo / farbrausch) | No source published (*inference*: proprietary freeware) | C64, half-cycle VIC-II | Oracle only (testbench results exist, §3) |
| 15 | Z64K (William McCabe) | Proprietary (GameTechWiki; LinuxLinks) | C128, C64, VIC-20 (+ Spectrum, 2600) | Oracle only |
| 16 | CCS64 (Per Håkan Sundell) | Closed shareware (*inference* from Wikipedia "CCS64") | C64 | Not at all (oracle at most) |
| 17 | **MiSTer** C64 / VIC20 / C16 / C128 cores | Top-level `.sv` **GPL-2.0-or-later** (header); many RTL files (FPGA64 by Peter Wendrich, `mos6526.v`, `sid/*`) carry **no licence** | C64, VIC-20, C16/Plus/4 (FPGATED), C128 (+VDC, MMU), 1541/1581 | Facts only; oracle on hardware |
| 18 | **1541 Ultimate / Ultimate 64** firmware | **GPL-3.0** (API, `GideonZ/1541ultimate`); the U64 FPGA design is not in that repository (*inference*) | Cartridge/drive emulation; U64 board | Facts only; real-hardware oracle |
| 19 | **Pi1541** | **GPL-3.0** (API) | Cycle-exact 1541 (6502 + 2×6522) on Raspberry Pi | Facts only |
| 20 | **libsidplayfp / reSIDfp / reSID** | **GPL-2.0(+)** (API; `resid/sid.cc` header "version 2 ... or later") | SID 6581/8580 | Facts only; oracle (sidplayfp) |
| 21 | **MEGA65 Open ROMs** | **LGPL-3.0-or-later** (`LICENSE`); some BASIC files **MIT © Microsoft** | Replacement C64 KERNAL/BASIC/chargen (also MEGA65, U64 builds) | **Bundle-able ROM** (LGPL obligations, §5.6) |
| 22 | perfect6502 | Code **MIT** (API); `netlist_6502.h` **CC BY-NC-SA 3.0** (header) | Transistor-level NMOS 6502 | Oracle only (local, never committed) |
| 23 | visual6502 (`trebonian/visual6502`) | JS code MIT (`chipsim.js`); netlist `segdefs.js` etc. **CC BY-NC-SA 3.0** (header) | NMOS 6502 netlist | Oracle only |

Other names checked: ZEsarUX has no Commodore machines (*inference*, not investigated); "Kernal64"
(Scala) appears only as a testbench target (§3.2); YACE (Plus/4) appears as a testbench target only;
C64 Studio ships a small MIT emulator, `Tiny64Emu` (§6.4).

---

## §2 Emulators in detail

### §2.1 VICE (the reference)

- **Source:** https://sourceforge.net/projects/vice-emu/ (SVN); read-only mirror
  https://github.com/VICE-Team/svn-mirror (pushed 2026-11-22). `vice/COPYING` is GPL v2; `vice/README`
  gives the "version 2 ... or (at your option) any later version" grant.
- **Machines:** x64sc (cycle-based C64; the accurate one), x64 (older, faster, instruction-granular;
  *inference* from the testbench gap in §3.2), x64dtv, xscpu64, x128 (C128 with VDC and the C64 mode
  `x128c64`), xvic, xplus4 (C16/C116/Plus/4/V364), xpet, xcbm2/xcbm5x0, vsid. Drives: 1540/1541/
  1541-II/1570/1571/1581/2000/4000/1551 (TCBM), IEEE drives.
- **Accuracy:** the de-facto reference; the testbench (§3) is VICE's own regression tool, run on
  x64sc, x128 etc. per SVN revision.
- **Design facts recorded for Klive (facts only):**
  - **Alarms.** `src/alarm.h` (Ettore Perazzoli, Andreas Boose): each CPU has an `alarm_context_t`
    holding its alarms and `next_pending_alarm_clk`; the CPU loop compares its clock against that one
    value and dispatches due alarms. Chips schedule their next event (CIA underflow, VIC raster IRQ,
    drive byte-ready) instead of being ticked.
  - **Drive sync.** `src/drive/drivecpu.c` `drivecpu_execute(drv, clk_value)`: the drive CPU runs
    lazily, catching up to the main CPU's clock when the bus is touched; the ratio is a 16.16 fixed
    point `sync_factor` accumulated in `cycle_accum` (so PAL/NTSC/1 MHz drive clocks stay exact).
  - **IEC bus layering** (`doc/iec-bus.txt`): true drive emulation (6510core → c64cia2 → iecbus →
    via1541 → drive) alongside "virtual" devices (traps, vdrive, fsdevice) that bypass the drive CPU.
    Klive will need the same split: true 1541 vs. fast virtual load.
- **ROMs:** ships them in `data/C64`, `data/DRIVES`, `data/VIC20`, `data/PLUS4`, `data/C128`
  (e.g. `kernal-901227-03.bin`, `basic-901226-01.bin`, `chargen-901225-01.bin`) with only the notice
  "Copyright C by Commodore Business Machines" — **no permission is claimed** (`vice/README`; §5.3).
- **IDE-relevant:** text monitor with labels and the **binary monitor protocol** (§6.2).
- **Usable as:** oracle (VICE 3.9+ x64sc, xvic, xplus4, x128) and facts only.

### §2.2 Clock Signal (CLK, Thomas Harte)

- https://github.com/TomHarte/CLK, **MIT** (API, `LICENCE`), very active (pushed 2026-11-23; latest
  release 2026-07-23). Note: individual files carry the Xcode boilerplate "Copyright © 2025 Thomas
  Harte. All rights reserved." (e.g. `Components/SID/SID.hpp`) beside the MIT `LICENCE` (OQ5).
- **Commodore machines:** `Machines/Commodore/{1540, Plus4, Vic-20, SerialBus.*}`. The 1540 machine
  has `Personality::{C1540, C1541}` (`C1540.hpp`). **No C64**: `ROMImages/Commodore64/readme.txt`
  says "This is not currently a Commodore 64 emulator"; issue #1414 ("Adding a Commodore 64
  Emulator", 2024-11-10) has the author's reply that he wants to do it and already has "a 6502, CIA
  and C1541". **No C128.**
- **Components (MIT, port candidates):** `Components/6560` (VIC), `6522` (VIA), `6526` (CIA),
  `SID` (added 2025-11, voice-3-off bit, "references for the SID and biquad filter"; used today by
  the BBC Micro), `Processors/6502`, `6502Mk2`, `6502Esque`; the Plus/4 has `Video.hpp` (TED video),
  `Audio.hpp`, `Pager.hpp`, `Interrupts.hpp`, `TapeHandler.hpp`.
- **ROMs:** not included: "the copyright status of these is uncertain so they have not been
  included in this repository" (`ROMImages/Vic20/readme.txt`); the user supplies them.
- **Usable as:** **port** for VIC-20 (6560), Plus/4 TED, 1541 drive mechanics, 6522, 6526, SID
  (with MIT notice). Klive already ported CLK for the ZX80/81 (AGENTS.md) — the precedent exists.

### §2.3 MAME

- https://github.com/mamedev/mame (API `NOASSERTION`). The project as a whole is GPL-2.0+; files may
  carry other terms in their header (https://www.mamedev.org/legal.html). Each relevant file's first
  line, read 2026-11-23:

| File | Licence (header) | Holder |
|---|---|---|
| `src/mame/commodore/c64.cpp`, `vic20.cpp`, `plus4.cpp`, `c128.cpp` | BSD-3-Clause | Curt Coder |
| `src/devices/bus/cbmiec/c1541.cpp`, `c1571.cpp`, `c1581.cpp` | BSD-3-Clause | Curt Coder |
| `src/devices/machine/mos6526.cpp` (CIA), `mos8722.cpp` (C128 MMU), `mos6529.cpp`, `64h156.cpp` (1541 gate array/GCR), `pla.cpp` | BSD-3-Clause | Curt Coder (pla: + hap) |
| `src/devices/video/mos6566.cpp` (VIC-II), `mos8563.cpp` (VDC) | BSD-3-Clause | Curt Coder |
| `src/devices/sound/mos6560.cpp` (VIC), `mos7360.cpp` (TED), `mos6581.cpp/.h` (SID wrapper) | BSD-3-Clause | Curt Coder |
| `src/devices/machine/6522via.cpp` | BSD-3-Clause | Peter Trauner, Mathis Rosenhauer |
| `src/devices/video/mc6845.cpp` | BSD-3-Clause | Wilbert Pol, Nigel Barnes |
| `src/devices/cpu/m6502/m6502.cpp`, `m6510.cpp`, `m7501.cpp` (TED CPU), `m8502.cpp` (C128) | BSD-3-Clause | Olivier Galibert |
| `src/lib/formats/d64_dsk.cpp`, `g64_dsk.cpp`, `cbm_tap.cpp` | BSD-3-Clause | Curt Coder (+ Fabio Priuli) |
| `src/devices/bus/c64/exp.cpp`, `bus/pet/c2n.cpp`, `cass.cpp`, `bus/vcs_ctrl/ctrl.cpp` | BSD-3-Clause | Curt Coder |
| **`3rdparty/residfp/*`** (used by `mos6581.cpp`: "The actual sound generation is provided by the reSIDfp engine") | **GPL-2.0-or-later** (`SID.cpp` header: Leandro Nini, Antti Lankila, Dag Lem) | — |

- **Accuracy:** no published testbench results for MAME's C64 (§3.2). *Inference:* MAME's Commodore
  drivers are broad (every model, every bus card) rather than cycle-exact; useful for structure,
  memory maps, PLA equations and image formats, less for VIC-II timing.
- **ROMs:** MAME distributes no Commodore ROMs; users supply sets (*inference* from mamedev.org's
  legal page, which offers only a handful of explicitly licensed ROMs).
- **Usable as:** **port** the BSD-3 files (notice: "Copyright Curt Coder" etc.), especially the
  C128 MMU/PLA, VDC, TED, 1571/1581 and the D64/G64/TAP readers; **not** the SID (GPL residfp).

### §2.4 floooh/chips (Andre Weissflog)

- https://github.com/floooh/chips, **zlib** (API; header of every file), pushed 2026-11-08. Tests
  and examples in https://github.com/floooh/chips-test (MIT). Web builds:
  https://floooh.github.io/tiny8bit/.
- **Design:** every chip is a `tick(pins)` function over a `uint64_t` pin mask (README); systems wire
  chips "like on a breadboard", with some shortcuts in address decoding.
- **Files and stated completeness (headers read 2026-11-23):**
  - `chips/m6502.h` — cycle-stepped 6502/6510 (merged 2019-12-13). Blog
    (https://floooh.github.io/2019/12/13/cycle-stepped-6502.html): NEStest all passing; Wolfgang
    Lorenz suite "mostly" (one NMI subtest and four CIA TOD tests failing); compared per cycle with
    perfect6502 for documented opcodes; C64 overall "pretty good but still far from perfect", VIC-II
    "leaves a lot to be desired".
  - `chips/m6526.h` — **not implemented:** PC pin, time-of-day clock, serial port, CNT input.
  - `chips/m6569.h` — VIC-II PAL-B only (`M6569_HTOTAL 63`); no 6567 NTSC, no 8565.
  - `chips/m6581.h` — SID "based on tedplay (c) 2012 Attila Grosz, used under Unlicense".
  - `chips/m6522.h` — VIA. `chips/m6561.h` — VIC for PAL (2019), documentation "TODO".
  - `systems/c64.h` — PAL C64; its header lists Lorenz 2.15 all "ok" and a long VICE-testprogs
    status (CIA tests mostly green; `cia15` TOD and serial-port tests red; VIC-II: `border` fail,
    `colorsplit` fail, several `dmadelay` fail, `irqdma` "all fail?").
  - `systems/c1541.h` — 6502 + VIAs + ROM only: `c1541_insert_disc()` is `// FIXME` (no disk, no
    GCR); `c64.h` TODO "floppy disc support".
  - `systems/c1530.h` (datasette), `systems/vic20.h` (VIC-20, ROM cartridges).
- **Usable as:** **port** (zlib: keep the notice, mark altered versions). Best value: m6502 (the
  cycle-stepped design), m6526 as a starting point, the c1530 tape timing. The VIC-II and 1541 need
  far more than chips provides.

### §2.5 Peddle (Dirk Hoffmann)

- https://github.com/dirkwhoffmann/Peddle, **MIT** (API), "A cycle-accurate CPU emulator of the MOS
  Technology 65xx series"; VirtualC64's CPU (`LICENSE` of VirtualC64, component 3). C++.
- **Usable as:** **port** (MIT). A second 6502 reference beside floooh's m6502 and MAME's m6502.

### §2.6 VirtualC64 (Dirk Hoffmann)

- https://github.com/dirkwhoffmann/virtualc64 (API `NOASSERTION`), v6.2 on 2026-10-31. `LICENSE`:
  app GPL-3.0-or-later; "core emulator (except reSID)" **MPL-2.0**; Peddle MIT; reSID GPL-2.0+. Core
  file headers: "This FILE is dual-licensed ... GPL-3.0-or-later OR MPL-2.0" (`VCCore/Components/C64.cpp`).
- **Structure:** `VCCore/Components/{C64, CIA, CPU, Memory, SID, VICII}`; VICII split into
  `VICIICycles.cpp`, `VICIIDraw.cpp`, `VICIISprites.cpp`, `VICIIMemory.cpp`, `VICIITable.cpp`, `XRay*`;
  `Peripherals/Drive` (Drive, VIA, PIA, FloppyDisk, Codecs, DiskAnalyzer, ParallelCable);
  `RemoteServers/` (**DAP server**, **MCP server**, RPC, Prometheus, RetroShell); a headless build.
- **ROMs:** can run on **MEGA65 Open ROMs** out of the box (`VCCore/Media/OpenRoms.h`,
  `installOpenRoms()` in `Manual/guides/headless.md`).
- **MPL-2.0 for Klive (*inference*, OQ11):** MPL is file-level copyleft: a C translation of an MPL
  file would remain MPL-2.0 and its source must stay available; it can sit in an MIT project as
  separate files. Klive's precedent so far is only MIT/BSD/zlib ports, so this needs a decision.
- **Usable as:** Peddle port; core MPL (decision); oracle (macOS app or headless build). Testbench
  hooks exist (`testbench/virtualc64-hooks.sh`) but no results file is published (§3.2).

### §2.7 Denise, Hoxs64, Frodo, Emu64, micro64, Z64K, CCS64, YAPE

- **Denise** — https://sourceforge.net/projects/deniseemu/ (code on Bitbucket), GPL-3.0, "cycle
  accurate C64 / Amiga 1000/500/600 emulator"; testbench results published by VICE (§3.2,
  denise-20251204: 1228 ok of 1339). Facts only / oracle.
- **Hoxs64** — https://www.hoxs64.net, source https://github.com/davidhorrocks/hoxs64 **GPL-3.0**
  (API, pushed 2026-08-07); features page: cycle-based CPU, CIA, VIC, SID and 1541. Some sites still
  call it closed-source freeware (keep both; the API is authoritative for the current repo).
- **Frodo 4** — https://github.com/cebix/frodo4, GPL-2.0; "Frodo" (cycle-exact) and "Frodo Lite";
  Christian Bauer is also the author of the VIC-II article in `dev/research/vic-ii.txt`.
- **Emu64** — https://github.com/ThKattanek/emu64, GPL-2.0, claims cycle-exact 6510, VIC-II
  6569/8565, CIA 6526/6526A, SID (own or reSID), 1541.
- **micro64** — BeRo/farbrausch; "two different VIC II emulation modes (both are half-cycle exact)"
  (https://blog.rosseaux.net/page/986c1ab5667d2dfa6ef552e6dd42fe27/micro64); last build
  1.00.2018.03.16. No source. Oracle at most.
- **Z64K** — https://www.z64k.com, Java, proprietary; C128/C64/VIC-20 testbench results (§3.2).
- **CCS64** — https://www.ccs64.com, closed. Not used.
- **YAPE / yapeSDL** — https://github.com/calmopyrin/yapesdl, GPL-2.0; Plus/4 (TED), C64, VIC-20,
  1541 (`FdcGcr.cpp`, `Via.cpp`), embeds ROM headers (`roms.h`, `c64rom.h`, `vic20rom.h`,
  `1541rom.h`). The most mature TED emulator after VICE (*inference*). Facts only; oracle.

### §2.8 FPGA and hardware projects

- **MiSTer** (https://github.com/MiSTer-devel): `C64_MiSTer` (`c64.sv` GPL-2.0+, © Sorgelig, "FPGA64
  is Copyrighted 2005-2008 by Peter Wendrich"; `rtl/video_vicII_656x.vhd` and `cpu_6510.vhd` have
  no licence text; `rtl/mos6526.v` "Passes all Lorenz CIA Timer tests / Passes all CIA tests from
  VICE, except dd0dtest"; `rtl/iec_drive/` 1541 GCR + 1581 with `fdc1772.v`; `rtl/roms/std_C64.mif`
  etc. **contain ROMs**; README tells users to take ROMs "from the VICE distribution").
  `VIC20_MiSTer` (GPL-2.0+ top level), `C16_MiSTer` (GPL-2.0+, `gpl-3.0.txt` present; TED from
  **FPGATED**, "a cycle exact FPGA core for the MOS 7360/8360 TED"), `C128_MiSTer` (© 2022 Erik
  Scheffers, GPL-2.0+; `mmu8722.vhd`, `vdc856x/`, `video_vicIIe_jb.sv`, Z80). Facts only; the cores
  are a hardware-level second opinion. Unlicensed RTL files: not read for design.
- **1541 Ultimate II / Ultimate 64** — https://github.com/GideonZ/1541ultimate GPL-3.0. Ultimate 64
  users must flash their own KERNAL/BASIC
  (https://1541u-documentation.readthedocs.io/en/latest/u64/getting_started.html). U64 testbench
  results are published (§3.2).
- **Pi1541** — https://github.com/pi1541/Pi1541 GPL-3.0; "cycle exact" 1541 (6502 + two 6522) on a
  bare-metal Raspberry Pi (c64-wiki). Facts only.

### §2.9 SID libraries

- **reSID** (Dag Lem) GPL-2.0+; **reSIDfp** / **libsidplayfp** (Leandro Nini, Antti Lankila)
  GPL-2.0+ (API, headers). Every serious emulator uses one of them (VICE, VirtualC64, MAME, Emu64).
  No permissive SID of comparable fidelity was found; the permissive options are CLK's `SID` (MIT,
  2025), floooh's `m6581.h` (zlib, tedplay-based, simplified) and MAME's wrapper (BSD, but the engine
  is GPL). *Inference:* Klive's SID will be its own code written from facts (the SID researcher's
  pack), with sidplayfp as the oracle.

---

## §3 Accuracy benchmarks

### §3.1 The VICE testbench

- Lives in VICE's `testprogs` SVN tree (https://sourceforge.net/p/vice-emu/code/HEAD/tree/testprogs/);
  mirror https://github.com/libsidplayfp/VICE-testprogs (API licence `null`, pushed 2026-11-01).
- **Mechanism** (`testbench/readme.txt`): a test writes its result to a "debug cartridge" register —
  **C64/C128/DTV/SCPU/VSID `$D7FF`, VIC-20 `$910F`, Plus/4 `$FDCF`, PET `$8BFF`, CBM-II `$FDAFF`** —
  `$00` = pass, `$FF` = fail; the emulator exits with that code. Tests that cannot self-check compare
  a screenshot with `references/<test>.prg.png` (C64 "pepto" palette, VIC-20 "mike" palette, CRT
  emulation off). Each target has `<target>-hooks.sh` and `<target>-testlist.txt`.
- **Targets with hooks:** x64, x64sc, x64dtv, x128, x128c64, xvic, xplus4, xpet, xcbm2, xcbm5x0,
  xscpu64, vsid, chameleon, cham20, c64rmk2, denise, emu64, frodo, hoxs64, kernal64 (c64/c128/vic20/
  cbm2/scpu64), micro64, u64, virtualc64, yace, z64k (c64/c128/vic20).
- **For Klive (*inference*):** implementing the debug-cartridge register (exit on write) is the cheap
  way to run the whole suite headless in the WASM cores, exactly as the ZX/Next harnesses do.

### §3.2 Published results (from `testbench/results/*-result.txt`, last results commit 2026-01-13)

Counted from column 3 of the CSV, selftests excluded. **Each target runs its own test list**, so the
percentages are not comparable across emulators (the readme warns the same).

| Target | Result file | Tests | ok | error | timeout | noref |
|---|---|---|---|---|---|---|
| VICE x64sc | r45942 | 1345 | **1197** | 95 | 19 | 34 |
| VICE x64 | r45942 | 1345 | 1054 | 236 | 21 | 34 |
| VICE x128 | r45942 | 2146 | 2107 | 38 | 1 | — |
| VICE x128 (C64 mode) | r45942 | 1299 | 1043 | 228 | 21 | 7 |
| VICE xvic | r45942 | 66 | 66 | — | — | — |
| VICE xplus4 | r45942 | **4** | 4 | — | — | — |
| Denise | 2025-12-04 | 1339 | **1228** | 57 | 18 | 36 |
| Hoxs64 | 1.1.2.7 | 987 | 904 | 55 | 21 | 7 |
| Z64K (C64) | 2025-04-14 | 1244 | 1120 | 95 | 20 | 9 |
| Z64K (VIC-20) | 2025-04-14 | 64 | 60 | 2 | 2 | — |
| Z64K (C128) | 2025-04-14 | 2143 | 1998 | 9 | 136 | — |
| micro64 | 2018-03-16 | 1205 | 850 | 302 | 44 | 9 |
| Ultimate 64 | fw 1.45 | 1009 | 743 | 235 | 22 | 9 |
| Chameleon (FPGA) | 9r standalone | 1219 | 871 | 315 | 26 | 7 |
| Frodo | 2025-12-05 | 1090 | 685 | 365 | 31 | 9 |
| Emu64 | 2025-12-05 | 1153 | 466 | 599 | 79 | 9 |

Observations: Denise passes more C64 tests than x64sc on a comparable list; the **Plus/4 and VIC-20
lists are tiny** (4 and 66 tests), so TED and VIC timing are far less covered by the testbench than
the VIC-II (*inference* that Klive will need its own TED/VIC test programs; see OQ9). No results file
exists for VirtualC64, MAME, CLK or floooh/chips (floooh lists per-test status in `c64.h` instead).
The Chameleon wiki (https://wiki.icomp.de/wiki/Chameleon_Test_Results) publishes its own runs.

### §3.3 Lorenz suite and other claims

- Wolfgang Lorenz's C64 Emulator Test Suite 2.15 (~80 min, "a few hundred C64 programs"; CIA tests
  have "old"/"new" CIA variants) — passes claimed by floooh (`c64.h`: all ok), MiSTer's CIA (timer
  tests), and implied for VICE/Denise/Hoxs64 by the testbench (it includes the suite as
  `general/Lorenz-2.15`, with Plus/4 and DTV disk variants).
- No independent cross-emulator accuracy article was found beyond the testbench tables; the
  comparison sites found (tech-insider.org etc.) are SEO pages and are not relied on.

---

## §4 Test suites and their licences

| Suite | Where | Licence (read) | Size | Commit into Klive (MIT)? |
|---|---|---|---|---|
| **Lorenz C64 Emulator Test Suite 2.15** | testprogs `general/Lorenz-2.15/` (also chips-test `tests/testsuite-2.15`) | **"Public Domain, no Copyright"** (`readme.txt`; every `.s` header "public domain, no copyright") | 4 D64 + D81 | **Yes** (public domain) |
| **SingleStepTests/65x02** (Tom Harte et al.) | https://github.com/SingleStepTests/65x02 | **MIT** (API; "Copyright (c) 2024 Thomas Harte et al") | `6502/v1`: 256 JSON files, **~1.08 GB**, 10,000 cases each, with per-cycle bus activity; also `nes6502`, `wdc65c02`, `rockwell65c02`, `synertek65c02` | Licence allows; **fetch at test time** (size). Covers the NMOS 6502 incl. undocumented opcodes per its methodology, not the 6510 port or 7501/8502 |
| TomHarte/ProcessorTests (old home) | archived 2024-05-15 | `null` (no licence) | — | No; use 65x02 |
| **Klaus Dormann 6502 functional / decimal tests** | https://github.com/Klaus2m5/6502_65C02_functional_tests (also testprogs `CPU/kdormann`) | **GPL-3.0** (API; `license.txt`) | Small | *Inference:* **fetch at test time** (keeping GPL files out of the MIT tree, as Klive does for other GPL material) |
| **Bruce Clark decimal-mode test** | 6502.org tutorial "Decimal Mode", Appendix B; testprogs `CPU/bclark` | No licence stated (*inference*) | Small | Fetch or write Klive's own from the tutorial's description |
| **VICE testprogs** | SVN / libsidplayfp mirror | **No top-level licence**; mixed per test: Lorenz PD, kdormann GPL-3, `vsid/sidplayer/*` and others mention GPL, most tests carry no notice | Large (PRG/D64/CRT + PNG references) | **Fetch at test time**; record only results |
| **Krill's loader** (as a 1541 stress test) | Source released by Krill (plus4world, Linus Åkesson's GCR article) | **Licence not found** | — | **Manual use only** (local run, record results) |
| **visual6502 / perfect6502** | trebonian/visual6502; mist64/perfect6502 | Code MIT; **netlist CC BY-NC-SA 3.0** | — | **No** (NC licence); local oracle only |
| floooh chips-test test copies | `tests/testsuite-2.15`, `tests/vice-tests` | Repo MIT, contents keep their origin's terms | — | Take from the origins, not from here |
| NEStest | nesdev | No licence (*inference*) | Small | Not needed (no NES) |

Other drive/loader material in testprogs: `drive/1541-testsuite`, `c1541`, `tape`, `interrupts`,
`VICII/*` (dentest, dmadelay, spritesteal...), `TED/`, `VIC20/`, `VDC/`, `c128/`.

---

## §5 ROM rights

### §5.1 What the ROMs are

C64: BASIC V2 (901226-01), KERNAL (901227-01/-02/-03; 251104-04 SX-64; 906145-02 etc.), character
ROM (901225-01); VIC-20: BASIC, KERNAL (PAL/NTSC), character ROM (901460-03); C16/Plus/4: BASIC 3.5,
KERNAL (318004/318005), **3-plus-1 function ROMs** (Plus/4 only, 317053/317054); C128: BASIC 7.0,
KERNAL, editor, Z80 BIOS (CP/M boot), character ROMs (national variants); drives: 1541 DOS
(325302-01 + 901229-xx; 1541-II 251968), 1571 (310654), 1581 (318045). File names as in VICE's
`data/` and floooh's `chips-test/examples/roms/`. Commodore BASIC descends from Microsoft's 6502
BASIC licensed in 1977 (§5.5).

### §5.2 Chain of ownership (as reported; no primary contract text was found)

1. **1994**: Commodore International liquidated. **1995**: ESCOM bought the assets; ESCOM went
   bankrupt in 1996 (amiga-news.de 2026-08-04 notes "Escom's 1996 liquidation").
2. **1997**: ESCOM's Commodore-Amiga assets (patents, copyrights, trademarks) went to **Gateway 2000**,
   except the **Commodore / C= trademarks**, which went to **Tulip Computers** (reported in the search
   results summarising Wikipedia's "Commodore International"; classiccmp posts of the time doubt
   whether the 8-bit assets were ever acknowledged by the buyers — both views kept).
3. **1999/2000**: Gateway sold the Amiga assets (keeping a licence to the patents) to **Amiga, Inc.**
4. **2011–2012**: Amiga, Inc. assigned the Commodore-Amiga copyrights to **Cloanto**; Cloanto's Mike
   Battilana confirmed Cloanto "owns the copyrights for all works created by the Commodore/Amiga
   companies up to 1993" (OSnews story 28330, February 2015,
   https://www.osnews.com/story/28330/). **2019**: C-A Acquisition Corp, set up by Cloanto's owner,
   bought the Amiga name and trademarks (Wikipedia "Amiga Forever").
5. **Cloanto KB 13-122** (updated 2026-06-06, https://www.c64forever.com/kb/13-122): "the older CBM
   8-bit system ROMs (PET/CBM, C64, etc.), are copyrighted works owned and published by Amiga" and
   "may only be used or distributed under license". (It names PET/CBM and C64; VIC-20, C16/Plus/4,
   C128 and drives are covered by "etc." only — OQ1.)
6. **Brand side** (separate path): Tulip → later Commodore brand holders → **Commodore Corporation
   B.V.**, bought mid-2025 by a consortium led by Christian Simpson (Retro Recipes), 47 trademarks
   (Tom's Hardware; Time Extension 2025-08). The intermediate brand owners (Yeahronimo, Commodore
   Gaming, Asiarim) are from memory, *not verified*. A third party (Commodore Industries) disputes the
   trademark position (The Oasis BBS). **The brand purchase did not include ROM copyrights**
   (datagubbe.se "On Buying the Commodore Brand", 2025: it "will _not_ give licensing rights to things
   like the Commodore 64 KERNAL ROM").
7. **2026-08-04**: Amiga Corporation and **Commodore International Corporation** "recognized their
   respective rights": Amiga holds copyrights including "source code and binaries for CBM 8-bit and
   Amiga software and firmware"; "Amiga licenses CBM 8-bit software and documentation to Commodore
   for use in its products"; listed licensees include Cloanto, Commodore, Retro Games, SpecNext,
   Antstream, Blaze, Hyperion (https://www.amiga-news.de/en/news/AN-2026-08-00022-EN.html). Nothing
   about emulators or open-source projects.
8. **Disputed:** forum posters argue Cloanto never registered the C64 ROM copyrights (Lemon64
   thread 73857). *Inference:* registration is not a condition of copyright existing; it affects
   remedies in the US. Not a basis for Klive to bundle.

**Net (inference):** the owner of record today, by its own and its licensees' statements, is
**Amiga Corporation (Cloanto)**; permission to bundle would have to come from it.

### §5.3 What others do

| Project | Ships Commodore ROMs? | Stated basis |
|---|---|---|
| VICE | **Yes**, all machines and drives (`data/*`) | Only "Copyright C by Commodore Business Machines" (`vice/README`); no permission claimed. Debian strips them (`3.9+dfsg`, contrib) and plans to move VICE to non-free with Forky (Debian NEWS 2025-03-15) |
| MAME | No | Users supply ROMs (*inference*, §2.3) |
| Clock Signal | No | "copyright status ... uncertain" (`ROMImages/*/readme.txt`) |
| floooh chips-test / tiny8bit | **Yes**: `examples/roms/c64-roms.h`, `vic20-roms.h`, `cp4-roms.h` (+ 3-plus-1), `c1541-roms.h` and the `.bin` files, in an MIT repo | None stated (*inference*: the web builds embed them) |
| VirtualC64 | Ships **MEGA65 Open ROMs**; originals user-supplied | Open ROMs licence |
| YAPE | Yes (`roms.h`, `c64rom.h`, `vic20rom.h`, `1541rom.h`) | None stated |
| MiSTer C64 | Yes (`rtl/roms/*.mif`, `iec_drive/c1541_rom.mif`, `c1581_rom.mif`) | None stated; README points to VICE |
| Ultimate 64 | No; user flashes KERNAL/BASIC | — |
| C64 Forever (Cloanto) | Yes | Its own EULA, as owner/licensee |
| Commander X16 | KERNAL/BASIC parts | "license to use this code in the context of the X16"; outside it "contact Cloanto (KERNAL and BASIC)" (pkgsrc `commander-x16-rom-license`) |
| MEGA65 | C65 ROM bundled under a Cloanto agreement (amiga-news 2020-02); C64 ROM deal reported only on a forum (unverified) | Licence |
| Debian/Ubuntu | No (dfsg) | — |

A 2005 Fedora-list post noted no known legal action against emulators shipping the ROMs but called
it "a grey area"; a reply called it "plain wrong" (fedora-extras-list 2005-02). An October 2026
project (tomconte/CameraC64 PR #5) ships only the character ROM, citing 37 CFR 202.1(e) (no US
protection for typefaces), and is asking Cloanto for written permission — evidence of current
practice, not law.

### §5.4 floooh's embedded ROMs: a caution

Klive must not take ROM bytes from `floooh/chips-test` (or YAPE, MiSTer, VICE) on the grounds that
the surrounding repository is MIT/GPL: the ROM content's rights are separate (*inference*, consistent
with every source above).

### §5.5 Microsoft 6502 BASIC (MIT, 2025)

Microsoft published "BASIC M6502 8K VER 1.1" source under the **MIT licence** on 2025-09-03
(Microsoft Open Source blog 2025-09-03; https://www.theregister.com/2025/09/04/microsoft_open_sources_6502_basic/; https://hackaday.com/2025/09/04/microsoft-basic-for-6502-is-now-open-source). It is the
lineage of Commodore BASIC (PET, VIC-20, C64). *Inference:* this frees Microsoft's part, not
Commodore's modifications, the KERNAL, the screen editor, BASIC 3.5/7.0 or the shipped ROM
binaries; it is a legitimate base for an open BASIC ROM. Open ROMs already uses MIT-licensed
Microsoft files for some BASIC parts (`LICENSE`).

### §5.6 MEGA65 Open ROMs

- https://github.com/MEGA65/open-roms, **LGPL-3.0-or-later** (© Paul Gardner-Stephen 2019, Roman
  Standzikowski 2019–2021), some BASIC files MIT © Microsoft. Last commit 2026-05-16 ("Add build for
  the original C64"); prebuilt `bin/kernal_generic.rom`, `basic_generic.rom`, `chargen_openroms.rom`,
  `chargen_pxlfont_2.3.rom`, `kernal_ultimate64.rom`, `mega65.rom`.
- **Method:** written from documented routines and secondary sources, with a similarity checker
  against the originals (README).
- **Status (`STATUS.md`):** keyboard C64/C128 done; VIC-II screen done, **VDC 80-column not done**;
  tape normal and turbo done; IEC standard and DolphinDOS done, JiffyDOS partial; RS-232 not done;
  CBM cartridges not done. **Missing:** "most BASIC commands", "BASIC integer/float variables/arrays",
  "BASIC expression handling" (May 2026 commits "Update STATUS for exp and FIN" suggest float work in
  progress — OQ4); full tape VERIFY/SAVE/SEQ not planned.
- **Coverage:** C64 (and MEGA65/C65) only. **No VIC-20, C16/Plus/4 or C128-native ROMs, and no
  1541/1571/1581 DOS replacement.**
- *Inference:* a cycle-accurate 1541 needs the real DOS ROM (the drive's 6502 runs it); Open ROMs
  can only be paired with Klive's virtual (trap) drive. LGPL-3 for a ROM binary bundled in an MIT app:
  ship it unmodified as a separate file with the licence text and a source pointer.
- Other replacements: **SkippyDOS** (JiffyDOS-style VIC-20 KERNAL clone, licence not stated);
  JiffyDOS (commercial); `mist64/cbmsrc` (original Commodore sources, **no licence**, not usable);
  `mist64/kernalemu` (no licence). No free VIC-20, Plus/4, C128 or drive DOS ROM was found.

### §5.7 The options, with their evidence

| Option | Evidence for | Evidence against / cost |
|---|---|---|
| **A. Bundle the originals under a licence** | The owner of record licenses CBM 8-bit software to products (C64 Forever, X16, Commodore, Retro Games...) | Needs a written grant from Amiga Corporation covering all machines and drives and redistribution in an MIT app; none exists today |
| **B. Bundle the originals without permission** (VICE, YAPE, floooh, MiSTer practice) | Long-standing practice; no known action against emulators | Owner says "only ... under license"; Debian refuses; unlike the SAM Coupé (D3) there is **no** grant to quote |
| **C. User-supplied ROMs** (CLK, MAME, U64, Debian) | Clean | First-run friction; the IDE's Run/Debug flow needs ROMs present; tests need them (could be fetched locally, as the Next SD cards are) |
| **D. Open ROMs by default + user ROMs** (VirtualC64) | LGPL-3, ships today | C64 only; BASIC incomplete; no 1541 DOS, so no true-drive emulation without user ROMs |

---

## §6 Developer tools landscape

### §6.1 Assemblers and compilers

| Tool | Licence | Notes relevant to an IDE |
|---|---|---|
| **ACME** (Marco Baye) | GPL-2.0(+) (SourceForge "GPLv2"; docs "or later"; `meonwax/acme` API GPL-2.0) | `!byte`, `!to "x.prg",cbm`, `*=` syntax; VICE loads ACME symbol lists ("labelname = $1234 ; comment") directly (`vice.texi`, Label commands). The testbench needs it to rebuild selftests |
| **Kick Assembler** (Mads Nielsen) | Licence text not found; distributed as `KickAss.jar` (Java 8+), no public source (*inference*: closed freeware) | v5.25, 2022-11-18 (c64-wiki). Scripting language, segments; writes VICE symbols and a `.dbg` XML (`<C64debugger>` with sources and segment ranges) read by C64 Debugger/Retro Debugger and IceBro (github c64studio issue #70; Sakrac/IceBro wiki) |
| **64tass** | GPL-2.0 (SourceForge; Debian/MacPorts "GPL-2+") | Turbo Assembler syntax; `-l` with `--vice-labels`, `--vice-labels-numeric`, `--mesen-labels`, `--simple-labels`; `-L` listing (Debian man page) |
| **cc65 / ca65 / ld65** | **zlib** (API) | `ld65 -Ln file` writes a VICE label file; `--dbgfile` writes the structured cc65 debug info (files, lines, spans, scopes, symbols) (https://cc65.github.io/doc/debugging.html, cc65 wiki "Debug info overview"); `-g` keeps debug info in objects |
| **DASM** | GPL-2.0 (API) | Common for VIC-20/2600; symbol dump (*inference*) |
| Mad-Assembler | MIT (API, `tebe6502/Mad-Assembler`) | Atari-centred; not a priority |
| llvm-mos | Apache-2.0 with LLVM exception (*inference*, not checked) | C/C++ for C64, VIC-20, Plus/4, C128 targets; VS64 installs it |
| KickC, Oscar64, prog8 | not checked (prog8 API `NOASSERTION`) | Note only |

*Inference:* compatibility targets for Klive's IDE would be ca65 (permissive, debug info), ACME,
64tass and KickAssembler syntaxes; VICE label files and cc65 `.dbg` are the two de-facto debug
formats, KickAssembler `.dbg` a third. Klive's own Z80 assembler and DeZog-compatible conventions are
the analogue (`dev/plans/CLOSING_THE_GAPS_PLAN.md`).

### §6.2 VICE remote interfaces (facts from `vice/doc/vice.texi`)

- **Text monitor:** labels must start with "."; `add_label`/`al <address> <label>`,
  `delete_label`/`dl`, `load_labels`/`ll [<address_space>] "<file>"` (a file of monitor commands such
  as `al`; "The compiler cc65 can create such label files"; ACME label files accepted),
  `save_labels`/`sl`, `show_labels`/`shl`, `clear_labels`/`cl`; `-moncommands <file>` at start-up.
  Memory spaces: `C:` main, `8:`–`11:` drives.
- **Binary monitor** (`-binarymonitor`, `-binarymonitoraddress`, default `ip4://127.0.0.1:6502`):
  request = STX `0x02`, API version `0x02`, 4-byte body length, 4-byte request id, command byte,
  body; little-endian; response = STX, version, length, response type, error code, request id, body.
  Commands: memory get `0x01` / set `0x02`; checkpoint get `0x11`, set `0x12`, delete `0x13`, list
  `0x14`, toggle `0x15`; condition set `0x22`; registers get `0x31` / set `0x32`; dump `0x41` /
  undump `0x42`; resource get `0x51` / set `0x52`; advance instructions `0x71`; keyboard feed `0x72`;
  execute until return `0x73`; keymatrix set `0x74`; ping `0x81`; banks available `0x82`; registers
  available `0x83`; display get `0x84`; VICE info `0x85`; CPU history `0x86`; palette get `0x91`;
  joyport `0xa2`; joystick `0xa3`; userport `0xb2`; exit `0xaa`; quit `0xbb`; reset `0xcc`;
  autostart `0xdd`. Memspaces in commands: `0x00` main, `0x01`–`0x04` drives 8–11. VS64 recommends
  VICE 3.7+ where it is stable.
- *Inference:* a Klive "VICE binary monitor" server on its own cores would let VS64 and other tools
  debug Klive's machines, as Klive's DeZog compatibility does for the Spectrum. Not a decision.

### §6.3 Debuggers and IDEs

| Tool | Licence | Notes |
|---|---|---|
| **VS64** (Roland Schabenberger) | **Apache-2.0** (`LICENSE`) | VS Code extension: ACME, KickAssembler, cc65, llvm-mos, BASIC; debugs in VICE over the binary monitor and in a built-in 6502 emulator |
| **C64 Studio** (Georg Rottensteiner) | **MIT** (`license.md`) | .NET IDE: own assembler (`C64Ass`, ACME-like dialects), BASIC variants, media tools, `Tiny64Emu` (MIT); VICE remote debugging |
| **Retro Debugger** / C64 65XE NES Debugger (Marcin Skoczylas) | No licence file; README: "some kind of FSF license", embeds VICE | Treat as GPL: facts only. Reads KickAssembler `.dbg` |
| VirtualC64 remote servers | MPL-2.0 core | DAP and MCP servers built into the emulator (`VCCore/RemoteServers`) — a precedent for an emulator speaking DAP directly |
| vscode-cc65-debugger (empathicqubit), IceBro (Sakrac) | not checked | cc65 `.dbg` + VICE; KickAssembler `.dbg` |
| mist64/c64ref | **BSD-2-Clause** (API) | Reference tables (KERNAL API, memory map, ROM disassemblies). The commented ROM disassemblies in it fall under Klive's ROM-annotation rule D4 (`dev/ai/rom-annotations/README.md`) |

---

## §7 Design ideas worth recording (facts; the plan decides)

1. **Cycle-stepped chips over pin masks** (floooh): one `tick` per Φ2, chips exchange a 64-bit pin
   word; trivially deterministic and lets the 1541 be "just another CPU". Cost: every chip ticks every
   cycle.
2. **Alarm scheduling** (VICE): chips register their next event clock; the CPU loop checks one
   `next_pending_alarm_clk`. *Inference:* this is close to Klive's "core decides whether to stop"
   loop (`src/emu/z80/wasm/README.md`).
3. **Lazy drive catch-up** (VICE): the 1541 CPU runs only when the bus is touched or at alarms, with a
   16.16 clock ratio; VirtualC64 and floooh instead tick the drive in lock-step (*inference* for
   VirtualC64 from its structure).
4. **VIC-II per-cycle tables** (VirtualC64 `VICIICycles.cpp`/`VICIITable.cpp`; Frodo's
   cycle-exact mode; Christian Bauer's article already in `dev/research/vic-ii.txt`).
5. **Debug cartridge register** for self-checking tests (§3.1).
6. **Two drive modes** (true drive vs. traps/virtual device) — every emulator has both.
7. **Open ROMs as a no-ROM fallback** (VirtualC64).

---

## §8 Port-source summary per component (inference from §1–§2)

| Component | Permissive sources | Facts / oracle |
|---|---|---|
| 6502/6510/7501/8502 CPU | floooh `m6502.h` (zlib), Peddle (MIT), MAME `m6502/*` (BSD-3), CLK `Processors/6502*` (MIT) | VICE, perfect6502 (local oracle), SingleStepTests |
| CIA 6526/8521 | MAME `mos6526.cpp` (BSD-3), CLK `Components/6526` (MIT), floooh `m6526.h` (zlib, no TOD/SDR) | VICE (`doc/CIA-README.txt`), MiSTer `mos6526.v` notes |
| VIC-II 6567/6569/8562/8565 | MAME `mos6566.cpp` (BSD-3), floooh `m6569.h` (zlib, PAL only, incomplete) | VICE x64sc, Denise, VirtualC64 (MPL), Bauer's article |
| SID 6581/8580 | CLK `Components/SID` (MIT), floooh `m6581.h` (zlib) | reSID/reSIDfp (GPL) as oracle via sidplayfp |
| VIC 6560/6561 (VIC-20) | CLK `Components/6560` (MIT), MAME `mos6560.cpp` (BSD-3), floooh `m6561.h` (zlib) | VICE xvic, YAPE |
| TED 7360/8360 | CLK `Plus4/*` (MIT), MAME `mos7360.cpp` (BSD-3); tedplay (licence unclear, OQ6) | VICE xplus4, YAPE, FPGATED (MiSTer) |
| C128 MMU 8722, VDC 8563/8568, PLA | MAME `mos8722.cpp`, `mos8563.cpp`, `pla.cpp`, `c128.cpp` (BSD-3) | VICE x128, Z64K, MiSTer C128 |
| VIA 6522 | CLK `Components/6522` (MIT), MAME `6522via.cpp` (BSD-3), floooh `m6522.h` (zlib) | VICE |
| 1541 drive (mechanics, GCR, 325572 gate array) | CLK `Commodore/1540` (MIT), MAME `c1541.cpp` + `64h156.cpp` + `g64_dsk.cpp` (BSD-3) | VICE, Pi1541, MiSTer `iec_drive` |
| 1571/1581 | MAME `c1571.cpp`, `c1581.cpp` (BSD-3); Klive's shared WD1793 (1772 variant) for the 1581 | VICE |
| Datasette | floooh `c1530.h` (zlib), MAME `c2n.cpp`, `cbm_tap.cpp` (BSD-3) | VICE |
| D64/G64/TAP/T64/CRT formats | MAME `src/lib/formats/*` (BSD-3) | VICE `cartconv`, c1541 tool |

---

## Open questions

- **OQ1 — ROM permission.** Would Amiga Corporation (Cloanto) grant Klive, a free MIT IDE, a
  written permission to redistribute the C64, VIC-20, C16/Plus/4, C128, 1541/1571/1581 ROMs
  unmodified? KB 13-122 names only "PET/CBM, C64, etc.".
- **OQ2 — Plus/4 3-plus-1 function ROMs.** The productivity suite was written by an outside company
  (Tri Micro, from memory, *not verified*); is it in Amiga Corporation's chain or a separate one?
- **OQ3 — C128 Z80/CP/M parts.** Does the C128 ROM set include Digital Research material with a
  separate owner?
- **OQ4 — Open ROMs maturity.** Is BASIC (variables, floats, expressions) complete in the May 2026
  build? Without it Open ROMs cannot be the default for BASIC users.
- **OQ5 — CLK headers.** CLK files say "All rights reserved" (Xcode template) while `LICENCE` is MIT;
  confirm with the author, as for the earlier ZX80/81 port, that the MIT licence governs every file.
- **OQ6 — tedplay licence.** floooh says "used under Unlicense", but `calmopyrin/tedplay` has no
  licence file. Ask Attila Grósz before using it (or floooh's derivative) for TED sound.
- **OQ7 — VICE testprogs.** Which test binaries may be cached in CI (fetched, never committed)? Ask
  the VICE team; most tests carry no notice.
- **OQ8 — Kick Assembler licence.** Read the licence text shipped in the KickAssembler zip before
  relying on its `.dbg` format details (the format itself is a fact; documenting it is fine).
- **OQ9 — TED/VIC coverage.** The testbench has 4 Plus/4 and 66 VIC-20 tests; which other TED/VIC
  test programs exist (plus4world, sleepingelephant), and under what terms?
- **OQ10 — Bruce Clark test.** 6502.org tutorial terms for the Appendix B program.
- **OQ11 — MPL-2.0.** Is VirtualC64's MPL-2.0 core acceptable as a port source (files stay MPL) or
  facts only?
- **OQ12 — Existing research files.** `dev/research/c64-rom.txt` and `c64_rom_disassembly.txt` are
  "Fully Commented" KERNAL/BASIC disassemblies (comments from Commodore's source and Lee Davison's
  disassembly). Under rule D4 they must not feed ROM annotations; decide whether they stay in the
  repository at all.
- **OQ13 — Debug-cartridge register.** Should Klive's cores implement `$D7FF`/`$910F`/`$FDCF` exit
  semantics only in test builds (it is not real hardware)?

---

## Reference documents

- VICE: https://github.com/VICE-Team/svn-mirror (`vice/COPYING`, `vice/README`, `vice/doc/vice.texi`
  — Copyright, Label commands, Binary monitor; `vice/doc/iec-bus.txt`; `vice/src/alarm.h`;
  `vice/src/drive/drivecpu.c`; `vice/data/*`); https://sourceforge.net/projects/vice-emu/
- VICE testprogs: https://github.com/libsidplayfp/VICE-testprogs (`readme.txt`,
  `testbench/readme.txt`, `testbench/results/*`, `general/Lorenz-2.15/readme.txt`, `CPU/kdormann`,
  `CPU/bclark`); https://wiki.icomp.de/wiki/Chameleon_Test_Results
- Debian VICE: https://metadata.ftp-master.debian.org/changelogs/contrib/v/vice/unstable_NEWS;
  https://sources.debian.org/src/vice/3.9%2Bdfsg-1/debian/copyright
- CLK: https://github.com/TomHarte/CLK (`LICENCE`, `Machines/Commodore/*`, `Components/{6522,6526,
  6560,SID}`, `ROMImages/{Vic20,Plus4,Commodore1540,Commodore64}/readme.txt`, issue #1414)
- MAME: https://github.com/mamedev/mame (files in §2.3); https://www.mamedev.org/legal.html
- floooh: https://github.com/floooh/chips (`README.md`, `chips/*.h`, `systems/{c64,c1541,c1530,vic20}.h`),
  https://github.com/floooh/chips-test (`examples/roms/`, `tests/`),
  https://floooh.github.io/2019/12/13/cycle-stepped-6502.html
- VirtualC64: https://github.com/dirkwhoffmann/virtualc64 (`LICENSE`, `VCCore/*`,
  `Manual/guides/headless.md`); Peddle: https://github.com/dirkwhoffmann/Peddle
- Denise: https://sourceforge.net/projects/deniseemu/; Hoxs64: https://github.com/davidhorrocks/hoxs64,
  https://www.hoxs64.net; Frodo: https://github.com/cebix/frodo4; Emu64:
  https://github.com/ThKattanek/emu64; YAPE: https://github.com/calmopyrin/yapesdl; tedplay:
  https://github.com/calmopyrin/tedplay; micro64:
  https://blog.rosseaux.net/page/986c1ab5667d2dfa6ef552e6dd42fe27/micro64; Z64K: https://www.z64k.com;
  CCS64: https://www.ccs64.com
- MiSTer: https://github.com/MiSTer-devel/{C64_MiSTer,VIC20_MiSTer,C16_MiSTer,C128_MiSTer};
  Ultimate: https://github.com/GideonZ/1541ultimate,
  https://1541u-documentation.readthedocs.io/en/latest/u64/getting_started.html;
  Pi1541: https://github.com/pi1541/Pi1541, https://www.c64-wiki.com/wiki/Pi1541
- SID: https://github.com/libsidplayfp/libsidplayfp, https://github.com/libsidplayfp/resid
- Tests: https://github.com/SingleStepTests/65x02, https://github.com/Klaus2m5/6502_65C02_functional_tests,
  http://www.6502.org/tutorials/decimal_mode.html, https://github.com/mist64/perfect6502,
  https://github.com/trebonian/visual6502, https://plus4world.powweb.com/tools/Krills_Loader
- ROM rights: https://www.c64forever.com/kb/13-122; https://www.osnews.com/story/28330/;
  https://en.wikipedia.org/wiki/Amiga_Forever; https://www.amiga-news.de/en/news/AN-2026-08-00022-EN.html;
  https://www.timeextension.com/news/2026/08/the-circle-is-closing-duo-of-deals-establishes-a-clear-framework-for-commodore-and-amiga;
  https://www.tomshardware.com/video-games/retro-gaming/commodore-corporation-bv-acquisition-completed-by-fan-led-consortium-prepare-for-new-retro-futurist-products-with-the-deal-signed-sealed-and-paid-for-ahead-of-schedule;
  https://www.datagubbe.se/cbrand/; https://theoasisbbs.com/commodore-trademark-fight-heats-up/;
  https://ftp.netbsd.org/pub/NetBSD/NetBSD-current/pkgsrc/licenses/commander-x16-rom-license;
  https://amiga-news.de/en/news/AN-2020-02-00067-EN.html; https://www.lemon64.com/forum/viewtopic.php?t=73857;
  https://listman.redhat.com/archives/fedora-extras-list/2005-February/000832.html;
  https://github.com/tomconte/CameraC64/pull/5
- Microsoft BASIC: https://www.theregister.com/2025/09/04/microsoft_open_sources_6502_basic/,
  https://hackaday.com/2025/09/04/microsoft-basic-for-6502-is-now-open-source (both report the
  Microsoft Open Source blog post of 2025-09-03)
- Open ROMs: https://github.com/MEGA65/open-roms (`LICENSE`, `README.md`, `STATUS.md`, `bin/`);
  https://c65gs.blogspot.com/2019/05/free-and-open-source-replacement-roms.html
- Tools: https://sourceforge.net/projects/acme-crossass/, https://sourceforge.net/projects/tass64/,
  https://manpages.debian.org/testing/64tass/64tass.1, http://theweb.dk/KickAssembler/,
  https://www.c64-wiki.com/wiki/KickAssembler, https://github.com/cc65/cc65,
  https://cc65.github.io/doc/debugging.html, https://github.com/dasm-assembler/dasm,
  https://github.com/rolandshacks/vs64, https://github.com/GeorgRottensteiner/C64Studio,
  https://github.com/slajerek/RetroDebugger, https://github.com/Sakrac/IceBro/wiki,
  https://github.com/georgrottensteiner/c64studio/issues/70, https://github.com/mist64/c64ref
