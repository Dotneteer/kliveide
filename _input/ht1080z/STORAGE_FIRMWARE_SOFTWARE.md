# HT-1080Z: firmware, storage and software (research notes)

Research date: 2026-10-21. Scope: the ROMs, the Level II BASIC ROM internals an emulator/IDE needs,
the cassette and disk formats, software sources, test programs, and reference documents. Memory map,
video, keyboard, sound chip and ports are covered by another note and are mentioned here only where
storage or firmware depends on them. Emulators are covered by another note too.

Conventions: every fact carries its source inline. *Inference* marks a conclusion drawn by this
author, not stated by a source. Where sources disagree both versions are kept (and listed again in
the last section). No ROM image was downloaded; ROM identities below come from published hash lists.

Abbreviations of the main sources:

- **MAME-drv**: `src/mame/trs/trs80.cpp` (mamedev/mame master, read 2026-10-21) -
  https://github.com/mamedev/mame/blob/master/src/mame/trs/trs80.cpp
- **MAME-cas**: `src/lib/formats/trs_cas.cpp` - https://github.com/mamedev/mame/blob/master/src/lib/formats/trs_cas.cpp
- **MAME-dsk**: `src/lib/formats/trs80_dsk.cpp`; **MAME-quik**: `src/mame/trs/trs80_quik.cpp`;
  **MAME-m**: `src/mame/trs/trs80_m.cpp`; softlists `hash/trs80_cass.xml`, `hash/trs80_quik.xml`.
- **HS**: the Hungarian HT tribute site https://ht.homeserver.hu/ (pages under `/html/`). Its ROM and
  variant pages are written by Majzik István and Grósz Attila.
- **T80-DIS**: trs-80.com interactive Model I/III/4 ROM disassembly,
  https://trs-80.com/sub-disassem-rom-m1-full.htm (data embedded as JSON in the page; saved copy in `docs/`).
- **KOLLÁR**: Kollár Zoltán's hand disassembly of the HT ROM 0000H-2FFFH (notebook scan),
  https://ht.homeserver.hu/doc/listak/htrom/htrom_basic.pdf
- **FIXTÁR**: "HT-1080Z iskolaszámítógép fix tárolója" (the HT ROM book, 159 pp.),
  https://ht.homeserver.hu/doc/konyvek/fixtarolo.pdf
- **ME-II/3**: Tóth Ferenc, "A HT-1080Z iskolaszámítógép néhány szoftvertulajdonsága", Magyar
  Elektronika II/3 pp. 44-51, https://ht.homeserver.hu/doc/cikkek/magyar_elektronika/ht-1080z_szoftvertulajdonsagok.pdf

---

## 0. Lineage in one paragraph

