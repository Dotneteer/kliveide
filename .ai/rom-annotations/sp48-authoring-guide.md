# Authoring the ZX Spectrum 48K ROM Annotations

> **Tools.** New work goes through the ROM annotation pipeline (`npm run rom:pipeline`; README, "The tools"). Most scripts this guide names were retired by it: `tools/README.md` gives the command that replaced each.

A standing brief for a session working on `sp48.rom.dis`, and the method to reuse for the next ROMs
(128K, +3). Read `README.md` (the D4 rule, provenance, levels) and `zx81-authoring-guide.md` (the
working-copy discipline, the batch tools, two-pass region batches) first; this file adds what the
48K work taught. Update it at the end of a session: fold new learning in, replace what it
supersedes, keep no history (that is `PROVENANCE.md`'s job).

## State of the work

- **`sp48.rom.dis` ships at level 2** (`src/public/roms/`, 2026-10-20, plan step R2): 1,043 labels,
  each with a synopsis; 4,886 end-of-line comments; every byte in a code or data region; it exports
  and reassembles byte for byte. The working copy `~/Klive/RomAnnotations/sp48.rom.dis` equals it.
- **`sp128-1.rom.dis` ships at level 2** (2026-10-20): it `inherits` `sp48.rom.dis` and authors
  only ROM 1's six patches and its new code at `$386E-$3CFF` (the keypad, the hooks into the other
  ROM, SPECTRUM and PLAY, a test picture).
