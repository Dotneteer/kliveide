# Authoring the SAM Coupé ROM Annotations

Read `README.md` beside this file first (the D4 rule, provenance, the file format, the levels). This guide
carries what is particular to the SAM Coupé: which ROM page is which, how the machine names them, the order
of work, the tools, the sources that are off limits and the facts read so far. The machine itself is
`src/emu/machines/samcoupe/wasm/README.md`; its decisions and rules are `dev/ai/sam-coupe.md`.

## Sources

- **Allowed:** the ROM bytes through Klive's disassembler, runs on the real core (`test/harness/samcoupe/`,
  `test/sam-hw/`), and the **SAM Coupé Technical Manual v3.0** (MGT 1990) for interface facts only: the
  restart entries, the jump table's entry names at $0100, the system variables (already in
  `src/emu/machines/samcoupe/SamSysVars.ts`), the vectors, error numbers and the DOS hook codes. Such an entry
  is `manual`, and the session log names the manual. The manual never gives a routine boundary or how the ROM
  does something: that comes from the code.
- **Off limits:** every commented or annotated disassembly of the SAM ROM, published or remembered, and **every
  symbol file for it**, SimCoupé's `samrom.map` included. `dev/research/sam-coupe/STORAGE_FIRMWARE_SOFTWARE.md`
  §3.3 lists jump-table names partly from that map: take a name only as the Technical Manual itself spells it,
  and give an entry the manual does not name a Klive name from its code. Per `dev/ai/sam-coupe.md` D1, the
  sources of SimCoupé, MAME's SAM driver, ZEsarUX and the FPGA cores are not read for design either; SimCoupé
  may be run as an oracle, recording only observed results. A ROM source listing, if one turns up, is off
  limits unless the developer records a permission and an exemption like the Z88's.

## The pages, and the order of work

Each file is 32K: two 16K pages (`romIdentity.ts`, kinds `sam-rom0` and `sam-rom1`).

| # | File, page | What | Kind | Listed at | Notes |
|---|---|---|---|---|---|
| 1 | `sam-rom30.rom` page 0 | ROM 3.0's ROM0: restarts, start-up, interrupts, the jump table at $0100, BASIC | `sam-rom0` | $0000 | Start here |
| 2 | `sam-rom30.rom` page 1 | ROM 3.0's ROM1 | `sam-rom1` | $C000 | Paged in when LMPR bit 6 is set; ROM0's `RST 28h` pages it in itself |
| 3 | `sam-rom31.rom` pages 0-1 | ROM 3.1 | `sam-rom0` / `sam-rom1` | as above | By `inherits` from `sam-rom30.rom.dis`: it differs in four bytes only |

3.1 differs from 3.0 at $000F (the version byte, 30 -> 31) and at ROM1's $35F8-$35FA ("plc" -> "PLC"), so all
four pages have their own CRC and none is found by another's. Its sidecar should be a short file listing
`inherits` for both pages and authoring nothing, or at most the version byte's comment.

## How the machine names the pages

ROM0 and ROM1 are the partitions 40h and 41h (`SAM_ROM0_PARTITION`, `SAM_ROM1_PARTITION` in
`src/common/annotations/bankSpace.ts`); `samBankSpace` answers `isRomPartition` and `romBase` ($0000, $C000)
for them, and `SamWasmV2Machine.getRomPartitionImages` reports both, so `getRomSources` finds the file and page
and the sidecar applies. A sidecar's `banks` are keyed by the page within the file (0 and 1). The menu entry is
Debug › ROM Annotations › SAM Coupé, one item per file (`romAnnotationCatalog.ts`); it runs
`rom-ann-open sam-rom30.rom -create`, which makes an empty working copy the first time.

## The tools

