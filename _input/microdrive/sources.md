# Sources: Interface 1 hardware and ROM behaviour

This bibliography covers `interface1-hardware.md`, `microdrive-media.md`,
`interface1-rom-behaviour.md` and `interface1-other-features.md`. All URLs were accessed on
2026-10-24. "Local copy" means a copy saved in `_input/microdrive/docs/`. Only documentation was
downloaded: **no ROM images, executables or archives**. Some files in `docs/` were downloaded by
the other research agent (file formats, ROM licensing and models). They are listed at the end for
completeness.

Provenance note for the plan: [GC], [V1] and [V2] are commented disassemblies of Sinclair's
copyrighted ROM. They are used here only to describe *behaviour*, and no code is copied into Klive.
Running the real ROM in the emulator is a licensing question for the other agent's notes.

## Primary references (used heavily)

| Tag | Title | URL | Contents | Licence / status | Local copy |
|---|---|---|---|---|---|
| [GC] | Gianluca Carri, *Spectrum Shadow ROM Disassembly* (Melbourne House, 1985), text transcription | https://k1.spdns.de/Vintage/Sinclair/82/Peripherals/Interface%201%20and%20Microdrives%20(Sinclair)/ROMs/Spectrum%20Shadow%20ROM%20Disassembly.txt | Full commented listing of **ROM edition 1**. Hook codes, system variables, channel layout, and appendix 7 on the edition 2 differences and how to tell the editions apart | Commercial book, © 1985 Melbourne House / the author. A freely hosted transcription. Read for facts only; do not redistribute in the product | `docs/Spectrum Shadow ROM Disassembly (Carri).txt` |
| [V2] | "IF1 v2 rom source", dZ80 disassembly of `if1-2.rom`, commented by John Hutcheson and Geoff Wearmouth (2002–2004) | https://k1.spdns.de/Vintage/Sinclair/82/Peripherals/Interface%201%20and%20Microdrives%20(Sinclair)/ROMs/IF1%20v2%20rom%20source.txt | Commented **ROM v2** with labels and addresses. The source of all v2 addresses, timeouts, FORMAT v2 and READ-BLK/WR-BLK | Fan disassembly of a Sinclair/Amstrad ROM. No licence stated. Describe its behaviour only | `docs/IF1 v2 rom source.txt` |
| [V1] | "IF1 v1 rom source", same project, ROM v1 | https://k1.spdns.de/Vintage/Sinclair/82/Peripherals/Interface%201%20and%20Microdrives%20(Sinclair)/ROMs/IF1%20v1%20rom%20source.txt | v1 cross-check (`$0700` RET, `$1708`) | as [V2] | `docs/IF1 v1 rom source.txt` |
| [SM] | *Servicing Manual for ZX Microdrive, Interface 1 and Interface 2*, Thorn EMI Datatech for Sinclair Research, Oct 1985 | https://k1.spdns.de/Vintage/Sinclair/82/Peripherals/Interface%201%20and%20Microdrives%20(Sinclair)/ZX%20Interface%20I%20and%20Interface%20II%20Service%20Manual.pdf (mirror: https://spectrumforeveryone.com/wp-content/uploads/2017/08/ZX-Interface-1-2-Microdrive-Service-Manual.pdf) | Block diagram description, IC roles, 8 MHz gate array clock, the port table, ROM paging via IC3/IC1, IORQ gating (Q10), RS232/net circuit, drive shift-register select, write-protect polarity, FM recording, service tests | © Sinclair Research 1985. Freely hosted scan. A second edition (`Service Manual #2.pdf`, 1 MB) is in the same folder and was not downloaded | `docs/ZX Interface I and Interface II Service Manual.pdf` and text extracted with PDFKit: `docs/ZX Interface I and Interface II Service Manual (extracted text).txt` (diagram pages have no text) |
| [UM] | *ZX Interface 1 and ZX Microdrive* user manual (Sinclair), HTML transcription | https://k1.spdns.de/Vintage/Sinclair/82/Peripherals/Interface%201%20and%20Microdrives%20(Sinclair)/ZX%20Interface%20I%20and%20Microdrive%20Manual.html | BASIC syntax, system variables (App. 2), channel/map layout (App. 3), RS232 pinout (App. 4), all reports (App. 5), extended BASIC summary (App. 6) | © Sinclair Research. Freely hosted transcription. A PDF scan is in the same folder | `docs/ZX Interface I and Microdrive Manual.html` |
| [SW] | Sinclair Wiki, "ZX Interface 1" | https://sinclair.wiki.zxnet.co.uk/wiki/ZX_Interface_1 | Port bit table, signal meanings, drive edge connector pinout, performance figures (80 kbit/s per track), logic-analyser captures of header and record, checksum explanation | **CC BY-SA 4.0** (page footer) | `docs/sinclair-wiki-ZX_Interface_1.wiki.txt` (raw wikitext) |
| [IO] | "if1 i/o addresses.txt", in "Tech specs" | https://k1.spdns.de/Vintage/Sinclair/82/Peripherals/Interface%201%20and%20Microdrives%20(Sinclair)/Tech%20specs/if1%20i:o%20addresses.txt | Paging addresses `$0008`/`$1708`/`$0700`. **WAIT on `$E7` until 8 bits are collected ("IN 0 crash")**. Bit tables | Anonymous note from c. 1999 (probably from the comp.sys.sinclair FAQ). No licence stated | `docs/if1 io addresses.txt` |
| [NC] | Martin Korth, no$zx "ZX Specifications" | https://problemkaputt.de/zxdocs.htm | I/O map with masks (A4/A3), "memory mapped ports" = opcode fetches at `$0008`/`$1708`/`$0700`, IF1 bit tables | © Martin Korth, freely published | `docs/nocash-zxdocs.txt` / `.htm` (downloaded by the other agent) |

