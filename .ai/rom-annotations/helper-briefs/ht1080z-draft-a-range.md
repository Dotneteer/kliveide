<!-- Template: the brief given to each helper agent drafting one address range of the HT-1080Z BASIC ROM
     (ht1080z-s1.rom, 12K). Replace <WORKDIR> with the session's work folder; give each helper its range and
     draft path in the task. Merge the drafts with merge-drafts.py, then fix clashes by hand. -->
# Brief: draft level-2 annotations for part of the HT-1080Z BASIC ROM

You draft annotations for one address range of `src/public/roms/ht1080z-s1.rom` (the HT-1080Z's 12K BASIC,
$0000-$2FFF, Series I and II) for Klive IDE's ROM sidecar. You only WRITE ONE DRAFT FILE (given in your task);
you do not edit the repository, any sidecar, or anything outside your draft (a throwaway probe excepted, below).

## The hard rule (D4) — read `.ai/rom-annotations/README.md` "The rule (decision D4)" first
This ROM is Microsoft's Level II BASIC (the TRS-80 Model I's, as used in the HT-1080Z). Commented
disassemblies, symbol lists and Microsoft's own BASIC sources for it and its relatives are widely published, and
you have very probably read them in training. **That memory is forbidden.** Concretely:
- Never write a routine name, a RAM variable's meaning, a table boundary or a description that arrives before you
  have read the code. Microsoft-style short names (six-letter abbreviations and the like) and the names those
  listings use are exactly what is forbidden: name a routine after what YOUR reading of its code shows, in plain
  words (`PRINT_CR`, `FIND_LINE`, `FP_ADD`), never from recollection. If a name "just comes", reject it and
  derive another from the code.
- RAM addresses ($4000-$43FF workspace) have no official names here: describe them by address and by the use the
  code makes of them ("$40A7, the line buffer's address"). Give one a meaning only from code that uses it.
- **Never open anything under `/Users/dotneteer/source/kliveide/_input/`**: it holds commented disassemblies of
  exactly this ROM. Do not search the web.
- What you may use: the bytes (the listing), the IDE's decoder output, Klive's own source (the emulator core
  `src/emu/machines/ht1080z/`, its key map, `src/common/ht1080z/basicTokens.ts` for token names), runs on the real
  core (below), and the existing sidecar.

