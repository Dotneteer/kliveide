<!-- Template: the brief given to each helper agent drafting level-2 synopses for one slice of the Cambridge
     Z88 OZ 4.7 sidecar (dev/plans/Z88_OZ47_ROM_ANNOTATIONS_PLAN.md, Phase 3). First used for the kernel banks 0
     and 1 (2026-11-15). Build the slices with tools/z88-synopsis-pack.cjs and z88-synopsis-split.cjs; give each helper its
     slice file and its draft path. Merge the drafts with tools/z88-synopsis-merge.cjs into
     z88-oz47-authored.json, then re-import and check. -->
# Brief: draft synopses for a slice of the Z88 OZ 4.7 ROM sidecar

You write synopses for the labels listed in ONE slice file (given in your task), for Klive IDE's annotation
of the Cambridge Z88's OZ 4.7 ROM (`src/public/roms/z88v47.rom`). You only WRITE ONE DRAFT FILE (given in
your task); you do not edit the repository, any sidecar or anything outside your draft. Other helpers run
at the same time and share the scratchpad: name any scratch file after your slice (`mth-2-gen.cjs`), never
a generic name.

## What you may read
- **The OZ source is allowed and is the main evidence.** OZ 4.7 is annotated from its own source with the
  owner's permission (plan decision D-OZ1): the checkout is `.local/oz47/oz/` (tag V4.7), the `def/` folder
  holds the shared symbols (`oz.def`, `sysvar.def`, `error.def`, `memory.def`, `blink.def`, ...). Read the
  routine's whole source, not only the excerpt in the slice, and the callers when the contract is unclear.
- The slice file: per label its key (`<bank>:<offset in decimal>`), its bank offset and run address, the
  label as the sidecar names it (`label`), its name in the source (`sourceName`), `kind` (code or data), the
  imported end-of-line comment on that line, its source definition(s) with text, and up to 8 callers.
- The bytes, through Klive's disassembler, when you need them:
  `PAGE=<bank> node dev/ai/rom-annotations/tools/z88-dis.cjs <from hex> <to hex> .local/oz-import/z88v47.rom.dis`
  (bank offsets; prints `OFFS @ADDR BYTES INSTRUCTION`).
- House style: `dev/ai/rom-annotations/README.md` ("Write every sidecar in zx81.rom.dis's style" and "A
  subroutine's synopsis ends with its contract"), and for tone the synopses in `src/public/roms/ep-exdos13.rom.dis`.

## What to write: one synopsis per label in the slice
- **A routine:** what it does, in one or two sentences, present tense, capital first, full stops. Then its
  contract, each part on its own line, in this order and only the parts you can establish from the code:
  `Entry:` (inputs: registers, flags, memory read; "none" when it takes nothing), `Exit:` (outputs on
  success), `Error:` (how failure is signalled: "Fc = 1, A = error code (RC_xxx)"), `Changes:` (registers
  whose values change: `AF, BC, HL, AF'`; 8-bit names when only one half does), `Keeps:` (main registers
  that hold their values; optional). Use `A = value; HL = pointer` style, items separated by "; ". For a
  routine longer than about 30 instructions, numbered steps between the summary and the contract are good.
- **An OZ system call** (an `OS_xxx`, `GN_xxx`, `DC_xxx` entry, often reached through the call tables) starts
  with its name: "OS_Bix: binds in an extended address ...". Its documented interface (the header comments,
  `def/*.def`) is the contract.
- **A second entry into a routine** (a label the source places inside another routine, called from elsewhere)
  says so: "Entry inside BindS1: ... ; falls into ...". A routine that falls into the next one says so.
- **A data label** (`kind` data): what the table or block holds and its layout ("Table of 8 words: the
  handler of each ..."), and who reads it when that helps.
- **Never guess.** A register you have not traced is left out of `Changes:` (or the line is left out). An
  interrupt or hardware fact comes from the code and `blink.def`. If something stays unclear, say what is
  known and nothing more; never invent a purpose.
- Wording: plain English, no em dashes, no "simply"/"just"/"easily". You may reuse the source's own comment
  wording (it is allowed here) but write full sentences. Name another routine by its sidecar label when it has
  one in the slice or the listing; OZ calls by their names (`OS_Mfr`). Lines at most 92 characters: wrap the
  text yourself with "\n" (a contract part that wraps continues on the next line without a keyword).

## Draft format (JSON, one object)
{ "slice": "<slice file name>", "synopses": { "<key>": "text with \n for new lines", ... },
  "notes": ["anything another author needs: a calling convention, a doubt, with the evidence"] }
Use the slice's keys exactly (`"0:102"`), one entry for every label of the slice.

## Check before replying
Run `node -e` to load your draft: valid JSON, every slice key present, no line over 92 characters, no
key that is not in the slice. Reply with the draft's path, the count written, and the notes in a few lines.
