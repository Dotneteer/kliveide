Border colour 0 is drawn with palette entry 16 — the same entry PAPER 0 uses (zxula.vhd: border
attribute "00"&b&b with pixel_en forced to 0 → index 16+n). The copper writes entry 16: black at the
restart, red from WAIT(48,0), blue from WAIT(144,0). Paper is PAPER 7 (entry 23, never written).

**Should see:** paper white (#B6B6B6) everywhere. The **border** changes colour: top border (rows
0-47) blue — they are displayed after the last MOVE of the previous frame and before the restart;
left border black on rows 49-96, red 97-192, blue 193-239; right border black on rows 48-95, red
96-191, blue 192-239 (the left border of a WAIT change row still has the previous colour, because
that change happens at paper x 0); bottom border (rows 240-287) blue.

**Row 48 (copper line 0, the restart row):** mode 11 restarts the list when `vcount_i = 0 and
hcount_i = 0` (copper.vhd, "restart at frame start"), i.e. at `hc_ula` 0 = paper x −12 = buffer x 72,
not at paper x 0. So row 48's left border is blue up to buffer x ~73 and black from there (plus the
same under-two-pixel MOVE/palette delay: black from x 74).

**Must not see:** a border that stays black, or any change inside the paper.

**Buffer geometry** (Klive, calibrated by C00/T00): paper row r = buffer row 48+r; paper x = buffer
x 96+2x. **Copper geometry** (hardware): copper line L = paper row L−$64 (mod 311, wrapping into the top
border); WAIT(L,H) fires at paper x = 8H, i.e. buffer x 96+16H. MOVE and the palette lookup add under
two ULA pixels of delay, so horizontal edges are probed with a 4-px margin.

Source: _input/next-fpga/src: copper.vhd (WAIT/MOVE), video/zxula_timing.vhd (cvc, hc_ula), zxnext.vhd (NextRegs, palette, mixer).
