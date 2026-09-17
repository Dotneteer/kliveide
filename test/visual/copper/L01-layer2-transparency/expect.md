Layer 2 (256x192, bank 9) over ULA paper that is blue (PAPER 1, entry 17), default layer order SLU
(Layer 2 above the ULA), global transparency `$14 = $E3`, sprite transparency index `$4B = $05`.

The Layer 2 palette is reprogrammed so that palette *index* and *RGB* differ:
entry `$10` → RGB `$E3`; entry `$E3` → RGB `$1C` (green); entry `$05` → RGB `$05` (written explicitly:
the FPGA palette RAM has no reset contents, firmware fills it).

**Should see** (paper area, buffer rows 48-239):
- **x 96-255 (band A, pixel `$10`): blue ULA paper.** The pixel's RGB equals `$14`, so Layer 2 is
  transparent there and the ULA below shows.
- **x 256-415 (band B, pixel `$E3`): green `#00FF00`.** Its *index* is `$E3`, but its RGB is green, so it
  is opaque.
- **x 416-607 (band C, pixel `$05`): `#00246D`.** Its index equals `$4B`, which is the *sprite*
  transparency index and has no effect on Layer 2.
- White border all round (Layer 2 256x192 does not cover the border).

**Must not see:** magenta in band A (transparency tested on the index), blue in band B (index compared
with `$14`), or blue in band C (index compared with `$4B`).

**Source:** zxnext.vhd `layer2_transparent <= '1' when (layer2_rgb_2(8 downto 1) = transparent_rgb_2) or
(layer2_pixel_en_2 = '0')` - the comparison is on the palette-mapped RGB, and `$4B` is used only by the
sprite pipeline (`sprite_transparent_index`). Colours as written to `$41`: `v & (v1 or v0)`.
