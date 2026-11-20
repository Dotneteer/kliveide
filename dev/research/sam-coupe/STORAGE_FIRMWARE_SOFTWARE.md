# SAM Coupé — Storage, Firmware, OS and Software Ecosystem

Research notes for a future SAM Coupé emulator in Klive IDE. Scope: models and connectors, the ROMs
and their licensing, SAM BASIC's ROM architecture, the floppy system and its image formats, mass
storage add-ons, program loading, the developer tool chain and test software. The ASIC's video
timing and contention are touched only where firmware or storage depend on them.

Conventions: *inference* marks a conclusion of this note rather than a statement of a source.
"Disagreement" marks places where sources differ; both versions are kept. Emulator code is cited
as file + function/constant and described in prose, not quoted. All web sources were read on
**2026-11-18**; licences were checked through the GitHub API (`license.spdx_id`) or file headers
on that date.

---

## 1. Models, companies and connectors

### 1.1 History and models

| Item | Facts | Source |
|---|---|---|
| Maker | Miles Gordon Technology plc (MGT), Swansea. Released December 1989; ~12,000 sold; discontinued 1992. | https://en.wikipedia.org/wiki/SAM_Coup%C3%A9 (pointer only) ; MAME driver line `COMP( 1989, samcoupe, … "Miles Gordon Technology plc" …)` https://github.com/mamedev/mame/blob/master/src/mame/samcoupe/samcoupe.cpp |
| People | Hardware: Bruce Gordon. SAM BASIC (ROM): Dr Andrew J. A. Wright (also author of Beta BASIC on the Spectrum; ran Betasoft). Name ("Some Amazing Micro"): Alan Miles. | Wikipedia; https://www.worldofsam.org/copyrights/sam-coupe-rom-images |
| Rights holders over time | MGT went into receivership June 1990 → SAM Computers Ltd restarted the brand → stock bought by **West Coast Computers** in November 1992 (run in practice by Format Publications, Bob Brenchley); West Coast liquidated February 2005. | https://www.worldofsam.org/node/82 ; Wikipedia |
| Early-1990 ROM recall | MGT shipped a replacement ROM to ~8,000 existing customers early in 1990 to fix bugs, notably a DOS-booting bug. | worldofsam ROM table (seen via search snippet of https://old.worldofsam.org/node/430; that host's TLS certificate had expired at fetch time) |
| **256K** | Base model, 16 × 16K pages (0–15). West Coast later dropped the 256K "GameStar" model. | Tech manual v3.0 (§2); https://www.worldofsam.org/node/82 |
| **512K** | Internal upgrade on a connector under a trapdoor; 32 pages (0–31). MAME: `m_pages = ram size / 0x4000` (16 or 32). | Wikipedia; MAME `samcoupe.cpp` `machine_start` |
| **External 1 MB packs** | Up to 4 MB in 1 MB packs through the Euroconnector (SimCoupé `MAX_EXTERNAL_MB = 4`, `NUM_EXTERNAL_PAGES_1MB`). A One Meg pack in slot 1 only uses its upper 512K; slots 2–4 use the full 1 MB (MasterDOS page). The unofficial manual mentions "upgradeable to 4Mb … to 1Gb using Ryan interface". Few titles use it (MasterDOS RAM disk, MasterBASIC, TopGun demo). | SimCoupé `Base/SAM.h`; https://www.worldofsam.org/node/346 ; SimCoupé `Manual.md` |
| **SAM Élite** | West Coast's rework: 512K, standard 3.5" drives (Citizen slimline units unavailable, front faceplate cut out), external parallel printer connector fed from the drive connector. ROM **3.5** variant (see §2). | https://www.worldofsam.org/node/82 |
| "Blue Alpha" | **Disagreement with the brief**: no source ties Blue Alpha to the Élite. Blue Alpha made peripherals (sampler at port 0x7F/`0x7C7F`, Voice Box at `0xFF7F`; SimCoupé `Base/SAMIO.h`, `BlueAlpha.cpp`). | SimCoupé |
| TV standard | PAL only; SimCoupé derives everything from a 24 MHz crystal, 6 MHz CPU, 50 Hz fields (`CPU_CLOCK_HZ`, `PAL_FIELDS_PER_SECOND`). MAME: Z80B at 24 MHz/4, second crystal 4.433619 MHz for the RGB encoder. | SimCoupé `Base/SAM.h`; MAME `samcoupe.cpp` header |

### 1.2 Connectors and drive bays

| Connector | Notes | Source |
|---|---|---|
| Two internal 3.5" drive bays | Left bay = drive 1 (ports 224–231), right bay = drive 2 (240–247). Original drives: Citizen slimline with an MGT controller (VL1772-02) **per drive**, so both can run at once. Drive 1 is always floppy in SimCoupé; drive 2 may be floppy, Atom or Atom Lite. Booting is from drive 1 only. | Tech manual v3.0 "Disk drive"; SimCoupé `Manual.md`; MAME `io_map` |
| SCART | Non-standard: RGB + composite out and **power input**. | Wikipedia; unofficial manual back-panel sheet |
| Euroconnector | 64-pin (rows A–C fitted); full bus incl. XMEML (external memory select) and PRINTL; expansion devices decode the 0xE8–0xEF "print" range (MAME `print_w`). | Unofficial manual v1.0 back-panel; tech manual v3.0; MAME `io_w` |
| Joystick | One 9-pin Atari-type socket, two sticks via a splitter (MAME comment in `samcoupe.cpp` input ports); read through the keyboard matrix. | MAME |
| Mouse | Proprietary port; STATUS bit 1 "mouse interrupt" was "part of original SAM design, but never used" (SimCoupé `STATUS_INT_MOUSE`). | SimCoupé `SAMIO.h`; Wikipedia |
| MIDI IN/OUT | Port 253 (0xFD), 31.25 kbaud, software THROUGH (border bit 6 THROM). | Tech manual v3.0 |
| Light pen / gun | 5-pin DIN shared with stereo audio out; LPEN/HPEN at 0xF8/0x1F8. | Tech manual; SimCoupé `LPEN_PORT`, `HPEN_PORT` |
| Tape | 3.5 mm mono jack; EAR = keyboard port bit 6, MIC = border bit 3. | Tech manual v3.0; SimCoupé `KEYBOARD_EAR_MASK`, `BORDER_MIC_MASK` |
| Buttons | Reset and NMI ("break"). | Wikipedia |
| Printer | No port on the base machine; PRINTL1 data/status 0xE8/0xE9, PRINTL2 0xEA/0xEB (SimCoupé). The tech manual's OCR text gives "246 and 248" — **disagreement**, almost certainly OCR damage. | SimCoupé `SAMIO.h`; tech manual txt |

---

## 2. ROMs

### 2.1 Inventory

The ROM is 32K: ROM0 (normally in section A, 0000–3FFF) and ROM1 (paged into section D, C000–FFFF,
by LMPR bit 6). The version byte is at address 15: `PRINT PEEK 15/10` gives the version (30 = 3.0).
Sources: tech manual v3.0; https://samcoupe.com/hardrom.htm ; SimCoupé `Memory::LoadRoms` (two
`MEM_PAGE_SIZE` = 0x4000 blocks; accepts a file that is exactly 32K or starts with DI).

