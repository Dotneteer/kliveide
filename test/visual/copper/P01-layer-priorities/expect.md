Three layers in the paper area, and the copper switching NextReg `$15` (layer priorities, bits 4-2) per
band. ULA paper red (`$E0`), Layer 2 green (`$1C`) - in column D with the **Layer 2 priority bit** (set
with `$44`) - sprite blue (`$03`, one 16x16 pattern scaled x8 to 128x128), fallback `$4A` purple (`$A2`).

Columns (buffer x; probes keep 4 px from the edges): A 96-175 ULA only; B 176-335 ULA + L2;
C 336-495 ULA + L2 + sprite; D 496-559 ULA + L2(priority) + sprite; E 560-591 ULA + sprite.

**Should see** (buffer rows = paper row + 48), per band, colours of A | B | C | D | E:

| rows (paper) | `$15` | A | B | C | D | E |
|---|---|---|---|---|---|---|
| 40-59 | 000 SLU | red | green | blue | green | blue |
| 60-79 | 001 LSU | red | green | green | green | blue |
| 80-99 | 010 SUL | red | red | blue | green | blue |
| 100-119 | 011 LUS | red | green | green | green | red |
| 120-139 | 100 USL | red | red | red | green | red |
| 140-159 | 101 ULS | red | red | red | green | red |
| 160-163 | 110 blend | **purple** | yellow `#FFFF00` | blue | yellow | blue |
| 164-167 | 111 blend | **purple** | `#494900` | blue | `#494900` | blue |

Rows outside 40-167 are SLU; the sprite only covers rows 40-167.

**Border:** white, except in the two blend bands, where it is **purple** too: a border pixel is a ULA pixel,
and in a blend mode the ULA only reaches the output through the Layer 2 sum - Layer 2 does not cover the
border, so the fallback shows. The copper switches `$15` at paper x 0, so on the left border the purple
rows are 209-216 (row 208 is still SLU there, row 216 still blend) and on the right border 208-215.

**Why:** zxnext.vhd, the SLU-ordering process. In modes 000/010/100/101 a Layer 2 pixel with the priority
bit wins over everything; 001/011 put Layer 2 first anyway. In the blend modes the ULA does not appear on
its own: it is only the `mix_rgb` operand of the Layer 2 sum (`$68` blend bits 00 = ULA), so where Layer 2
is transparent and no sprite is opaque the output stays the fallback colour. Mode 110 adds and clamps
per 3-bit channel (red 7 + green 7 -> yellow); mode 111 adds and subtracts 5 (sum <= 4 -> 0, sum >= 12 ->
7), so red+green gives 2,2,0 = `#494900`. Sprites come before the blend sum unless Layer 2 has priority.

**Must not see:** the ULA red in column A of the blend bands, a fixed layer order in every band, or
column D differing from green / the blend sum.
