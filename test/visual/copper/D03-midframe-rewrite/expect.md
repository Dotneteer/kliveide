Two bands: A from copper line 48 (buffer rows 96-191), B from line 144 (rows 192-239); rows 48-95
black. Every frame, while the beam is on line 96 — after the copper has executed band A's MOVE but
before it reaches band B's WAIT — the CPU writes the same new colour into both MOVEs, alternating red
and blue.

**Should see:** A and B always have **different** colours (one red, one blue), swapping every frame.
Band B shows the colour written in this frame; band A shows it only in the next frame. In the contact
sheet each tile's band A equals the previous tile's band B.

**Must not see:** A and B the same colour, or A changing before B. That would mean the rewrite
reached an instruction the copper had already executed in this frame.

A copper program is RAM read at execution time (copper.vhd fetch from list address), so a write
takes effect only for instructions not yet executed. **Geometry:** copper line L = buffer row 48+L; paper x = buffer x 96+2x (see C00).

Source: _input/next-fpga/src: copper.vhd, video/zxula_timing.vhd, zxnext.vhd.
