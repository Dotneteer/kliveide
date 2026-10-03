# TVC BASIC 1.2 ROM listings

These are standalone, assembler-readable listings for the three 8 KiB ROM
images used by the TVC 64K BASIC 1.2 profile. The ROM image is the byte-level
source of truth. The two reference books supply the routine names, data-table
boundaries, explanations, and comments, which are rewritten and embedded in
the generated ASM rather than left as external reading requirements.

## Listings

| Chip image | Physical bank | Physical offset | Canonical CPU origin | Other CPU-visible address |
| --- | --- | ---: | ---: | ---: |
| [TVC12_D4.64K.asm](TVC12_D4.64K.asm) | SYS | `0000H` | `C000H` | `0000H` during page-0 SYS mapping |
| [TVC12_D3.64K.asm](TVC12_D3.64K.asm) | SYS | `2000H` | `E000H` | `2000H` during page-0 SYS mapping |
| [TVC12_D7.64K.asm](TVC12_D7.64K.asm) | EXTH | `0000H` | `E000H` | — |

`D3` and `D7` deliberately remain separate even though both can be visible at
`E000H-FFFFH`: they are different physical banks selected by different TVC
memory-map states. The named mapping on the `ORG` line at the top of each
listing records the alternate CPU address without emitting extra bytes.

## How to read a listing

- `ORG` is the CPU-visible address used for labels, absolute operands, and
  relative branches.
- `ORG address, map-name, mapped-address` records a named transformation from
  the canonical CPU address to an alternate CPU-visible address. It is
  assembler metadata and emits no bytes.
- `DB` regions are tables, strings, copied RAM initialization bytes, character
  matrices, or other data that must not be decoded as instructions.
- `Lxxxx` labels are mechanical branch/call targets. Named labels are curated
  routine or table landmarks.
- Rich routine blocks include purpose, algorithm, inputs, outputs, side
  effects, destroyed state, and important implementation notes where known.

## Verifying

The listings are maintained directly as standalone source files. Assemble
them with `rtvc-asm` and compare the binary output with the corresponding ROM
image:

```text
rtvc-asm --format bin --origin C000H roms/TVC12_D4.64K.asm -o /tmp/TVC12_D4.64K.bin
rtvc-asm --format bin --origin E000H roms/TVC12_D3.64K.asm -o /tmp/TVC12_D3.64K.bin
rtvc-asm --format bin --origin E000H roms/TVC12_D7.64K.asm -o /tmp/TVC12_D7.64K.bin
```

Mapping entries are preserved in TOML output as `[[mappings]]` metadata but do
not change binary output. The separate
[rom_symbols_1_2.json](rom_symbols_1_2.json) file is the emulator debugger's
BASIC 1.2 symbol database; it is generated from these listings by
`cargo xtask rom-symbols` (curated prose is merged by bank and offset), not
hand-maintained.

When a book diagram and a ROM byte disagree, retain the ROM byte and record the
uncertainty in an ASM comment. Do not repair executable bytes by copying OCR
text directly.
