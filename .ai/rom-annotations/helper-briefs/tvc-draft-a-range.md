<!-- Template: the brief given to each helper agent drafting one offset range of a Videoton TVC BASIC ROM chip
     (first used for tvc12-d4.rom, BASIC 1.2's SYS low chip, 8K run at $C000). Replace <WORKDIR> and <ROM> with the
     session's work folder and chip; give each helper its range and draft path in the task. Merge the drafts with
     merge-drafts.py, then fix clashes by hand. -->
# Brief: draft level-2 annotations for part of a Videoton TVC BASIC ROM chip

You draft annotations for one offset range of `src/public/roms/<ROM>` (an 8K chip of the Videoton TVC's BASIC) for
Klive IDE's ROM sidecar. You only WRITE ONE DRAFT FILE (given in your task); you do not edit the repository, any
sidecar, or anything outside your draft (a throwaway probe excepted, below).

## The hard rule (D4) — read `.ai/rom-annotations/README.md` "The rule (decision D4)" first
Annotations are written from the bytes and from runs only. A commented listing of these ROMs exists (in the rtvc
emulator's repository and in scanned books); you may have seen one in training. **That memory is forbidden.**
- Never write a routine name, a RAM variable's meaning, a table boundary or a description that arrives before you
  have read the code. If a name "just comes", reject it and derive another from the code.
- **Never open anything under `/Users/dotneteer/source/kliveide/_input/`.** Do not search the web.
- **Names in Klive's own TVC code are not evidence**: some came from rtvc's symbol file (`KB_CHIN` in
  `test/harness/tvc/session.ts` and `src/emu/machines/tvc/tvcMachineInfo.ts` is one). Never copy a routine name
  from `src/emu/machines/tvc/`, `test/harness/tvc/` or `.plans/`. Hardware facts there (ports, paging, the CRTC,
  the interrupt) you may use.
- RAM addresses (system variables around $0B00-$0BFF and elsewhere) have no names here: describe them by address
  and by the use the code makes of them ("$0B19, the top of RAM found at reset"). Meaning only from code.

## What you may read
- The bytes, through Klive's disassembler: the listing `<WORKDIR>/full.lst`
  (`OFFS @ADDR BYTES INSTRUCTION ; decoder comment`, page offset first, then the run address). A plain range:
  `python3 .ai/rom-annotations/tools/listing-range.py <WORKDIR>/full.lst 0100-0200`. The other chip of SYS
  (`tvc12-d3.rom`, $E000-$FFFF) when this chip calls into it:
  `ROM=tvc12-d3.rom node .ai/rom-annotations/tools/tvc-dis.cjs <from> <to>` (offsets: address - $E000).
- `<WORKDIR>/facts.md` (what is established, with evidence), `<WORKDIR>/dispatch.txt` (every routine the ROM's own
  tables reach), `<WORKDIR>/coverage.txt` (what a run executed: C code, R read as data, . untouched).
- The emulator core's hardware description: `src/emu/machines/tvc/wasm/README.md`, the comment at the top of
  `src/emu/machines/tvc/wasm/tvc/tvc-memory.c` (paging, port 02h), `_input` excepted.
- House style: `.ai/rom-annotations/README.md` ("The tools") and the synopses in `src/public/roms/zx81.rom.dis`
  and `src/public/roms/ht1080z-s1.rom.dis` for tone.

## What to produce (a level-2 draft for your range)
1. A label for EVERY jump/call target in your range that has none (an instruction start), and every routine a
   table reaches; a synopsis for each: one line for a loop or a branch inside a routine; for a routine what it
   does, then `Entry:` / `Exit:` / `Changes:` lines where clear, numbered steps for long ones. A routine that falls
   into the next one says so. Read past your range's ends when a routine crosses them, but label only inside it.
   Statement routines from the dispatch table are named after their keyword (`PRINT_CMD`, `GOTO_CMD`) and their
   synopsis says "The PRINT statement". A system call function says which code reaches it ("RST $30 code $21:").
2. End-of-line comments where the purpose is not obvious, about one per 1.5 instructions, on the first line of
   each step; never restating the mnemonic ("Increment HL" is useless; "Past the length byte" is right). Values as
   values, tests as questions ("Past the end?"), capital first, no full stop, under 70 characters. Name a labelled
   address by its label, not by its number. A call into the other chip: "the SYS high chip's $FE79".
3. Data regions for bytes in your range that are data and not yet marked, checked against the code that reads
   them: text ended by $00 `"decode":"text"`, bit-7 ended `"defc"`, filler `"fill"`, word tables `"type":"words"`,
   other bytes `"type":"bytes"` (`rowBytes` 1-4 only). Data read as code makes false targets: marking it removes
   them; never label a false target. Code copied to RAM and run there stays code: say so in its synopsis.
4. "facts": anything you established that others need (a RAM variable's use, a calling convention, a table's
   layout), each with the evidence (code address or run); guesses only with "probably".

Draft format (JSON):
{ "range": "XXXX-YYYY", "labels": {"$xxxx":"NAME"}, "synopses": {"$xxxx":"..."}, "comments": {"$xxxx":"..."},
  "regions": [{"start":"$xxxx","end":"$yyyy","type":"bytes","decode"?:"text","why":"read by $zzzz as ..."}],
  "facts": ["..."] }
Keys are PAGE OFFSETS ($0000-$1FFF), never run addresses. Labels: max 16 characters, A-Z 0-9 _, unique in the
ROM; on instruction starts or a data region's first byte. A synopsis for a data region goes in "synopses" under
its start. Style: present tense, no "we", no full stop on comments; synopses are sentences.

## Checking your draft (do this before replying)
```
cd /Users/dotneteer/source/kliveide; W=<WORKDIR>; T=.ai/rom-annotations/tools; D=<your draft>
python3 $T/merge-drafts.py $W $W/s0.dis $D.trial.dis $D
node $T/tvc-dis.cjs 0000 1FFF $D.trial.dis > $D.trial.lst; grep -v '\.def' $D.trial.lst > $D.code.lst
node $T/apply-annotations.cjs $D.trial.dis $W/emptybatch.json $D.code.lst > /dev/null   # canonical form
node $T/check-annotations.cjs $D.trial.dis $D.check.json > /dev/null
python3 -c "import json;j=json.load(open('$D.check.json'));print(j['problems'][:5]);print([hex(x) for x in j['unlabelledTargets']['0'] if 0xLO<=x<=0xHI])"
```
No unlabelled target may remain in your range (LO-HI), the problems list must be empty, and the merge must report
no skipped label of yours. "LABEL IN DATA" from apply-annotations for a label on a data region's first byte is
expected. Every label needs a synopsis (level 2): a one-line one for a branch or loop inside a routine. A new region changes the listing: re-run the listing on the trial file and check the
code around it still decodes.

## Running the ROM (optional, when the code alone leaves a behaviour unclear)
A throwaway vitest file `test/tvc-hw/zz-probe-<your range>.test.ts` using `createTvcSession` from
`test/harness/tvc` (`{ model: "tvc64" }` is BASIC 1.2; `bootToBasic()`, `typeKeys("...\n")`, `runFrames(n)`,
`runTo(address)`, `step(n)`, `breakpoint(a)` + `debug("continue")`, `peek`/`peekWord`; registers on
`s.machine as any`). `typeKeys` runs the line at once, so to catch a breakpoint in a command type it without
the "\n", arm the breakpoints, hold `TvcKeyCode.Return` (`keyDown`) and `debug("continue")`, which THROWS on its
frame limit (catch it: no more hits), run with `npx vitest run --config build/vitest.config.ts --project e2e-cores <file>`. Write
results to a file in <WORKDIR> (console.log is swallowed); DELETE the probe when done and report the observed
values in "facts". Do not touch other probes.

Reply with the draft's path, the counts (labels, synopses, comments, regions) and the facts.
