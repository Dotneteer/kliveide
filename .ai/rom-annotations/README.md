# Authoring the Shipped ROM Annotations

Read this before adding or changing any `.rom.dis` under `src/public/roms/` (the Next's are in
`src/public/roms/zxnext/<setId>/`). The shipped
sidecars' `authoring` key points here. The plan is
`.plans/REVERSE_ENGINEERING_ANNOTATIONS_PLAN.md` (§5, §6); the user-facing model is
`.docs/annotations.md` ("ROM Annotations"); the provenance rule and the session log are
`PROVENANCE.md` beside this file.

## The rule (decision D4) — read it twice

Klive's ROM annotations are written **from scratch**. They are not copied, converted,
paraphrased or "checked against" any commented ROM disassembly, in print or online, any
existing label or symbol file for these ROMs, or any SkoolKit control or skool file for
them. That includes material you merely remember.

**If you are an AI author:** you have very probably read a well-known commented
disassembly of these ROMs during training. That memory is exactly what this rule forbids
you to use (trap T10). So:

- Describe **only what the instructions in front of you do**. Read the bytes through
  `npm run rom:annotations -- skeleton <file>` and the Disassembly view; work out the routine
  from them; then write.
- Never write a comment from recollection. If a sentence comes to mind ready-made — a
  turn of phrase, a description that arrives before you have read the code — throw it
  away and rewrite it from the code.
- Never take a **region boundary** (where a table starts or ends) from memory either:
  find it from the bytes and from the coverage run.
- Say in the session log what you looked at.

Review checks for this. A comment that cannot be traced to the code it sits on is
removed.

**Labels too.** A routine's name that comes to mind before you have read the routine is a
remembered one, however descriptive it sounds; so is a whole prefix family (`PO_`, `CO_`, ...).
Name a routine from what its code does, after reading it. The sp48 sessions had to rename 99
labels that slipped through this way (`PROVENANCE.md`, 2026-10-20).

## What may be used

- **The ROM bytes**, through Klive's own disassembler (`romDecoder.ts`, which also runs
  the ROM's custom decoding: report codes after `RST $08`, calculator literals after
  `RST $28`).
- **Klive's own observation**: `npm run rom:annotations -- coverage` (the access profile
  over BASIC scenarios: what is fetched as code, what is only read), execution history,
  breakpoints, the `test/harness/sp48`, `sp128` and `zx81` harnesses driving BASIC.
- **Interface facts from the official manuals**: system variables, report codes, the
  +3DOS call table and its entry conditions, the 128K/+3 paging ports. Recorded in
  Klive's own words, with the manual named in the session log.
- **Routine names (Q1)**: the community's conventional routine names are an interface
  vocabulary, like an API's names. A *name list* may be used — written as identifiers
  (`CL_ALL`, not `CL-ALL`; `STK_STO_STR` for `STK-STO-$`) and marked `manual`, with its
  source named in the log. Never the comments, region boundaries or descriptions that
  come with such a list. A name you are not sure belongs to an address is not used: give
  the address a Klive name and mark it `observed`.

## Provenance, per entry

Every label, line annotation (synopsis or end-of-line comment) and non-code region
carries a provenance in the sidecar's `provenance` map, keyed `<page>:<offset>:label`,
`<page>:<offset>:line` or `<page>:<start>:region`:

- `observed` — from the bytes or from a run;
- `manual` — an interface fact or a conventional name from a manual or a name list;
- `derived` — inherited by byte binding from another sidecar.

`test/annotations/shippedRomSidecars.test.ts` fails on an entry without one, and on a
provenance that names nothing.

## The file

- One sidecar per ROM file, named after it: `sp48.rom.dis`. `machine` is `"rom"`;
  `banks` is keyed by the 16K page within the file; `pages` gives each page's CRC-32 and a
  name; no `globalLabels`, no `debug`.
- A sidecar for a ROM that is mostly another one lists it in `inherits`
  (`[{ "sidecar": "sp48.rom.dis", "page": 0 }]`) and authors only what differs; the
  inherited labels are applied by byte binding at run time, not copied into the file.
- `level` records the completeness the file has reached (below).
- Labels are identifiers of at most 16 characters, unique within a page, on an
  instruction start inside a code region.

## The tools

**New work goes through the pipeline** (`npm run rom:pipeline`, `.plans/ROM_ANNOTATION_PIPELINE_PLAN.md`; the
code is `src/common/reverse/pipeline/`): `profile <recipe>` runs the machine, `prepare <rom>` writes routine
cards, region proposals, decoded texts and open questions (`.rom-annotations/work/<rom>/`), the AI writes `.ann`
files (the grammar is `annFormat.ts`'s header; a helper's brief is `helper-briefs/pipeline-range.md`),
`compile <rom> <ann...>` lays them over the sidecar and writes `problems.md` (each item with its fix) and
`feedback-page-<n>.md` (what the run says about the tools, D11), and `carry <from> <to>` carries a sidecar to
another version of its ROM. `listing <rom> <from>-<to> --why "..."` is the listing, recorded. The scripts it
replaced are listed in `tools/README.md`.

