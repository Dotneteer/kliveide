# Enterprise 64/128 — research pack for a Klive machine

Background collected on 2026-10-21 before writing a plan to add the Enterprise 128 (and probably the
64) to Klive. Nothing here is a plan. These are the facts, the open questions, and what the
existing emulators can and cannot give us.

Every file cites its sources inline: URLs, and the emulator file and function. Anything the
researcher concluded rather than read is marked *inference*. Where sources disagree, both versions
are kept. The reference documents from §9 of `STORAGE_FIRMWARE_SOFTWARE.md` are in `docs/`, and
the MIT-licensed Clock Signal sources are in `clk/`. No ROM images are included.

| File | Covers |
|---|---|
| [NICK_VIDEO.md](NICK_VIDEO.md) | The NICK chip: clocks, 57-slot line, LPT format, the 8 video modes × 4 colour modes, palette and colour byte, ports 80h–83h, video-RAM contention, VINT |
| [DAVE_MEMORY_IO.md](DAVE_MEMORY_IO.md) | The DAVE chip: clocks and wait states (BFh), paging (B0h–B3h) and the segment map, interrupts (B4h), sound (A0h–AFh, LFSR taps), keyboard matrix and joysticks (B5h/B6h), printer, serial/net and tape bits (B6h/B7h), the full I/O port map, reset |
| [NICK_VIDEO_BACKGROUND.md](NICK_VIDEO_BACKGROUND.md) | Added 2026-10-30. The NICK hardware from the board schematic: the clock is an LC oscillator phase-locked to the PAL crystal, the resistor colour DAC, and external composite sync. Also the Kyp069 FPGA core, the EXOS book and forum measurements, the RGBtoHDMI profile, EXOS's LPT, test software, and the status of each NICK open question |
| [DAVE_AUDIO_BACKGROUND.md](DAVE_AUDIO_BACKGROUND.md) | Added 2026-10-30. DAVE sound in depth: tick order, LFSR sequences and seeds, sync, the D/A mode, the analogue path (DAC, LM324 filter, outputs, LM386 speaker), the FPGA core, the forum DAVE thread, sample-playback techniques, emulation design, test software, and the status of each sound question |
| [STORAGE_FIRMWARE_SOFTWARE.md](STORAGE_FIRMWARE_SOFTWARE.md) | Models and connectors, ROMs (EXOS 2.0/2.1, IS-BASIC, unofficial 2.2–2.4), EXOS architecture (RST 30h calls, channels, module header, boot), the tape signal and image formats, EXDOS (WD1770, FAT12), SDEXT/IDE/RTC/mouse, file formats, test software, reference documents |
| [EXISTING_EMULATORS.md](EXISTING_EMULATORS.md) | 12 emulators compared, with licences checked against the repositories, code structure of the main candidates, and what Klive can port or only read |
| [docs/](docs/) | Reference documents, downloaded on 2026-10-21. See the table below. |
| [clk/](clk/README.md) | Clock Signal's MIT-licensed Enterprise sources at a pinned commit, with `LICENCE` and the shared files they depend on (WD1770, LFSR, machine config) |

### Reference documents in `docs/`

| File | What it is | Source |
|---|---|---|
| `EXOS20_Technical_Information.pdf` | EXOS 2.0 Technical Information (Intelligent Software, 1984, English). **The main OS reference.** | ep128.hu |
| `EXOS10_Technical_Information.pdf` | EXOS 1.0 Technical Information | ep128.hu |
| `Exos.htm` | EXOS 2.1 specification in Hungarian: the kernel, all drivers and a hardware appendix | ep128.hu |
| `Technical_Documentation_Nick_Chip_Programmers_Guide.html` | Nick Chip Programmer's Guide | ep128.hu |
| `Technical_Documentation_DPC_Sound_Chip.html` | DAVE (DPC) specification | ep128.hu |
| `Dave_spec_lgb.html` | DAVE spec DPC/Dave/1 Issue 5, another transcription | ep.lgb.hu |
| `Enterprise_Programming_Guide.pdf` | Enterprise Programming Guide (1984) | ep128.hu |
| `Enterprise_Set_Up_Guide.pdf` | Enterprise Set Up Guide (1984) | ep128.hu |
| `ISDOS_English.pdf`, `ISDOS_OCR.html` | IS-DOS 1.0 manual: a scan, and an OCR text page | ep128.hu, Enterprise Wiki |
| `EXDOS_System_Specification_early.html` | EXDOS system specification (early, OCR, partial) | Enterprise Wiki |
| `WD1772-JLG.pdf` | WD1772 FDC datasheet | ep128.hu |
| `Converting_Spectrum_programs.txt` | Converting Spectrum programs (1984) | ep128.hu |
| `EP128Emu_manual.html` | The ep128emu user manual | Enterprise Wiki |
| `EP_Books.htm` | Index of ep128.hu's book collection | ep128.hu |

