# Appendix D: Klive Z80 Assembly Quick Reference

> **Status:** Placeholder. This appendix will be filled in as the book stabilises and we identify exactly which Klive-specific syntax features are used most.

## Synopsis

A focused reference for the Klive Z80 assembly dialect (`.kz80.asm`), targeted at a reader who already knows another Z80 assembler (sjasmplus, Pasmo, z88dk). It covers only what differs from "vanilla" Z80 syntax and the directives the book actually uses.

Planned sections:

- **File and project structure.** Build root, includes, the `.kz80.asm` extension, multi-file projects.
- **Lexical conventions.** Comment styles, character literals, string escapes, the backtick (`` ` ``) prefix for local labels.
- **Number literals.** Hex (`$AB`, `0xAB`), binary (`%1010_1010`), decimal, the single-quote thousands-separator style.
- **Symbol definition.** `equ`, `=`, label vs. symbol scoping.
- **Data directives.** `.db` / `.defb`, `.dw` / `.defw`, `.defm`, `.defn`, `.ds` / `.defs`, `.dz`.
- **Origin and section directives.** `.org`, `.bank`, `.entry`, `.export`, `.disp`, the NEX-aware section primitives Klive adds for ZX Spectrum Next targets.
- **Macros.** `.macro` / `.endm`, parameter passing, local labels inside macros, `.foreach`, `.repeat`.
- **Conditional assembly.** `.if`, `.elif`, `.else`, `.endif`, `.ifdef`, `.ifused`.
- **Expression syntax.** Operator precedence, supported functions (`high`, `low`, `attr`, `len`, etc.), forward references.
- **Z80N extensions.** Mnemonics added by the Z80N (`mul d,e`, `swapnib`, `nextreg n,v`, `push imm16`, the `bsla`/`bsra`/`bsrl`/`bsrf`/`brlc` family, `jp (c)`, `ldws`, `ldix`, `lddx`, `ldirx`, `lddrx`, `ldpirx`, `outinb`, `add hl,a`, `add hl,bc`, `add hl,de`, `pixeldn`, `pixelad`, `setae`).
- **Built-in helpers used in the book.** `attr(...)`, `Ink(...)`, `Paper(...)`, `NewLine()`, the `_print*` family — what's part of the dialect vs. what comes from the standard project template.
- **Differences from sjasmplus.** A short side-by-side table for readers porting code in either direction.
