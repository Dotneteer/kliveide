---
type: fix
---

SAM Coupé: timing, video, interrupts, the disk controller and sound now match SimCoupé 1.2.17 in many
details, each found by a test program run in both emulators. The ASIC's memory and I/O contention
phases were wrong, so some instruction sequences ran up to 8 T-states slow in the border and loops on
screen lines up to 2% off. A palette, border or mode write showed one character cell late. ATTR and
the unused ports returned the next cell's bytes. A mode change inside a cell did not draw the ASIC's
artefact cell. Writing the same line number again ended a line interrupt. MIDI OUT's interrupt and
transmit flag came at the wrong time. The light-pen registers did not freeze when the screen was
switched off and read wrong on line 0. The disk controller set its spin-up status bit without a
spin-up. The beeper was a third too loud against the SAA 1099.