**Write every sidecar in `zx81.rom.dis`'s style**: system variables with underscores (CH_ADD, not CH-ADD),
synopses wrapped at 92 columns with a summary first (`RST $xx:` or the command name leading where it
applies), numbered steps for long routines; errors as "Stops with error code n (report X)"; comments
starting with a capital, no full stop, under 70 characters, tests as questions; a synopsis on every label;
and a routine doing the same job as one already named in another sidecar takes that name.

**A subroutine's synopsis ends with its contract** (D10 of the pipeline plan), in this order: `Entry:` (the
inputs: registers, flags, memory read before written; "none" when it takes nothing), `Exit:` (the outputs on
success), `Error:` (how failure is signalled, when it can fail; optional), `Changes:` (the registers whose
values change, 8-bit names where only one half does, then an alternate register with a prime, `AF'`, or "all
alternates"; other state after a semicolon), `Keeps:` (the main registers that hold their values, never the
alternates; optional), and `Observed:` (probe results). An alternate register that `Changes:` does not name
is unchanged. For example `Changes: AF, BC, DE, AF'.` and `Keeps: HL, IX, IY.` The pipeline's register facts
and its lint check `Changes:` and `Keeps:` against the code; the facts are "may change", so only a register
named in `Changes:` that every return keeps is an error.

