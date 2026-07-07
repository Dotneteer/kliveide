# AI-Assisted ZX Spectrum Next ROM Disassembly Guide

This guide describes a repeatable way to turn the current generated ROM listings
into a high-quality commented disassembly. It is written for mixed human and AI
work: the AI can propose annotations, code/data boundaries, labels, and
cross-references, but every durable change should keep evidence and confidence
visible.

## Goals

- Produce readable, source-like listings for the ZX Spectrum Next ROM banks,
  Alt ROM banks, and NextMMC ROM.
- Produce Klive Z80 Assembler source files that compile back to byte-identical
  ROM binaries.
- Keep original addresses and opcode bytes in aligned comments so the source is
  useful as both assembler input and a reviewed disassembly listing.
- Separate executable code from tables, strings, vectors, padding, inline
  parameters, and embedded data.
- Replace generated labels with meaningful names when the routine purpose is
  known or strongly indicated.
- Preserve uncertainty instead of hiding it. A wrong but confident comment is
  worse than a small `TODO`.
- Build a project memory that future AI sessions can reuse.

## Source Material

Prefer evidence in this order:

1. Local generated listings in this folder:
   - `nextRom0.txt`, `nextRom1.txt`, `nextRom2.txt`, `nextRom3.txt`
   - `altRom0.txt`, `altRom1.txt`
   - `nextmmc.txt`
2. Local project references:
   - `_experiments/next-disassembly/next-api.txt`
   - `_experiments/next-disassembly/system-vars.txt`
   - `_input/NextZXOS_and_esxDOS_APIs.pdf`
   - `_input/zx-next-dev-guide-r3.pdf`
   - `_input/next-fpga/nextreg.txt` - essential for decoding NextReg reads,
     writes, bit meanings, and MMU/register side effects.
   - `_input/next-fpga/ports.txt` - essential for decoding I/O port reads and
     writes, including paging, DivMMC, ULA, DMA, and peripheral behavior.
   - `_input/next-fpga/src/device/*.vhd`
   - `_input/src/mame/sinclair/specnext*.{cpp,h}`
   - `docs/pages/z80-assembly/language-structure.mdx` for Klive label,
     identifier, and temporary-label syntax.
3. Related Spectrum ROM disassemblies already in `_input/`:
   - `Spectrum128_ROM0.asm`, `Spectrum128_ROM1.asm`
   - `Spectrum+3_V4-0_ROM0.asm` through `Spectrum+3_V4-0_ROM3.asm`
   - `CompleteSpectrumROMDisassemblyThe.pdf`
4. External references, when needed:
   - Official NextZXOS and esxDOS API documentation.
   - SpecNext wiki pages for hardware behavior, ports, NextRegs, and APIs.
   - Known esxDOS-compatible API references.
   - Public Spectrum ROM disassemblies and SkoolKit material.

When using an external source, record the URL and the exact fact learned in the
session notes. Do not copy large text blocks into the disassembly.

## Working Files

Keep separate files for separate kinds of knowledge:

- `nextRom*.txt`, `altRom*.txt`, `nextmmc.txt`: the annotated listings.
- Future `*.kz80.asm` files: Klive Z80 Assembler source that must round-trip to
  the original ROM bytes.
- `convert-disassembly-format.js`: helper script for converting current fixed
  column listings into the assembler-oriented format.
- `disassembly-notes.md`: durable project memory and facts learned.
- `system-vars.txt`: confirmed or suspected Next-specific system variables.
- `AI_ASSISTED_DISASSEMBLY_GUIDE.md`: this workflow.

If the project grows, add these small indexes:

- `labels.md`: confirmed names for ROM labels and why they are named that way.
- `data-ranges.md`: ranges reclassified as data, string tables, jump tables,
  inline parameters, or padding.
- `open-questions.md`: unresolved hypotheses that should be revisited.

## AI Session Protocol

Each AI disassembly pass should work on a bounded range, usually 32 to 128
source lines or one routine cluster.

Before editing:

1. Read the target range plus enough context before and after it to identify
   fall-through and local branches.
2. Search for every local label referenced by the range.
3. Search the other ROM banks, Alt ROM, and NextMMC listing for the same label
   name, same byte pattern, or same API address.
4. Check relevant references, especially the API list, system variable notes,
   Spectrum 128/+3 sources, NextReg list, and port list.
5. Record whether the range is definitely code, definitely data, or mixed.

