Enterprise 64/128 ROMs (ep-*.rom)

These are the system ROMs of the Enterprise 64 and 128, developed by Intelligent
Software Ltd for Enterprise Computers Ltd (UK, 1984-85): the EXOS operating
system (with the built-in word processor), the IS-BASIC cartridge and the EXDOS
disk system ROM. After the UK company was wound up, the German company
Enterprise Computers GmbH took over the rights and kept the machine going for more
than ten years.

Permission: the Hungarian Enterprise community (enterpriseforever.com) holds
permission from Werner Lindner, former managing director of the German company,
to use and modify this software freely under fair use, on two conditions:
  - no money may be asked for it, and
  - the names of the original development companies must not be removed.
This was reported to the Klive author on the Hungarian forum on 2026-10-30. The
images are included unmodified, and every copyright notice in them is intact.
They will be removed on request from a rights holder.

Source: the ROMs embedded in the libretro port of ep128emu
(https://github.com/libretro/ep128emu-core, branch "core", roms/roms.hpp), which
are the same images that the ep128emu installer offers to download. Taken on
2026-10-30.

  Klive file        ep128emu file  Size  CRC32     Contents
  ep-exos20.rom     exos20.rom     32K   d421795f  EXOS 2.0 (Enterprise 64), segments 00h-01h
  ep-exos21.rom     exos21.rom     32K   982a3b44  EXOS 2.1 (Enterprise 128), segments 00h-01h
  ep-basic20.rom    basic20.rom    16K   1228de34  IS-BASIC 2.0 cartridge, segment 04h
  ep-basic21.rom    basic21.rom    16K   55f96251  IS-BASIC 2.1 cartridge, segment 04h
  ep-exdos13.rom    exdos13.rom    32K   e0135929  EXDOS 1.3 disk ROM, conventionally segments 20h-21h

Cross-checks:
  - ep-exos20.rom and ep-exos21.rom match the CRC32 and SHA1 of MAME's ep64 and
    ep128 BIOS images (9256ds-0038_enter05-23-a.u2, 9256ds-0019_enter08-45-a.u2).
  - ep-basic21.rom matches MAME's ep64_cart "BASIC (v2.1, alt)" and the MD5 that
    the Batocera and RetroBat BIOS lists give for basic21.rom; ep-exos21.rom
    matches their exos21.rom MD5.
  - ep-basic20.rom is not in MAME's lists.
  - ep-exdos13.rom differs from MAME's exdos13.rom (CRC32 d1d7e157). Both carry
    the "EXDOS version 1.3" banner; which one is the unmodified original is not
    known yet.

ep-klive-fileio.rom is not one of these ROMs: it is Klive's own EXOS extension ROM for its FILE:
device, assembled by Klive from src/emu/machines/enterprise/fileio/ep-klive-fileio.asm
(test/machines/ep-fileio-rom.test.ts checks the image against the source).

Sizes and CRC32s are checked by test/machines/ep-rom-images.test.ts.
This notice must be retained.
