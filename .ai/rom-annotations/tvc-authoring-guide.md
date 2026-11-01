# Authoring the Videoton TVC ROM Annotations

> **Tools.** New work goes through the ROM annotation pipeline (`npm run rom:pipeline`; README, "The tools"). Most scripts this guide names were retired by it: `tools/README.md` gives the command that replaced each.

Read `README.md` beside this file first (the D4 rule, provenance, the file format, the levels). This
guide carries what is particular to the TVC: which chip is which, how they are mapped, the order of work,
the tools and the facts read so far. The machine itself is `src/emu/machines/tvc/wasm/README.md` and
`.plans/VIDEOTON_TVC_PLAN.md`.

## D4 here: three sources are off limits

The rule is the README's, unchanged. What makes it sharp on the TVC is that the research pack sits in the
repository, next to the work:

- **rtvc's ROM listings** - `_input/videoton-tvc/rtvc/roms/*.asm`, `rom_comments_1_2.json`,
  `rom_symbols_1_2.json` - are never read for this work (plan D1). Neither are rtvc's `coding/*.asm`
  files that use its symbol names.
- **`_input/videoton-tvc/TVC_ROM_20190616.pdf` and `tvcrom.pdf`** (476 pages each) are treated as
  commented ROM listings and not opened for this work. If a later session establishes that one of them is
  a manual and not a listing, record that here before using it.
- **Names already in Klive's own TVC code are not evidence.** Some came from rtvc's symbol file: the
  harness's `TVC12_KEY_WAIT` comment and `tvcMachineInfo.ts` say `KB_CHIN`, which is rtvc's name. Do not
  carry a name from `src/emu/machines/tvc/`, `test/harness/tvc/` or the plan into a sidecar; name a
  routine from its code.

What may be used, besides the bytes and runs: `_input/videoton-tvc/operaciosrendszer.pdf` (the operating
system manual) for interface facts - the system calls' function codes and entry conditions, the system
variables - recorded in Klive's own words and marked `manual`, the page named in `PROVENANCE.md`.
`TVC_HARDWARE_OVERVIEW.md` and the hardware manuals give ports and the memory map.

## The chips, and the order of work

| # | File | What, and where BASIC runs it | Kind | Notes |
|---|---|---|---|---|
| 1 | `tvc12-d4.rom` | BASIC 1.2 SYS, low 8K, $C000-$DFFF | `tvc-sys-low` | The reset entry (offset 0: `JP $0229`), the sign-on, the token table (at $DE6D). The names everything else reuses start here |
| 2 | `tvc12-d3.rom` | BASIC 1.2 SYS, high 8K, $E000-$FFFF | `tvc-sys-high` | Straight after #1: the halves call each other, and an instruction straddles them (below) |
| 3 | `tvc12-d7.rom` | BASIC 1.2 EXTH, $E000-$FFFF in EXT | `tvc-exth` | Its first 4K is `$FF` filler (a `fill` region) |
| 4 | `tvc22-d6.rom`, `tvc22-d4.rom` | BASIC 2.2 SYS (the 64K+), low and high | as #1, #2 | Their own sidecars, not `inherits`: only about 1K (low) and 0.7K (high) of 1.2's bytes recur in runs of 64 or more. Reuse 1.2's names and wording where a routine does the same job, as `ht1080z-s64-ext` did |
| 5 | `tvc22-d7.rom` | BASIC 2.2 EXTH | `tvc-exth` | Nearly full (91 `$FF` bytes): about twice #3's work |
| 6 | `tvc-vtdos.rom` | VT-DOS, the HBF card's 16K ROM | none yet | Needs its own plumbing first (below) |

## How the running machine names the chips

The machine's partitions are 16K (SYS -1, CART -2, EXT -3), but each chip is its own 8K file, so the
ROM annotations name **chips** (`TVC_ROM_PAGES` in `src/common/annotations/bankSpace.ts`):

| ROM page | Chip | Shown at |
|---|---|---|
| -1 | SYS low (`tvc12-d4` / `tvc22-d6`) | $C000 (romBase); also $0000 after a reset |
| -9 | SYS high (`tvc12-d3` / `tvc22-d4`) | $E000; also $2000 after a reset |
| -3 | EXTH (`tvc12-d7` / `tvc22-d7`) | $E000 |

An address picks the chip by its bit 13, whichever CPU page shows SYS. EXT's low half (the card window)
is no ROM page. `TvcWasmV2Machine.getRomPartitionImages` reports each chip's 8K, so its CRC finds the
file in `KNOWN_ROM_PAGES` and the file's sidecar applies. -9 is not a machine partition: breakpoints,
the profile and the history still say SYS.