While editing:

1. Rename labels only when the name is more informative than `Lxxxx`.
2. Use comments to explain intent, not the instruction syntax.
3. Mark uncertainty with `TODO`, `?`, or `Likely`, and explain what evidence is
   missing.
4. Convert mis-disassembled bytes to `.defb`, `.defw`, `.defm`, or `.defs`
   when control flow and references prove they are data.
5. Preserve addresses and opcode bytes in comments so binary verification and
   visual review remain possible.

After editing:

1. Add a short note to `disassembly-notes.md` with the range, conclusions,
   evidence, and unresolved questions.
2. If a reusable fact was learned, add it to the appropriate index or notes
   section.
3. Re-scan references to make sure label renames did not leave stale comments.

## Target Assembler Listing Format

The final maintained source should be valid Klive Z80 Assembler input and also
work as a readable disassembly. The executable source comes first; disassembly
metadata is kept in comments.

Preferred line shape:

```asm
LabelName
    instruction-or-directive                              ; 0008 C3 E0 15  explanation
```

Rules:

1. Labels start in column 1.
2. Labels do not use colons.
3. A label always occupies its own line.
4. The thing being labelled starts on the next line.
5. Instruction and data directive lines start with exactly 4 spaces.
6. The instruction/directive text after the 4-space indent uses a fixed
   28-character field, padded with spaces at the end.
7. Address and opcode bytes are comments, not source tokens.
8. The address/opcode metadata at the start of the comment uses a fixed
   16-character field, enough for a 4-digit address plus four opcode bytes:
   `AAAA xx xx xx xx`.
9. Semantic comments come after the address/opcode block, separated by enough
   space to scan easily.

The comment semicolon therefore starts after 4 spaces plus the 28-character
instruction field, and the semantic comment starts after the 16-character
address/opcode field:

```text
....<28-character instruction field>; <16-char address/opcode field>  semantic comment
```

where `....` means four spaces.

Examples:

```asm
Rst08
    jp L15E0                    ; 0008 C3 E0 15
    .db $2a,$2e,$2a,$ff        ; 000B 2A 2E 2A FF  "*.*", copyright

IRQ
    push af                     ; 0038 F5        Save registers used by the IRQ wrapper
    push hl                     ; 0039 E5
    ld h,$00                    ; 003A 26 00
    ld a,$80                    ; 003C 3E 80
    jp IrqDivMmcOn              ; 003E C3 46 00

IrqDivMmcOn
    out ($E3),a                 ; 0046 D3 E3     Turn on DivMMC ROM and RAM page 0
```

Do not use the generated listing shape in final assembler sources:

```asm
0008 C3 E0 15                   jp L15E0
0046 D3 E3         L0046:       out ($E3),a
```

The address and bytes are valuable, but they must be moved into comments so the
line remains assembler-compatible.

## Round-Trip Verification Goal

The end state should compile each source file with the Klive Z80 Assembler and
compare the emitted bytes with the original ROM image:

- ROM0 source must match bytes `$0000-$3FFF` of `enNextZX.rom`.
- ROM1 source must match bytes `$4000-$7FFF` of `enNextZX.rom`.
- ROM2 source must match bytes `$8000-$BFFF` of `enNextZX.rom`.
- ROM3 source must match bytes `$C000-$FFFF` of `enNextZX.rom`.
- Alt ROM and NextMMC sources must match their corresponding ROM files.

The verification tooling should fail on the first mismatching address and report:

- ROM/source file name.
- Address in the assembled address space.
- Original byte.
- Reassembled byte.
- Nearby source line, when available.

Until that tool exists, every manual conversion should preserve the original
address/opcode comment so byte-level review remains possible.

## Conversion Helper

Use the conversion helper from this folder to convert an existing fixed-column
listing into the assembler-oriented format:

```bash
node convert-disassembly-format.js nextRom0.txt
```

The script creates a backup before overwriting the target file. If
`nextRom0.txt.bak` already exists, it creates a timestamped `.bak` file instead.
It preserves normal comment lines, moves labels to standalone label lines, and
formats instruction/data lines with:

- 4 leading spaces.
- A 28-character instruction/directive field.
- A 16-character address/opcode metadata field at the start of the comment.

## Code vs Data Heuristics

Treat bytes as code when several of these are true:

- A reset vector, jump table, call, branch, or fall-through reaches the address.
- The surrounding instructions preserve a valid stack and return path.
- The code has coherent register use and control flow.
- It references known ports, NextRegs, ROM calls, API calls, or system
  variables in a plausible way.
- Equivalent or similar code appears in Spectrum 128/+3 ROM sources, NextMMC,
  Alt ROM, or esxDOS-compatible routines.

Treat bytes as data when several of these are true:

- The range is skipped by an unconditional jump and no known entry target lands
  inside it.
- Bytes decode into implausible instructions such as long runs of `nop`,
  repeated `inc sp`, impossible stack behavior, or accidental RSTs.
- Bytes are printable ASCII, token strings, error messages, file masks, command
  names, font/glyph data, bit masks, lookup tables, or vectors.
- The bytes are consumed by code using `ld hl,table`, indexed loads, block copy
  instructions, or inline-parameter readers.
- There is a size-delimited table or sentinel-delimited sequence.
- The same pattern appears as data in an older Spectrum ROM disassembly.

Common mixed forms:

- Reset vectors followed by signature or filler bytes.
- `rst`/`call` wrappers followed by inline `.defw` parameters.
- Jump tables containing `.defw` entries that point back into code.
- String tables with high-bit terminators, zero terminators, or token bytes.
- Bank-switching stubs where the apparent target is in a different ROM or RAM
  page.

## Naming Conventions

Use labels that describe externally visible purpose or stable local behavior:

- Entry points: `ColdStart`, `IRQ`, `NMI`, `Rom1Call`, `Rom2Call`,
  `Rom3Cont`.
- Persistent labels use at most 16 characters.
- Persistent labels use only letters, digits, and underscores. To stay clear of
  numeric literal ambiguity, prefer a leading letter or underscore.
- The Klive Z80 Assembler accepts broader identifier syntax, including
  backtick, underscore, `@`, `!`, `?`, and `#` as initial characters, but this
  ROM project intentionally keeps persistent labels narrower and easier to scan.
  See `docs/pages/z80-assembly/language-structure.mdx`.
- Use temporary labels whenever a label is only meaningful within the current
  persistent-label scope. Klive temporary labels start with a backtick and are
  scoped between the previous and next persistent labels. Examples: `` `loop``,
  `` `skip``, `` `copy``.
- Tables: suffix with `Table`, `VectorTable`, `StringTable`, `TokenTable`,
  `JumpTable`, or `Message`.
- API-compatible routines: prefer official names from `next-api.txt`.
- Hardware helpers: include the device or register family, for example
  `SetMmu56`, `SelectDivMmcPage`, `WriteNextReg`.

Do not rename a label just because a nearby comment speculates about it. Put the
hypothesis in a comment or note first, then rename when corroborated.

## Comment Style

Use comments for semantic value:

Good:

```asm
IRQ
    push af                     ; 0038 F5        Save registers used by the DivMMC IRQ wrapper
    push hl                     ; 0039 E5
```

Avoid:

```asm
IRQ:        push af             ; 0038 F5        Push AF
0039 E5                         push hl
```

For routines, prefer compact blocks:

```asm
;
; Call ROM3 routine.
; Entry: inline word after caller return address = ROM3 target.
; Exit: target routine result; BC restored from TMPBC.
; Notes: Switches through the RAM trampoline at $5B48.
;
```

For uncertain blocks:

```asm
; TODO: Confirm whether this is a token table or command dispatch table.
; Evidence: all entries are printable/token bytes and are reached only through L1234.
```

## Cross-Reference Method

For each target range, run these searches:

1. Address search in the same listing:
   - Direct label: `L1234`
   - Raw address forms: `$1234`, `12 34`, `34 12`
2. Other listing search:
   - Same opcode bytes for routine clones.
   - Same string/table bytes for messages and command names.
3. Reference search:
   - API names and addresses in `next-api.txt`.
   - System variable names in `system-vars.txt`.
   - Ports in `_input/next-fpga/ports.txt`.
   - NextRegs in `_input/next-fpga/nextreg.txt`.
   - Older ROM routine names in Spectrum 128/+3 ASM files.

When a match is found, prefer this evidence format in notes:

```md
- `$1234-$127A` in `nextRom2.txt`: likely `DOS_OPEN` wrapper.
  Evidence: API address `$0106` from `next-api.txt`; call setup matches +3DOS
  convention; preserves IY and uses RAM bank 7 as required by the API docs.
  Confidence: high.
