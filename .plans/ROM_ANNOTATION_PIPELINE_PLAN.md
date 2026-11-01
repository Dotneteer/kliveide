# ROM Annotation Pipeline — Initial Plan

Status: **draft for discussion** (2026-11-01). Written at the end of a session that annotated four Enterprise
ROM pages to level 2 (EXOS 2.1 segments 00h and 01h, the IS-BASIC 2.1 cartridge, EXOS 2.0). It is meant to be
handed to another session and finished together with the project author. The open questions are in §9.

## 1. The idea

Annotating a ROM today is mostly an AI reading long disassembly listings and writing JSON drafts. Most of that
work is mechanical and could be done by deterministic tools:

- **Before the AI:** a **preprocessor** turns the ROM, its profile and what is already known into a compact,
  analysed form. That form has routines with their boundaries, callers, callees, RAM use, tables, texts and
  inline data already worked out, so the AI reads facts, not 11,000-line listings.
- **After the AI:** the AI writes its understanding in a **small, forgiving text format** (names, synopses,
  comments, data kinds), and a **compiler** turns it into the sidecar. The compiler does the canonical
  formatting, wraps lines, swaps addresses for names, records provenance, checks, measures the level and
  reports problems as a short list to fix.

The goal is that the AI spends its tokens only on what needs understanding: what a routine does, what to call
it, what a table means. Everything else is a program, run as often as needed at no AI cost.

## 2. Where the AI time went (measured in this session)

