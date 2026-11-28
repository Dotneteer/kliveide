<!-- Template: the brief given to each helper agent drafting one offset range of a SAM Coupé ROM page (first used
     for sam-rom30.rom page 0, ROM0, 2026-11-28). Replace <WORKDIR> and <PAGE>; give each helper its range (LO-HI)
     and draft path in the task. The work folder holds full.lst, coverage.txt (and coverage-rom1.txt / rom1.lst for
     the other page), facts.md, s0.dis (the sidecar so far) and emptybatch.json. Merge the drafts with
     merge-drafts.py, then fix clashes by hand (sam-authoring-guide.md). -->
# Brief: draft level-2 annotations for part of a SAM Coupé ROM page

You draft annotations for one offset range of page <PAGE> of `src/public/roms/sam-rom30.rom` (the SAM Coupé's ROM
3.0; page 0 is ROM0 at $0000, page 1 is ROM1 at $C000) for Klive IDE's ROM sidecar. You only WRITE ONE DRAFT FILE
(given in your task); you do not edit the repository, any sidecar, or anything outside your draft (a throwaway
probe excepted, below).

## The hard rule (D4): read `dev/ai/rom-annotations/README.md` "The rule (decision D4)" first
Annotations are written from the bytes and from runs only. A commented disassembly and source listings of the SAM
ROM exist, and emulators ship symbol files for it; you may have seen them in training. **That memory is forbidden.**
- Never write a routine name, a RAM variable's meaning, a table boundary or a description that arrives before you
  have read the code. If a name "just comes", reject it and derive another from the code. Spectrum ROM names are
  memory too: do not reuse them because a SAM routine looks similar.
- **Never open anything under `/Users/dotneteer/source/kliveide/dev/research/`.** Do not search the web. Emulator
  sources (SimCoupé, MAME, ZEsarUX) and their symbol files are off limits.
- `<WORKDIR>/facts.md` holds the interface facts from the SAM Coupé Technical Manual (system variable names,
  formats, the jump table): you may use those, and mark an entry that states one as manual (below). Never take a
  routine boundary or how the ROM does something from the manual: that comes from the code.
- Klive's SAM source (`src/emu/machines/samcoupe/`) gives hardware facts (ports, paging, the ASIC); its names are
  not evidence for routine names.

## What you may read
- The bytes, through Klive's disassembler: `<WORKDIR>/full.lst` (`OFFS BYTES INSTRUCTION ; decoder comment`, page
  offsets) and `<WORKDIR>/coverage.txt` (the same with a first column C executed, R read as data, . untouched).
  A range: `python3 dev/ai/rom-annotations/tools/listing-range.py <WORKDIR>/full.lst 0300-0400`. ROM1 (the other
  page, for calls into it): `<WORKDIR>/rom1.lst` / `coverage-rom1.txt` (offset, then `@` and the $C000 address).
- The labels and synopses already in the file: `<WORKDIR>/s0.dis` (JSON; `banks."0".localLabels` and
  `lineAnnotations`), or `python3 dev/ai/rom-annotations/tools/annotated-view.py` (see its header).
- `<WORKDIR>/facts.md` first. House style: `dev/ai/rom-annotations/README.md` ("The tools": the synopsis contract)
  and the synopses in `s0.dis` ($0000-$0293) and `src/public/roms/zx81.rom.dis`.

## ROM1 (page 1) only
- Keys are still page offsets ($0000-$3FFF); the listing shows `OFFS @ADDR`, and ROM1 runs at $C000 + offset.
  In synopses and comments write ROM1 addresses as run addresses ($Cxxx-$Fxxx) only when you say "ROM1 $xxxx".
- ROM0 is done: `<WORKDIR>/rom0.asm` (its annotated source) tells you what a ROM0 routine ROM1 calls does;
  name it by its ROM0 label. `<WORKDIR>/rom0-labels.txt`: names you must not reuse.
- `<WORKDIR>/entries-from-rom0.txt`: the ROM1 entries ROM0 reaches; each in your range gets a label even if the
  level check does not ask for it, and its synopsis names the ROM0 caller or jump table entry.
- ROM1 holds much of the data: the keyword list, message tables, the command and channel tables, calculator
  constants, the font. Mark them; their decoded "targets" are false and disappear.

## What to produce (a level-2 draft for your range)
1. A label for EVERY jump/call target in your range that has none (an instruction start), and every routine a
   table or a `RST $30`/`CALL $0201` word reaches; a synopsis for each: one line for a loop or a branch inside a
   routine; for a routine what it does, then the contract (`Entry:`, `Exit:`, `Error:` when it can fail,
   `Changes:`, `Keeps:` optional) where clear, numbered steps for long ones. A routine that falls into the next
   one says so. Read past your range's ends when a routine crosses them, but label only inside it. A routine a
   jump table entry reaches says which entry ("JPLOT's body: ...").
