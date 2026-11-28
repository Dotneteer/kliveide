---
type: feature
highlight: "**SAM Coupé ROM annotations:** ROM 3.0 and 3.1, both 16K pages, named and explained to level 2."
---

**SAM Coupé ROM annotations:** ROM 3.0 and 3.1 are annotated to level 2. Every routine of ROM0 and
ROM1 is named and has a synopsis with its entry and exit conditions; data such as the keyword list,
the error messages and the font is marked as data; and both pages export as source that reassembles
to the ROM. Open them from Debug › ROM Annotations › SAM Coupé. The SAM's disassembly also lists
the data that follows a restart or a call as data: the calculator's operation bytes after `RST 28h`
and the ROM1 address after ROM0's `RST 30h`.