These are the costs a pipeline would remove or shrink. They were seen across 33 helper agents (13 for EXOS
2.1's segment 01h, 10 for the IS-BASIC 2.1 cartridge, 10 for EXOS 2.0) of about 125-350k tokens each.

| Work done by the AI | How often | Deterministic replacement |
|---|---|---|
| Paging through listings (`listing-range.py`) to find where routines start, what calls them, what they touch | every helper, constantly | routine cards (§4.2) |
| Finding data read as code (false targets), deciding region kinds | every range | the classifier from G7.3 plus table/text heuristics (§4.3) |
| Recognising inline data after restarts and calls (`RST 30h`, `RST 10h` call lists, `CALL $0E00` texts, `LD DE,$xx2E` hidden entries) | every ROM | per-ROM "conventions" plug-ins (§4.4) |
| Decoding packed texts and tables by hand-written Python (error messages, help pages, keyword tables, constants) | many helpers | decoder plug-ins whose output goes into the cards |
| Translating addresses between ROM versions (2.1 to 2.0: shifted code, moved RAM) | EXOS 2.0, 10 helpers | an aligner that maps instructions and RAM (§4.6) |
| Writing the JSON draft, running merge/apply/check, fixing format problems, re-running | every helper, several rounds | the annotation compiler (§5) |
| Name clashes, numbers to names, line wrapping, comment length, "probably" hunting, provenance keys | the session, after every merge | compiler passes and lint (§5.3) |
| Profile probes written by hand to get coverage | every ROM | one profile recipe per machine (§4.1) |

## 3. Shape of the pipeline

```
ROM bytes + kind + profile (+ an older sidecar)
        │  preprocess (deterministic)
        ▼
  analysis bundle: cards/, facts, maps, open questions
        │  AI reads, understands
        ▼
  .ann files (one per range, the small text format)
        │  compile (deterministic): validate, merge, name, wrap, measure
        ▼
  sidecar .rom.dis + problem list  ──► AI fixes only what the list names
```

Everything runs from one command, for example `npm run rom:pipeline -- prepare <rom> [--page n]` and
`npm run rom:pipeline -- compile <rom> <ann-dir>`. Both are re-runnable, and both write to a work folder
(`.rom-annotations/work/<rom>/`, git-ignored).

## 4. The preprocessor

### 4.1 Inputs

- The ROM page and its kind (`romIdentity.ts`), decoded through `romDecoderFor(kind)`, so the existing custom
  disassemblers (EXOS calls, IS-BASIC call lists, Spectrum calculator literals) apply.
- A **profile**: one recipe per machine that boots, types a standard script of commands and dumps
  code/read/write flags and call edges (the core already has them). The recipe for each machine is kept in
  the repository, not rewritten per session. It includes the offset map of the profile buffer (the
  Enterprise's ROMs are not at segment × $4000 there: the first cartridge profile came back empty).
- Optionally an **existing sidecar** for the same ROM, or one for a related ROM to carry from (§4.6).

### 4.2 Routine cards (the main output for the AI)

One small text block per routine (a routine is an entry point and the code it owns up to the next entry
point). For example:

```
== $0B40 (run $CB40)  entries from: EXOS 32 table $0028; jp $0B3D, $0B3E, $0B3F (fall-through)
   calls: $B217 (pager, RAM)    jumps: —    returns: ret
   RAM:   reads ($BF79) writes —    ports: —    EXOS calls: —
   coverage: ran (12 entries in the profile)
   size: 14 bytes, 6 instructions; inline data after it: none
   ---
   CB40  ex af,af'          ; A' = A
   CB41  ld hl,$C00D        ; another ROM's entry (other segment)
   ...
   known: label SEG1_SERVICE (carried, derived), synopsis exists
```

- Instructions are listed with operands already named where a name is known: labels, RAM variables from a
  machine's variable list, ports by function, and the EXOS/IS-BASIC routine names of other ROMs.
- Callers come from the code itself plus tables and the profile's call edges.
- **"What is still needed"** at the end of each card: no label, no synopsis, n uncommented lines, targets
  inside an instruction to explain.
- Cards are grouped into range files sized for one AI pass (balanced by work left, as this session did by
  hand).

### 4.3 Data and tables

- **Code or data:** the G7.3 classifier (coverage, reachability), plus the lesson of this session: a run of
  "targets" that land in the middle of other code means data read as code. The preprocessor proposes regions
  and shows what each one removes ("marking $25D2-$2847 as data removes 37 false targets").
- **Table detectors:** word tables whose words point at code (dispatch tables), byte runs that are printable
  (texts: zero-ended, bit-7-ended, length-first), repeated fixed-size records (descriptors, keyword tables),
  BCD numbers. Each candidate comes with the code that reads it and how (`LD HL,table / ADD HL,DE`).

### 4.4 Conventions, as plug-ins

Things a ROM does over and over, written once as small modules next to the custom disassemblers:

- inline bytes after a restart or a call (exists for disassembly; add the "explain" side: "RST 18h: raises
  error 9000 + A");
- hidden entries (`LD DE,$xx2E` runs, `LD A,n` hiding `OR $37`), found and listed with the value each entry
  loads ("$F537: LD L,$48, error 20040");
- packed-text decoders (EXOS/IS-BASIC 4-bit codes, the WP's bit stream, 2.0's phrase bytes), so the card
  shows the decoded text next to the bytes;
- error-number tables to text (from the ROM's own message table once decoded).

A plug-in is deterministic and testable. It is written from the ROM's code, under the same provenance rule
(D4) as the annotations.

### 4.5 Facts and maps

- **RAM map:** every RAM address the page uses, with readers and writers, and whether it is a known system
  variable (names from the machine's own list, `EpSysVars.ts` and others).
- **Ports and I/O:** every `IN`/`OUT` with the port's function from the machine's hardware notes.
- **Cross-page and cross-ROM calls:** a call into another page through a pager or gate, named with that
  page's labels.
- **Open questions:** targets inside instructions, never-run code, unreferenced bytes, the 16-bit checksum
  word: listed for the AI to settle, not left for it to discover.

### 4.6 Related ROMs (versions)

Generalise `rom:annotations:carry` and the alignment done by hand for EXOS 2.0:

- Align two ROMs instruction by instruction (with operand wildcards) and report shifted stretches ("2.0
  $1469-$25CF = 2.1 $149E-$2604 - $35").
- Build the **RAM translation map** from differing operands of aligned instructions, and apply it to carried
  text. The carry tool does not do this today; it cost a scan and a helper's correction.
- Mark every carried routine as same, shifted or different, and send only the different ones to the AI.

## 5. The annotation format and its compiler

### 5.1 The `.ann` format (proposal)

A plain text format that is cheap to write and hard to get wrong. One entry per block, keyed by offset or by
name:

```
@0B40 SEG1_SERVICE
  EXOS 32 (read time): segment 1 service 0; returns the time (C, D, E) ...
  Entry: A = the service number.   Exit: A = status.
  .0B41 A' = service number
  .0B44 Through the pager at $B217

data 0B3D-0B40 bytes "Four INC A entries"     # a region
text 017A-01B2 zero                           # kinds: zero, bit7, counted, raw
words 000A-002D
manual 0B40:label 0B40:line                   # provenance from a manual
replace 0B40:synopsis                         # for carried sidecars
```

- Line 1 of a block is `@offset NAME` (the name optional when one exists).
- The indented paragraph is the synopsis; `.offset text` lines are end-of-line comments.
- Data lines declare regions.
- Free wrapping: the compiler rewraps at 92 columns and keeps numbered steps and `Entry:/Exit:/Changes:`.

### 5.2 What the compiler does (all deterministic)

- Parses every `.ann` file and merges them in address order. Overlapping regions and duplicate names become
  problems, not silent skips.
- Swaps numbers for names in text where a label exists, skipping other ROMs' addresses and the explicit
  "offset" form; formats run addresses as offsets.
- Writes provenance (`observed`, `manual`, `derived`) from the file and from the `manual` lines.
- Canonicalises through `apply-annotations`, measures the level through `check-annotations`, and runs the
  reassembly check (`romSourceExport` and the assembler).
- Prints a **short problem list**, each item with the fix the AI should make: "unlabelled target $3688 called
  from $3891 (code, ran)".

### 5.3 Lint (deterministic house style)

The rules the session enforced by eye become checks:
- comment length under 70 and no full stop;
- no mnemonic restating;
- "probably" and "unclear" counted and listed;
- names at most 16 characters and unique across the file;
- names that clash with another ROM's label for a different job are flagged;
- `manual` keys must exist.

## 6. How a session would use it

1. `prepare` the ROM; the tool writes the cards, facts and open questions, and suggests the ranges.
2. The AI (or helpers, one per range) reads its range's cards and writes one `.ann` file. It does not open the
   listing unless a card says something is unclear.
3. `compile`; the AI fixes the problem list; repeat until clean.
4. The session reviews the questions the tools could not settle (runs, a probe), then installs.

## 7. Expected savings

To be measured on the next ROM (IS-BASIC 2.0 or EXDOS 1.3) against this session's numbers: helper tokens
per ROM, rounds of check/fix per helper, session merge time. The guess: one half to two thirds fewer AI
tokens, most of it from the cards (no listing paging) and the compiler (no format rounds).

## 8. Phases (first cut)

| Phase | What | Depends on |
|---|---|---|
| P0 | The `.ann` format and its compiler, wrapping the existing tools (`merge-drafts.py`, `apply-annotations.cjs`, `check-annotations.cjs`); convert one finished sidecar to `.ann` and back as a round-trip test | — |
| P1 | Routine cards from the decoder plus the existing sidecar (entries, callers, callees, RAM, coverage, "still needed") | P0 |
| P2 | Profile recipes per machine, kept in the repository; profile offsets known per core | — |
| P3 | Data and table detectors; region proposals with their effect on false targets | P1 |
| P4 | Convention plug-ins: hidden entries, inline texts, packed-text decoders (Enterprise first) | P1 |
| P5 | Version alignment with a RAM map; carry plus "same / shifted / different" | P1 |
| P6 | Lint and the problem list; update the helper brief and the authoring guides to the new workflow | P0 |
| P7 | Try it on IS-BASIC 2.0 and EXDOS 1.3; measure §7 | all |

## 9. Open questions for the author

1. **Where it lives:** the scripts in `.ai/rom-annotations/tools/` (today a mix of `.cjs` and `.py`), or
   TypeScript under `src/common/roms/` with tests, run through `scripts/`? A TypeScript core would let the IDE
   offer the cards and the `.ann` round trip too.
2. **The `.ann` format:** a new format, or an existing one (SkoolKit's `.ctl`/skool, which Klive already reads
   and writes, G7.5)? Skool is close but has no room for provenance or Klive's region kinds.
3. **Is `.ann` an authoring format kept in the repository** (diffs that read like prose), or only a work file
   compiled into the sidecar?
4. **The provenance rule (D4):** the tools may analyse only the ROM's own bytes, runs and Klive's own data.
   Plug-ins are written from the ROM's code like annotations. Is that enough, or do plug-ins need their own
   provenance record?
5. **How far should cards go** before they start to replace understanding with guesses (a suggested name from
   the strings a routine prints, for example)? The proposal: facts only, no suggested names.
6. **Which ROM to measure on first:** IS-BASIC 2.0 (a carried ROM: tests §4.6) or EXDOS 1.3 (new code: tests
   the cards).