## Secondary references

| Tag | Title | URL | Used for | Licence / status | Local copy |
|---|---|---|---|---|---|
| [MAME] | MAME `src/devices/bus/spectrum/intf1.cpp` and `src/devices/imagedev/microdrv.cpp` | https://github.com/mamedev/mame/blob/master/src/devices/bus/spectrum/intf1.cpp · https://github.com/mamedev/mame/blob/master/src/devices/imagedev/microdrv.cpp | Behaviour only: page-in *before* the opcode fetch at `$0008`/`$1708`, page-out *after* the fetch at `$0700`, `& 0x18` port dispatch (the IF1 port logic itself is a stub in MAME), select on the falling COMMS CLK edge, gap = 1 for erased tape and for no cartridge, QL timing (100 kbit/s per track, gap lengths) | **BSD-3-Clause** (file headers). Code was read, not copied | not saved (source code) |
| [OQ] | OqtaDrive (Alexander Vollschwitz), `doc/technical.md`, README, `doc/network.md` | https://codeberg.org/xelalexv/oqtadrive/src/branch/master/doc/technical.md · https://codeberg.org/xelalexv/oqtadrive · https://oqtadrive.org | Measurements from a hardware drive emulator attached to a real IF1: **12 µs IF1 vs 10 µs QL cycle**, COMMS CLK idles high on the IF1, 8/16 clocks for select/deselect, v2 FORMAT's long records. Network bridging | Project is **GPL-3.0**. Docs used for facts only | `docs/oqtadrive-technical.md` |
| [WOS] | WoS FAQ, "Hardware Ports" | https://worldofspectrum.org/faq/reference/ports.htm | Port masks: IF1 `---0 0---`/`---0 1---`/`---1 0---`; Kempston `000- ----` | WoS FAQ, freely published | — |
| [MDFS] | J.G. Harston, "Spectrum I/O map" | https://mdfs.net/Docs/Comp/Spectrum/SpecIO | "Interface 1 … selected with A3 and A4". Port table | Freely published | — |
| [SCF] | Spectrum Computing forum, "ZX Microdrive internal format" | https://spectrumcomputing.co.uk/forums/viewtopic.php?t=12229 | Preamble not passed to the CPU; flow controlled by WAIT (Kiwi, citing the *Spectrum Microdrive Book* p.39); ZEsarUX author's raw-format approach | Forum posts | — |
| [WIKI] | Wikipedia, "ZX Microdrive" | https://en.wikipedia.org/wiki/ZX_Microdrive | Tape 5 m × 1.9 mm, 76 cm/s, ~8 s loop, 15 KB/s, ≥ 85 KB | CC BY-SA 4.0 | — |
| — | Wikipedia, "ZX Interface 1" | https://en.wikipedia.org/wiki/ZX_Interface_1 | Background only (RS232 up to 19.2 kbit/s, firmware revisions) | CC BY-SA 4.0 | — |
| [WOSF] | WoS hardware feature article (Microdrive launch) | https://worldofspectrum.net/hardware/featb.html | 200 in loop, 7 s revolution, "almost 200 sectors", 100 KB theoretical, 85–90 KB practical, 27-byte header per block | Period magazine text, © original publisher | — |
| [FUSE] | Fuse man page `fuse.1` | https://sourceforge.net/p/fuse-emulator/fuse/ci/master/tree/man/fuse.1 | MDR length 10–254 blocks, "average real capacity is around 180 blocks (90 Kb)", RS232 FIFO options, no Sinclair Network emulation (for DISCiPLE) | Fuse is GPL-2. Documentation only, **no code read** | `docs/fuse-manpage.txt` (downloaded by the other agent) |
| — | Derek Fountain, "ZX Spectrum Expansion System Recreated" | https://www.derekfountain.org/zses.php | Pico-based IF1 recreation that uses /WAIT to gain response time. Not otherwise used | GPL project | — |
| — | k1.spdns.de `info.txt` (German) | https://k1.spdns.de/Vintage/Sinclair/82/Peripherals/Interface%201%20and%20Microdrives%20(Sinclair)/info.txt | Notes "6 m, 76 cm/s (grossly wrong!)", which casts doubt on the published tape speed | — | — |
| — | Spectrum Computing review of *Spectrum Microdrive Book* (Ian Logan) | https://blog.spectrumcomputing.co.uk/zxsr.php?id=2000365 | Confirms that the book (the authoritative IF1 reference, written by the ROM's co-author) exists. **No free online copy was found** | — | — |

