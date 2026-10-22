---
type: feature
---

**Export as source from a button and the Debug menu, always verified:** the Disassembly view and a
bank document have an **Export as source** button in their header, and **Debug › Export
Disassembly as Source...** does the same from the menu. Every export — these, the tools menu, a
named graphic's and the ROM annotation editor's — is assembled afterwards and the verdict is shown
in a message box: an error that names the first failing line or differing bytes when the file does
not give back the same bytes. The save dialog opens in an export folder — `SourceExports` in a
Klive project, `KliveExports/source` in your home folder otherwise — and remembers the folder you
choose in the project's settings, or in your user settings without a project
(`export.sourceFolder`). `export-asm` and `rom-ann-export` no longer take `-noverify`, and fail
when the check fails.