2. End-of-line comments where the purpose is not obvious, about one per 1.5 instructions, on the first line of
   each step; never restating the mnemonic ("Increment HL" is useless; "Past the length byte" is right). Values as
   values, tests as questions ("Past the end?"), capital first, no full stop, under 70 characters. Name a labelled
   address by its label, a system variable by its name from facts.md, a port by what it is ("LMPR: ROM1 in").
   A `RST $08` error: "Stops with error code n" (the decoder shows n; there is no list of BASIC's messages).
3. Data regions for bytes in your range that are data and not yet marked, checked against the code that reads them
   (and the coverage: R lines): text ended by $00 or a length `"decode":"text"`, bit-7 ended `"decode":"defc"`,
   filler `"decode":"fill"`, word tables `"type":"words"`, other bytes `"type":"bytes"` (`rowBytes` 1-4 only).
   Data read as code makes false targets: marking it removes them; never label a false target. Code copied to RAM
   and run there stays code: say so in its synopsis. Keyword and message tables are common in a BASIC ROM: find
   their readers and their ends from the code.
4. "manual": the keys (`"$xxxx:label"`, `"$xxxx:line"`) of entries whose name or text states an interface fact from
   facts.md's manual part (a system variable's documented meaning, a jump table entry's documented contract).
5. "facts": anything you established that others need (a RAM variable's use, a calling convention, a table's
   layout, a routine other ranges call and what it does), each with the evidence (code address or run); guesses
   only with "probably".

Draft format (JSON):
{ "range": "XXXX-YYYY", "labels": {"$xxxx":"NAME"}, "synopses": {"$xxxx":"..."}, "comments": {"$xxxx":"..."},
  "regions": [{"start":"$xxxx","end":"$yyyy","type":"bytes","decode"?:"text","why":"read by $zzzz as ..."}],
  "manual": ["$xxxx:line"], "facts": ["..."] }
Keys are PAGE OFFSETS ($0000-$3FFF). Labels: at most 16 characters, A-Z 0-9 _, unique in the ROM (other helpers
name other ranges: prefer specific names, "PRINT_NUM_DIGITS" not "LOOP"); on instruction starts or a data region's
first byte. A synopsis for a data region goes in "synopses" under its start. Style: present tense, no "we", no
full stop on comments; synopses are sentences. Write synopses with "\n" between the summary and each contract line.

## Checking your draft (do this before replying)
```
cd /Users/dotneteer/source/kliveide; W=<WORKDIR>; T=dev/ai/rom-annotations/tools; D=<your draft>
PAGE=<PAGE> python3 $T/merge-drafts.py $W $W/s0.dis $D.trial.dis $D
PAGE=<PAGE> node $T/sam-dis.cjs 0000 3FFF $D.trial.dis > $D.trial.lst; grep -v '\.def' $D.trial.lst > $D.code.lst
PAGE=<PAGE> node $T/apply-annotations.cjs $D.trial.dis $W/emptybatch.json $D.code.lst > /dev/null   # canonical form
node $T/check-annotations.cjs $D.trial.dis $D.check.json > /dev/null
python3 -c "import json;j=json.load(open('$D.check.json'));print(j['problems'][:5]);print([hex(x) for x in j['unlabelledTargets']['<PAGE>'] if 0xLO<=x<=0xHI]);print(j['labelsWithoutSynopsis'])"  # a count over the page: other ranges' labels count too
```
No unlabelled target may remain in your range (LO-HI), the problems list must be empty (other ranges' missing
labels are not your problem), and the merge must report no skipped label of yours. "LABEL IN DATA" from
apply-annotations for a label on a data region's first byte is expected. Every label needs a synopsis (level 2).
A new region changes the listing: re-run the listing on the trial file and check the code around it still decodes
(an instruction that now starts inside your region, or a region that cuts an instruction, is wrong).

## Running the ROM (optional, when the code alone leaves a behaviour unclear)
`test/harness/samcoupe/session.ts`: `createSamSession()`, `bootToBasic()`, `typeKeys("PRINT 1\n")`, `runTo(addr)`,
`step(n)`, `peek`, `sysVarWord`, `page(page, offset)`, `machine.getRegisters()`-style reads through `s.machine`. Put a
probe in `test/sam-hw/zz-probe-<your range>.test.ts` (write results to a file in <WORKDIR>) and run it with
`npx vitest run --config build/vitest.config.ts --project e2e-cores <file>`. DELETE the probe when done and report the
observed values in "facts". Do not touch other probes or `zz-coverage-probe.test.ts`.

Reply with the draft's path, the counts (labels, synopses, comments, regions), the merge check's result for your
range, and the facts.
