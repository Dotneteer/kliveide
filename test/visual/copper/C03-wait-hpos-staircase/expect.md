WAIT with a non-zero horizontal field. Paper starts black; then WAIT(96,8)→green, WAIT(104,16)→red,
WAIT(112,24)→blue, WAIT(120,31)→yellow, WAIT(128,0)→black.

**Should see** (buffer coordinates): black rows 48-143. On each change row the colour switches
part-way across: row 144 at x≈224 (black→green), row 152 at x≈352 (green→red), row 160 at x≈480
(red→blue), row 168 at x≈592 (blue→yellow). The rows below each change row are the new colour across
the whole paper. Rows 176-239 black. Together the edges form a staircase stepping right by 128 px
every 8 rows.

**Must not see:** change rows that switch colour at the very left of the paper (the edge in the
wrong place), or edges at x 16H−164 — the signature of comparing against the raw horizontal counter.

Hardware: WAIT fires when hc_ula >= H*8+12 (copper.vhd) and hc_ula = paper x + 12
(zxula_timing.vhd: hc_ula resets at c_min_hactive−12), so the change is at paper x = 8H.

**Buffer geometry** (Klive, calibrated by C00/T00): paper row r = buffer row 48+r; paper x = buffer
x 96+2x. **Copper geometry** (hardware): copper line L = paper row L−$64 (mod 311, wrapping into the top
border); WAIT(L,H) fires at paper x = 8H, i.e. buffer x 96+16H. MOVE and the palette lookup add under
two ULA pixels of delay, so horizontal edges are probed with a 4-px margin.

Source: _input/next-fpga/src: copper.vhd (WAIT/MOVE), video/zxula_timing.vhd (cvc, hc_ula), zxnext.vhd (NextRegs, palette, mixer).
