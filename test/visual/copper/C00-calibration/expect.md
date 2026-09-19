Calibration of the copper → buffer mapping against the ULA itself.

**Program:** white border (index 23, never written), PAPER 0 everywhere. The ULA draws a full-width
INK 2 (red) line on pixel row 96 (display-file address $4880 — the display file is not linear, see ROM
PIXEL-ADD). The copper (mode 11) sets palette entry 16 (PAPER 0) to black at the restart and to green
($1C) at WAIT(96,0).

**Should see:** white border; paper black on buffer rows 48-143; a red line on row 144; green paper on
rows 145-239. The copper edge and the ULA marker are on the **same** row: copper line 96 is paper row
96, because the hardware loads cvc at the first paper line (zxula_timing.vhd, cvc process).

**Must not see:** the green edge above or below the red line; any change in the border.

**Buffer geometry** (Klive, calibrated by C00/T00): paper row r = buffer row 48+r; paper x = buffer
x 96+2x. **Copper geometry** (hardware): copper line L = paper row L−$64 (mod 311, wrapping into the top
border); WAIT(L,H) fires at paper x = 8H, i.e. buffer x 96+16H. MOVE and the palette lookup add under
two ULA pixels of delay, so horizontal edges are probed with a 4-px margin.

Source: _input/next-fpga/src: copper.vhd (WAIT/MOVE), video/zxula_timing.vhd (cvc, hc_ula), zxnext.vhd (NextRegs, palette, mixer).
