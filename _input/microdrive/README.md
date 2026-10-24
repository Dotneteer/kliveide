# ZX Interface 1 + Microdrive — research pack

Collected 2026-10-24 as input for a future plan (`.plans/MICRODRIVE_PLAN.md`, not written yet):
attach an Interface 1 with one or two Microdrives to the Spectrum models that can take one.
Everything in the `.md` files is written in our own words, with a citation on every fact.
Inferred or disputed points are flagged inline. The original documents are in `docs/`. They are
text, HTML or PDF only: no ROM images, binaries or archives were downloaded.

## Files

| File | What it covers |
|---|---|
| [interface1-hardware.md](interface1-hardware.md) | Ports `$E7`/`$EF`/`$F7` bit by bit, A3/A4-only decoding and its conflicts ("IN 0 crash"), the shadow-ROM paging rule, WAIT, the drive-select shift register, timing |
| [microdrive-media.md](microdrive-media.md) | Tape loop, preamble, 15-byte header and 528-byte record, checksum, free/used/bad marking, FORMAT in v1 and v2, channel and map layout |
| [interface1-rom-behaviour.md](interface1-rom-behaviour.md) | How the ROM is entered (RST 8, `$1708`), hook codes `$1B`–`$34`, the 58 new system variables, BASIC extensions, routine addresses (v1/v2), a checklist of what the emulator must reproduce, report codes |
| [interface1-other-features.md](interface1-other-features.md) | RS232 and ZX Net (with stub recommendations); behaviour with no drive, no cartridge or a bad cartridge |
| [mdr-and-file-formats.md](mdr-and-file-formats.md) | The `.mdr` image (254 × 543 + 1 write-protect byte = 137,923 bytes), files and records, a worked hex example, other sizes/formats, conversion tools |
| [snapshot-and-state-formats.md](snapshot-and-state-formats.md) | `.z80` hardware modes and byte 36, `.szx` `IF1\0` and `MDRV` blocks, `.sna` (no IF1 field), RZX |
| [interface1-rom-versions-and-licensing.md](interface1-rom-versions-and-licensing.md) | ROM v1 and v2, CRC32/SHA-1, differences and how to tell them apart, **licensing** |
| [model-compatibility.md](model-compatibility.md) | Which models work with an IF1, how it behaves with the 128K and its editor ROM |
| [emulator-survey.md](emulator-survey.md) | How Fuse, Spectaculator, ZEsarUX, MAME and others present microdrives (behaviour only) |
| [test-material.md](test-material.md) | Cartridge software and MDR images (URLs only), BASIC test scripts T1–T12 with expected output and error texts |
| [klive-integration-survey.md](klive-integration-survey.md) | Where an IF1 fits in Klive's code: DivMMC-classic and Beta 128 as templates, media, write-back, state, timing, tests, docs, roadmap |
| [sources.md](sources.md), [sources-formats.md](sources-formats.md) | Bibliographies with licences (hardware/ROM, then formats/compatibility) |

## Key facts at a glance

- **Hardware.** The IF1 decodes only A3/A4: `$E7` is data, `$EF` control/status, `$F7` RS232/net.
  An 8K ROM is paged over `$0000` by an instruction fetch at `$0008` or `$1708`. A fetch at `$0700`
  pages it out after that instruction. Each `$E7` access holds WAIT until a byte is ready, at about
  one byte per 48 µs (~168 T). The drive is chosen through an 8-stage shift register, clocked by
  COMMS DATA/CLK. The selected drive's motor runs.
- **Media.** Each sector is a 15-byte header and a 528-byte record. The checksum is the sum mod 255.
  FORMAT numbers sectors from 254 down. A loop is ~7–8 s long, with about 180 usable sectors.
- **Models.** 16K/48K, Spectrum+, 128K and the grey +2 work. The +2A/+2B/+3 do not, since they have
  no ROMCS. IF1 commands also work from 128 BASIC. In Klive that means `sp48` and `sp128` (model
  `sp128`), not `spp3e`. Pentagon, Scorpion and Timex are open (§ Decisions).
- **ROM licence.** The Amstrad permission does **not** cover the IF1 ROM: the rights stayed with
  Sinclair Research. So Klive cannot simply ship it. The likely route is the TR-DOS/esxDOS pattern
  (a user-supplied ROM in Settings, plus an assembled stand-in ROM for tests).
- **Klive fit.** Use DivMMC-classic as the shadow-ROM template, one C file shared by the 48K and
  128K cores. Use Beta 128 for media, write-back and the media strip. Model the drive lazily (tape
  position from the tact count, like the tape EAR bit and the WD1793). New absolute tacts go into
  ShiftTactOrigin. `$E7` clashes with the DivMMC, so the two are mutually exclusive or need a
  decoding decision. MAME's `intf1.cpp`/`microdrv.cpp` is BSD-3 and was read for behaviour only.
  No GPL emulator code was read.

## Decisions the plan must make

1. **ROM:** user-supplied only, v1 and/or v2, a CRC check, and a stand-in test ROM?
2. **Models:** only 48K (incl. 16K/NTSC) and 128K/+2, or also Pentagon/Scorpion/Timex?
3. **Drives:** exactly two (as asked), or up to eight like Fuse?
4. **IF1 with DivMMC:** mutually exclusive?
5. **RS232/ZX Net:** stub them (ports read idle), or emulate them?
6. **Timing:** real speed only, or an accelerated mode? (Every emulator surveyed uses port-level
   emulation with the real ROM; none traps ROM routines.)
7. **Cartridge files:** write `.mdr` back like `.trd`; New/Format blank cartridge; write-protect;
   an `.mdr` file system for the Disk Explorer and the `disk` CLI verb?
8. **Snapshots:** read and write `.z80` modes 1/4/5 and byte 36, and `.szx` `IF1`/`MDRV` (both
   are skipped today).
9. **Provenance:** the commented IF1 disassemblies in `docs/` are for behaviour facts only. They
   must not feed any future IF1 ROM-annotation sidecar (rule D4).

## Open questions research could not settle

- GAP bit polarity: the ROM logic implies 1 = gap/no signal, but one disassembly's comments read it
  the other way.
- Data rate: about 12 µs per bit per track (OqtaDrive, Sinclair Wiki), against Wikipedia's 15 KB/s.
- Full port decoding beyond A3/A4, and what unused status bits read. What appears at
  `$2000`–`$3FFF` while the shadow ROM is paged (MAME mirrors the 8K).
- Which COMMS CLK edge shifts the drive select (MAME uses falling). WAIT behaviour on a read in
  write mode. The meaning of BUSY.
- Real gap lengths: Ian Logan's *Spectrum Microdrive Book* would settle them, but it is not freely
  online.
- Free space shown by CAT on a fresh 254-sector image (derived as 126K on v2 and 127K on v1). PROG
  with the IF1 attached (derived as 23813). Units of `.szx` `wDrivePos`. All three need checking
  against a reference emulator before they become test expectations.
- Whether any 128K editor-ROM code runs from `$0008`/`$1708` while ROM 0 is paged.
