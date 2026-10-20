---
type: feature
---

**Bit-7 text and fill regions in annotations:** mark a table of strings whose last character has bit 7 set — such as the ZX Spectrum ROM's keyword and message tables — with **Mark As Bit-7 Text (.defc)**, and the Disassembly view lists one `.defc "TEXT"` row per string; mark padding or unused space with **Mark As Fill (.fillb)**, and each run of one repeated byte is a single `.fillb 1170,$FF` row. Every region kind a machine supports — Text, Bit-7 Text, Fill, and Copper and DMA on the Next — is now in both annotation menus, the Disassembly view's row menu and the NEX/ROM annotation editor's, and in the region dialogs, whose type choices now sit in two rows. Export as source writes `.defc` and `.fillb` and still reassembles byte for byte; the SkoolKit export writes them as `DEFM "AB","C"+128` and `DEFS 1170,$FF`, and the SkoolKit import now reads both forms. Bit-7 text is offered on every machine but the ZX80 and ZX81.
