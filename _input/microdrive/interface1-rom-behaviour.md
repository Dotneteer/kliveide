# What the Interface 1 ROM does (and what an emulator must give it)

Written in our own words. Addresses are given for **v1** (from [GC], Carri's listing of the first
edition) and **v2** (from [V2], the Hutcheson/Wearmouth commented disassembly of `if1-2.rom`).
Tags as in `sources.md`. No ROM code is reproduced here. The routine names are the ones used by
those disassemblies.

---

## 1. How control reaches the shadow ROM

Every entry is an **M1 fetch at `$0008`**, which pages the ROM in (see `interface1-hardware.md`
§3), or at `$1708` (CLOSE). The code at `$0008` does `LD HL,(CH_ADD)`, which is common to both
ROMs, takes the return address from the stack and jumps to **START-2 (`$009A`, both
versions)**. START-2 then sorts the entry by that return address [GC 0008–00FB], [V2 L0008–L00FB]:

1. **Return address `$0000` → "back from a main-ROM call".** The shadow ROM calls main-ROM
   routines with **RST `$10` (CALBAS)** followed by a 2-byte address. CALBAS puts the target into
   the **SBRT** stub in RAM (`$5CB9`: `LD HL,nn / CALL nn / LD ($5CBA),HL / RET`). It stacks
   `$0000` and `$0008`, stacks `$5CB9`, and jumps to `$0700`. UNPAGE's `RET` then runs the stub
   with the main ROM paged. The stub's `RET` returns to `$0008`, which **pages the shadow ROM back
   in**, and START-2 sees the `$0000` marker, restores HL and returns to the caller
   [GC 0010/0081], [V2 L0010/L0081].
   → *Emulator requirement: paging must trigger on any M1 at `$0008`, including one reached by
   `RET`, not only by `RST 8`.*
2. **Return address `$15FE` → channel I/O.** IF1 channels ("m", "n", "t", "b") store `$0008`
   as their main-ROM input and output addresses. When the main ROM's CALL-SUB (the `CALL` at
   `$162C`) calls the channel, the stack holds `$15FE`. START-3 then jumps to the shadow
   input/output routine stored in the channel (offsets 5 and 7), with UNPAGE as the return address
   [GC 00A5–00BB].
3. **Anything else → a main-ROM error (RST 8 + code byte).** START-4 [GC 00BC], [V2 L00BC]:
   - `RST $30` (NEWVARS → **CRT-VARS `$01F7`**) creates the IF1 system variables if they are
     missing (§3).
   - `OUT ($F7),$01` and `OUT ($EF),$EE`, which put the interface in a known idle state.
   - Fetches the error code byte from the main ROM's RST 8 caller (via CALBAS to a
     `LD A,(HL)` in the main ROM at `$007B`) and stores it in ERR_NR.
   - Code `$FF` ("OK"): if this is the first IF1 entry since NEW/power-up (FLAGS3 bit 1) and the
     edit line starts with `RUN` (token `$F7`), it jumps to **LOAD-RUN** (v1 `$0A95`, v2
     `$0A99`), which loads the program **"run" from drive 1**. Otherwise it reports "Program
     finished". This is why plain `RUN` with no program prints "Program finished" instead of "OK"
     when an IF1 is attached [GC 00CE–00E8], [SM §3 2.1(a)].
   - Code ≥ `$1B` → **hook code** (§2). v1 accepts `$1B–$32`, v2 `$1B–$34`. Anything higher gives
     "Hook code error" [GC 1981], [V2 L1E71].
   - Codes `$0B` "Nonsense in BASIC", `$0E` "Invalid file name" and `$17` "Invalid stream" →
     **new-command syntax/execute** (§4), unless in INPUT mode or already inside a new command.
     Every other code goes back to the main ROM's error handler (RST `$28` ROMERR).
4. **`$1708` → CLOSE #** of IF1 channels (CLOSE-CL `$1708` → CLOSE `$1718`, both versions).
   It also fixes the 48K CLOSE bug for unopened streams [GC 1708].

