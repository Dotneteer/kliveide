Eight copper bands, 24 lines each: at the restart and at WAIT(24k, 0) the copper writes palette
entry 16 (PAPER 0) with $40/$41. Mode 11 restarts the list at line 0 of every frame.

**Should see**, paper area x 96-607, top to bottom (buffer rows): black 48-71, red 72-95, green
96-119, blue 120-143, yellow 144-167, cyan 168-191, purple (#B600B6) 192-215, white 216-239. White
border all round (index 23 is never written). The same picture in every frame.

**Must not see:** a band edge off by a row, any band the wrong colour or order, colour in the border,
a picture that is one solid colour (that would be end-of-frame state, not a copper).

Colours are the 8-bit values written to $41, expanded to 9 bits as `v & (v1 or v0)`
(zxnext.vhd nr_palette_value). $E3 is avoided: it is the default global transparency colour.

**Buffer geometry** (Klive, calibrated by C00/T00): paper row r = buffer row 48+r; paper x = buffer
x 96+2x. **Copper geometry** (hardware): copper line L = paper row L−$64 (mod 311, wrapping into the top
border); WAIT(L,H) fires at paper x = 8H, i.e. buffer x 96+16H. MOVE and the palette lookup add under
two ULA pixels of delay, so horizontal edges are probed with a 4-px margin.

Source: _input/next-fpga/src: copper.vhd (WAIT/MOVE), video/zxula_timing.vhd (cvc, hc_ula), zxnext.vhd (NextRegs, palette, mixer).
