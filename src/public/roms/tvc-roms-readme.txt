Videoton TV Computer ROMs (tvc12-*.rom, tvc22-*.rom, tvc-vtdos.rom)

These are the system ROMs of the Videoton TV Computer (TVC), the Hungarian
home and school computer Videoton made in the second half of the 1980s: the BASIC 1.2 ROMs of
the TVC 64K and the BASIC 2.2 ROMs of the TVC 64K+. The rights belong to
Videoton, or to its successors.

No explicit permission to redistribute them is known. They are included,
unmodified, because the TVC community has published them openly for many
years, so that the emulated machine works without the user having to find
them. They will be removed on request from a rights holder.

Source: the rtvc emulator's repository (https://github.com/teki/rtvc, commit
3c2a993b941f04ed9861f0f00170dfa7cf2ba22a, roms/). Taken on 2026-10-27. Every
image matches the CRC32 and SHA1 of the corresponding MAME set (tvc64,
tvc64p BIOS v2.2).

  Klive file      Original file    Contents
  tvc12-d4.rom    TVC12_D4.64K     BASIC 1.2 system ROM, low 8K of SYS (C000-DFFF)
  tvc12-d3.rom    TVC12_D3.64K     BASIC 1.2 system ROM, high 8K of SYS (E000-FFFF)
  tvc12-d7.rom    TVC12_D7.64K     BASIC 1.2 extension ROM, EXTH (E000-FFFF in EXT)
  tvc22-d6.rom    TVC22_D6.64K     BASIC 2.2 system ROM, low 8K of SYS
  tvc22-d4.rom    TVC22_D4.64K     BASIC 2.2 system ROM, high 8K of SYS
  tvc22-d7.rom    TVC22_D7.64K     BASIC 2.2 extension ROM, EXTH
  tvc-vtdos.rom   VT-DOS12-DISK.ROM  VT-DOS, the HBF floppy interface card's 16K ROM

tvc-vtdos.rom is the ROM of Videoton's HBF floppy disk interface card. rtvc's file
name says version 1.2; its CRC32 and SHA1 are those of MAME's tvc_hbf "vtdos11"
image (d_tvcdos.128, VT-DOS v1.1). Its rights belong to Videoton, as above.

Sizes and CRC32s are checked by test/machines/tvc-rom-images.test.ts.
This notice must be retained.