**Pages that do not start at $0000.** As for the HT-1080Z's extension ROMs, each kind has an origin
(`romKindOrigin`): the decoder lists the chip at $C000 or $E000 and hands back page offsets, so the level
tool and `tvc-dis.cjs` count `JP $C229` as a jump to offset $0229. A jump into the other SYS chip, into
RAM or to a $0000-based address is no target of the page. The sidecar's keys stay page offsets.

**The reset code runs at $0000.** At reset port 02h is 0, so page 0 shows SYS and page 3 the
cartridge; the low chip's first instructions run at $0000 until BASIC pages SYS into page 3. So
offset 0's `JP $0229` is a jump to offset $0229, which the tools cannot see. Label such targets by hand,
and say in the synopsis which address the code runs at.

**An instruction straddles the SYS chips (BASIC 1.2).** The low chip's last byte ($1FFF, at $DFFF) is
`C3`; its operand is the high chip's first two bytes (`B1 DB`): `JP $DBB1`. Each chip's own listing
gets it wrong: the low one reads `JP $0000` off its end, the high one starts with two stray bytes
(`OR C` / `IN A,($E6)`). Mark $1FFF in the low chip and $0000-$0001 in the high one as `bytes` regions
with a synopsis saying what the whole instruction is. BASIC 2.2's low chip ends on a whole instruction
(`CALL $FB99`).

## The tools

`tools/tvc-dis.cjs <from> <to> [sidecar]` lists a chip through Klive's disassembler with the TVC kinds'
decoding (`TvcCustomDisassembler`: the byte after every `RST $30` is `.defb`, `(system call function)`).
Each row prints the page offset, then `@` and the run address. The ROM is the sidecar's
`source.fileName`, else `$ROM`, else `tvc12-d4.rom`. `apply-annotations.cjs` and `check-annotations.cjs`
work on its sidecar as on the others. The routine:

```
S=<scratchpad>; T=.ai/rom-annotations/tools; F=src/public/roms/tvc12-d4.rom.dis
node $T/tvc-dis.cjs 0000 1FFF $F > $S/cur.lst; grep -v '\.def' $S/cur.lst > $S/code.lst
#   ... read, run probes, write $S/batch.json ...
cp $F $S/trial.dis
node $T/apply-annotations.cjs $S/trial.dis $S/batch.json $S/code.lst
node $T/check-annotations.cjs $S/trial.dis        # "problems": [] is clean
cp $S/trial.dis $F && npm run rom:annotations -- level tvc12-d4.rom.dis
```

Before the first sidecar exists, `npm run rom:annotations -- skeleton tvc12-d4.rom` lists the targets with
the whole chip read as code; tables read as code make false ones, so mark the data regions first.

## Running the ROM

