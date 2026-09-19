Fallback colour $4A = $E0 (red); no Layer 2, sprites or tilemap. The copper writes the global
transparency colour $14: $E3 at the restart (nothing on screen matches), $00 from WAIT(96,0). The ULA
pixel is transparent when its 8-bit colour equals $14 (zxnext.vhd ula_transparent), and a pixel with
no opaque layer shows the fallback colour (zxnext.vhd mixer default).

**Should see:** black paper on rows 48-143; red paper on rows 144-239 (black PAPER 0 is now
transparent); white border throughout (#B6B6B6 ≠ $00, so it stays opaque).

**Must not see:** black paper below row 143, or red in the border.

**Buffer geometry** (Klive, calibrated by C00/T00): paper row r = buffer row 48+r; paper x = buffer
x 96+2x. **Copper geometry** (hardware): copper line L = paper row L−$64 (mod 311, wrapping into the top
border); WAIT(L,H) fires at paper x = 8H, i.e. buffer x 96+16H. MOVE and the palette lookup add under
two ULA pixels of delay, so horizontal edges are probed with a 4-px margin.

Source: _input/next-fpga/src: copper.vhd (WAIT/MOVE), video/zxula_timing.vhd (cvc, hc_ula), zxnext.vhd (NextRegs, palette, mixer).
