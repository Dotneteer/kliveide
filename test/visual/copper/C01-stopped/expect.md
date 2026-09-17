A copper list is uploaded (it would turn PAPER 0 green, then red from line 96) but $62 stays at
mode 00.

**Should see:** white border, black paper, nothing else — identical in every frame.

**Must not see:** green or red anywhere. Mode 00 keeps the copper stopped (copper.vhd: execution only
when copper_en /= "00").

Source: _input/next-fpga/src: copper.vhd (WAIT/MOVE), video/zxula_timing.vhd (cvc, hc_ula), zxnext.vhd (NextRegs, palette, mixer).