`tools/sam-dis.cjs <from> <to> [sidecar]` lists a page through Klive's disassembler with the SAM decoding
(`SamCustomDisassembler`, below). `PAGE=<n>` picks the page; the ROM is the sidecar's `source.fileName`, else
`$ROM`, else `sam-rom30.rom`. ROM1's rows print the page offset, then `@` and the address. The routine is the
Enterprise's (`ep-authoring-guide.md`, "The tools") with `sam-dis.cjs` in place of `ep-dis.cjs`. A batch that
adds data regions goes in two passes: the regions alone (with empty `labels` and `lines`), a new listing with
the sidecar, then the labels and lines against that listing. `apply-annotations.cjs` writes every label as
`observed`: set a manual name's `0:<offset>:label` provenance to `manual` afterwards and run it again with an
empty batch to reformat.

**ROM0 was annotated by eight helper agents** in parallel, one per 2K range, with
`helper-briefs/sam-draft-a-range.md`; their drafts went through `merge-drafts.py` into one file. The work folder
held `full.lst`, `coverage.txt` (the listing with C/R/. from the coverage run), `rom1.lst`, `facts.md` (the
manual's system variables and the decoder's conventions) and `s0.dis`. Each helper took 10-18 minutes and drafted
115-200 labels with synopses; the merge had three name clashes and no overlapping regions. Do ROM1 the same way.

**The coverage run** is `tools/sam-coverage-run.ts.txt`: each BASIC snippet in its own session, because a line
BASIC rejects leaves its text in the edit line and spoils everything typed after it. It reached 10.4K of ROM0
executed. Procedures did not run in the first version (see its header).

## The inline data the decoder knows

`src/renderer/appIde/disassemblers/z80-disassembler/sam-disassembler.ts` (tests in `test/sam/` and
`test/annotations/samRomPages.test.ts`), read from ROM 3.0's bytes (`PROVENANCE.md`, 2026-11-28):

- **`RST 08h`**: one byte, the error code (below 128) or DOS hook. The body at $37CE reads it through the
  return address and calls RST8V ($5AEE) if that is not zero.
