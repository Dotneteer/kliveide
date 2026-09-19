A red 8-line bar on black paper. The copper list is fixed except for two WAIT lines; once per
frame, while the beam is on copper line 250 (not displayed), the CPU moves both one line down, wrapping
from line 183 back to 0. The CPU finds line 250 by polling NextReg $1F (cvc), no interrupts.

**Should see:** in each frame a single full-width red bar exactly 8 rows tall inside the paper, on
white border. In the contact sheet (frames 30-45, left to right, top to bottom) the bar is one row
lower in every tile — a smooth staircase; at the wrap it jumps from rows 231-238 to 48-55.

**Must not see:** frames where the bar does not move, moves 2 rows, is taller/shorter than 8 rows,
has a ragged edge, or is missing; red in the border.

$1F reads the copper line (zxnext.vhd, $1E/$1F readback = cvc). **Geometry:** copper line L = buffer row 48+L; paper x = buffer x 96+2x (see C00).

Source: _input/next-fpga/src: copper.vhd, video/zxula_timing.vhd, zxnext.vhd.
