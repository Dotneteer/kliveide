# Microdrive cartridge image formats (MDR and relatives)

Research notes for the Klive IDE Interface 1 + Microdrive plan. Everything here is written in
our own words; numbered references `[Fn]` point to `sources-formats.md`. Where sources disagree,
or where a statement is derived (not quoted from a spec), it is flagged **(derived)** or
**(uncertain)**.

> Provenance note. Some facts below were confirmed by reading the commented Interface 1 ROM
> disassemblies (Wearmouth/Hutcheson [F12], Carri [F13]). They are used here only for
> *behaviour* (what bytes the ROM writes and accepts). If Klive ever ships a ROM sidecar for
> the IF1 ROM, the D4 provenance rule in `.ai/rom-annotations/README.md` forbids using those
> disassemblies for it.

---

## 1. Origin and status of the `.MDR` format

- Devised by Carlo Delhez for *Spectator*, his Spectrum emulator for the Sinclair QL; later
  adopted by XZX, Fuse, Spectaculator, ZEsarUX, MAME, and the hardware Microdrive emulators
  (vDriveZX, ZXPicoMD, OqtaDrive, Derek Fountain's Pico IF1) [F1][F2][F9][F11][F15][F32][F20][F21][F22][F43].
- It is the de-facto interchange format: images made by one emulator are generally usable by
  the others and by the hardware emulators [F20].
- Spectaculator's own MDR handling is referenced from its SZX snapshots: microdrive state blocks
  in SZX are *links* to external `.mdr` files, not embedded data [F5].

## 2. File layout

An MDR file is a plain dump of the cartridge "as the Interface 1 wrote it", minus the
synchronisation preambles and gaps [F1][F2]:

| Item | Size |
|---|---|
| Sector (header block + record block) | 543 bytes |
| Number of sectors (full image) | 254 |
| Trailing write-protect flag | 1 byte (non-zero = write-protected) |
| **Total, full image** | **254 × 543 + 1 = 137 923 bytes** |

Each 543-byte sector is two blocks, exactly as they are OUTed to port `0xE7` by the IF1 ROM
(minus their 12-byte preambles):

### 2.1 Header block (15 bytes, file offsets 0–14 within the sector)

| Off | Len | Name | Meaning |
|---|---|---|---|
| 0 | 1 | HDFLAG | `0x01` — bit 0 set marks a *header* block |
| 1 | 1 | HDNUMB | Sector number, 1–254 (FORMAT writes 254 first, counting down) |
| 2 | 2 | — | Unused (value not defined by the spec; **assume anything**) |
| 4 | 10 | HDNAME | Cartridge name, space-padded |
| 14 | 1 | HDCHK | Checksum of bytes 0–13 |

### 2.2 Record block (528 bytes, sector offsets 15–542)

Record descriptor (15 bytes):

| Off | Len | Name | Meaning |
|---|---|---|---|
| 15 | 1 | RECFLG | bit 0 = 0 (record, not header); bit 1 = 1 on the file's last (EOF) record; bit 2 = 0 for a PRINT/OPEN# data file, 1 for a SAVEd file; bits 3–7 = 0 |
| 16 | 1 | RECNUM | Record (block) number within the file, from 0 |
| 17 | 2 | RECLEN | Number of valid data bytes, 0–512, little-endian |
| 19 | 10 | RECNAM | File name, space-padded; first byte `0x00` marks a "secret"/unusable record |
| 29 | 1 | DESCHK | Checksum of bytes 15–28 |

Data:

| Off | Len | Name | Meaning |
|---|---|---|---|
| 30 | 512 | data | Record data (always 512 bytes on tape, whatever RECLEN says) |
| 542 | 1 | DCHK | Checksum of all 512 data bytes (including unused tail bytes) |

**Disagreement to note.** The Sinclair Wiki's Interface 1 page describes RECFLG bit 2 as
"in use" [F4]. The original MDR description, the WoS formats page and the IF1 ROM all treat bit 2
as "*reset* = PRINT-type file", i.e. bit 2 is *set* by `SAVE *` [F1][F2][F12]. Use the latter.
The Sinclair Wiki also places a "15-byte preamble" inside the 528-byte record — it means the
record descriptor, not the tape sync preamble [F4].

### 2.3 Byte order inside the file vs. sector numbers

The file stores sectors in **tape order** (the order in which they pass the head), not in sector
number order. An emulator's FORMAT starts writing wherever its virtual head happens to be, so in
an image formatted inside an emulator, file slot 0 is not necessarily sector 254
**(derived** from the ROM's FORMAT routine, which simply writes 254, 253, … 1 as the tape moves
[F12]**)**. A parser must read `HDNUMB` and must never infer the sector number from the slot index.
Images made by tools (e.g. `zxmdr -c`, Z80onMDR) probably start at 254 in slot 0 **(uncertain)**.

## 3. Checksums

All three checksums (HDCHK, DESCHK, DCHK) use the same rule: **sum of the bytes modulo 255**, so
a checksum can never be `0xFF` [F1][F2]. The ROM computes it incrementally as an 8-bit add with
end-around carry, folding the result `0xFF` to `0x00` [F12]; the ROM's own comment gives the
reason — `0xFF` is what a failed read returns. We simulated that incremental routine against
`sum % 255` over 20 000 random 14- and 512-byte blocks: identical **(derived, verified by
script)**. The Sinclair Wiki pseudo-code (wrap 255 → 0, add the carry back) describes the same
thing [F4].

Consequences an emulator relies on:

- A block whose 15-byte checksum is wrong is treated by the ROM as if it were a gap [F1].
  `OUT 239,0` on a real machine erases the whole tape in ~7 s, after which `CAT 1` reports
  "Microdrive not present" [F1].
- `0xFF` filling, or any data with bad checksums, is therefore a valid "unformatted" cartridge.

## 4. Sector states (how the ROM interprets record descriptors)

| State | RECFLG bit 1 | RECLEN | RECNAM[0] | Notes |
|---|---|---|---|---|
| Free | 0 | 0 | any | written by FORMAT for sectors that verified OK |
| Used, not last | 0 | 512 | name | full intermediate record |
| Used, last (EOF) | 1 | 1–512 | name | last record of a file ("seldom full" EOF has 512) |
| Unusable (bad) | 1 | 0 | `0x00` | FORMAT marks bad sectors as EOF + length 0 + secret name |

The ROM's CAT treats a record as *in use* when RECFLG bit 1 is set **or** RECLEN's high byte has
bit 1 set (RECLEN = 512); anything else is counted free [F12]. Records whose name starts with
`CHR$ 0` are never listed — that covers the bad sectors and deliberately hidden files [F12][F6].

## 5. Files on the cartridge

- There is **no directory**. A file is the set of records sharing the same `RECNAM`, ordered by
  `RECNUM` (0, 1, 2 …); the record with RECFLG bit 1 set is the last one [F1][F4][F12].
  Records of one file can be anywhere on the loop, in any order.
- **SAVE-type files** (RECFLG bit 2 set) start with a **9-byte file header** at the beginning of the
  data area of record 0, mirroring the tape header's parameters [F4][F12]:

  | Off | Len | ROM var | Meaning |
  |---|---|---|---|
  | 0 | 1 | HD_00 | Type: 0 = program, 1 = number array, 2 = character array, 3 = bytes (CODE / SCREEN$) |
  | 1 | 2 | HD_0B | Data length |
  | 3 | 2 | HD_0D | Start address (CODE); for programs, the address PROG had when saved |
  | 5 | 2 | HD_0F | Program: length without variables. Arrays: the array's name byte (low byte) |
  | 7 | 2 | HD_11 | Program: auto-run line; no LINE → high bit set (**uncertain**: value not checked; tape uses ≥ 32768) |

  The data follow immediately, so record 0 carries 9 + up to 503 data bytes; RECLEN of record 0
  includes the 9 header bytes **(derived** from the ROM: the nine HD_ variables are contiguous at
  23782–23790 and are sent as part of the first record [F12]**)**.
- **PRINT-type files** (`OPEN #s;"m";d;"name"` + `PRINT #s`) have RECFLG bit 2 reset and **no**
  9-byte header; the data are the raw characters [F1][F12].
- Names are 1–10 characters, compared exactly (case and control codes matter) [F6][F17].

### 5.1 Parsing algorithm (for a Klive "Microdrive Explorer"-style tool)

1. Accept files of length `n × 543` or `n × 543 + 1` for `1 ≤ n ≤ 254` (see §6). The final byte, if
   present, is the write-protect flag.
2. For each slot: validate HDFLAG bit 0 and HDCHK; validate RECFLG bit 0 = 0 and DESCHK. Slots
   that fail are "gap/unformatted".
3. The cartridge name is HDNAME of any valid header (they should all agree).
4. Group used records by RECNAM; sort by RECNUM; concatenate `RECLEN` bytes of each. Check for
   missing RECNUMs and a single EOF record; verify DCHK (a bad DCHK makes the ROM's LOAD retry,
   so a real cartridge may still contain it).
5. If RECFLG bit 2 is set, split off the first 9 bytes as the header.
6. Free space as the ROM prints it: `floor(free_sectors / 2)` K [F12].

## 6. Images with other sector counts

- Real cartridges hold roughly 180 sectors (≈ 85–90 KB); 254 is the theoretical maximum, and the
  low sector numbers overwrite the first-written high ones when the loop is shorter than 254
  sectors [F7][F9][F12].
- **Fuse** creates new cartridges with a configurable number of blocks (`--mdr-len`, clamped to
  10–254) or a random length "around 180 blocks" (`--mdr-random-len`) [F9]. Fuse saves such
  cartridges as shorter MDR files **(uncertain**: implied by the option and by libspectrum's
  per-cartridge length field [F10]; exact on-disk length not checked**)**.
- **Warajevo** "ignores the final write-protect byte" and does not require all 254 sectors [F2].
- **libspectrum** documents a maximum of 254 blocks of 543 bytes and a per-cartridge length;
  its doc quotes the maximum as 137 922 bytes, i.e. *without* the write-protect byte, and calls
  the cartridge length "in bytes" while storing it in a byte-sized field (so it is really a block
  count) [F10]. Treat that text as loosely worded.
- **MAME**'s software list `spectrum_microdrive` has 73 entries (issues of the *Outlet* disk
  magazine), all exactly 137 923 bytes [F11].