```

## Continuous Learning Notes

Append durable facts to `disassembly-notes.md` under clear headings:

- Confirmed labels
- Confirmed data ranges
- System variables
- Bank-switching and paging conventions
- API calling conventions
- Hardware port and NextReg behavior
- Repeated idioms and byte patterns
- Open questions

Use this schema for each new fact:

```md
### YYYY-MM-DD - ROM/range

Finding:
Evidence:
Impact:
Confidence: high | medium | low
Follow-up:
```

Facts that should guide future AI sessions should be short, specific, and easy
to search. Example:

```md
- ROM0 `$0028-$002F`: RST `$28` reads an inline word from the caller's return
  address, stores BC in `TMPBC`, then dispatches through `Rom3Cont`.
```

## Suggested Work Plan

### Phase 1: Build the Evidence Index

- Normalize `system-vars.txt` with confirmed names, sizes, source, and
  confidence.
- Extract API names and addresses from `next-api.txt` into an address index.
- Create `data-ranges.md` and seed it with already identified ranges near reset
  vectors and fillers.
- Create `labels.md` and seed it with all non-generated labels already present
  in `nextRom0.txt`.

### Phase 2: Stabilize Entry Points

- Annotate reset vectors and interrupt/NMI handlers in every ROM bank.
- Identify ROM bank call mechanisms and RAM trampolines.
- Identify Alt ROM and NextMMC entry stubs.
- Record cross-bank conventions for ROM0, ROM1, ROM2, ROM3, Alt ROM, and
  NextMMC.

### Phase 3: Recover Tables and Inline Data

- Sweep for code that is unreachable after unconditional jumps.
- Sweep for printable strings and token-like byte runs.
- Sweep for jump tables and `.defw` target arrays.
- Convert obvious data first, leaving uncertain ranges marked as TODO.

### Phase 4: Match Known Spectrum Routines

- Compare ROM regions against Spectrum 128 and +3 disassemblies.
- Transfer only routine names and high-level descriptions that match behavior.
- Note differences where NextZXOS extends or patches older routines.

### Phase 5: Annotate APIs and Filesystem Code

- Use `next-api.txt` and NextZXOS/esxDOS docs to name public API entry points.
- Work through NextMMC and filesystem-facing ROM2 sections in small clusters.
- Mark private lower-level filesystem routines separately from public API calls.

### Phase 6: Verification and Assembly Readiness

- Convert annotated listings into Klive-compatible `.kz80.asm` sources using
  label-only lines and aligned address/opcode comments.
- Add tooling to assemble every `.kz80.asm` source and verify it reproduces the
  original ROM bytes exactly.
- Add a cross-reference generator for labels, calls, jumps, and data reads.
- Add a report that flags unknown labels, unresolved TODOs, and code/data
  ranges with low confidence.

## Good First AI Tasks

- "Annotate `nextRom0.txt` from `$0000` to `$00FF`, updating notes with all
  confirmed vectors, inline words, and filler/data ranges."
- "Find all writes to port `$E3` in `nextmmc.txt`, group them by purpose, and
  propose names for the helper routines."
- "Compare `nextRom0.txt` routine `$15C9` with Spectrum 128/+3 ROM listings and
  report whether it is inherited, patched, or Next-specific."
- "Find all `nextreg $56/$57` usage and identify MMU slot switching helpers."
- "Build `labels.md` from existing named labels and their first reference."
- "Convert `nextRom0.txt` `$0000-$00FF` to Klive assembler source format and
  preserve address/opcode bytes as aligned comments."

## Quality Bar

A section is "done enough" when:

- Every reachable entry point has a purposeful label or an explicit TODO.
- Every label starts in column 1, has no colon, and labels the following line.
- Persistent labels are no longer than 16 characters and use only letters,
  digits, and underscores.
- Temporary labels are used for local loops, skips, and continuations whenever
  their scope does not need to escape the current persistent label.
- Data bytes in the section are represented as data, not accidental code.
- The source compiles with the Klive Z80 Assembler.
- Routine comments describe entry, exit, side effects, and bank assumptions
  where relevant.
- Non-obvious claims cite local or external evidence in notes.
- The original bytes are still recoverable from aligned address/opcode comments.
- The reassembled bytes match the original ROM bytes exactly for verified
  ranges.
- Open questions are captured instead of being left in the AI chat transcript.