## Files (read-only for you)
- Listing: `<WORKDIR>/full.lst` (`ADDR BYTES INSTRUCTION ; decoder comment`), the whole ROM with the current
  regions. `RST $08` is followed by one data byte (`.defb`, "(expects ...)"): the character the BASIC text must
  hold next. $1608-$18F6 is listed as tables by the decoder (dispatch words, keywords, precedences, error codes).
  A plain range: `python3 .ai/rom-annotations/tools/listing-range.py <WORKDIR>/full.lst 0100-0200`; with the
  sidecar's labels and comments: `python3 .ai/rom-annotations/tools/annotated-view.py <WORKDIR>/s0.dis
  <WORKDIR>/full.lst 0100 0200` (run from /Users/dotneteer/source/kliveide).
- The current sidecar: `<WORKDIR>/s0.dis` (45 labels: restarts, device calls, boot, the power-on question, the
  syntax check, NEXT_CHAR, CP_HL_DE, TYPE_FLAGS, ERROR_E). Its names are taken; cite them.
- Dispatch: `<WORKDIR>/dispatch.txt` lists every routine the ROM's own tables reach, with the keyword or
  function the table entry is for (from the bytes and Klive's token table): name those after the keyword
  (`PRINT_CMD`, `SGN_FN`, house rule below), and say "the PRINT statement" in their synopses.
- Facts already established: `.ai/rom-annotations/ht1080z-authoring-guide.md` ("Facts the annotations rest on")
  and the last two HT-1080Z entries of `.ai/rom-annotations/PROVENANCE.md`.
- House style: `.ai/rom-annotations/README.md` ("The tools") and the synopses in `src/public/roms/zx81.rom.dis`
  for tone.

## Known facts
- The restarts jump through RAM ($4000-$4014): RST $08 EXPECT_CHAR, $10 NEXT_CHAR, $18 CP_HL_DE, $20 TYPE_FLAGS,
  $28/$30 RET hooks, $38 EI/RET. Device calls: DEV_INPUT/DEV_OUTPUT/DEV_CONTROL ($0013/$001B/$0023) with a device
  block in DE; KEY_READ $002B, DISPLAY_OUT $0033, PRINTER_OUT $003B, KEY_WAIT $0049.
- Errors: `LD E,code` then ERROR_E ($19A2); E / 2 indexes the two-letter table at $18C9 (NF, SN, RG, OD, FC, OV,
  OM, UL, BS, DD, /0, ID, TM, OS, LS, ST, CN, NR, RW, UE, MO, FD, SN). Write "stops with error code n (report XX)".
  The overlapping `LD BC,nn` entries at $1999-$19A1 hide `LD E,n` entries.
- RAM slots $4152-$41A5 hold 28 `JP $012D` (error $2C) at power-on, $41A6-$41E4 21 `RET`s: calls and jumps into
  them are hooks for code loaded later; say so ("the RAM hook at $41C4, a RET at power-on").
- $3000-$37FF is the extension ROM (a separate file, not yet annotated): say "the extension ROM's entry at $3xxx".
  $37E0-$37EF reads $FF on the HT-1080Z. Keyboard matrix $3800-$3BFF (row n at $3800 + 2^n), video RAM
  $3C00-$3FFF (64 x 16; Series I/II store letters as $00-$1F there).
- The type byte at $40AF: TYPE_FLAGS gives S for 2, Z for 3, neither for 4, NC for 8 or more.

## What to produce (a level-2 draft for your range)
1. A label for EVERY jump/call target in your range that has none (an instruction start), and every routine a
   table reaches; a synopsis for each: one line for a loop or a branch inside a routine; for a routine what it
   does, then `Entry:` / `Exit:` / `Changes:` lines where clear, numbered steps for long ones. A routine that falls
   into the next one says so. Read past your range's ends when a routine crosses them, but label only inside it.
2. End-of-line comments where the purpose is not obvious, about one per 1.5 instructions, on the first line of
   each step; never restating the mnemonic ("Increment HL" is useless; "Past the line's link" is right). Values as
   values, tests as questions ("Past the end?"), capital first, no full stop, under 70 characters. Name a labelled
   address by its label (yours or the sidecar's), not by its number.
3. Data regions for bytes in your range that are data and not yet marked (messages, number constants, tables, a
   RAM image), checked against the code that reads them: text ended by $00 or a quote `"decode":"text"`, bit-7
   ended `"defc"`, filler `"fill"`, word tables `"type":"words"`, other bytes `"type":"bytes"`. Data read as code
   makes false targets: marking it removes them; never label a false target. Do not mark $1608-$18F6 again.
   Code copied to RAM and run there stays code: say so in its synopsis.
4. "facts": anything you established that others need (a RAM variable's use, a calling convention), each with
   the evidence (code address or run); guesses only with "probably".

Draft format (JSON):
{ "range": "XXXX-YYYY", "labels": {"$xxxx":"NAME"}, "synopses": {"$xxxx":"..."}, "comments": {"$xxxx":"..."},
  "regions": [{"start":"$xxxx","end":"$yyyy","type":"bytes","decode"?:"text","why":"read by $zzzz as ..."}],
  "facts": ["..."] }
Labels: max 16 characters, A-Z 0-9 _, unique in the ROM; on instruction starts or a data region's first byte. A
synopsis for a data region goes in "synopses" under its start. Style: present tense, no "we", no full stop on
comments; synopses are sentences.

## Checking your draft (do this before replying)
```
cd /Users/dotneteer/source/kliveide; W=<WORKDIR>; T=.ai/rom-annotations/tools; D=<your draft>
python3 $T/merge-drafts.py $W $W/s0.dis $D.trial.dis $D
node $T/ht1080z-dis.cjs 0000 2FFF $D.trial.dis > $D.trial.lst
node $T/check-annotations.cjs $D.trial.dis $D.check.json > /dev/null
python3 -c "import json;j=json.load(open('$D.check.json'));print([hex(x) for x in j['unlabelledTargets']['0'] if 0xLO<=x<=0xHI])"
```
No unlabelled target may remain in your range (LO-HI), and the merge must report no skipped label of yours. A new
region changes the listing: re-run the listing on the trial file and check the code around it still decodes.

## Running the ROM (optional, when the code alone leaves a behaviour unclear)
A throwaway vitest file `test/ht1080z-hw/zz-probe-<your range>.test.ts` using `createHtSession` from
`test/harness/ht1080z` (read its README), run with
`npx vitest run --config build/vitest.config.ts --project e2e-cores <file>`; write results to a file in <WORKDIR>
(console.log is swallowed); DELETE the probe when done and report the observed values in "facts". Breakpoints:
`s.breakpoint(a)`, then `s.debug("continue")`, registers on `(s.machine as any)`.

Reply with the draft's path, the counts (labels, synopses, comments, regions) and the facts.
