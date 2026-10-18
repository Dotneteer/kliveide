---
type: feature
issues: [1448]
---
**Export as source:** **Export as Source...** on the Disassembly view's or a bank document's tools
button, or `export-asm`, writes an annotated range or a whole bank as Klive Z80 assembly, then
reassembles the file and reports whether the result is byte-identical. Encodings that would not
assemble back to the same bytes are written so that they do.
