# Existing Enterprise 64/128 Emulators: Survey for Klive

Surveyed 2026-10-21. Every licence below was checked against the GitHub API `license` field and/or
the file headers, fetched with WebFetch. Nothing was cloned or downloaded. Statements marked
*inference* are my reading and were not confirmed from a source.

## 1. Comparison

| Emulator | Language | Licence (verified) | Activity | Accuracy (summary) | Porting suitability for Klive |
|---|---|---|---|---|---|
| **Clock Signal (CLK)**, `Machines/Enterprise/` | C++20 | **MIT** (repo `LICENCE`) | Very active. Repo pushed 2026-10-21; Enterprise files last touched 2026-10-06 | Good. Nick runs per cycle in 16-cycle windows, CPU waits are modelled against Nick slots, Dave is complete. No tape, joystick or serial | **Best port source.** Permissive, and the same author and conventions as the ZX80/81 port already in Klive |
| **MAME** `ep64` driver (`src/mame/enterprise/`) | C++ | **BSD-3-Clause** (per-file headers) | MAME is active; the driver is old (Curt Coder) | Weak. Nick renders a scanline at a time, and Dave has no noise, polynomials or filters | Portable with BSD notice, but low value. Useful for the memory-map and expansion-bus documentation |
| **ep128emu** (Istvan Varga) | C++ | **GPL-2.0-or-later** | Last upstream release 2.0.11.2, 2019-04-19; last push 2022-04-30 | The reference emulator. Slot-accurate Nick, Dave tested on real hardware, wait states, EXDOS, IDE, SDEXT, tape, snapshots, debugger | **Read only.** The accuracy oracle for facts and behaviour |
| **ep128emu-core** (libretro; zoltanvb fork) | C++ | **GPL-2.0** | Active, pushed 2026-10-18 | Same as ep128emu, minus debugger, SDEXT, SID and the Spectrum card | Read only. Its built-in ROMs and enhanced ROM are worth noting |
| **Ep128web** (kks2003) | C++ to WASM (Emscripten) | GPL-2.0-or-later (README; GitHub shows no licence) | Active, pushed 2026-10-16 | The unmodified ep128emu core | Read only. It proves the ep128emu core runs as WASM in a browser |
| **Xemu** `targets/ep128` (LGB) | C | **GPL-2.0-or-later** | Repo active; EP128 target last touched 2025-05 | Low. Not cycle-exact, partial Dave, gaps in Nick modes | Read only. Its SDEXT, APU and EPNET code documents rare add-ons |
| **Xep128** (LGB) | C | GPL-2.0 | Archived 2016, merged into Xemu | Early alpha | Historical only |
| **JSep** (LGB) | JavaScript | Unknown | Defunct (*inference*) | Experimental | None |
| **ENTER / ep32** (Kevin Thacker, Vincze Béla György) | C | Unclear; ep128emu redistributes the code under GPL | Defunct, around 1999–2003 | Historical | None. It is the ancestor of ep128emu's Z80 and WD177x code |
| **Kyp069/ep** (RetroWiki FPGA-Dev Team, MiSTer/MiST/ZX3/…) | Verilog | **GPL-3.0-or-later** (file headers); no repo licence | Pushed 2024-05-12 | Real-hardware-oriented HDL: Nick timing per pixel clock, full Dave | Read only. A second hardware-level opinion on Nick and Dave timing |
| **EP128_MiST** (retrocrypta) | n/a | None | 1 commit, 2020 | README only | None |
| **MeiKinosaki/Enterprise-128** ("Enterprise128-360") | C++17 | CC0-1.0 | New (created 2026-10-13) | Prototype. Partial Z80; Nick and Dave are stubs | Permissive but has nothing worth porting |

No Rust Enterprise emulator was found. Searching GitHub for "enterprise 128" and "ep128" returned
only the entries above.

---

## 2. Clock Signal (CLK): Enterprise 64/128/256