- **`RST 28h`**: the calculator's operation bytes, up to $33 (end) or $34-$38 (end and return from the
  calculator's caller, ROM1 $C84B). ROM1's loop at $C7B7 reads them through IX. Operands: $1E, $1F, $20 and $22
  take a jump offset counted from the offset's own byte; $21 and $26 a byte; $27 five bytes; $28 a count and
  that many bytes (listed one 5-byte number to a row: a single row of 61 bytes once made the
  Disassembly view's instruction column 315 characters wide and pushed every ROM1 comment off screen); $29 and $2A a word. $C8-$FF are memory and constant operations without operands; $5E-$C7
  are no operations ($60-$C7 raise error 51, the table at ROM1 $C6FB ends at $5D), so the decoder leaves the
  stream at one: that is data decoded as code.
- **`RST 30h` from ROM0** (below $4000; $01CF tests the return address): a word, a call to that ROM1 address
  with bit 15 set, a jump to the address with bit 15 set when it is clear. From anywhere else: RST30V, no word.
- **`CALL $0201` / `CALL $01FA`**: a word, a call (returning past it) or a jump to that address with ROM1
  paged out; ROM1 reaches ROM0 this way. A conditional call is not decoded (two in ROM1 are in a table).
- **`CALL $0D47`** (the statement search): one byte, the error code. When the search fails, $0D4A jumps to
  $0008 with the CALL's return address still stacked, so RST $08's body reads the byte; when it succeeds it
  drops the return address. ROM0 has three ($18EE, $1B18, $3278, also marked as one-byte regions).

These targets are named in the listing but are not branches the level check counts: give the ROM1 addresses
the jump table and `RST 30h` reach labels when ROM1 is annotated.

## The manual's names

**System variables** take their names from `src/emu/machines/samcoupe/SamSysVars.ts`, which was checked
against the manual's text and ROM 3.0's code on 2026-11-28: $5C08 is RBHEAD (the manual's name; "LAST_K"
was the Spectrum's), $5C3A is ERRNR and holds the error number itself (`LET a=1/0` leaves 28, message 28
is "Number too large"), and $5B70 is reserved in the manual, so ANYIV is Klive's name for the interrupt
vector ROM 3.0 keeps there. The manual's scan prints RST8V and RST28V as "RSTBV" and "RST26V".

The jump table's names are the Technical Manual v3.0's (the text at sam.speccy.cz, read 2026-11-28), marked
`manual`. Its OCR spellings are kept as printed (`JRBFLUSH`, `JREADREY`, `JWAITREY`, `JEXPTINUM`, `DROLL`;
`JPA.LET` became `JPALET`). $017B and $0187 have Klive names: the manual prints JEDGE2's address as 0178H
and JGRCOMP's as "ola7H". $018A and $018D are past its list. **Open for the developer:** whether to read
the manual's PDF transcription to settle these spellings, and rename the labels if it differs.

## Facts the annotations rest on

Read from ROM 3.0's bytes (`PROVENANCE.md`, 2026-11-28).

- **LMPR ($FA)**: bit 6 pages ROM1 in at $C000 (`OR $40` / `AND $BF` around every call into or out of ROM1);
  section B shows the page after LMPR's, so LMPR = $1F or $5F puts RAM page 0, the system variables, at
  $4000. The interrupt entry sets $5F, the NMI and JSVIN $1F.
- **The interrupt** goes RST $38 -> ANYIV ($5B70), which ROM1's $EC77 sets to $0049; $0049 runs ROM1's $D42D
  on a stack at $4C00. NMIV is set to $1C9E at the same place.
- **$5A97** is the BASIC line pointer RST $18/$20 work on; $5B47 carries BC through `RST 30h`; $5B86 holds
  BC across the calculator.
- **$028B-$0293** are start-up values ROM1's $ECB9 copies to $5C0C-$5C1D.
- **Tokens** are found by counting ROM1's own keyword list (bit-7 ended, $F8C9-$FBDD, 196 entries, PI first).
  Entry n (PI = 1) is the token n + $3B from USING on (DIR = $90, PRINT = $BB, ZOOM = $F6), and $FF, n + $3A
  before it (PI = $FF $3B, up to `>=` = $FF $83); INK would be $FF and is stored as PEN ($A1). The calculator's
  and ROM0's function code is the byte after $FF minus $1A ($153C), so PI is $21 and ABS $41. The ROM0 work
  first counted PI as $3C: when a note says "+ $1B" or "PI = $3C", it is off by one for the $FF tokens. A statement token t runs the word at
  CMDADDRT + (t - $90) x 2 (CMDADDRT = $FD65 after boot, words at odd addresses in ROM1 $FD65-$FE32); a word
  with bit 15 clear is a ROM0 routine run with ROM1 out. A byte below $90 starts a procedure call ($32DB).
  The $FF-prefixed functions have their own word table in ROM0 at $16A5.
- **FLAGS bit 7** is clear while a statement's syntax is checked and set when it runs (a probe at $3A50 saw
  $00 and $C0); IS_RUNNING ($3AC6) returns it in carry and SYNTAX_STOP ($3B15) ends a command after its check.
- **Hidden numbers** in a line are $0E + 5 bytes; a procedure or FN reference adds a marker after its name
  ($0E, $FD $FD or $FE $FE, a page byte with bit 5 set until program preparation resolves it, an address).
- **The BASIC stack** grows down from BSTKEND in 4-byte entries: type in bits 7-5 ($00 GO SUB, $40 PROC,
  $80 DO) with the page in bits 4-0, the line address, the statement.
- **Entries inside instructions** are common (skips over one or two bytes with `CP n`, `LD HL,nn`, `LD IX,nn`):
  32 targets on ROM0 cannot carry a label; the comment on the containing instruction names the entry.
- **Probably a ROM bug** (read from the code, not run): JCIRCLE ($206B) pushes AF, and $20A5 pops it as HL
  and takes L as the radius, so through the jump table the radius would be F, not A.
