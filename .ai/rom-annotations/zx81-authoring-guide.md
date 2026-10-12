# Authoring the ZX81 ROM Annotations

A standing brief for the next session reverse-engineering `zx81.rom` into its sidecar. Read
`README.md` (the D4 rule, provenance, the tools) and `PROVENANCE.md` (what each session did) first;
this file adds the method, the tools, the traps and the state of the work. Update it at the end of
a session: fold new learning in, replace what it supersedes, keep no history (that is
`PROVENANCE.md`'s job).

## Where the work lives

- **The working copy is `<Klive home>/RomAnnotations/zx81.rom.dis`** (`~/Klive/RomAnnotations/` on
  the author's machine), made with `rom-ann-new zx81.rom` and opened with `rom-ann-open zx81.rom`.
  It is *not* in the repository. Shipping it means copying it over `src/public/roms/zx81.rom.dis`
  unchanged and running `npm run rom:annotations` (which also regenerates the CRC index).
- `src/public/roms/zx81.rom.dis` is the author's own uncommitted file (the character set's
  synopses). Until it is indexed, `test/annotations/shippedRomSidecars.test.ts` ("has an index
  that is up to date") fails and `npm run build:check` stops before its type check; run
  `node scripts/check-types.cjs` directly for types. Do not run the indexer for the author
  unasked.
- Session log: `PROVENANCE.md`, one entry per piece of work (sidecar, what was added, the method,
  the runs, the manual facts, provenance). It is uncommitted with the working copy; commit it
  with the sidecar when that ships.

## The IDE is open on the same file

Klive follows the working copy for outside changes (`src/main/annotation-file-watcher.ts`,
`reloadAnnotationSessionFromDisk`), so an edit written to disk shows in the Disassembly view at
once, no restart. But the author edits in the IDE at the same time, and the IDE writes the whole
file on every edit. So:

- **Snapshot the live file, apply to the snapshot, and copy it back only if the live file still
  equals the snapshot** (`cmp -s live snapshot && cp trial live`). Never build on a backup from
  earlier in the session: the author's own edits land in between (they did, at `$1FFF-$2000`).
- After writing, `cmp` again a moment later to see the IDE did not write over it.
- **Regions that touch merge.** The IDE merges neighbouring regions of the same type and layout
  when it reads a sidecar (`mergeAdjacentRegions`), and its next save writes them merged: the
  unshifted/shifted key tables, the function/graphics tables and the syntax offsets/entries are
  each one region now. Mark a table's start with a synopsis; do not rely on a region boundary.

## The tools (`tools/`)

Run from the repository root; they load Klive's TypeScript through esbuild, as
`scripts/rom-annotations.cjs` does.

| Tool | What it does |
|---|---|
| `zx81-dis.cjs <from> <to> [sidecar]` | The ROM through Klive's `Z80Disassembler` with `Zx81CustomDisassembler` (report codes after RST $08, calculator codes after RST $28). With a sidecar, its regions shape the listing. **This is the only sanctioned way to read the code (D4).** |
| `listing-range.py <listing> A-B ...` | Prints address ranges of a saved listing. |
| `apply-annotations.cjs <sidecar> <batch.json> <code listing>` | Applies labels, line entries and regions through `formatRomSidecar`; refuses labels or lines that are not instruction starts in the given listing, labels over 16 characters; existing labels win; sets provenance (`observed`, `manual` for `manualLines`). A no-op batch leaves the file byte-identical. |
| `check-annotations.cjs <sidecar>` | The IDE's own readiness check (`checkRomSidecar`); `"problems": []` is clean, and it lists the unlabelled targets (the level 1 to-do). |
| `probe-template.ts.txt` | A throwaway harness probe (see "Running the ROM"). |

The routine for a piece of work:

```
S=<scratchpad>; T=.ai/rom-annotations/tools
cp ~/Klive/RomAnnotations/zx81.rom.dis $S/live.dis
node $T/zx81-dis.cjs 0000 1FFF $S/live.dis > $S/cur.lst; grep -v '\.def' $S/cur.lst > $S/code.lst
#   ... read, run probes, write $S/batch.json ...
cp $S/live.dis $S/trial.dis
node $T/apply-annotations.cjs $S/trial.dis $S/batch.json $S/code.lst
node $T/check-annotations.cjs $S/trial.dis
cmp -s ~/Klive/RomAnnotations/zx81.rom.dis $S/live.dis && cp $S/trial.dis ~/Klive/RomAnnotations/zx81.rom.dis
```

**A batch that adds regions is applied in two passes**: the regions alone first, the listing
regenerated from that file, then the whole batch against the new listing (labels inside a former
misdecode only become instruction starts after the region exists). Diff the instruction starts of
the two listings: outside the new regions nothing should change except a resync right after one.

Line keys in a batch are hex with `$` (`"$0419"`); a bare number is decimal (an earlier slip wrote
`$1001` for decimal 1001).

## Running the ROM (allowed: Klive's own runs)

`test/harness/zx81/` runs the real core with the real ROM. A probe is a throwaway test:

- Put it in `test/zx8081-hw/` (an e2e-cores folder; a core test elsewhere fails in the unit tier)
  and run it with `--project e2e-cores`. vitest swallows `console.log` here: write to a file.
  Delete it afterwards and record only the observed values in `PROVENANCE.md`.
- Typing: K mode makes the first letter a keyword (P PRINT, L LET, R RUN, G GOTO, M PAUSE,
  F FOR, N NEXT, H GOSUB, Y RETURN, I INPUT, O POKE). FUNCTION mode is SHIFT+NEWLINE
  (`typeChords([0, 30])`), then the key; the keys come from the ROM's own tables (function table
  at `$00CC`, key order at `$007E`): Z LN, X EXP, A ASN, S ACS, D ATN, F SGN, G ABS, Q SIN, W COS,
  E TAN, R INT, O PEEK, I CODE, U CHR$, Y STR$, L USR, K LEN, J VAL, H SQR, M PI, N NOT,
  B INKEY$. SHIFT tokens not in the typer: `typeChords([0, code])` with codes from
  `Zx8081KeyCode.ts` (SHIFT+4 TO, SHIFT+H **, SHIFT+D SLOW, SHIFT+F FAST).
- **The harness drops keys typed right after a chord**, and settles too short to finish a
  command: put `runFrames(10)` around chords and `runFrames(60+)` after a NEWLINE, and check the
  listing (`screenText()`) before trusting a program run. Twice a probe "contradicted" the code
  because two lines had never been stored.
- `runTo(address)` with a key held (`keyDown(30)`) stops inside the ROM; registers are on
  `(s as any).machine` (`pc`, `sp`, `af`, `bc`, `hl`, ...).

## Disassembly traps already met

- **Calculator codes outside RST $28.** The decoder knows codes only after `RST $28`. Codes
  reached by a calculator `jump-true`/`jump` past an end-calc, or run by `CALL $19A0`/`CALL $19A4`
  (series), are listed as Z80 instructions. Find them by following each jump-true/jump target;
  mark them as a `bytes` region with a synopsis that decodes them. Done so far: `$0E69`,
  `$15EA`, `$1A83`, `$1A96`, `$1C4E`, `$1CB1`, `$1D35`, `$1DEE`.
- **Entries inside calculator code cannot be labelled.** `sin` (`$1D49`) sits inside cos's codes,
  atn's |x| < 1 entry (`$1D89`) inside its own: the bytes are an RST $28 and a code when entered,
  codes jumped over otherwise. The listing shows one reading, so explain it in the synopsis.
- **Tables inside the code area**: key tables `$007E-$0110`, keyword spellings `$0111-$01FB`,
  editing-key jump table `$0562`, syntax tables `$0C29-$0CB9`, operand classes `$0D16`, operator
  priorities `$110F`, calculator constants `$1915` and operation table `$1923-$199C`. Many
  "unlabelled targets" the level tool lists are table bytes read as code: check before labelling.
- **Flags across instructions**: `RLA`/`RRA` leave S and Z alone (multiply's exponent at
  `$1809`), `RLCA` leaves Z alone (FP_TO_BC at `$15B2`). Trace by hand before describing.
- **Shared tails and fall-throughs**: NEXT_ITEM falls into LEN_DE_TO_HL; division jumps into
  multiply's `EXP_TAIL`; sqr falls into to-power; GOSUB falls into TEST_ROOM. A wrong exit
  description came from missing one; check what follows a routine's last instruction.

## ZX81 facts the annotations rest on

Each was read from code or run, not remembered:

- **Error return**: `ERR_SP`'s slot holds KEY_NEWLINE's return during the syntax check and the
  CALL SCAN_LINE's (`$0676`, the run loop) while running; GOSUB/RETURN move it. `$3E00` below
  RAMTOP is the GOSUB stack's bottom.
- **Display**: the display file runs as code at D_FILE + `$8000` (characters as NOPs, NEWLINE a
  HALT, INT at line end from R); borders are NMI-counted in SLOW mode. Hardware facts come from
  `src/emu/machines/zx8081/wasm/README.md` and `zx8081-ula.c`.
- **Numbers**: 5 bytes, exponent bias `$80` (0 = zero), sign in bit 7 of the first mantissa byte;
  a number in a program line is its digits then `$7E` and the 5 bytes, inserted by the syntax check.
- **Variables**: first byte kind bits (single-letter number `$60`+, long name `$A0`+ and the last
  character with bit 7, string `$40`+, FOR variable bit 7 set), `$80` ends the area.
- **FRAMES** bit 15 is set in normal running and clear while PAUSE counts (corrected in
  `Zx81SysVars.ts` after a run showed the old description backwards).

## State of the work

464 labels, 36 regions; the readiness check is clean; `level` stays 0 (139 unlabelled targets).
Annotated in full: start-up, the main loop and line editor, KEY_NEWLINE (store/run/report),
the statement scanner and syntax tables, the expression evaluator, LOOK_VARS, LET, FOR/NEXT,
GOTO/GOSUB/RETURN/RUN/CONT/RAND/POKE, PRINT and the screen printer, PRINT_FP, the number
conversions, the whole calculator (interpreter, every operation, series, the functions), the
display (frame, borders, INT, NMI), SLOW/FAST/PAUSE.

Still marked "Not annotated yet" or partial (grep the synopses for "Not annotated"):

- **Commands**: SAVE (`$02F6`), LOAD (`$0340`), LIST (`$0730`)/LLIST, COPY (`$0869`),
  PLOT/UNPLOT (`$0BAF`), SCROLL (`$0C0E`), DIM (`$1409`); INPUT's rest (`$0EE9`).
- **Variables**: SUBSCRIPTS past `$11BC`, STR_SLICE (`$1263`), CLASS_1's details, STK_STRING.
- **Helpers**: KEYBOARD (`$02BB`), SET_PRINT_POS (`$0918`), CLS_COLLAPSED (`$0A52`),
  LIST_LINES (how a full screen stops it), PRINT_TOKEN/FIND_TOKEN (spacing, carry),
  PRBUFF_OUT (`$0871`, the printer).
- Then level 1: label the remaining real targets (`check-annotations.cjs` lists them), and
  level 2: a synopsis for every label.

Suggested order: SCROLL and PLOT/UNPLOT (short, display file), DIM with SUBSCRIPTS and STR_SLICE
(arrays and slices together), LIST/LLIST with LIST_LINES and PRINT_TOKEN, then SAVE/LOAD (the
tape signal; Klive traps LOAD, see the core's README) and the printer (COPY, PRBUFF_OUT).
