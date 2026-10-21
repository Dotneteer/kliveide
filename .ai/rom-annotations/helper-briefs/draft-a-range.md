<!-- Template: the brief given to each helper agent drafting one address range of a ROM from scratch
     (used for the +3 ROMs). Replace <WORKDIR> with the session's work folder, adapt the ROM-specific
     "Files" and "Known facts" sections, and give each helper its range and draft path in the task. -->
# Brief: draft annotations for part of the ZX Spectrum +2A/+3 ROM 1 (the syntax ROM), v4.1

You draft annotations for one address range of `src/public/roms/spp3-41-1.rom` for Klive IDE's ROM
sidecar. You only WRITE ONE DRAFT FILE (given in your task); you do not edit the repository or any sidecar.

## The hard rule (D4) — read `.ai/rom-annotations/README.md` "The rule (decision D4)" first
Write only from the bytes in front of you. Do NOT use, recall or paraphrase any published commented
disassembly of any Spectrum ROM, nor remembered routine names or descriptions. Name routines after what
their code does. **Never open any file in `/Users/dotneteer/source/kliveide/_input/`**: it holds commented
disassemblies of exactly these ROMs and is forbidden.

## Files (read-only for you)
- Listing with the current regions: `<WORKDIR>/p1/full.lst` (`ADDR BYTES INSTRUCTION ; decoder comment`). In this
  ROM three calls take the address to call from the word after them, listed as `.defw`: `RST $28` into ROM 3
  (the +3's 48K BASIC ROM; RST $10/$18/$20 here are RST $28s into ROM 3's own), `CALL $3F00` into ROM 2
  (+3DOS; the word is a DOS_JUMPS entry, e.g. $0106 = OPEN_BY_NAME) and `CALL $3E80` into ROM 0 (the editor).
- Skeleton sidecar: `<WORKDIR>/p1/s0.dis` (filler regions only so far). View with annotations:
  `python3 .ai/rom-annotations/tools/annotated-view.py <WORKDIR>/p1/s0.dis <WORKDIR>/p1/full.lst 0100 0200`; a plain range:
  `python3 .ai/rom-annotations/tools/listing-range.py <WORKDIR>/p1/full.lst 0100-0200` (run from /Users/dotneteer/source/kliveide).
- Names you may cite:
  - ROM 3 (what RST $28 calls): `<WORKDIR>/p0/names-rom3.txt` (`$XXXX NAME`); its synopses are in
    `src/public/roms/spp3-41-3.rom.dis`, `sp128-1.rom.dis` and `sp48.rom.dis`. Say "ROM 3's CLS_LOWER".
  - ROM 2 (+3DOS): `<WORKDIR>/p0/names-rom2.txt` (with first synopsis words). Its jump table DOS_JUMPS at $0100 has
    the routines other ROMs call ($0100 CLEAR_AND_SETUP ... see the DOS_xxxx entries).
  - ROM 0, the +3's editor ROM: `<WORKDIR>/p1/names-rom0.txt` (with first synopsis words).
  - The 128K's editor ROM: `<WORKDIR>/p0/names-128-0.txt`. Much of its BASIC command code (syntax tables,
    statement loop, PLAY, the RAM disk, tape commands ...) probably lives on in this ROM: where a routine
    here does the same job as one there, USE THAT NAME (house rule: a routine doing the same job as one
    named in another Klive sidecar takes that name). Check the code really is the same job.
- House style: `.ai/rom-annotations/README.md` ("The tools") and `.ai/rom-annotations/sp48-authoring-guide.md`
  ("House style, as applied here"); read a few synopses in `src/public/roms/sp128-0.rom.dis` for tone.

## Known facts
- Paging: $5B5C copies port $7FFD (bits 0-2 the RAM bank at $C000, bit 4 the ROM's low bit, bit 3 the
  screen), $5B67 copies port $1FFD (bit 2 the ROM's high bit, bit 3 the disk motor). ROM 0 is $1FFD bit 2
  clear, $7FFD bit 4 clear; ROM 1 is $1FFD bit 2 clear, $7FFD bit 4 set. ROM 0 copies the switching
  routines to RAM at $5B00 (SWAP_ROM, SWAP_ROM_HIGH, GO_5B5A, ERROR_TO_ROM1 at $5B3A in ROM 0's sidecar).
- This ROM is the +3 BASIC command and syntax ROM, paged in while +3 BASIC lines are checked and run.
  `CALL_ROM2` at $3F00 here is the same bytes as in ROM 2 (read ROM 2's sidecar for it); $3E80 here calls
  ROM 0 (read its bytes). ROM 0's ERROR_TO_ROM1 pushes/jumps into this ROM: its `JP` lands at an address
  given in ROM 0's sidecar.
- 48K system variables keep their names (CH_ADD, E_LINE, FLAGS, ...). Variables in RAM bank 7 or at $5Bxx:
  describe by address and use.

## What to produce (a level-2 draft for your range)
1. A label for EVERY instruction start in your range that is a jump/call target and has none, and every
   routine reached from a table; a synopsis for each (one line for a loop label; a full one for a routine:
   what it does, Entry:/Exit:/Changes: where clear).
2. End-of-line comments where the purpose is not obvious, on the first line of each step, about one per
   1.5 instructions; never restating the mnemonic. Values as values, tests as questions, capital first,
   no full stop, <70 chars. No comment on a `.defw` after RST $28 (comment the RST line instead: which
   ROM 3 routine and why).
3. Data regions for bytes that are data and not yet marked (messages, menus, tables, the test program's
   texts): runs that decode as nonsense, checked against who reads them. Bit-7-ended text
   `"decode":"defc"`, $00/$FF-ended or plain ASCII `"decode":"text"`, filler `"fill"`, words `"type":"words"`.

Draft format (JSON):
{ "range": "...", "labels": {"$xxxx":"NAME"}, "synopses": {...}, "comments": {...},
  "regions": [{"start","end","type","decode"?,"why"}], "facts": ["..."] }
Labels: max 16 chars, A-Z 0-9 _, unique; on instruction starts or a data region's first byte. Synopsis
style: present tense; numbered steps; Exit:/Changes: last; no "we"; guesses only in "facts" ("probably").
Reply with the draft's path, counts and facts.