- **Shared names**: STK_FETCH, STK_STORE and MAKE_ROOM do the same jobs as the routines with those names in
  `sp48.rom.dis`, so they take them (the house rule in `README.md`); the other names come from the code.

## ROM1's facts

Read from the bytes and runs (`PROVENANCE.md`, 2026-11-28, ROM1).

- **Code that runs in RAM**: $C000-$C6FA is ten blocks ROM0's RAMRUN routines copy to page 0 and run there
  (RENUM, GET, DELETE, KEYIN, POP, INPUT, DEF KEYCODE, DEF FN, the keyword tokeniser, MERGE; at $4B00, $4D80
  or $4F00). Their absolute jumps are RAM addresses; the labels sit on their ROM offsets and the synopses say
  where each block runs. The coverage run's R marks on them come from the copy, not from data.
- **The calculator** ($C7B7): operations $00-$1F enter with DE = the top value (STKEND-5) and HL = the one
  below (STKEND-10), $20-$5F with DE = STKEND and HL = the top; every operation returns to $C7BB, which stores
  DE as STKEND. Constant n is the 5 bytes at $C834 + n (they overlap). Memory n is at MEM + 5n. Functions $39-
  $5D are the keyword functions (code = $FF token - $1A). A `$1E`/`$1F` jump can land past the operation that
  ends a stream: those bytes are data regions ($2A84, $09DB, $0A5D, $11D4).
- **Messages**: entries end with bit 7 set; a byte whose low 7 bits are below $20 stands for that word of the
  list at $F819. UMSGS ($F5DD) holds 9 messages (the start-up line, "scroll?", tape prompts and file types);
  ERRMSGS ($F651) the texts of error codes 0-55. So the error codes have names: 29 "Not understood", 30
  "Integer out of range", 32 "Off screen" and so on.
- **Start-up tables** at $FBDE-$FD64 (key definitions, system variable values, the channel table at $FC4A,
  the key maps, the default palette), the command table $FD65-$FE32, the packed 5x7 font $FE4E-$FFFF (99
  characters, unpacked to $5190).
- **Four ROM0 synopses were corrected** by the ROM1 work: JMCHAR returns carry reset when it finds the
  character (the manual says set; SCREEN$ at $F229 takes NC as found); $3AD4 reads four numbers (renamed
  FOUR_NUM); STK_HL returns the new STKEND in DE; the $FF token count above.

## State of the work

- **ROM0 (page 0): level 2, shipped** as `src/public/roms/sam-rom30.rom.dis` (2026-11-28): 1,399 labels, each
  with a synopsis, 4,550 end-of-line comments, 12 data regions; 141 entries `manual`. It reassembles byte for
  byte, the readiness check finds no problems, and no executed byte of the coverage run is in a data region.
- **ROM1 (page 1): level 2, shipped** in the same file (2026-11-28): 996 labels, each with a synopsis, 5,172
  comments, 60 data regions; 92 entries `manual`. Done the same way: eight helpers, one per 2K range, with a
  work folder holding ROM0's annotated source (`rom0.asm`), its label names, and the 59 ROM1 entries ROM0
  reaches. Both pages reassemble byte for byte; names are unique across them; no executed byte is in data.
- **ROM 3.1: level 2, shipped** as `sam-rom31.rom.dis` (2026-11-28) by `inherits`: pages 0 and 1 of
  `sam-rom30.rom.dis`, each for its own page. It authors only what the four changed bytes drop:
  RST08_ERROR's span ($0008-$000F, the version byte now 31) and UMSGS_TABLE's ($35DD-$3650, "PLC"),
  copied as `derived` with the two texts the bytes change, plus all of 3.0's regions (a data region
  whose bytes differ is not inherited, and the message tables are one merged region) and $0D29's
  synopsis, which names ROM 3.0. Its merged pages carry exactly 3.0's labels; its export differs from
  3.0's in those bytes and texts only. **A change to 3.0's sidecar reaches 3.1 by binding**; only the
  two copied spans need the same edit by hand.