| Version | CRC32 / SHA1 (MAME BIOS name) | Notes |
|---|---|---|
| 0.1 | c04acfdf / 8976ed00… (`rom01.z5`) | Pre-production dump (Simon N Goodwin); works only on early hardware. |
| 0.4 | f439e84e / 8bc457a5… (`rom04.z5`) | Pre-production. |
| **1.0** | 3659d31f / d3de7bb7… (`rom10.z5`) | First shipped ROM. **Loads the boot sector but does not execute it**: after F9/BOOT type `CALL 229385` (256K) or `CALL 491529` (512K+). KBQB/KBQP sys-vars at 5A5Ah/5A6Ah instead of 5C8Dh/5C95h. JSCRN (0100h) absent. SimCoupé's BOOTNR hook is absent from 1.0. |
| 1.2 | 7fe37dd8 / 9339a0c1… | Pre-release (worldofsam table). |
| 1.3 | 2093768c / af8d348f… | Pre-release. |
| 1.4 | 08799596 / b4e59605… | Pre-release; SimCoupé's MSDML hook is absent from 1.4 and earlier. |
| 1.8 / 1.81 | f626063f / 485e7d9e… ; d25e1de1 / cb0fa79e… | Listed by MAME; not described elsewhere. |
| **2.0** | eaf32054 / 41736323… | "Amended ROM to fix bugs with disk bootstrap" (worldofsam table). |
| 2.1 | f6804b46 / 11dcac5f… | — |
| 2.4 / 2.5 | bb23fee4 / 10cd911b… ; ddadd358 / a25ed85a… | Pre-release builds. |
| **3.0** | **e535c25d / d390f0be420dfb12b1e54a4f528b5055d7d97e2a** (`rom30.z5`) | "Last official release". Two 3.0 versions reportedly exist, differing in "plc" vs "PLC" in the splash. |
| **3.1** | **0b7e3585 / c86601633fb61a8c517f7657aad9af4e6870f2ee** (`rom31.z5`, MAME's default BIOS 0) | worldofsam variant list: from MGT, has "PLC" rather than "plc"; that and the version number are the only difference from 3.0. |
| 3.5 | not in MAME | West Coast Computers, used in the SAM Élite: 3.0 with a new copyright message, keyword DIR replaced by CAT, "disk" spelled with a c. (A Quazar note on the same page says "DISC"; spelling **disagreement**.) |
| Homing PROM | — | Simon Cooke: 3.0 with a custom-orderable copyright message. |
| HD BOOT ROM / ATOM | dec75f58 / cd342579… (MAME `atom.z5`, "ATOM HDD Interface Auto Boot"; identical to SimCoupé `Resource/atom.rom`, PEEK 15 = 30) | 3.0 that boots DOS from hard disk or floppy at power-on/reset. |
| AL BOOT v2.2 (Atom Lite) | 9cf316a8 / b2303b72… (SimCoupé `Resource/atomlite.rom`, PEEK 15 = 30; not in MAME) | Edwin Blink, based on 3.0: resets the SAA, F7/F8 = DIR / DIR PEEK SVAR 7, SHIFT at reset = 256K, copyright replaced by "AL BOOT V2.2"; boots B-DOS from up to four CF cards (keys 1–4 force, 0 skips, SPACE = floppy). https://www.worldofsam.org/node/1892 |

CRCs are MAME's `ROM_START( samcoupe )` in `src/mame/samcoupe/samcoupe.cpp` (licence header
GPL-2.0+; read for facts). The version table and variant notes come from worldofsam's ROM page
(https://old.worldofsam.org/node/430, read through search snippets: certificate expired on
2026-11-18) and https://www.worldofsam.org/copyrights/sam-coupe-rom-images . MAME's own comment
says an older combined image "does match the 3.0 one the most, but the first half differs in one
byte" and the company-string case differs, which is the 3.0/3.1 "plc" split.

**Finding (verified 2026-11-18): SimCoupé's bundled `Resource/samcoupe.rom` is 32,768 bytes,
CRC32 0b7e3585, SHA1 c8660163…, `PEEK 15` = 31, i.e. MAME's v3.1**, although SimCoupé's
`Manual.md` says "built-in v3.0 ROM image" and its `Resource/samrom.map` is headed "SAM ROM v3.0
symbols". *Inference*: SimCoupé treats 3.1 as 3.0 (they differ only in the version byte and "PLC").
The file was last changed on 2016-02-05 ("Externalised built-in ROM images and patches").

### 2.2 What changed between versions

