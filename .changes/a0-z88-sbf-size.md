---
type: fix
issues: [1433]
key: "Cambridge Z88: no more noise below a small Screen Base File on the larger LCDs, the known issue of 0.63.0."
---
Cambridge Z88: on the 640x256, 640x320 and 640x480 LCDs, a small Screen Base File (such as OZ
V5.0B's 2K one) painted unrelated memory as noise below its last row. The Screen Base File now
runs from its page offset to the end of its bank, as in OZvm, the rows below it stay unlit, and
the Blink panel's tooltip sizes it the same way.