### Hardware documents in `docs/hardware/`

Downloaded on 2026-10-30 from the Wayback Machine's copy of `enterprise.iko.hu` (the live site
returns 404). The archive index is `http://web.archive.org/cdx/search/cdx?url=enterprise.iko.hu/technical/*` (and
`.../schematics/*`). These are scans of proprietary drawings and documents hosted by fans: as with
the ROMs, check that they may be redistributed before they leave this research folder. The NICK and DAVE documents
were read on 2026-10-30. Their findings are §2 of `NICK_VIDEO_BACKGROUND.md` and §2 of
`DAVE_AUDIO_BACKGROUND.md`, cited by document and page. The gate-level plans were only checked
for specific questions, not traced.

| File | What it is |
|---|---|
| `3006-0000-22_Sheet-1.pdf`, `..._Sheet-2.pdf` | AMI's gate-level plans of **NICK** ("ELITE"), final Rev. E. The authoritative NICK logic. |
| `3007-000-22_Sheet-1.pdf`, `..._Sheet-2.pdf` | AMI's gate-level plans of **DAVE** ("ESPRIT"), final Rev. D |
| `NICK-DAVE-Legend_to_Plans.txt` | The revision history of the two sets of plans |
| `NICK-Internal-timing-of-VDC-Elite.pdf` (19 pp.) | **NICK's internal timing**. Likely to settle the slot, contention and VINT questions. |
| `NICK-Old-VDC-ELITE-description.pdf` (12 pp.) | An early NICK description |
| `ET1-1_84-01-17_The_Nick_Chip.pdf` (22 pp.), `ET1-1_84-11-29_The_Nick_Chip.pdf` (10 pp.) | Two editions of the official "The Nick Chip" spec |
| `DAVE_ISSUE4.pdf`, `DAVE_ISSUE5.pdf` | Scans of the DAVE spec. Issue 5 is the original of `Dave_spec_lgb.html`. |
| `The_Dave_Chip.pdf` | An earlier DAVE spec (1984-02-24) |
| `DAVE-Chip-Pinout-and-plastic-package-dimensions.pdf` | The DAVE pinout |
| `EP64-1-0.jpg`, `EP64-1-RT.jpg`, `EP64-2-0.jpg`, `EP64-2-RT.jpg`, `EP64-3-rajzolt.jpg`, `EP64-4--2.jpg` | The EP64 board schematic, sheets 1–4 (CPU/NICK/DAVE/RAM/ROM; DAVE and audio; NICK video output, redrawn; keyboard) |
| `NICK_lores.png`, `DAVE.png` | Low-resolution previews of the chip plans |
| `A3PER-1_Enterprise_64-128_Bus_Timing.pdf` | Expansion-bus timing |
| `Enterprise-TechDesc.pdf`, `Enterprise_Pinout_information.pdf` | The technical description, and the connector pinouts and levels |
| `Enterprise-Code-Book_Parts-and-Suppliers.pdf` | The parts list. May give the audio DAC resistor-pack values. |
| `ET11-10_EXOS_20_Video_Driver_Specification.pdf`, `ET11-11_EXOS_21_Video_Driver_Specification.pdf` | The EXOS video driver, which sets up the standard LPT |
| `Appendix2_EXOS_21_VSYNC_Improvement.pdf` | A change EXOS 2.1 made to its VSYNC handling |
| `ET12-7_EXOS_20_Sound_Driver_Specification.pdf`, `ET12-9_EXOS_21_Sound_Driver_Specification.pdf` | The EXOS sound driver |

Not downloaded: `ET1-3_Nick_Chip_Programmers_Guide.pdf`. The archive holds only its first 1 MiB, and
the guide is already in `docs/` as HTML.

The GPL sources listed in §9 (ep128emu, MAME, Xemu) were deliberately not copied here: they are
for reading facts, not porting. Read them online.

## The machine at a glance

