Fallback colour $4A = $E0 (red). The copper writes $68: $00 (ULA on) at the restart, $80 (ULA
output disabled) from WAIT(96,0). Disabling the ULA makes every ULA pixel transparent — **border
included** — sampled per pixel (zxnext.vhd ula_en), so the fallback colour shows.

**Should see:** top border rows 0-47 red (still disabled from the previous frame's tail); rows 48-143
normal: white border, black paper - except the start of row 48: mode 11 restarts the list when
`vcount_i = 0 and hcount_i = 0` (copper.vhd, "restart at frame start"), i.e. at `hc_ula` 0 = paper
x −12 = buffer x 72, so row 48 stays red up to buffer x ~73 (plus the under-two-pixel MOVE delay:
white from x 74); row 144 white left border then red from paper x 0 across paper and
right border; rows 145-287 entirely red (border, paper, bottom border).

**Must not see:** a whole-screen red picture (the ULA never re-enabled at the restart), or a border
that stays white once the ULA is disabled.

**Buffer geometry** (Klive, calibrated by C00/T00): paper row r = buffer row 48+r; paper x = buffer
x 96+2x. **Copper geometry** (hardware): copper line L = paper row L−$64 (mod 311, wrapping into the top
border); WAIT(L,H) fires at paper x = 8H, i.e. buffer x 96+16H. MOVE and the palette lookup add under
two ULA pixels of delay, so horizontal edges are probed with a 4-px margin.

Source: _input/next-fpga/src: copper.vhd (WAIT/MOVE), video/zxula_timing.vhd (cvc, hc_ula), zxnext.vhd (NextRegs, palette, mixer).
