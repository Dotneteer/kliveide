# Reverse-Engineering Tools

Four tools over the annotation model (`dev/patterns/annotations.md`): **code/data detection** from
coverage (G7.3), the **graphics finder** (G7.4), **SkoolKit import and export** (G7.5) and **export
as source** (G7.6). They were built on 2026-10-09 from a plan closed on 2026-11-04 (git history:
`.plans/REVERSE_ENGINEERING_TOOLS_PLAN.md`). The model keys they added (`text`, `defc`, `fill`,
`graphic` regions, `origin`, `graphics`, `endComment`, `interop.skool`) are in
`dev/patterns/annotations.md`, "The Reverse-Engineering Tools' Keys"; their commands are in its "Commands".
This file holds their rules, and the traps the rules exist for.

**Where the code is:** the pure modules in `src/common/reverse/` (`classify`, `reach`, `proposal`,
`canonicalEncoding`, `graphicsDecode`, `graphicsCandidates`, `sourceExport`, `spectrumRomInline`,
`skool/`); the machine-facing orchestration in `src/renderer/appIde/reverse/` (`detection`,
`exportRun`, `skoolRun`, `ReverseToolsMenu`); the Detect dialog in
`src/renderer/appIde/dialogs/detect/` (MVC); the finder in `src/renderer/features/graphics/`. Tests:
`test/reverse-eng/` (the `*.core.test.ts` files run the 48K and Next cores in the e2e tier) and
`test/dialogs/detect/`. Docs shots: `dev/scripts/doc-shots/recipes/reverse-engineering.cjs`.

## Decisions

| # | Decision |
|---|---|
| R1 | **Every tool writes the model through the active set's session.** None writes a `.dis` file itself. |
| R2 | **Model additions are keys a shipped build ignores**, never a schema bump; Next files stay at version 2. |
| R3 | **Detection proposes; the user applies.** A run is a per-bank list of region changes with counts; applying it is one session update. Its regions carry `origin: "auto"`; a user's own region is never overwritten without `-replace`. |
| R4 | **Three evidence levels:** *observed* (coverage flags), *reached* (static reachability from observed code), *inferred* (heuristics), each switchable and counted. |
| R5 | **The graphics finder is one component** (`GraphicsView`): a view mode of `StaticMemoryDump` and a live *Graphics* document. |
| R6 | **A named graphic is a label, a `graphic` region and a `graphics` entry**, so every view and export shows it the same way. |
| R7 | **SkoolKit provenance:** SkoolKit is GPL-3 Python. Klive's parsers and writers are written from SkoolKit's **documented formats** only; no SkoolKit code is read, copied or translated. Running an installed SkoolKit as a local oracle on Klive's own files is allowed (`dev/scripts/skoolkit-oracle.cjs`), never in CI. No published skool or ctl file is checked in. |
| R8 | **D4 holds for ROMs:** a published skool/ctl file of a ROM never feeds a shipped ROM sidecar (`dev/ai/rom-annotations/README.md`). A user may import any file into their own set or ROM layer. |
| R9 | **A skool import binds to bytes Klive already has.** It brings structure and text and checks them against memory; it never builds memory from instruction text. |
| R10 | **Source export is verified:** every encoding the assembler would not reproduce is written as `.defb`, the table is checked exhaustively, and the export is assembled and compared. |
| R11 | **One dialect, Klive asm**, behind a small dialect interface (sjasmplus could follow). |
| R12 | **The logic is outside React**, in pure modules with unit tests; the ROM authoring scripts reuse the classifier and the walk. |

## Code/data detection (`ann-detect`, the Detect dialog)

**Input:** the coverage flags (`PF_EXECUTED` an instruction start, `PF_CODE` any code fetch,
`PF_READ`, `PF_WRITTEN`, `PF_SELF_MODIFIED`, `PF_INTERRUPT`; `src/common/profile/profileTypes.ts`),
one 16K bank or ROM page at a time, read through the bank space.

**The traps:**
- **D-T1 Executed is not code.** `PF_EXECUTED` marks only the first byte; operands come from `PF_CODE`.
- **D-T2 Unexecuted code** (an error handler that never ran) has no flags: unknown is safe, data is
  wrong. Reachability recovers it, as its own evidence level.
- **D-T3 Code that reads or modifies itself** carries data flags too: **code wins**, and SMC is
  reported (`findSmcRuns`).
