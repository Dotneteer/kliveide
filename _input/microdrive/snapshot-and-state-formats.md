# Interface 1 / Microdrive state in snapshot and recording formats

Own-words notes; `[Fn]` references are in `sources-formats.md`.

---

## 1. `.z80` (Gerton Lunter's format, versions 2 and 3)

Only the v2/v3 extended header knows about the Interface 1. Version 1 (30-byte header) is 48K-only
and has no field for it [F8].

### 1.1 Hardware mode (offset 34)

| Value | v2 meaning | v3 meaning |
|---|---|---|
| 0 | 48K | 48K |
| **1** | **48K + IF1** | **48K + IF1** |
| 2 | SamRam | SamRam |
| 3 | 128K | 48K + M.G.T. |
| **4** | **128K + IF1** | 128K |
| **5** | — | **128K + IF1** |
| 6 | — | 128K + M.G.T. |

- Decide v2 vs v3 by the extended-header length word at offset 30: **23 = v2, 54/55 = v3** [F8].
  The same numbers 3 and 4 mean different machines in the two versions — the classic bug source.
- Old Z80 3.00–3.02 docs swapped SamRam and 48K+MGT in the v3 column; files follow the table above [F8].
- **Byte 37 bit 7 ("modify hardware")** turns 48K into 16K and 128K into +2, so
  "16K + IF1" = mode 1 + bit 7, "+2 + IF1" = mode 4 (v2) / 5 (v3) + bit 7 [F8].
- Emulator extensions add values 7 (+3), 9 (Pentagon), 10 (Scorpion), 12 (+2), 13 (+2A), 14/15
  (TC2048/TC2068), 128 (TS2068) … but there is **no "Pentagon + IF1", "+2A + IF1" etc.**: the
  format has no way to say IF1 is present on those models [F8]. (Consistent with the IF1 not working
  on the +2A/+3; see `model-compatibility.md`.)

### 1.2 IF1 paged flag (offset 36)

- `0xFF` = the Interface 1 ROM was paged in at the moment of the snapshot [F8].
- In Timex modes the same byte holds the last OUT to port `0xFF` instead [F8].
- Offsets 61/62 ("0–8191 is ROM", "8192–16383 is ROM") are derived from 34, 59, 60 and 83;
  with IF1 paged, 0–8191 is the IF1 ROM [F8].

### 1.3 Memory block page 1

Page number 1 in the memory-block list is "Interface I, Disciple or Plus D ROM, according to
setting" [F8]. In practice snapshots do **not** carry the IF1 ROM (the doc lists which pages are
saved per mode: 4, 5, 8 for 48K; 3–10 for 128K) — so a loader must supply the IF1 ROM itself; and if
a page-1 block *is* present, it can be ignored or used as a custom ROM.

### 1.4 What .z80 cannot hold

No microdrive cartridge content, motor state, head position, selected drive, RS-232/network
state, or the IF1 ROM version. A `.z80` with IF1 paged that resumes mid-microdrive-operation is
unlikely to work. **(derived)**

---

## 2. `.szx` (zx-state, Jonathan Needle / Spectaculator)

Two blocks, both available since zx-state 1.0 [F5].

### 2.1 `ZXSTIF1` — block id `'I','F','1',0`

Must appear **before** any `MDRV` block.

| Field | Type | Meaning |
|---|---|---|
| `wFlags` | WORD | bit 0 `ZXSTIF1F_ENABLED` (1) – IF1 emulation on; bit 1 `ZXSTIF1F_COMPRESSED` (2) – the custom ROM in `chRomData` is zlib-compressed; bit 2 `ZXSTIF1F_PAGED` (4) – IF1 ROM currently paged in |
| `chNumMicrodrives` | BYTE | Drives attached, 1–8 (**never 0**) |
| `chReserved[3]` | BYTE×3 | 0 |
| `dwReserved[8]` | DWORD×8 | 0 |
| `wRomSize` | WORD | Uncompressed size of a *custom* IF1 ROM: 8192 or 16384; **0 = no custom ROM, use the standard v2 ROM** |
| `chRomData[]` | BYTE[] | Custom ROM, raw or zlib. Compressed size = `blk.dwSize − (sizeof(ZXSTIF1) − 1 − sizeof(ZXSTBLOCK))` |

All little-endian, as in every zx-state block [F5]. Note the spec's built-in assumption: the
"standard" IF1 ROM is **v2**. A 16K custom ROM is allowed (presumably for extended/patched
ROMs such as the IMC ROM [F16] **(uncertain)**).

