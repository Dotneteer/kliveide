---
type: feature
highlight: "**The Enterprise 64 and 128**, the British home computer, with EXOS and IS-BASIC."
---

**The Enterprise 64 and 128:** Klive emulates the British home computer as the Enterprise 128 (EXOS
2.1, IS-BASIC 2.1) and the Enterprise 64 (EXOS 2.0, IS-BASIC 2.0), with the NICK video chip drawing
its picture slot by slot from the line parameter table, the clock stretch on video memory, DAVE's
stereo sound, interrupts and memory paging, and the keyboard and joysticks. The on-screen keyboard
is drawn from the machine, with the word processor's label strip and the built-in joystick. Klive's
`FILE:` device lets BASIC `LOAD` and `SAVE` files in a folder on your computer (Machine › Open FILE:
Folder). Programs load from `.tap` and `.wav` tapes, fast or in real time, and `SAVE` writes `.tap`
files; the EXDOS floppy interface (Machine › EXDOS Floppy Interface) reads and writes `.img` disks.
The assembler takes `.model ENTERPRISE`: Run and Debug load the program at `$0100` through EXOS's
own loader, Export writes a `.com` file, and a new project template prints a welcome. Debugging
(with EXOS's `RST 30h` calls named and stepped over), the NICK and DAVE panels, the EXOS variables,
the IS-BASIC listing, the memory panel's 256 segments, execution history, reverse debugging, code
coverage, state files, the Z80 unit-test runner and `klive run` work as on the other machines.
