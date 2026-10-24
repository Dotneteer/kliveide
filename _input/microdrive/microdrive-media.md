# ZX Microdrive cartridge: physical and logical format

Written in our own words. Tags refer to `sources.md`, using the same key as
`interface1-hardware.md`. File-image formats (MDR and others) are covered separately by the other
research agent. This file describes what is **on the tape** and how the IF1 ROM uses it.

---

## 1. The physical cartridge

- A small cartridge (about 44 × 34 × 8 mm) holding an **endless loop** of 1.9–2 mm video tape,
  about 5 m (200 in) long. It is driven at roughly 76 cm/s (30 in/s), so one revolution takes
  about **7–8 s** [WIKI], [WOSF], [SM §2.2]. The QL used the same drive mechanism with a different
  logical format [WIKI], [OQ].
- There are **two tracks**, recorded in parallel by a stereo head. Successive bytes go to
  alternate tracks: even bytes on one track, odd bytes on the other. The hardware hides this and
  software sees a single byte stream [SM §2.2, §2.9], [SW]. Each track's bits are FM (biphase)
  encoded, LSB first [SM §2.13], [SW].
- There is **no index hole and no "start of tape"**. The cartridge is a ring of soft sectors
  that pass the head in the order they were written, starting wherever the loop happens to be
  [SW].
- There is **no cartridge-change line**. Every write operation rebuilds a free-sector map by
  scanning the tape first [SW], [GC OP-TEMP-M].
- **Write protect:** a plastic tab on the side of the cartridge. Snapping it off protects the
  cartridge, and covering the hole with tape undoes this [UM ch.2]. The drive senses it with a
  microswitch, and the IF1 reads it as EF bit 0, where 1 means writable [SM §2.7].
- Writing erases first with a DC erase head mounted **ahead of** the write head. The IF1 turns
  erase on about 2–3 ms before writing starts and leaves it on briefly afterwards [SM §2.3],
  [SW], [GC 128F]. Wherever the tape has been erased but not written, it reads back as a
  **gap**.

## 2. Sector layout on tape

Each sector consists of a **header block**, written only by FORMAT, then a gap, then a
**record (data) block**, which can be rewritten in place at any time, then a longer gap to the next
sector [SW], [GC FORMAT], [SM §3.3 scope test: "one long, two short" packets between quiet
areas].

### 2.1 The preamble (on both blocks)

- **12 bytes: ten `$00` followed by two `$FF`** [GC "Preamble data" 13E5], [UM App. 3]. Because
  the bytes are interleaved across the tracks, each track carries 5 × `$00` then 1 × `$FF`
  [SW "6 sync bytes per channel"].
- The gate array uses the preamble to synchronise, raises SYNC (EF bit 1 → 0) and **does not
  pass the preamble bytes to the CPU**. The first byte the CPU reads is the flag byte that follows
  [SCF], consistent with [GC] reading straight into HDFLAG/RECFLG.

### 2.2 Header block (15 bytes after the preamble)

Offsets are relative to HDFLAG. In parentheses: the offset inside the RAM "M" channel, where the
ROM keeps a copy.

| Off | Name | Size | Contents |
|---|---|---|---|
| 0 (40) | HDFLAG | 1 | **bit 0 = 1**: "this is a header". The other bits are unused [UM App. 3], [GC]. |
| 1 (41) | HDNUMB | 1 | Sector number, **254 … 1** after FORMAT (see §3) |
| 2 (42) | — | 2 | Unused. FORMAT writes whatever happens to be in the channel, so the values are random (one capture shows `$EB $20`) [SW], [GC] |
| 4 (44) | HDNAME | 10 | Cartridge name, padded with spaces |
| 14 (54) | HDCHK | 1 | Checksum of the 14 bytes at offsets 0–13 (§4) |

What FORMAT actually writes per header (OUT-M-HD): **30 bytes** = the 12-byte preamble + these
15 bytes + 3 more bytes, which are the first three `$00`s of the record preamble in the channel
[GC 1872], [V2 L15AD]. [SW] notes a "wasted" trailing byte after HDCHK on a logic-analyser
capture.

### 2.3 Record block (528 bytes after the preamble)

