
> **Superseded for new work** by `pipeline-range.md` (the ROM annotation pipeline); kept for its machine-specific notes. The scripts it names that were retired are mapped in `../tools/README.md`.
<!-- Template: the brief given to the helper drafting one HT-1080Z extension ROM (2K at $3000-$37FF).
     Replace <WORKDIR>, <ROM> (ht1080z-s1-ext.rom / ht1080z-s64-ext.rom), <LISTING>, <SIDECAR> and give the
     draft path in the task. Merge with merge-drafts.py. -->
# Brief: draft level-2 annotations for an HT-1080Z extension ROM

You draft annotations for `src/public/roms/<ROM>`, one of the HT-1080Z's 2K extension ROMs, for Klive IDE's ROM
sidecar. You only WRITE ONE DRAFT FILE (given in your task); you do not edit the repository, any sidecar, or
anything outside your draft (a throwaway probe excepted, below).

## The hard rule (D4) — read `.ai/rom-annotations/README.md` "The rule (decision D4)" first
Write only from the bytes in front of you and from Klive's own runs and source. **Never open anything under
`/Users/dotneteer/source/kliveide/_input/`** (it holds commented disassemblies of these ROMs), do not search the
web, and never write a name, a meaning or a description that comes from memory of a published listing. Name a
routine after what your reading of its code shows. RAM addresses ($4000-$43FF) have no official names: describe
them by address and by use, or cite the BASIC sidecar's description of them.

## The ROM
- It sits at $3000-$37FF, above the 12K BASIC ($0000-$2FFF). BASIC never calls it: a user switches it on with
  `SYSTEM` and the answer `/12288` (= $3000), Klive's `HT1080Z_EXTENSION_ON` (`src/emu/machines/ht1080z/Ht1080zTyper.ts`).
  From there it patches BASIC's RAM vectors and device blocks so that its own code runs (find which, from the
  code: e.g. `LD ($4004),HL` re-points RST $10's vector, `LD ($401E),HL` the display block's driver).
- It is plain Z80 (no `RST $08` in it). Unused space is $FF filler: mark it `"decode":"fill"`.
- The ROM file's readme says the Series II extension adds the CLEAR-key accents; the HT-1080Z is Hungarian, and
  Klive's typer (`Ht1080zTyper.ts`) and key map (`Ht1080zKeyCode.ts`) show which keys and characters the
  machine has — use them as interface facts.

## Files (read-only for you)
- Listing: `<LISTING>`. Each row is `OFFSET @ADDRESS BYTES INSTRUCTION`: the first column is the page offset
  (0000-07FF), which is what every key in the draft and the sidecar uses ("$005C" for the routine at $305C);
  the `@` column is where it runs. Operands show run addresses ($305C). Regenerate it with regions:
  `node .ai/rom-annotations/tools/ht1080z-dis.cjs 0000 07FF <a sidecar>` (run from /Users/dotneteer/source/kliveide).
  A plain range: `python3 .ai/rom-annotations/tools/listing-range.py <LISTING> 0100-0200`.
- The current (empty) sidecar: `<SIDECAR>`.
- The BASIC ROM, fully annotated: `src/public/roms/ht1080z-s1.rom.dis`; its labels with the first line of each
  synopsis: `<WORKDIR>/basic-names.txt` (`$ADDR NAME  synopsis`). **Cite BASIC routines and RAM uses by those
  names and descriptions** ("calls BASIC's NEXT_CHAR"; "the display block's cursor address at $4020"). Read a
  BASIC routine's full synopsis with `python3 -c "import json;print(json.load(open('src/public/roms/ht1080z-s1.rom.dis'))['banks']['0']['lineAnnotations'][str(0xADDR)])"`.
- Facts already established: `.ai/rom-annotations/ht1080z-authoring-guide.md` ("Facts the annotations rest on").
- House style: `.ai/rom-annotations/README.md` ("The tools") and the synopses in `ht1080z-s1.rom.dis`.

## What to produce (level 2)
1. A label for EVERY jump/call target in the ROM (offsets; the check below lists them), and for each entry point
   (the jump table at the start, addresses the code stores into RAM vectors or device blocks); a synopsis for
   each: what it does, `Entry:` / `Exit:` / `Changes:` lines where clear, numbered steps for long ones; which
   BASIC vector or hook it replaces, and what it does differently from the BASIC routine it replaces.
2. End-of-line comments where the purpose is not obvious, about one per 1.5 instructions, on the first line of
   each step; never restating the mnemonic. Values as values, tests as questions, capital first, no full stop,
   under 70 characters. Name a labelled address by its label.
3. Data regions for every byte that is data (tables, texts, key or character maps, $FF filler), checked against
   the code that reads it: `"decode":"text"` for $00- or quote-ended text, `"defc"` bit-7 ended, `"fill"`
   filler, `"type":"words"` word tables, `"type":"bytes"` the rest. Data read as code makes false targets.
4. "facts": what you established, each with its evidence (code offset or run); guesses only with "probably".

Draft format (JSON), all keys page offsets:
{ "range": "0000-07FF", "labels": {"$xxxx":"NAME"}, "synopses": {"$xxxx":"..."}, "comments": {"$xxxx":"..."},
  "regions": [{"start":"$xxxx","end":"$yyyy","type":"bytes","decode"?:"text","why":"read at $zzzz as ..."}],
  "facts": ["..."] }
Labels: max 16 characters, A-Z 0-9 _; unique, and **not already used in the BASIC sidecar** (`basic-names.txt`):
an extension routine that replaces a BASIC one takes a distinct name (`EXT_...` prefix or a different word).

## Checking your draft (do this before replying)
```
cd /Users/dotneteer/source/kliveide; W=<WORKDIR>; T=.ai/rom-annotations/tools; D=<your draft>
python3 $T/merge-drafts.py $W <SIDECAR> $D.trial.dis $D
node $T/ht1080z-dis.cjs 0000 07FF $D.trial.dis > $D.trial.lst
node $T/check-annotations.cjs $D.trial.dis $D.check.json > /dev/null
python3 -c "import json;j=json.load(open('$D.check.json'));print(j['levels'],[hex(x) for x in j['unlabelledTargets']['0']],j['labelsWithoutSynopsis'])"
```
Level 2 with no unlabelled target and no label without a synopsis; "not in the format ..." is expected (the merge
output is canonicalised later). Delete the trial files afterwards (their names end in .json/.dis/.lst).

## Running the ROM (recommended for what the code alone leaves open)
A throwaway vitest file `test/ht1080z-hw/zz-probe-ext.test.ts` using `createHtSession` from `test/harness/ht1080z`
(read its README; `extensionOn()` runs SYSTEM /12288), run with
`npx vitest run --config build/vitest.config.ts --project e2e-cores <file>`; write results to a file in
<WORKDIR> (console.log is swallowed); DELETE the probe when done and report the observed values in "facts".
Breakpoints: `s.breakpoint(addr)` (run addresses, $3xxx), then `s.debug("continue")`, registers on
`(s.machine as any)`. Model: `createHtSession({ model: "ht1080z-s1" })` (or `ht1080z-s2`, `ht1080z-64`).

Reply with the draft's path, the counts (labels, synopses, comments, regions) and the facts.