## Worth downloading or reading later (not fetched)

- `ZX Interface I and Interface II Service Manual #2.pdf` (1 MB) and
  `Microdrive-IF1 Complete Rom Disassembly.pdf` (4.9 MB, Ross-Langley's *Spectrum Machine Code
  Reference Guide*), both in
  https://k1.spdns.de/Vintage/Sinclair/82/Peripherals/Interface%201%20and%20Microdrives%20(Sinclair)/
- `if1_v1982-disassembly.pdf`, `if1_v1983-disassembly.pdf` in `.../ROMs/` on the same site.
- Circuit diagrams (PNG/GIF images): `.../Tech specs/IF1 issue 4 circuit diagram.png`,
  `if1_sch.gif`, `Microdrive issue 4 circuit diagram.png`. They are worth opening to settle the
  decode question (§2.6 of the hardware notes). They were not downloaded because they are images,
  not text.
- Ian Logan, *The Spectrum Microdrive Book* (Melbourne House 1983). Its timing diagrams (p.39
  and around) would settle the GAP/SYNC polarity and the gap lengths. It is not freely available.

## Files in `docs/` downloaded by the other agent (listed for completeness)

`MicrodriveAndInterface1Manual.html`, `ZXMicrodriveAndInterface1-UsefulHintsAndTips.pdf`,
`mdr-zxsp.txt`, `szx-*.html`, `z80format.htm`, `fuse-manpage.*`, `nocash-zxdocs.*`,
`zesarux-*.txt`, `farrow-128*`, `wos-emu-windows.*`, `rpmfusion-fuse-roms-2008.html`,
`debian-spectrum-roms-copyright.txt`, `imc-if1rom.txt`.
