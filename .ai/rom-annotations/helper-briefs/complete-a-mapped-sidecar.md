<!-- Template: the brief given to a helper completing a sidecar made by map-rom.py/build-mapped.py
     (used for the +3 ROM 0/1 variants). Replace <WORKDIR>; give SIDECAR, the variant and the draft path
     in the task. Merge its draft with apply-draft.py (fixes, removals, :replace= ranges). -->
# Brief: complete a mapped ROM 1 sidecar (ZX Spectrum +2A/+3 syntax ROM variants)

You complete the annotations of ONE variant of the +3's ROM 1 (the syntax ROM: +3 BASIC's syntax and commands) for Klive IDE's ROM sidecar.
You only WRITE ONE DRAFT FILE (given in your task); you do not edit the repository or any sidecar.

## The hard rule (D4) — read `.ai/rom-annotations/README.md` "The rule (decision D4)" first
Write only from the bytes in front of you. Do NOT use, recall or paraphrase any published commented
disassembly of any Spectrum ROM, nor remembered routine names or descriptions. **Never open any file in
`/Users/dotneteer/source/kliveide/_input/`** (commented disassemblies of these ROMs: forbidden). For hardware
this ROM drives through ports, describe what the code does (port, value, bits tested).

## What is already there
- v4.1's ROM 1 (English) is fully annotated: `src/public/roms/spp3-41-1.rom.dis` (812 labels; read it with
  `python3 .ai/rom-annotations/tools/annotated-view.py src/public/roms/spp3-41-1.rom.dis <v41 listing> <from> <to>`,
  making the listing with `node .ai/rom-annotations/tools/sp48-dis.cjs 0000 3FFF src/public/roms/spp3-41-1.rom.dis`).
  The same version's ROM 0 is annotated too (`spp3-40-0`, `spp3-41es-0`, `spp3e-0` .rom.dis): cite its names for calls into ROM 0.
- YOUR variant's sidecar was built by mapping v4.1's entries onto it by aligning instructions (provenance
  "derived"): it is given in your task (SIDECAR), with its listing (LISTING). Most of it is right; the
  rest is your job. View it: `python3 .ai/rom-annotations/tools/annotated-view.py SIDECAR LISTING 2100 2200`
  (run from /Users/dotneteer/source/kliveide). Its remaining unlabelled targets:
  `node .ai/rom-annotations/tools/check-annotations.cjs SIDECAR /tmp/x.json` then read "unlabelledTargets".
  Names in use: `LABELS=/tmp/names.txt node .ai/rom-annotations/tools/sp48-dis.cjs 0000 3FFF SIDECAR`.
- In ROM 1 three calls take their address from the word after them (decoded as .defw): `RST $28` into ROM 3,
  `CALL $3F00` into ROM 2 (+3DOS DOS_JUMPS entries), `CALL $3E80` into ROM 0. Calls to ERROR_128 and FILE_ERROR
  are followed by one error-code byte; those bytes already have 1-byte regions (add any that are missing).
  v4.1's report messages are in REPORT_TABLE/REPORT_MSGS (find them in your variant; the Spanish one's are Spanish). ROM 3's names: `<WORKDIR>/p0/names-rom3.txt`; ROM 2's (+3DOS):
  `<WORKDIR>/p0/names-rom2.txt`; the 128K editor ROM's: `<WORKDIR>/p0/names-128-0.txt` (same job = same name).
- House style: `.ai/rom-annotations/README.md`, `.ai/rom-annotations/sp48-authoring-guide.md` ("House style").

## What to produce for your range
1. Labels for every unlabelled jump/call target in your range (and routines reached from tables), each
   with a synopsis (Entry/Exit/Changes where clear). Reuse v4.1's name for code doing the same job;
   never reuse a name already used at another address in this sidecar.
2. End-of-line comments on new or changed code, about one per 1.5 instructions (first line of a step,
   tests as questions, capital first, no full stop, <70 chars). No comment on a .defw.
3. Data regions for data not yet marked (texts, menus, tables, inline words): bit-7-ended "defc",
   $FF/$00-ended or plain "text", filler "fill", "words". Data decoded as code makes phantom targets:
   marking it removes them.
4. "fixes": mapped entries in your range that are wrong for THIS ROM (texts quoting messages or menu
   items that differ here, addresses, a changed step): {"$xxxx": {"synopsis": "..."} or {"comment": "..."}}.

Draft format (JSON): { "range": "...", "labels": {"$xxxx":"NAME"}, "synopses": {...}, "comments": {...},
"regions": [{"start","end","type","decode"?,"why"}], "fixes": {...}, "facts": ["..."] }
Labels max 16 chars A-Z 0-9 _, on instruction starts or a data region's first byte. Synopsis style as the
existing entries. Check your draft by merging it into a COPY of the sidecar in the scratchpad and running
check-annotations on the copy (no unlabelled targets left in your range). Reply with path, counts, facts.
