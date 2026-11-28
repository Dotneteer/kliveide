---
type: fix
---

Disassembly: one very long row, such as a message string in a ROM listing, widened the instruction
column for the whole listing and pushed every end-of-line comment off the screen. The column now
stops at 40 characters; a longer row ends with an ellipsis and shows its whole text in a tooltip.
