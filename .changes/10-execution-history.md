---
type: feature
issues: [1445]
highlight: "**Reverse debugging on every Z80 machine:** step back, reverse-continue to the last breakpoint hit, take over in the past, and save the session as a `.klr` debug recording."
---
**Execution History on every Z80 machine:** **Debug › Execution History** (or `show-history`)
lists the last instructions the CPU ran in a debug session: 131,072 on the Next and 65,536 on the
other machines. Each row shows the bank and address, the bytes that actually ran, the disassembly,
the source line, and the registers and flags the instruction changed. A HALT wait, a ZX80/ZX81
display line and a Next DMA bus hold are each one row with a count, and **Fold interrupts** turns
each interrupt service into one expandable row. Click a row for the full registers before and
after it and the memory map at that time; double-click it to go to its source. A plain **Start**
records nothing.
