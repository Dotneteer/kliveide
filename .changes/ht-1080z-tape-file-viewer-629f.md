---
type: feature
---

**HT-1080Z tape file viewer:** clicking a `.cas`, `.cmd` or tokenised `.bas` file shows what it
holds instead of its hex bytes - a summary (name, program or code, start address, play time,
whether it fits a 16K model), a timeline of the tape, a memory map of where it loads, and its parts
with their bytes explained field by field. BASIC programs are listed with their keywords picked
out, in the Series I, Series II or /64 characters, and every part pops out as a BASIC listing, a
disassembly or memory. A machine-code tape can be debugged from its start address - a button on
its tab, an Explorer entry, or the new `tape-load -e` - and clicking the summary's start address
selects the record that holds it. A `.bas` file is now an HT-1080Z program only when its content is a
tokenised one: BASIC source text with the same extension opens in the code editor, as in the other
machines' projects, and the HT-1080Z's deck refuses it with a clear message.
