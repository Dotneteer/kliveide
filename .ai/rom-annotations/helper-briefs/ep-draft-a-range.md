<!-- Template: the brief given to each helper agent drafting one offset range of an Enterprise 64/128 ROM page
     (first used for ep-exos21.rom page 0, EXOS 2.1's segment 00h, run at $C000). Replace <WORKDIR>, <ROM> and
     <PAGE> with the session's work folder, ROM file and 16K page; give each helper its range and draft path in
     the task. Merge the drafts with merge-drafts.py, then fix clashes by hand. For a page that holds IS-BASIC
     code (EXOS 2.1's segment 01h, the cartridges) add the section "IS-BASIC code" below and give the helpers the
     call dictionary first (basic-calls.md, written by two helpers before the ranges). -->
# Brief: draft level-2 annotations for part of an Enterprise ROM page

You draft annotations for one offset range of page <PAGE> of `src/public/roms/<ROM>` (a 16K segment of the
Enterprise 64/128's ROM, run at $C000) for Klive IDE's ROM sidecar. You only WRITE ONE DRAFT FILE (given in your
task); you do not edit the repository, any sidecar, or anything outside your draft (a throwaway probe excepted,
below).

## The hard rule (D4): read `.ai/rom-annotations/README.md` "The rule (decision D4)" first
Annotations are written from the bytes and from runs only. Commented disassemblies of these ROMs exist (on
community sites, in books and in emulator sources); you may have seen one in training. **That memory is
forbidden.**
- Never write a routine name, a RAM variable's meaning, a table boundary or a description that arrives before you
  have read the code. If a name "just comes", reject it and derive another from the code.
- **Never open anything under `/Users/dotneteer/source/kliveide/_input/`.** Do not search the web. GPL emulator
  sources (ep128emu, Xep128) are off limits for anything.
- **Names in Klive's own Enterprise code are not evidence** for routine names. Hardware facts there (ports,
  paging, NICK, DAVE) you may use: `src/emu/machines/enterprise/wasm/README.md` and the C files' comments.
- `<WORKDIR>/exos-spec.txt` is the EXOS 2.1 kernel specification (Hungarian, an official manual). Use it only
  for interface facts: function and action codes, variable names and numbers, error codes, descriptor formats,
  escape sequences. Mark an entry that states such a fact as manual (below). Never take a routine boundary,
  a RAM layout or a description of how the ROM does something from it: that comes from the code.
- System-segment variables without a published name (most of $B000-$BFEC) have no names here: describe them by
  address and by the use the code makes of them ("$BF79, set while an EXOS call is running").

## IS-BASIC code (only for a page that holds it)
- `RST 10h` is followed by a call list: routine bytes ended by $00, listed as `.defb` lines "(IS-BASIC call: ...)".
  Comment each routine byte with what that step does (from `basic-calls.md`), each operand line with what it is.
  A routine of this page that the call table reaches already has its label in `basic-calls.md`: use it exactly.
- `LD HL,nnnn / RST 20h` raises IS-BASIC error nnnn, `RST 18h` error 9000 + A when NZ. Say which error, with its
  text when known. `LD L,n` entries hidden in `LD DE,$xx2E` runs are entries inside instructions.
- Labels are unique across the whole ROM file: the other page's names are listed in the work folder.

## What you may read
- The bytes, through Klive's disassembler: the listing `<WORKDIR>/full.lst`
  (`OFFS @ADDR BYTES INSTRUCTION ; decoder comment`, page offset first, then the run address). A plain range:
  `python3 .ai/rom-annotations/tools/listing-range.py <WORKDIR>/full.lst 0100-0200`. The other EXOS segment
  when this one pages it: `PAGE=1 node .ai/rom-annotations/tools/ep-dis.cjs <from> <to>`.
- `<WORKDIR>/facts.md` (what is established, with evidence; read it first), `<WORKDIR>/dispatch.txt` (every
  routine the page's own tables reach), `<WORKDIR>/coverage.txt` (the listing with what a run executed in the
  first column: C code, R read as data, . untouched).
- House style: `.ai/rom-annotations/README.md` ("The tools") and the synopses in `src/public/roms/tvc12-d4.rom.dis`
  and `src/public/roms/zx81.rom.dis` for tone.

## What to produce (a level-2 draft for your range)
1. A label for EVERY jump/call target in your range that has none (an instruction start), and every routine a
   table reaches; a synopsis for each: one line for a loop or a branch inside a routine; for a routine what it
   does, then `Entry:` / `Exit:` / `Changes:` lines where clear, numbered steps for long ones. A routine that falls
   into the next one says so. Read past your range's ends when a routine crosses them, but label only inside it.
   An EXOS function says which code reaches it ("EXOS 24 (allocate segment):"); a device routine its device and
   entry ("VIDEO, write character (entry +14):").
2. End-of-line comments where the purpose is not obvious, about one per 1.5 instructions, on the first line of
   each step; never restating the mnemonic ("Increment HL" is useless; "Past the length byte" is right). Values as
   values, tests as questions ("Past the end?"), capital first, no full stop, under 70 characters. Name a labelled
   address by its label, not by its number. Name a port by what it is ("Page 3 = segment 0", "Video latch reset").
3. Data regions for bytes in your range that are data and not yet marked, checked against the code that reads
   them: text ended by $00 `"decode":"text"`, bit-7 ended `"defc"`, filler `"fill"`, word tables `"type":"words"`,
   other bytes `"type":"bytes"` (`rowBytes` 1-4 only). Data read as code makes false targets: marking it removes
   them; never label a false target. Code copied to RAM and run there stays code: say so in its synopsis.
4. "manual": the keys (`"$xxxx:label"`, `"$xxxx:line"`) of entries whose name or text states an interface fact
   from the specification (a function's name from the table position, an error code's name, a variable's name).
5. "facts": anything you established that others need (a RAM variable's use, a calling convention, a table's
   layout), each with the evidence (code address or run); guesses only with "probably".

Draft format (JSON):
{ "range": "XXXX-YYYY", "labels": {"$xxxx":"NAME"}, "synopses": {"$xxxx":"..."}, "comments": {"$xxxx":"..."},
  "regions": [{"start":"$xxxx","end":"$yyyy","type":"bytes","decode"?:"text","why":"read by $zzzz as ..."}],
  "manual": ["$xxxx:line"], "facts": ["..."] }
Keys are PAGE OFFSETS ($0000-$3FFF), never run addresses. Labels: max 16 characters, A-Z 0-9 _, unique in the
ROM; on instruction starts or a data region's first byte. A synopsis for a data region goes in "synopses" under
its start. Style: present tense, no "we", no full stop on comments; synopses are sentences.

## Checking your draft (do this before replying)
```
cd /Users/dotneteer/source/kliveide; W=<WORKDIR>; T=.ai/rom-annotations/tools; D=<your draft>
PAGE=<PAGE> python3 $T/merge-drafts.py $W $W/s0.dis $D.trial.dis $D
PAGE=<PAGE> node $T/ep-dis.cjs 0000 3FFF $D.trial.dis > $D.trial.lst; grep -v '\.def' $D.trial.lst > $D.code.lst
PAGE=<PAGE> node $T/apply-annotations.cjs $D.trial.dis $W/emptybatch.json $D.code.lst > /dev/null   # canonical form
node $T/check-annotations.cjs $D.trial.dis $D.check.json > /dev/null
python3 -c "import json;j=json.load(open('$D.check.json'));print(j['problems'][:5]);print([hex(x) for x in j['unlabelledTargets']['<PAGE>'] if 0xLO<=x<=0xHI]);print(j['labelsWithoutSynopsis'])"  # a count over the page: other ranges' labels count too
```
No unlabelled target may remain in your range (LO-HI), the problems list must be empty (other ranges' missing
labels are not your problem), and the merge must report no skipped label of yours. "LABEL IN DATA" from
apply-annotations for a label on a data region's first byte is expected. Every label needs a synopsis (level 2): a
one-line one for a branch or loop inside a routine. A new region changes the listing: re-run the listing on the
trial file and check the code around it still decodes.

## Running the ROM (optional, when the code alone leaves a behaviour unclear)
Copy `.ai/rom-annotations/tools/ep-probe-template.ts.txt` to `test/ep-hw/zz-probe-<your range>.test.ts` (set its
OUT to a file in <WORKDIR>) and run it with `npx vitest run --config build/vitest.config.ts --project e2e-cores
<file>`. It shows `createEpSession`, `bootToBasic()`, `typeKeys`, `runTo` with the page-3 check (the same address
runs in other segments), `step`, `peek`, `physical` and register reads. DELETE the probe when done and report the
observed values in "facts". Do not touch other probes.

Reply with the draft's path, the counts (labels, synopses, comments, regions) and the facts.