The machine guides beside this file carry each ROM family's method, facts and state of the work:
`sp48-authoring-guide.md` (the 48K: naming lessons, the calculator traps, the level-2 comment pass),
`zx81-authoring-guide.md`, `ht1080z-authoring-guide.md`, `tvc-authoring-guide.md` (8K pages at $C000/$E000,
`RST $30`'s inline function code, the sources that are off limits) and `ep-authoring-guide.md` (16K segments
listed at $C000, EXOS calls and IS-BASIC's call lists, the sources that are off limits). Where they name a
retired script, `tools/README.md` gives the pipeline command that replaced it.

```
npm run rom:annotations                    # format every sidecar, regenerate the CRC index
npm run rom:annotations -- --check         # what build:check runs
npm run rom:annotations -- level           # each page's level and what keeps it from the next
npm run rom:annotations -- skeleton sp48.rom.dis
npm run rom:annotations -- bind sp48.rom.dis sp128-1.rom
npm run rom:annotations -- coverage        # writes .rom-annotations/coverage-sp48.json
npm run rom:annotations:carry -- zxnext/nextzxos-2.08/enNextZX.rom.dis zxnext/nextzxos-2.10/enNextZX.rom
npm run rom:pipeline -- carry ep-exos21.rom.dis ep-exos20.rom   # signatures, then an instruction alignment
```

`rom:annotations:carry` (D8 of `.plans/ZXNEXT_CORE_VERSIONS_PLAN.md`) moves a sidecar's entries to a newer
ROM whose bytes moved, by byte signature; the carried entries are `derived` and the file's `carriedFrom` names
the old sidecar. It writes a review list of everything it could not place and every carried comment to check
(the 2.10 set's are in `carry-review/nextzxos-2.10/`). A carried file is a starting point: its `level` is
measured again, and the review list is worked through from the new bytes like any other authoring session.
The 2.10 set was worked to level 2 that way (`PROVENANCE.md`, 2026-10-31). Lessons: a carry misses whole
routines when the calling convention changed (2.10 replaced `PUSH ret/PUSH $007B/PUSH routine/JP $007B` with
`RST $10` + word), drops data regions whose neighbours moved (syntax tables and texts then decode as code and
make false targets), and never flags RAM addresses or changed operand values in comments (2.10 moved bank 7's
variables by 4 and the version word $0208 to $E210); a decoder's fixed call addresses must be checked for each
new release too. The listing and check tools take the ROM from the sidecar's own path
(`zxnext/<set>/…`), not its bare `source.fileName`, which means the 2.08 set.

`rom:pipeline -- carry` uses the same re-anchoring core (now `src/common/reverse/pipeline/align/carry.ts`,
aware of where a page runs) and then aligns the two pages instruction by instruction: what the signatures lost
on a matched instruction is placed by the alignment, RAM addresses that moved are translated in the carried
text (where at least two matched instructions agree), and every routine is marked same, shifted or
different, so `prepare` sends only the different ones to the AI. On EXOS 2.1 to 2.0 it carries 1,109 of
page 0's 1,132 labels (the signatures alone: 579).

Always run the formatter before committing: the files are diffed one entry per line.

## Completeness levels (§5.6)

| Level | Content |
|---|---|
| 1 | Every `CALL`/`JP`/`RST`/`JR`/`DJNZ` target reached from code regions has a label; every data region is marked (tables, messages, the character set, calculator literals). |
| 2 | Level 1, plus a synopsis for every labelled routine (inputs, outputs, registers changed) and an end-of-line comment where an instruction's purpose is not obvious. |
| 3 | Comments on every non-trivial line. Not a goal. |

`level` measures the label rules; marking every data region is the author's judgement,
backed by the coverage run. A file never records a level higher than the tool measures.

## Authoring in the IDE

The shipped files can be authored in Klive itself (`.plans/ROM_ANNOTATION_EDITING_PLAN.md`)
instead of by editing JSON:

1. `rom-ann-new sp48.rom` copies `src/public/roms/sp48.rom.dis` unchanged into
   `<Klive home>/RomAnnotations/sp48.rom.dis` — the **working copy** — and opens it in the
   ROM annotation editor. From then on it replaces the shipped file everywhere in the IDE.
   A Next ROM is named by its path: `rom-ann-new zxnext/nextzxos-2.08/enNextZX.rom -page 0`. The
   `nextzxos-2.08` set's working copies stay flat (`RomAnnotations/enNextZX.rom.dis`); another set's
   are `RomAnnotations/zxnext/<setId>/<file>.dis` (`src/common/roms/romSidecarPaths.ts`).
2. Open a page's **Disassembly** and annotate it with the NEX viewer's dialogs and shortcuts.
   Set **New entries** to `manual` before adding an interface fact or a conventional name, and
   back to `observed` after; `rom-ann-provenance` corrects an entry afterwards. A changed entry
   keeps its provenance. The pages list's **To label** column counts the level 1 to-do list, and its **next $xxxx** link
   walks it.
3. The **Ready** chip (and `rom-ann-check`) runs every check `shippedRomSidecars.test.ts` makes. **Export as source…** (and `rom-ann-export`) proves the annotations still describe every byte: the file reassembles to the ROM.
   When it says *Ready to ship*, copy the working copy over the file in `src/public/roms/` (or its set folder)
   **unchanged** and run `npm run rom:annotations -- --check`; it must report nothing to format.
4. Log the session in `PROVENANCE.md` as for any other authoring session.

A name list (Q1) goes in with `rom-ann-import-names <rom> <list>`: one `NAME ADDRESS` per line,
nothing else from the source. Every name becomes a `manual` label; existing labels win, and names
too long for a label are reported for the author to shorten. Name the list's source in
`PROVENANCE.md`.

The working copy may also be edited **outside** the IDE (by hand or by an AI author) while Klive
runs: the main process follows every sidecar an annotation session holds open
(`src/main/annotation-file-watcher.ts`), and the session re-reads a changed file and publishes it to
the Disassembly view and the editor at once (`reloadAnnotationSessionFromDisk`). No restart is
needed. A file that does not parse is not taken: the IDE keeps its last good model until the file
is valid again — so a broken hand edit is overwritten by the next edit made inside the IDE.

**Bit-7 string tables are `defc` regions** (`"type": "bytes", "decode": "defc"`): keyword and
message tables whose entries end with bit 7 set list as one `.defc "TEXT"` row per entry and still
reassemble byte for byte. A table of other bytes that touches one stays a separate region, since the
types differ. **Runs of one filler byte are `fill` regions** (`"decode": "fill"`): the 48K ROM's
unused `$FF` bytes list as one `.fillb 1170,$FF` row.

**Regions that touch merge.** When the IDE reads a sidecar it merges neighbouring regions of the
same type and layout (`mergeAdjacentRegions` in `programAnnotations.ts`), and its next save writes
the merged one. Two tables that touch and share a type (the ZX81's unshifted and shifted key
tables, say) therefore cannot stay separate regions: mark each table's start with a synopsis
instead, or give them different layouts (`rowBytes`, `radix`, `decode`). An author editing the file
outside the IDE should also re-read it before each write: the IDE may have saved the user's own
edits, or a merge, since the last read.

The IDE never raises `level`; record it by hand once `npm run rom:annotations -- level`
measures it. The D4 rule above applies exactly as it does to editing the JSON: the editor
makes the work faster, not the sources wider.

## Order of work

`sp48.rom.dis` first (everything else inherits from it; done, at level 2), `sp128-1` by inheritance
(done, at level 2; `sp48-authoring-guide.md` explains `inherits`), then the +3 ROM 3s by inheritance
plus their differing routines, `sp128-0`, the +3 ROMs 0–2 (the +3DOS call
table from the +3 manual first), and the ZX81 and ZX80 ROMs. The HT-1080Z's are done, every one at level 2: the BASIC ROMs, the extension ROMs and the
character generators (`ht1080z-authoring-guide.md`). The Videoton TVC's are next: BASIC 1.2's SYS chips, its EXTH, BASIC 2.2's three chips,
then VT-DOS (`tvc-authoring-guide.md`). The Enterprise's are under way: EXOS 2.1 (both segments), the IS-BASIC 2.1
cartridge and the 64's EXOS 2.0 (both segments) are done to level 2; then IS-BASIC 2.0, and EXDOS 1.3 last
(`ep-authoring-guide.md`).
