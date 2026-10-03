# rtvc Assembler Reference

This document describes the helper Z80 assembler implemented in
[src/emulator/asm.rs](../src/emulator/asm.rs), the `rtvc-asm` command-line tool in
[src/bin/rtvc_asm.rs](../src/bin/rtvc_asm.rs), the ROM-oriented `rtvc-disasm`
tool in [src/bin/rtvc_disasm.rs](../src/bin/rtvc_disasm.rs), and the debugger
loading workflow in [scripts/rtvc_debug.py](../scripts/rtvc_debug.py).

The assembler is intentionally small. It is meant for debugger patches, TVC
helper routines, and Spectrum-porting shims, not as a full replacement for a
macro assembler.

## Entry Points

### Rust API

[src/emulator/asm.rs](../src/emulator/asm.rs) exposes two entry points:

- `assemble_line(source, pc)` assembles one instruction or `DB`/`DEFB` line at
  the given program counter.
- `assemble_program(source, origin)` runs the two-pass helper assembler and
  returns emitted segments, symbols, emitted source-line metadata, flattened
  bytes, and `next_addr`.

The TCP debugger uses `assemble_program` for its `assemble` command, so a single
debugger request may contain either one instruction or a small source block.

### Command Line

Assemble a helper source to TOML:

```bash
cargo run --bin rtvc-asm -- --origin 8000H helper.asm -o helper.toml
```

Use `-` as the input path to read source from stdin:

```bash
printf 'ORG 8000H\nSTART: NOP\n' | cargo run --bin rtvc-asm -- --origin 7000H -
```

Options:

| Option | Meaning |
| --- | --- |
| `--origin <addr>` | Initial assembly address before source-level `ORG`; defaults to `0`. |
| `--format <toml\|cas\|bin>` | Output format; defaults to `toml`. `cas` expects a single `BASIC_START` segment, and `bin` expects one contiguous segment. |
| `-d <NAME=VALUE>`, `--define <NAME=VALUE>` | Replace `%NAME%` placeholders in assembly code before assembly. Repeat for multiple values; a missing placeholder value is an error. |
| `-o <path>`, `--output <path>` | Write output to a file; omitted means stdout. |
| `-`, as input path | Read source from stdin. |

`<addr>` accepts decimal, `0x` hexadecimal, `$` hexadecimal, and `H`-suffixed
hexadecimal forms.

Build-generated values can be kept out of assembly sources with `%NAME%`
placeholders:

```asm
        LD BC,%BLOCK_SIZE%
```

```bash
rtvc-asm -d BLOCK_SIZE=0748H helper.asm -o helper.toml
```

Definitions are case-insensitive by name and substituted as text. Omitting
`-d BLOCK_SIZE=...` in this example fails with `missing definition for
%BLOCK_SIZE%`. Substitution applies only to assembly code: placeholders in
semicolon comments and quoted string literals are left unchanged. A semicolon
inside a quoted string is likewise not treated as the start of a comment.

### Disassembler Command Line

Disassemble a binary blob into `rtvc-asm` source:

```bash
cargo run --bin rtvc-disasm -- --origin C000H roms/TVC12_D4.64K -o roms/TVC12_D4.64K.asm
```

ROM symbol metadata and explicit data ranges can be supplied to keep known
tables as `DB` statements while emitting instructions for code:

```bash
cargo run --bin rtvc-disasm -- \
  --origin C000H \
  --symbols roms/rom_symbols_1_2.json \
  --comments roms/rom_comments_1_2.json \
  --bank sys --bank-offset 0000H \
  --data-range C003H-C228H \
  roms/TVC12_D4.64K -o roms/TVC12_D4.64K.asm
```

Options:

| Option | Meaning |
| --- | --- |
| `--origin <addr>` | CPU address for the first input byte; defaults to `0`. |
| `-o <path>`, `--output <path>` | Write assembly source to a file; omitted means stdout. |
| `--title <text>` | Add a listing title comment. |
| `--symbols <path>` | Load ROM labels and comments from a ROM symbol JSON document. |
| `--comments <path>` | Load address-keyed comments from a JSON document; may be repeated. |
| `--bank <name>` | Select a symbol bank such as `sys` or `exth`; required with `--symbols`. |
| `--bank-offset <addr>` | Physical bank offset corresponding to the first input byte. |
| `--data-range <start-end>` | Emit an inclusive CPU-address range as `DB`; may be repeated. |
| `-`, as input path | Read binary bytes from stdin. |