Other restarts inside the shadow ROM:

| RST | Name | Role |
|---|---|---|
| `$00` | MAIN-ROM | clear FLAGS3, return to the main ROM through `$0700` |
| `$10` | CALBAS | call a main-ROM routine (see above) |
| `$18` | CHKSYNTAX | Z = syntax-checking (FLAGS bit 7) |
| `$20` | SH-ERR | raise an IF1 report (code byte follows, see §7) |
| `$28` | ROMERR | raise a main-ROM report (ERR_NR already set) |
| `$30` | NEWVARS | create system variables |
| `$38` | — | `EI : RET`. No keyboard scan or FRAMES update while paged |
| `$66` | — | `RETN` |

[GC restart section], [V2 L0000–L0066].

**VECTOR (`$5CB7`)**: when a statement fails both the main ROM's and the IF1's syntax, the IF1
jumps through VECTOR, which is normally `$01F0` (ERR-6 → "Nonsense in BASIC"). User code can
point VECTOR at RAM to add commands of its own [GC "Extending Spectrum BASIC"], [UM App. 2].

## 2. Hook codes (RST 8 + byte)

Hook codes are called from the main ROM as `RST 8 : DEFB code`. Only A is passed in. Registers
are not preserved, and some hooks corrupt HL′ [GC "Use of hook codes"]. The dispatcher sets
ERR_NR = `$FF`, stacks UNPAGE (`$0700`) and jumps to the routine [GC 1987], [V2 L1E77].

| Code | Function | v1 addr | v2 addr |
|---|---|---|---|
| `$1B` | CONS-IN (wait for a key) | `$19D9` | `$1ECD` |
| `$1C` | CONS-OUT (print to stream 2 = upper screen) | `$19EC` | `$1EE0` |
| `$1D` | BCHAN-IN (RS232 byte in) | `$0B81` | `$0B88` |
| `$1E` | BCHAN-OUT (RS232 byte out) | `$0C5A` | `$0D07` |
| `$1F` | PRT-OUT (print to stream 3) | `$19FC` | `$1EF0` |
| `$20` | KBD-TEST | `$1A01` | `$1EF5` |
| `$21` | **SEL-DRIVE** (A = 1–8 on, 0 = all off) | `$17F7` | `$1532` |
| `$22` | OP-TEMP-M (open a temporary "m" channel) | `$1B29` | `$1B05` |
| `$23` | CLOSE-M2 | `$12A9` | `$138E` |
| `$24` | ERASE | `$1D6E` | `$1D79` |
| `$25` | READ-SEQ | `$1A09` | `$1EFD` |
| `$26` | WR-RECD | `$11FF` | `$12DA` |
| `$27` | RD-RANDOM | `$1A17` | `$1F0B` |
| `$28` | RD-SECTOR (sector number in CHREC) | `$1A4B` | `$1F3F` |
| `$29` | RD-NEXT | `$1A86` | `$1F7A` |
| `$2A` | WR-SECTOR | `$1A91` | `$1F85` |
| `$2B` | v1 bug: same as `$22`. v2: SET-T-MCH | `$1B29` | `$10A5` |
| `$2C` | DEL-M-BUF (reclaim channel) | `$10C4` | `$119F` |
| `$2D` | OP-TEMP-N | `$0EA9` | `$0F46` |
| `$2E` | CLOSE-NET | `$1A24` | `$1F18` |
| `$2F` | GET-PACK (v1 bug: carry flag lost) | `$1A31` | `$1F25` |
| `$30` | SEND-PACK | `$0DB2` | `$0E4F` |
| `$31` | create system variables (just returns) | `$19A8` | `$1E98` |
| `$32` | call the shadow-ROM address held in HD_11 (`$5CED`) | `$19A4` | `$1E94` |
| `$33` | v2 only: GET-DESC (read the next record descriptor) | — | `$1FE4` |
| `$34` | v2 only: OP-B-CHAN | — | `$1FF6` |