The HT-1080Z (Híradástechnika Szövetkezet, Budapest, 1983-1986; 2364 units to education, 1861 of
them to schools) is a licensed EACA Video Genie I / System 80 with an added AY-3-8910 sound + I/O
board; the first series used original Hong Kong EACA boards (HS `html/hardver1080valtozatok.html`;
holdcomputers sheet by Vidovenyecz Zsolt, https://www.holdcomputers.com/holdcomputers_elemei/doc/info/ht1080z.pdf).
HS `html/hardverreszletek.html` states the first series is, as far as known, identical to the
System-80 Mark I "Blue Label". MAME-drv agrees: "The ht1080z is identical to the System 80, apart
from the character rom. The ht1080z2 has a modified extension rom and character generator." So the
HT is a TRS-80 Model I Level II **clone of a clone**: it inherits Level II BASIC through EACA's
re-built ROM, not Tandy's ROM bytes (see 1.2).

Variants (HS `html/hardver1080valtozatok.html`, `html/hardverrom.html`):

| Variant | Years | RAM | ROM build | Boot banner | Extension banner (`SYSTEM` then `/12288`) |
|---|---|---|---|---|---|
| HT-1080Z Series I ("School-Computer", volume knob + level meter) | 1983- | 16K | BASIC and extension in mask ROM | `READY ?` | `NEW KEYBOARD ROUTINE ENABLE` |
| HT-1080Z Series II (red level LED, auto-level) | 1984- | 16K | BASIC mask ROM (same content as S-I), extension in EPROM | `READY ?` | none printed |
| HT-1080Z/64 | 1985- | 48K | BASIC and extension in EPROM | `MEMORY SIZE?` then `BASIC 2.20` | `BASIC ROM EXTENSION 2.51` |
| HT-2080Z (business) | - | as 1080Z | ROM identical to HT-1080Z (some had S-I ROM with the new recorder) | | |
| HT-3080C (prototype only) | 1986 | - | unknown ("A ROM tartalomról nincs információnk") | | |

FIXTÁR p. 301 (section "6) ROM eltérések a különböző verzióknál") dates the Series I/II split by
serial number: machines below serial **832** ("kijelző műszeres", i.e. with the level meter) differ
from the book's machine in the extension EPROM range 302FH-305BH, and because they lack the accented
letters their EPROM content ends at 35EBH. (Page read from the scan; transcription is the author's.)

---

## 1. ROMs

### 1.1 What is in the machine

- Main ROM: 12 KB "Microsoft 12K Level II BASIC" at 0000H-2FFFH, plus a **1.5 KB extension** at
  3000H-35FFH (monitor, lower case, auto-repeat, flashing cursor, RENUMBER, screen print; Hungarian
  support from Series II) - HS `html/english.html` ("ROM 12kB + 1.5kB extension (monitor, Hungarian
  support)"); holdcomputers sheet; System 80 user manual addendum (`docs/system80_users_manual_with_blue_label_pages.pdf`,
  p. "Attach to System 80 user's manual": "An 1.5K ROM is added ... exclusive 1.5K extension to the
  Microsoft 12K BASIC").
- Character generator: 2 KB in MAME (`0x0800`), decoded by MAME as 128 characters, 16 bytes each,
  5x12 visible (MAME-drv `ht1080z_charlayout`). The EACA System 80 uses a 1 KB 2513 chargen instead
  (MAME-drv `ROM_START(sys80)`).
- Which Microsoft BASIC version: sources only say "Microsoft 12K Level II BASIC". The HT-1080Z/64
  prints `BASIC 2.20` at start-up (HS variants page; FIXTÁR p. 302 shows the string at 0113H-011DH in
  the /64 ROM). Whether "2.20" is a Microsoft version number or an HT build number is not stated
  anywhere found - open question.

### 1.2 MAME's ROM sets (names, sizes, hashes exactly as MAME lists them)

All three HT sets are clones of `eg3003` (EACA Video Genie EG3003), flagged
`MACHINE_NOT_WORKING | MACHINE_SUPPORTS_SAVE` (MAME-drv `COMP(...)` lines, although the header's
status list says "ht1080z works / verify clock for AY-3-8910 / investigate expansion-box").
Region `maincpu` is 0x3800 bytes.

| Set | File | Load addr | Size | CRC32 | SHA1 |
|---|---|---|---|---|---|
| `ht1080z` (1983, "HT-1080Z Series I") | 3001.z10 | 0x0000 | 0x1000 | 8f5214de | d8c052be5a2d0ec74433043684791d0554bf203b |
| | 3002.z11 | 0x1000 | 0x1000 | 46e88fbf | a3ca32757f269e09316e1e91ba1502774e2f5155 |
| | 3003.z12 | 0x2000 | 0x1000 | 306e5d66 | 1e1abcfb5b02d4567cf6a81ffc35318723442369 |
| | sys80.z13 | 0x3000 | 0x0800 | 2a851e33 | dad21ec60973eb66e499fe0ecbd469118826a715 |
| | ht1080z.z25 (chargen) | 0x0000 | 0x0800 | e8c59d4f | a15f30a543e53d3e30927a2e5b766fcf80f0ae31 |
| `ht1080z2` (1984, "HT-1080Z Series II") | 3001.z10, 3002.z11, 3003.z12 | as above | | as above | as above |
| | ht1080z2.z13 | 0x3000 | 0x0800 | 07415ac6 | b08746b187946e78c4971295c0aefc4e3de97115 |
| | ht1080z2.z25 (chargen) | 0x0000 | 0x0800 | 6728f0ab | 1ba949f8596f1976546f99a3fdcd3beb7aded2c5 |
| `ht108064` (1985, "HT-1080Z/64") | 3001_64.z10 | 0x0000 | 0x1000 | 59ec132e | 232c04827e494ea49931d7ab9a5b87b76c81aef1 |
| | 3002_64.z11 | 0x1000 | 0x1000 | a7a73e8c | 6e0f232b8666744328853cef6bb72b8e44b4c184 |
| | 3003.z12 | 0x2000 | 0x1000 | 306e5d66 | 1e1abcfb5b02d4567cf6a81ffc35318723442369 |
| | ht108064.z13 | 0x3000 | 0x0800 | fc12bd28 | 0da93a311f99ec7a1e77486afe800a937778e73b |
| | ht108064.z25 (chargen) | 0x0000 | 0x0800 | e76b73a4 | 6361ee9667bf59d50059d09b0baf8672fdb2e8af |

Observations (facts from the same file):

- `3003.z12` has the same CRC/SHA1 as Tandy's `rom-c.z3` in `trs80l2` BIOS "level2": the upper 4 KB
  (2000H-2FFFH) is byte-identical to Radio Shack's. `3001`/`3002` differ from both Tandy BIOS sets.
- The Series I set uses EACA's `sys80.z13` (the System 80 "blue label" extension) unchanged; MAME's
  comment on `sys80` says: "This rom turns the system80 into the 'blue label' version. SYSTEM then
  /12288 to activate."
- MAME's machine `ht1080z` calls `init_trs80l2` (7-bit video RAM) for Series I/II, but `empty_init`
  for `ht108064` (*inference*: MAME treats /64 video RAM as 8-bit, consistent with the /64 chargen
  having characters at codes 0-31).
- MAME's comment: "Although I don't have schematics for the HT-series, it would be reasonable to
  expect the board locations to be the same" - the `zNN` locations are a guess.
- Also on HS (`html/hardverrom.html`) there are dumps named `ht_s1_basic.rom`,
  `ht_s1_basicexpansion.rom`, `ht_s1_chargen.rom`, and `_s2_`/`_s3_` equivalents (s3 = /64), credited
  to Majzik István (HT1080Z emulator readme: "Thanks István Majzik, HT1080Z ROM dumps"). Not
  downloaded; sizes/hashes not checked against MAME - open question.

### 1.3 What the Hungarians changed

- **Series I**: nothing Hungarian. The extension (lower case, key repeat, flashing cursor,
  RENUMBER, monitor) is EACA's; no accented letters (HS ROM page).
- **Series II**: modified extension EPROM. With CLEAR held, A/E/U/O give Á/á, É/é, Ü/ü, Ö/ö; plain
  CLEAR (clear screen) moves to BREAK+CLEAR. The accented glyphs replace ASCII positions in the
  chargen (HS ROM page, chargen codes):

  | Key + CLEAR | Char / code | + SHIFT | Char / code |
  |---|---|---|---|
  | A | Á 93 (5DH) | | á 125 (7DH) |
  | E | É 64 (40H) | | é 96 (60H) |
  | U | Ü 94 (5EH) | | ü 126 (7EH) |
  | O | Ö 92 (5CH) | | ö 124 (7CH) |

- **HT-1080Z/64**: BASIC itself modified (3001_64/3002_64) and extension 2.51. Accented letters and
  maths symbols are typed as apostrophe (SHIFT-@) + key, **stored as two bytes** (apostrophe + key)
  in programs/strings and converted by the print routine; chargen codes 0-31 hold the glyphs:
  Á0 É1 Í2 Ó3 Ö4 Ő5 Ú6 Ü7 Ű8 ■9 ∫10 ∞11 √12 Σ13 Ψ14 Ω15, á16 é17 í18 ó19 ö20 ő21 ú22 ü23 ű24 α25
  β26 γ27 λ28 μ29 π30 ω31. `PRINT CHR$(21)` hides the apostrophe (special set on), `PRINT CHR$(20)`
  shows it again; SHIFT+CLEAR+key enters control codes 0-31 (HS variants page;
  `docs/ht1080z64_valtozasok_changes_hu.pdf` pp. 3-6, the official HT "changes" leaflet, which also
  notes special characters cannot be read with INKEY$, cannot appear in variable names and do not
  sort).
- /64 BASIC ROM changes listed in FIXTÁR pp. 302-303 (read from the scan): the power-on message
  area at 0105H-0121H holds `MEMORY SIZE` and `BASIC  2.20`; 012CH and 0471H-047CH are patched to
  NOP; 0591H becomes `JR 05B4H` with 0593H-05BDH filled with FFH (RST 38H), 05BEH `RET`,
  05BFH-05D0H FFH. The extension's init at 302FH: `LD HL,3040H` / `CALL 01C9H` (CLS) /
  `CALL 28A7H` (print message) / `LD HL,3079H` / `LD (4016H),HL` (hooks the keyboard DCB driver
  address) / `JR 3006H`; message at 3040H-305BH is `BASIC ROM EXTENSION 2.51`. Series II's 302FH
  sequence is the same with a different message ("NEW KEYBOARD ROUTINE ENABLE"-length text at
  3040H in FIXTÁR p. 301 for pre-832 machines).
- **Messages stay English** (READY, MEMORY SIZE, error codes). Hungarian error messages existed
  only as a user program: Mikroszámítógép Magazin 1987/6 "Magyar nyelvű hibaüzenetek"
  (`docs/mm1987_06_magyar_hibauzenetek_hu.pdf`). *Inference*: no HT ROM contains Hungarian messages.
- **No new BASIC keywords and no sound command in ROM.** The AY-3-8910 is driven with `OUT 31,reg`
  / `OUT 30,value` (ports 1FH/1EH) from BASIC or machine code (classic-computers.org.nz
  `system-80/other_guises_HT-1080Z.htm`; MAME-drv `ht1080z_io`). The SSOS program ("Screen and
  Sound OS kiegészítő parancsok") on HS `html/programsystem.html` adds commands from tape.

### 1.4 The EACA BASIC versus Tandy Level II (what an emulator must not assume)

- Second cassette select: Tandy writes the recorder number to 37E4H; the EACA/HT ROM does
  `OUT (0FEH),A` at 0212H (A=00H own recorder, FFH the other one) before the motor-on code at 0215H
  (KOLLÁR p. 5 / PDF image 5; MAME-drv: "FE bit 4 selects internal cassette player (low) or external
  unit (high) on a system-80").
- Printer: Tandy Level II uses memory-mapped 37E8H; "System80 uses port FD" (MAME-drv header;
  System 80 user manual Appendix B: "CASSETTE INTERFACE - FF, FE / PRINTER INTERFACE - FD").
- Cassette bit-read delays are the **pre-v1.3 Tandy values** (`LD B,41H` at 0248H, `LD B,76H` at
  024FH) - KOLLÁR p. 6; T80-DIS row 0248H: 41H in v1.0-1.2, 60H in v1.3; row 024FH: 76H vs 85H.
- HS (`html/dokumentaciovilaghalo.html`) warns that the HT differs from the Model I in "kazetta
  kezelés, nyomtató kezelés, bővítőport" (cassette handling, printer handling, expansion port), so most
  but not all TRS-80 programs run.
- The entry points used by machine-code programs are at the Tandy addresses (ME-II/3 lists 002BH,
  0033H, 003BH, 0049H, 01C9H, 0212H, 0235H, 0264H, 0284H, 0296H, 0361H, 1BB3H, 28A7H, 2B75H, ... for
  the HT), and KOLLÁR's listing of 01D9H-0282H matches T80-DIS instruction for instruction except
  the delay constants and the 01FEH-0214H drive select.

### 1.5 Copyright / redistribution status

- No statement found that the HT, EACA or Tandy/Microsoft ROMs are freely distributable. HS hosts
  the HT dumps for download without a licence statement. The HT1080Z emulator (Grósz Attila) is
  "freeware, and may be distributed freely if unaltered" - that statement covers the emulator
  (HS `html/englishht1080z.html`); whether its package contains ROMs was not checked.
- For TRS-80 ROMs generally: xtrs does not ship them ("Since these are copyrighted, they are not
  included in this package") and SlackBuilds' `trs80-roms` README calls the status "murky"
  (https://sources.debian.org/src/xtrs/4.9-5/README ;
  https://slackbuilds.org/repository/15.0/system/trs80-roms/).
- **No open/free replacement Level II ROM was found.** *Inference*: an IDE could avoid shipping
  BASIC by (a) user-supplied ROM files keyed by MAME's hashes, and/or (b) running machine-code
  programs with a minimal own boot stub plus `.cmd`/SYSTEM-tape loading - but anything calling ROM
  entry points (most software) needs the real ROM.

---

## 2. Level II ROM internals relevant to an emulator/IDE

Addresses are Tandy Model I Level II; the HT uses the same ones (1.4). Descriptions are summarised
from T80-DIS (row given), ME-II/3 and KOLLÁR.

### 2.1 Restarts and fixed entry points

| Addr | Use | Source |
|---|---|---|
| 0000H | Power-up: DI, XOR A, jump to init | T80-DIS 0000H |
| 0008H RST 08H | syntax check: compare (HL) with the byte after the RST | T80-DIS 0008H |
| 0010H RST 10H | CHRGET: next non-blank BASIC character into A, Z = end of statement, C = digit | T80-DIS 0010H |
| 0018H RST 18H | compare HL with DE | trs-80.com RAM page |
| 0020H RST 20H | test number type flag 40AFH (A = type-3, flags by type), via 4009H | T80-DIS 0020H (the trs-80.com RAM page summary calling it "next-character fetch" is wrong) |
| 0028H RST 28H | DOS request / "BASIC byte comparison" (via 400CH) | trs-80.com RAM page |
| 0030H RST 30H | via 400FH (DEBUG/DOS) | trs-80.com RAM page |
| 0038H RST 38H | interrupt (IM 1) via 4012H | trs-80.com RAM page |
| 0066H | NMI (the RESET button is wired to NMI on the Model I) | T80-DIS 0066H |
| 002BH | keyboard scan, non-blocking, char in A (0 = none) | T80-DIS 002BH; ME-II/3 |
| 0033H | display char in A at cursor (cursor at 4020H-4021H) | T80-DIS 0033H; ME-II/3 |
| 003BH | print char (ME-II/3: char in C) | T80-DIS 003BH; ME-II/3 |
| 0049H | wait for key, char in A | T80-DIS 0049H; ME-II/3 |
| 01C9H | CLS | ME-II/3; KOLLÁR |
| 01D3H | RANDOM (seed from R into 40ABH) | KOLLÁR |
| 01D9H | CTPULS: output one cassette pulse | T80-DIS 01D9H; KOLLÁR |
| 01F8H | cassette motor off | T80-DIS 01F8H |
| 01FEH | parse `#-1`/`#-2`, select recorder, fall into 0212H | T80-DIS 01FEH; KOLLÁR |
| 0212H | (HT) `OUT (FE),A` select recorder, then motor on at 0215H (A=0 internal) | KOLLÁR; ME-II/3 ("A = 0 vagy 1") |
| 021EH | reset cassette input latch (writes port FF keeping 403DH bits) | T80-DIS 021EH |
| 0221H | write HL-masked value to port FF and shadow 403DH | KOLLÁR p. 5 |
| 022CH | blink the `*` at 3C3FH | T80-DIS 022CH |
| 0235H | read one byte from tape into A | T80-DIS 0235H; ME-II/3 |
| 0241H | read one bit | T80-DIS 0241H |
| 0264H | write byte in A to tape (0261H = CALL 0264H, writes it twice) | T80-DIS 0264H/0261H; KOLLÁR |
| 0284H | select drive, motor on, write leader + A5H | T80-DIS 0284H; ME-II/3 |
| 0287H | write leader + A5H (motor already on) | T80-DIS 0287H |
| 0293H | select drive, motor on, find leader + sync, show `**` | T80-DIS 0293H |
| 0296H | find leader + A5H sync | T80-DIS 0296H; ME-II/3 |
| 029FH | put the two `*` at 3C3EH/3C3FH | T80-DIS 029FH |
| 02A9H | SYSTEM tape: 78H found, read entry address into 40DFH, motor off | T80-DIS 02A9H |
| 02B2H | `SYSTEM` command (`*?` prompt; `/addr` jumps) | T80-DIS 02B2H |
| 0361H / 1BB3H | read a line from keyboard (1BB3H shows `?`) | ME-II/3 |
| 06CCH | recommended return-to-BASIC entry (better than 1A19H) | T80-DIS 06CCH |
| 1A19H | READY | T80-DIS 0102H row |
| 1650H-1821H | reserved-word table (see 2.4) | T80-DIS 1650H |
| 1822H | statement dispatch table (tokens 80H-BBH) | T80-DIS 1822H |
| 1608H | function dispatch table (tokens D7H-FAH) | T80-DIS 1608H |
| 28A7H / 2B75H | print string at HL (to device in 409CH) | ME-II/3 |
| 2BF5H | CSAVE | T80-DIS 2BF5H |
| 2C1FH | CLOAD / CLOAD? | T80-DIS 2C1FH |
| 3000H | HT/EACA extension (1.5K); `/12288`=3000H full init, `/12294`=3006H lower case only, `/12299`=300BH all but flashing cursor, `/12710`=31A6H machine-code monitor; monitor breakpoints are `CALL 3347H` | System 80 manual addendum; MAME-drv header |

Maths entry points (ME-II/3, valid for the HT ROM): integer add 0BD2H, sub 0BC7H, mul 0BF2H,
div 2490H, compare 0A39H; single add 0716H, sub 0713H, mul 0847H, div 08A2H, compare 0A0CH; double
add 0C77H, sub 0C70H, mul 0DA1H, div 0DE5H, compare 0A78H; ABS 0977H, ATN 15BDH, COS 1541H, INT 0B37H,
FIX 0B26H, power JP 13F2H, SQR 13E7H, SIN 1547H, TAN 15A8H, EXP 1439H, LOG 0809H, RND 14C9H, seed
01D3H; conversions 0A7FH/0AB1H/0ADBH, ASCII->int 1E5AH, ASCII->number 0E6CH/0E65H, print HL 0FAFH,
int->ASCII 132FH, FAC->ASCII 0FBDH; moves 09D2H/09D3H/09B4H/09B1H/09C2H/09BFH/09A4H, string move 29C8H.
REG1 (FAC) = 411DH-4124H, REG2 = 4127H-412EH, type byte 40AFH (02 int, 03 string, 04 single,
08 double).

### 2.2 Communications region (4000H-42E8H), the parts an emulator/IDE touches

| Addr | Meaning | Source |
|---|---|---|
| 4000H-4014H | RST jump vectors (RAM copies, patched by DOS) | trs-80.com RAM page |
| 4015H / 401DH / 4025H | keyboard / video / printer DCBs (8 bytes each); 4016H = keyboard driver address (the HT extension writes 3079H there) | trs-80.com RAM page; FIXTÁR p. 302 |
| 4020H-4021H | cursor address | T80-DIS 0033H |
| 4036H-403CH | keyboard rollover image | trs-80.com RAM page |
| 403DH | port FF shadow (cassette bits, 32/64 column bit) | trs-80.com RAM page; KOLLÁR 0221H |
| 4041H.. | System-80 software clock (seconds at 4041H; sec, min, hour, year, day, month), runs while the cursor flashes | MAME-drv header ("About the RTC") |
| 4099H | last key (INKEY$ lookahead) | trs-80.com; KOLLÁR 019FH |
| 409AH | last error code | trs-80.com |
| 409CH | output device: 0 video, 1 printer, FFH (-1) cassette | ME-II/3 ("a 409CH byte tartalmát -1-re (FFH) kell állítani"); trs-80.com |
| 40A4H-40A5H | TXTTAB, start of BASIC program, normally 42E9H (17129) | HS `html/konvertformatum.html`; trs-80.com |
| 40A7H | input buffer pointer (initially 42E8H) | trs-80.com |
| 40ABH | RND seed byte used by RANDOM | KOLLÁR 01D5H; ME-II/3 |
| 40AFH | VALTYP | ME-II/3 |
| 40B1H | MEMSIZ, top of usable RAM | trs-80.com |
| 40DFH | entry address after a SYSTEM tape load (`/` uses it) | T80-DIS 02A9H |
| 40F9H-40FAH | VARTAB = end of program (first byte after the 00 00 terminator) | HS `html/konvertformatum.html`; trs-80.com |
| 40FBH / 40FDH | array table / end of storage | trs-80.com |
| 4152H-41A5H | Disk BASIC vectors (each a 3-byte jump; ROM-only machines hold "L3 error" jumps) | trs-80.com |
| 41E8H-42E7H | I/O / input buffer | trs-80.com |
| 4288H | stack set by SYSTEM | T80-DIS 02B2H |
| 42E9H | first byte of a BASIC program on a non-disk machine | HS `html/konvertformatum.html` |

A full HT-specific RAM map exists as a scan: Fekete György, "RAM munkaterület"
(`docs/ht1080z_ram_munkaterulet_workspace_fekete_hu.pdf`) and the FIXTÁR chapter "Rendszerváltozók".

### 2.3 BASIC program format in memory and on tape

Each line: 2-byte link to the next line (little-endian), 2-byte line number (little-endian),
tokenised text, 00H. End of program: a link of 00 00 (HS `html/konvertformatum.html`;
trs-80.com `sub-tips-file-formats.htm`). Program starts at (40A4H) = 42E9H; (40F9H) points after
the end. On tape the same bytes follow the `D3 D3 D3 name` header, so CLOAD must relink if the program
lands at a different address (*inference*: links are absolute; a DOS machine has TXTTAB elsewhere,
and the ROM relinks after load).

### 2.4 Token table (80H-FBH)

From the reserved-word table at 1650H (T80-DIS rows 1650H-1821H; bytes are the keywords with bit 7
set on the first character). Statements 80H-BBH dispatch through 1822H; functions D7H-FAH through
1608H.

```
80 END     81 FOR     82 RESET   83 SET     84 CLS     85 CMD     86 RANDOM  87 NEXT
88 DATA    89 INPUT   8A DIM     8B READ    8C LET     8D GOTO    8E RUN     8F IF
90 RESTORE 91 GOSUB   92 RETURN  93 REM     94 STOP    95 ELSE    96 TRON    97 TROFF
98 DEFSTR  99 DEFINT  9A DEFSNG  9B DEFDBL  9C LINE    9D EDIT    9E ERROR   9F RESUME
A0 OUT     A1 ON      A2 OPEN    A3 FIELD   A4 GET     A5 PUT     A6 CLOSE   A7 LOAD
A8 MERGE   A9 NAME    AA KILL    AB LSET    AC RSET    AD SAVE    AE SYSTEM  AF LPRINT
B0 DEF     B1 POKE    B2 PRINT   B3 CONT    B4 LIST    B5 LLIST   B6 DELETE  B7 AUTO
B8 CLEAR   B9 CLOAD   BA CSAVE   BB NEW     BC TAB(    BD TO      BE FN      BF USING
C0 VARPTR  C1 USR     C2 ERL     C3 ERR     C4 STRING$ C5 INSTR   C6 POINT   C7 TIME$
C8 MEM     C9 INKEY$  CA THEN    CB NOT     CC STEP    CD +       CE -       CF *
D0 /       D1 [ (up-arrow, power)           D2 AND     D3 OR      D4 >       D5 =
D6 <       D7 SGN     D8 INT     D9 ABS     DA FRE     DB INP     DC POS     DD SQR
DE RND     DF LOG     E0 EXP     E1 COS     E2 SIN     E3 TAN     E4 ATN     E5 PEEK
E6 CVI     E7 CVS     E8 CVD     E9 EOF     EA LOC     EB LOF     EC MKI$    ED MKS$
EE MKD$    EF CINT    F0 CSNG    F1 CDBL    F2 FIX     F3 LEN     F4 STR$    F5 VAL
F6 ASC     F7 CHR$    F8 LEFT$   F9 RIGHT$  FA MID$    FB ' (apostrophe remark)
```

Disk-BASIC keywords (CMD, OPEN, FIELD, GET, PUT, CLOSE, LOAD, MERGE, NAME, KILL, LSET, RSET, SAVE,
TIME$, CVI.., MKI$.., EOF, LOC, LOF, USING, INSTR, ...) are tokenised by the ROM but executed through
the 4152H-41A5H vectors (L3 error without DOS) - trs-80.com RAM page, *inference* for the exact list.
In Level II the apostrophe is stored as `3A 93 FB` (":" REM "'") - *inference from common TRS-80
practice, verify against a dump*. An HT-specific analysis exists as a scan: Bitlet "BASIC tokenek
(elemzés)" (`docs/bitlet_basic_tokenek_hu.jpg`). HT/64 note: the two-byte accented characters are
plain text bytes (apostrophe + key) inside strings/REMs, not tokens (1.3).

### 2.5 ROM disassemblies available

| Document | Coverage | Where |
|---|---|---|
| Kollár Zoltán, "A HT ROM BASIC kézi visszafejtése" | HT ROM 0000H-2FFFH, handwritten notebook, Hungarian comments, 131 pp. | HS; downloaded |
| "HT-1080Z iskolaszámítógép fix tárolója" | full HT ROM book: ROM, EPROM (extension), keywords, routines, system variables, storage, functions, block diagrams, **ROM differences between versions**, 159 pp. | HS; downloaded |
| ME-II/3 article | HT ROM subroutine reference (maths, conversion, I/O, cassette) | HS; downloaded |
| trs-80.com interactive disassembly | Tandy Model I v1.0-1.3 (and III/4), with original Microsoft labels/comments toggle | https://trs-80.com/sub-disassem-rom-m1-full.htm ; page saved |
| J. L. Farvour, *Microsoft BASIC Decoded & Other Mysteries* (IJG 1981) | Level II ROM | described at https://www.trs-80.org/microsoft-basic-decoded.html ; no free PDF found |
| Jack Decker, *TRS-80 ROM Routines Documented* (Alternate Source 1983) | ROM calls, reserved RAM | https://www.trs-80.org/trs-80-rom-routines-documented.html ; no free text found |
| *The Custom TRS-80 and Other Mysteries*; *Pathways Through the ROM* | Level II | not found as free downloads in this session (computinghistory.org.uk sells a 50 MB PDF of the former) |
| System 80 Technical Manual issue 3 | EACA hardware incl. cassette Mk I/II schematics | https://www.classic-computers.org.nz/system-80/software-manuals/manuals_tm3.pdf (not downloaded; hardware note's area) |

---

## 3. Cassette

### 3.1 Recorder hardware (brief)

- Built-in recorder, normal compact cassette, **500 baud** (HS `html/english.html`: "Built-in tape
  recorder with normal compact cassette (500 baud)"; HT1080Z emulator readme: "Just like the TRS-80
  Model I Level 2, the VideoGenie-1 also used a 500 baud tape recording frequency").
- Series I: manual volume knob and level meter; Series II and /64: auto-level electronics and a red
  level LED, a more reliable mechanism (HS variants page). Second (external) recorder on a DIN socket
  at the back (System 80 manual Appendix A: pin 4 input, pin 5 output, 1/3 remote).
- **No evidence found** that any HT variant used a different or faster cassette speed: every HT
  source says 500 baud and the cassette routines in KOLLÁR are the Tandy ones. MiSTer's HT1080Z core
  offers a *patched* fast-load ROM ("patch at offset 0x236" of the System 80 ROM) - an emulator
  feature, not HT hardware (https://github.com/MiSTer-devel/HT1080Z_MiSTer README).
- Ports (MAME-drv header / MAME-m): FF write bits 0-1 = cassette output level (00 = 0, 01 = +,
  10 = -), bit 2 = motor (on a System-80 it also enables the cassette data path), bit 3 = 32/64
  columns; FF read bit 7 = cassette input latch, bit 6 = 32/64 mode state; FE write bit 4 =
  internal (0) / external (1) recorder. MAME-m: the latch is set when the input crosses -0.2 going
  down (`cassette_data_callback`, sampled at 11025 Hz) and cleared by any write to port FF
  (`port_ff_w`).

### 3.2 Level II signal (500 baud), from the ROM code

FM (bi-phase) without NRZI: every bit cell starts with a clock pulse; a 1 adds a data pulse in the
middle of the cell; a 0 leaves it empty. MSB first. (trs80-cassette README,
https://cdn.jsdelivr.net/npm/trs80-cassette@2.3.1/README.md: cell 2 ms, pulse "125 µs positive,
125 µs negative, and 750 µs neutral"; MAME-cas; an 1980s article quoted in search gives 80 µs
pulses every 2 ms - https://tupel.jloh.de/nascom/magazines/micropower/13/08/text/.)

The write path (identical in KOLLÁR and T80-DIS):

- CTPULS 01D9H: port FF <- 01 (+), `LD B,0BH` DJNZ, port FF <- 02 (-), `LD B,0BH` DJNZ,
  port FF <- 00, `LD B,5CH` DJNZ, RET.
- Byte write 0264H: for each of 8 bits: CALL 01D9H (clock); if bit=1 CALL 01D9H (data) else
  `LD B,87H` DJNZ (same length as a pulse).
- Leader 0287H: `LD B,0FFH`, write 00H B times (DJNZ), then write A5H.

T-state budget (*inference*, own count from the listed instructions; CALL 17, DJNZ 13/8, the port
helper 0221H = 72 T incl. CALL):

| Item | T-states | at 1.7742 MHz (TRS-80) | at 1.7467 MHz (MAME sys80p/HT clock) |
|---|---|---|---|
| + half of a pulse (OUT 01 to OUT 02) | ~227 | ~128 µs | ~130 µs |
| - half (OUT 02 to OUT 00) | ~227 | ~128 µs | ~130 µs |
| one CTPULS call | ~1761 | ~0.99 ms | ~1.01 ms |
| bit cell, "1" | ~3557 | ~2.005 ms | ~2.036 ms |
| bit cell, "0" | ~3570 | ~2.012 ms | ~2.044 ms |

So the tape speed scales with the CPU clock (about 491 baud if the HT runs at MAME's 10.48 MHz/6;
HS and Real-80 give 1.77/1.774 MHz instead - see open questions).

The read path (CTBIT 0241H): wait until port FF bit 7 (latched pulse) is set; delay `LD B,41H`
(~840 T ≈ 0.47 ms on the HT ROM; v1.3 Tandy: 60H ≈ 0.70 ms); clear the latch (CALL 021EH, ~82 T);
delay `LD B,76H` (~1529 T ≈ 0.86 ms; v1.3: 85H ≈ 0.97 ms); read port FF: bit 7 set means a data pulse
arrived inside the window, i.e. bit = 1; clear the latch again (*inference* for the T-state values).
trs80-cassette README describes the same as "skips over it for 500 µs, then reads for 850 µs".

Leader: **255 zero bytes** by the ROM code (`LD B,0FFH`), followed by A5H - KOLLÁR, T80-DIS row
0287H code, HS `html/konvertformatum.html` ("255 darab nulla byte"), trs80-cassette README ("about
2040 zero bits (255 zero bytes)"). T80-DIS's prose for 0284H/0287H and trs-80.com's format page say
**256** zeros (sources disagree; the code says 255). MAME-cas inserts 1 ms of silence after the A5H
"while rom is busy" and two silent cycles at the end; trs80-cassette notes a 1 ms pause before the
first program bit.

### 3.3 Level I signal (250 baud)

Same encoding at half the speed (MAME-cas header: "Level I and II tape format is completely
identical, apart from the baud rate"; MAME-drv: "Model I level I - 250 baud"). MAME generates it by
playing the same waveform at 22050 Hz instead of 44100 Hz (`trs80l1_cas_legacy_fill_wave`). Not
relevant to the HT except for reading Level I tapes (it has no Level I ROM).

### 3.4 File structures on tape (Level II)

All start with the leader and A5H sync (HS `html/konvertformatum.html`; trs-80.com
`sub-tips-file-formats.htm`):

| Type | Header | Body | End |
|---|---|---|---|
| BASIC (CSAVE/CLOAD) | `D3 D3 D3` + 1-char name | memory image of the program lines (link, line no., tokens, 00) | `00 00` (the last line's link points here) |
| SYSTEM (machine code) | `55` + 6-char name (space padded) | blocks: `3C`, length (01-FF, 00 = 256), load address LSB MSB, data, checksum | `78` + entry address LSB MSB |
| EDTASM source | `D3` + 6-char name | lines: 5-digit ASCII line number with bit 7 set on each byte, `20`, text (max 128), `0D` | `1A` |
| Data (PRINT#-1 / INPUT#-1) | leader+sync per record | ASCII record (*not documented in sources read*) | - |

SYSTEM block checksum: 8-bit sum of the two load-address bytes and all data bytes (HS: "A betöltési
cím és az adatblokk byte-ok ellenőrző összege, 1 byte"; trs-80.com: covers "your data & load
address"; *inference* that it is a plain modulo-256 sum - consistent with HS `html/konvertbit.html`,
where a single flipped bit 7 changed the stored-vs-computed checksum by exactly 80H). Level I tapes
instead carry start and end address MSB-first, data, and a checksum where data + checksum = 0
(trs-80.com format page). Level II cannot load Level I BASIC (keywords stored as text) - HS formats page.

Loading on the HT: `CLOAD`, `CLOAD "N"`, `CLOAD?` (verify), `CLOAD#-2,"N"` (second recorder);
`SYSTEM` then the name (`*?` prompt), then `/` to run or `/nnnnn` (decimal address) - System 80
manual pp. 8-11; MAME-drv header; HS `html/programsystem.html`.

### 3.5 Image formats

| Format | What it is | Notes |
|---|---|---|
| `.cas` (500/250 baud) | the bit stream the ROM wrote, packed MSB first into bytes, **including** the leader zeros and A5H (and everything after) | xtrs `cassette(1)` man page (https://manpages.ubuntu.com/manpages/focal/man1/cassette.1.html): "the bit stream that (the emulator thinks)" the ROM was writing; HS formats page: "tartalmazza az összes szinkronmezőt is". MAME-cas accepts a file only if it is some 00H bytes followed by A5H. A file may hold several programs (HS `html/konverteszkozok.html`). Same container for 250 and 500 baud - the speed is not stored. |
| `.cas` (1500 baud, Model III/4) | same idea, but each data byte is preceded by a start bit 0 and the CAS contains those extra bits, so bytes are not aligned to the data | xtrs man page ("an extra 0 bit after every 8 data bits ... packed into the cas file"); MAME-cas distinguishes it because it starts with 55H bytes and then 7FH (`trs80m3_handle_cas`). Not used by the HT; an importer must reject or convert it. |
| non-byte-aligned `.cas` | Level II CAS made from tape where the A5H is not on a byte boundary | supported by HT1080Z emulator v1.3 ("support for non-byte aligned CAS images", HS emulator readme). *Inference*: a loader should search for A5H at bit level. |
| `.bas` (trs-80.com) | tokenised BASIC with a single `FF` header instead of `A5 D3 D3 D3 name` | Kollár's HTCONV readme (`docs/homeserver_htconv_kollar_readme_hu.txt`); HT1080Z emulator v1.3 "support for tokenized /BAS images". |
| `.asm` (trs-80.com) | EDTASM source without the A5H (starts at D3) | HTCONV readme |
| `.cmd` | TRSDOS/LDOS load module (disk file, but used as a quickload) | records `type, len, data`. 01 = load block: len-2 data bytes after a 2-byte LE address (len 0/1/2 = 254/255/256 data bytes); 02 = transfer address (LE), last record; 05 = module header/name; 1F = copyright; 03-1F ignored by the TRSDOS loader, others a format error (trs-80.com format page; MAME-quik `quickload_cb` - MAME stops at 02 and sets PC, rejects types other than 01/02/05/1F). HS: Grósz's `cmd2cas` converts 01/02-only CMD files to SYSTEM tapes. |
| `.cpt` | xtrs "cassette pulse train": exact output values and timing to the microsecond, a noise-free tape | xtrs man page; record layout not documented there (open question). Its `debug` variant is ASCII: one line per change, new output value (0/1/2) and the µs to wait before it. |
| `.wav` | real signal | xtrs writes 44.1 kHz, reads 8-bit mono PCM only. MAME renders CAS to WAV at 44100 Hz (Level II) with, per half-bit, 32 silent samples then 6 high + 6 low samples (`trs80m1_cas_cycle`), i.e. 44 samples ≈ 1 ms per half-bit, pulse ≈ 136+136 µs. HS recommends 44.1 kHz 16-bit WAV for digitising real HT tapes and Knut Roll-Lund's `wav2cas` (https://knut.one/wav2cas.htm) or Márkus Csaba's `w2c` / `checkcas` (HS `html/konverteszkozok.html`). |
| HT-specific formats | **none found**; the HT world uses `.cas`, `.cmd`, `.dsk` (JV1/JV3), `.wav` | HS emulator pages |

### 3.6 Instant loading versus signal level (how existing emulators do it)

- **ROM traps**: Grósz's HT1080Z emulator: "Saving/loading of CAS files is done via ROM traps and
  hence it is not supporting custom loaders, but in return it is much quicker" (HS emulator readme).
  *Inference*: trap points are 0296H (find sync), 0235H (read byte), 0287H (write leader), 0264H
  (write byte) and 01F8H (motor off); with the motor bit in port FF the emulator can tell an active
  tape operation.
- **Signal level from CAS**: xtrs/sdltrs synthesise the pulses the ROM expects and auto-detect the
  speed from the timing the program uses (xtrs man page). MAME converts the CAS to a waveform up front
  (MAME-cas) and feeds port FF bit 7 by edge detection (MAME-m). These keep custom loaders working.
- **Direct memory load**: MAME `.cmd` quickload (MAME-quik); MiSTer HT1080Z core loads CAS/CMD/BAS and
  offers a patched ROM for fast load (MiSTer README).
- *Inference* for an IDE: support both - traps for standard CLOAD/SYSTEM (fast, needed for an
  edit-run loop) and a pulse generator from CAS bits (for custom loaders and fidelity); CAS save by
  decoding the port FF pulse train into bits.

---

## 4. Disk

- **HT hardware**: EU-7 expansion box (from early 1986) with a bus card, PR2 printer card, **FC floppy
  controller with a WD1771, up to 4 drives**, and an HRG (512x512, MC6845) card; FD1 drive box with a
  MOM 1800/900 5.25" drive (SS SD, "valamivel több mint 100kB", 125 kbit/s, 600 ms access) or a Tandon
  TM100 used in development (HS `html/hardverbovitesek.html`; manual `docs/ht1080z_bovito_egysegek_expansion_units_hu.pdf`).
  HS notes the ROM checks at power-on for a disk unit and tries to boot it (TRS-80 heritage); holding
  BREAK skips it; "TRS-DOS, NewDOS operációs rendszereket lehetett minden bizonnyal a HT-vel is
  használni" (could almost certainly be used). Floppies were rare in schools (HS
  `html/konverteszkozok.html`).
- **Model I standard**: Expansion Interface, WD1771 (FD1771) single density, 35 or 40 tracks,
  10 sectors x 256 bytes per track (≈ 89,600 / 102,400 bytes); directory on track 17 written with
  DAM F8H/FAH (Tim Mann dskspec; MAME-dsk JV1 formats list 35/40/80 tracks x 10 x 256).
- **DOSes**: TRSDOS 2.3, NEWDOS/80, LDOS, MULTIDOS on Model I emulators (MiSTer README). Current HT
  community releases use **NewDOS/80 v2** images (HS start page: "NewDOS/80 floppy image a 10
  játékkal", "Commando ... NewDOS/80 v2 floppy image"). Mikroszámítógép Magazin 1986/9 printed "A
  lemezrendszer utasításai és függvényei" (the disk system's commands) - which DOS is unknown. **No
  Hungarian-made DOS for the HT was found** (open question).
- **Image formats** (Tim Mann, `docs/tim_mann_trs80_disk_image_formats_dskspec.html`,
  http://www.tim-mann.org/trs80/dskspec.html; MAME-dsk; David Keil, `docs/david_keil_dmk_trstech.htm`):
  - **JV1**: headerless array of 256-byte sectors, 10 per track (0-9), one side, single density;
    track 17 sectors have DAM FAH (TRSDOS 2.3 directory), others FBH. Grósz's emulator accepts only
    89,600 / 102,400 / 204,800 bytes (35/40/80 tracks).
  - **JV3**: 2901 three-byte sector headers (track, sector, flags) + 1 write-protect byte (= 0x2200
    bytes), then sector data in header order; flags: 80H density, 60H DAM code (SD: 00=FB, 20=FA,
    40=F9, 60=F8), 10H side, 08H CRC error, 04H non-IBM, 03H size code (used sectors: 0=256, 1=128,
    2=1024, 3=512); free entries have track/sector FFH and flags FCH|size; an optional second
    header block may follow. Grósz's emulator accepts 98,304 / 111,104 / 213,504 bytes.
  - **DMK**: 16-byte header (0: FFH write-protected; 1: tracks; 2-3: track length LE, default
    1900H, 0CC0H for 5.25" SD; 4: flags - bit 4 single-sided, bit 6 SD one byte per access, bit 7
    ignore density; 0CH-0FH 12345678H marks a real-drive spec file), then per track a 128-byte table
    of 64 IDAM pointers (LE, bit 15 = double density, offset includes the 80H table) and raw track
    bytes; single-density bytes are stored twice unless bit 6/7 is set. Represents copy-protected
    disks.

---

## 5. Other: printer, school software, archives, test programs

### 5.1 Printer

HT-1080Z/PR1 (stand-alone, Centronics, passes the bus through) and PR2 (EU-7 card, Centronics)
(HS bővítések page). System-80 printer is at port FD (status read, data write) rather than Tandy's
37E8H (MAME-drv; System 80 manual). The ROM routine 003BH prints the char in C (ME-II/3; T80-DIS says
A - *the two descriptions differ, verify*); LPRINT/LLIST without a printer hang the System 80 unless
the extension's screen-print logic skips it (System 80 manual "System Reset" and addendum "Print
Screen"). Other HT peripherals: Real-Team Commodore serial bus adapter (VC-1541 floppy, MPS-801
printer; 2 KB EPROM), REALNET network, MICOLOR colour graphics, UNICOMP and TechnoMIR measurement
kits (HS bővítések page).

### 5.2 Hungarian school software and where HT software lives

- **ht.homeserver.hu** (main archive):
  - BASIC programs as CAS, by category (demo, user, games, educational, language, exercises, music):
    `html/programbasic.html` (e.g. the HT demo tape "Bemutatkozó", Bioritmus, Kalózok háborúja 1983,
    Pestis text adventure).
  - SYSTEM (machine-code) programs as CAS: `html/programsystem.html` - development tools (EDI
    assembler, EDTASM, DIS, TBUGA debugger, SSOS "Screen and Sound OS", copy programs COPY/SCOPY/
    MASOLO), games (Galaxy Invasion, COSMIC, ESCAPE, FESTO), word processor SZVSZ.
  - Educational software: `html/programoktato.html`; projects: `html/programprojekt.html`;
    new software: `html/programujdonsagok.html` (Jukebox, SIDplayer, HTRIS, colour demos).
  - Direct files under `/bin/cas/sys/*.cas`, `/bin/dsk/*.dsk`, `/bin/ujdonsagok/...` (e.g.
    `Commando_Arok2026_Release.zip` - a C64 port with continuous AY music, 4th at Árok Party 2026;
    `Kepes_Gabor_AI_Games.dsk` and `.cmd` files, 2026; `pallagi_3jatek.dsk`).
  - HS only stores Hungarian programs and TRS-80 programs that were common in Hungary.
- **itch.io**: Gábor Képes's HT/TRS-80 games (https://gaborkepes.itch.io/...), ENTARY Games
  "House on the Edge of the Crater" (https://entary.nickmann.hu/games/crater).
- **TRS-80 / System 80 archives** (most software runs): trs-80.com; classic-computers.org.nz
  `system-80/software_cassette_archive.htm`.
- **MAME softlists**: `trs80_cass.xml` (62 entries with an "H" = HT series compatibility flag) and
  `trs80_quik.xml` (75 such entries); the `ht1080z` driver filters both lists by "H"
  (MAME-drv `SOFTWARE_LIST(...).set_filter("H")`). No HT-only title is in them.
- **TOSEC**: no HT-1080Z or Híradástechnika naming was found (TOSEC has TRS-80 sets; open question).

### 5.3 Test programs useful for verifying an emulator

| Program | What it exercises | Source |
|---|---|---|
| misterblack1 `trs80-diagnosticrom` | RAM/VRAM march tests, runs without RAM, audio feedback through the cassette port | https://github.com/misterblack1/trs80-diagnosticrom (described by trs-80.com repair guide; not opened). *Inference*: written for Tandy hardware; check HT/System-80 differences (printer, FE) before relying on it. |
| HS demo tape "Bemutatkozó" and "Grafikai bemutató" | stock BASIC + graphics | HS programbasic |
| Jukebox, SIDplayer, Commando (Árok 2026) | AY-3-8910 music while the game runs | HS start page / újdonságok |
| Leo Christopherson's games (Android Nim - in MAME softlist with flag H, Hungarian version on HS) | cassette-port sound, animation timing | MAME `trs80_cass.xml`; HS programbasic |
| Galaxy Invasion (Big Five) | the HS-recommended quick test (`HT1080Z Galaxy.cas`), keyboard, sound | HS start page |
| Copy programs (COPY "System Tape Copy v1.3", SCOPY, MASOLO) | bit-exact SYSTEM tape read/write through ROM routines | HS programsystem |
| EDI / EDTASM | SYSTEM tapes with many blocks; the HS bit-error case study (`html/konvertbit.html`) is a good CAS checksum test | HS |
| TRS80GP "termites" observation | video snow when CPU and video access VRAM together, visible on real HTs | HS `html/dokumentaciovilaghalo.html` |
| Mikroszámítógép Magazin sound article + frequency table | AY register programming from BASIC | HS cikkek (`mmhang1.jpg`, `mmhang2.jpg`) |

---

## 6. Reference documents downloaded

Folder: `/Users/dotneteer/source/kliveide/_input/ht1080z/docs/` (this list covers the files this
research added; the folder also holds files from the parallel hardware research).

| File | Content | Source URL |
|---|---|---|
| holdcomputers_A_HT_szamitogeprol_Vidovenyecz.pdf | 1-page HT summary (years, units, ROM 12K+1.5K, specs) | https://www.holdcomputers.com/holdcomputers_elemei/doc/info/ht1080z.pdf |
| ht1080z_hasznalati_utmutato_user_manual_hu.pdf | official HT user manual (loading, saving, second recorder, BASIC extension, specs, memory/I-O map, AY description) | https://ht.homeserver.hu/doc/konyvek/hasznalati_utmutato.pdf |
| ht1080z_basic_kezikonyv_basic_manual_hu.pdf | official HT BASIC manual (keywords, error codes, control chars) | https://ht.homeserver.hu/doc/konyvek/basic_kezikonyv.pdf |
| ht1080z64_valtozasok_changes_hu.pdf | HT-1080Z/64 and 2080Z/64 changes to the manuals (extension 2.51, special characters) | https://ht.homeserver.hu/doc/konyvek/valtozasok.pdf |
| ht1080z64_kezelesi_utmutato_operating_manual_hu.pdf | HT-1080Z/64 operating manual | https://ht.homeserver.hu/doc/konyvek/ht64k_kezelesi_utmutato.pdf |
| ht1080z_bovito_egysegek_expansion_units_hu.pdf | HT expansion units (EU-7, floppy, printer) manual | https://ht.homeserver.hu/doc/konyvek/bovito_egysegek.pdf |
| ht1080z_basic_referencia_kartya_hu.pdf | BASIC reference card | https://ht.homeserver.hu/doc/konyvek/basic_referencia_kartya.pdf |
| ht1080z_fix_taroloja_rom_book_hu.pdf | the HT ROM book (ROM + extension EPROM listing, routines, system variables, ROM version differences) | https://ht.homeserver.hu/doc/konyvek/fixtarolo.pdf |
| ht1080z_utasitaskeszlet_instruction_set_hu.pdf | HT BASIC command set incl. SYSTEM and the monitor program | https://ht.homeserver.hu/doc/konyvek/utasitaskeszlet.pdf |
| ht_rom_basic_0000-2FFF_kezi_visszafejtes_kollar_hu.pdf | Kollár's hand disassembly of the HT ROM | https://ht.homeserver.hu/doc/listak/htrom/htrom_basic.pdf |
| ht_rom_kezi_visszafejtes_kollar_index.html | its index page (how it was made) | https://ht.homeserver.hu/doc/listak/htrom/htrom.html |
| ht1080z_ram_munkaterulet_workspace_fekete_hu.pdf | RAM work area (communications region) of the HT | https://ht.homeserver.hu/doc/listak/vegyes/munkaterulet.pdf |
| magyar_elektronika_ht1080z_szoftvertulajdonsagok_hu.pdf | ME-II/3: HT ROM subroutines for machine-code programmers | https://ht.homeserver.hu/doc/cikkek/magyar_elektronika/ht-1080z_szoftvertulajdonsagok.pdf |
| mm1987_06_magyar_hibauzenetek_hu.pdf | Hungarian error messages (program, 1987) | https://ht.homeserver.hu/doc/listak/mikro_magazin/hibauzenetek_876.pdf |
| radiotechnika_1984_07/08/09_ht1080z_kulvilag_{1,2,3}_hu.pdf | "Connecting the HT-1080Z to the outside world" I-III | https://ht.homeserver.hu/doc/cikkek/radiotechnika/rt1984_07.pdf (…_08, …_09) |
| bitlet_basic_tokenek_hu.jpg | Bitlet: BASIC token analysis | https://ht.homeserver.hu/doc/listak/bitlet/basic_token.jpg |
| trs80_reference_manual_photocopy_used_in_hungary.pdf | the TRS-80 manual photocopy used in Hungary | https://ht.homeserver.hu/doc/konyvek/trs80_reference_manual.pdf |
| system80_users_manual_with_blue_label_pages.pdf | System 80 user manual + blue-label addendum (/12288, /12294, /12299, monitor /12710) | https://www.classic-computers.org.nz/system-80/manuals_user_manual.pdf |
| homeserver_ht_cas_formatumok_hu.html | HS: CAS format for BASIC / SYSTEM / EDTASM | https://ht.homeserver.hu/html/konvertformatum.html |
| homeserver_ht1080z_emulator_grosz_readme_en.html | HT1080Z emulator readme (CAS traps, JV1/JV3 sizes, changelog) | https://ht.homeserver.hu/html/englishht1080z.html |
| homeserver_ht_rom_valtozatok_hu.html | HS: ROM variants page | https://ht.homeserver.hu/html/hardverrom.html |
| homeserver_ht_valtozatok_series_hu.html | HS: machine variants page | https://ht.homeserver.hu/html/hardver1080valtozatok.html |
| homeserver_htconv_kollar_readme_hu.txt | HTCONV converter readme (CAS/BAS/ASM/CMD headers) | https://ht.homeserver.hu/bin/util/htconv.txt |
| tim_mann_trs80_disk_image_formats_dskspec.html | JV1/JV3 specification | http://www.tim-mann.org/trs80/dskspec.html |
| david_keil_dmk_trstech.htm | David Keil's emulator technical info incl. DMK layout | https://electrickery.nl/comp/trs80-4p/dmkeilImages/trstech.htm |
| trs80com_model1_3_4_rom_disassembly_interactive.htm | trs-80.com interactive Level II disassembly (data is JSON inside the page) | https://trs-80.com/sub-disassem-rom-m1-full.htm |

Not downloaded: the HT ROM dumps (`/bin/rom/ht_s*.rom`, by rule), *Microsoft BASIC Decoded* and
*TRS-80 ROM Routines Documented* (no free copies found), the 38 MB "Z80 Assembler HT-1080Z
számítógépes példákkal" book (https://ht.homeserver.hu/doc/konyvek/z80assemblerht1080z.pdf; useful
but large), the Technika newspaper listings, and the System 80 Technical Manual issue 3.

---

## 7. Open questions / sources disagree

| # | Topic | Version A | Version B | Notes |
|---|---|---|---|---|
| 1 | Leader length | 255 zero bytes (ROM code `LD B,0FFH` at 0287H; HS formats page; trs80-cassette README) | 256 zero bytes (T80-DIS prose for 0284H/0287H; trs-80.com format page) | Code wins for what the ROM writes; a loader must accept any number. |
| 2 | CPU clock (affects tape speed) | 1.77 MHz (HS english page), 1.774 MHz (Real-80 docs) | 10.48 MHz / 6 = 1.7467 MHz (MAME `sys80p`, used by `ht1080z`) | Hardware note should settle it; tape timing scales with it (≈491 vs 500 baud). |
| 3 | Pulse width | ~128 µs each half (own T-count of 01D9H); 125 µs (trs80-cassette) | 80 µs (1980s article); MAME synthesises ≈136 µs | Real tapes are filtered anyway; a reader should be tolerant. |
| 4 | Series I extension | MAME uses EACA `sys80.z13` unchanged | HS says Series I extension prints "NEW KEYBOARD ROUTINE ENABLE"; FIXTÁR says pre-832 EPROM differs at 302FH-305BH and ends at 35EBH | Verify the HS `ht_s1_basicexpansion.rom` against MAME's sys80.z13 hash. |
| 5 | Extension size | 1.5 KB (HS, holdcomputers, System 80 manual) | 2 KB loaded at 3000H (MAME `0x0800`) | Probably a 2 KB part with 1.5 KB used (*inference*). |
| 6 | "BASIC 2.20" on the /64 | Microsoft version? | HT build number? | Not stated anywhere found. |
| 7 | HS ROM dumps vs MAME | HS `ht_s1/s2/s3_*.rom` (Majzik) | MAME sets above | Hashes not compared (no download). Also: is HS's s3 = MAME `ht108064`? |
| 8 | ROM redistribution | HS hosts dumps without a licence | No permission statement from Microsoft/Tandy/EACA/HT found | Treat as not redistributable. |
| 9 | Different HT cassette speed | All HT sources: 500 baud, same ROM routines | (task brief mentioned "some sources say faster"); none found | Only emulator fast-load ROM patches exist (MiSTer). |
| 10 | RST 20H meaning | "BASIC next-character fetch" (trs-80.com RAM page summary) | number-type test via 40AFH (T80-DIS row 0020H) | Resolved for B: RST 10H is the character fetch. |
| 11 | 003BH printer routine input | char in C (ME-II/3, HT) | char in A, status polled at 37E8H (T80-DIS, Tandy) | May be a real EACA difference (port FD printer) or an article error; check KOLLÁR at 003BH/058DH. |
| 12 | SYSTEM block checksum | sum of load address + data (HS, trs-80.com) | exact algorithm not stated | *Inference*: mod-256 add; verify in the ROM at the SYSTEM loader. |
| 13 | Hungarian DOS | none found | MM 1986/9 printed disk-system commands | Which DOS the EU-7/FD1 shipped with is unknown. |
| 14 | `.cpt` record layout | - | - | xtrs man page does not give it; read xtrs `cassette.c` if needed. |
| 15 | MAME status | header says "ht1080z works" | sets flagged `MACHINE_NOT_WORKING` | Status of MAME's HT emulation is unclear. |
| 16 | 4000H-41FFH DOS hooks on the HT | Tandy layout assumed (4152H-41A5H vectors) | HS says the HT boots TRSDOS/NEWDOS, implying the same layout | Not checked in FIXTÁR's "Rendszerváltozók" chapter. |
| 17 | TOSEC | - | no HT-labelled sets found | Check TOSEC DATs directly. |
