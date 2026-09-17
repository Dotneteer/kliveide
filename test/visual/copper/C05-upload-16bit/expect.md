The list of C02, uploaded through NextReg $63 instead of $60. With $63 an even-address write only
latches the byte and the odd-address write commits both bytes, MSB first (zxnext.vhd $63 handling).

**Should see:** exactly the C02 picture — black, red, green, blue, yellow, cyan, purple, white bands
of 24 rows each from buffer row 48; white border.

**Must not see:** anything different from C02 — a byte-order mistake scrambles every WAIT/MOVE.

**Buffer geometry** (Klive, calibrated by C00/T00): paper row r = buffer row 48+r; paper x = buffer
x 96+2x. **Copper geometry** (hardware): copper line L = paper row L−$64 (mod 311, wrapping into the top
border); WAIT(L,H) fires at paper x = 8H, i.e. buffer x 96+16H. MOVE and the palette lookup add under
two ULA pixels of delay, so horizontal edges are probed with a 4-px margin.

Source: _input/next-fpga/src: copper.vhd (WAIT/MOVE), video/zxula_timing.vhd (cvc, hc_ula), zxnext.vhd (NextRegs, palette, mixer).