[GC 19A9 table], [V2 L1E99 table]. Hook `$32` with a crafted return address is the standard trick
for paging the shadow ROM in from user code. `CALL $0700` pages it out again [GC].

Games and utilities call these hooks, especially `$21`, `$22`, `$26`–`$2A` and `$32`. **For
compatibility, emulate the hardware and run the real ROM, rather than trapping hooks.**

## 3. System variables (58 bytes inserted at `$5CB6`)

**CRT-VARS** (`$01F7`, both versions) checks whether CHANS has already moved, by testing whether
`CHANS + $A349` carries, i.e. CHANS ≥ `$5CB7`. If it has not, it calls the main ROM's MAKE-ROOM
at `$5CB5` for **58 (`$3A`) bytes**. Everything above, starting with CHANS and PROG, moves up 58
bytes. It then copies 19 default bytes and sets COPIES = 1 [V2 L01F7–L023D]. **v2 also sets
`$5CB0` = 0 and `$5CB1` = 80** (the RS232 print column and width, in bytes the 48K leaves unused),
which is how `PEEK 23729` tells the editions apart [V2], [GC App. 7–8].

This happens at the **first RST 8 after power-on or NEW**, not at reset. Before that, `PEEK 23734`
is the first byte of CHANS [V2 header comment], [SM §3 2.1(a)].

| Addr | Name | Size | Meaning / default |
|---|---|---|---|
| `$5CB6` | FLAGS3 | 1 | (IY+`$7C`) b0 executing a new command · b1 CLEAR#/first entry (default `$02`) · b2 use the main error handler · b3 network · b4 LOAD/MOVE · b5 SAVE · b6 MERGE · b7 VERIFY |
| `$5CB7` | VECTOR | 2 | `$01F0` |
| `$5CB9` | SBRT | 10 | paging stub (see §1). `$5CBA` holds the saved HL |
| `$5CC3` | BAUD | 2 | `3500000/(26*baud) − 2`. Default `$000C` = 9600 baud |
| `$5CC5` | NTSTAT | 1 | own station number, default 1 |
| `$5CC6` | IOBORD | 1 | border colour during I/O, default 0 (black) |
| `$5CC7` | SER_FL | 2 | RS232 one-byte look-ahead |
| `$5CC9` | SECTOR | 2 | sector counter. In v2 the low byte is "max sectors to visit" and the high byte the visited count |
| `$5CCB` | CHADD_ | 2 | saved CH_ADD |
| `$5CCD` | NTRESP | 1 | network response |
| `$5CCE` | NTDEST … NTCHS | 8 | network header buffer (NTDEST, NTSRCE, NTNUMB(2), NTTYPE, NTLEN, NTDCS, NTCHS) |
| `$5CD6` | D_STR1 | 8 | first file specifier: drive/station/baud (2), S_STR1 stream (1), L_STR1 device letter (1), N_STR1 name length (2) and address (2) |
| `$5CDE` | D_STR2 | 8 | second specifier (MOVE, LOAD) |
| `$5CE6` | HD_00 | 1 | file type 0–3 |
| `$5CE7` | HD_0B | 2 | length |
| `$5CE9` | HD_0D | 2 | start |
| `$5CEB` | HD_0F | 2 | program length / array name |
| `$5CED` | HD_11 | 2 | autostart line / hook `$32` address |
| `$5CEF` | COPIES | 1 | copies made by SAVE, reset to 1 |
| `$5CF0` | — | — | start of the microdrive maps, then CHANS |

[GC App. 3], [UM App. 2], [V2]. RES-VARS (`$0255`) fills the 34 bytes from NTRESP to
`$5CEE` with `$FF`. The v2 commentary says this happens whenever an extended command starts
[V2 L0255].

Consequences: BASIC moves 58 bytes up, so machine code in REM statements moves too [UM App. 2].
Every open "m" channel takes **595 bytes** plus a 32-byte map per drive, and an "n" channel 276
bytes [UM App. 2].

