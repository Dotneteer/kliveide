# Authoring the HT-1080Z ROM Annotations

A standing brief for the sessions reverse-engineering the HT-1080Z ROMs into their sidecars. Read
`README.md` (the D4 rule, provenance, the tools) and `PROVENANCE.md` (what each session did) first; this
file adds what is particular to these ROMs. Update it at the end of a session: fold new learning in,
replace what it supersedes, keep no history (that is `PROVENANCE.md`'s job).

## D4 is at its sharpest here

The BASIC is Microsoft's Level II BASIC, a ROM with several widely published commented disassemblies and
symbol lists, which an AI author has almost certainly met in training. So a routine's familiar name, a
table's familiar boundary or a system variable's familiar meaning **is the trap**, however right it feels.
Name a routine from what its instructions do, after reading them; take a boundary from the bytes and the
code that reads them; give a RAM address a meaning only from code that uses it or a run that shows it.
A Q1 name list may be used only as `README.md` says (identifiers, `manual`, its source logged).

## Which ROM, and the order of work

| File | What | Plan |
|---|---|---|
| `ht1080z-s1.rom` | Series I BASIC, 12K at $0000-$2FFF | **Done, level 2.** Series II's is byte-identical, so this one sidecar covers both |
| `ht1080z-s64.rom` | HT-1080Z/64 BASIC 2.20 | **Done, level 2**: `inherits` s1 and authors its 5 changed runs (MEMORY SIZE and the banner, no letter fold, no printer paging, CLEAR through EVAL_INT) |
| `ht1080z-s1-ext.rom` | Series I extension, 2K at $3000-$37FF | **Done, level 2.** BASIC never calls it: SYSTEM, /12288 runs it |
| `ht1080z-s2-ext.rom` | Series II extension | **Done, level 2**: `inherits` s1-ext; adds the CLEAR-key accents (ACCENT_KEY_DRV, ACCENT_TABLE) and drops the switch-on message |
| `ht1080z-s64-ext.rom` | /64 extension 2.51 | **Done, level 2**: its own sidecar (7 of 8 pages differ), s1-ext's names and wording where the bytes are the same; its own keyboard decoder and an accent mode in the display driver |
| `*-chargen.rom` | Character generators | **Done, level 2**: one binary-row region, a synopsis per glyph, read from rendered glyph sheets |

## Where the work lives

- `src/public/roms/ht1080z-s1.rom.dis` is the sidecar, edited directly so far (there is no working copy in
  `~/Klive/RomAnnotations/`). To author in the IDE, `rom-ann-new ht1080z-s1.rom` copies it to a working
  copy, and the snapshot/compare/copy-back routine of `zx81-authoring-guide.md` applies from then on.
- **The running machine shows it.** The machine reports the BASIC as ROM page -1 ($0000-$2FFF) and the
  extension as -2 ($3000-$37FF), each its own file (`HT1080Z_ROM_PAGES` in `bankSpace.ts`), and the
  `ht1080z` bank space places each page's offsets at its own start. So a sidecar for an extension ROM
  counts from 0, like any ROM file, and its labels show from $3000.

## Pages that do not start at $0000

The extension ROMs run at $3000. Their page kind `ht1080z-ext` has an origin (`romKindOrigin` in
`romIdentity.ts`): `romDecoder.ts` decodes such a page at $3000 and hands back page offsets and targets, so the
level tool, the readiness check and `ht1080z-dis.cjs` count `JP $3005` as a jump to offset 5, and a call into
BASIC as no target of the page. The sidecar's keys stay page offsets. `ht1080z-dis.cjs` prints the offset first
and `@` the run address. In the running machine the bank space puts the page at $3000 (`HT1080Z_ROM_PAGES`);
the ROM page editor and Export as source still list it from $0000 (the bytes reassemble the same).

## The tools

`tools/ht1080z-dis.cjs <from> <to> [sidecar]` lists the ROM through Klive's disassembler with the decoding
`romDecoder.ts` gives the `ht1080z-basic` kind (`Ht1080zCustomDisassembler`). The ROM is the sidecar's
`source.fileName`, else `$ROM`, else `ht1080z-s1.rom`. `apply-annotations.cjs` and
`check-annotations.cjs` work on its sidecar as on the ZX81's. The routine:

```
S=<scratchpad>; T=.ai/rom-annotations/tools; F=src/public/roms/ht1080z-s1.rom.dis
node $T/ht1080z-dis.cjs 0000 2FFF $F > $S/cur.lst; grep -v '\.def' $S/cur.lst > $S/code.lst
#   ... read, run probes, write $S/batch.json ...
cp $F $S/trial.dis
node $T/apply-annotations.cjs $S/trial.dis $S/batch.json $S/code.lst
node $T/check-annotations.cjs $S/trial.dis        # "problems": [] is clean
cp $S/trial.dis $F && npm run rom:annotations -- level ht1080z-s1.rom.dis
```

A batch with regions goes in two passes (README): the regions alone, then the listing regenerated, then
the batch again. Re-applying a region the file already has is now skipped, so the whole batch can go in
the second pass.

## Running the ROM

`test/harness/ht1080z/` (read its README). A probe is a throwaway test in `test/ht1080z-hw/` (an
e2e-cores folder), run with
`npx vitest run --config build/vitest.config.ts --project e2e-cores <file>`; write results to a file
(`console.log` is swallowed), delete the probe, log the values in `PROVENANCE.md`.

- `s.breakpoint(a)` for several addresses, then `s.debug("continue")` in a loop, reading
  `(s.machine as any).pc/sp/af/bc/de/hl` at each stop. `attachDebugSupport()` again clears them.
- `createHtSession({ model: "ht1080z-s1" })`; `s.runUntil(() => s.hasFirstPrompt())` stops at the
  power-on question without answering it; `bootToPrompt()` answers it with NEW LINE.
- `typeKeys("...\n", { settle: 10 })`, then `runFrames(60)` before reading `screenText()`.
- Letters on Series I/II are stored at $00-$1F in video RAM; `screenText()` folds them back.

## Facts the annotations rest on

Each was read from code or run, not remembered:

- **The restarts go through RAM.** $0008-$0038 each `JP` to $4000, $4003, ... $4012, filled at power-on
  from `RAM_VECTOR_IMAGE` ($06D2, 54 bytes to $4000-$4035). So a restart's handler is found from the image,
  not from the restart: `RST $08` EXPECT_CHAR ($1C96), `RST $10` NEXT_CHAR ($1D78), `RST $18` CP_HL_DE
  ($1C90), `RST $20` TYPE_FLAGS ($25D9); `RST $28`, `$30` are RETs and `$38` is EI/RET until a program
  writes a jump there. A run read the image back from RAM.
- **`RST $08` takes an inline byte** (the character the text must hold next); it is the only restart that
  does. The decoder lists it as `.defb` with `(expects ...)`.
- **Devices are blocks.** `DEV_INPUT`/`DEV_OUTPUT`/`DEV_CONTROL` ($0013/$001B/$0023, B = 1/2/4) call
  DEV_DISPATCH ($03C2) with DE = a block: type byte, driver address, three more bytes, two letters. KI at
  $4015 (driver KEY_SCAN, $03E3), DO at $401D ($0458), PR at $4025 ($058D).
- **Errors:** E = 2 x the index into the two-letter table at $18C9, ERROR_E ($19A2) takes it.
  Observed: E = 2 is SN, $28 is MO; $0C (OM) is what MEM_TOP_SET gives a top below $4414.
- **$37E0-$37EF is extension ROM** on the HT-1080Z and reads $FF; the code there that drives other
  hardware (SECTOR_BOOT, the NMI's test) never takes the hardware path. Observed at power-on.
- **The power-on question** is `READY ?` on Series I/II (READY_TEXT + PROMPT_LINE's "? "). NEW LINE alone
  sizes RAM by test-writing it; a number sets the top to that number - 2.

## Disassembly traps

- **Overlapping entries.** `LD BC,nn` instructions hide `LD E,n` / `LD A,n` entries one byte in (the error
  entries at $1999-$19A1, the graphics entries at $0134-$0139): the level tool reports these as targets
  inside an instruction (36 now). Explain them in the synopsis of the instruction they sit in.
- **Constants and tables read as code.** $1380 on holds number constants, which make false targets such as
  $00E8 (from bytes at $13A4); check a target's caller is real code before labelling it.
- **The decoder's own tables.** `Ht1080zCustomDisassembler` lists $1608-$18F6 as dispatch, keyword,
  precedence and error tables whatever the sidecar says. Check those boundaries from the code that reads
  them before marking them as regions.

## State of the work

**Every HT-1080Z ROM is at level 2**, measured and recorded, and shows in the running IDE:

| Sidecar | Labels (merged) | Notes |
|---|---|---|
| `ht1080z-s1.rom.dis` | 916 | Series I and II BASIC; 32 targets inside an instruction, each explained |
| `ht1080z-s64.rom.dis` | 913 | inherits s1 |
| `ht1080z-s1-ext.rom.dis` | 111 | entries, keyboard (blink, repeat), display without the fold, `RE` renumber, monitor |
| `ht1080z-s2-ext.rom.dis` | 113 | inherits s1-ext; CLEAR-key accents |
| `ht1080z-s64-ext.rom.dis` | 139 | own keyboard decoder, accent mode (`` ` ``), maker's text; $05B9 breaks RENUM_REMOVE (observed) |
| `ht1080z-s{1,2,64}-chargen.rom.dis` | 0 | one binary region, a synopsis per glyph |

Open: a system-variable table for the HT-1080Z (`romSysVars.ts`) would let listings name the RAM workspace; the
ROM page editor lists the extension ROMs from $0000 (see "Pages that do not start at $0000").

## Method that worked (the level-2 session)

Eight helpers, one per $600 bytes, each with `helper-briefs/ht1080z-draft-a-range.md`, the listing and
`dispatch.txt` (every routine the ROM's own tables reach, with its keyword). Merged with `merge-drafts.py` (three
name clashes); then `$XXXX` references to labelled addresses swapped for the labels with whole paragraphs
re-flowed (re-wrapping single lines leaves orphan words); every "probably" settled from another helper's evidence
or a run; a run checked the tokenizer's bytes, the program pointers, RND's multiplier and step, and eleven error
codes (read from $409A after each command: the debugger loses keys typed while it runs).