`test/harness/tvc/` (read `src/emu/machines/tvc/wasm/README.md`'s Testing section). A probe is a
throwaway test in `test/tvc-hw/` (an e2e-cores folder), run with
`npx vitest run --config build/vitest.config.ts --project e2e-cores <file>`; write results to a file
(`console.log` is swallowed), delete the probe, log the values in `PROVENANCE.md`.

- `createTvcSession({ model: "tvc64" })` (BASIC 1.2) or `"tvc64p"` (2.2); `hbf: true` adds VT-DOS.
- `bootToBasic()` (about 6 s of machine time), `typeKeys("...\n")`, `runFrames(n)`, `runTo(address)`,
  `step(n)`, `breakpoint(a)` + `debug("continue")`; `peek`/`peekWord`, `physical(offset)` for the
  physical memory (SYS at $20000).

## Facts the annotations rest on

Each was read from the code or observed in a run in the tvc12-d4 session (`PROVENANCE.md`, 2026-10-28), not
from a listing. Addresses are where BASIC 1.2 runs them; check a 2.2 chip's own bytes before reusing one.

- **`RST $30` is the system call, with an inline function code.** RAM $0030 jumps to $0B23 (EXTH's copy),
  which takes the code into A' and jumps to SYSCALL_ENTRY ($C363). SYSCALL_DISPATCH ($C37E): bit 7 picks the RAM
  table $0B00 (set) or $0B08 (clear), bits 6-4 an entry, bits 3-0 the function. For functions 0-2 the entry
  holds the device (so a channel can be redirected); from 3 up the entry number is the device. The device
  table ($C55D) points to function lists: a count byte, then the words. Errors come back in A: $FF no such
  function, $FE a bad entry, $FD no card, $FB no room, $FA a buffer above the top of RAM ($0B19).
- **The devices of BASIC 1.2**: 0 the graphics screen, 1 the keyboard, 2 the screen editor ($21 writes C
  at the cursor, $A1 reads a line), 3 the sound generator, 4 the printer, 5 the cassette (its functions run
  in EXTH; SAVE drives them), 6 a card through EXTH, 7 system services (reserve RAM, find a card). The frame
  interrupt (INT_ENTRY, $C412, via RAM $0038) calls function 0 of devices 0-3 whose bit in $0B10 is clear.
- **Inline data after calls.** `RST $08` takes an error code byte (the code at RAM $0008 is copied from the
  SYS high chip's $FB5B). `RST $18` is the calculator: it runs the operation bytes after it (bit 7 marks the
  last). The SYS high chip's `CALL $FE79` prints the length-prefixed string after it. Mark each as data.
- **Numbers** are 7 bytes: six BCD bytes, least significant first, then an exponent byte ($40 for 10^0,
  bit 7 the sign). Constant k of the calculator is at SYS + $0111 + 7k.
- **The statement table** at SYS + $0067 is indexed by `token XOR $FF` (the word at $0067 is token $FF's);
  only tokens $CA-$FD are dispatched through it, a byte below $CA is an assignment without LET ($E3BC).
  Its first words double as the calculator's operation table ($00C7 on).
- **BASIC's RAM**: IX = $1700 (flags: bit 0 TRACE, bit 2 running), programs from $1720, the tokenised input
  line at $1735, the IY expression stack (9-byte numbers; GOSUB entries of type $06, FOR entries of type
  $2B, the type byte being the length). The editor's text buffer is U0 $0100-$06FF (24 x 64), the screen
  is video RAM $8000-$BBFF, 64 bytes a scanline, 10 scanlines a text row.
- **The calculator (`RST $18`, SYS high CALCULATOR $FB82)** runs the op bytes after the RST: op n's routine
  is the word at SYS low $C0C7 + 2n; bit 7 marks the last op; op 5 takes one more byte (constant k at
  $C111 + 7k). Ops: 0 add, 1 divide, 2 multiply, 3 subtract (y op x, x the top), 4 negate, 5 constant,
  6/7 recall memory A/B ($19C0/$19C7), 8/9 copy to memory, 10/11 pop to memory, 12 duplicate, 13 store
  into a variable, 14 '(' expression ')'. Only op 5 reads the stream, so a stream ends at the first byte
  with bit 7 set, plus one byte after each op 5. The stream pointer is $1718; streams nest.
- **Names and built-in functions share one chain**: records [link word][length][name][type byte][value],
  head in $1724. Its tail is the 23 built-in functions (ABS .. VERNUM), each entry right before its code in
  the SYS high chip; type bits: 0 array, 1 numeric, 2 DEF function, 3 built-in code, 7 just created. ATN,
  ORD and INKEY$ are tokens and are dispatched directly.
- **Numbers on the IY stack** are 9-byte entries: +0 type $09, +1..+6 six BCD bytes, +7 a carry byte, +8
  the exponent. 12 digits are kept, 10 printed. Strings are [type 1][length][text].
- **Errors**: the table at SYS high $FDC6 holds [code][length][tokenised text][$FF] for codes 1-16 (Not
  understood .. Bad file) and a catch-all 0 ("BASIC corrupted"); a code with bit 7 set prints "System error
  <n>". Message words are tokens $93-$8F.
- **ROM quirks observed**: XOR ORs the high bytes (256 XOR 256 = 256); a division that overflows gives 0
  with no error; a shorter string compares as smaller whatever its characters ("B" < "AA").
- **EXTH and SYS never see each other.** With EXT in page 3 ($C000-$DFFF the card window, $E000-$FFFF
  EXTH) the SYS chips are paged out, so EXTH's own calls to $E000-$FFFF stay in EXTH; each side reaches the
  other only through its own $FFF0 with HL = the target (SYS writes $F0 to port 02h and $0003, EXTH $70). A
  SYS chip's `CALL $Fxxx` is a SYS high address, never EXTH's.
- **Expansion cards**: port 5Ah gives 2 bits per slot: 3 a card whose ROM has "MOPS" at $C000 and a
  length-prefixed name at $C004, 0 "RS232", 1 "VGB", 2 "DISK" (the HBF card). Slot records of 48 bytes at RAM
  $0040 + 48n (name, then at byte 7 the card's number among cards of that name); a card ROM's $C00B is its
  initialisation, $C00D its function list (count, words). An RS232 slot uses EXTH's own driver instead.
- **The cassette (device 5, EXTH)**: codes $51/$D1 a character, $52/$D2 a block, $53/$D3 open output/input,
  $54/$D4 close, $D5 verify (bit 7 = the input side; observed for SAVE, VERIFY, LOAD, OPEN and PRINT #).
  Writing times each half-period with the sound timer (divisors $D6 pilot, $DE a 1, $CE a 0, $BC sync);
  reading calibrates on the pilot and counts polls of port 59h bit 5. Errors $E6-$EB, $EC (reported
  already), $F5 break.
- **The RAM character set** ($0740, codes $80-$DF) is copied from EXTH at boot: $80-$88 the Hungarian
  accented capitals, $90-$98 the small ones, box-drawing lines, inverse A/C/S ($8F/$9E/$9F, the lock
  cursors), blanks from $A0.
- **PRINT USING** (EXTH $FCB5 numbers, $FF9C strings) is `PRINT USING "fmt":value`; the format characters
  and observed outputs are in the sidecar's USING_NUMBER and USING_STRING synopses.
- **The token tables**: 1.2 at $DE6D, 2.2 at $D73A, tokens $FE down to $95 (BASIC listing work).
- **BASIC 2.2 waits for a key** in $CA9F-$CAAB (observed only).
- **The frame interrupt** is the CRTC cursor at $0EFF (scan line 239); VT-DOS moves it to $0AFF.

## Disassembly traps

- **Overlapping entries.** `LD BC,nn`, `LD D,n` and the like hide entry points one byte in: $026B and
  $0348 (targets inside an instruction, explained in comments), and labels the tools accepted at $0A89,
  $0BFF and $1D94 (DELETE enters at $1D93, which cannot carry a label).
- **To see EXTH in the IDE**, stop where EXT is paged in: `bp-set $F000` then `em-debug` stops in the boot.
- **Inline data after calls**: every `RST $08` code byte, `RST $18` stream and `CALL $FE79` string is a
  region; a stream hidden by a misdecode shows only after the one before it is marked ($0B3C in d3): rerun
  the scan until nothing new appears.
- **Entries hidden inside instructions** are common in the SYS high chip (`OR $37` hiding SCF, `LD A,n`
  hiding POP AF, `LD BC,nn` hiding two bytes): 4 unlabelled targets and a dozen accepted labels, each
  explained.
- **One table, two readers**: the statement words at $00C7-$00D1 are also calculator operations 0-5.
- **Regions that touch merge**, so the constant sub-tables ($0112-$0228), the four key maps ($17BF-$18FE)
  and the token table with the message words ($1E6D-$1FF1) are each one region with data labels and
  synopses at their starts.

## State of the work

| Sidecar | Level | Labels | Notes |
|---|---|---|---|
| `tvc12-d4.rom.dis` | **2** | 471 | 75 regions, 1,802 annotated lines; checked in the running IDE (labels at $C000-$DFFF) |
| `tvc12-d3.rom.dis` | **2** | 607 | 285 regions (function entries, calculator streams, error table); checked in the running IDE |
| `tvc12-d7.rom.dis` | **2** | 287 | 39 regions; checked in the running IDE at the boot's breakpoint on $F000 (EXT paged in) |
| the others | 0 | | next: BASIC 2.2's chips (`tvc22-d6`, `tvc22-d4`, `tvc22-d7`), reusing 1.2's names where the code matches |

**Method that worked (tvc12-d4, repeated for tvc12-d3 with seven helpers).** A profile run first (the core's `setProfiling` over boot and ~60 typed
commands: what runs as code, what is read as data) marked the big data blocks before any helper started;
then six helpers, one per range ($0000/$0974/$0D48/$1000/$1500/$18FF), with
`helper-briefs/tvc-draft-a-range.md`, `dispatch.txt` (every routine the ROM's own tables reach), `facts.md`
and the coverage map. Merged with `merge-drafts.py` (canonicalise with `apply-annotations.cjs` and an empty
batch afterwards); then the labels a helper left without a synopsis written, numeric references to
labelled code swapped for names (RAM addresses below $2000 look like offsets: check each), and every
"probably" settled by a probe or removed. A helper caught the dispatch file's off-by-one: build such files
from the indexing code, not from the table's look.

## Not done yet

- **VT-DOS** (`tvc-vtdos.rom`): its four 4K pages all run at $C000 (port 18h bits 5-4), so one origin
  per kind does not describe it, and the HBF partitions (-4 to -7) are not ROM pages in the bank space
  yet. Plan that before #6.
- **The OS manual** (`operaciosrendszer.pdf`) is scanned images without a text layer; it was not used.
  Its system call pages could give official names (`manual`) later.
