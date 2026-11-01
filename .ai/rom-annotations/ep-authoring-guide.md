# Authoring the Enterprise 64/128 ROM Annotations

Read `README.md` beside this file first (the D4 rule, provenance, the file format, the levels). This guide
carries what is particular to the Enterprise: which ROM page is which, how the machine names them, the order
of work, the tools, the sources that are off limits and the facts read so far. The machine itself is
`src/emu/machines/enterprise/wasm/README.md`; the plan is `.plans/ENTERPRISE_PLAN.md`.

## Sources

- **Allowed:** the ROM bytes through Klive's disassembler, runs on the real core (`test/harness/enterprise/`),
  and the **EXOS 2.1 kernel specification** (`_input/enterprise128/docs/Exos.htm`, the Hungarian translation of
  the official technical specification) for interface facts only: function and action codes, the fixed
  system-segment variables, EXOS variable numbers and names, error codes and names, descriptor formats, escape
  sequences and special functions. Such an entry is `manual`. The spec never gives a routine boundary, a RAM
  layout or how the ROM does something: that comes from the code.
- **Off limits** (plan D1): GPL sources (ep128emu, Xep128, the FPGA core) for anything, and every commented
  disassembly of EXOS or IS-BASIC (community sites, books, an AI's memory of them). Names in Klive's own
  Enterprise code are not evidence for routine names.
- A helper never opens `_input/`: the session extracts the specification's text into its work folder and
  writes a `facts.md` with what it read.

## The pages, and the order of work

Every Enterprise ROM page is a 16K segment listed at **$C000** (`romKindOrigin`: kinds `ep-exos` and
`ep-ext`): EXOS pages its own segments into page 3, and enters an extension ROM there.

| # | File, page | What | Kind | Notes |
|---|---|---|---|---|
| 1 | `ep-exos21.rom` page 0 | EXOS 2.1, segment 00h: the kernel, VIDEO, SOUND, KEYBOARD, EDITOR | `ep-exos` | Done (below) |
| 2 | `ep-exos21.rom` page 1 | EXOS 2.1, segment 01h: IS-BASIC 2.1's added routines, the clock, PRINTER, TAPE, SERIAL, NET, the word processor | `ep-exos-basic` | Done (below) |
| 3 | `ep-basic21.rom` | IS-BASIC 2.1 (cartridge, segment 04h) | `ep-basic` | Done (below). An extension ROM whose code uses the same call lists |
| 4 | `ep-exos20.rom`, `ep-basic20.rom` | the 64's EXOS 2.0 and IS-BASIC 2.0 | `ep-exos`, `ep-ext` (check whether 2.0 has the call-list gate before giving it a BASIC kind) | Own sidecars, not `inherits`: only about 2.5K (page 0), 4.5K (page 1) and 1.8K (BASIC) of 2.1's bytes recur in runs of 64 or more. Reuse 2.1's names where a routine does the same job |
| 5 | `ep-exdos13.rom` | EXDOS 1.3 (segments 20h-21h) | `ep-ext` | Last: which EXDOS 1.3 image is the original is still open (`src/public/roms/ep-roms-readme.txt`) |

`ep-klive-fileio.rom` is Klive's own source (`src/emu/machines/enterprise/fileio/`) and gets no sidecar.

## How the machine names the pages

The Enterprise's partitions are DAVE's segment numbers, **positive** numbers (00h-FFh), unlike the other
machines, whose ROM partitions are negative. `EP_ROM_SEGMENTS` (`src/common/annotations/bankSpace.ts`) lists
the ROM ones (00h, 01h, 04h, 10h, 20h, 21h); `epBankSpace` answers `isRomPartition` and `romBase` ($C000)
for them, and the IDE asks `isRomPartitionOf(space, partition)` instead of the sign.
`EpWasmV2Machine.getRomPartitionImages` reports each fitted ROM segment by its number, so `getRomSources` finds
its file and page (`ep-exos21.rom` page 1 for segment 01h) and the sidecar applies. A sidecar's `banks` are
keyed by the page within the file, as for the Next's 64K files.

## The tools

`tools/ep-dis.cjs <from> <to> [sidecar]` lists a page through Klive's disassembler with the Enterprise decoding
(`EpCustomDisassembler`: the byte after every `RST 30h` is `.defb` with the EXOS function's name). `PAGE=<n>`
picks the 16K page of a 32K file; the ROM is the sidecar's `source.fileName`, else `$ROM`, else
`ep-exos21.rom`. Rows print the page offset, then `@` and the address. `apply-annotations.cjs`,
`check-annotations.cjs` and `merge-drafts.py` take `PAGE` too. The routine:

```
S=<scratchpad>; T=.ai/rom-annotations/tools; F=src/public/roms/ep-exos21.rom.dis
PAGE=0 node $T/ep-dis.cjs 0000 3FFF $F > $S/cur.lst; grep -v '\.def' $S/cur.lst > $S/code.lst
#   ... read, run probes, write $S/batch.json or helper drafts ...
cp $F $S/trial.dis
PAGE=0 node $T/apply-annotations.cjs $S/trial.dis $S/batch.json $S/code.lst
node $T/check-annotations.cjs $S/trial.dis        # "problems": [] is clean
cp $S/trial.dis $F && npm run rom:annotations -- level ep-exos21.rom.dis
```

**IS-BASIC's call lists.** On a page of kind `ep-exos-basic` (EXOS 2.1's segment 01h) the decoder also lists
the bytes after `RST 10h` as data (`EpBasicCustomDisassembler`, chained after the EXOS one; the machine's live
disassembler gates it on that kind through `inRomOfKind`): one `.defb` per routine byte, "(IS-BASIC call:
segment 1, entry n)" for $80-$C5 and "(... the BASIC ROM, entry n)" below $80, the inline operands of $92 (a
byte) and $93/$96 (a word) as `(operand)` lines, and the $00 that ends the list. The IDE's `dis` command
applies no machine decoder (neither EXOS's nor this one); the Disassembly panel does.

`merge-drafts.py` takes a draft's `"manual"` list (`"$xxxx:label"`, `"$xxxx:line"`) for entries that state a
fact from the specification.

## Running the ROM

`test/harness/enterprise/` (read its README). A probe is a throwaway test in `test/ep-hw/` (an e2e-cores
folder): start from `tools/ep-probe-template.ts.txt`, run it with
`npx vitest run --config build/vitest.config.ts --project e2e-cores <file>`, write results to a file, delete
the probe, log the values in `PROVENANCE.md`.

- `createEpSession()` (the 128, EXOS 2.1) or `{ model: "ep64" }`; `{ exdos: true }` fits the EXDOS card.
- `bootToBasic()` (about 440 frames), `typeKeys("...\n")`, `runFrames(n)`, `runTo(address)`, `step(n)`,
  `peek`, `physical(address)` (segment s at s * $4000), `s.wasm.epGetPageRegister(p)`.
- **`runTo` stops at an address in whatever segment page 3 shows**: IS-BASIC runs at $C000 too. Check
  `epGetPageRegister(3) === 0` after a stop and go on if not (the template does).
- **A profile** (`m.setProfiling(true, false)`, `m.readProfileFlags(start, length)`): the offsets are the core's
  own compact memory (`ep.c`'s `EP_PHYS_*`), not segment x $4000: EXOS at 0 ($8000 bytes for both segments), the
  cartridge at $8000, Klive's FILE: ROM at $C000, EXDOS at $10000 ($8000 bytes), RAM from $18000. Each byte: bit
  0 an instruction's first byte was fetched, bit 1 executed, bit 2 read as data. **The boot reads every byte of
  the EXOS ROM** (the 32K checksum), so reset the profile after `bootToBasic()` and count only later reads as data.

## Facts the annotations rest on

Each was read from EXOS 2.1's segment 0 or observed in a run (`PROVENANCE.md`, 2026-11-01). Check EXOS 2.0's
own bytes before reusing one there.

- **Segment 0 has an extension-ROM-like header.** $0000-$0007 is the reset code (DI, IM 1, `LD A,4`, `JP $C02E`:
  from $0000 straight into page 3); $0008 holds the device chain pointer ($5780, a page-1 address: VIDEO's
  XX_SIZE byte at $1780), as an extension ROM's +8 does; $000A-$002D is the function table for EXOS 17-34
  (`KRN_DISPATCH`, $0580, indexes it by (code - 17) x 2). Codes 0, 1-11 and 16 are dispatched in code.
- **The built-in devices** are pseudo-descriptors in the specification's ROM form, chained VIDEO ($176F) ->
  SOUND ($2B6A) -> KEYBOARD ($3040) -> EDITOR ($3071); XX_SIZE counts DD_TYPE to the name's end. EDITOR's
  DD_IRQFLAG is 0, so its table starts two bytes early ($3082), over the name's last letter and XX_SIZE.
  `$02D2` (`LD A,$E7 / RET`, .NOFN) is every device's "not supported" entry.
- **Code that runs in RAM:** $03AA-$03E4 is copied to $B217 (the pager: $B217 calls HL with segment A in page 3,
  $B223 jumps, $B225 is `JP (HL)`, $B226 the exit), $03E5-$040F to $0030 (the `RST 30h` entry). The kernel
  exit is built in the null segment's $0051-$0058 by patching opcodes ($0055 `OR A`/`POP AF`/`RET`, $0056 `EI`
  or `OR A` inside an interrupt, which is how a call from interrupt code gets $FE); $0059 holds the function
  code, $005A the caller's A. The "Written by:" text copied with the pager is what ST_FLAG = $2A shows on the
  status line.
- **EXOS variables:** variable n is at $BFC5 + n, except 1 (FLAG_SOFT_IRQ, $BFF2) (`EXOS_VARIABLE`, $090B).
  So MODE_VID is $BFDB, VID_EDIT $BFE2, FLG_EDIT $BFE5. Numbers from 40 go to the extensions as action 4.
- **System RAM** (segment FFh): $BF79 bit 7 = EXOS is running a call or an interrupt, low bits the device-call
  nesting; $BF7A the caller's SP, $BF7C its HL. The channel chain head is $BFBA, the device chain head $BFBD,
  the RAM extension chain $BFC0; $BFA5 caches three channels. The RAM segment list grows down from $ABD0
  ($BF9A, $BF9C); counts at $BF9F-$BFA4. The LPT is at $B900 (status line block, 27 rows, 6 border blocks),
  the character set at $B480 (128 codes x 9 rows, unpacked by `VID_FONT_RESET` from the bit stream at
  $25D2-$2847).
- **Channel nodes:** a 16-byte header below each channel's RAM pointer P: link (P-1..P-3), flags (P-4), key =
  channel + 1 (P-5), sizes and the free gap below, the device descriptor (P-14..P-12); capture and redirect
  channels at P-15/P-16.
- **Segment 1** is reached through `SEG1_SERVICE` ($0B40: $C00D in segment 1 with A = a service number): 0 read
  time, 1 set time, 2 read date, 3 set date, 4 the one-second tick (SECOND_COUNTER, TIMER, the clock), 5 load
  relocatable, 6 the start-up. EXOS 31-34 enter a run of `INC A` at $0B3D-$0B40 that counts the service.
- **VIDEO** keeps MODE_VID in IX-$02 (bit 0 graphics, bit 2 low resolution in 5 and 15, bit 3 attribute in 15);
  31 control and escape codes at $169F with flag bytes at $16BE (reversed) and two handler tables ($16DD text,
  $16F1 graphics). **SOUND** keeps DAVE's registers as an image at $B2E3 written out every interrupt; its pitch
  table is at $2B38 (24 steps to the octave). **KEYBOARD** decodes the matrix through $2F27 + 10 x bit + row.
  **EDITOR** runs with IY = $B253, the current channel's 53 variables copied in and out (`EDT_SELECT`); its text
  is a gap buffer of rows [$80 + margin][flags][$03][text][end byte 4/5/2].
- **Behaviour that differs from the specification:** @@MARG keeps a margin given as $FF and takes the cursor
  column for 0 (the specification says the reverse). At $032F the action-7 path for RAM in a device segment
  stores the popped request byte as the RAM's segment (`POP AF` at $0332 overwrites `IN A,($B1)`); no shipped
  ROM takes that path (EXDOS 1.3 asks for $07D4 bytes with B = 1, observed).
- **The last three bytes** ($3FFD-$3FFF) are reached and read by nothing after the boot; the boot's checksum
  over the 32K comes to 0 with them.

### The IS-BASIC 2.1 cartridge (`ep-basic21.rom`)

Read from the bytes and observed in runs (`PROVENANCE.md`, 2026-11-01, IS-BASIC 2.1).

- **Header:** "EXOS_ROM", device chain 0, `JR` to the entry at $0070 (1 cold start, 2 the command "BASIC", 3 help).
  $0016-$006F is a BCD multiplication table (a x b at $000C + 10a + b) for NUM_MUL. $00E8-$016B is the call table
  (entries $00-$41). $00C6 copies $016C-$018B to $0008 and $018C-$0249 to $005C at start-up: the restarts and
  the gate (two blocks copied at different offsets, so a `JR` between them is listed as data at $0177).
- **Statements** come from the keyword table at $35A7 (93 descriptors: run routine, syntax-check routine, flags,
  counted name), linked at start-up into a chain of 3-byte records (descriptor, segment) at ($0232), so segment
  1 and extensions add keywords. Flags: 0 command, 1 program, 2/3 block nesting, 4 allowed after THEN, 5 reset
  the run state, 6 tokenise the rest.
- **Inline texts:** `CALL $0E00` prints the counted text that follows it and returns past it; every such text is
  a data region (the targets the text makes are false).
- **Error raisers** are `LD L,n` entries in `LD DE,$xx2E` runs ($F4BB-$F557), 38 targets inside instructions
  in all. A line that grows past 255 bytes when tokenised raises error 20073, whose text is "Statement not
  allowed after THEN" (run); the stack walk at $3389 skips a string item one byte too far (not run).

### Segment 01h (page 1)

Read from the bytes and observed in runs (`PROVENANCE.md`, 2026-11-01, page 1).

- **Two programs share the page.** $0000-$240E is IS-BASIC 2.1's own code (it runs only while IS-BASIC is the
  application); $240F-$3FFF is EXOS's: the service entry, the clock, PRINTER, TAPE, SERIAL, NET, the extension
  entry and the Enterprise Word Processor (WP), which is the application when no cartridge takes the cold start.
