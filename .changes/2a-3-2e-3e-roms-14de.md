---
type: feature
---

**The +2A/+3 and +2E/+3E ROMs fully annotated:** the editor ROM (ROM 0), the syntax ROM (ROM 1) and the +3DOS ROM (ROM 2) of the ZX Spectrum +2A/+3, in the v4.0, v4.1 and Spanish versions, and of the +2E/+3E now have annotations at the same completeness as the 48K ROM's: every routine is labelled and described and its lines are commented, from start-up, the menus and the editor to +3 BASIC's commands, the disk operating system's calls, the floppy and hard disk drivers, and the +3E's streams, partitions and drive letters. Calls from one of these ROMs into another are listed with the address they pass as a `.defw`, so the code after them lines up, and Export as source reassembles each ROM byte for byte.
