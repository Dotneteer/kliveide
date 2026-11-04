# Enterprise 64/128 — Storage, Firmware, OS and Software Ecosystem

Research notes for a future Enterprise 64/128 emulator in Klive IDE. Scope: everything except the
internals of the NICK (video) and DAVE (sound/memory/interrupt) chips, which are touched only where
storage and firmware depend on them.

Conventions: *inference* marks a conclusion of this note rather than a statement of a source.
"Disagreement" marks places where sources differ. Emulator code is cited as file + function, and
described in prose, not quoted.

---

## 1. Model history and variants

| Item | Facts | Source |
|---|---|---|
| Developer | Intelligent Software (David Levy's company), commissioned via the Hong Kong trading company Locumals after the ZX Spectrum's launch. Marketed by Enterprise Computers Ltd. | https://en.wikipedia.org/wiki/Enterprise_(computer) |
| Code names | Project name "DPC" (damp-proof course, to mislead competitors); public names along the way: Samurai, Oscar, **Elan** (dropped after a complaint from Elan Digital Systems), **Flan**, then Enterprise. DPC survives in the name of the sound chip doc ("DPC Sound Chip") on ep128.hu. | Wikipedia (above); https://ep128.hu/Ep_Konyv/EP_Books.htm |
| "Oundle" | Not found in any source consulted. *Treat as unverified.* | — |
| Announcement / ship | Announced Sept 1983; ~80,000 pre-orders by the April 1984 launch; shipped 1985 (infobox: 23 June 1985). | Wikipedia |
| Production | Initial run of 80,000 believed to be the only one; no more than ~25,000 sold in the UK. Company collapsed by 1986. | Wikipedia |
| Models | **Enterprise 64** (64 KB RAM, EXOS 2.0, IS-BASIC 2.0) and **Enterprise 128** (128 KB, EXOS 2.1, IS-BASIC 2.1). The 128's extra 64 KB is in segments F8h–FBh. German **Mephisto PHC 64** (Hegener + Glaser) is an EP64 rebadge using the EP64 ROM. | Wikipedia; MAME `src/mame/enterprise/ep64.cpp` (ROM_START / driver table) https://raw.githubusercontent.com/mamedev/mame/master/src/mame/enterprise/ep64.cpp; ep128emu `installer/makecfg.cpp` configs (EP64 → exos20/basic20; EP128 → exos21/basic21) https://raw.githubusercontent.com/istvan-v/ep128emu/master/installer/makecfg.cpp |
| Hungary | A German subsidiary survived to 1997 and shipped remaining stock to Hungary and elsewhere; unsold EP128 stock was imported into Hungary from 1987 and sold until ~1992. Large active Hungarian community today (ep128.hu, enterpriseforever.com, Zozosoft). Videoton TVC is a *different*, simplified machine (no NICK/DAVE). | Wikipedia |
| Successor | PW360 (1986), not released. | Wikipedia |

### Physical I/O connectors

Edge connectors rather than sockets were used to save cost (Wikipedia). Items:

| Connector | Notes | Source |
|---|---|---|
| ROM cartridge slot | Cartridge address range = segments 04h–07h (MAME maps the cartridge at linear 0x010000–0x01FFFF, i.e. segment 4 onward). IS-BASIC shipped as a 16 KB cartridge. | MAME ep64.cpp `machine_start`, memory map; EXOS kernel spec (Hungarian) https://ep128.hu/Ep_Konyv/Exos.htm |
| Expansion edge connector | 66-pin (A1–A33/B1–B33), full Z80 bus incl. A0–A21 (22 bits = 4 MB), MREQ/IORQ/RD/WR/M1/RFSH, INT, NMI, WAIT, RESET, 1/4/8/14 MHz clocks, H/V sync, audio L/R in, +9 V. EXDOS plugs in here. | https://wiki.enterpriseforever.com/index.php?title=Expansion_Bus ; MAME `exdos.cpp` header |
| RGB, TV (RF) | Video outs. (Video is the NICK agent's topic.) | Wikipedia |
| 2 × control (joystick) ports | External joysticks read through the keyboard matrix. | Wikipedia; MAME ep64.cpp port B6h |
| Serial / NET | One RS-232/RS-423-like port, also used for the EXOS network. | Exos.htm |
| Centronics printer | Data on port B6h write, STROBE on B5h bit 4. | Exos.htm; MAME ep64.cpp |
| Cassette ×2 | Two cassette interfaces, each with a REMOTE relay (REM1/REM2). One audio in, output shared. | Exos.htm; MAME ep64.cpp |
| Built-in joystick | Internal joystick next to the keyboard. | Exos.htm (KEYBOARD @@JOY special function) |

---

## 2. Firmware

### 2.1 ROM inventory

| ROM | Size | Segment(s) normally used | Notes | Source |
|---|---|---|---|---|
| EXOS 1.0 | ? | 00h–01h | Early version; a technical-information PDF exists. Clock Signal's loader tries EXOS 1.0 first. | https://ep128.hu/Ep_Konyv/EP_Books.htm ; CLK `Machines/Enterprise/Enterprise.cpp` constructor |
| EXOS 2.0 (EP64) | 32 KB | 00h–01h | Internal ROM = EXOS kernel + built-in word processor. MAME ep64 ROM `9256ds-0038_enter05-23-a.u2`, CRC d421795f. MD5 of the community dump `exos20.rom`: 5ad3baaa…6fb. | MAME ep64.cpp; https://wiki.batocera.org/systems:enterprise |
| EXOS 2.1 (EP128) | 32 KB | 00h–01h | MAME ep128 ROM `9256ds-0019_enter08-45-a.u2`, CRC 982a3b44. `exos21.rom` MD5 f36f24cb…db09. **The standard target.** | MAME ep64.cpp; Batocera wiki |
| EXOS 2.2 / 2.3 / 2.31 / 2.32 / 2.4 | 64 KB | 00h–03h | **Unofficial** versions by Zozosoft (Hungary). 2.2: fast RAM test. 2.3: fixes the 2.0/2.1 ROM-registration bug, scans *every* segment for extension ROMs, reset-time key options (test modes, keep RAMDISK, etc.), bad-RAM detection, Super WP in segment 02h, IS-BASIC moved into segment 03h. 2.31: WP 80-column fix, RAM-test tweaks. 2.4: exists as `exos24uk/hu/brd/es.rom`; no changelog found. | https://wiki.enterpriseforever.com/index.php?title=Unofficial_EXOS_versions_by_Zozosoft ; makecfg.cpp |
| IS-BASIC 2.0 / 2.1 | 16 KB | 04h (cartridge) | `basic21.rom` MD5 e972fe42…aec6. CLK also knows BASIC 1.0 (in two 8 KB halves) and 1.1. | Batocera; CLK Enterprise.cpp |
| Word processor | inside EXOS | 00h–01h | The internal ROM's fallback application when no ROM claims control at boot. | Exos.htm (cold start); Wikipedia |
| Language ROMs | 16 KB | 04h/07h/43h (config-dependent) | `hun.rom` (Hungarian), `brd.rom` (German, "BRD"), `esp.rom` (Spanish). They are EXOS extensions loaded beside a standard EXOS (keyboard layout/messages), not separate EXOS builds — *inference from config layout*. | makecfg.cpp; Batocera |
| EXDOS 1.0 / 1.3 / 1.4 | 16–32 KB | 20h (–21h) | Disk ROM. MAME: `exdos13.rom` 32 KB, CRC d1d7e157, mapped at linear 0x080000 (segment 20h). ep128emu: `exdos10` (16 KB) for EP64, `exdos14isdos10uk` (32 KB, EXDOS 1.4 + IS-DOS 1.0) for EP128. | MAME `src/devices/bus/ep64/exdos.cpp` https://raw.githubusercontent.com/mamedev/mame/master/src/devices/bus/ep64/exdos.cpp ; makecfg.cpp |
| epfileio.rom | 16 KB | 10h | Emulator-only "FILE:" device (host directory). Not real hardware. | https://www.ep128.hu/Ep_Emulator_eng.htm ; ep128emu README |
| Others (community) | — | various | ASMON 1.5 (TASMON, 04h–05h), EPDOS 1.7/1.9 (06h–07h), HEASS assembler (12h–13h), FENAS (22h–23h), ZozoTools 1.9 (40h–41h; needed for .DTF), ZX Spectrum emulator `zx41` (30h–31h), IVIEW (30h–31h), GENMON, Lisp (11h), Forth (42h), Pascal 1.2 (43h), IDE driver `ide12` (42h), SD card `sdext05` (07h), EP-PLUS. | makecfg.cpp |

**Segment-placement rule**: the original EXOS scans for extension ROMs only at 256 KB boundaries
(segments that are multiples of 16: 00h, 10h, 20h, 30h…) plus all four cartridge segments 04h–07h,
which is why community ROMs live at 10h, 20h, 30h, 40h. ep128emu's README lists the ROM-able ranges
as 0–7, 16–19, 32–35, 48–51, 64–67. Sources: Exos.htm (cold start section);
https://raw.githubusercontent.com/istvan-v/ep128emu/master/README

### 2.2 Default configurations worth reproducing

From ep128emu `installer/makecfg.cpp` (UK directory):

| Config | RAM | Segment map |
|---|---|---|
| EP_64k_Tape | 64 K | exos20 → 00,01; basic20 → 04 |
| EP_64k_EXDOS | 64 K | + exdos10 → 20 |
| EP_128k_Tape | 128 K | exos21 → 00,01; basic21 → 04 |
| EP_128k_Tape_FileIO | 128 K | + epfileio → 10 |
| EP_128k_EXDOS | 128 K | exos21 → 00,01; basic21 → 04; exdos14isdos10uk → 20,21 |
| EP_128k_EXDOS_NoCartridge | 128 K | no BASIC: boots into the WP |
| EP_640k_EXOS232_IDE_utils | 640 K | exos232 → 00–03; … ide12 → 42 |
| EP_640k_EXOS24_SDEXT_utils | 640 K | exos24 → 00–03; sdext05 → 07 (SDEXT flag) |

RAM is always allocated from the top downward: 64 K = FCh–FFh, 128 K = F8h–FFh, 256 K = F0h–FFh
(CLK `Enterprise.cpp` `MinRAMSlot`; ep128emu `epmemcfg.cpp` `Ep128VM::resetMemoryConfiguration`,
which clamps RAM to 4–232 segments). The top four segments (FCh–FFh) are the video RAM.

Clock Signal places ROMs differently (EXOS 00–03, BASIC 10h, EXDOS 20h, EPDOS 30h, host-FS 40h) —
any placement on a scanned boundary works (CLK `Enterprise.cpp`, `rom_segment`).

### 2.3 Licensing and where ROMs come from

- No explicit public permission from Intelligent Software / Enterprise Computers (or a successor
  rights holder) to redistribute EXOS/IS-BASIC was found. ep128emu's copyright page covers only the
  emulator's GPL code: https://ep128emu.sourceforge.net/html/copyright.html
- In practice ROMs are distributed by the community: the ep128emu ROM pack
  `ep128emu_roms-2.0.11.bin/.zip` is downloaded by `epmakecfg` from `http://ep128.hu/Emu/ep128emu_roms-2.0.11.bin`
  with a fallback on enterpriseforever.com (makecfg.cpp); the libretro ep128emu-core embeds default
  ROMs ("built in, no need to download separately") https://github.com/libretro/ep128emu-core ;
  MAME expects `ep64.zip`, `ep128.zip`, `ep64_exdos.zip`.
- *Inference / recommendation*: Klive should not bundle the Intelligent Software ROMs; ask the user
  for `exos21.rom` + `basic21.rom` (and optional `exdos13/14.rom`), validated by MD5 (Batocera list).
  The community-written ROMs (Zozosoft's EXOS 2.3+, ZozoTools, SDEXT ROM) still contain the original
  EXOS code, so they are no freer. Klive's own trap ROM (see §5.4) can be written from scratch and
  shipped.

---

## 3. EXOS architecture

Primary source: the EXOS 2.1 technical specification (Hungarian translation, ~390 KB HTML):
https://ep128.hu/Ep_Konyv/Exos.htm . English originals: `EXOS10_Technical_Information.pdf`,
`EXOS20_Technical_Information.pdf` on https://ep128.hu/Ep_Konyv/EP_Books.htm .

### 3.1 Memory model

- 4 MB address space in 256 × 16 KB **segments**, mapped into the Z80's four 16 KB **pages** by
  DAVE page registers (ports B0h–B3h; DAVE agent's topic).
- Segments 00h–07h: internal ROM (00–03) and cartridge (04–07). Not RAM-tested.
- Segments FCh–FFh: the internal 64 KB video RAM (slower, NICK-synchronised).
- **FFh = system segment**: EXOS variables, system stack, channel RAM. Always allocated. Mapped in
  page 2 during EXOS calls.
- **Null (zero) segment**: the segment always mapped in page 0 for the user; holds entry points.
- Fixed system-segment addresses (in page 2 view, BFxxh): USR_P0–P3 (BFFCh–BFFFh, the page
  registers saved on EXOS entry), STACK_LIMIT (BFFAh), RST_ADDR warm-restart address (BFF8h),
  ST_POINTER status line (BFF6h), LP_POINTER line-parameter table (BFF4h), PORTB5 shadow (BFF3h),
  FLAG_SOFT_IRQ (BFF2h), SEC_COUNTER (BFF0h), CRDISP_FLAG (BFEEh: suppress boot banner), USER_ISR
  (BFEDh). (Exos.htm, section on the system segment. Disagreement: the Hungarian text lists
  CR_DISP and USER_ISR with overlapping byte addresses; verify against the English PDF.)

### 3.2 Null page (0000h–00FFh)

| Address | Use |
|---|---|
| 0000h | CP/M emulation, reserved |
| 0008h–0028h | free RST vectors |
| 0030h | **EXOS call (RST 30h)**; 0030h–005Bh is EXOS's handler, do not touch except the software-interrupt address at 003Dh/003Eh |
| 0038h | interrupt entry (IM 1) |
| 005Ch–0067h | CP/M emulation |
| 0068h | default FCB |
| 0080h–00FFh | default buffer |
| 0100h | user program load address |

Source: Exos.htm (null-page table).

### 3.3 Calling convention and function codes

`RST 30h` followed by an inline function byte. Parameters in A (usually channel), BC, DE. Result: A = status (0 = OK, else error code); HL, IX, IY and alternates preserved (Exos.htm §4.1).
CLK `Machines/Enterprise/EXOSCodes.hpp` enumerates the same codes.

| Code | Function | Code | Function |
|---|---|---|---|
| 0 | System reset (C = flags: 10h channels/devices, 20h + ROM rescan, 40h free user segments, 80h cold) | 16 (10h) | Read/write/toggle EXOS variable |
| 1 | Open channel (A = channel, DE → name) | 17 | Capture channel |
| 2 | Create channel | 18 | Redirect channel |
| 3 | Close channel | 19 | Set default device name |
| 4 | Destroy channel | 20 | Return system status |
| 5 | Read character | 21 | Link (add) device |
| 6 | Read block | 22 | Read EXOS boundary |
| 7 | Write character | 23 | Set user boundary |
| 8 | Write block | 24 | Allocate segment |
| 9 | Read channel status | 25 | Free segment |
| 10 | Set/read channel status (position, size, protection) | 26 | Locate (scan) ROMs |
| 11 | Special function | 27 | Allocate channel buffer (devices only) |
| | | 28 | Return error message text |
| | | 29 | Load module |
| | | 30 | Load relocatable module |
| | | 31–34 | Set time / read time / set date / read date |

Error codes (CLK EXOSCodes.hpp, `Error`): FFh invalid function … F9h channel exists, FBh illegal
channel, FAh device does not exist, F5h no free segments, EFh invalid file header, EEh unknown
module type, EDh invalid relocatable module, ECh no module (normal EOF of a module file), EAh invalid
special function, E9h second channel, E7h not supported, E5h STOP pressed, E4h EOF in read, E3h
protection violation. (CLK's enum leaves "invalid time/date" without an explicit value so it collides
with EDh — *inference*: the real value is probably EBh; check the English PDF.)

### 3.4 Channels and devices

- Channels are one-byte numbers; 255 means "default channel" (EXOS variable 4, DEF_CHAN). The device
  sees channel+1, so it never receives 0.
- Names: `DEVICE:filename` (≤28 uppercase characters, length-prefixed). Unit numbers (`TAPE1:`)
  are passed in C if the descriptor allows units. DEF_TYPE (variable 3) says whether the default
  device is file-based (disk) or not (tape).
- Device descriptor (linked list): 24-bit next pointer, type (0), IRQ flag mask, flags (bit 0 =
  video device), 24-bit pointer to entry table, unit count, name. Entry table offsets: +0 interrupt,
  +2 open, +4 create, +6 close, +8 destroy, +10 read char, +12 read block, +14 write char, +16 write
  block, +18 read status, +20 set status, +22 special, +24 init, +26 buffer moved.
- Built-in devices: VIDEO:, KEYBOARD:, EDITOR:, SOUND:, PRINTER:, SERIAL:, NET:, TAPE:. Disk (DISK:/A:)
  comes from EXDOS; FILE: from epfileio.

Source: Exos.htm §6 (device descriptors) and §11; CLK HostFSHandler.cpp.

### 3.5 EXOS variables (numbers)

0 IRQ_ENABLE_STATE, 1 FLAG_SOFT_IRQ, 2 CODE_SOFT_IRQ, 3 DEF_TYPE, 4 DEF_CHAN, 5 TIMER, 6 LOCK_KEY,
7 CLICK_KEY, 8 STOP_IRQ, 9 KEY_IRQ, 10 RATE_KEY, 11 DELAY_KEY, 12 TAPE_SND, 13 WAIT_SND, 14 MUTE_SND,
15 BUF_SND, 16 BAUD_SER, 17 FORM_SER, 18 ADDR_NET, 19 NET_IRQ, 20 CHAN_NET, 21 MACH_NET, 22 MODE_VID,
23 COLR_VID, 24 X_SIZ_VID, 25 Y_SIZ_VID, 26 ST_FLAG, 27 BORD_VID, 28 BIAS_VID, 29 VID_EDIT,
30 KEY_EDIT, 31 BUF_EDIT, 32 FLG_EDIT, 33 SP_TAPE, 34 PROTECT, 35 LV_TAPE, 36 REM1, 37 REM2,
38 SPRITE, 39 RANDOM_IRQ. ≥127 reserved for extension ROMs (e.g. EnterMice driver uses 180–190).
Source: Exos.htm; https://wiki.enterpriseforever.com/index.php?title=EnterMice

### 3.6 Boot sequence (cold reset)

1. Checksum the internal 32 KB ROM.
2. RAM test: write-test every segment except 00h–07h; passing segments go into the RAM list
   (destructive).
3. ROM scan: look for the 8-byte ASCII signature `EXOS_ROM` at offset 0 of segments on 256 KB
   boundaries and all four cartridge segments; duplicates in the cartridge slot are ignored. After
   the signature: a 16-bit pointer to the ROM's device chain (0 = none), then the entry point at
   offset 0Ah (EXDOS's layout: 08h word, 0Ah JP entry).
4. Action 7 to every ROM (RAM allocation request; failing ROMs are disabled).
5. Build system variables and null-page entry points; initialise built-in and ROM devices; action 8
   (initialise) to every ROM.
6. Show the flashing "ENTERPRISE" banner + copyright until a key is pressed (unless a ROM set
   CRDISP_FLAG).
7. Action 1 (cold start) to every ROM; a ROM that wants control (IS-BASIC, EXDOS's CLI…) starts
   itself as the current application. If none, the built-in **word processor** runs.

**Warm reset** (RESET key with a valid RST_ADDR): skip RAM test and ROM scan, keep user RAM, close
channels, re-init devices, clear RST_ADDR then jump to it (so a double reset forces a cold start).
Interrupt vectors must be reinstalled by the program.

**ROM extension action codes** (passed in C to the entry point): 0 none, 1 cold reset, 2 user command
string (`:DIR`, `:HELP`…), 3 help string, 4 unknown EXOS variable, 5 explain error code, 6 load
module of unknown type, 7 RAM allocation, 8 initialise.

Source: Exos.htm (cold start, §9 ROM expansions); EXDOS spec excerpt
https://wiki.enterpriseforever.com/index.php?title=English_to_English_-_PDF2TEXT_-_EXDOS_System_Specifications_(early)

### 3.7 Module (file) format and program start

Every EXOS loadable file begins with a **16-byte header**:

| Offset | Meaning |
|---|---|
| 0 | 00h (non-zero ⇒ treated as an ASCII file) |
| 1 | module type |
| 2–14 | type-specific (types 5/6/7: bytes 2–3 = length, little-endian) |
| 15 | format version, 0 |

| Type | Name | Meaning |
|---|---|---|
| 0 | — | ASCII |
| 2 | $$REL | relocatable user module (2–3 size, 4–5 init offset or FFFFh) |
| 3 | $$XBAS | multi-program BASIC |
| 4 | $$BAS | single IS-BASIC program (loaded by IS-BASIC via action 6) |
| 5 | $$APP | **new application program** — loaded at 0100h, max ~47.75 KB (0100h–BFFFh) |
| 6 | $$XABS | absolute system extension, loaded at C00Ah which is also the entry (`.EXT` files) |
| 7 | $$XREL | relocatable system extension, loaded into a page-3 segment |
| 8 | $$EDIT | word-processor document |
| 9 | $$LISP | Lisp image |
| 10 | $$EOF | end-of-file module (function 29 returns "no module") |

Starting a type-5 program (`LOAD "x.com"` from BASIC, or `:LOAD`): EXOS reads the body to 0100h,
performs a reset with flags 20h (I/O and ROMs re-initialised, user RAM kept), builds a user stack in
the null segment, allocates segments, opens default channels, sets RST_ADDR, then jumps to 0100h.
EXOS loads a file module after module until $$EOF / no-module.
Source: Exos.htm (§10 and function 29 description).

Klive-relevant sanity checks used by Clock Signal's analyser: first two bytes `00 05` (COM) or
`00 04` (BAS), and the length word ≤ file length − 16 (CLK
`Analyser/Static/Enterprise/StaticAnalyser.cpp`).

### 3.8 Built-in device drivers (summary)

| Device | Key facts (Exos.htm) |
|---|---|
| KEYBOARD: | 10-row matrix scanned 50×/s; 16 programmable function-key strings (≤23 chars); auto-repeat DELAY_KEY/RATE_KEY; special @@JOY (9): C = 0 internal, 1/2 external, result bits R/L/D/U/fire. |
| VIDEO: | text/graphics pages allocated in video segments; variables 22–28. (NICK agent.) |
| EDITOR: | sits on a VIDEO and KEYBOARD channel; buffer 256 × BUF_EDIT; FLG_EDIT read-control flags. IS-BASIC and the WP use it. |
| SOUND: | 3 tone + 1 noise channel, 25-entry queues, envelopes 0–254 (≤40 phases), 20 ms ticks; ESC E / ESC S / ESC Z escape sequences. |
| PRINTER: | Centronics, data on B6h, strobe B5h bit 4, ready bit on B6h bit 3 (MAME: "BUSY" on B6h bit 3; one Hungarian passage puts READY on B5h — **disagreement**, MAME's is from hardware). |
| SERIAL: | bit-banged: DATA OUT/STATUS OUT = port B7h bits 0/1, DATA IN/STATUS IN = B6h bits 4/5; BAUD_SER 0–15 (50…9600); FORM_SER bits (7/8 data, parity, stop bits); 16-char receive buffer. |
| NET: | shares the serial lines; addresses 1–32, 0 = broadcast; 256-byte send/receive buffers per channel; same CRC as tape; software IRQ 30h on arrival. |
| TAPE: | see §4. |

---

## 4. Tape

### 4.1 EXOS signal format

From the TAPE driver chapter of Exos.htm (values in µs are half-period/period lengths as given;
*inference*: the document's "ms" column is µs):

| Signal | Fast (2400 baud nominal) | Slow (1000 baud nominal) |
|---|---|---|
| Lead-in tone | 2358 Hz (424 µs) | 1000 Hz (1000 µs) |
| "1" bit | 2907 Hz (344 µs) | 1250 Hz (800 µs) |
| "0" bit | 1984 Hz (504 µs) | 883 Hz (1200 µs) |
| Sync bit | 1437 Hz (696 µs) | 625 Hz (1600 µs) |

- Speed for writing: SP_TAPE (variable 33) = 0 fast, ≠0 slow. Reading auto-detects from the lead-in.
- Bytes: 8 bits, **LSB first, no start/stop bits** — each bit is one full cycle of the given
  frequency.
- **Chunk** = lead-in, sync, a blank byte, the marker byte **6Ah**, chunk data, trailer tone. The
  motor (REM relay) stops between chunks. Chunk data: a block-count byte (0–16), then up to 16
  **blocks of 256 bytes**, each preceded by a length byte (0 = 256) and followed by a **16-bit CRC**.
  So a chunk carries ≤4 KB; write channels need 4 KB of RAM.
- **Header** chunk: block number 255, one short block holding the PROTECT byte, a name-length byte and
  the file name (0–28 chars).
- **CRC-16**: init 0; per bit, XOR the data bit with the CRC's top bit and if 1, XOR with 0810h;
  shift left (i.e. the CCITT polynomial x¹⁶+x¹²+x⁵+1 in its 0x1021 form expressed as "XOR 0810h
  then shift" — *inference*). The network uses the same CRC.
- Output level LV_TAPE (variable 35): 20/40/80/170/350/700 mV; TAPE_SND (12) monitors tape sound;
  PROTECT (34) marks a file write-protected.
- Hardware: tape data in = port B6h bit 7, level in = B6h bit 6, REM1 = B5h bit 6, REM2 = B5h bit 7,
  B5h bit 5 = tape-sound/coupling. Tape output comes from DAVE's left D/A (MAME ep64.cpp: cassette
  output driven from `lh_wr`).
- Only one read and one write tape channel at a time; unit 0/1 → relay 1, other units → relay 2.

### 4.2 Tape image formats

| Format | Ext | Structure | Who reads it |
|---|---|---|---|
| **ep128emu native** | .tap | 4096-byte header of big-endian 32-bit words: word 0 = 0275CD72h, word 1 = 1C445126h, word 2 = bits/sample (1/2/4/8), word 3 = sample rate (10 000–120 000), words 4–1022 = sorted cue-point sample positions (FFFFFFFFh unused, max 1019), word 1023 = FFFFFFFFh. Then packed PCM samples, MSB-first, in 4096-sample blocks. Headerless files are read as raw 1-bit samples. **Sample-level, not decoded.** | ep128emu `src/tape.cpp` `Tape_Ep128Emu` (`readBuffer_`, `packSamples_`, `addCuePoint`); MAME `src/lib/formats/ep64_tap.cpp` |
| **EPTE / TAPir** | .tap | Magic `ENTERPRISE 128K TAPE FILE       ` (32 bytes) at offset 128; table of 128 LE 32-bit chunk offsets at offset 0; **decoded bytes** from offset 512; the emulator synthesises the waveform (sync pulse, LSB-first half-period-coded bits, 5 s leader). Read-only. | ep128emu `tape.cpp` `Tape_EPTE::runOneSample_`; libretro README ("tap in ep128emu, tapir, or epte format") |
| WAV/AIFF etc. | .wav | Any libsndfile format, 10–120 kHz; ep128emu applies a 2048-tap FFT band-pass filter. | `tape.cpp` `Tape_SoundFile`, `TapeFilter` |
| (ZX TZX/TAP, CPC CDT) | | Other machines in ep128emu; not Enterprise. | `tape.cpp` `Tape_TZX` |

Same extension, two incompatible ".tap" formats: detect by the ep128emu magic words first, then the
EPTE string at offset 128 (ep128emu `openTapeFile` order: TZX, EPTE, sound file, native).

### 4.3 Fast / instant loading

- ep128emu has **no tape trap**; fast loading is "run the emulator at full speed while the motor
  relay is on" (`ep128vm.cpp`: `tapeCallback` only feeds `runTape()` into DAVE while the remote is on).
- Instant loading is done instead with the **FILE: device** (§5.4): `LOAD "FILE:game.com"` reads host
  files directly. Most of the community library is distributed as loose files (.com/.bas/.prg/.scr)
  or disk images, not tapes (ep128.hu emulator page).
- *Recommendation*: for Klive, implement (1) a FILE:-style trap ROM for instant loads and
  (2) EPTE/TAPir → synthesised waveform, and ep128emu .tap playback with "fast-forward while motor
  on". A Klive tape-file *writer* can generate EXOS chunks from a host file (header chunk + 4 KB
  chunks with CRC) — useful for testing.

---

## 5. Disk and mass storage

### 5.1 EXDOS interface (floppy)

- Card by Intelligent Software on the expansion connector; **WD1770** (8 MHz) FDC; up to 4 drives
  (34-way Shugart cable). MAME `src/devices/bus/ep64/exdos.cpp`; ep128emu `ep128vm.cpp`
  (`exdosPortReadCallback`, `setIsWD1773(false)` = WD1770 behaviour). The Hungarian scene often calls
  it WD1772 (datasheet on ep128.hu) — differences are step rates only (*inference*).
- **Ports** (decoding differs slightly between emulators):

| Port | Read | Write |
|---|---|---|
| 10h | WD status | WD command |
| 11h | track | track |
| 12h | sector | sector |
| 13h | data | data |
| 14h–17h | mirror of 10h–13h | mirror |
| 18h (1Ch mirror) | bit 1 INTRQ, bit 6 DCHG (1 = no disk change pending / no drive), bit 7 DRQ; others 0 | bits 0–3 drive select 0–3, bit 4 side, bit 5 /DDEN, bit 6 clear disk-change, bit 7 "in use" LED |

MAME decodes 10h–13h + 18h with bit 2 mirrored; CLK maps 10h–17h → FDC and 18h–1Fh → control
(`Enterprise.cpp`, port handlers); ep128emu uses address bit 3 to select the control register.
ep128emu also reports bit 0 = "not ready" in the status composite — **disagreement** with MAME.

- **Disk format**: MS-DOS-compatible **FAT12**, 40/80 tracks, SS/DS, 8/9 sectors/track (EXDOS also
  handles 10; track limit 254; 720 KB 3.5" DD standard; 840 KB extra-track variants common)
  — Zozosoft on https://hxc2001.com/floppy/forum/viewtopic.php?p=8078 . MAME's `ep64_dsk.cpp`
  registers one geometry: 80×2×9×512 = 737 280 bytes (.img).
- `EXDOS.INI` in the root runs at every restart (auto-boot); `.BAT` files hold EXDOS commands
  (https://wiki.enterpriseforever.com/index.php?title=File_Extensions_as_shown_on_ep128.hu). CLK's
  analyser: if EXDOS.INI exists, type nothing; if exactly one .COM/.BAS, type `run "NAME.EXT"`;
  else `:dir` (CLK StaticAnalyser.cpp).
- EXDOS ROM structure: `EXOS_ROM` signature; 08h word 0; 0Ah JP system-extension entry (init + CLI);
  0Dh JP DISKIO (raw hardware access); 10h JP FISH (filing-system handler, used by IS-DOS). Needs
  ~2.5–3 KB system-segment RAM incl. three 512-byte sector buffers (EXDOS spec excerpt, link in §3.6).
- **IS-DOS**: CP/M-2.2-compatible DOS (MSX-DOS-like) running over EXDOS's FISH; ships combined with
  EXDOS 1.4 in `exdos14isdos10uk.rom`. Manual: https://ep128.hu/Ep_Konyv/ISDOS_English.pdf

### 5.2 Disk image formats

| Ext | Content |
|---|---|
| .img / .dsk | Raw sector dump (FAT12), 720 KB typical; geometry from size/BPB. ep128emu allows zero/negative geometry parameters for auto-detection (README). |
| .vhd / .img | Hard-disk images for IDE and SD (raw or fixed VHD with "conectix" footer). ep128emu `ide.cpp` `checkVHDImage`; libretro uses FAT12 media byte F8h to auto-select an IDE/hard-disk configuration. |
| .hfe | HxC floppy emulator hardware images (real-hardware use). |

### 5.3 Modern storage and peripherals

| Device | Interface | Emulator notes | Priority for Klive |
|---|---|---|---|
| **SD card cartridge ("SDEXT")** | Cartridge slot, segment 07h: 0000–1FFFh = 8 KB window into 64 KB flash (8 pages), 2000–3BFFh = 7 KB SRAM, 3C00–3FFFh = registers (+0 SPI data, +1 control/status: CS bits, write-protect, no-card, changed; +2 flash page (bits 7–5); +3 high-speed read). SPI SD card, byte-addressed (SDSC-like) in ep128emu. ROM `sdext05.rom`. | ep128emu `src/sdext.cpp` (`readCartP3`, `writeCartP3`, `_spi_shifting_with_sd_card`), code derived from LGB's Xep128 | 2nd tier: the standard way real owners load software today |
| **IDE interface** | Ports ECh–EFh: +0/+1 16-bit data latch lo/hi, +2/+3 command/control for two IDE ports; 4 drives; LBA+CHS; driver ROM `ide12.rom` (seg 42h) | ep128emu `src/ide.cpp` (`IDEInterface::readPort`), `ep128vm.cpp` (`ideDriveIOReadCallback`) | 3rd tier |
| **RTC / CMOS** | Ports 7Eh (register select) / 7Fh (data); 64-byte MC146818-style; reg 0Ah update, 0Bh 12/24h & BCD/binary | ep128emu `ep128vm.cpp` `cmosMemoryIOReadCallback`, `updateRTC` | Easy, 2nd tier |
| **EnterMice / mouse** | Uses Control 1/2 + serial edge connectors; MSX/Neos nibble protocol: write B7h (RTS toggle 2/0), read nibbles on B6h (K column bit 1), selected via B5h row; driver `MOUSE.XR` (EXOS vars 180–190) | https://wiki.enterpriseforever.com/index.php?title=EnterMice ; ep128emu `ep128vm.cpp` `mouseRTSWriteCallback` | 3rd tier |
| **RAM expansions** | Up to 4 MB (segments down from FFh); ep128emu up to 3712 KB (232 segments) | `epmemcfg.cpp` | Cheap to support (configurable RAM size) |
| EP-NET (Wiznet W5300), APU (Am9511), Z180 accelerator, MIDI, SID, Dream Turbo Card (10 MHz) | various | Xemu `targets/ep128/` (epnet.c, apu.c, z180.c) https://github.com/lgblgblgb/xemu/tree/master/targets/ep128 ; wiki pages | Not needed |

**Suggested order for Klive**: (1) EXOS 2.1 + IS-BASIC 2.1, 128 KB; (2) FILE:-device trap ROM
(instant .com/.bas loading, and save); (3) tape (EPTE + ep128emu .tap + WAV) with motor-driven
fast-forward; (4) EXDOS + WD1770 + 720 KB .img; (5) RTC; (6) SDEXT; (7) IDE, mouse.

### 5.4 Host file access trap (FILE: device) — how emulators do it

- **ep128emu**: `epfileio.rom` is an EXOS extension at segment 10h registering device `FILE`. Its
  driver entry points execute the undocumented opcode sequence **`ED FE FE nn`**; the emulator
  (`ep128vm.cpp`, `Ep128VM::Z80_::tapePatch`) checks that PC is in a ROM segment, PC+2 = FEh and
  `nn` < 10h, then performs function `nn` with A = channel/status, BC/DE = parameters:
  0 interrupt, 1 open, 2 create, 3 close, 4 destroy, 5/6 read char/block, 7/8 write char/block,
  9 read status, 0Ah get/set position & size, 0Bh special (unsupported), 0Ch init (close all),
  0Dh buffer moved, 0Eh/0Fh get/set "FILE: is default device". Files are opened in one host working
  directory; channels in a map keyed by A. User memory is accessed through the saved page registers
  at BFFCh–BFFFh of the system segment. Commands: `LOAD "FILE:x.com"`, `:DEF_DEV_FILE`,
  `:DEF_DEV_DISK` (https://www.ep128.hu/Ep_Emulator_eng.htm).
- **Clock Signal**: same `ED FE FE nn` convention in a self-written ROM (`hostfs.z80`, transcribed
  into `HostFSHandler.cpp`) mapped at segment 40h; at startup `find_host_fs_hooks()` patches the
  trap sites to NOPs and records their addresses; an opcode fetch at a recorded address calls
  `HostFSHandler::perform` (A/BC/DE in/out). An empty file name maps to the bundle's "key file".
  Auto-start types `run "file:"` + Enter after skipping the banner by injecting Space (CLK
  `Enterprise.cpp` `type_string`, `perform_machine_cycle`; `StaticAnalyser.cpp`).
- *Recommendation*: Klive can write its own MIT/own-licence EXOS extension ROM using the same idea
  (any spare opcode as the trap), so ROM provenance is clean.

---

## 6. File formats an emulator should load

| Ext | Structure | Load method |
|---|---|---|
| .com (also .trn, .128, no ext) | 16-byte EXOS header type 5 (`00 05 lenLo lenHi 00×12`) + body loaded at 0100h | FILE: trap or disk; or direct inject + jump (*inference*: must reproduce the EXOS start procedure, so trap-based loading through EXOS is safer) |
| .bas | 16-byte header type 4 + tokenised IS-BASIC program | `LOAD "FILE:x.bas"` / RUN; needs IS-BASIC |
| .ext / .rom (extension) | type 6 header (load at C00Ah) / raw 16 KB ROM image with `EXOS_ROM` signature | `:LOAD` / place in a scanned segment |
| .prg, .scr | headerless data loaded by a .com loader | FILE: / disk |
| .dtf, .tom, .pck | Compressed game files (DTF needs ZozoTools ROM `DL` command) | low priority |
| .tap | ep128emu sample tape or EPTE/TAPir decoded tape (§4.2) | tape |
| .wav | audio tape | tape |
| .img/.dsk | FAT12 floppy | EXDOS |
| .vhd/.img (large) | IDE/SD hard disk | IDE/SDEXT |
| .rom | 16 KB per segment ROM images (EXOS 32/64 KB, BASIC 16 KB, EXDOS 16/32 KB) | memory config |
| snapshots | ep128emu 2.x: 16-byte magic `5D 12 E4 F4 C9 DA B6 42 01 33 DE 07 D2 34 F2 22`, optional compression, then chunks (4-byte type, 4-byte length, payload, 4-byte hash); holds machine state, memory config and ROM images (fileio.cpp `File::writeFile`, README). Old ep128emu 1.x: 16-byte header `E128` magic, version 0101h/0102h, memory-config word (bits 0–7 ROM segments 0–7 present, bits 8–15 RAM segment count), 8 bytes padding (https://ep128emu.sourceforge.net/html/snapshot_header.html). Format is emulator-private and version-dependent; *inference*: low value for Klive. | — |

Full extension list with meanings: https://wiki.enterpriseforever.com/index.php?title=File_Extensions_as_shown_on_ep128.hu ;
libretro list: https://docs.libretro.com/library/ep128emu/ .

---

## 7. Programming reference

### 7.1 IS-BASIC

- ANSI-style structured BASIC by Intelligent Software (1984): multiple resident programs with separate
  line numbers and globals, `CHAIN` between them, DEF/HANDLER, turtle graphics, direct EXOS access
  (`OPEN #n:"device:"`, `SET`/`TOGGLE` EXOS variables, `:` prefix for extension commands like `:DIR`,
  `:HELP`). https://rosettacode.org/wiki/IS-BASIC ; Wikipedia.
- Programs are stored tokenised; file type 4 ($$BAS) or 3 ($$XBAS) headers (§3.7).
- **The token table and the in-memory line layout were not found in any public source reached.**
  See Open questions. *Approach*: derive them black-box by typing lines in the emulator and diffing
  memory (allowed — no ROM disassembly needed), or from the Hungarian books on ep128.hu.

### 7.2 Assembler conventions

- A `.com` is just header + code: `ORG 0F0h`, `DB 0,5`, `DW end-0100h`, 12 × `DB 0`, then code at
  0100h (*inference* from the header spec; any assembler with `ORG`/`DB`/`DW` works, so Klive's
  assembler can produce `.com` directly with a small output-format option).
- Community tools: ASMON/TASMON (ROM), HEASS and FENAS (native assemblers; source .HEA/.FEN), and on
  PC sjasm/sjasmplus/pasmo (*inference*: no single canonical PC assembler documented in sources).
- Programs talk to the OS only through `RST 30h` (§3.3) and must not touch 0030h–005Bh; IM 1
  interrupts arrive at 0038h with EXOS's handler; USER_ISR (BFEDh) hooks user code.

---

## 8. Test software for validating an emulator

| Item | Why | Source |
|---|---|---|
| EXOS boot banner → BASIC prompt; `NoCartridge` boot → WP | Exercises RAM test, ROM scan, action codes, VIDEO/EDITOR | §3.6 |
| EXOS 2.3+ built-in test modes (reset-time keys, TEST_ROM) | RAM/ROM tests | Zozosoft wiki page (§2.1) |
| IstvánV's demos (Bad Apple! 2020, FBScroll, Tunnel, Nyan, Scroll, Maze) | Written by ep128emu's author; NICK/DAVE timing-sensitive | https://ep128.hu/Ep_Demo/Demo_eng.htm |
| Zozosoft Interlace Demo 1–3, Zozolace | Interlace / LPT tricks | same |
| Ep128/Ep64 in-store demonstration programs (1984/85) | Official software, period-correct | same |
| Tape: the official demonstration cassette; virtual cassettes `Emu/Ep_Tape_files.rar` | Validates tape decoder | ep128.hu emulator page |
| Disks: `Emu/Disks_Games.rar`, `Disks_Demo.rar`, IS-DOS boot | EXDOS/WD1770 | ep128.hu emulator page |
| SymbOS, EDC Windows, Iview | Heavy EXOS + memory paging + mouse | EnterMice wiki page |
| ZX Spectrum emulator ROM (zx41) / SPEmu128 | NMI/port tricks, edge cases | makecfg.cpp; EnterMice page |

---

## 9. Best downloadable reference documents (fetch later)

| Document | URL |
|---|---|
| EXOS 2.0 Technical Information (Intelligent Software, 1984, English) | https://ep128.hu/Ep_Konyv/EXOS20_Technical_Information.pdf |
| EXOS 1.0 Technical Information | https://ep128.hu/Ep_Konyv/EXOS10_Technical_Information.pdf |
| EXOS 2.1 technical specification (Hungarian HTML, complete: kernel + all drivers) | https://ep128.hu/Ep_Konyv/Exos.htm |
| Enterprise Programming Guide (1984) | https://ep128.hu/Ep_Konyv/Enterprise_Programming_Guide.pdf |
| Enterprise Set Up Guide (1984) | https://ep128.hu/Ep_Konyv/Enterprise_Set_Up_Guide.pdf |
| IS-DOS 1.0 manual | https://ep128.hu/Ep_Konyv/ISDOS_English.pdf |
| Nick Chip Programmer's Guide | https://ep128.hu/Ep_Konyv/Technical_Documentation_Nick_Chip_Programmers_Guide.html |
| DPC (DAVE) Sound Chip | https://ep128.hu/Ep_Konyv/Technical_Documentation_DPC_Sound_Chip.html |
| WD1772 datasheet | https://ep128.hu/Ep_Konyv/WD1772-JLG.pdf |
| EXDOS System Specification (early, OCR text, partial) | https://wiki.enterpriseforever.com/index.php?title=English_to_English_-_PDF2TEXT_-_EXDOS_System_Specifications_(early) |
| IS-DOS (OCR text) | https://wiki.enterpriseforever.com/index.php?title=English_to_English_-_PDF2TEXT_-_English_ISDOS |
| Converting Spectrum programs (1984) | https://ep128.hu/Ep_Konyv/Converting_Spectrum_programs.txt |
| ep128emu manual (wiki) | https://wiki.enterpriseforever.com/index.php?title=EP128Emu_manual |
| ep128emu source (GPL) | https://github.com/istvan-v/ep128emu |
| Clock Signal source (MIT) — Enterprise | https://github.com/TomHarte/CLK/tree/master/Machines/Enterprise |
| MAME drivers | https://github.com/mamedev/mame/blob/master/src/mame/enterprise/ep64.cpp , https://github.com/mamedev/mame/blob/master/src/devices/bus/ep64/exdos.cpp |
| Xemu ep128 target (SDEXT, RTC, EP-NET) | https://github.com/lgblgblgb/xemu/tree/master/targets/ep128 |
| Book index (all of the above and more) | https://ep128.hu/Ep_Konyv/EP_Books.htm |

Licence note for Klive: MAME core files are mostly BSD-3/GPL; ep128emu and Xemu are GPL-2; CLK is
MIT. Read for facts, re-implement in Klive's own words (same spirit as the project's provenance
rules).

---

## Sources

- Wikipedia, Enterprise (computer): https://en.wikipedia.org/wiki/Enterprise_(computer)
- EXOS 2.1 technical specification, Hungarian: https://ep128.hu/Ep_Konyv/Exos.htm
- ep128.hu book index: https://ep128.hu/Ep_Konyv/EP_Books.htm
- ep128.hu emulator page: https://www.ep128.hu/Ep_Emulator_eng.htm
- ep128.hu demo list: https://ep128.hu/Ep_Demo/Demo_eng.htm
- ep128emu `src/tape.cpp`: https://raw.githubusercontent.com/istvan-v/ep128emu/master/src/tape.cpp
- ep128emu `src/ep128vm.cpp`: https://raw.githubusercontent.com/istvan-v/ep128emu/master/src/ep128vm.cpp
- ep128emu `src/epmemcfg.cpp`: https://raw.githubusercontent.com/istvan-v/ep128emu/master/src/epmemcfg.cpp
- ep128emu `src/fileio.cpp`: https://raw.githubusercontent.com/istvan-v/ep128emu/master/src/fileio.cpp
- ep128emu `src/sdext.cpp`: https://raw.githubusercontent.com/istvan-v/ep128emu/master/src/sdext.cpp
- ep128emu `src/ide.cpp`: https://raw.githubusercontent.com/istvan-v/ep128emu/master/src/ide.cpp
- ep128emu `installer/makecfg.cpp`: https://raw.githubusercontent.com/istvan-v/ep128emu/master/installer/makecfg.cpp
- ep128emu README: https://raw.githubusercontent.com/istvan-v/ep128emu/master/README
- ep128emu 1.x snapshot header: https://ep128emu.sourceforge.net/html/snapshot_header.html
- ep128emu copyright: https://ep128emu.sourceforge.net/html/copyright.html
- MAME ep64.cpp: https://raw.githubusercontent.com/mamedev/mame/master/src/mame/enterprise/ep64.cpp
- MAME exdos.cpp: https://raw.githubusercontent.com/mamedev/mame/master/src/devices/bus/ep64/exdos.cpp
- MAME ep64_tap.cpp: https://raw.githubusercontent.com/mamedev/mame/master/src/lib/formats/ep64_tap.cpp
- MAME ep64_dsk.cpp: https://raw.githubusercontent.com/mamedev/mame/master/src/lib/formats/ep64_dsk.cpp
- CLK Enterprise.cpp: https://raw.githubusercontent.com/TomHarte/CLK/master/Machines/Enterprise/Enterprise.cpp
- CLK HostFSHandler.cpp: https://raw.githubusercontent.com/TomHarte/CLK/master/Machines/Enterprise/HostFSHandler.cpp
- CLK EXOSCodes.hpp: https://raw.githubusercontent.com/TomHarte/CLK/master/Machines/Enterprise/EXOSCodes.hpp
- CLK StaticAnalyser.cpp: https://raw.githubusercontent.com/TomHarte/CLK/master/Analyser/Static/Enterprise/StaticAnalyser.cpp
- Batocera wiki (ROM MD5s): https://wiki.batocera.org/systems:enterprise
- libretro ep128emu docs: https://docs.libretro.com/library/ep128emu/
- libretro ep128emu-core: https://github.com/libretro/ep128emu-core
- Xemu ep128 target: https://github.com/lgblgblgb/xemu/tree/master/targets/ep128
- Enterprise Wiki — Unofficial EXOS versions: https://wiki.enterpriseforever.com/index.php?title=Unofficial_EXOS_versions_by_Zozosoft
- Enterprise Wiki — File extensions: https://wiki.enterpriseforever.com/index.php?title=File_Extensions_as_shown_on_ep128.hu
- Enterprise Wiki — EnterMice: https://wiki.enterpriseforever.com/index.php?title=EnterMice
- Enterprise Wiki — Expansion Bus: https://wiki.enterpriseforever.com/index.php?title=Expansion_Bus
- Enterprise Wiki — EXDOS spec (early): https://wiki.enterpriseforever.com/index.php?title=English_to_English_-_PDF2TEXT_-_EXDOS_System_Specifications_(early)
- HxC forum, Zozosoft on EXDOS formats: https://hxc2001.com/floppy/forum/viewtopic.php?p=8078
- RosettaCode IS-BASIC: https://rosettacode.org/wiki/IS-BASIC

## Open questions

1. **IS-BASIC tokenisation**: token values, line layout, variable storage and the exact $$BAS header
   bytes 2–14 — not found publicly. Needed for any BASIC-aware tool (listing, `.bas` ↔ text).
2. **Tape timings**: the EXOS spec's "ms" column is presumably µs and may be full periods vs half
   periods; confirm against the English EXOS 2.0 PDF and by decoding a real recording. Also confirm
   the exact sync/blank-byte/6Ah preamble and the CRC bit order.
3. **Printer READY/BUSY bit**: B6h bit 3 (MAME, one Exos.htm passage) vs B5h bit 3 (another passage).
4. **EXDOS control-register decode** (MAME: 18h with bit-2 mirror, 10h–13h FDC; CLK: 18h–1Fh;
   ep128emu: address bit 3) and status bit 0 "not ready" (ep128emu only). Also /DDEN polarity.
5. **"Invalid time/date" error code** value (CLK's enum is ambiguous).
6. **Code name "Oundle"** — no source found.
7. **ROM licensing**: no rights-holder statement located; ask on enterpriseforever.com whether any
   permission exists (the ep128emu ROM pack has been publicly hosted for ~15 years).
8. **EXOS 2.4** changes vs 2.3/2.32 — undocumented in sources found.
9. **SDEXT real hardware** register layout vs ep128emu's emulation (SDHC support on real cartridge?
   ep128emu emulates a byte-addressed card only).
10. Exact system-segment addresses of CRDISP_FLAG and USER_ISR (Hungarian text lists overlapping
    bytes).