- **The header** has an extension ROM's shape without "EXOS_ROM": $0008 = $676A, the device chain (PRINTER ->
  TAPE -> SERIAL -> NET; PRINTER's and TAPE's tables start two bytes early, as EDITOR's); $000A `JP` the extension
  entry (action 1 cold start -> WP, 2 command ":WP", 3 help, 5 explain error code); $000D `JP` the service entry
  that page 0's SEG1_SERVICE calls (0 read time ... 6 start-up). $0000-$0007 and $0010-$008B are IS-BASIC's call
  table: entry n at $C000 + 2n.
- **IS-BASIC's gate** is RAM the cartridge writes into the null segment: `RST 08h` calls HL in segment A, `RST 10h`
  runs a call list (bytes ended by $00; bit 7 set: this page's table, else the cartridge's at $C0E8; the list
  pointer at $00DA, read by `CALL $0013`/`$0015` for inline operands), `RST 18h` raises error 9000 + A when NZ,
  `RST 20h` raises error HL. IX is always $0200, so `(IX+n)` is IS-BASIC's variable $0200 + n.
- **Numbers** are 9-byte stack items (type 2, a BCD mantissa least significant byte first, the leading digit in
  +6's high nibble, +8 the sign and an exponent biased by $40, $7F at +8 for the 16-bit integer form); the stack
  pointer is ($0228) and the stack grows down. A 7-byte form (the item without its type and +7) is how the
  constant table ($008C, 43 entries) and R1/R2 ($0E0B, $0E12) hold them.
- **Packed texts.** IS-BASIC's error messages, class names and dictionary ($2038-$235B) and EXOS's error texts
  ($3E72) are 4-bit codes over "EONRTAISCLDU " with escapes (`TEXT_UNPACK` $235C); the WP's help pages use another
  bit stream (letters as 1 + 5 bits, phrases from $39A5).
- **A tamper check.** The start-up stores $AC XOR the 25 bytes at $3FD8 at $BF7E; one second tick in eight
  (chosen by R) subtracts the 229 bytes from $266E from it and compares with $3FFD. The ROM as shipped passes; a
  mismatch decrements a system-segment byte.
- **Bugs reproduced in runs:** `POS("aab","ab")` gives 0 (a partial match restores only H); RTRIM$ trims nothing
  past 128 characters (`JP P` on the count); MOD with a negative divisor gives 0; MAXLEN of a string-array
  element gives 0. Each is described where the code does it.
- **Unknown command strings end at the WP**: its command check pops its caller and answers .NOSTR for any
  command other than "WP", so segment 1, the last ROM in the list, gives the "Unrecognised command string" answer.

## Disassembly traps

- **Entries inside instructions** (22 on page 0): `LD BC,nn`, `LD DE,nn`, `LD HL,nn`, `LD IY,nn` and `CP n`
  hide a second entry one or two bytes in, used for error exits ($0BEA-$0BF3: .ICHAN, .CHANX, .NODEV, .INAME
  one per three bytes), table entries (VIDEO's ESC s at $2437, codes $16/$09 at $2456/$245E; EDITOR keys
  $F3/$FB at $374E/$3750) and loop targets. Each is explained on the instruction that hides it; the level
  tool lists them.
- **Not inside instructions:** EXOS 31-34 at $0B3D-$0B40 are one-byte `INC A`s, each its own label.
- **KEYBOARD's read block and SOUND's write block** ($119C, $11EA) are `LD HL,<routine>` hidden in the `LD IY`
  of VIDEO's ($1198, $11E6): one generic block loop per direction, the per-byte routine in HL.
- **`$C00A` in a `LD HL` is another ROM's entry**, called through the pager; this page's $000A is the function
  table. Run addresses in the code ($D23A) are this page; the IDE names them, the source export does not.
- **Tables read as code make false targets far away**: the boot texts at $017A-$01B2, the font at $25D2-$2847
  and the device tables all did. Mark the data first, then count.
- **Regions that touch merge**: the device descriptors and their entry tables differ in type (bytes, words),
  so they stay apart. A table of entries listed one per row is a run of regions with alternating types or
  `rowBytes` (bytes only: a `words` region takes no `rowBytes`, so its rows break only at labels; segment 1's
  call table lists its entries in the synopsis instead).
- **Segment 1: data that hides entries.** `LD DE,$xx2E` runs hide `LD L,n` error entries ($020E-$0260, BLACK ...
  WHITE at $04FA), `LD HL,$083E` hides argument helpers, and call bytes enter inside functions; 23 targets inside
  instructions in all, each explained on the instruction.
- **A call list read as code** swallows the following instructions and makes false targets; the decoder only
  knows the operands of $92, $93 and $96. A new operand-taking routine (the cartridge's, for IS-BASIC 2.1) must be
  added to `BASIC_CALL_OPERANDS` before its page is measured.

## State of the work

| Sidecar | Level | Labels | Notes |
|---|---|---|---|
| `ep-exos21.rom.dis` page 0 | **2** | 1,132 | 48 data regions, 4,717 annotated lines (443 `manual` entries); reassembles byte for byte; checked in the running IDE (`dis` at $D4D0 and $C410 with segment 0 in page 3, the editor's Ready chip) |
| `ep-exos21.rom.dis` page 1 | **2** | 923 | 519 data regions (the function, SET-option and constant tables one entry per row), 4,333 annotated lines (325 `manual`), 7,184 instructions, 23 targets inside instructions; reassembles byte for byte; checked in the running IDE (`dis $E47A` at a breakpoint shows SVC_TICK, `ann-info` lists page 1's sidecar, the editor's Ready chip) |
| `ep-basic21.rom.dis` | **2** | 1,021 | 493 data regions (the keyword table one entry per row), 7,770 instructions, 38 targets inside instructions; reassembles byte for byte; `ann-info` finds it for segment 04h and the editor reports "Ready to ship · level 2" (a live listing at a BASIC breakpoint was not reached: the test driver's key press does not get past the banner) |
| the others | 0 | | next: EXOS 2.0 and IS-BASIC 2.0 (the 64) |

**Method that worked (IS-BASIC 2.1).** The page-1 work had already produced the call dictionary
(`basic-calls.md`): its 65 cartridge routine names went straight onto the call table's targets. A profile over
~140 commands and two programs (offset $8000 in the profile), the kind `ep-basic` so the lists decode, then ten
helpers by range. Merged in address order; three name clashes renamed, the RAM `JR`s listed as data, four
"probably"s settled from the code, one run (error 20073), 298 numeric references swapped for names.

**Method that worked (page 1).** A profile over ~100 typed IS-BASIC commands and the WP's keys; then a probe
that dumped the null segment's low RAM, which showed the cartridge's gate and the call lists, and a second one
that logged every list step (operand counts). The decoder came before any drafting. Two helpers then wrote the
call dictionary (`basic-calls.md`: what every routine byte does, both tables, with chosen labels for this page's),
and eleven drafted ranges ($0000/$0500/$0A00/$0DCE/$1400/$1BF0 for IS-BASIC, $240F/$2757/$2BFE/$3221/$3798 for
EXOS; the EXOS ones did not need the dictionary and started first). Merged in address order (overlapping table
regions keep the first draft's); two name clashes, 83 numeric references to labelled code swapped for names, every
"probably" settled from the code or a probe.

**Method that worked (page 0).** A profile run first (boot, then ~60 typed IS-BASIC commands, reads counted only
after the boot), the reset code, the RAM copies, the dispatcher and the device chain read by hand into
`facts.md` and `dispatch.txt` (built from the indexing code), the specification's text extracted for the
helpers, then nine helpers with `helper-briefs/ep-draft-a-range.md`, one per range ($0000/$0600/$0C00/$133D/
$1B00/$2300/$2BA0/$3300/$3A00, cut at the devices' entry points). Merged with `merge-drafts.py` (the range
that owns shared exits first), then: names that two helpers chose renamed from the code, numeric references
to labelled code swapped for names, references to this page in run-address form turned into offsets, every
"probably" settled from the code or a probe or removed.
