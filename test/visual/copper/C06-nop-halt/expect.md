List: black; NOP ($0000); MOVE to register 0 with value $55; NOP; WAIT(96,0); NOP; green; HALT
($FFFF = WAIT line 511); red.

**Should see:** paper black on rows 48-143, green on rows 144-239; white border.

**Must not see:** red anywhere (the MOVE after the HALT must never run: line 511 never occurs); any
effect of the register-0 MOVE (copper.vhd: no write pulse when the register field is 0).

**Buffer geometry** (Klive, calibrated by C00/T00): paper row r = buffer row 48+r; paper x = buffer
x 96+2x. **Copper geometry** (hardware): copper line L = paper row L−$64 (mod 311, wrapping into the top
border); WAIT(L,H) fires at paper x = 8H, i.e. buffer x 96+16H. MOVE and the palette lookup add under
two ULA pixels of delay, so horizontal edges are probed with a 4-px margin.

Source: _input/next-fpga/src: copper.vhd (WAIT/MOVE), video/zxula_timing.vhd (cvc, hc_ula), zxnext.vhd (NextRegs, palette, mixer).