### 2.2 `ZXSTMCART` — block id `'M','D','R','V'`

One per drive that has a cartridge inserted; follows the IF1 block.

| Field | Type | Meaning |
|---|---|---|
| `wFlags` | WORD | `ZXSTMDF_COMPRESSED` (1), `ZXSTMDF_EMBEDDED` (2) — **both "not implemented"**: cartridges are always links to external `.mdr` files |
| `chDriveNum` | BYTE | Drive 1–8 |
| `fDriveRunning` | BYTE | Motor on (1) / off (0) |
| `wDrivePos` | WORD | Position of the virtual head *within the file* (byte offset into the MDR image) |
| `wPreamble` | WORD | Number of preamble bytes still to be skipped |
| `dwUncompressedSize` | DWORD | Length of the file name in `chData` |
| `chData[]` | BYTE[] | Path/file name of the `.mdr` to (re)insert |

Implications for Klive:

- `wDrivePos` + `wPreamble` show that Spectaculator emulates the drive as a byte stream over the
  MDR image with synthesised preambles — the same model Klive is likely to use. Choosing the same
  model makes SZX import/export trivial **(derived)**.
- Because the cartridge is referenced by file name, an exported SZX is not self-contained; on
  import, a missing/moved `.mdr` must be handled (ask the user, or start with an empty drive).
- `wDrivePos` is a WORD, so it can address 0–65535 only, while an MDR is 137 923 bytes long.
  **(uncertain — spec says "position within the file"; it may be measured in some other unit or
  simply overflow. Check against a Spectaculator- or Fuse-written SZX before relying on it.)**
- libspectrum's snapshot object (used by Fuse) has `interface1_active`, `interface1_paged`,
  `interface1_drive_count`, `interface1_custom_rom`, plus the ROM bytes/length — i.e. it maps the
  IF1 block but has **no** fields for cartridges [F10]. So Fuse-written SZX files probably contain
  `IF1` but not `MDRV` **(uncertain)**.

---

## 3. `.sna`

No IF1 field at all. The 48K SNA is a 27-byte register header + 48 KB RAM; the 128K SNA adds PC,
the last `0x7FFD` value and a TR-DOS-paged byte — the only peripheral flag in the format [F2].
What emulators therefore do:

- Saving: write the RAM (which includes the IF1 system variables at 23734+ and any open microdrive
  channels/maps) but no paging/drive state; a snapshot taken while the IF1 ROM was paged will
  resume in the Spectrum ROM at the wrong code **(derived)**. Sensible behaviour: warn, or refuse
  to save SNA while the IF1 ROM is paged.
- Loading: the IF1 system variables in RAM are harmless; the IF1 itself stays enabled/disabled per
  the emulator's settings.

## 4. `.rzx` input recordings

RZX records, per frame, the instruction-fetch count and the **values returned by every CPU port
read** (not the port numbers); embedded snapshots are SNA/Z80/SZX [F19]. Consequences:

- Replay never needs the cartridge: reads of ports `0xE7`/`0xEF`/`0xF7` come from the recording, so
  a recording that loads from microdrive plays back without the `.mdr` [F19].
- But the replaying emulator must still issue the *same number* of IN instructions, so the IF1
  ROM paging must behave identically, and the starting snapshot must carry IF1 state → use SZX
  (or Z80 with the IF1 hardware mode) as the embedded snapshot **(derived)**.
- The microdrive's data port stalls the CPU (WAIT) until a byte is ready [F17]; RZX does not care
  about T-states (only fetch counts), so the wait emulation does not have to be cycle-identical
  between record and replay [F19].
- Writes to a cartridge during replay should not reach the user's `.mdr` file **(derived)**.

## 5. Recommendations for Klive (summary)

| Format | Load | Save |
|---|---|---|
| Z80 v2/v3 | Honour modes 1, 4 (v2), 5 (v3) + byte 37 bit 7; byte 36 = paged | Write v3 with mode 1 or 5 and byte 36 |
| SZX | Read `IF1\0` (enabled, paged, drive count, custom ROM); read `MDRV` and try to reinsert the named file | Write both; store an absolute or project-relative MDR path |
| SNA | ignore | warn if IF1 ROM paged |
| Klive's own state | keep full drive state (selected drive, motor, position, gap/sync phase) so save/restore and RZX are exact |

## 6. Open questions

1. Units/overflow of SZX `wDrivePos` (WORD vs 137 923-byte file).
2. Whether Fuse writes `MDRV` blocks (libspectrum doc suggests not).
3. Whether any emulator writes a `.z80` page-1 block with the IF1 ROM.
