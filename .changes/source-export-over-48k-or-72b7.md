---
type: fix
---

Source export: `export-asm` could write a file that did not assemble, or assembled to the wrong
bytes. A floating-point literal after `RST $28` in 48K or ZX81 ROM code was counted as one byte, an
end-of-line comment of more than one line had its second line written as code, and a relative jump
near `$FFFF` that wraps round to low memory was rejected by the assembler; it is now written as its
bytes.
