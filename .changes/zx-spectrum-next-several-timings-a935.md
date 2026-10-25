---
type: fix
---

ZX Spectrum Next: several timings differed from the Next's FPGA core. `NEXTREG reg,A` took
14 T-states instead of 17; an NMI requested through NextReg $02 was taken one instruction late;
`IN` and `OUT` acted at the end of the I/O cycle instead of in its middle, so a program read the
line counter, the interrupt flag and the CTC counter 2 T-states early; the ULA and line interrupt
pulses were half a T-state too long; +3 memory contention was decided 1 T-state late; and a DMA
transfer handed the bus back to the CPU 2 T-states too early. Each now matches the simulated FPGA
source to the T-state, checked by probe programs run on both, and 822 of the 893 replayed Next
hardware test programs now end in the same state on both, against 728 before.
