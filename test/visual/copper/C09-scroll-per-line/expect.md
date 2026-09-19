A black 8-pixel vertical bar in column byte 0 of every pixel row (INK 0 on PAPER 7). The copper
writes ULA X scroll ($26): 0 at the restart, 8 from line 48, 16 from line 96, 24 from line 144. The
ULA samples the scroll every 8 pixels (zxula.vhd px load at hc 3/B), so a mid-frame write shows from
the next character cell.

Scroll s shows source column (x+s) mod 256, so the bar (source x 0-7) appears at paper x 256−s.

**Should see** (buffer x, paper white): rows 48-95 bar at 96-111 (left edge); rows 97-143 bar at
592-607 (right edge); rows 144-191 at 576-591; rows 192-239 at 560-575 — a bar that jumps from the
left edge to the right edge and then steps left by 16 px every 48 rows. **Row 96 shows the bar twice**
(96-111 and 592-607): the WAIT fires at paper x 0, but the first 8-pixel cell of that row was latched
with the old scroll (0) just before, so it still shows source column 0; the rest of the row uses scroll
8. Rows 144 and 192 have the same one-cell lag, but there the old scroll shows no bar in the first cell.
White border.

**Must not see:** one straight bar over the whole height (end-of-frame scroll), or a bar in the border.

**Buffer geometry** (Klive, calibrated by C00/T00): paper row r = buffer row 48+r; paper x = buffer
x 96+2x. **Copper geometry** (hardware): copper line L = paper row L−$64 (mod 311, wrapping into the top
border); WAIT(L,H) fires at paper x = 8H, i.e. buffer x 96+16H. MOVE and the palette lookup add under
two ULA pixels of delay, so horizontal edges are probed with a 4-px margin.

Source: _input/next-fpga/src: copper.vhd (WAIT/MOVE), video/zxula_timing.vhd (cvc, hc_ula), zxnext.vhd (NextRegs, palette, mixer).
