Demo-style raster (catalogue PAR-005): a line interrupt, the copper, a sprite and a Layer 2 scroll in
one picture. The main oracle is core parity (TypeScript vs WASM) and, in the browser tier, the
headless-vs-browser comparison; the probes pin the parts whose position the hardware fixes.

**Should see:**
- **Border bars.** The copper (restarted every frame, `$62` = `$C0`) sets palette entry 16 - PAPER 0,
  which is also border 0 - black at the restart, then `$F3` / `$13` alternately at WAIT(0,0),
  WAIT(16,0), ... WAIT(176,0), and black again at WAIT(192,0). Copper line L is buffer row 48 + L,
  and WAIT(L,0) fires at buffer x 96 of that row (the new colour shows from x 98: the MOVE and the
  palette pipeline add a pixel), so the right border (x 612-715) shows 16-row bars
  from row 48 to 239: `$F3` on rows 48-63, `$13` on 64-79, and so on; the bottom border (rows
  240-287) is black - except row 240 left of x 96, which keeps `$13`: the left border changes one row
  later than the right, because the WAIT fires at x 96.
- **Layer 2 stripes.** 256x192 Layer 2 (bank 9), every pixel `x & $F0`, palette entry 16k = stripe
  colour k: sixteen 16-pixel stripes (32 buffer pixels each, from buffer x 96). The frame interrupt
  sets the X scroll (`$16`) to the frame counter, so the top part scrolls one pixel per frame; the line
  interrupt at line 96 (`$22`/`$23`; zxula_timing.vhd: it fires at hc_ula 255 of line 95, the end of
  its paper) sets it back to 0. The program runs at 28 MHz (`$07` = 3), so the handler's `$16` write
  lands in the blanking before line 96 is drawn: from row 144 (line 96) down the stripes stand still
  in their unscrolled places (probed on rows 144-239, 4-pixel margins), and no line is split. (At
  3.5 MHz the write fell mid-line, where it showed the CPU's start phase - which a real NextZXOS load
  does not fix to the T-state.)
- **A sprite.** One white 16x16 sprite (sprite palette entry 1 = `$FF`) at sprite X 132 (paper x 100,
  buffer x 296-327), Y = 32 + (frame & 63): its top moves down one row per frame through buffer rows
  48-111 and wraps. Sprites are above Layer 2 (`$15` = `$01`, SLU).

**Must not see:** stripes that move from row 144 down, a row split between the two scrolls, bars at other rows, a sprite that stands still or
jumps, or anything but black in the bottom border.

Source: _input/next-fpga/src: copper.vhd, video/zxula_timing.vhd, video/layer2.vhd,
video/sprites.vhd, zxnext.vhd.