- **The +2A/+3 ROM 3s ship at level 2** (2026-10-20): `spp3-41-3.rom.dis` inherits `sp128-1` and
  `sp48`; `spp3-40-3.rom.dis` (also the +3E's ROM 3, the same bytes) and `spp3-41es-3.rom.dis` inherit
  `spp3-41-3` first. On the +3, FLAGS bit 4 is "+3 BASIC", not 128 BASIC.
- **Every ZX Spectrum Next ROM ships at level 2** (2026-10-21; the mapping and merge scripts are in
  `tools/`): one working copy per
  ROM file with a bank per page (`enNextZX.rom.dis` holds pages 0-3); give the tools `PAGE=<n>`. The
  author follows the work by opening the working copy (`rom-ann-open zxnext/nextzxos-2.08/enNextZX.rom -page 3`): write
  it back after every step, since the IDE re-reads it on each change.
- **Every +2A/+3 (v4.0, v4.1, Spanish) and +2E/+3E ROM ships at level 2** (2026-10-20, R4 done):
  ROMs 0 (editor), 1 (syntax), 2 (+3DOS) and 3 (48K BASIC). v4.1 was authored from the bytes, the
  others mapped from it and completed. On `plus3-syntax` pages calls into other ROMs carry inline
  words (`RST $28`, `CALL $3F00`, `CALL $3E80`, decoded); calls to the error routines carry a code
  byte, marked with one-byte regions because the routines move between versions.
- **+3DOS (ROM 2) ships at level 2** (2026-10-20) for v4.1, v4.0 and Spanish (the last two inherit
  v4.1). Next in R4: ROMs 0 and 1 of each version (they differ between versions by moved code, so
  author v4.1 and inherit by copying entries with the measured shifts, as for the Spanish ROM 2), and
  the +3E's ROMs. `_input/` holds commented disassemblies of these ROMs: never open them; only
  `_input/765.pdf`, the floppy controller's datasheet, is allowed (interface facts).
- **A ROM whose code was reworked and moved throughout** (the +3E's ROM 2) is mapped, not
  inherited: align the two listings instruction by instruction with address operands masked
  (difflib on normalised mnemonics), map data regions by their exact bytes, and remap ROM
  addresses in the copied text. Leave numbers that are not addresses alone: port numbers below
  $4000 ($1FFD, $2FFD, $3FFD) and the entry numbers after "DOS_JUMPS"; and check that a table was
  not aligned onto a neighbouring table of the same instructions (the +3E's $00A0 table caught
  the +3's $0100). Then let helpers author what did not map and list fixes for what mapped wrongly.
- **The mapper** (`mapgen.py`/`build.py` in the session scratchpad of 2026-10-20, recorded in
  PROVENANCE) must not remap numbers that are not this ROM's addresses: constants followed by a
  unit ("$2000 misses", "$0370 half-cycles"), addresses before "in ROM n" or in a "ROM n's" list,
  port numbers. Audit a mapped sidecar by listing every token the mapping changed with its
  context, and fix other ROMs' addresses from that version's own bytes (search the byte sequence).
- **A jump into another ROM** that lands mid-instruction in this page is reported as a
  mid-instruction target and needs no label; where it lands on an instruction start, give it a
  label whose synopsis says nothing in this ROM jumps there.
- **A variant whose code moved** binds nothing at the moved offsets. Measure the shifts (align the
  bytes block by block), copy the base's entries to the new offsets with the addresses in their text
  remapped, and re-read only what really differs. Compare the instruction counts of the base and the
  variant afterwards: a big gap means a filler region did not bind.
- **`sp128-0.rom.dis`, the 128K editor ROM, ships at level 2** (2026-10-20): 1,085 labels, each with
  a synopsis, 4,253 comments, no unlabelled targets; it reassembles byte for byte. Its RST $28 calls
  the ROM 1 address in the word after it and `CALL $05AC` + a code byte raises its errors;
  `ZxSpectrum128EditorCustomDisassembler` lists both on `sp128-editor` pages. Facts the synopses
  rest on: $5B5C is the paging byte; the editor's variables are in bank 7 from $EC00 ($EC0D flags,
  $EC0E the mode: 0 128 BASIC, 4 Calculator); the editing rows are 35 bytes from $EC16 (32 cells,
  flags, line number high byte first; flags bit 0 a line's first row, bit 3 its last, bit 4 a row
  from the program), with row stores above the screen at $F9DB and below at $F6F5. A canned command
  line or token string in the ROM is data: mark it as a region, or the `RST $28` decoder reads $EF
  as a call.
- **Drafting a ROM in parallel**: helpers draft JSON per range ({labels, synopses, comments,
  regions, facts}) from the listing and the sidecar; check the drafts against each other for
  shared names (helpers reach for the same `CURSOR_ON`) before merging, and read their `facts`:
  they carry the corrections to synopses written earlier. A comment pass over finished ranges
  is worth it for that alone: on ROM 0 it found 25 wrong synopses or comments. Check every such
  report against the instructions before applying it, and scan the drafts for names that are not
  labels (a helper will cite a name a synopsis used for an unlabelled address).
- **Probing the 128K editor** (`test/harness/sp128`): choose 128 BASIC with `typeText("{CS+6}")`
  then ENTER (`typeText` types small letters only: send capitals as `{CS+X}` chords; EDIT is
  `{CS+1}`, down `{CS+6}`; `bank(7)` reads the editor's rows); type slowly (`{ hold: 4, gap: 12 }`),
  and after a report send one key first, which only clears it.
- The live 128K view decodes it too: the 128K's custom disassembler chains the 48K decoder (gated on
  the 48K BASIC page) with the editor's (gated on `sp128-editor` pages through
  `CustomDisassemblyContext.inRomOfKind`).

## A ROM that is mostly another one: `inherits`

The 128K's ROM 1 is the 48K ROM with patches. Its sidecar names `"inherits": [{"sidecar":
"sp48.rom.dis", "page": 0}]` and holds only its own entries; every tool reads it merged with the
inherited sidecar's byte-bound entries (`romInheritance.ts`): the IDE's layers, the readiness check
and level, Export as source, `sp48-dis.cjs` (it picks the ROM from the sidecar's `source.fileName`),
`check-annotations.cjs`, `rom:annotations level` and the reassembly template. What to author:

- **Find the differences first**: compare the two ROM files byte by byte and group the runs. Each
  run is a routine whose inherited label, synopsis and comments are dropped (binding is per label
  span), so the sidecar must give that routine back: copy the inherited entries of its unchanged
  lines (provenance `derived`) and describe the changed ones.
- Mid-routine targets that the new code jumps to need labels of their own (`OUT_UDG`,
  `PRINT_ENTRY_AT`, `OP_INKEY_CHAR` in ROM 1).
- New code where the base ROM had filler gets regions, labels and comments as usual.
- **Inheritance is one level deep**: each tool reads only the sidecars a file lists, with their
  own entries. A ROM that is a variant of a variant lists the whole chain, nearest first (the first
  layer wins per label and per line field).
- **Binding is per label span of each layer**, and a sparse layer's spans are long: one of its
  labels covers everything up to its next own label. A changed byte far from a routine can drop
  it, and a label can bind inside a region you made (ROM 1's `UNUSED_TAIL` did on the +3); give
  such offsets entries of your own. `LABELS=<file> node $T/sp48-dis.cjs 0000 3FFF <sidecar>` writes the
  merged page's labels: compare an empty sidecar's list with the base's to see what dropped.
- **Text the base sidecars quote** (message texts, report names, probe results) follows the base
  ROM; on a ROM whose messages differ, override those synopses, and mark copied probe results as
  the base ROM's.

## The method, per topic

Work one topic at a time (a command family, the calculator, the tape routines), and finish each:

1. **Read** the code through the sanctioned listing, with what is already known beside it:
   `node $T/sp48-dis.cjs 0000 3FFF $S/live.dis > $S/full.lst`, then
   `python3 $T/annotated-view.py $S/live.dis $S/full.lst <from> <to>` (labels with their synopsis,
   existing comments). `sp48-dis.cjs` prints targets as `Lxxxx`, not label names: look names up in
   the sidecar.
2. **Write a batch script** in the scratchpad (Python building the JSON is easiest for long
   synopses): regions, labels, synopses wrapped at 92 columns with numbered steps and hanging
   indents. Apply it with `apply-annotations.cjs`; a script that edits the JSON directly must be
   followed by an `apply-annotations.cjs` run with an empty batch
   (`{"labels":{},"lines":{},"regions":[],"dataLabels":{},"manualLines":[]}`), or
   `check-annotations.cjs` reports "not in the format `npm run rom:annotations` writes".
3. **Regenerate the listing** and label what the new regions uncovered; repeat until
   `check-annotations.cjs` shows `"problems": []` and the unlabelled targets you meant to clear.
4. **Probe** what the code alone leaves open, on the real core (`tools/sp48-probe-template.ts.txt`):
   values, error reports, edge cases. Record the observed results in the synopses (`Observed:`) and
   in `PROVENANCE.md`; never keep the probe.
5. **Write back with the `cmp` guard** (`zx81-authoring-guide.md`), then **reassemble**
   (`tools/reassemble-test.ts.txt`) and append a `PROVENANCE.md` entry: what was added, the
   regions, the names, the method, the probe's results, the level.
6. **Name the next topic** to the author.

## Names (D4) — the trap that cost most

The first sessions labelled about 70 routines with names that came from memory (a `PO_` family,
`KEY_SCAN`, `STK_VAR`, `FIND_INT1` ...); 99 labels were renamed afterwards. What works:

- Name a routine **after reading it**, from what it does: `TAKE_BYTE` (a number off the calculator
  stack into A), `READ_KEYS`, `SCREEN_OUTPUT`, `VAR_SUBSCRIPTS`, `TONE_OUT`.
- Avoid prefixes that could echo a remembered family; give a routine group a prefix of its own
  (`NP_` for the number printer, `TENS_` for the power-of-ten scaling, `OUT_` for printing).
- A routine doing the same job as one named in another Klive sidecar takes that name (the ZX81's
  `FP_TO_BC`, `STACK_A`, `STACK_BC`, `SCAN_EXPR`, `STR_SLICE` ...).
- Words in a synopsis are the same: describe the instructions, not a remembered description.
  Mathematics is not ROM knowledge: calling the series generator a Clenshaw recurrence for a
  Chebyshev series describes what its codes compute.

## House style, as applied here

`zx81.rom.dis` is the model (`README.md` lists the rules). Patterns the 48K settled:

- Command routines open with the command (`FOR (class ...):`), calculator operations with the
  code's name and number (`exp ($26):`), restarts with `RST $xx:`.
- `Exit:`, `Entry:`, `Changes:`, `Observed:` lines come last; `Observed:` quotes probe results
  (`SQR 2 1.4142136; SQR -1 report A`).
- A loop label inside a routine gets a one-line synopsis (`One fraction digit (DIGIT_TO_STACK).`);
  the routine's own synopsis carries the explanation.
- An end-of-line comment goes on the **first line of a step**; the lines that continue it stay
  bare. Registers in comments read as values (`HL = the result`, `DE = STKEND`), tests as
  questions (`Both exponent bytes 0?`).
- **Character sets look the same in every ROM sidecar**: label `CHARACTER_SET`, the region as one
  byte per row in binary (`"rowBytes": 1, "radix": "binary"`), a synopsis giving the layout and
  every reader of the table, and a `$NN - Character: 'x'` synopsis on each picture's first byte
  (a name instead of a quoted character where quoting reads badly: `ukp`, `up arrow`,
  `copyright`, `apostrophe`, `mosaic`). Name each picture from its pixels, not from a code chart.

## Disassembly traps met on this ROM

- **Calculator codes reached by a jump outside the RST $28 decode list as Z80 code.** A
  `jump-true`, `jump` or `dec-jr-nz` whose target lies past the stream the decoder followed lands
  on bytes it never decoded, so they list as instructions, and their "targets" show up as phantom
  unlabelled targets (`$3773`, `$379E`, `$3837` were such). Mark those bytes as a `bytes` region
  with a synopsis that decodes them ("Calculator codes the jump-true at $3855 lands on ...: delete,
  duplicate, ... end-calc. The Z80 goes on at $386D."). Eight such regions exist; a phantom target
  inside the calculator area is the sign of a ninth.
- **Calculator-code lines cannot take comments**: the decoder's own comment names each code, and
  `apply-annotations.cjs` refuses keys on them.
- **Bit-7 string tables are `defc` regions, filler is `fill`** (`README.md`).
- **A `$CF` byte in data is not an `RST $08`.** A test that hunts for one must look in a code
  region (`romStaticListing.test.ts`).
- Two short pieces of code are never reached from anywhere in the ROM (`$16D4`, `$1988`); their
  comments say so rather than invent a caller.

## The level-2 comment pass

Level 2 took about one comment per 1.4 instructions (4,886 for some 6,800). What worked:

- Draft comments as plain `ADDR text` lines, one file per range, and merge them with
  `tools/apply-comments.py` (never overwrites; reports a differing existing comment). Then the
  empty-batch canonicalisation, the check and the reassembly.
- Big ranges can be drafted **in parallel** by helper agents, one per range of 1-2K, each working
  only from the listing and the sidecar. **Review every draft against the code before merging**:
  the drafting caught eight wrong synopses (a FOR variable's size, the fill direction of DIM, what
  INKEY$ returns, what Z means after LOOK_VARS ...), and a draft can be wrong the same way.
- `check-annotations.cjs` measures level 2 as soon as every label has a synopsis; the comments are
  judgement. Record `"level": 2` by hand only when every code range has been reviewed.

## 48K facts the annotations rest on (all observed)

- Numbers are 5 bytes: an exponent with bias $80 and four mantissa bytes whose bit 7 of the first
  is the sign (the implicit 1 restored for arithmetic); a small integer is `00, sign ($00/$FF),
  low, high, 00`. Observed quirk: `-65535-1` prints `-1E-38`.
- The calculator (`CALC_ENTRY`, RST $28) runs codes until `end-calc`; codes below $18 take two
  operands, $18-$3F one, $80 up are groups (series, stk-const, st-mem, get-mem) with the index in
  bits 0-4. `CALC_OP_TABLE` holds the routines; memories are 5 bytes each from MEM.
- CHARS is $3C00, so a character's picture is at CHARS + 8 x code; the start-up copies A-U to the
  UDGs.

## Shipping a new version of the file

Copy the working copy over `src/public/roms/sp48.rom.dis` unchanged, then run the annotation,
export and editor tests: several pin facts about the shipped file and must follow it.
`romLayers.test.ts` (labels bound on the 128K), `romSidecarCheck.test.ts`,
`romStaticListing.test.ts`, `romWorkingCopy.test.ts`, and `RomAnnotationEditorPanel.test.tsx`,
which builds a sparse working copy of its own from the shipped file. Update the plan's R2 row,
`CLOSING_THE_GAPS_PLAN.md`, the competitive analysis (§2 and §4) and the disassembly guide when
the level or the coverage changes, and carry a changeset.