## 4. BASIC extensions

The syntax hooks are CAT, FORMAT, MOVE, ERASE, OPEN #, SAVE, LOAD, VERIFY, MERGE, CLS and CLEAR
[GC "Extending Spectrum BASIC"]. They are user-visible as follows [UM App. 6]:

- `CAT d` / `CAT #s;d`: alphabetical catalogue (up to 50 names), cartridge name, free KB.
- `FORMAT "m";d;"name"`, `FORMAT "n";station`, `FORMAT "t";baud` / `FORMAT "b";baud`.
- `ERASE "m";d;"name"`.
- `MOVE src TO dst`, where each side is a stream `#n` or a channel spec.
- `OPEN #s;"m";d;"name"` / `"n";st` / `"t"` / `"b"`, and `CLOSE #s`.
- `CLS #` (reset all streams) and `CLEAR #` (close all streams without flushing).
- `SAVE *`, `LOAD *`, `VERIFY *` and `MERGE *` with `"m";d;"name"`, `"n";st` or `"b"`, plus all the
  usual options (CODE, SCREEN$, DATA, LINE).
- `PRINT #`, `INPUT #`, `INKEY$ #` on IF1 streams.
- `RUN` with no program auto-loads "run" from drive 1 (§1).
- Drive numbers are 1–8, names 1–10 characters, stations 0–64, streams 0–15.

## 5. Microdrive routines: what they do to the hardware

### 5.1 Low level

| Routine | v1 | v2 | What it does |
|---|---|---|---|
| SEL-DRIVE | `$17F7` | `$1532` | A = 0: SW-MOTOR(0), `EI`. A = 1–8: `DI`, SW-MOTOR(A), ~37 ms delay, then up to 5000 × "6 consecutive GAP=0" presence tests. On failure: all motors off, then **"Microdrive not present"**. On success it returns with **interrupts disabled** |
| SW-MOTOR | `$182A` | `$1565` | Clocks 8 select bits (drive 8 first), ~1 ms per clock phase (DEL-S-1 `$1867`/`$15A2`, BC=135) |
| OUT-M-HD / OUT-M-BUF | `$1872`/`$1878` | `$15AD`/`$15B3` | Check write protect ("Drive 'write' protected"), border = IOBORD, `$EF`←`$E2`, 3 × NOP, OTIR 30 / 543 bytes to `$E7`, `$EF`←`$E6`, restore the border |
| GET-M-HD / GET-M-BUF | `$18A3`/`$18A9` | `$15E2`/`$15EB` | Wait for ≥ 8 polls GAP=1, then ≥ 6 polls GAP=0, `$EF`←`$EE` (both versions write it after the gap test, perhaps to re-arm the read logic), wait for SYNC=0, INIR 15 / 528 bytes from `$E7`, `$EF`←`$EE`. v2 adds a timeout (header 65 536, record 500 gap-loop iterations) and a 60-poll limit on the SYNC wait |
| READ-BLK / WR-BLK | — | `$165A`/`$16AF` | v2 FORMAT only: write or verify the long `$FC` test record |
| TEST-BRK | `$18E9` | `$163E` | CAPS+SPACE → "BREAK into program" (v2 restores the border first) |
| DELAY-BC | `$18FA` | `$1652` | ~26 T × BC |

### 5.2 Sector level

