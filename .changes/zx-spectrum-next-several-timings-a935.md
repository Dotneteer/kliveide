---
type: fix
---

ZX Spectrum Next: several timings differed from the Next's FPGA core. `NEXTREG reg,A` took
14 T-states instead of 17; an NMI requested through NextReg $02 was taken one instruction late;
`IN` and `OUT` acted at the end of the I/O cycle instead of in its middle, so a program read the
line counter, the interrupt flag, the CTC counter and the floating bus too early; the CPU took the
frame and line interrupts 1 T-state too early, and their pulses were half a T-state too long; a
switch to Pentagon timing raised an extra interrupt; the line counter jumped to the new timing's
values in the first frame after a timing change; a CPU speed change took effect at the wrong
moment; +3 memory contention was decided 1 T-state late; and the DMA handed the bus over and back
at the wrong moments, timed prescaled and burst transfers short, missed interrupt flags during a
long transfer and let an NMI that broke into a transfer run one instruction late. Each now matches
the simulated FPGA source to the T-state, checked by probe programs run on both, and 877 of the 893
replayed Next hardware test programs now end in the same state on both, against 728 before.