Only partly documented. Facts found: 1.0 does not run the bootstrap; 2.0 fixed the disk-bootstrap
bugs; 1.0 had many bugs, "most of which were ironed out in ROM 3.0" with "a few ROM bugs still"
(https://www.worldofsam.org/node/464); system-variable moves (KBQB/KBQP) between 1.0 and later
(tech manual). Early ROMs "tend to go mad once BASIC starts paging" (worldofsam ROM images page).
Quazar strongly advises version 1/2 owners to fit ROM 3 (https://samcoupe.com/hardrom.htm).
A per-version changelog was not found (OQ3).

### 2.3 Licensing and redistribution (critical)

| Item | What exists | Source |
|---|---|---|
| Who holds the ROM rights | Quazar calls Dr Andrew Wright "the author and copyright holder of the Sam ROM". *Inference*: no source shows MGT/SAM Computers/West Coast asserting rights in the ROM code; MGT's own copyright line is in the ROM splash. Who owns MGT's residual rights after the 1990 receivership and the 2005 West Coast liquidation is undocumented. worldofsam has an "MGT" copyright entry with **no status and no text** (posted 25 March 2022). | https://samcoupe.com/hardrom.htm ; https://www.worldofsam.org/copyrights/mgt |
| **Wright's 2008 grant (names the ROMs)** | "I hereby allow all my SAM Coupé titles (including ROMs) and associated manuals to be freely (re)distributed." Signed Andrew J. A. Wright, 16/04/2008, in a reply ("Re: Sam Coupe ROM") to Hans de Goede on the Fedora extras commits list. No conditions stated. Found 2026-11-20, after this file was first written; it settles OQ1 for redistribution (not for deriving work from the ROM's source). Reproduced in World of SAM's "Trivia"; the original was not reachable from the research environment. | https://www.worldofsam.org/products/rom ; https://listman.redhat.com/archives/fedora-extras-commits/2008-April/msg07874.html |
| ROM archive permission | worldofsam's ROM image archive (many versions, 2006) is released "with kind permission from the ROM author, Dr Andy Wright" (status "Granted", 15 May 2006). No wording about emulators. | https://www.worldofsam.org/copyrights/sam-coupe-rom-images |
| Andy Wright's blanket grant | "I hereby allow distribution of all my SAM Coupé titles and associated manuals freely" (signed 1 Oct 2006). The full sentence ends "…on any site carrying such material". It does not name the ROM. | https://www.worldofsam.org/copyrights/andy-wright |
| SimCoupé | ReadMe credits "Dr Andy Wright - Permission to distribute the SAM ROMs". SimCoupé is GPL-2.0 (GitHub API `gpl-2.0`; file headers "version 2 … or (at your option) any later version") but ships `samcoupe.rom`, `atom.rom`, `atomlite.rom` and `samdos2.sbt` as resources outside that licence. | https://github.com/simonowen/simcoupe (ReadMe.md, Resource/) |
| Quazar | Permission from Wright to "'burn' Sam ROM chips" (ROM 3 chips). | https://samcoupe.com/hardrom.htm |
| MAME | Only lists the romset (hashes); distributes nothing. | MAME `samcoupe.cpp` |
| SAM BASIC | Is the ROM; same position as above. | — |
| **SAMDOS** (1 and 2) | Credited to Bruce Gordon, 1990 (Spectrum Computing). **No permission statement found** from Gordon, MGT or successors. Nevertheless SimCoupé (`Resource/samdos2.sbt`, SAMDOS 2.2 since v1.0) and z88dk (`lib/target/sam/classic/samdos2.bin`, 10,000 bytes) both ship it, and Spectrum Computing hosts three SAMDOS disks with no rights note. | https://spectrumcomputing.co.uk/alt/34964/SAM_Coupe/SAMDOS ; SimCoupé ChangeLog 1.0 / 1.2.10 |
| **MasterDOS** (1.3, 1.4, 2.2, 2.3; Betasoft 1991) and **MasterBASIC** | Andy Wright's titles, so covered by his 2006 blanket grant (*inference*: they are "his SAM Coupé titles"). worldofsam's MasterDOS page shows "Copyright Provenance: Andy Wright" but an empty "Copyrights Granted" field. MasterBASIC manual 1991: © Andrew J.A. Wright, All Rights Reserved. | https://www.worldofsam.org/node/346 ; https://sam.speccy.cz/basic/master-basic_use-man.pdf |
| **B-DOS** (Edwin Blink) | "The B-DOS code and B-DOS information are FREEWARE" (20 Apr 2006); "no silly restrictions whatsoever". worldofsam entries "Edwin Blink - B-DOS: Granted". | https://www.worldofsam.org/node/29 ; https://www.worldofsam.org/Copyrights?page=1 |
| AL BOOT ROM | Blink's patch of ROM 3.0, so it inherits the ROM's position; page's "Copyrights Granted" is empty. | https://www.worldofsam.org/node/1892 |

*Inference / recommendation for Klive*: the ROM position is materially better than the Enterprise's
(an author's written permission exists and an established GPL emulator has shipped the ROM for
~20 years), but the written permission found is (a) attached to the worldofsam archive, (b)
relayed second-hand in SimCoupé's credits, and (c) a blanket 2006 grant to distribute "freely on
any site carrying such material", which is not explicitly a grant to bundle in another product.
Before bundling, ask Andy Wright directly (or find the original SimCoupé correspondence) for a
statement covering ROM 3.0 and 3.1 in an emulator installer (OQ1). SAMDOS has no permission trail
at all (OQ2); B-DOS is safe to bundle. A boot DOS Klive writes itself (a small loader in the boot
sector, as SimCoupé's dosboot does with SAMDOS) would avoid the SAMDOS question.

---

## 3. SAM BASIC and ROM architecture

Primary sources: SAM Coupé Technical Manual v3.0 (MGT 1990; text
https://sam.speccy.cz/systech/sam-coupe_tech-man_v3-0.txt , PDF transcribed by Stefan Drissen
https://www.worldofsam.org/system/files/2018-05/sam-coupe_tech-man_v3-0.pdf); the unofficial
"Entropy" technical manual v1.0 (ed. Simon Cooke, © 1994 Entropy, "All rights reserved", authors
include Bruce Gordon and Andy Wright) https://sam.speccy.cz/systech/unofficial_tech-man_v1-0.txt ;
SimCoupé `Resource/samrom.map` (symbol names for ROM 3.0) and `Base/SAMIO.cpp`.

### 3.1 Memory and paging as the ROM uses it

- 16K **pages** 0–31 map into four **sections** A (0000), B (4000), C (8000), D (C000).
  LMPR (port 250, 0xFA): bits 0–4 page for A (page+1 goes to B), bit 5 RAM0 (RAM replaces ROM0 in
  A), bit 6 ROM1 (ROM1 replaces RAM in D), bit 7 WPRAM (write-protect A). HMPR (251, 0xFB): bits
  0–4 page for C (page+1 to D), bits 5–6 mode-3 CLUT bits, bit 7 MCNTRL (C/D come from external
  memory). VMPR (252, 0xFC): bits 0–4 screen page, 5–6 mode, bit 7 MIDI. External memory page
  registers LEPR 0x80 / HEPR 0x81 (SimCoupé `SAMIO.h`). Tech manual v3.0; https://www.worldofsam.org/node/409
- **BASIC's address space**: SAM BASIC addresses beyond 65535 are linear "page form" addresses:
  `address = page × 16384 + offset − 4000h` for an offset in 8000–BFFF (tech manual, SAMDOS
  "Disk file header"), i.e. 16384–32767 = page 0, 32768–49151 = page 1, 49152–65535 = page 2
  (pyz80 README, `DUMP`). Check: ROM 1.0's `CALL 229385` = page 13 offset 8009h (256K) and
  `CALL 491529` = page 29 offset 8009h (512K) — the boot sector in the page below the 2-page
  screen (*inference*, consistent with §3.2).
- System variables and machine stack live in section B (page 0) from 4000h; SVARS at 5A00h.
  ALLOCT (5100h–5120h, 33 bytes) has one byte per page then FFh: FFh = absent, 00h = free,
  40h = first BASIC program, C0h = screen, 60h = DOS, 20h = utilities. Use it to find free pages.
  CLEAR n sets the BASIC limit; OPEN n / OPEN TO n / CLOSE n reserve or free whole pages.
  Tech manual v3.0 "Memory".
- Interrupts: IM 1 (0038h); STATUS (port 249 read) bits 0–4 = LINE, MOUSE, MIDI-IN, FRAME, MIDI-OUT,
  active low; bits 5–7 keyboard K6–K8. Writing 249 sets the line-interrupt line. Tech manual.

### 3.2 Boot sequence

1. Power-on: ROM0 in A; the ROM tests RAM (SimCoupé's "fast boot" skips "a few seconds of main
   memory testing"; `CPU_CYCLES_ASIC_STARTUP = 291675` models the ASIC's start-up delay).
2. The ROM prints the copyright message through RST 8 with error code 0x50 (SimCoupé `Rst8Hook`
   treats code 0x50 as "Copyright message" and ends its boot turbo there) and waits in **WTFK**
   ("wait for key", ROM 3.0 ≈ 0FA2h). SimCoupé `TestStartupScreen` detects the start-up screen by
   finding WTFK's return address on the stack.
3. **No automatic disk boot** on the standard ROM. The user presses **F9** or types `BOOT`. The ROM
   reads **side 0, track 4, sector 1** (the first data sector, i.e. the first file's first sector)
   into the last free page (normally below the screen: 3rd-from-last page) at 8000h, checks the
   4-byte tag **"BOOT" at bytes 256–259** of the sector (bits 7 and 5 ignored — SAMdisk masks
   `~0xA0` before comparing), and jumps to **8009h**, skipping the 9-byte file header. The DOS
   then loads the rest of itself; SAMDOS sits in that page and stores its page at **5BC2h**
   (DOSFLG; 0 = no DOS). Sources: https://worldofsam.org/node/2145 (boot sector size, tag, 8000h,
   8009h); tech manual "Locating SAMDOS"; SAMdisk `src/types/sbt.cpp`, `src/SAMCoupe.cpp`.
4. Errors seen by an emulator: 55 (no disk), 19 "Loading error", 53 "No DOS", 101 "No AUTO* file",
   88 "No BOOT file". SimCoupé's dosboot catches 0x35/0x13 in `Rst8Hook`, swaps in its internal
   `samdos2.sbt` and re-enters **BOOTEX** (read from the jump at **BOOTNR**, ROM 3.0 ≈ D8DFh).
5. After DOS loads, `INIT` (hook 128) looks for an **AUTO*** file and runs it. SBT images exploit
   this with a file named `autoExec` (SAMdisk `ReadSBT`).
6. Exceptions: ROM 1.0 does not run the boot sector (§2.1); HD BOOT / AL BOOT ROMs boot at reset.

**Ready-for-input landmarks (ROM 3.0, SimCoupé `Memory.cpp` hook comments)**: IMEXIT ≈ 0057h
(leaving the interrupt handler; SimCoupé injects typed keys here), WTFK ≈ 0FA2h (copyright
screen), READKEY ≈ 1CB2h (SimCoupé starts auto-load here), EDGLP ≈ 2053h (editor loop), DOSERR
≈ 3835h; ROM1: MSDML ≈ D4D6h, SVLDCOM ≈ E612h, LDSTRT ≈ E678h, LOADFAIL ≈ E6F5h, LOADEXIT ≈ E739h.
SimCoupé finds these by **byte-pattern search, not fixed addresses**, keeping a hook only if the
pattern matches exactly once (`update_rom_hooks`, `mem_match`) — the robust way to support several
ROM versions. Not a ROM patch.

### 3.3 RST vectors, jump table, hooks, error handling

- RSTs: 0000 init; 0004/0005 POP HL/JP (HL) (get own address); **0008 error handler / DOS hooks**;
  0010 print A; 0013 print BC bytes from DE; 0018/0020 get current/next BASIC character; 0028
  floating-point calculator; 0030 user RST (→ RST30V; ROM0 uses it internally to call ROM1); 0038
  mode-1 interrupt; 0066 NMI. Tech manual v3.0 "ROM resources".
- **Jump table at 0100h** (3-byte entries): JSCRN 0100, JSVIN 0103, JHEAPROOM 0106, JWKROOM 0109,
  JMKRBIG 010C, JCALBAS 010F, JSETSTRM 0112, JPOMSG 0115, JEXPT1NUM 0118, JEXPTSTR 011B, JEXPTEXPR
  011E, JGETINT 0121, JSTKFETCH 0124, JSTKSTORE 0127, JSBUFFET 012A, JFARLDIR 012D, JFARLDDR 0130,
  JPUT 0133, JGRAB 0136, JPLOT 0139, JDRAW 013C, JDRAWTO 013F, JCIRCLE 0142, JFILL 0145, JBLITZ
  0148, JROLL 014B, JCLSBL 014E, JCLSLOWER 0151, JPALET 0154, JOPSCR 0157, JMODE 015A, JTDUMP 015D,
  JGDUMP 0160, JRECLAIM 0163, JKBFLUSH 0166, JREADKEY 0169, JWAITKEY 016C, JBEEP 016F, JSAVE 0172,
  JLOAD 0175, JLDVD 0178, JEDGE2 017B, JSTRS 017E, JSENDA 0181, JNCHAR 0184, JGRCOMP 0187, JGTTOK
  018A, JCLSCR 018D. SimCoupé `samrom.map` (names; the tech manual's list is a subset with OCR
  variants such as JCALLBAS/JSTRFETCH).
- **Vectors** (sys-vars, 2 bytes each; a vector routine that just RETs falls back to the ROM):
  5ADA (DMPV per tech manual / VECTBS per samrom.map), SETIYV 5ADC, PRTOKV 5ADE, NMIV 5AE0,
  FRAMIV 5AE2, LINIV 5AE4, COMSV 5AE6, MIPV 5AE8, MOPV 5AEA, EDITV 5AEC, RST8V 5AEE, RST28V 5AF0,
  RST30V 5AF2, CMDV 5AF4, EVALUV 5AF6, LPRTV 5AF8, MTOKV 5AFA, MOUSV 5AFC, KURV 5AFE.
- **DOS hook codes**: `RST 08h` + `DEFB code`; codes ≥ 128 go to the DOS. On return A = 0 (OK) or
  an error number with carry set; DOSER (5BC0h) may point at a user "return from DOS" routine.
  SAMDOS (tech manual): INIT 128, HGTHD 129, HLOAD 130, HVERY 131, HSAVE 132, HVAR 139, HOFLE 147,
  SBYT 148, HWSAD 149, HSVBK 150, CFSM 152, HGFLE 158, LBYT 159, HRSAD 160, HLDBK 161, REST 164,
  PCAT 165, HERAZ 166. MasterDOS adds HSKSF 133, HAUTO 136, HSKTD 137, HFMTK 138, HEOF 140, HPTR
  141, HPATH 142, HLDPG 143, HVEPG 144, HSDIR 145, HOFSM 146, HDBOP 151, HORDER 153, HMRSAD 162,
  HMWSAD 163, HCHRD 168 (unofficial manual). **Disagreement**: the unofficial manual numbers
  HGFLE 154 (&9E) and HRSAD 155 (&A0) — the decimal and hex disagree; the tech manual's 158/160
  match the hex. DVAR 0 is at offset 0220h in the DOS page; DVAR 111 maps drive numbers.
- Error numbers 81–112 are SAMDOS's (81 Nonsense in SAMDOS … 107 File not found … 112 Channel used;
  full list in the tech manual). The UIFA/DIFA (48 bytes each, IX-addressed, DIFA 80 bytes above
  UIFA; HDR 4B00h, HDL 4B50h) carry file parameters to hooks.

### 3.4 System variables (for a SysVars panel)

From SimCoupé `Resource/samrom.map` ("BASIC System Variables", ROM 3.0), cross-checked against
the tech manual where it overlaps. Addresses are in section B (page 0). A selection; the map has
~280 entries:

| Range | Variables |
|---|---|
| 4000–5180 | HPEND 4000 (heap), BSTACK 4AFF, KEYP2 4B00 (= HDR, file-header buffer), HDL 4B50, INTSTK 4C00, FPSB 4D00, TOKPT2 4D80, ISPVAL 4F00, ALLOCT 5100, MEMVAL 5121, FIRLET 5140, SCRNBUF 5188, CHARSVAL 5190, PALTAB 55D8, LINICOLS 5600 (line-interrupt colour table), DKBU 5800, KTAB 58E0 |
| 5A00–5A3F | VAR2, KURCHAR 5A01, SPEEDINK 5A08, LPTPRT1 5A10, windows UWRHS…LWBOT 5A38–5A3F |
| 5A40–5A9F | MODE 5A40, attribute set ATTRP/MASKP/… 5A45–5A55, WINDRHS…WINDMAX 5A56–5A5A, PRPOSN 5A70, DEVICE 5A73, page/offset pairs SAVARSP/SAVARS 5A81, NUMENDP/NUMEND 5A84, NVARSP/NVARS 5A87, DATADDP/DATADD 5A8A, WKENDP/WKEND 5A8D, WORKSPP/WORKSP 5A90, ELINEP/ELINE 5A93, CHADP/CHAD 5A96, KCURP/KCUR 5A99, NXTLINEP/NXTLINE 5A9C, **PROGP/PROG 5A9F/5AA0** |
| 5AA2–5AFF | XPTR, DEST, PRPTR, DPPTR, CLAPG/CLA 5AAE, LASTSTAT 5AD1, SPSTORE 5AD2, NMISP 5AD7, vectors 5ADA–5AFE |
| 5B00–5BFF | CEXTAB 5B00, EXTAB 5B20, COMPFLG 5B40, ERRSTAT 5B42, ERRLN 5B43, ONERRFLG 5B45, LPT 5B52, ANYIV 5B70, CURCMD 5B74, AUTOFLG 5B88, mouse MXCRD/MYCRD 5B96/5B98, PRNBUFF 5BA0, **DOSER 5BC0, DOSFLG 5BC2**, DOSCNT 5BC3, BSTKEND 5BC4, BASSTK 5BC6, HEAPEND 5BC8, DKDEF 5BCE, KBTAB 5BD8, CMDADDRT 5BDA, PAGER 5BE0, KBUFF 5BEE |
| 5C00–5CB5 (Spectrum-like) | KDATA 5C02, LASTK 5C08, REPDEL/REPPER 5C09/5C0A, STREAMS 5C10, CHARS 5C36, ERRNR 5C3A, FLAGS 5C3B, TVFLAG 5C3C, ERRSP 5C3D, NEWPPC 5C42, PPC 5C45, BORDCR 5C48, CHANS 5C4F, CURCHL 5C51, STKEND 5C65, MEM 5C68, FLAGS2 5C6A, SEED 5C76, **FRAMES 5C78** (3 bytes + FRAMES34 5C7F), UDG 5C7B, KBQB 5C8D, KBQP 5C95, SCPTR 5C9D, FISCRNP 5C9F, SCLIST 5CA0 (16 screens: bits 6–5 mode, 4–0 page), LASTPAGE 5CB0, RAMTOPP/RAMTOP 5CB1/5CB2, PRAMTP 5CB4 (last physical page) |

SimCoupé itself uses only `SYSVAR_LAST_K = 0x5C08` and `SYSVAR_FLAGS = 0x5C3B` (`Base/SAM.h`).
The tech manual's OCR gives RAMTOP as 5C82h (clashes with OLDPOS); samrom.map's 5CB2 is right
(*inference*). Klive's own names should be written from the tech manual (MGT's names) rather than
copied from the GPL-project map file (OQ6).

### 3.5 BASIC program format

- Program at PROGP:PROG (page + offset 8000–BFFF form). Each line: **line number MSB, LSB**; **line
  length LSB, MSB**; text; **0Dh**. Up to 127 statements, 16127 bytes per line; max line FEFFh;
  program ends with **FFh**. Numbers: **0Eh + 5 bytes** (exponent+80h and 4 mantissa bytes, or an
  integer form with a zero marker).
- Tokens: keywords **85h–FEh** are single bytes; functions are **FFh followed by 3Bh–83h**.
  The token-to-text table itself was not found in a public document (OQ5); it is in the ROM
  (TOKPT2/MTOKV hint at the lookup).
- Variables: NVARS area starts with 26 two-byte letter heads (FFFFh = none); type/length byte bits
  0–4 = length−1 (names up to 32 chars), bit 6 FOR-NEXT, bit 7 hidden (LOCAL). Each numeric var has
  5 value bytes; FOR adds 14 (limit 5, step 5, loop address 3, statement 1). Strings/arrays at
  SAVARS, end with FFh; bit 6 string array, bit 5 numeric array. Tech manual "Variable formats".

---

## 4. Disk system

### 4.1 Controller and ports

| Fact | Source |
|---|---|
| VLSI **VL1772-02** (WD1772-compatible), one per drive. MAME instantiates `WD1772` at 24 MHz/3 = 8 MHz. | Tech manual; MAME `src/devices/bus/samcoupe/drive/floppy.cpp` `device_add_mconfig` |
| Drive 1: **224–231 (E0h–E7h)**, drive 2: **240–247 (F0h–F7h)**; only the low byte decodes (MAME `mirror(0xff00)`, SimCoupé `FLOPPY_MASK = 0xF8`). | MAME `io_map`; SimCoupé `SAMIO.h` |
| **A0–A1 select the register**: 0 status (read) / command (write), 1 track, 2 sector, 3 data. **A2 is the side select** (0 = side 1, 1 = side 2), set on every access. E.g. `IN A,(231)` = data, side 2, drive 1. | Tech manual "Disk interface"; MAME `sam_floppy_device::read/write` (`ss_w(BIT(offset, 2))`, `offset & 3`) |
| No separate drive-select/motor latch: the drive is chosen by the port range; motor via the 1772's own motor-on. *inference* from both emulators' port maps. | — |
| 0xE8–0xEF is the "print" range decoded by expansion devices; 0xEF is a clock port (SimCoupé `CLOCK_PORT`, SAMBUS/Dallas). | MAME `io_w`; SimCoupé |

### 4.2 Format and file system (SAMDOS / MasterDOS / B-DOS, G+DOS-compatible)

- **80 tracks × 2 sides × 10 sectors × 512 bytes = 819,200 bytes** (800K), IBM 3740-style MFM,
  sectors numbered 1–10. Track number on disk: `c` on side 0, `128 + c` on side 1 (bit 7 = side).
  Tech manual; SAMdisk `ReadSBT` (`cyl | 0x80` for side 1).
- Directory: tracks 0–3 of side 0, two 256-byte entries per sector, **80 entries**. 1560 data
  sectors, 798,720 bytes, 510 data bytes per sector; bytes 510–511 = next track, next sector;
  (0,0) ends the chain. Sector address map: 195 bytes = 1560 bits, bit 0 of byte 15 = track 4
  sector 1, then side 0 to track 79, then side 1. The BAM is built by OR-ing all maps (not stored).
  MasterDOS may have more directory tracks: byte 255 of the first entry = extra tracks (4–39 total).
- **Directory entry (256 bytes)** — SAMdisk `include/SAMCoupe.h` `MGT_DIR` (MIT, comments cite the
  tech manual): 0 type (b7 hidden, b6 protected, 0 = free); 1–10 name (first char 0 = unused);
  11–12 sector count (MSB, LSB); 13–14 first track/sector; 15–209 sector map; 210–219 +D/ZX data or
  disk label (first entry; MasterDOS); 220 flags/snapshot registers start; 221–231 file-type info
  (221 = screen mode−1 for SCREEN$); 232–235 "BDOS" on B-DOS disks; **236 start page** (bits 0–4);
  237–238 start offset (8000–BFFF); 239 length in pages; 240–241 length mod 16384; **242 exec page
  (FFh = none) / 243–244 exec offset or BASIC auto-run line**; 245–249 date/time (B-DOS 1.7a+
  packed form if month bit 7); 250–255 dir tag, serial (MasterDOS), extra dir tracks.
- **File types** (bits 0–5): SAM: **16 BASIC, 17 numeric array, 18 string array, 19 CODE, 20
  SCREEN$, 21 directory (MasterDOS)**; ZX (+D): 1 ZX BASIC, 2 ZX num array, 3 ZX str array, 4 ZX
  CODE, 5 ZX SNP 48K, 6 MDRV, 7 ZX SCREEN$, 8 SPECIAL, 9 ZX SNP 128K, 10 OPENTYPE, 11 ZX EXECUTE,
  12/13 UNIDOS, 22/23 DRIVER APP/BOOT, 24–26 EDOS, 28–31 HDOS. SAMdisk `src/cmd_dir.cpp`; tech
  manual lists 5, 16–20.
- **9-byte SAM file header** at the start of every file's data: 0 type; 1–2 length mod 16384;
  3–4 start offset (8000–BFFF); 5–6 unused (FFh); 7 number of pages; 8 start page (bits 0–4).
  Length = pages × 16384 + mod length. Tech manual "Disk file header"; SAMdisk `MGT_FILE_HEADER_SIZE`.
  (+D/ZX files instead start with the Spectrum-style 9-byte header that the entry repeats at 211–219.)
- **Bootable disk**: the first file must start at **track 4 sector 1** and carry "BOOT" at bytes
  256–259 of that sector (file bytes 247–250 after the header) — normally the DOS (SAMDOS is
  named `samdos2` on most disks). DOS identification on the disk (SAMdisk `GetDiskInfo`):
  "BDOS" at 232 → B-DOS; label byte 210 not 00/FF → MasterDOS; else SAMDOS.
- Spectrum **+D/DISCiPLE compatibility**: same physical format and directory (G+DOS); SAMDOS "is
  similar to G+DOS" (tech manual). SAMDOS can load ZX type-5 snapshots for the SAM's Spectrum
  mode (48K only, needs a Spectrum ROM image; Wikipedia).

### 4.3 What Klive already has

`src/common/diskfs/mgtfs.ts` (`MgtFileSystem`) reads and writes 819,200-byte `.mgt` images with the
interleaved track order, 4 directory tracks, the sector map and link bytes — written from the
+D/DISCiPLE Technical Guide for **+D (G+DOS) files**: `DIR_TYPES` maps only 1–4 and 7, and new
files get the ZX 9-byte header (`dev/ai/file-manager.md`, "MGT"). Gaps for the SAM
(*inference* from the code): SAM types 16–21 (and 5, 9–11) are not listed; the SAM 9-byte header
(page/offset form) is not parsed/written; entry bytes 236–244 (start page, length, exec) are not
filled; bits 6–7 (protected/hidden) are not surfaced; MasterDOS extra directory tracks (byte 255)
and SAD/EDSK/gzip containers are not read. The sector allocator and chain code are reusable.

### 4.4 Disk image formats

| Format | Layout | Common? | Sources |
|---|---|---|---|
| **.mgt** | Raw 819,200 bytes; track order **cyl 0 side 0, cyl 0 side 1, cyl 1 side 0…** (offset `(c*2+h)*10*512`). SimCoupé calls it the "preferred format"; MAME also accepts 720K (9-sector, CP/M) sizes and the extensions `mgt,dsk,cpm`. | **Most common** for SAM software | SimCoupé `Manual.md`; MAME `src/lib/formats/coupe_mgt.cpp` (BSD-3-Clause); pyz80 `dsk_at` |
| **.dsk (raw)** | Older name for the same MGT layout. pyz80 writes **gzip-compressed** MGT-layout `.dsk` by default (`--nozip` to disable), which SimCoupé loads. | Very common (pyz80 output, archives) | SimCoupé `Manual.md`; pyz80 README |
| **.dsk (EDSK)** | Extended CPC DSK; can hold any SAM disk incl. copy protection (~840K for a normal disk). Must be told apart from raw `.dsk` by the "EXTENDED CPC DSK" signature (*inference*). | Common for protected originals | SimCoupé `Manual.md`; SAMdisk formats page |
| **.sad** | Aley Keprt's "SAm Disk": 22-byte header = `"Aley's disk backup"` (18) + heads, tracks, sectors, sector size/64; data **side-major** in MAME (`(head*tracks + track)*tracksize`). 819,222 bytes for a normal disk; "version 2" SAD files are gzip-compressed. MAME accepts 80 or 82 tracks, `sad,dsk`. | Moderate | MAME `coupe_sad.cpp` (BSD-3); SimCoupé `Manual.md`; SAMdisk `src/types/sad.cpp` (MIT) |
| **.sdf** | SimCoupé's own (0.80) format for copy-protected disks: 6144-byte track records, 2 sides, 80–83 cylinders; first byte = sector count, then 8-byte sector descriptors (id/data status, CHRN…) + data. SimCoupé removed SDF support in 1.1; MAME and SAMdisk read it. | Rare, legacy | MAME `coupe_sdf.cpp/.h`; SimCoupé ChangeLog |
| **.sbt** | Andrew Collier's "SAM BooTable": a bare self-booting code file (≤ one disk, carries "BOOT" at file offset 0x100−9). Emulators wrap it as a virtual disk: CODE file `autoExec`, page 1 offset 8000h, at track 4 sector 1, so the ROM boots it directly. Read-only in SimCoupé. | Common for demos/utilities | SAMdisk `src/types/sbt.cpp` (MIT); SimCoupé `Manual.md` |
| **.td0** | Sydex TeleDisk; SimCoupé dropped it (convert to EDSK with SAMdisk). | Rare | SimCoupé |
| **.cpm** | Pro-DOS CP/M, 80/2/9/512 (720K). | Rare | SAMdisk formats page |
| **.ds2** | Velesoft split-side format. | Rare | SAMdisk |
| **.hdf** | Hard-disk image (Atom / Atom Lite / B-DOS records; 32 MB = 40 floppy records). | Needed for HD add-ons | SimCoupé `Manual.md` |
| Archives | `.gz` (SAD v2, pyz80), `.zip` widely used on archives. | — | — |

SAMdisk (Simon Owen) — **MIT** (GitHub API, https://github.com/simonowen/samdisk) — reads MGT, SAD,
SBT, SDF, DS2, CPM, EDSK, TD0 and flux formats, and writes .mgt/.sad/.dsk/.cpm
(https://simonowen.com/samdisk/formats/). Being MIT, it is a citable design reference for image
handling (attribution required if code is derived).

---

## 5. Mass storage add-ons

| Device | Facts | Emulator needs | Sources |
|---|---|---|---|
| **Atom** (Edwin Blink, "classic") | 16-bit IDE interface in drive-2 port range: offset 5 = address select (incl. reset pin), 6 = data high (16-bit word read; low byte latched), 7 = data low. Byte-swapped data compared with Atom Lite. B-DOS 1.6/1.7 (ATAPI, 16-bit). HD BOOT ROM. | ATA device + HDF, ROM `atom.rom` | SimCoupé `Base/Atom.cpp`; SAMdisk `IsBDOSDisk` (`OBTO` signature = byte-swapped "BOOT") |
| **Atom Lite / Atom Lite+** | 8-bit CF-IDE, fits either drive bay without opening the case; RTC (Dallas, address 0x1D in the latch); dual CF on AL+. Offsets 5 address latch, 6/7 data. B-DOS 1.5a; AL BOOT ROM v2.2. | ATA (LBA28, 8-bit mode), Dallas RTC, ROM | SimCoupé `AtomLite.cpp`; https://sam.speccy.cz/atomlite.html |
| **B-DOS** | Freeware SAMDOS-compatible DOS: CF/SD split into **819,200-byte "records"** (one floppy each); sector 1 boot sector ("BOOT" at 0x100), then a record list of 16-byte labels (32 per sector), list size = (sectors/1600 + 32)/32 sectors; trailing short record only if ≥ 40 sectors remain; ≤ 8 GB (~10,000 records); names like `GAM:`. Reads SAM, +D, DSK and MGT images on a record. 1.5t = Trinity SD. | Image = HDF of records | https://sam.speccy.cz/atomlite.html ; SAMdisk `SAMCoupe.cpp` (`GetBDOSCaps`, `UpdateBDOSBootSector`) |
| **Trinity** (Quazar) | Ethernet + MMC/SD slot + 128K EEPROM behind a microcontroller; B-DOS patched for SD by Chris Pile, up to 64 GB (approved by Blink). 2014 cut-down "Trinity Mass Storage Interface": SD/SDHC only, no EEPROM boot ROM. Port map not documented on the page (OQ8). | Not emulated by SimCoupé | http://www.samcoupe.com/hardtrin.htm ; https://old.worldofsam.org/node/762 (snippet) |
| **S D Software IDE** (Nev Young) | Data port 0xBD (high latched), register port 0xBF; H-DOS. | Rare | SimCoupé `SDIDE.cpp`, `SAMIO.h` |
| Pro-DOS | CP/M on SAM; on HD: 68 base sectors, 2048-sector records. | Rare | SAMdisk `SAMCoupe.h` |
| **The Messenger** (MGT) | Connects a Spectrum to the SAM to capture a Spectrum's state to SAM disk (ZX snapshot). | Not needed for Klive | Wikipedia |
| Floppy emulators | HxC firmware lists SAM Coupé `.mgt`/`.sad`; FlashFloppy documents DSK for SAM (MGT unconfirmed). | — (real-hardware side) | https://hxc2001.com/docs/gotek-floppy-emulator-hxc-firmware/pages/emulation-from-images.html ; https://www.cpcwiki.eu/index.php/FlashFloppy |
| DivSD / esxDOS | sam.speccy.cz links an esxDOS-for-SAM site (http://esxdos.samcoupe.cz/) but its DivSD page describes only the Spectrum interface. | Unclear (OQ9) | https://sam.speccy.cz/ ; https://sam.speccy.cz/divsd.html |

*Inference*: for today's community, floppy images (MGT/DSK/SAD/SBT) plus B-DOS on Atom Lite /
Trinity CF/SD cards are what matters; an emulator needs the floppy pair first, then Atom Lite +
HDF records as an optional second phase.

---

## 6. Loading programs without a disk

- **How a SAM user loads code**: from a booted DOS, `LOAD "name" CODE [addr]` then `CALL addr`, or
  a CODE file with an exec page/offset auto-runs (`LOAD "name"` / auto file). AUTO* files run on
  boot. BASIC addresses use the page form (§3.1). Tape works the same (5 file types; SAM header
  differs from the Spectrum's, data blocks are Spectrum-format up to 512K; speed 112 =
  Spectrum-compatible default; LOAD autodetects speed). Tech manual "Tape system".
- **User code placement**: pyz80's default and SBT convention is **32768 = page 1 offset 0**
  (BASIC address 32768, normally section C under BASIC's paging). The LERM assembler warns "SHOULD
  NOT … assemble any code below 32768" (it uses that memory) and the LERM toolkit lives at
  26000–32767, so the low half of BASIC's space (page 0 above the sys-vars) is BASIC/tool memory
  (https://www.worldofsam.org/system/files/2023-12/LERM%20SAM%20ASSEMBLER%203.1%20Manual.pdf).
  Free pages are those marked 00h in ALLOCT; the screen takes the top two pages (14–15 or 30–31),
  the DOS the page below. "Don't have any bits of program crossing a page boundary (such as at
  32767-32768)" (https://www.worldofsam.org/node/1893). Where exactly PROG starts after boot is
  unconfirmed (OQ4).
- **SimCoupé**: inserting a disk at the start-up screen **auto-boots** it (types `BOOT` + Enter at
  READKEY once WTFK is on the stack; `-autoboot`/`-autoload`); a tape at the start-up screen gets
  `LOAD ""`. "Allow booting from non-bootable disks" (`-dosboot`, default on) loads its internal
  SAMDOS 2.2 from `samdos2.sbt` (or a `-dosdisk`) when the ROM reports No DOS / Loading error, then
  restores the user's disk. SBT files are mounted as one-file bootable virtual disks. Tapes:
  `.tap/.tzx/.csw/.wav` through libspectrum, with ROM load traps (`-tapetraps`) that read the
  wanted length from `0x5AC8`:DE. Sources: SimCoupé `Base/SAMIO.cpp` (`AutoLoad`, `Rst8Hook`,
  `Rst48Hook`, `TestStartupScreen`), `Base/Tape.cpp`, `Manual.md`.
- **MAME**: no quick-load; floppy via softlist `hash/samcoupe_flop.xml`, tape `samcoupe_cass.xml` (TZX).
- *Inference for Klive*: the cheapest "Run" for assembled code is to build an **in-memory MGT image**
  (DOS + `autoExec` CODE file at page 1/8000h, exec address set) — exactly what SBT wrapping does —
  and auto-type `BOOT` at the READKEY landmark; a DOS-less alternative is to write the code straight
  into the right pages after WTFK and set PC (needs the page form and the LMPR/HMPR the ROM uses).

---

## 7. Assemblers and developer ecosystem

| Tool | Facts | Licence (verified 2026-11-18) |
|---|---|---|
| **pyz80** (Andrew Collier; Simon Owen et al.) | Python 3 cross-assembler designed for the SAM. Output: gzip-compressed MGT-layout disk image (`--nozip`), raw binary (`--obj`), `--mapfile`, listing. `DUMP address` (16384–65535, BASIC pages 0–2) or `DUMP page, offset`; `AUTOEXEC` sets the exec address in the directory; `MDAT` includes data. `-I file` adds files (e.g. a SAMDOS file to make it bootable); `-B` custom boot file; the first file can itself carry the BOOT signature. Supports 9-sector images (samdos9). Does **not** bundle SAMDOS. VS Code extension `simonowen/vscode-pyz80`. | GPL-2.0 (API; README "GNU General Public License"). vscode-pyz80: MIT. https://github.com/simonowen/pyz80 |
| **z88dk `+sam`** | Config `lib/config/sam.cfg`: subtypes `basic` (uses the ROM, CRT_ORG_CODE = 32768, palette at 0x55D8), `allram` (org 0, takes over paging, screen at 0x8000) and `highram`; all build an MGT image with appmake `+mgt` (`src/appmake/mgt.c`: `--container raw|dsk`, `--dosfile`, `--exec`, `--add-file`, `--zx` for +D discs). Default DOS = bundled `samdos2.bin`. | Clarified Artistic License (`LICENSE`; API shows NOASSERTION). https://github.com/z88dk/z88dk |
| **sjasmplus** | No SAM device and no MGT/SAM output. Devices: ZXSPECTRUM48…8192, ZXSPECTRUMNEXT, NOSLOT64K, AMSTRADCPC*. *Inference*: `DEVICE ZXSPECTRUM512` (32 × 16K pages) + `SAVEBIN`/`SAVEDEV` gives page-addressed binaries that Klive would have to wrap into an MGT itself. | BSD-3-Clause (API). https://github.com/z00m128/sjasmplus `docs/documentation.xml` |
| **Comet** (Edwin Blink) | Native SAM assembler; permission for web download (2008); bundled with Atom Lite downloads. | worldofsam "Edwin Blink - Comet: Granted" https://www.worldofsam.org/node/51 |
| LERM SAM Assembler 3.1 / Toolkit, SC_Assembler (Steve's Software) | Native assemblers with manuals on worldofsam / sam.speccy.cz. | Steve's Software: "Granted" entry |
| TASM | No SAM-specific information found (OQ10). | — |
| SAMdisk | Image conversion/inspection (§4.4). | MIT |

What a developer expects to run in an emulator (*inference* from the tools): **`.dsk`/`.mgt`
(often gzipped)** from pyz80 and z88dk, **`.sbt`** single-file boots, and raw binaries with a load
page/offset; SAD/EDSK for existing software.

---

## 8. Test software and demos

- No published, named SAM timing-test suite was found. Simon Owen's timing tables were generated
  with SimCoupé v1.2.5's CPU core and contention rules, and his mode-1 contention article reports
  the delays were "compared against a real SAM running some general timing tests" (paraphrased):
  https://simonowen.com/sam/timings , https://simonowen.com/articles/mode1 , and
  https://simonowen.com/blog/2007/08/04/attribute-port/ (attribute port 0xFF).
- Software SimCoupé's ChangeLog names as having exposed timing/device bugs (use as regression
  material, licence per title): **Defender** (interrupt active time; HPEN/LPEN), **BSD demo**
  (HPEN/LPEN), a demo needing exact **MIDI-OUT interrupt** timing (0.81), the **Space demo on
  FRED 59** (SAA samples), **SAM DICE** (1772 READ_TRACK/READ_ADDRESS), **SAM Mines**
  (multi-sector reads), a sample-player demo (interrupt flicker, 20200324), the **Inner Circle
  Sample Demo** (Paula DAC), **TopGun demo** (external memory). sam-users posts mention "SAM
  demos that rely on perfect timing" (https://www.mail-archive.com/sam-users@nvg.ntnu.no/msg27088.html).
- Licences: worldofsam's copyright index (https://www.worldofsam.org/Copyrights) lists per-author
  grants (e.g. Stefan Drissen "Sophistry, SAM MOD player and the rest", Colin Jordan, ZeroTeam,
  Vertex Software, S D Software non-commercial, Andy Wright, Edwin Blink). Check each title before
  using it in a committed test; FRED magazine has its own entry ("Colin MacDonald - Fred Magazine").
- MAME's `hash/samcoupe_flop.xml` is a curated list of floppy dumps with hashes — a good index of
  canonical images (data only; images not distributed).

---

## 9. Reference documents (fetch later)

| Document | URL |
|---|---|
| SAM Coupé Technical Manual v3.0 (MGT 1990), text | https://sam.speccy.cz/systech/sam-coupe_tech-man_v3-0.txt |
| Same, PDF (Drissen's corrected transcription) | https://www.worldofsam.org/system/files/2018-05/sam-coupe_tech-man_v3-0.pdf |
| Unofficial ("Entropy") Technical Manual v1.0, 1994 | https://sam.speccy.cz/systech/unofficial_tech-man_v1-0.txt ; https://www.worldofsam.org/sites/default/files/dl-29/unofficial_tech-man_v1-0.pdf |
| SAM BASIC complete guide | https://sam.speccy.cz/basic/sam-basic_complete_guide.pdf |
| MasterBASIC user manual | https://sam.speccy.cz/basic/master-basic_use-man.pdf |
| SAM Drive manual / One Meg RAM pack / Comms / SPI manuals | https://www.worldofsam.org/system/files/2018-05/SAM%20Coup%C3%A9%20Sam%20Drive%20Manual.pdf ; …/2018-09/SAM%20Coup%C3%A9%20One%20Meg%20Ram%20Pack%20Manual.pdf ; …/2018-09/SAM%20Coup%C3%A9%20Comms%20Interface%20Manual.pdf ; …/2022-03/SAM%20Coup%C3%A9%20SPI%20Interface%20Manual.pdf |
| LERM SAM Assembler 3.1 / Toolkit 1 manuals | https://www.worldofsam.org/system/files/2023-12/LERM%20SAM%20ASSEMBLER%203.1%20Manual.pdf ; …/LERM%20SAM%20TOOLKIT%201%20Manual.pdf |
| SC_Assembler notes | https://sam.speccy.cz/steves/sc-asm_v1-2_man-notes.pdf |
| ROM version table (worldofsam) | https://old.worldofsam.org/node/430 (TLS cert expired 2026-11-18) |
| ROM images + permission | https://www.worldofsam.org/copyrights/sam-coupe-rom-images ; https://worldofsam.org/node/35 |
| Boot sector intro | https://worldofsam.org/node/2145 |
| Format magazine text archive (Betasoft ads, ROM 3 notes) | https://archive.org/download/format_mag/ |
| SimCoupé source (GPL-2.0, facts only) | https://github.com/simonowen/simcoupe — `Base/SAMIO.cpp`, `Base/SAMIO.h`, `Base/SAM.h`, `Base/Memory.cpp`, `Base/Atom*.cpp`, `Base/Tape.cpp`, `Resource/samrom.map`, `Resource/samdos2.map`, `Manual.md`, `ChangeLog.md` |
| SAMdisk source (MIT) | https://github.com/simonowen/samdisk — `include/SAMCoupe.h`, `src/SAMCoupe.cpp`, `src/cmd_dir.cpp`, `src/types/{mgt,sad,sbt,sdf}.cpp` |
| MAME | `src/mame/samcoupe/samcoupe.cpp` (GPL-2.0+), `src/devices/bus/samcoupe/` (drive, Atom, expansion), `src/lib/formats/coupe_{mgt,sad,sdf}.cpp` (BSD-3-Clause), `hash/samcoupe_flop.xml` |
| Simon Owen articles | https://simonowen.com/sam/articles/ ; https://simonowen.com/sam/timings |
| pyz80 / z88dk | https://github.com/simonowen/pyz80 ; https://github.com/z88dk/z88dk (`lib/config/sam.cfg`, `lib/target/sam/classic/`, `src/appmake/mgt.c`) |

---

## Open questions

1. **OQ1 ROM bundling permission** — *settled 2026-11-20 by the 2008 grant above (§2.3); confirm its
   wording in the Red Hat archive.* The original question: is Andy Wright's permission (worldofsam 2006, SimCoupé credit)
   enough to bundle ROM 3.0/3.1 in Klive's installer? Who, if anyone, holds MGT's residual rights
   (the worldofsam "MGT" entry is empty)? Ask Wright directly; ask Simon Owen for the wording of
   SimCoupé's permission.
2. **OQ2 SAMDOS**: no permission from Bruce Gordon/MGT found, though SimCoupé and z88dk ship SAMDOS
   2.2. Bundle, ask, or write Klive's own minimal boot loader? Also: SAMDOS 1 vs 2 differences.
3. **OQ3 ROM changelog**: what changed in each version (1.2–2.5); fetch the worldofsam table
   (node/430) when its certificate is fixed. Is 3.1 a real MGT release or a later re-dump?
   SimCoupé labels its 3.1 image "v3.0".
4. **OQ4 Memory after boot**: exact LMPR/HMPR values under BASIC, where PROG starts on a fresh
   256K/512K machine with and without DOS, and which pages are free (ALLOCT dump after boot from a
   real run of the ROM in Klive's core will settle it).
5. **OQ5 Token table**: the SAM BASIC keyword/function token list (85h–FEh, FFh+3Bh–83h) is not in
   a public document found; it must be derived from the ROM's tables or the BASIC guide.
6. **OQ6 Provenance of names**: sys-var and routine names should come from MGT's tech manual; the
   SimCoupé `samrom.map` (GPL project) adds names not in the manual — decide whether listing names
   from it is acceptable.
7. **OQ7 SAD layout**: MAME stores SAD data side-major; confirm against SAMdisk `sad.cpp` and real
   files (and the 82-track and non-512-byte variants).
8. **OQ8 Trinity**: port map and SD protocol for emulation; B-DOS 1.5t driver behaviour.
9. **OQ9 SD today**: is there an esxDOS/DivSD-type interface for the SAM in current use
   (esxdos.samcoupe.cz), and what does it need from an emulator?
10. **OQ10 TASM / other assemblers**: any SAM-specific output in TASM or other cross-assemblers.
11. **OQ11 Printer port**: confirm 0xE8–0xEB (SimCoupé) vs the tech manual's OCR "246 and 248".
12. **OQ12 Hook numbering**: unofficial manual's HGFLE 154/&9E and HRSAD 155/&A0 vs tech manual
    158/160; and whether PCAT is 165.
13. **OQ13 Élite / ROM 3.5**: is a 3.5 dump available and does anything require it? "DISK" vs
    "DISC" spelling.