`rtvc-disasm` uses the emulator's own Z80 disassembler and checks each emitted
instruction against `assemble_line()`. Unsupported or boundary-crossing forms
fall back to `DB`, so generated files remain byte-exact assembler input. Branch
and call targets inside the input byte range are emitted as simple `Lxxxx`
labels, including targets that intentionally enter the middle of a linear
instruction.
Address comments are emitted as normal semicolon comments and do not affect
round-tripping.

### Debugger Client

Inside [scripts/rtvc_debug.py](../scripts/rtvc_debug.py):

```text
asm [addr]
asmfile helper.asm [origin]
loadasm helper.toml
```

- `asm` keeps the old one-instruction interactive patch workflow.
- `asmfile` sends a source file to the debugger assembler and writes the
  returned segments to mapped memory.
- `loadasm` loads `rtvc-asm-v1` TOML from disk and writes every segment to
  mapped memory.

## Source Format

Source is line-oriented. Semicolon comments are ignored except inside quoted
strings:

```asm
; comment
START:  LD HL,MSG   ; inline comment
MSG:    DB "OK",0
```

Labels use `name:` syntax and are case-insensitive. Stored symbol names are
uppercase. Valid label characters are ASCII letters, digits, `_`, and `.`; a
label must start with an ASCII letter, `_`, or `.`.

Supported directives:

| Directive | Forms | Notes |
| --- | --- | --- |
| `ORG` | `ORG expr[, map-name, mapped-address ...]` | Sets the current CPU assembly address. Each optional name/address pair declares a persistent address mapping from this origin. Multiple `ORG` directives create multiple output segments. |
| `BASIC_START` | `BASIC_START` | Emits a tokenized TVC BASIC autorun line at `19EFH`, pads to `1A30H`, and defines `BASIC_START` as the first machine-code instruction address called by `USR(6704)`. |
| `EQU` | `LABEL EQU expr` or `LABEL: EQU expr` | Defines a constant symbol. |
| `DB`, `DEFB` | `DB expr[, expr...]` | Emits bytes. String literals are also accepted. |
| `DW`, `DEFW` | `DW expr[, expr...]` | Emits little-endian 16-bit words. |
| `DS`, `DEFS` | `DS count[, fill]` | Emits `count` bytes, filled with zero or `fill`. |

String literals in `DB`/`DEFB` must be ASCII. Supported escapes are `\0`, `\n`,
`\r`, `\t`, `\\`, `\"`, and `\'`.

## Expressions

Expressions are intentionally limited:

- decimal numbers;
- `0x1234`, `$1234`, and `1234H` hexadecimal;
- `0b1010` and `1010B` binary;
- labels and `EQU` symbols;
- `$` as the current address;
- `label@map` address transformations;
- `+` and `-` operators.

There is no operator precedence beyond left-to-right `+`/`-`, and there are no
parenthesized arithmetic expressions. Parentheses are still used for Z80 memory
operands such as `(4000H)` and `(IX+2)`.

## Runnable TVC BASIC Programs

Use `BASIC_START` instead of `ORG` for small experiments that should load as an
autorun TVC BASIC program. The directive emits the same one-line bootstrap
shape used by `TVBALL.CAS`:

```asm
        BASIC_START

        LD A,02H
FLASH:  OUT (00H),A
        XOR 0AH
        JP FLASH
```

Assemble directly to CAS:

```bash
cargo run --bin rtvc-asm -- --format cas experiment.asm -o experiment.cas
```

Use `--format toml` when the emitted TOML should be loaded through the debugger
with `loadasm`, and `--format bin` when only the contiguous machine-code bytes
are needed.

## Instruction Coverage

The instruction encoder supports the Z80 forms currently implemented by
`assemble_line`, including:

- `LD`, `INC`, `DEC`;
- `ADD`, `ADC`, `SBC`, `SUB`, `AND`, `XOR`, `OR`, `CP`;
- `JP`, `JR`, `DJNZ`, `CALL`, `RET`, `RST`;
- `PUSH`, `POP`, `EX`, `EXX`;
- `IN`, `OUT`, `IM`;
- `BIT`, `RES`, `SET`, `RLC`, `RRC`, `RL`, `RR`, `SLA`, `SRA`, `SLL`, `SRL`;
- fixed forms such as `NOP`, `HALT`, `DI`, `EI`, `NEG`, `RETN`, `RETI`,
  `RRD`, `RLD`, `LDI`, `LDIR`, `LDD`, `LDDR`, `CPI`, `CPIR`, `CPD`, `CPDR`,
  `INI`, `INIR`, `IND`, `INDR`, `OUTI`, `OTIR`, `OUTD`, and `OTDR`.