- Recommendation for Klive: read any `n × 543 (+1)` image; write back the same sector count the
  image had; create new images with 254 sectors by default (the community default, and what the
  hardware emulators produce [F21][F44]) with an option for a "realistic" length.

## 7. Creating a blank or formatted image

- **Unformatted** ("Insert new" in Fuse [F9]): any content whose header checksums fail. `0xFF`
  everywhere is the natural choice (no checksum can be `0xFF`) **(derived)**. Then the user runs
  `FORMAT "m";1;"name"` in the emulated machine — this is the most faithful path and exercises the
  ROM.
- **Pre-formatted by the tool** (what `zxmdr -c`, ZXPicoMD, OqtaDrive's quick format do [F44][F21][F22]): for each slot `i = 0 … n-1`, sector number `s = 254 - i`:
  - header: `01 s 00 00 <name, 10 bytes space-padded> HDCHK`;
  - descriptor for a free sector: `RECFLG=00, RECNUM=00, RECLEN=0000, RECNAM=10 bytes, DESCHK`;
  - 512 data bytes (content irrelevant) + DCHK.
- What the **ROM v2 FORMAT** really leaves on an emulated full-length cartridge **(derived** from
  [F12]**)**: it writes all sectors 254…1 with "unusable" descriptors (EOF, RECNAM[0]=0), reads the
  loop back, marks every sector that verified as usable, then — unique to ROM 2 — also marks as
  bad *every sector that follows a bad one in tape order*. Sector 255 never exists and is
  pre-marked bad, so **sector 254 ends up unusable** even on a perfect emulated tape, giving
  253 free sectors → `CAT` reports **126** K. ROM v1 lacks that step, so the same test should give
  **127** K. ZXPicoMD's tool-formatted blank is quoted as 127 KB [F21]; zxmdr's author also notes that at least one sector is normally unusable [F44]. *Both numbers should be confirmed against Fuse
  before being used as test expectations.*

## 8. Worked hex example (computed, not copied)

Cartridge `TEST`, sector 254, header block (unused bytes taken as zero):

```
01 FE 00 00 54 45 53 54 20 20 20 20 20 20 | 02
^  ^  ^---^ ^-------------------------^   ^ HDCHK = (1+254+0+0+84+69+83+84+6*32) mod 255
|  |  unused         "TEST      "             = 767 mod 255 = 2
|  HDNUMB = 254
HDFLAG = 1
```

Record descriptor of a one-record BASIC program `x` whose header+program is 29 bytes (9 + 20):

```
06 00 1D 00 78 20 20 20 20 20 20 20 20 20 | BC
^  ^  ^---^ ^-- "x" padded to 10           ^ DESCHK = sum mod 255
|  |  RECLEN = 29
|  RECNUM = 0
RECFLG = 0x06 (bit 1 EOF + bit 2 SAVE-type)
```

The same descriptor with RECFLG `0x04` (not last record) has DESCHK `BA`. A free sector's
descriptor with all-zero fields except a space-padded name (`00 00 00 00 00 20 … 20`) has
DESCHK `21`. All values computed with the verified `sum mod 255` rule.

## 9. Other cartridge formats

| Format | Machine | What it is | Source |
|---|---|---|---|
| `.MDV` (QLAY) | **Sinclair QL** | 255 sectors × 686 bytes = 174 930 bytes, *including* preambles; header = flag, sector no., 10-byte name, 2 random bytes, 2-byte checksum; separate 4-byte block header; 512 data + 2-byte checksum. 16-bit checksums — not the Spectrum format | MAME [F11], ZEsarUX [F15] |
| `.MDV` (JSpeccy "MDVT") | Spectrum | JSpeccy's own Spectrum cartridge format; auto-detected by OqtaDrive (**layout not researched**) | [F22] |
| `.MDV` (Q-emuLator Mdump v1/v2) | QL | QL dumps | [F22] |
| `.MDI` | ? | Supported by OqtaDrive; **origin and layout unknown** | [F22] |
| `.RMD` | Spectrum | ZEsarUX "raw" microdrive: keeps gaps, sync bytes and bad sectors, supports non-IF1 formats (Multiface 128 extension, LEC CP/M); **layout not publicly documented** — only in GPL source | [F15] |
| `.MDR` "Spectator" | Spectrum | The format above | [F1] |

QL vs Spectrum: the same drive hardware, but the QL writes a different logical format (and QL
cartridges hold ≥ 100 KB); a QL-formatted cartridge makes a Spectrum CAT spin forever — re-FORMAT
on the Spectrum [F7][F23]. Klive should reject (or offer to reformat) a 174 930-byte file.

## 10. Conversion tools (useful for test material)

| Tool | Direction | Notes / licence | URL |
|---|---|---|---|
| zxmdr (`mdr.pl`, GitHub user mattsteeldue) | TAP ↔ MDR, list/copy/rename/erase, create empty, change label, remove autorun | Perl, **MIT** — the cleanest to study or run | https://github.com/mattsteeldue/zxmdr |
| TAPtoMDR / MDRtoTAP (J.G. Harston) | TAP → MDR and back | BBC BASIC for Windows programs | http://www.mdfsnet.f9.co.uk/Software/Spectrum/Tools/ |
| MDR2TAP (Andrea Giannotti) | MDR → TAP | Windows CLI, on WoS utilities | https://worldofspectrum.net/utilities/ |
| Z80onMDR / Z80onMDR_Lite (Tom Dalby) | Z80/SNA → bootable MDR (48K & 128K) | Lite is GPL-3 | https://github.com/TomDDG/Z80onMDR_lite |
| ZXPicoMD "TAP copy" | TAP → blank virtual cartridge (needs manual post-processing) | GPL-2 hardware project | https://github.com/TomDDG/ZXPicoMD |
| OqtaDrive | loads Z80/SNA/TAP into MDR on the fly (uses the above) | Codeberg | https://codeberg.org/xelalexv/oqtadrive |
| SD5 / "Tape to Microdrive" | Spectrum-side copiers (run in the emulator) | period software | https://spectrumcomputing.co.uk/entry/13884 , https://spectrumcomputing.co.uk/entry/20782 |

Do not copy code from the GPL tools into Klive (MIT). zxmdr is MIT, but writing our own parser
from this document is simpler anyway.

## 11. Open questions

1. Exact on-disk length Fuse writes for a short (`--mdr-len` < 254) cartridge, and whether it
   writes the trailing write-protect byte for such files.
2. Contents of header bytes 2–3 as written by the ROM's FORMAT (they come from uninitialised
   channel memory **(uncertain)**).
3. HD_11 value when `SAVE *` is used without `LINE`.
4. Layout of `.RMD`, JSpeccy `.MDV` and `.MDI` (only matters if Klive wants to import them).
5. Confirm the 126/127 K CAT figures for a 254-sector image under ROM v2/v1 in Fuse.
