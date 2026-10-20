---
type: feature
---

**The 128K editor ROM's calls into ROM 1 decoded:** in the ZX Spectrum 128K's editor ROM (ROM 0), `RST $28` calls a routine in the 48K BASIC ROM whose address follows the instruction. The Disassembly view, ROM annotation pages and Export as source now list that address as a `.defw` after the `RST $28` instead of decoding it as instructions, so the code after each call lines up. Likewise the report code after each `CALL $05AC`, the editor ROM's way of stopping with an error, is listed as a `.defb` with its error code. The 48K BASIC ROM keeps its own decoding of `RST $28` as the calculator.
