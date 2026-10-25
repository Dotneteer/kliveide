---
type: fix
---

ZX Spectrum Next: the CPU set some flags the way a Zilog Z80 does, not the way the Next's own FPGA
CPU (the T80N) does. `BIT n,(HL)`, `BIT n,(IX+d)`, `IN r,(C)`, `LD A,I`, `LD A,R`,
`CPI`/`CPD`/`CPIR`/`CPDR`, the block I/O instructions and the Z80N block copies (`LDIX`, `LDDX`,
`LDIRX`, `LDDRX`, `LDPIRX`) now set the same flags as the hardware, and `IN r,(C)` sets parity.
`PIXELDN` now wraps at the bottom pixel row as the hardware does, and the undocumented `ED B6` runs
as `LDIRX` instead of doing nothing. All 115,854 cases of a new CPU comparison against the simulated
FPGA source now match.