| Routine | v1 | v2 | What it does |
|---|---|---|---|
| GET-M-HD2 | `$12C4` | `$13A9` | Read headers until one has a valid HDCHK and HDFLAG bit 0 = 1 |
| G-HD-RC | `$11A5` | `$1280` | GET-M-HD2, then immediately GET-M-BUF for **the record of the same sector**. Checks DESCHK, RECFLG bit 0 = 0, the free test and a name match with CHNAME. Returns C = error, Z = free sector, NZ/NC = match |
| CHECK-MAP / CHK-MAP-2 | `$12DF`(†)/`$12DA` | `$13C4`/`$13BF` | Map bit for HDNUMB / RECNUM |
| RES-B-MAP | `$12FE` | `$13E3` | Mark a sector free in the map |
| DEC-SECT | `$1312` | `$13F7` | SECTOR − 1 |
| CHK-NAME | `$131E` | `$1403` | Compare a name with CHNAME (space-padded) |
| CHKS-HD-R / CHKS-BUFF | `$1341`/`$1346` | `$1426`/`$142B` | Compute and verify checksums (see `microdrive-media.md` §4) |
| SEND-BLK | `$1275` | `$135A` | GET-M-HD2 until a header whose map bit is clear. Check write protect. `$E6`, wait 360 × 26 T (~2.7 ms), OUT-M-BUF, `$EE`. Set the map bit |
| CHK-FULL | `$1264` | `$1349` | Z if every map bit is set |

(†) Carri's listing gives both `$12DF` and `$12E1` for CHECK-MAP, so one of them is a typo in the
listing.

### 5.3 File level

| Routine | v1 | v2 | Notes |
|---|---|---|---|
| SET-T-MCH | `$0FE8` | `$10A5` | Create a 595-byte channel (and a map with all bits set, unless another channel on that drive already has one). "Reading a 'write' file" if the name is already open for write |
| OP-TEMP-M | `$1B29` | `$1B05` | Create the channel, SEL-DRIVE, scan **one revolution** (v1: 255 sectors; v2: until the visited count exceeds highest HDNUMB + 3). Builds the map, clearing bits for free sectors, and looks for record 0 of the named file. The motor is left **on** |
| GET-RECD | `$1177` | `$1252` | Find record CHREC of CHNAME. Gives up after **1275 sectors (≈5 revolutions)** → "File not found" |
| WR-RECD / WRITE-PRC | `$11FF`/`$120D` | `$12DA`/`$12EE` | Copy CHNAME/CHBYTE/CHREC into the descriptor, compute the checksums, SEND-BLK into the next free sector, CHREC + 1. "Microdrive full" when the map is full |
| CLOSE-M2 | `$12A9` | `$138E` | For a write channel: mark EOF and write the last record. Then motor off and reclaim |
| SA-DRIVE (SAVE *) | `$14DA` | `$18CB` | Check write protect. OP-TEMP-M ("Writing to a 'read' file" if the name exists). Check that FREESECT ≥ records needed. Write the 9-byte header + data as records. Repeat COPIES times |
| F-M-HEAD / LV-MCH (LOAD/VERIFY *) | `$1580`/`$15A9` | `$1971`/`$199A` | Read the header from record 0, then collect the remaining records **in whatever order they pass**, using the map (saved on the stack) to track which have arrived. "Verification has failed" on mismatch |
| FORMAT | `$1B6E` | `$1B5D` | see `microdrive-media.md` §3 |
| CAT | `$1C58` | `$1C52` | One revolution. Free sectors → map. Names (no CHR$ 0 first character, no duplicates) inserted sorted into the 512-byte buffer, up to 50. Prints the name list and free sectors/2 |
| ERASE | `$1D6E` | `$1D79` | Up to 5 revolutions to find every record of the name (pseudo-map in the buffer), then rewrites each one's descriptor as free |
| RD-SECTOR / RD-NEXT / WR-SECTOR | `$1A4B`/`$1A86`/`$1A91` | `$1F3F`/`$1F7A`/`$1F85` | Raw sector access, at most 240 headers searched |
| RCL-T-CH | `$17B9` | `$17B7` | On every error: reclaim temporary channels, `$EF`←`$EE`, all motors off |
| MOVE | `$13F1` | `$17F5` | Byte copy until EOF (FLAGS3 bit 4 suppresses the EOF error) |

## 6. Behaviour an emulator must reproduce for the ROM to work

1. **Paging**: M1 at `$0008` and `$1708` pages in, M1 at `$0700` pages out *after* the fetch.
   The `$0008` rule must also fire when `$0008` is reached by `RET` (CALBAS).
