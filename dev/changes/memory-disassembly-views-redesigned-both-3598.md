---
type: feature
---

**Memory and Disassembly views, redesigned:** both views share a memory map of the current paging,
a partition row with a **Bank map** of every partition (the Z88's card slots and their mirrors, the
Next's pages with the screens, Layer 2 and the tilemap marked live), a register strip and an
inspector column. **Go to** takes an address, a register, a label or `PART:offset`, as do
`show-memory` and `show-disass`. The Memory view shows 8, 16 or 32 bytes a row, tags the registers
pointing into each row, marks the bytes changed since the previous stop, and lets you type over a
byte, select a range, and find byte patterns or text in the view or across every partition. The
Disassembly view draws flow arrows between jumps and their targets, counts each label's references,
finds text in the listing, folds an empty Z88 card slot into one row, and inspects the selected
instruction: its verdict, what its operands point at, its annotation and its breakpoint. The binary
file viewer and popped-out banks share the same toolbar, Find and inspector.
The viewers of state files, debug recordings, snapshots and RZX recordings show their facts in
aligned, collapsible sections, with the screen framed beside the summary.
