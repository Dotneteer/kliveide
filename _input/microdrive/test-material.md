# Test material for Interface 1 + Microdrive emulation

URLs only — nothing here was downloaded (no binaries, ROMs or archives). Check each item's
licence before adding it to Klive's repository; most are preserved commercial software.
`[Fn]` references are in `sources-formats.md`.

---

## 1. Ready-made cartridge images (`.mdr`)

| What | Why useful | Where |
|---|---|---|
| Sinclair **Demo Cartridge** (1983) — two variants: Net game, Printer Server, auto-run, BASIC extensions index, **Microdrive Test**, "Sources of problems", `*MOVE` copier, `*CAT` extended catalogue | the official introductory cartridge; the Microdrive Test writes a file "drive test", checks and erases it | https://spectrumcomputing.co.uk/entry/14770/ZX-Spectrum/Demo_Cartridge |
| Sinclair **Business Cartridge** (1983): Tasword Two, Masterfile | large BASIC+code programs, data files | https://spectrumcomputing.co.uk/entry/14714/ZX-Spectrum/Business_Cartridge |
| Sinclair **Games Cartridge** (1983): Ant Attack, Games Designer — "original" and "(fixed)" images | machine-code loading via microdrive | https://spectrumcomputing.co.uk/entry/14815/ZX-Spectrum/Games_Cartridge |
| **Microdrive Test** (component of the Demo cartridge) | | https://spectrumcomputing.co.uk/entry/28212/Misc/Microdrive_Test |
| **Microdrive Utilities** (Jon Ellis, *Your Computer* Oct 1985) — MDR + instructions | I/O utility type-in | https://spectrumcomputing.co.uk/entry/26952/ZX-Spectrum/Microdrive_Utilities |
| **Microdrive Doctor**, **Microdrive Sector Copy** | sector-level tools: exercise raw port access | https://spectrumcomputing.co.uk/entry/20355 , https://spectrumcomputing.co.uk/entry/20775 |
| **Outlet** disk magazine, 73 issues as MDR (137 923 bytes each, CRC/SHA-1 listed) | bulk regression corpus; MAME lists them as unsupported | https://github.com/mamedev/mame/blob/master/hash/spectrum_microdrive.xml |
| ZEsarUX test images `testmicrodrive.mdr`, `.rmd`, `.tap` | small, purpose-made; same content in three formats (GPL repository) | https://github.com/chernandezba/zesarux/tree/main/src/tests |
| ZXPicoMD "ROM version check" cartridges | identify IF1 ROM edition | https://github.com/TomDDG/ZXPicoMD |

Recommended corpus for Klive: one Demo Cartridge image (auto-run + Microdrive Test), Games
Cartridge (machine code), Business Cartridge (big files), plus cartridges Klive itself creates
with BASIC (below) — these last ones are the only ones we can commit freely.

## 2. Making test cartridges from tapes

Convert TAP files we are allowed to use (Klive-built or public-domain) with zxmdr (MIT),
TAPtoMDR, Z80onMDR, or by loading the TAP in the emulator and `SAVE *`-ing it — the last one is the
best end-to-end test. Tools are listed in `mdr-and-file-formats.md` §10.

## 3. BASIC test scripts with expected results

Notation: messages are as printed by the IF1 ROM. IF1-specific reports have **no report code
letter**, and the Spectrum ROM appends `, line:statement` — e.g. `Microdrive not present, 0:1`
(the IF1's report routine prints the text then returns into the main ROM's code that prints the
comma and line/statement) [F12]. Standard reports keep their code (e.g. `0 OK, 0:1`).
Exact texts in ROM v2: Program finished; Nonsense in BASIC; Invalid stream number; Invalid device
expression; Invalid name; Invalid drive number; Invalid station number; Missing name; Missing
station number; Missing drive number; Missing baud rate; Stream already open; Writing to a 'read'
file; Reading a 'write' file; Drive 'write' protected; Microdrive full; Microdrive not present;
File not found; Hook code error; CODE error; MERGE error; Verification has failed; Wrong file type
[F12]. (The manual spells some differently, e.g. "Read a 'write' file", "Code error",
"'Merge' error" [F6] — trust the ROM text.)

Assumptions: 48K + IF1 (ROM v2), drive 1 has a 254-sector cartridge, drive 2 empty.

### T1 — ROM edition and system variables
```basic
PRINT PEEK 23635+256*PEEK 23636 : REM PROG before IF1 vars → 23755
CLOSE #0
PRINT PEEK 23729                : REM 80 = edition 2, 0 = edition 1
PRINT PEEK 23635+256*PEEK 23636 : REM 23813 (58 bytes of IF1 system variables inserted)
```
[F13][F23]; the 23813 figure is **derived** from the ROM's 58-byte insertion [F12]. Note: on a
real machine the vars may already exist (any IF1 command creates them).

### T2 — FORMAT and CAT of a blank cartridge
```basic
FORMAT "m";1;"TEST"
CAT 1
```
Expected: border flashes during FORMAT, then `0 OK, 0:1`. CAT output (structure from the ROM:
name, blank line, sorted names, blank line, free kilobytes) [F12][F6]:
```
TEST

<no names>

126
```
**126** for ROM v2 / **127** for ROM v1 on a 254-sector emulated cartridge — derived, verify in Fuse
(see `mdr-and-file-formats.md` §7). A real cartridge gives ≈ 85–90 [F6].

