The C00 program with NextReg $64 = 16. The hardware loads cvc with $64 at the first paper line
(zxula_timing.vhd), so paper row r has copper line r+16 and WAIT(96) fires on paper row 80.

**Should see:** paper black on rows 48-127; green from row 128; the red ULA marker line still on row
144 (the ULA is not affected by $64), green again below it to row 239. White border.

**Must not see:** the green edge on row 144 (offset ignored) or on row 160 (offset applied the wrong way).

**Buffer geometry** (Klive, calibrated by C00/T00): paper row r = buffer row 48+r; paper x = buffer
x 96+2x. **Copper geometry** (hardware): copper line L = paper row L−$64 (mod 311, wrapping into the top
border); WAIT(L,H) fires at paper x = 8H, i.e. buffer x 96+16H. MOVE and the palette lookup add under
two ULA pixels of delay, so horizontal edges are probed with a 4-px margin.

Source: _input/next-fpga/src: copper.vhd (WAIT/MOVE), video/zxula_timing.vhd (cvc, hc_ula), zxnext.vhd (NextRegs, palette, mixer).