- **D-T4 Overlapping instructions** (a jump into another instruction's operand): marked code from the
  earliest start, reported as an overlap warning for the user.
- **D-T5 The screen:** the ULA's reads are not CPU reads, so a written screen looks like data. On the
  Spectrum bank spaces the screen area (`SCREEN_AREA_RANGE`) is proposed as `skip` (`-noscreen` turns
  it off).
- **D-T6 The stack** classifies as data, which is right; the proposal names the span holding SP.
- **D-T7 A Next 16K bank is two 8K partitions:** flags come through the bank space, never one view per
  bank.
- **D-T8 Boundaries are instruction starts:** a code run snaps back to its first `PF_EXECUTED` byte; a
  data run that would split an instruction's operands is shortened.
- **D-T9** A byte the user marked as data that was later executed is reported, not changed, without
  `-replace`.

**Classification** (`classify.ts`), per byte in order: `PF_CODE` → code (observed); `PF_READ` or
`PF_WRITTEN` → data (observed); reached → code (reached); otherwise unknown. Runs of one class are
snapped (D-T8); a data run proposes `bytes`, refined by inference; **an unknown run proposes nothing**
unless `-unknown bytes`.

**The proposal** (`proposal.ts`): in **fill** mode a run applies only over a non-auto `disassemble`
region (a gap and a user's `disassemble` look the same on disk, and a bank's default is code) or over
an `origin: "auto"` region; a non-auto data, skip or graphic region is the user's. **`-mode replace`**
also overwrites the user's regions, listed separately and confirmed. **`-mode clear`** removes every
auto region. **Code over a gap is no change**, so it carries no `origin`; `clear` therefore restores
data regions, and code was never moved. The proposal reports the counts per level, the conflicts,
the SMC and overlap warnings, and what is still unknown. The dialog's **Undo last detection** holds
the pre-apply annotations for the session (`ann-detect -undo`); `clear` is the durable way back.

**Reachability** (`reach.ts`, `-reach`): a worklist walk over one 64K view under one paging, stopping
at the slot boundaries the bank space reports, using `z80InstructionLength` and the branch table.
Seeds: every observed instruction start, the call edges' callees, the active set's labels in
`disassemble` regions, the entry point (NEX or snapshot PC, or the project's start). It follows
`JP`/`JR`/`CALL`/`RST`/`DJNZ` targets and the fall-through of conditional branches, `CALL` and `RST`;
it stops after an unconditional jump or return, at a byte observed as data only, at a slot whose bank
differs, and it asks the ROM's custom disassembler for the length of `RST $08`/`RST $28` inline bytes
(`spectrumRomInline`). `JP (HL)` adds nothing (its observed targets are starts already). A reached
byte observed as data stops the walk and is an overlap warning.

**Inference** (off by default): `-text`, a printable run of at least four bytes, optionally ended by
a byte with bit 7 set or `$0D`/`$00`; `-words`, an even-aligned run of at least three words, 80 % of
them pointing at observed starts or labels (their targets also seed the walk).

**On a ROM page** detection reads the page paged at `$0000`, and `rom` writes to the user's ROM layer
through `liveRowTarget`, as `label` does; shipped sidecars are never written. Without coverage the
dialog says so and offers *Turn on coverage* and *Load .kcov…*. An auto region shows a quiet marker in
the listing (a dotted rail, `--color-annotation-auto`).

## Graphics finder (`gfx`, the Graphics view)

**The traps:**
- **G-T1 Byte order is not one thing.** Games store graphics row-major, in 8×8 character cells,
  column-major, or interleaved with a mask: `GraphicLayout` is `linear | cells | columns | screen`
  (the last is the ZX display-file order), with `mask` `none | interleaved | before | after`.
- **G-T2 The live view must not fight the refresh:** it refreshes on pause and holds still while the
  user drags or edits the width.
- **G-T3 Pixels are hardware colours, chrome is tokens:** ink and paper from `SPECTRUM_48_COLORS` (or a
  picked attribute; default `INK 0: PAPER 7`); grid, selection and named frames on one overlay canvas
  from `--color-graphics-*` tokens.
- **G-T4 Wide memory, small canvas:** only the visible window is drawn; the scroll position is an
  address.
- **G-T5 A Next bank is two 8K partitions:** read through the bank space or the dump's bytes.

**The view:** `graphicsDecode.ts` turns `(bytes, look)` into pixels plus a pixel-to-byte map (hover
shows the address, byte, frame and containing label; selection works in bytes). The look is width
(1-32 bytes), height, layout, mask, show-mask, invert, ink/paper, zoom, frame gap, columns and
**coverage dimming** (bytes never read recede, since graphics are read data). Keys: `←`/`→` change the
width (the parameter people sweep), `↑`/`↓` scroll a pixel row, `PgUp`/`PgDn` a frame. Presets: font,
UDG, screen.

**Where it appears:** `StaticMemoryDump`'s `viewMode: "graphics"` (snapshots, NEX banks, tape blocks,
Z88 banks), and the live `$graphics` document over the paused machine (64K view, a bank or a ROM
page), opened by `gfx`, *Show as graphics* from the Memory panel, or the disassembly and memory
context menus. **The look is view state, never the sidecar:** sweeping the width is how graphics are
found, and a write per step would make browsing an edit; naming one is the write.

**Finding:** named graphics are drawn as labelled frames; bytes in `disassemble` regions get a hatched
code band, but only once a bank has more than one region (an unclassified bank is all code, and
hatching every byte would say nothing). `graphicsCandidates.ts` proposes fonts (96 × 8 bytes, the
first cell blank), UDG blocks and read-never-executed runs ranked by read count, as labelled
heuristics.

**Naming:** *Name graphic…* writes a label, a `graphic` region (the user's, no origin) and a
`graphics` entry in one update; deleting the region drops the entry. **Save as PNG** saves a
selection or a named graphic at 1:1 or the current zoom.

## SkoolKit import and export (`skool-import`, `skool-export`)

**The formats**, as interface facts from SkoolKit's documentation (10.1), in Klive's words:

- **Skool file:** entries separated by blank lines. An entry's first instruction line starts with a
  block character (`c` code, `b` bytes, `t` text, `w` words, `s` same-value bytes, `u` unused, `g`
  game-status buffer, `i` ignored); `*` marks an entry point; `;` lines are comments, `@` lines ASM
  directives (`@label=`, `@org`, `@bank`, `@start`/`@end`, `@ignoreua`, the `@isub` family…), a space
  starts a plain instruction line. An instruction line is `<marker><address> <instruction> [;
  comment]`, the address decimal or `$` hex. The header comment has up to four `;`-separated sections
  (title, description, registers as `Input:`/`Output:` or `I:`/`O:`, start comment), paragraphs split
  by `; .`. Comments between instructions are mid-block, after the last one the end comment; `{` … `}`
  spread a comment over several instructions; `\` and `"` are escaped in strings.
- **Control file (`.ctl`):** a block directive (`b c g i s t u w`) with an address and optional title;
  sub-block directives `B C S T W` with `addr[,length[,sublengths]]` (base prefixes `b c d h m n`,
  `:` mixes); comment directives `D` description, `R` registers, `N` start or mid-block, `E` end, `M`
  over several sub-blocks; `L` repeats, `@ addr directive=value`, `>` keeps non-entry text; `#`, `%`
  and `;` lines are comments. A ctl file has no instructions: `sna2skool` joins it with a snapshot.

**The traps:**
- **S-T1 Skool addresses are 16-bit.** The import tracks paging through `@bank`, from a 48K-style map
  (banks 5/2/0), and resolves each address through the bank space; ROM addresses go to the user's ROM
  layer (listed as a separate target; the dialog's Apply is the confirmation).
- **S-T2 Instruction text is not bytes** (R9): each instruction is assembled at its address (in the main
  process, `MainApi.assembleLines`, because the assembler needs Node's `path`) and compared with the
  bytes there; a mismatching entry's region is not applied, and what the assembler rejects is checked
  by length only.
- **S-T3 Klive has no "entries"**: one mapping rule each way (S2), proved by a round-trip test.
- **S-T4 Skool macros** (`#R32768`, `#UDG…`) stay as comment text; converting them would need a macro
  engine.
- **S-T5 Label case:** Klive's symbols are case-insensitive, so a case-only collision is renamed
  (`name_2`) and reported.
- **S-T6 Byte-changing directives** (`@defb`, `@isub` with code) are never applied; they are kept and
  listed as not applied.

**The mapping:**
- **S1 Block types:** `c` → `disassemble`, `b`/`s`/`g` → `bytes`, `w` → `words`, `t` → `text`, `u` →
  `bytes` titled "Unused", `i` → `skip`; sub-blocks the same; imported regions carry `origin:
  "skool"` (code over the default gap carries none).
- **S2 Entries:** an import makes a label (from `@label`) and a synopsis on the entry's first address:
  title, description paragraphs, register lines. An export starts an entry at every region boundary
  and every synopsis, and splits the synopsis back.
- **S3 Comments:** instruction comments → end-of-line comments (a braced one on its first instruction,
  its text joined, its span in the passthrough); mid-block comments → the synopsis of the next address;
  end comments → `endComment`.
- **S4** `*` without `@label` sets no label; the mark is kept, so the export marks the same entry
  points.
- **S5 The passthrough** (`interop.skool`, per bank) keeps unknown directives, non-entry text, braced
  spans, `*` marks, block characters, header shapes and hex addresses, so an unedited file round-trips.
- **S7 Both formats, both ways;** a ctl import is checked by length only.
- **S8 Export syntax:** upper case, `$` hex, numeric operands, `@label=` lines; Klive's custom decodings
  (RST inline bytes, Copper, DMA) as `DEFB` with a comment; `defc` as `DEFM "AB","C"+128`, `fill` as
  `DEFS count,value` (the import turns them into `.defb` and `.fillb`).
- **Normalisations a round trip may show:** a register line without a prefix gets `I:`; data lines are
  regrouped as Klive lists them (four values a row, cut at entry starts and commented addresses).

**Banks:** a 48K export is one file; a 128K or +3 export writes the 48K view, then each other
annotated bank as an `@bank` section at `$C000` (`-split`: a file per bank); Next banks export one
file per bank at `$C000`, since SkoolKit does not model the Next's paging. A named graphic becomes a `b`
entry with a generated `#UDGARRAY` macro and binary `DEFB` rows. Bank documents offer the tools menu
only when their annotations are the active set.

## Export as source (`export-asm`, `rom-ann-export`)

**The traps:**
- **E-T1 The disassembly is not always canonical.** Its text would reassemble to other bytes for:
  `.skip` (a count, where the assembler wants a target), undefined `ED xx` and the Next `ED` set without
  `allowExtendedSet` (shown as `nop`), the `neg`/`retn`/`im` mirrors, `ED 63`/`ED 6B`, a `DD`/`FD` prefix
  before an opcode with no indexed form or before another prefix, `bit b,(ix+d)` with low bits other
  than 6, and an instruction running past its region or the 64K wrap.
- **E-T2 Generated labels are not always valid names** (a register or mnemonic, a case clash, a bad
  first character): every name is checked with the assembler's own identifier rule and renamed with a
  report.
- **E-T3 Operands outside the range** (a `CALL` into the ROM, a jump into another bank) become
  `NAME .equ $0DAF`; ROM labels and fixed-address banks' labels are included.
- **E-T4 Named immediates** are written by name only where the listing does (`operandReferences`); the
  verification catches the rest.
- **E-T5 A skip region still has bytes:** exported as `.defb` by default; `-skip gap` starts a new
  `.org` instead, which assembles to fewer bytes, and the report says so.
- **E-T6 The model comes from the bank space** (`.model Spectrum128` for `.bank`, `.model next` for
  Next opcodes), never from the current project.

**The walk** (`sourceExport.ts`): it walks the same annotated listing the Disassembly view shows (a bank
listing, or the live listing joined across slots) into `SourceLine`s, which a dialect renders; the
skool writer walks the same items.

**Canonical encodings** (`canonicalEncoding.ts`): `isReassemblable(opcodes, z80n)`, backed by a table of
the indexed opcodes, the `ED` mirrors and the defined `ED` opcodes per instruction set. **A test checks
it exhaustively**: every unprefixed, `CB`, `ED`, `DD`/`FD` and `DD CB`/`FD CB` pattern, with and without
the Next set, disassembled and assembled, must match its prediction. A disassembler or assembler change
that breaks a round trip fails there first.

**What a region becomes:** `disassemble` → instructions named through the resolver, a non-reassemblable
one as `.defb $ED,$4C ; neg (non-canonical)`, one overrunning its region as `.defb`; `bytes` → `.defb`,
`rowBytes` a line; `words` → `.defw`; `text` → `.defb "PRINTABLE",$8D` (never an empty string); `defc` →
`.defc` rows; `graphic` → binary `.defb` per pixel row (`width ≤ 2`, otherwise hex) with the picture as
the comment; Copper/DMA → `.defb` in the listing's grouping, decoded text as the comment; `skip` →
`.defb` or a new `.org`; RST inline bytes → `.defb` with the decoding. The bank comment and host go in
the header, a synopsis above its row, end-of-line comments trailing, `endComment` after the row.

**Verification:** the file is written, assembled in the main process (`MainApi.assembleText`, no file
I/O), and compared with the source bytes; the command's result is the verdict ("byte-identical", or the
first differing addresses) and an error unless identical. Where the save dialog opens and what it
remembers is in `dev/patterns/annotations.md`, "Commands".

## Tests worth knowing

- The classifier on synthetic flags (operands covered, SMC, overlaps, snapping, screen and stack
  notes); reachability (fall-through, stops, slot boundaries, RST lengths); the proposal modes; a Next
  bank from both 8K partitions.
- On the real cores (e2e tier): the 48K booted, a BASIC program run with coverage, detection on the ROM
  page; a NEX fixture. **This is Klive's own observation of the ROM**, never a comparison with a
  published ROM map.
- `graphicsDecode` for every layout and mask; candidates found in the 48K ROM's character set and not in
  random data.
- The skool and ctl parsers, the mapping rules, and a skool → annotations → skool round trip on
  Klive-authored fixtures.
- The exhaustive canonical-encoding test, and export → assemble → same bytes on a 48K snapshot, a 128K
  bank with `.bank`, and a Next bank with Next opcodes and Copper.