| Block | Summary | Detail |
|---|---|---|
| CPU | Z80A at 4 MHz (8 MHz / 2). Runs in IM 1. | DAVE §1 |
| Memory | 4 MB address space made of 256 segments of 16 KB. Four 16 KB pages are selected by ports B0h–B3h (readable). The EP64 has RAM in FCh–FFh; the EP128 adds F8h–FBh. EXOS ROM is at 00h–01h, IS-BASIC cartridge at 04h, EXDOS ROM at 20h. Unmapped segments read FFh. | DAVE §2 |
| Video (NICK) | Has its own clock of about 14.2 MHz. A line is 57 slots × 16 cycles ≈ 64 µs; a normal frame is 312 lines at about 50 Hz. The display is driven by a Line Parameter Table in video RAM. There are 8 modes (VSYNC, PIXEL, ATTRIBUTE, CH256/128/64, LPIXEL) × 2/4/16/256 colours, with an 8-bit colour byte. NICK sees only segments FCh–FFh. | NICK |
| Contention | A CPU access to video RAM or to ports 80h–8Fh waits for NICK's slot grid (≈ 4.5 T-states per slot). Clocks are asynchronous, so the emulator must carry a fractional phase. Other memory gets 0/1-cycle DAVE waits set by BFh. | NICK §contention, DAVE §1.1–1.2 |
| Interrupts | DAVE latches 1 Hz, 50 Hz / 1 kHz / tone-channel, INT1 (NICK VINT bit in the LPT) and INT2. Enable and acknowledge are both on B4h. | DAVE §4 |
| Sound (DAVE) | 3 tone channels and 1 noise channel at a 250 kHz base. Polynomial distortion (4/5/7/9/11/15/17-bit LFSRs), high-pass and ring modulation, 6-bit stereo volume, and a direct D/A mode. | DAVE §5 |
| Keyboard / joystick | A 10 × 8 matrix scanned through B5h/B6h. The built-in joystick appears as matrix keys; external joysticks are on B6h. | DAVE §6 |
| Tape | Two cassette ports with remote motor control. Input is a comparator bit; output goes through the D/A. EXOS format: chunks of 256-byte blocks with a CRC-16, at fast and slow speed. There are two incompatible `.tap` formats. | STORAGE §4, DAVE §7 |
| Disk | EXDOS card: WD1770 FDC at 10h–13h plus control/status at 18h. Disks are FAT12 (720 KB `.img`). | STORAGE §5 |
| Modern add-ons | SDEXT SD cartridge, IDE (ECh–EFh), RTC (7Eh/7Fh), EnterMice. | STORAGE §5.3 |

## Components an emulator needs, roughly in build order

1. **Memory and paging.** The segment map, B0h–B3h, ROM loading for EXOS and BASIC, and 64K/128K RAM configurations.
2. **The Z80 with timing hooks.** Klive's existing Z80 can be reused. It needs DAVE wait states (BFh) and NICK video-RAM/port contention against an asynchronous slot grid. *This is the hardest part to get exactly right.*
3. **NICK.** An LPT walker and per-slot pixel generation for every mode and colour mode, the palette and FIXBIAS, the border, VINT, and the forced reload through port 83h.
4. **DAVE interrupts and timers**, so EXOS boots: the 1 Hz and 50 Hz sources, and VINT through INT1.
5. **Keyboard matrix.** At this point the machine reaches the EXOS/IS-BASIC prompt.
6. **DAVE sound.** Tone and noise channels, LFSRs, filters, the D/A mode, and stereo mixing into Klive's audio path.
7. **Program loading.** A host-file `FILE:` device through an EXOS extension ROM and an `ED FE FE nn` trap (both CLK and ep128emu do this). Klive should write its own ROM. This loads `.com` and `.bas` instantly.
8. **Tape.** Signal-level in/out, remote motor, and one or both `.tap` formats.
9. **EXDOS.** A WD1770 and `.img` disks. Then SDEXT, IDE and RTC as optional extras.
10. **IDE integration.** Machine type, memory and segment views, NICK/LPT and DAVE debug panels, and an assembler target for EXOS module headers.

## Main conclusions

