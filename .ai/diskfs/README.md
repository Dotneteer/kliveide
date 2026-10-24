# Disk images, FAT and the DivMMC: facts for AI assistants

The plan (`DISK_IMAGES_AND_FILE_SYSTEMS_PLAN.md`) is done and retired; its record is in git history. Provenance (D8):
FAT from Microsoft's FAT specification, the DivMMC from the Next FPGA's VHDL (`_input/next-fpga/`),
the SD card from the SD Physical Layer specification. Never GPL code (cpmtools, hdfmonkey, Fuse,
ZEsarUX).

## Hard-disk images

- `.img`: raw sectors - an MBR (four primary entries at 446) or a whole-disk FAT volume (sector 0 is
  a boot sector: a jump, 512 bytes a sector, a power-of-two cluster size, $55AA).
- `.hdf` (RAMsoft): "RS-IDE", $1A, version, flags (bit 0: halved - only the low byte of each word;
  Klive refuses these), the data offset (u16 at 9; $216 for v1.1), the drive's IDENTIFY block at $16.
- `.cim`: Klive's own sparse container for the Next's card (`src/main/fat32/`).
- The FAT type follows from the cluster count: under 4085 FAT12 (unsupported), under 65525 FAT16.

## The DivMMC (from zxnext.vhd / divmmc.vhd)

- Port `$E3`: bit 7 CONMEM, bit 6 MAPRAM (sticky: a write ORs it in), bits 3-0 the bank. `$E7`
  selects the card (bit 0 low: card 0), `$EB` moves an SPI byte. All decoded on A7-A0.
- Mapped: $0000-$1FFF is the 8K ROM, or RAM bank 3 with MAPRAM, never writable; $2000-$3FFF the
  selected bank, read-only when MAPRAM is set and the bank is 3.
- Automap, reset configuration: NextRegs $B8=$83 (RST $00, $08, $38), $B9=$01 (only RST $00 without
  ROM 3), $BA=$00 (all delayed), $BB=$CD ($3Dxx instant with ROM 3, $1FF8-$1FFF unmap delayed,
  $0562 and $04C6 delayed with ROM 3, the NMI at $0066 delayed).
- "Instant" maps before the opcode fetch; "delayed" after the M1, so the opcode is the Spectrum ROM's
  and its operands the DivMMC's (esxDOS repeats the ROM's bytes there). An unmap at $1FF8-$1FFF is
  delayed too: an operand of the instruction fetched there comes from the Spectrum ROM.
- RETN (exactly ED 45) unmaps. An interrupt or NMI acknowledge is not an opcode fetch: no trap.
- ROM 3 means the 48K BASIC ROM is paged: always on the 48K, ROM 1 on the 128K, ROM 3 on the +3.
  With it, every IM 1 interrupt (RST $38) passes through the DivMMC.