Unsupported mnemonics or unsupported operand forms are errors. The assembler
does not implement macros, includes, conditional assembly, local-scope rules,
relocation records, listing files, or third-party assembler compatibility
syntax.

## TOML Output

`rtvc-asm` emits versioned TOML. The format is intended to be consumed by
future linker/injection tools without losing address or symbol information,
while remaining pleasant to inspect and annotate:

```toml
format = "rtvc-asm-v1"
source = "helper.asm"
requested_origin = 0x7000
origin = 0x8000
next_addr = 0x8009

[symbols]
MSG = 0x8006
START = 0x8000

[[segments]]
addr = 0x8000
len = 0x09
bytes = [
  0x21, 0x06, 0x80, 0xC3, 0x00, 0x80, 0x4F, 0x4B, 0x00,                       # |!.....OK.|
]
```

Fields:

| Field | Meaning |
| --- | --- |
| `format` | Always `rtvc-asm-v1` for this version. |
| `source` | Source path, or `-` for stdin. |
| `requested_origin` | CLI/API origin before any source-level `ORG`. |
| `origin` | Address of the first emitted segment, or the requested origin if nothing is emitted. |
| `next_addr` | Current assembly address after the final emitted statement or `ORG`. |
| `segments` | Addressed byte ranges. Multiple ranges appear when source uses non-contiguous `ORG` values. |
| `symbols` | Uppercase symbol names mapped to 16-bit values. |
| `mappings` | Named `ORG` transformations with `name`, `source_base`, and `mapped_base`. |
| `lines` | Emitted source lines with source line number, output address, and byte length. |

`segments[].bytes` is the canonical data for loaders. `segments[].len` must
match the length of `segments[].bytes`.

### Named address mappings

An `ORG` can declare one or more named transformations from its address space
to another address space:

```asm
ORG C000H, SYS0, 0000H, SYS1, 4000H

START:  JP MAIN@SYS0
MAIN:   NOP

ORG C100H
TABLE:  DW TABLE@SYS0, TABLE@SYS1, MAIN

ORG D000H, DATA0, 8000H
OTHER:  JP TABLE@SYS0
```

This captures `SYS0` as `C000H -> 0000H` and `SYS1` as `C000H -> 4000H`.
The mapping declaration emits no bytes. `START` is assembled at `C000H`,
`MAIN` at `C003H`, and `TABLE` at `C100H`. A mapped reference applies:

```text
label@map = label - source_base + mapped_base
```

Therefore the `DW` values are `0100H`, `4100H`, and `C003H`, producing the
little-endian bytes `00 01 00 41 03 C0`. The final jump uses `TABLE@SYS0`,
which is `0100H`, so it emits `C3 00 01`. `DATA0` captures `D000H -> 8000H`;
the later `ORG` does not alter any earlier mapping. Plain `TABLE` continues
to mean `C100H`.

Mappings are unique within one assembled module, and both an unknown mapping
reference and a duplicate mapping declaration are errors.

Mapping references can be used in any address expression accepted by the
assembler, including instruction operands, `EQU`, `DB`, and `DW` values.

For the TVC BASIC 1.2 ROM set, the common mappings are:

| Chip | Bank offset | Canonical CPU origin | Other CPU alias |
| --- | ---: | ---: | ---: |
| `TVC12_D4.64K` | `0000H` | `C000H` | `0000H` |
| `TVC12_D3.64K` | `2000H` | `E000H` | `2000H` |
| `TVC12_D7.64K` | `0000H` | `E000H` | — |

## Typical Workflow

1. Write a small helper source:

   ```asm
   ORG 8000H
   START:  LD HL,MSG
           JP START
   MSG:    DB "OK",0
   ```

2. Assemble it:

   ```bash
   cargo run --bin rtvc-asm -- --origin 7000H helper.asm -o helper.toml
   ```

3. Load it into the active machine through the debugger client:

   ```text
   rtvc> loadasm helper.toml
   ```

4. Use debugger commands such as `disasm`, `read`, breakpoints, and CPU stepping
   to inspect or execute the loaded helper.

## Error Behavior

Assembler errors include source line numbers for `assemble_program`:

```text
line 2: unknown symbol 'MISSING'
line 4: relative target 9000H is out of range from 8000H
```

`loadasm` validates that TOML has `format = "rtvc-asm-v1"`, at least one segment,
16-bit segment addresses, byte arrays containing integers in `0..255`, and
matching `len` values when present.
