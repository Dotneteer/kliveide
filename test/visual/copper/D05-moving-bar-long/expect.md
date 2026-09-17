The D01 program, run for 3000 frames and sampled every 100 frames (only with `--long`).

**Should see:** in every sampled frame a single 8-row red bar whose top row is exactly 100 lines
(mod 184) lower than in the previous sample; the contact sheet shows frames 100-1600.

**Must not see:** drift (a position that is off by one or more rows from the 100-frame step), a
missing or doubled bar, or a bar of the wrong height.

**Geometry:** copper line L = buffer row 48+L; paper x = buffer x 96+2x (see C00).

Source: _input/next-fpga/src: copper.vhd, video/zxula_timing.vhd, zxnext.vhd.
