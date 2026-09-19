Tilemap 40x32 over red ULA paper, default layer order, fallback `$4A` purple. Tile 1 is solid tilemap
colour 1 (green `$1C`), tile 0 is transparent (pixel 0 = `$4C`). Tile rows 8-15 (paper rows 32-95) hold
tile 1 in three column groups: paper x 0-79 with attribute bit 0 = 0 (tilemap above the ULA), paper x
80-255 with bit 0 = 1 (below the ULA). In character rows 4-7, columns 20-31 (paper rows 32-63, x 160-255)
the ULA paper uses an entry equal to `$14`, so the ULA is transparent there. The copper turns stencil
mode (`$68` bit 0) on for paper rows 64-95.

**Should see** (buffer rows = paper row + 48):
- rows 48-79: ULA red (tile 0 is transparent).
- rows 80-111: **green** at x 96-255 (tilemap above ULA); **red** at x 256-415 (tilemap below an opaque
  ULA); **green** at x 416-607 (tilemap below a *transparent* ULA - the tilemap still shows).
- rows 112-143: **black** across the paper (stencil: ULA red AND tilemap green = 0), and the fallback
  **purple** wherever the tilemap has no opaque pixel - including the border, even outside the tilemap's
  320-pixel area (buffer x 0-31 and 672-719), where the tilemap is enabled but has no pixel at all.
- rows 144-239: ULA red.

**Must not see:** purple (fallback) at x 416-607 on rows 80-111 - that is a below-ULA tile being dropped
instead of merged; red in the stencil rows.

**Source:** zxnext.vhd `ulatm_rgb <= tm_rgb when (tm_transparent = '0') and (tm_pixel_below_2 = '0' or
ula_transparent = '1') else ula_rgb`; `stencil_rgb <= ula_rgb and tm_rgb` when both are opaque, used when
`ula_stencil_mode_2 = '1' and ula_en_2 = '1' and tm_en_2 = '1'`.
