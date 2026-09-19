The copper sets PAPER 0 (palette entry 16) black at the restart and blue from WAIT(48,0). A line
interrupt on line 144 (NextReg $22 = %110: line interrupt on, ULA frame interrupt off; $23 = 144; IM2
with a 257-byte vector table) runs a handler that sets entry 16 red.

**Should see:** paper black on rows 48-95, blue on rows 96 to about 191, red from about row 192 to
the bottom of the paper; white border; identical every frame. The hardware raises the line interrupt at
the end of line 143 (zxula_timing.vhd, line interrupt at hc_ula 255 of the previous line), and the
handler needs about 80 T-states, so the red edge is within a row of 192 (rows 191-193 are not probed).

**Must not see:** no red at all, red above row 190, or blue below row 194.

**Geometry:** copper line L = buffer row 48+L; paper x = buffer x 96+2x (see C00).

Source: _input/next-fpga/src: copper.vhd, video/zxula_timing.vhd, zxnext.vhd.