- **Author:** Thomas Harte. Enterprise support started 2021-06-10.
- **URL:** https://github.com/TomHarte/CLK, source in https://github.com/TomHarte/CLK/tree/main/Machines/Enterprise
- **Licence:** **MIT**. Verified three ways: the GitHub API returns `"spdx_id": "MIT"`; the `LICENCE` file
  (https://raw.githubusercontent.com/TomHarte/CLK/main/LICENCE) is the MIT text with
  "Copyright (c) 2015 Thomas Harte"; and the README sidebar says MIT. The per-file headers say
  "Copyright © 2021 Thomas Harte. All rights reserved." That is Xcode's boilerplate. The repo
  licence governs, the same situation as the ZX80/81 port already in Klive (*inference*: treat it
  the same way).
- **Activity:** Repo pushed 2026-10-21. Recent Enterprise commits:
  - "Switch wholesale to std::filesystem." (2026-10-06)
  - "Implement Enterprise resets; simplify Z80 handling." (2026-05-27)
- **Platforms:** macOS (native), Linux/BSD (Qt or SDL).
- **Models:** EP64 (64K), EP128 (128K, the default) and EP256. CPU at 4 MHz or 6 MHz.
  - ROMs selected: EXOS 1.0/2.0/2.1/2.3; BASIC 1.0/1.1/2.1; EXDOS optional; EPDOS used if present.
- **ROMs:** Not bundled. `ROMImages/Enterprise/readme.txt` says they were left out because their
  copyright status is uncertain. They are requested through a ROM fetcher.

### Code structure

| File | What it does |
|---|---|
| `Machines/Enterprise/Enterprise.cpp` (31 KB) | The machine: paging, I/O decoding, wait states, Nick/Dave/Z80 scheduling, interrupt routing, keyboard, typing, host-FS traps |
| `Nick.cpp/.hpp` (19.5 KB) | Nick video chip |
| `Dave.cpp/.hpp` (10.7 KB) | Dave audio, plus a separate `TimedInterruptSource` class for the 1 Hz, 50 Hz/1 kHz and tone interrupts |
| `EXDos.cpp/.hpp` | EXDOS card. Subclasses the shared WD1770 (P1770 variant) in `Components/1770/`; 4 drives; documents the control register at 0x18–0x1F |
| `Keyboard.cpp/.hpp` | 10-row key matrix and host mapping |
| `HostFSHandler.cpp/.hpp`, `HostFS/hostfs.z80s` | CLK's own 3.5 KB EXOS extension ROM, assembled from source. Trap sites are marked with the byte pattern ED FE FE and serviced on the host side. This loads `.bas`/`.com` without disk images |
| `EXOSCodes.hpp` | EXOS error and function codes |
| `Processors/Z80/` | CLK's shared Z80. It runs one machine cycle at a time, with a bus handler that sees every M-cycle (also MIT) |
| `Outputs/Speaker/` | The `PullLowpass` speaker, a filtered resampler |

### Timing model (in my words)

- **Nick.** Nick counts its own clock. A line is 912 Nick cycles: 57 *windows* of 16 cycles.
  - The first 6 cycles of a window belong to the Z80; the last 10 belong to Nick's video fetches.
  - Windows 0–3 carry HSYNC.
  - The 16-byte LPT entry is fetched across windows 0–7: count/mode, then margins, two pointers, and
    eight palette entries two per window. It is fetched only on the first line of a mode block.
  - Pixels start at window 8 (RGB output).
  - All modes are implemented: PIXEL, LPIXEL, ATTR, CH64/128/256 and VSYNC, at 1/2/4/8 bpp. ALTIND
    and MSBALT/LSBALT are handled. Invalid modes fall back to PIXEL.
- **Z80 and Nick interleave** through CLK's `JustInTimeActor`. Nick is advanced lazily, with a
  rational clock ratio to the Z80 (about 3.56 Nick cycles per 4 MHz Z80 cycle).
  - On every Z80 machine cycle, the machine works out the extra cycles first:
    - A video-RAM access (pages FC–FF) or a Nick port access (0x80–0x8F) asks Nick for the
      time until the next Z80 slot. An access may begin in the first 3 of the 6 Z80 cycles.
      That time is converted back to Z80 cycles and added as wait states.
    - Other memory accesses get the Dave wait selected by port 0xBF: all accesses, M1 only, or none.
  - Video-RAM writes flush Nick first, so mid-line changes show up.
  - The author calls these timing rules guesses. The Nick commit history shows tuning in 2021
    ("Edge up very close to video waits.", "Allow that final Z80 cycle to start anywhere in the
    first three of Nick's window of six.").
- **Interrupts.**
  - Nick's interrupt bit (LPT byte 1, bit 7) goes to Dave's INT1 on a rising edge.
  - Dave's `TimedInterruptSource` predicts the next event, so the scheduler can sleep until it.
  - Port 0xB4 masks and acknowledges interrupts. The vector reads back 0xFF.
- **Audio.**
  - Dave runs at the CPU clock divided by 8, on CLK's asynchronous audio queue. Register writes are
    queued so the sound stays in order without stalling the CPU.
  - Implemented:
    - three 12-bit tone channels;
    - 4-, 5- and 7-bit polynomial distortion;
    - a noise channel with 9/11/15/17-bit polynomials and a selectable clock source;
    - high-pass filters, ring modulation, and a low-pass filter on the noise channel;
    - 6-bit stereo volumes and D/A mode.
  - The author says the TDM mixing details are unclear, so the channels are simply summed.
    - One behaviour (ring modulation while sync is on) follows "SIDBasic", a reference not
      identified further.
  - The output is low-pass resampled in `PullLowpass`.
- **Not implemented:**
  - tape (port B5/B6 tape bits are TODO; tape input reads 0xFF);
  - joystick (0xB6 reads 0xFF), printer and serial;
  - external colour bits.
  - The video-RAM test assumes 64K of video RAM.
  - No debugger beyond CLK's generic tooling.
  - Snapshots: none for this machine (*inference*: no state code in these files).
- **Media:** `.bas` and `.com` (through HostFS); disk images through EXDOS. The Batocera wiki says
  CLK accepts only `.bas`, `.com` and `.zip` here (https://www.wiki.batocera.org/systems:enterprise).
- **Suitability:** **Can be ported** (MIT) into the WASM C core, with MIT attribution as already
  done for the ZX80/81. It is not a complete machine: tape, joystick and wait-state validation need
  to come from Klive's own work, checked against facts read in ep128emu.

## 3. ep128emu (Istvan Varga): the reference

- **URLs:**
  - Source: https://github.com/istvan-v/ep128emu
  - Project and releases: https://sourceforge.net/projects/ep128emu/
  - Documentation: https://ep128emu.sourceforge.net/
- **Licence:** **GPL-2.0-or-later**.
  - Verified from the API (`GPL-2.0`), from the header of `src/ep128vm.cpp` ("GNU General Public
    License … version 2 … or any later version"), and from the headers of `nick.cpp` and `dave.cpp`.
  - The copyright page (https://ep128emu.sourceforge.net/html/copyright.html) says code taken from
    other emulators is also under the GPL:
    - the Z80 core comes from Kevin Thacker's ENTER emulator;
    - `wd177x` is based on ep32 by Kevin Thacker and Vincze Béla György.
- **Activity:**
  - Release 2.0.11.2 on 2019-04-19; last push to upstream 2022-04-30.
  - The libretro fork https://github.com/libretro/ep128emu-core (and zoltanvb/ep128emu) is active,
    pushed 2026-10-18.
- **Platforms:** Windows, Linux, macOS (FLTK, PortAudio, optional OpenGL). Also libretro, and WASM in
  Ep128web.
- **Machines:** Enterprise 64/128 (RAM 64K to about 3.7 MB), ZX Spectrum 48/128, CPC 464/664/6128,
  Videoton TVC.
- **Features:**
  - Z80 with undocumented opcodes and an optional CMOS variant.
  - Wait states: none, M1 only, or all accesses, selected through port BF. The CPU synchronises with
    Nick on video-RAM access.
  - Dave: sound, timers and interrupts, written from tests on a real EP128.
  - Nick: all documented modes and the undocumented ports 84–8F.
  - Storage and expansion:
    - WD177x EXDOS with four drives;
    - IDE with VHD/raw images;
    - SDEXT, based on LGB's Xep128 code;
    - RTC at 7E/7F;
    - a 4-channel DAC at F0–F3;
    - the EnterMice mouse;
    - the Spectrum emulator card;
    - an optional SID card (reSID).
  - Tape: the EPTE format plus WAV/AIFF.
  - Snapshots, demo recording, and a FILE: device through `epfileio.rom`.
  - A full GUI debugger and monitor with Lua scripting.
  - Sources: https://raw.githubusercontent.com/istvan-v/ep128emu/master/README and
    https://ep128emu.sourceforge.net/html/ep128emu_state.html
- **Known limitations (its own documentation):**
  - Z80 timing is "still not perfect" but close.
  - Unusual LPTs (interlace, excess lines) may differ from the real hardware.
  - Bits 5–7 of port 80 are ignored.
  - Old docs: whole-track FDC operations are not implemented.
  - Nick FIXME: slot 7 should be HBLANK.
  - Nick TODO: the speaker bit is not implemented.
- **ROMs:** Not bundled upstream; they come as the separate `ep128emu_roms-2.0.11` package. The
  libretro core has built-in default ROMs since 1.1.0, plus an "enhanced" ROM with a faster memory
  test.
- **Code structure** (https://github.com/istvan-v/ep128emu/tree/master/src):

  | File(s) | What it holds |
  |---|---|
  | `ep128vm.cpp/.hpp` | Machine and main loop |
  | `nick.cpp/.hpp` | Nick |
  | `dave.cpp/.hpp` | Dave |
  | `memory.cpp/.hpp`, `ioports.cpp` | Memory and I/O |
  | `/z80/` | Z80 core |
  | `wd177x.cpp`, `ep_fdd.cpp` | EXDOS |
  | `ide.cpp` | IDE |
  | `sdext.cpp` | SDEXT |
  | `tape.cpp` | Tape |
  | `snapshot.cpp` | Snapshots |
  | `debuglib.cpp`, `script.cpp` | Debugger |
  | `soundio.cpp`, `snd_conv.cpp` | Audio output and resampling |
  | `epmemcfg.cpp` | Memory configuration |
  | `tapeutil/` | Tape tools |

- **Timing model (in my words):**
  - `Ep128VM::run()` advances one **Nick slot** at a time. A slot is 16 pixels, at about 889,846 Hz;
    57 slots make a line.
  - For each slot it runs the registered callbacks (tape, mouse, demo, SID), steps Dave by its share
    (Dave about 500 kHz), and pushes audio.
  - It then runs Z80 instructions while the 32.32 fixed-point CPU budget is non-negative.
  - Inside IN and OUT, `runDevices()` brings Nick and Dave up to the current cycle.
  - Memory waits go through `videoMemoryWait*()` helpers for pages FC–FF and for Nick ports.
  - Nick renders each slot with renderer functions picked from a table indexed by video mode, colour
    mode and alt flags (about 38 specialised renderers plus generic ones). It writes 9 bytes per
    slot into a line buffer.
    - Slots 0–7 read the LPT, 8–53 are display, and 54–56 are end-of-line work.
    - The last byte fetched is kept as the floating data-bus value.
  - Dave's `runOneCycle` produces one stereo sample per Dave tick, from 4/5/7-bit polynomial tables,
    a 9/11/15/17-bit noise generator, high-pass/low-pass filters, XNOR ring modulation and D/A mode.
    The sample stream is resampled by the sound I/O layer.
- **Suitability:** **Reference only (GPL).** It is the oracle: run it to compare screens and sound,
  and read it for facts (port bits, slot positions, Dave quirks). It is never copied or translated.

## 4. MAME: `ep64` / `ep128` / `phc64`

- **URLs:**
  - https://github.com/mamedev/mame/blob/master/src/mame/enterprise/ep64.cpp
  - `nick.cpp` and `dave.cpp` in the same folder
  - `src/devices/bus/ep64/exdos.cpp`
- **Licence:** **BSD-3-Clause**. Each file's first line is `// license:BSD-3-Clause`, and the
  copyright holder is Curt Coder. Verified for `ep64.cpp`, `nick.cpp`, `dave.cpp` and `exdos.cpp`.
- **Features:**
  - Z80 at 4 MHz; Nick and Dave on the 8 MHz crystal.
  - Cartridge, 2 cassettes, EXDOS (WD1770, 3.5" DD, `FLOPPY_EP64_FORMAT`), Centronics, RS-232.
  - Software lists for cartridges, cassettes and floppies.
  - Save states.
  - ROM sets `ep64` (enter05-23-a) and `ep128` (enter08-45-a), which MAME does not ship.
- **Accuracy:**
  - Nick renders **once per scanline** from a timer, so it does not interleave with the CPU.
    - Mode 6 draws nothing.
    - ALTIND is handled only in the 2-colour LPIXEL path.
  - Dave has the 3 tone channels as timers, plus volumes, interrupts and paging.
    - **Missing:** the noise channel, polynomial counters, filters and ring modulation.
    - No wait states.
  - The driver also documents the board layout and the memory-expansion mapping in its comments,
    which is useful.
- **Suitability:** Permissive, so code can be ported with the BSD-3 notice kept. Little is worth
  taking beyond the device split and the documentation in the comments; CLK is better on every
  axis.

## 5. Xemu `ep128` target, and Xep128 (LGB)

- **URLs:**
  - https://github.com/lgblgblgb/xemu/tree/master/targets/ep128
  - Archived Xep128: https://github.com/lgblgblgb/xep128
- **Licence:** GPL-2.0-or-later. Verified from the API and from the `nick.c` and `dave.c` headers:
  - "(C) 2015-2023 LGB"
  - "(C) 2015-2016, 2020 LGB"
- **Files:**
  - Core: `enterprise128.c` (machine), `nick.c`, `dave.c`, `cpu.c` (Z80ex-derived Z80), `z180.c`
  - Storage: `exdos_wd.c`, `sdext.c`
  - Add-ons: `apu.c` (Am9511 maths chip), `epnet.c` (Wiznet), `zxemu.c`, `primoemu.c`, `rtc.c`, `printer.c`
  - Support: `snapshot.c` (loads ep128emu snapshots, *inference* from the name and history),
    `emu_monitor.c`
- **Accuracy:**
  - Nick works one slot at a time (slots 0–57). Character modes at 16/256 colours are TODO, and
    the border is simplified.
  - Dave has only the tone channels: the comments say noise, polynomials and modulation are missing.
    Audio is fixed at 41,666 Hz.
  - Xep128's own README says it is not cycle-exact. Its sound is called missing or poor, and Nick
    imprecise.
- **Suitability:** Read only. It is useful for facts on SDEXT, the APU and EPNET.

## 6. Ep128web (kks2003)

- https://github.com/kks2003/Ep128web
- The ep128emu C++ core is compiled to WebAssembly with Emscripten and left unmodified. It has a
  canvas and Web Audio front end, patches for TVC256k++, and no bundled ROMs.
- GPL-2.0-or-later (README).
- Active (pushed 2026-10-16).
- *Inference:* it proves an accurate Enterprise core runs fast enough in a browser at WASM speed.
  That bears on Klive's per-slot WASM design. It is read only.

## 7. FPGA: Elan Enterprise core (Kyp069 and the RetroWiki FPGA-Dev Team)

- **Repo:** https://github.com/Kyp069/ep, described as "Elan Enterprise FPGA implementation".
  Verilog; pushed 2024-05-12.
  - Board folders: `mister`, `np1`, `sidi128`, `ua2`, `zx3`, `psd`.
- **History:** Started by Kyp in Xilinx; ported to Altera by Yo_Me and Rampa069. Releases were
  announced on misterfpga.org ("Elan Enterprise Core Release Candidate by RW FPGA-Dev Team").
  The core has a built-in ROM.
- **Licence:** No licence at repo level (the API returns `null`). The `hdl/video.v` and
  `hdl/audio.v` headers say **GPL-3.0-or-later**:
  - `video.v`: Kyp069, 2023;
  - `audio.v`: Kyp069 2023 and Rampa069 2024.
- **Content:**
  - `hdl/video.v` is Nick: a 912-cycle line counter split into a 16-pixel column and a position in
    it, LPT latching, and fixed fetch positions per column.
  - `hdl/audio.v` is Dave sound: 4/5/7/17-bit LFSRs, 3 tone channels plus noise, high-pass and
    low-pass gating, ring modulation and DAC mode.
  - Elsewhere: `memory.v`, `interrupts.v`, a `T80` CPU, and keyboard and mouse.
- **Suitability:** Read only (GPL-3). It is valuable as an independent, hardware-level description of
  where Nick fetches fall within a 16-pixel column.
- **EP128_MiST** (https://github.com/retrocrypta/EP128_MiST) holds only a README (1 commit, 2020).

## 8. Minor and historical

- **ENTER and ep32** (Kevin Thacker, Vincze Béla György, around 1999–2003): early Enterprise
  emulators. Their Z80 and WD177x code lives on inside ep128emu under the GPL. I found no source
  online. Source: https://ep128emu.sourceforge.net/html/copyright.html
- **JSep** (LGB): a JavaScript emulator listed on LGB's old site as "highly experimental". I found no
  source online.
- **MeiKinosaki/Enterprise-128** (https://github.com/MeiKinosaki/Enterprise-128): CC0-1.0, created
  2026-10-13. Its `docs/ROADMAP.md` says the Z80 is partial and not cycle-accurate, and Nick and Dave
  are register stubs. It has nothing worth porting.
- **Rust:** none found.
- **Android "EP128Emu":** *inference* — rebuilds of ep128emu or its libretro core (GPL); not
  investigated further.

## 9. Test programs and validation material

- **No public automated test suite** for Nick or Dave was found in any of these projects.
  - ep128emu's README names no test programs, and CLK's Enterprise folder has no tests.
- **How ep128emu was validated:** its Dave emulation was written from measurements on a real EP128
  (state page). Its other test material is a demo-recording and replay format and a Lua-scriptable
  debugger. *Inference:* that suits recording golden traces.
- **CLK:** tuned by hand ("guesses" in the comments). CLK's shared Z80 is validated by the usual Z80
  suites in the CLK repo (*inference*: the same core Klive already trusts for the ZX80/81).
- **Community sources for timing:**
  - Forum and wiki: https://enterpriseforever.com/ and http://wiki.enterpriseforever.com/
  - Software: https://ep128.hu/
  - *Inference:* demos that change the LPT mid-frame or poke Nick mid-line are the practical
    accuracy tests.
- **Recommendation:** run Klive's own test programs on ep128emu (or Ep128web) as a behavioural
  oracle, as the project already does with zxbc (plan D12), and record only the results.

## 10. Recommendation for Klive

1. **Port from CLK** (MIT), into the C/WASM core, as was done for the ZX80/81:
   - `Nick.cpp` (window and slot model, LPT, all modes);
   - `Dave.cpp` (sound and `TimedInterruptSource`);
   - the paging, port and wait-state logic in `Enterprise.cpp`;
   - `EXDos.cpp` with CLK's WD1770.
   Keep "Copyright (c) 2015 Thomas Harte" and add a `THIRD_PARTY_NOTICES.md` entry. The HostFS
   approach (`hostfs.z80s`, an EXOS extension ROM with ED FE FE traps) is also MIT. It is a good
   model for loading `.com`/`.bas` and the IDE's own output without disk images.
2. **The Z80** stays Klive's shared WASM Z80. Only the bus-side wait logic (Nick slot arbitration,
   the port 0xBF modes) comes from CLK.
3. **MAME** (BSD-3) may be ported, keeping its notice. In practice only its documentation is worth
   using: the board, the ROM-set CRCs and the expansion memory map.
4. **Read only, never copy or translate:**
   - ep128emu and its libretro and Ep128web derivatives (GPL-2+);
   - Xemu and Xep128 (GPL-2+);
   - the Kyp069 FPGA core (GPL-3+).
   Use them to fill CLK's gaps from facts recorded in Klive's own words:
   - tape (ep128emu's EPTE format and the B5/B6 tape bits);
   - joystick;
   - the floating data bus;
   - slot 7 HBLANK;
   - mid-line effects;
   - SDEXT and IDE.
5. **Validate against ep128emu as an oracle.** Use screens, audio and cycle counts of Klive-authored
   test programs. CLK's wait timings are self-described guesses.
6. **ROMs:** no permissive project ships EXOS or BASIC. CLK and ep128emu leave them out over
   copyright doubts, while the libretro core embeds them. Klive must settle ROM distribution
   separately; it is an open question.

## Sources

- CLK: https://github.com/TomHarte/CLK
  - Licence: https://raw.githubusercontent.com/TomHarte/CLK/main/LICENCE
  - Machine files:
    - https://raw.githubusercontent.com/TomHarte/CLK/main/Machines/Enterprise/Enterprise.cpp
    - …/Nick.cpp
    - …/Dave.cpp
    - …/EXDos.cpp
  - ROM readme: …/ROMImages/Enterprise/readme.txt
  - API: https://api.github.com/repos/TomHarte/CLK
- ep128emu:
  - Source and API: https://github.com/istvan-v/ep128emu, https://api.github.com/repos/istvan-v/ep128emu
  - README: https://raw.githubusercontent.com/istvan-v/ep128emu/master/README
  - Machine files:
    - https://raw.githubusercontent.com/istvan-v/ep128emu/master/src/ep128vm.cpp
    - …/nick.cpp
    - …/dave.cpp
  - Documentation:
    - https://ep128emu.sourceforge.net/about.html
    - https://ep128emu.sourceforge.net/html/ep128emu_state.html
    - https://ep128emu.sourceforge.net/html/copyright.html
    - https://ep128emu.sourceforge.net/links.html
- libretro: https://github.com/libretro/ep128emu-core (README on the `core` branch)
- Ep128web: https://github.com/kks2003/Ep128web
- MAME:
  - https://raw.githubusercontent.com/mamedev/mame/master/src/mame/enterprise/ep64.cpp
  - …/nick.cpp
  - …/dave.cpp
  - https://raw.githubusercontent.com/mamedev/mame/master/src/devices/bus/ep64/exdos.cpp
- Xemu and Xep128:
  - https://github.com/lgblgblgb/xemu/tree/master/targets/ep128 (`README.md`, `nick.c`, `dave.c`)
  - https://api.github.com/repos/lgblgblgb/xep128
- FPGA:
  - https://github.com/Kyp069/ep (`hdl/video.v`, `hdl/audio.v`)
  - https://misterfpga.org/viewtopic.php?p=69934 (403 to WebFetch; seen through search snippets)
  - https://github.com/retrocrypta/EP128_MiST
- https://github.com/MeiKinosaki/Enterprise-128 (`docs/ROADMAP.md`)
- Batocera wiki: https://www.wiki.batocera.org/systems:enterprise
- Emulation General wiki: https://emulation.gametechwiki.com/index.php/Enterprise_64/128_emulators
  (403 to WebFetch)

## Open questions

1. **CLK's wait timings.**
   - CLK says the Z80 owns cycles 0–5 of each 16-cycle window and Nick owns 6–15. A CLK commit
     note seen in a search snippet put Nick's 10 VRAM cycles *first*. Which order is right on real
     hardware? Check ep128emu (by reading) and the FPGA `video.v`.
   - The Dave-delay comments in `Enterprise.cpp` mention 8 and 12 MHz, but the code runs at
     4 and 6 MHz. This needs confirming.
2. **Dave in CLK.** Its Dave follows "SIDBasic" for one quirk, and its TDM mixing is a plain sum. How
   far are both from real hardware? ep128emu's hardware-measured Dave is the oracle.
3. **Kyp069/ep licence.** The repo has no licence file while the file headers say GPL-3+. Does any
   file carry a different licence? Only two files were checked.
4. **ENTER, ep32 and JSep.** Original licences and source availability are unknown.
5. **ROMs.** Can EXOS 2.x and IS-BASIC be redistributed? The libretro core embeds them, so on what
   basis? Klive needs a policy, and possibly a replacement boot ROM.
6. **Tape.** CLK has no tape. Should Klive support ep128emu's EPTE, WAV, or `.tap` as used by
   libretro? Format facts must be gathered from documentation, not from GPL code.
7. **Video RAM size.** CLK assumes 64K of video RAM; the EP256 and larger expansions need checking.
