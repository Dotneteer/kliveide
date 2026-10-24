ZX Interface 1 ROM (if1-2.rom)

This is the 8K shadow ROM of the Sinclair ZX Interface 1, second edition
("v2", fitted to units with serial numbers above 87315). It drives the
Microdrives, RS232 and the ZX Net and adds CAT, FORMAT, ERASE, MOVE, OPEN #
and SAVE */LOAD */VERIFY */MERGE * to Spectrum BASIC. The ROM carries the
notice "(c) 1983 Sinclair Research Ltd".

The rights belong to Sinclair Research Ltd, or to its successors. They are
not covered by Amstrad's permission to distribute the Spectrum ROMs: Amstrad
acquired the Spectrum 48/128 rights, and the Microdrive rights, the
Interface 1 ROM included, stayed with Sinclair Research.

No explicit permission to redistribute it is known. It is included,
unmodified, because emulators and distributions have published it openly
for decades (ZEsarUX ships it; Debian's spectrum-roms package carries it in
non-free), so that the emulated Interface 1 works without the user having
to find it. It will be removed on request from a rights holder. A user can
always name another Interface 1 ROM file in Klive's settings.

  Klive file    Edition    Size   CRC32      SHA1
  if1-2.rom     2 (v2)     8192   bb66dd1e   5cfb6bca4177c45fefd571734576b55e3a127c08

The first edition ("v1", CRC32 e72a12ae, SHA1
4ffd9ed9c00cdc6f92ce69fdd8b618ef1203f48e) is not shipped; a user can name
it in the settings. The two editions can be told apart from BASIC:
CLOSE #0: PRINT PEEK 23729 prints 0 with v1 and 80 with v2.

Taken on 2026-10-24 from a copy already on the author's machine. It matches
the CRC32 and SHA1 of MAME's "spectrum_intf1" v2 BIOS. Size, CRC32 and the
bytes at the paging addresses are checked by
test/machines/if1-rom-image.test.ts.
This notice must be retained.