### T3 — SAVE / VERIFY / LOAD a program
```basic
10 REM microdrive test
20 PRINT "HELLO"
SAVE *"m";1;"prog" LINE 20
VERIFY *"m";1;"prog"   : REM 0 OK
NEW
LOAD *"m";1;"prog"     : REM program auto-runs at line 20, prints HELLO
CAT 1                  : REM lists "prog"; free drops by 0 (1 record) → still ≈126 rounded
```
Then check in the image: one record, RECFLG = `0x06`, header type 0, HD_11 = 20.

### T4 — CODE and SCREEN$
```basic
SAVE *"m";1;"scr" SCREEN$
SAVE *"m";1;"code" CODE 32768,1000
LOAD *"m";1;"code" CODE 40000          : REM relocating load
LOAD *"m";1;"code"                     : REM Wrong file type, 0:1  (BASIC load of a CODE file)
```
`SCREEN$` = type 3, length 6912, start 16384 in the header [F12]. 6912 + 9 bytes → 14 records.

### T5 — arrays and MERGE
```basic
DIM a(10): SAVE *"m";1;"arr" DATA a()
DIM a$(5,5): SAVE *"m";1;"str" DATA a$()
MERGE *"m";1;"prog"      : REM MERGE error, 0:1 (prog was saved with LINE) [F6]
```

### T6 — sequential (PRINT-type) files
```basic
OPEN #4;"m";1;"data"
PRINT #4;"hello";"world"
CLOSE #4
OPEN #4;"m";1;"data"
INPUT #4;a$: PRINT a$      : REM hello
INPUT #4;a$: PRINT a$      : REM world
INPUT #4;a$                : REM 8 End of file (standard report) [F6]
CLOSE #4
MOVE "m";1;"data" TO #2    : REM copies file to the screen
```
Records of "data": RECFLG bit 2 **clear**, no 9-byte header [F1][F12].

### T7 — error paths
| Command | Expected |
|---|---|
| `LOAD *"m";1;"nosuch"` | `File not found, 0:1` |
| `CAT 2` (no cartridge in drive 2) | `Microdrive not present, 0:1` after the drive spins briefly [F41] |
| `CAT 0` / `CAT 9` | `Invalid drive number, 0:1` |
| `SAVE *"m";1;""` / 11-char name | `Invalid name, 0:1` |
| `SAVE *"m";1;"prog"` (name exists) | `Writing to a 'read' file, 0:1` [F41] |
| `OPEN #4;"m";1;"x": OPEN #4;"m";1;"y"` | `Stream already open, 0:1` [F6] |
| `OPEN #4;"m";1;"data": PRINT #4;"x"` (data exists → opened for reading) | `Writing to a 'read' file, 0:1` |
| `FORMAT "m";1;"T"` with write-protect set | `Drive 'write' protected, 0:1` |
| `SAVE *` until the cartridge is full | `Microdrive full, 0:1` |
| `OPEN #4,"X"` | `Invalid device expression, 0:1` (from 128 BASIC as a numbered line ≥ 1000, this triggers the editor bug in `model-compatibility.md`) [F36] |
| `VERIFY *"m";1;"prog"` after changing the program | `Verification has failed, 0:1` |

### T8 — ERASE and hidden files
```basic
ERASE "m";1;"prog"   : REM border flashes, OK; CAT no longer lists it
```
Names beginning with `CHR$ 0` are not listed by CAT [F6][F12].

### T9 — auto-run
Save a program named `run` to drive 1, reset, then type `RUN` with no program in memory: the IF1
loads and runs `run` from drive 1 [F6]. Test on 48K and (open question) from 128 BASIC.

### T10 — 128K
On a 128K/+2: repeat T2/T3 from **128 BASIC** and from **48 BASIC** — both should work [F35][F36].
Type `1000 OPEN #4,"X"` in the 128 editor and run it: real hardware shows the over-long error line
(screen corruption; full-screen editor may crash) [F36] — a nice fidelity test.

### T11 — image-level checks (for Klive unit tests, no CPU needed)
- Parse every sector of a freshly formatted image: all HDCHK/DESCHK/DCHK valid, all names "TEST",
  sector numbers 1–254 each exactly once.
- After T3: the file's records reassemble to the bytes of the program area; checksums valid.
- Write-protect byte toggled in the UI round-trips to the last byte of the file.
- Load a 174 930-byte QL `.mdv`: rejected with a clear message.

### T12 — raw port tests (for the core, via the harness)
- Reading port `0xE7` with the motor off stalls the CPU (the "IN 0 crash") [F17].
- Port `0xEF` bit 0 reflects the write-protect tab; gap/sync bits toggle with the synthesised
  preamble (details in the other agent's hardware notes).
- `OUT 239,0` with a cartridge in drive 1 erases it; `CAT 1` then reports
  `Microdrive not present` [F1].

## 4. Open questions

1. Confirm T2's 126/127 numbers and the exact CAT layout (trailing spaces after the cartridge
   name?) in Fuse with ROM v1 and v2.
2. Confirm T1's 23813.
3. Confirm the T9 auto-run behaviour on the 128K.
