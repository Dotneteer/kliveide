---
type: feature
issues: [1460]
---
**Editing ROM annotations:** a ROM's labels, comments and regions are edited in a working copy
that replaces the shipped annotations for that ROM: in Klive's home folder (`RomAnnotations/`) for
a ROM Klive ships, where it survives updates, or beside your own ROM file as `<file>.dis`. Make
one with `rom-ann-new` or **Start Editing ROM Annotations...** on a ROM row's context menu, and
open it with **Open ROM Annotations**, `rom-ann-open` or by opening the `.rom.dis` file: the ROM
annotation editor finds the ROM by its bytes and opens its pages with the same annotation menu and
shortcuts as a NEX bank, with no machine running. Once a working copy exists, ROM rows in the live
Disassembly view can be edited too. A **Ready** chip (or `rom-ann-check`) says whether the file
passes the checks of a shipped annotation file, **Next unlabelled** steps through the calls and
jumps that still have no label, and `rom-ann-provenance` marks an entry as `observed` or `manual`.