| Off | Name | Size | Contents |
|---|---|---|---|
| 0 (67) | RECFLG | 1 | **bit 0 = 0** (record, not header). **bit 1 = 1**: EOF, the last record of the file. **bit 2 = 1**: a SAVEd file (program/bytes/array); **0**: a PRINT-type (OPEN #) file. Bits 3–7 are unused [GC App. 4], [UM App. 3], [GC SA-DRIVE sets bit 2] |
| 1 (68) | RECNUM | 1 | Record number within the file, 0 … 255 |
| 2 (69) | RECLEN | 2 | Bytes used in this record, 0 … 512, LSB first. It is always 512 except in the EOF record [GC], [SW] |
| 4 (71) | RECNAM | 10 | File name, padded with spaces |
| 14 (81) | DESCHK | 1 | Checksum of offsets 0–13, the "record descriptor" |
| 15 (82) | CHDATA | 512 | Data |
| 527 (594) | DCHK | 1 | Checksum of the 512 data bytes |

- The ROM **writes 543 bytes** per record (OUT-M-BUF, DE=`$21F`): the 12-byte preamble, 528
  bytes, and **3 extra bytes read from beyond the end of the 595-byte channel** [GC 1878],
  [V2 L15B3]. **It reads back 528 bytes** (GET-M-BUF, DE=`$210`) [GC 18A9]. The 3 trailing bytes
  are junk. [SW] describes the record as "528 bytes including one sacrificial byte". An emulator
  file format needs to keep only preamble-free 15 + 528 bytes, or the 543 as written. The
  other agent covers how MDR does it.
- **Record 0 of a SAVEd file** starts with a 9-byte header, the same as tape's minus the name:
  type (0 program, 1 number array, 2 char array, 3 bytes), data length (2), start address (2),
  program length or array name (2), autostart line (2) (`$8000` or more = none, `$FFFF` for
  non-programs). The ROM copies these 9 bytes to/from HD_00…HD_11 (`$5CE6`–`$5CEE`). Record 0
  therefore holds 503 data bytes and every later record 512 [SW], [GC SA-DRIVE/F-M-HEAD 1580–15A6].
- A **PRINT-type file** (OPEN #/PRINT #/INPUT #/MOVE) has no 9-byte header and is a plain byte
  stream [GC MCHAN-IN/MCHAN-OUT]. The EOF read of a PRINT file returns `$0D` [GC 115E].

### 2.4 How "free", "used" and "bad" are recorded

- A sector counts as **free** when the record descriptor has **RECFLG bit 1 = 0 and RECLEN bit 9
  (bit 1 of the high byte) = 0**. FORMAT and ERASE write RECFLG = 0, RECLEN = 0 and a valid DESCHK
  (routine IN-CHK) [GC 11BA, 1C76, 1E3E]. This works because every used record is either full
  (RECLEN = 512, so bit 9 = 1) or an EOF record (RECFLG bit 1 = 1).
- **Conflict:** [SW] says "bit 2 of RECFLG set means the sector is used". According to the ROM this
  is wrong: bit 2 marks a SAVE-type file. Free/used is decided by bit 1 of RECFLG together with
  bit 9 of RECLEN, as above. Trust the ROM.
- **Bad/unusable sectors** keep the **FORMAT test record**: RECFLG with bit 1 set (EOF) and RECNAM
  starting with CHR$ 0. The map therefore treats them as used, and CAT hides them, because it skips
  names that start with CHR$ 0 [GC FORMAT 1BA2–1BAE, CAT 1C85].
- Erasing a file rewrites only its record descriptors to "free" (IN-CHK). It searches up to five
  passes for all records of the name [GC ERASE 1D6E–1E3D]. Erasing an *unclosed* file (one with
  no EOF record) therefore takes the full five passes, about 30 s [UM App. 2].

## 3. How FORMAT builds a cartridge

### 3.1 ROM v1 [GC 1B6E–1C56]

1. Create a temporary channel and map. Start the motor with SW-MOTOR (**no presence test**).
   Wait ~97 ms. `DI`. Check write protect.
2. `OUT $EF,$E6`: erase on, and it **stays on for the whole write pass**.
3. Prepare a header (HDFLAG bit 0 set, the cartridge name) and a test record: RECFLG = `$02`
   (record + EOF), RECNAM[0] = 0, data = 512 × `$FC`, all checksums valid.
4. For **SECTOR = 254 down to 1**: HDNUMB = SECTOR, write the header (30 bytes), wait ~3.2 ms,
   write the record (543 bytes), wait ~6.2 ms, check BREAK. Gaps form wherever erase runs without
   a write.
5. `OUT $EF,$EE` (erase off). Start the drive again with SEL-DRIVE. For 255 sectors' worth of
   headers, read each header and its record. Sectors whose descriptor and data checksums verify
   get their map bit **cleared** (usable). Sectors that fail stay set.
6. Write a "free" descriptor (IN-CHK) into every usable sector (MARK-FREE loop using SEND-BLK,
   which locates each sector by its header and rewrites only the record block).

### 3.2 ROM v2 [V2 L1B5D–L1C4D]

- Same steps 1–4, but the test record is written by WR-BLK as **641 bytes** (27 descriptor bytes
  + 614 × `$FC`, longer than a normal record) and the post-record delay is ~1.9 ms.
- Verification uses READ-BLK, which reads 15 descriptor bytes and then checks that the next 612
  bytes are all `$FC`. It also visits only "highest sector number seen + 3" headers, starting
  from 50, rather than a fixed 255 [V2 L1BF6–L1C1E], [GC App. 7].
- **New in v2:** after verification, **every sector that follows a bad sector on the tape is also
  marked bad**. Sectors pass in descending order, so a bad sector *n* also condemns *n−1*. The
  map is OR-ed with itself shifted by one bit [V2 PREP-MARK L1C35, with commentary].
- The final "mark free" pass then overwrites the long test records with normal-length ones. Some
  long records, notably the one for sector 254, may survive [OQ "ROM Peculiarities"].

### 3.3 Overlap, numbering and capacity

- FORMAT always writes **254 sectors** (254 → 1). Sectors 0 and 255 are never written and stay
  marked used [GC], [V2 comment at L1C2F].
- A real loop holds fewer than 254 sectors, roughly 190–215 at the nominal timing (see
  `interface1-hardware.md` §7.3). So the **lowest-numbered sectors overwrite the earliest-written,
  highest-numbered ones**. The point where the wrap-around happens produces a corrupt sector,
  which verification marks bad. The commentary in [V2] says that "typically the top seventy
  sectors, or so, will be marked as unusable". It also notes that an emulator which simply stores
  254 sectors will report almost every sector usable.
- Sector numbers on a formatted cartridge are therefore **contiguous from 1 up to roughly
  180–200, descending in tape order**, with gaps where sectors are bad. The other agent's MDR notes
  give the exact image layout.
- **Capacity:** each free sector holds 512 bytes. CAT prints *free sectors ÷ 2* as "K free"
  [GC 1D1C]. Typical cartridges give **85–90 KB**, Sinclair quoted 100 KB as the theoretical figure,
  and the upper bound for 254 sectors is 127 KB [WOSF], [WIKI], [SW], [SM §2.1]. Fuse's default is
  "around 180 blocks (90 Kb)", configurable from 10 to 254 blocks [FUSE].
- Reformatting a new cartridge several times is said to stretch the tape slightly and gain sectors
  [WIKI, marked "citation needed"].

## 4. Checksum algorithm (HDCHK, DESCHK, DCHK)

- Start with `s = 0`. For each byte `b`, set `s = (s + b) mod 255`. In other words, an 8-bit add
  with end-around carry, where a result of 255 is folded to 0, so `$FF` is never stored. The
  result is compared with the stored byte and then written over it [GC CHKS-ALL 1349–135E],
  [V2 L142E], [SW].
- The ROM's sequence: `ADD A,(HL)`, then `ADC A,1`, then `DEC A` unless the result was zero. Let
  `t = s + b`. If `t < 255` the result is `t`. If `t = 255` the result is 0. If `t ≥ 256` the
  result is `t − 255`. This is identical to `(s + b) mod 255` because `s` is always ≤ 254.
- Lengths covered: HDCHK and DESCHK cover the **14 bytes** before them (CHKS-HD-R, BC=14). DCHK
  covers the **512** data bytes (CHKS-BUFF) [GC 1341/1346].
- v2 entry points: CHKS-HD-R `$1426`, CHKS-BUFF `$142B` [V2]. In v1 they are `$1341` and `$1346`
  [GC].

## 5. The in-RAM "M" channel (595 bytes) mirrors the tape blocks

| Offset | Field | Notes |
|---|---|---|
| 0–1 | `$0008` | main-ROM output address. It points at RST 8, which pages in the IF1 ROM |
| 2–3 | `$0008` | main-ROM input address |
| 4 | `'M'` | `'M'+$80` marks a temporary channel |
| 5–6 / 7–8 | shadow output / input routine | v1 `$11D8`/`$1122` [GC App. 4], v2 `$12B3`/`$11FD` [V2 MCH-DAT `$14B1`] |
| 9–10 | channel length `$0253` = 595 | [GC], [UM App. 2] (the manual's App. 3 says "596", which is a typo) |
| 11–12 | CHBYTE | next byte position in the buffer, 0 … 512 |
| 13 | CHREC | record number. Also used as a temporary sector number |
| 14–23 | CHNAME | file name |
| 24 | CHFLAG | bit 0 = 1 means a write channel |
| 25 | CHDRIV | drive 1 … 8 |
| 26–27 | CHMAP | address of this drive's 32-byte map |
| 28–39 | header preamble (12) | |
| 40–54 | HDFLAG … HDCHK | header block (15) |
| 55–66 | record preamble (12) | |
| 67–81 | RECFLG … DESCHK | record descriptor (15) |
| 82–593 | CHDATA | 512 bytes |
| 594 | DCHK | |

Bytes 0–27 are never transmitted. 28–54 make up the header block, 55–594 the record block
[GC App. 4].

**Map:** 32 bytes, one per open drive, kept in the "Microdrive maps" area below CHANS (starting
at `$5CF0` once the IF1 system variables exist). **Bit *n* of byte *k* stands for sector
8*k*+*n***. A set bit means used or unusable, a clear bit means free [UM App. 3], [GC 12DA–12FD].
Maps are shared by every channel on the same drive and reclaimed together with the last of them
[GC SET-T-MCH/DEL-M-BUF].
