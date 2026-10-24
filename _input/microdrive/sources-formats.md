# Sources for the format, state, ROM-version, compatibility, emulator and test-material notes

Bibliography for `mdr-and-file-formats.md`, `snapshot-and-state-formats.md`,
`interface1-rom-versions-and-licensing.md`, `model-compatibility.md`, `emulator-survey.md` and
`test-material.md`. (The hardware/ROM-behaviour files use `sources.md`.) Retrieved October 2026.
"Local copy" = saved under `_input/microdrive/docs/` (text/HTML/PDF documentation only; no ROMs,
executables or archives were downloaded). Web content was treated as data.

| Ref | Source | URL | Used for | Local copy |
|---|---|---|---|---|
| F1 | MDR description adapted from Carlo Delhez's *Spectator* docs (via the XZX/zxsp "File Formats" folder) | https://k1.spdns.de/Develop/Projects/zxsp/Info/File%20Formats/mdr.txt | MDR layout, field table, block states, checksum rule, `OUT 239,0` erase | `docs/mdr-zxsp.txt` |
| F2 | World of Spectrum FAQ, "File formats" (MDR, SNA) | https://worldofspectrum.org/faq/reference/formats.htm | MDR table; Warajevo variant (no WP byte, fewer sectors); SNA layout (no IF1 field) | `docs/wos-formats.htm` |
| F4 | Sinclair Wiki, "ZX Interface 1" (CC BY-SA 4.0) | https://sinclair.wiki.zxnet.co.uk/wiki/ZX_Interface_1 | RECFLG description (disagrees on bit 2), 9-byte file header, checksum pseudo-code, timing 8–10 s/80 kbit/s per track | `docs/sinclair-wiki-ZX_Interface_1.wiki.txt` (saved by the parallel agent) |
| F5 | J. Needle, *The zx-state File Format 1.5*: ZXSTIF1, ZXSTMCART | https://www.spectaculator.com/docs/zx-state/interface1.html , https://www.spectaculator.com/docs/zx-state/microdrive.html | SZX `IF1\0` and `MDRV` blocks; "standard v2 ROM" default | `docs/szx-interface1.html`, `docs/szx-microdrive.html`, `docs/szx-header.html` |
| F6 | Sinclair, *ZX Microdrive and Interface 1 Manual* (HTML transcription) | https://worldofspectrum.net/pub/sinclair/books/m/MicrodriveAndInterface1Manual.html | command syntax, CAT layout, timings, report list, 85 KB minimum, autorun "run", hidden names | `docs/MicrodriveAndInterface1Manual.html` |
| F7 | Wikipedia, "ZX Microdrive" (CC BY-SA 4.0) | https://en.wikipedia.org/wiki/ZX_Microdrive | tape length/speed, 15 KB/s, ≥ 85 KB, QL ≥ 100 KB, Expansion System bundle | — |
| F8 | World of Spectrum FAQ, "Z80 File Format" | https://worldofspectrum.org/faq/reference/z80format.htm | hardware modes v2/v3, byte 36, byte 37 bit 7, page 1, extended modes | `docs/z80format.htm` |
| F9 | Fuse man page (SourceForge copy and Debian *testing* copy) | https://fuse-emulator.sourceforge.net/man/html/fuse.html , https://manpages.debian.org/testing/fuse-emulator-common/fuse.1.en.html | menus, options (`--mdr-len` 10–254, random ≈ 180, `--microdrive-N-file`, RS-232), `if1-2.rom` not supplied, credits | `docs/fuse-manpage*.html/.txt` |
| F10 | libspectrum 1.6.4 documentation (`doc/libspectrum.txt`) | https://raw.githubusercontent.com/speccytools/libspectrum/master/doc/libspectrum.txt | microdrive constants and API, snapshot IF1 fields | `docs/libspectrum-doc.txt` |
| F11 | MAME source (BSD-3-Clause files, read for facts only): `src/devices/bus/spectrum/intf1.cpp`, `exp.cpp`, `src/devices/imagedev/microdrv.cpp/.h`; software list `hash/spectrum_microdrive.xml` (CC0) | https://github.com/mamedev/mame/blob/master/src/devices/bus/spectrum/intf1.cpp , https://github.com/mamedev/mame/blob/master/hash/spectrum_microdrive.xml | IF1 ROM CRC32/SHA-1, v2 default, paging by fetch address, 2 drives, slot availability per model, QLAY MDV geometry, 73 Outlet MDRs | — |
| F12 | Commented disassemblies of `if1-1.rom`/`if1-2.rom` (dZ80, J. Hutcheson / G. Wearmouth, 2002–2004) — see `sources.md` [V1]/[V2] | https://k1.spdns.de/Vintage/Sinclair/82/Peripherals/Interface%201%20and%20Microdrives%20(Sinclair)/ROMs/ | checksum routine, FORMAT/CAT behaviour, channel layout, report texts and printing, header vars HD_00…HD_11 | `docs/IF1 v1 rom source.txt`, `docs/IF1 v2 rom source.txt` |
| F13 | G. Carri, *Spectrum Shadow ROM Disassembly* (Melbourne House), transcription — see `sources.md` [GC] | (same folder as F12) | edition 1 vs 2: PEEK 23729 test, serial > 87315, appendix of changes, two label tables | `docs/Spectrum Shadow ROM Disassembly (Carri).txt` |
| F15 | ZEsarUX: `src/Changelog`, `src/FEATURES`, repository tree | https://github.com/chernandezba/zesarux | microdrive features (v12, Jan 2025), RMD, acceleration (v13), ships IF1 ROMs, test images | `docs/zesarux-*.txt` |
| F16 | "Changes and additions to the Interface 1 ROM" (IMC ROM notes) | https://spectrumcomputing.co.uk/zxdb/sinclair/entries/1001157/IMCI1ROM(EN).txt | IF1 out-of-memory crash path, 16 KB extended ROM | `docs/imc-if1rom.txt` |
| F17 | Martin Korth (nocash), *Sinclair ZX Specifications* | https://problemkaputt.de/zxdocs.htm | paging addresses, ports, "IN 0 crash" WAIT | `docs/nocash-zxdocs.htm/.txt` |
| F19 | RZX format specification | https://worldofspectrum.net/RZXformat.html | what RZX records (fetch counts, IN values), embedded snapshots | — |
| F20 | vDriveZX product page | https://www.tindie.com/products/charlieingley/vdrive-zx-microdrive-hardware-emulator/ | MDR origin, compatibility with Fuse/Spectaculator images, 8 drives | — |
| F21 | ZXPicoMD (Tom Dalby), README | https://github.com/TomDDG/ZXPicoMD | 8 drives, 50–100 ms response window, 127 KB blank, v2-only testing, ROM-check cartridges, TAP copy | — |
| F22 | OqtaDrive README (Codeberg; GitHub repo is a redirect stub) | https://codeberg.org/xelalexv/oqtadrive | formats MDR/MDV/MDI/RMD, Z80/SNA/TAP load, auto-save, COMMS CLK power-on quirk | `docs/oqtadrive-README.md` |
| F23 | Dataserve Retro, "Sinclair Interface 1 & Microdrive" | https://www.dataserve-retro.co.uk/contents/en-uk/d6.html | model support up to grey +2, ROM check, v2 fixes, QL cartridges | — |
| F24 | Wikipedia, "ZX Interface 1" (CC BY-SA 4.0) | https://en.wikipedia.org/wiki/ZX_Interface_1 | firmware revisions, +2 OK, +2A/+3 incompatible | — |
| F25 | *Popular Computing Weekly*, 15–21 March 1984 (Retro Isle transcription) | https://retroisle.com/sinclair/zxspectrum/Articles/pcw_15mar_1984.php | Sinclair's claim of no compatibility problems between old/new ROMs (search snippet only) | — |
| F26 | Cliff Lawson (Amstrad), "Amstrad ROM permissions", comp.sys.sinclair, 31 Aug 1999 — quoted in the RPM Fusion commit below and in Debian's copyright file | https://lists.rpmfusion.org/pipermail/rpmfusion-commits/2008-July/000816.html , https://groups.google.com/g/comp.sys.amstrad.8bit/c/HtpBU2Bzv_U/m/HhNDSU3MksAJ | permission terms; IF1/2 not Amstrad's | `docs/rpmfusion-fuse-roms-2008.html` |
| F27 | RPM Fusion `fuse-emulator-roms` package (nonfree) | (as F26) | distribution practice | (as F26) |
| F28 | *Sinclair User*, July 1987, "Spectrum +3: too little too late too dear?" (Retro Isle) | https://www.retroisle.com/sinclair/zxspectrum/Articles/sinclairuser_jul87.php | +3 not IF1-compatible; Microdrive rights incl. IF1 ROM stayed with Sinclair | — |
| F29 | Debian `spectrum-roms` file list | https://packages.debian.org/sid/all/spectrum-roms/filelist | ships `if1-2.rom` | — |
| F30 | Debian `spectrum-roms` copyright file (non-free, 20081224-5) | https://sources.debian.org/data/non-free/s/spectrum-roms/20081224-5/debian/copyright | IF1 ROM "© 1983 Sinclair Research Ltd" without Amstrad note | `docs/debian-spectrum-roms-copyright.txt` |
| F31 | jonsole/ql-emulator README | https://github.com/jonsole/ql-emulator | QL ROMs "never formally licensed" (analogy only) | — |
| F32 | WoS FAQ "Emulators – Microsoft Windows" (Spectaculator 6.1 entry, 2004) and spectaculator.com | https://worldofspectrum.net/faq/emulators/windows.htm , https://www.spectaculator.com/ | Spectaculator IF1/RS-232/8 drives/drive noise/bundled cartridges | `docs/wos-emu-windows.htm/.txt` |
| F33 | Spectrum Computing forum thread (IF1 ROM versions, ZXC4) | https://spectrumcomputing.co.uk/forums/viewtopic.php?p=59389 | v1 buggy, no v3, ZXC4 remark (search snippet only) | — |
| F34 | Spectrum Computing ZXSR review of the Spectrum 128 | https://spectrumcomputing.co.uk/zxsr.php?id=1000488 | "apart from Interface One", 128 RAM-disk commands (search snippet only) | — |
| F35 | Paul Farrow, "Spectrum 128 Extended BASIC – Method of Operation" | https://homepages.plus.net/fruitcake/Sinclair/Spectrum128/ExtendedBASIC/Spectrum128ExtendedBASIC.htm | ROM 0 → ROM 1 error path through RAMRST/`RST 08H`; IF1 system-variable placement | `docs/farrow-128-extbasic.htm/.txt` |
| F36 | Paul Farrow, Spectrum 128 ROM 0 bug list | https://homepages.plus.net/fruitcake/Sinclair/Spectrum128/ROMDisassembly/Files/Disassemblies/Spectrum128_ROM0_BugList.txt | IF1-only editor bug (Toni Baker) proving IF1 works in 128 BASIC | `docs/farrow-128rom0-buglist.txt`, index page `docs/farrow-128rom-uk.htm` |
| F37 | Sinclair Wiki, "ZX Spectrum +2A/2B, +3/3B edge connector" | https://sinclair.wiki.zxnet.co.uk/wiki/ZX_Spectrum_+2A/2B,_+3/3B_edge_connector | ROMCS removed, two ROM OE lines, no +9 V | — |
| F38 | Wikipedia, "Timex Computer 2048" | https://en.wikipedia.org/wiki/TC2048 | edge connector compatibility (search snippet only) | — |
| F39 | "The Series 1 Interface Add-In for Timex version of the Warajevo 2.51 emulator" | https://timexsinclair.com/document/the-series-1-interface-add-in-for-timex-version-of-the-warajevo-2-51-emulator/index.html | specially adapted IF1 for TS2068 (search snippet only) | — |
| F40 | Sinclair Spectrum 128 Service Manual; Paul Farrow, "ZX Interface 2 – Circuitry" | https://worldofspectrum.net/pub/sinclair/technical-docs/ZXSpectrum128K_TechnicalManual.pdf , http://www.fruitcake.plus.com/Sinclair/Interface2/Interface/Interface2_Circuitry.htm | external ROMCS disables the 128's ROM; /ROMCS removed on +2A/+3 (search snippets) | — |
| F41 | Sinclair, *ZX Microdrive and Interface 1: Useful Hints and Tips* (OCR 2004) | https://spectrumcomputing.co.uk/pub/sinclair/hardware-info/z/ZXMicrodriveAndInterface1-UsefulHintsAndTips.pdf | "Microdrive not present" causes, "Writing to a 'read' file", NEW before tape MC, "drive test" file | `docs/ZXMicrodriveAndInterface1-UsefulHintsAndTips.pdf` |
| F42 | SpecEmu site | https://specemu.zxe.io/ | no IF1 information found | — |
| F43 | "ZX Spectrum Expansion System, Recreated" (jpralves.net write-up of Derek Fountain's project) | https://jpralves.net/post/2023/08/10/zx-spectrum-expansion-system-recreated.html , https://github.com/derekfountain/zx-spectrum-pico-interface-one | Pico IF1 hardware emulator; RS-232/net not implemented | — |
| F44 | zxmdr (`mdr.pl`), MIT | https://github.com/mattsteeldue/zxmdr | MDR tool features, 254 sectors, one unusable sector | — |

Test-material URLs (Spectrum Computing entries, MAME list, ZEsarUX tests) are listed inline in
`test-material.md`.

## Licence notes on the sources

- Wikipedia and Sinclair Wiki: CC BY-SA 4.0 — facts restated in our own words, no text copied.
- MAME files cited are BSD-3-Clause (software list CC0); read only for facts (CRC values, behaviour).
- Fuse/libspectrum, ZEsarUX, Z80onMDR_Lite, ZXPicoMD, OqtaDrive and the Pico IF1 are GPL —
  **only their documentation** was read; no code.
- The IF1 disassemblies (F12, F13) are fan/commercial works: used for behaviour only; they must
  not feed any Klive ROM sidecar (D4 rule).
