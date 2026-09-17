Black paper with a band from copper line 96 (buffer row 144) to the bottom of the paper. Once per
frame (on line 250) the CPU writes the next of 8 colours into the band's $41 MOVE: red, green, blue,
yellow, cyan, purple (#B600B6), white, grey-blue (#9292B6), then again.

**Should see:** above row 144 the paper is black in every frame; below it, the band has a different
colour in each tile of the contact sheet, in that order. White border.

**Must not see:** the whole paper changing colour (that is end-of-frame palette state, not the copper),
a repeated or skipped colour, a band edge anywhere but row 144.

**Geometry:** copper line L = buffer row 48+L; paper x = buffer x 96+2x (see C00).

Source: _input/next-fpga/src: copper.vhd, video/zxula_timing.vhd, zxnext.vhd.
