# Authoring the Shipped ROM Annotations

Read this before adding or changing anything in `src/public/roms/*.rom.dis`. The shipped
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

```
npm run rom:annotations                    # format every sidecar, regenerate the CRC index
npm run rom:annotations -- --check         # what build:check runs
npm run rom:annotations -- level           # each page's level and what keeps it from the next
npm run rom:annotations -- skeleton sp48.rom.dis
npm run rom:annotations -- bind sp48.rom.dis sp128-1.rom
npm run rom:annotations -- coverage        # writes .rom-annotations/coverage-sp48.json
```

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
2. Open a page's **Disassembly** and annotate it with the NEX viewer's dialogs and shortcuts.
   Set **New entries** to `manual` before adding an interface fact or a conventional name, and
   back to `observed` after; `rom-ann-provenance` corrects an entry afterwards. A changed entry
   keeps its provenance. **Next unlabelled** walks the level 1 to-do list.
3. The **Ready** chip (and `rom-ann-check`) runs every check `shippedRomSidecars.test.ts` makes.
   When it says *Ready to ship*, copy the working copy over the file in `src/public/roms/`
   **unchanged** and run `npm run rom:annotations -- --check`; it must report nothing to format.
4. Log the session in `PROVENANCE.md` as for any other authoring session.

The IDE never raises `level`; record it by hand once `npm run rom:annotations -- level`
measures it. The D4 rule above applies exactly as it does to editing the JSON: the editor
makes the work faster, not the sources wider.

## Order of work

`sp48.rom.dis` first (everything else inherits from it), then `sp128-1` and the +3 ROM 3s
by inheritance plus their differing routines, `sp128-0`, the +3 ROMs 0–2 (the +3DOS call
table from the +3 manual first), and the ZX81 and ZX80 ROMs.
