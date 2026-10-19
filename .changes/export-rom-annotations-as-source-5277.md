---
type: feature
---

**Export ROM annotations as source:** the ROM annotation editor's **Export as source…** button (and
the new `rom-ann-export` command) writes a whole ROM — every page its annotations name, with their
labels and comments — as one Klive Z80 assembly file, then assembles it and says whether it gives
back the ROM byte for byte, naming the first bytes that differ when it does not.