- **Port source: Clock Signal (MIT).** `TomHarte/CLK/Machines/Enterprise/` has Nick, Dave, EXDOS, a keyboard and a host-FS ROM. This was re-checked with the GitHub API on 2026-10-21: the licence is MIT and the folder exists. It has the same author and licence situation as the ZX80/81 core already ported into Klive. It lacks tape, joysticks, printer and serial, and its own comments call its wait-state model a guess.
- **Accuracy oracle: ep128emu (GPL-2.0+).** Read it only for facts; never copy or translate its code. Running it as a behavioural oracle, recording only the observed results of Klive's own test programs, would mirror the Klive BASIC rule (D12). Whether to adopt that rule formally belongs in the plan.
- **MAME (BSD-3)** is portable but not accurate enough to be useful as a timing reference. **The Kyp069 FPGA core** (Verilog, GPL-3+) is a second hardware-level view of the timing; read only.
- **ROMs: settled on 2026-10-30.** The Hungarian community holds permission from Werner Lindner, former managing director of Enterprise Computers GmbH, the German company that took over the rights. The ROMs may be used and modified freely as long as nothing is charged and the original companies' names are kept. EXOS 2.0/2.1, IS-BASIC 2.0/2.1 and EXDOS 1.3 are now in `src/public/roms/ep-*.rom`. `ep-roms-readme.txt` records the source and the checksums, and `test/machines/ep-rom-images.test.ts` checks them. Klive can therefore bundle the ROMs.
- **IS-BASIC's token table and line format** are not documented anywhere public. This only matters for BASIC-aware tooling, not for the emulator.

## Points the sources disagree on (to settle with test programs)

| Question | Positions | Where |
|---|---|---|
| VINT edge | Interrupt at the **start** of the VINT line (NICK guide, CLK, and the 1983–84 NICK design documents: /VIRQ is low for the whole block and the interrupt comes "at the beginning"), or at its **end / the next line** (ep128emu, Xemu, EXOS book). Start and end can only both be right if DAVE latches the rising edge; DAVE's gate-level edge logic is not traced yet. | NICK OQ2, DAVE OQ1; NICK_VIDEO_BACKGROUND §2.6, N9 |
| Exact NICK clock | **Settled: 14 237 536 Hz.** NICK divides the subcarrier by 568 and phase-locks it to H/2, and DPC11 names 14.2375 MHz. | NICK OQ1; NICK_VIDEO_BACKGROUND §2.2 |
| Order of the CPU/NICK window inside a slot | **Narrowed:** the design documents give NICK clocks 0–4 and 5–9 of each 16-clock slot, and the Z80 clocks 10–15; NICK stretches the Z80 clock in half-T steps. The cost per phase is still to be found. | NICK OQ5; NICK_VIDEO_BACKGROUND §2.3 |
| How often the line block is read | **Settled: every line** (design documents and ep128emu; CLK and the FPGA core are wrong) | NICK OQ3; NICK_VIDEO_BACKGROUND §2.6 |
| Port 83h bits 6 and 7 | **Narrowed:** bit 7 is the LP counter's LOAD and bit 6 its clock, which reproduces ep128emu's behaviour; CLK, Xemu and the FPGA core disagree | NICK OQ4; NICK_VIDEO_BACKGROUND §2.7 |
| Noise base clock | **Settled: 31.25 kHz.** The spec, the EXOS book, ep128emu and the FPGA core agree; only CLK uses 62.5 kHz. | DAVE §5.3; DAVE_AUDIO_BACKGROUND §1 |
| ALTIND1 bit | RM bit 7 (ET1/1, both editions), or bit 6 (the Programmer's Guide, ep128emu) | NICK_VIDEO_BACKGROUND N8 |
| Speaker-mute bit | FIXBIAS (80h) bit 7 in every hardware document; bit 5 in the EXOS 2.1 video driver spec and the EXOS book | NICK_VIDEO_BACKGROUND N5 |
| Poly counter period | 2ⁿ − 1 (spec, emulators), or 2ⁿ: the gate plan has an extra NOR term in the feedback | DAVE_AUDIO_BACKGROUND §2.6 |
| Joystick 2 bit | B6h bit 0 or bit 2 | DAVE §6 |
| EXDOS control-register decode | 18h with a mirror (MAME), 18h–1Fh (CLK), address bit 3 (ep128emu) | STORAGE OQ4 |
| Printer READY bit | B6h bit 3, or B5h bit 3 | STORAGE OQ3 |
| Tape timing units in the Hungarian spec | ms vs µs, and full vs half periods | STORAGE OQ2 |

Each file's own "Open questions" section has the full list.

## Suggested next steps before the plan

- Use the English EXOS 2.0 PDF in `docs/` to settle the tape timing units and the BFh value EXOS sets at boot.
- Decide the provenance rule (port from CLK; ep128emu and the FPGA core read-only) before drafting the plan.
