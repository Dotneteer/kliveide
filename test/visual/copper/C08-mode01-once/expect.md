Mode 01: the pointer resets to 0 when the mode is entered and the list then runs without restarting
each frame (copper.vhd). List: red; WAIT(144,0); blue; HALT.

**Should see:** in every captured frame (all ≥ 50), the whole paper blue: the list ran once in the
first frame and has been parked on the HALT ever since. White border.

**Must not see:** a red top part (that would be a per-frame restart, i.e. mode 11 behaviour).

**Buffer geometry** (Klive, calibrated by C00/T00): paper row r = buffer row 48+r; paper x = buffer
x 96+2x. **Copper geometry** (hardware): copper line L = paper row L−$64 (mod 311, wrapping into the top
border); WAIT(L,H) fires at paper x = 8H, i.e. buffer x 96+16H. MOVE and the palette lookup add under
two ULA pixels of delay, so horizontal edges are probed with a 4-px margin.

Source: _input/next-fpga/src: copper.vhd (WAIT/MOVE), video/zxula_timing.vhd (cvc, hc_ula), zxnext.vhd (NextRegs, palette, mixer).