2. **WAIT pacing on `$E7`**: an `IN` returns the next tape byte only when it has "arrived". `INIR`
   and `OTIR` are then naturally paced. A read with no data stream must stall rather than return
   junk, at least while the motor runs over a gap. The ROM never reads `$E7` outside a found
   block, so a pragmatic emulator can just return the next byte. The real hang ("IN 0 crash")
   is optional fidelity.
3. **The GAP/SYNC protocol as the ROM polls it**: for each block, a gap period long enough for
   **≥ 8 consecutive** polls of GAP=1, then **≥ 6** polls of GAP=0 (signal), then SYNC=0. After
   that the `$E7` stream starts at the flag byte. The header-to-record gap must satisfy this
   too, because G-HD-RC reads the record straight after the header with the same search.
   Polling happens about every 90 T in the gap loops and every 38 T in the v2 sync loop. Timing
   only has to be *plausible*: v1 waits forever for these events and v2 has generous timeouts.
4. **Presence**: a selected drive with a formatted cartridge must show GAP=0 for 6 consecutive
   polls within ~5000 tries. An absent drive, no cartridge or a blank cartridge shows GAP=1 for
   ever, which gives "Microdrive not present".
5. **Write path**: track ERASE (EF bit 3 = 0) and R/W (EF bit 2 = 0). Bytes written to `$E7`
   while writing land at the current tape position. The preamble is written by the CPU (it is part
   of the 543/30 bytes), and the gate array must recognise it again on read. For a sector-slot
   emulation (Fuse-style), a write that begins about 2.7 ms after a header has been read replaces
   *that sector's record block*. During FORMAT (erase held on, header then record written
   back-to-back with fixed delays) the writes create the headers.
6. **Write protect bit**: EF bit 0 = 1 only for a selected drive holding a writable cartridge.
7. **Drive select shift register** as in `interface1-hardware.md` §5. Only the selected drive's
   tape advances. Ideally tape position advances with emulated time while the motor runs, so
   the ROM's "five revolutions" retry limits behave.
8. **Interrupts**: nothing special is needed, because the ROM disables them itself. But a 128K's
   or a game's IM 2 handler will not run either while a drive is active.
9. **Border**: `OUT ($FE),IOBORD` before each write, so writes flash the border. This comes for
   free if the ULA port is emulated.
10. **Sector order**: sectors are met in **descending HDNUMB order** (the order FORMAT wrote them).
    v2's OP-TEMP-M and CAT stop after (highest HDNUMB seen + 3) headers, so an emulated cartridge
    must show its sectors cyclically and in a stable order. A random order would end those scans
    early. Quirk: HDNUMB + 3 wraps for 253 and 254 (`ADD A,3` in 8 bits), so those sectors never
    raise the limit, but lower ones do [V2 L1B16–L1B26].

## 7. IF1 reports (RST `$20` codes)

| Code | Report | Code | Report |
|---|---|---|---|
| `$FF` | Program finished | `$0B` | Stream already open |
| `$00` | Nonsense in BASIC | `$0C` | Writing to a 'read' file |
| `$01` | Invalid stream number | `$0D` | Reading a 'write' file |
| `$02` | Invalid device expression | `$0E` | Drive 'write' protected |
| `$03` | Invalid name | `$0F` | Microdrive full |
| `$04` | Invalid drive number | `$10` | **Microdrive not present** |
| `$05` | Invalid station number | `$11` | File not found |
| `$06` | Missing name | `$12` | Hook code error |
| `$07` | Missing station number | `$13` | CODE error |
| `$08` | Missing drive number | `$14` | MERGE error |
| `$09` | Missing baud rate | `$15` | Verification has failed |
| `$0A` | (unused, leftover text) | `$16` | Wrong file type |

The order and texts come from the v2 message table [V2 ~L0260 REP-MSG] and the error bytes used
throughout [GC]. Meanings are in [UM App. 5].
