# TBBLUE.TBU Viewer Plan

**Status: done (2026-11-14).** Phases 0, 1, 2a, 2b and 4 are complete; Phase 3 was skipped by the
project author's decision and is kept as an open idea. Each phase has an "As built" note below.

A read-only document viewer for the ZX Spectrum Next core update file, `TBBLUE.TBU`, so its contents can be
examined in the IDE: which cores it carries, for which boards and slots, where each image sits, and whether
each image is intact. It opens **only** a file named `TBBLUE.TBU`, not every `.tbu` file.

Background: the Under the Hood article `docs/content/en/under-the-hood/emulator-internals/next-fpga-boot.mdx`,
"Updating the core" and "Repairing a broken slot 1".

## 1. What the file is (research)

### Sources

| Tag | Source |
|---|---|
| [src] | `maketbu.c` (current) and `old_maketbu.c` (the original TBUmaker), in the upstream FPGA repo `cores/zxnext/tbumaker/src/` (local checkout `~/source/ZX_Spectrum_Next_FPGA`). GPL: read for **interface facts only**; no code is copied or translated (the same rule as for the VHDL). |
| [bin] | Three real files: `tbumaker/TBBLUE.TBU` (core 3.02.03, 4,882,944 bytes), the KS2 SD image's `TBBLUE.TBU` (3.01.10, 2,687,488 bytes, 2023), and `tbblue-v.1.03/TBBLUE.TBU` (2019, 475,648 bytes, the legacy format). |
| [doc] | `dev/research/zxnext-ks2-vs-ks3.md` (the 26.11a catalogue, 3.03.03 for three boards) and the article above. |

There is no published specification and the updater's own source (inside `TBBLUE.FW`) is not available
locally; `maketbu.c`'s `list` and `pull` commands are the closest thing to a reader.

### Multi-core format (all files since core 3.x) [src][bin]

The file is a 512-byte header followed by images, all in 512-byte sectors.

Header (512 bytes):

| Offset | Size | Contents |
|---|---|---|
| 0 | 8 | `TBUFILE\0` (magic) |
| 8 | 17 | `ZX SPECTRUM NEXT\0` (machine) |
| 25 | 487 | Index: 15-byte records, back to back; a record whose length byte is `$FF` ends the list. Unused bytes are `$FF`. Room for at most 32 records. |

Index record (15 bytes, little-endian):

| Offset | Size | Field | Meaning |
|---|---|---|---|
| 0 | 1 | length | 15 (the walk advances by this, not by a constant); `$FF` = end of list |
| 1 | 1 | type | 1 = ZX Spectrum Next core (slot 1); 0 = anti-brick core (slot 0); 3 in 26.11a, meaning unconfirmed (§1a) |
| 2 | 1 | board ID | NextReg `$0F` value: board issue − 2 (0 = Issue 2, 1 = Issue 3, 2 = Issue 4, 3 = Issue 5). **Newer files use more values** (`$10`, `$20`, `$40`, `$41` in 26.11a; see §1a) |
| 3 | 1 | core major | NextReg `$01`: major in the high nibble, minor in the low (`$32` = 3.02) |
| 4 | 1 | core sub-minor | NextReg `$0E` (`$03` → 3.02.03) |
| 5 | 4 | sector offset | Image start in sectors **after the header**: file offset = (offset + 1) × 512 |
| 9 | 4 | sector length | Image length in sectors |
| 13 | 2 | checksum | Fletcher-16 over every sector of the image (sum1 low byte, sum2 high byte, both mod 255, seeded 0) |

Image layout [src][bin] (as `maketbu.c` writes it; other sizes exist, §1a): the bitstream, padded with `$FF` to a fixed number of sectors (959 for boards 0-1,
4,287 for boards 2-3), then **one trailer sector**: `ZX SPECTRUM NEXT\0`, `ZXN ISSUE <n> <ANTI-BRICK|ZX
SPECTRUM NEXT>\0`, then a 7-byte flash record (length 7, type, board ID, core major, core sub-minor, a 16-bit
screen offset left at `$FFFF`), the rest `$FF`. So an image is 960 or 4,288 sectors (480K / 2,144K), which
fits the flash slot (512K / 2,176K). This trailer is what ends up at the end of the slot in flash.

What the real files show [bin]:

- 3.02.03: three records, Issue 2 / 4 / 5, all type 1; offsets and lengths add up exactly to the file size.
  The Issue 2 bitstream has the Xilinx sync word `AA 99 55 66` at byte 16 of its image (Spartan-6, 16-bit
  packets); Issue 4/5 at byte 304, with the IDCODE written at byte 400: `$0362E093` (Issue 4) and
  `$0362D093` (Issue 5) — Artix-7 device IDs, mapped to part names in §1a.
- 3.01.10 (KS2 image): two records, Issue 2 and Issue 4.
- Images end in `$FF` padding; the meaningful bitstream ends well before it (Issue 2: 465,028 of 491,520 bytes).

### Legacy single-core format (2019 and earlier) [src][bin]

Also starts with `TBUFILE`, but has no machine string at byte 8:

| Offset | Size | Contents |
|---|---|---|
| 0 | 7 | `TBUFILE` |
| 7 | 4 | Image size in bytes (LE), overwriting the rest of the padded magic |
| 11 | 1 | Hardware ID (10 = ZX Spectrum Next; the table also lists DE-1, DE-2, FBLabs, Vtrucco, WXEDA, ZX-Uno, Multicore) |
| 12 | 1 | Version: major in the high nibble, minor in the low |
| 13 | 1 | XOR of every image byte (Altera images are bit-reversed first) |
| 14 | ≤ 20 | Hardware name, NUL-terminated (`ZX Spectrum Next`) |
| 500 | 1 | Sub-version |

The image follows at 512 and must be exactly the stated size. The two formats are told apart by bytes 8-24:
`ZX SPECTRUM NEXT\0` means multi-core (byte 7 alone is not enough: in the 2019 file it is `$00` too).

### 1a. Phase 0 results (2026-11-14)

**What the file-type matcher receives.** `getFileTypeEntry` (`src/renderer/appIde/project/project-node.ts`)
is called with a full path almost everywhere (the Explorer, the document hub, `ProjectService`), and with a
bare name in a few places (`annotationSidecarDocument.ts`, `explorerFileOperations.ts`'s rename). So
`matchType: "full"` cannot match a file name, and `ends` + `"TBBLUE.TBU"` would also match
`MYTBBLUE.TBU`. **Decision:** add `matchType: "name"`, true when the text after the last `/` or `\` equals
the pattern (with `ignoreCase`), with a unit test for both separators and for a bare name.

**Which FPGA each image is for.** The bitstream writes the device's IDCODE into its IDCODE register:

| Board | Bitstream | IDCODE write found at | IDCODE | Part |
|---|---|---|---|---|
| Issue 2 | Spartan-6, 16-bit packets; sync `AA 99 55 66` at image byte 16 | byte 36, type-1 write header `$31C2` (register `$0E`, 2 words) | `$04002093` | XC6SLX16 |
| Issue 4 | 7-series, 32-bit packets; sync at byte 304 | byte 400, header `$30018001` (register `$0C`, 1 word) | `$0362E093` | XC7A15T |
| Issue 5 | as Issue 4 | byte 400 | `$0362D093` | XC7A35T |

Both agree with the article ("What the blank chip is made of") and `dev/research/zxnext-ks2-vs-ks3.md`.
Sources: Xilinx UG380 and UG470 for the packet formats; the urjtag `PARTS` table (XC6SLX16 `0x4002`,
XC7A35T `0x362D`); for the XC7A15T, its BSDL value `x362E093` as read by Vivado. UG470 v1.10 lists
`X362D093` for both the 7A15T and the 7A35T, which is a known error in that revision; Klive's table says
so in a comment. The viewer compares the IDCODE ignoring its top nibble (the silicon revision) and also
checks that the part belongs to the record's board (a mismatch is a problem: an Issue 4 core in an Issue 5
record would not configure the FPGA).

**The 26.11a file** (System/Next 26.11a, `gitlab.com/thesmog358/tbblue` `master` `3a892b0`), from the
catalogue already recorded in `dev/research/zxnext-ks2-vs-ks3.md` §2 (no new download):

- The magic is `TBUFILE\0`, as in the older files, so the article's `ZXNFILE` is wrong (see below).
- The board byte holds more than the `$0F` value: `$02` and `$03` (Issue 4, 5), `$00`, `$10`, `$20` (three
  Issue 2 builds, `$00` and `$20` sharing one image), and `$40`, `$41` (core 3.02.04, `$38D` sectors, one
  shared image, purpose unconfirmed, possibly the TestCard core). The local `maketbu.c` predates this and
  only writes 0-3. **So the board byte must be read as a low nibble (board) and a high nibble (variant), and
  the viewer must show unknown variants and types as raw values, not as problems.** What the variants mean,
  and what the type byte holds in the `$40`/`$41` records, is not known; the research note did not record
  the type bytes. Sizes other than 960 / 4,288 sectors (`$38D` = 909) must be accepted too: the fixed padding
  is the maker's choice, not the format's.
- `TBBLUE.HDMI.TBU` is not in the distribution; the HDMI and VGA builds for Issue 2 are records in the one
  `TBBLUE.TBU`. **So D1 stays: `TBBLUE.TBU` only.**

**The 26.11a header, read [bin].** The first 512 bytes of the distribution's `TBBLUE.TBU` (`master`,
fetched 2026-11-14 with a range request, with the project author's approval; the whole file is 5,839,872
bytes, which is exactly where the last image ends). The index holds 7 records (106 bytes, `$FF` after):

| # | Type | Board byte | Core | Sector offset | Sectors | Checksum |
|---|---|---|---|---|---|---|
| 1 | 1 | `$20` | 3.03.03 | 0 | 960 | `$7214` |
| 2 | 1 | `$02` | 3.03.03 | 960 | 4,288 | `$9A66` |
| 3 | 1 | `$03` | 3.03.03 | 5,248 | 4,288 | `$3B31` |
| 4 | 1 | `$10` | 3.03.03 | 9,536 | 960 | `$1F5A` |
| 5 | 1 | `$00` | 3.03.03 | 0 | 960 | `$7214` |
| 6 | **3** | `$40` | 3.02.04 | 10,496 | 909 | `$C462` |
| 7 | **3** | `$41` | 3.02.04 | 10,496 | 909 | `$C462` |

What this changes:

- **Records can share an image.** 1 and 5, and 6 and 7, have the same offset, length and checksum. The
  viewer groups them ("shared with record n") and reports an overlap only when two ranges overlap
  without being identical. The checksum is computed once per distinct image.
- **Type 3 exists.** `maketbu.c` knows only 0 (anti-brick, slot 0) and 1 (Next core, slot 1). Type 3 is
  used for a 3.02.04 core on boards `$40`/`$41`, low nibble 0 and 1 (Issue 2 and Issue 3); the release
  notes' "TestCard core" for the Issue 2 HDMI/VGA split is the likely meaning, and type 3 may be the slot
  it goes to (slots 2-7 are reserved). Both are **unconfirmed**: the viewer shows "type 3" and "variant 4"
  as raw values with no name until a source states them.
- **The order is not by board**, and three records serve Issue 2 (`$00`, `$10`, `$20`, variants 0, 1, 2),
  with `$00` and `$20` the same image. Which variant is HDMI and which VGA is still not known.
- **Image sizes vary**: 909 sectors for the type-3 image. Its trailer was not read (only the header was
  fetched); the parser treats the trailer as optional and reports what it finds.

Phase 1's tests get a fixture header built to this shape (shared images, type 3, variants, unsorted), and
the optional real-file check can take this file. The 512 bytes are not committed; the test builds its own.

### A finding about the article

The article's figure (`fig:tbu`, line 608-611) gives the multi-core magic as **`ZXNFILE`** and says older
files are the ones with `TBUFILE`. Every real file and `maketbu.c` use `TBUFILE` for both formats; they
differ in bytes 8-24. It also calls record byte 1 "the slot"; the maker calls it the type (1 → slot 1,
0 → slot 0), so the reading is right but the name differs. The figure, its `aria-label` and the paragraph
after it need correcting (Phase 4, with `boot-figures.cjs`, which generates the figure).

## 2. Decisions

- **D1. Match by file name only.** The entry matches a file whose base name is `TBBLUE.TBU`, ignoring case
  (`tbblue.tbu` on a FAT card). `GAME.TBU` and `TBBLUE.HDMI.TBU` keep opening as they do today. The matcher
  receives full paths (see the `bootrom_ab.bin.dis` entry), so `ends` + `"TBBLUE.TBU"` would also catch
  `MYTBBLUE.TBU`. Phase 0 chose a new `matchType: "name"`: base-name equality, both separators (§1a).
- **D2. A pure parser in `src/common/zxnext/tbuFile.ts`**, no React and no I/O: bytes in, a model out
  (format, header fields, records, per-record verdicts, problems). Everything the viewer shows comes from it,
  so it is fully unit-testable.
- **D3. Never throw on a bad file.** A file that is not a TBU, is truncated or has a broken index opens with
  what could be read plus a list of problems, the way the snapshot viewer reports a non-snapshot.
- **D4. Checksums are computed when the file opens.** Fletcher-16 over 4.8 MB is a few milliseconds; it is
  the one thing the updater checks before erasing, so the viewer should say "matches" or "FAIL" up front.
- **D5. Read-only.** No editing, no "add core". Extracting one image to a `.bin` (what `maketbu pull` does)
  is in Phase 3, not the first version.
- **D6. Board and version text from Klive's own vocabulary**: board names as in `nextProfiles.ts`
  (Issue 2, Issue 4 KS2, Issue 5 KS3) where a profile matches, otherwise "Issue n"; versions as `3.02.03`.
- **D7. Layout A + C** (chosen by the project author from the mockups, 2026-11-14): the summary, a
  to-scale **file map** (header, then each distinct image, hatched where it is `$FF` padding; a block
  selects its records), the **cores table** (a row selects its image; records sharing it are
  highlighted), then the selected core's details. The mockup is `.local/tbu-mockup/index.html` (not
  committed).
- **D8. The bitstream's configuration packets are shown; its frame data is not** (decided 2026-11-14). A
  bitstream is a short program of register writes around one large frame-data block (Issue 4 3.02.03:
  about 30 packets, 2,189,680 of its 2,192,012 bytes in one FDRI write). The details get a collapsible
  **Bitstream** section listing every packet: offset, type, operation, register, word count, value, with
  command names (`CMD`) and the IDCODE's part decoded. A frame-data block is one row with its size. The
  frame data itself means nothing without a per-device database, so it is not decoded. The decoder is
  Klive's own code, `src/common/zxnext/xilinxBitstream.ts`, written from Xilinx UG380 (Spartan-6, 16-bit
  packets) and UG470 (7-series, 32-bit packets). Checking the bitstream's own CRC is left for later; the
  Fletcher-16 check covers the file.

## 3. What the viewer shows

1. **Summary** (DataPanel rows): format (multi-core / legacy single-core), magic, machine string, file
   size, number of cores, index space used (n of 32 records), and an overall verdict.
2. **Cores table**, one row per record: #, slot (1 Next / 0 anti-brick, the latter flagged as the risky
   one), board (with its `$0F` value), core version, image offset and length (sectors and bytes, hex
   offsets), stored and computed checksum with a match mark, and the name `maketbu pull` would give it
   (`zxnext-4-30203.bin`, `-ab` for slot 0).
3. **Selected core's details**:
   - The trailer sector decoded: both strings and the flash record, each field cross-checked against the
     index record (a mismatch is a problem).
   - The bitstream: sync word position, FPGA family (Spartan-6 / 7-series by packet width), IDCODE and
     part name where found, meaningful length before the `$FF` padding, padding size, and whether the image
     fits the board's flash slot.
   - A "Show dump" button that opens the image in the static memory dump (`openStaticMemoryDump`, as the
     SCR viewer does), plus one for the 512-byte header.
4. **Problems list**: bad magic, wrong machine string, index not terminated, record length ≠ 15, an image
   beyond the end of file or partly overlapping another (identical ranges are a shared image, not a problem), a file size that is not a whole number of sectors,
   duplicate board/type/version, checksum mismatch, trailer mismatch, and (informational) boards of the
   current profiles with no core in the file.
5. **Legacy files**: the summary shows hardware ID and name, version, stated vs actual size and the XOR
   checksum; the table has its single row; the trailer section is absent.

## 4. Phases

### Phase 0 — Spike (no product code) — done; results in §1a

- Confirm what string reaches `getNodeFileType` (full path or name) from the Explorer and the document
  hub, and choose D1's mechanism.
- Map the IDCODEs to part names from Xilinx's documentation (Klive's own table, cited), and find the
  Spartan-6 IDCODE in the Issue 2 image (16-bit type-1 packet to the IDCODE register), or decide to show
  only the family for it.
- Check the 26.11a distribution's `TBBLUE.TBU` (gitlab `thesmog358/tbblue`, `master`) against §1, and
  whether `TBBLUE.HDMI.TBU` is in the distribution (if it is, ask whether D1 should take it too).

### Phase 1 — Parser and tests

- `src/common/zxnext/tbuFile.ts`: `parseTbuFile(bytes)`, `fletcher16(...)`, the trailer and bitstream
  probes, problems as keys (texts are made at display, `dev/ai/i18n-guide.md`).
- `test/zxnext/tbuFile.test.ts` (unit tier) on files **built in the test** by a small writer (a few-sector
  fake bitstream), covering: one/several records, slot 0, the end marker, every problem in §3.4, the legacy
  format, a truncated header, and a known Fletcher-16 vector. No 4.8 MB fixture is committed.
- An optional check against the real files when a path is given in an environment variable, never in CI.

**As built (2026-11-14), done.** `src/common/zxnext/tbuFile.ts` and `test/zxnext/tbuFile.test.ts` (29
tests, unit tier, plus the opt-in real-file check). Notes for Phase 2:

- `isTbuFileName(path)` is the base-name test for D1; the registry's new `matchType: "name"` should use
  the same rule.
- Problems are `{ code, severity, record?, otherRecord? }`; severities are `error`, `warning` and `info`
  (`trailingData`). `partMismatch` and `tooBigForSlot` are errors; `recordLength`, `duplicateRecord`,
  `notSectorAligned`, `trailerMismatch` and `legacyNotNext` are warnings.
- **A shared image has one trailer**, and it can repeat only one of the records that use it (26.11a's
  `$00`/`$20`). `matchesRecord` is per record; `trailerMismatch` is reported only when the trailer
  repeats none of the group.
- A record with zero sectors counts as `imageOutOfRange`. A record length under 15 stops the index walk
  (`recordLength` + `indexNotTerminated`); a longer one is walked by its length.
- Fletcher-16 sums 359 bytes before each modulo; one pass over the 4.8 MB file is fast enough to run when
  the file opens (D4). An image shared by several records is summed once.
- `TBU_REAL_FILES=<path>:<path> npm test -- test/zxnext/tbuFile.test.ts` checks real files. The
  3.02.03 and 3.02.03 HDMI maker files, the KS2 image's 3.01.10 file and the 2019 legacy file all read with
  no problems, every checksum matching, every part identified (XC6SLX16, XC7A15T, XC7A35T) and every
  trailer matching its record.

### Phase 2a — Bitstream packet decoder (D8)

- `src/common/zxnext/xilinxBitstream.ts`: `decodeBitstreamPackets(bytes, start, end, family)` returns the
  packet list (offset, type, op, register number and name, word count, the first value, command name);
  stops at the end, at a word it cannot read (reported, not thrown) or at a limit of packets.
- Register and command tables from UG380 and UG470, cited in the file; unknown registers shown by number.
- Tests on bitstreams built in the test, both families, plus the opt-in real-file check.

**As built (2026-11-14), done.** `src/common/zxnext/xilinxBitstream.ts` and
`test/zxnext/xilinxBitstream.test.ts` (11 tests; with `TBU_REAL_FILES` every image of the four real files
decodes to its last data byte and ends with a DESYNC). What the real bitstreams taught:

- **A Spartan-6 Type 2 header names its own register** ([10:5], UG380 Table 5-26), unlike 7-series,
  where it writes the previous Type 1 packet's register. The Issue 2 bitstream's frame data follows a CMD
  write, so taking the previous register calls it CMD.
- **Spartan-6 frame data is followed by a 32-bit AUTO CRC word** (UG380 Table 5-50); it is kept on the
  FDRI packet (`autoCrc`) and counted in its bytes.
- The Issue 4/5 bitstreams write commands `$12` and `$13`, absent from UG470 v1.10; they are named
  BSPI_READ and FALL_EDGE as UG570 names the same codes. Register `$13` is undocumented (Project X-Ray
  says so too) and is shown by number.
- A NOP's address field is 0; it is shown with no register, not as CRC. Runs of NOPs are one packet
  with a `repeat` count (Issue 4 has a run of 100 and one of 329).
- The 2019 legacy image is padded with `$00` after its DESYNC; `$00` and `$FF` runs both end the list as
  `padding`.
- Packet counts: Issue 2 (3.02.03) 46, Issues 4/5 42; frame data is 99.9% of each image.

### Phase 2b — Viewer and registration

- A mockup of the details with the Bitstream section, for review, before the panel is built.
- `src/renderer/appIde/DocumentPanels/Next/TbuFileViewerPanel.tsx` on `GenericFilePanel` and the
  `@renderer/controls/data` primitives (`DataPanel`, `DataRow`, `PanelHeader`, `HexValue`,
  `EmptyState`); `ch` widths and row-size tokens (M1-M3); no colour literals.
- `TBU_VIEWER` id in `src/common/state/common-ids.ts`; the panel and the file-type entry in
  `src/renderer/registry.ts` (`isBinary`, `isReadOnly`, `openPermanent`, an icon; the `matchType` from
  Phase 0), placed before any entry that could match it first.
- Every text through `t()` with translator context in `src/common/i18n/locales/en/`; `npm run i18n:keys`.
- A jsdom render test of the panel on a built file (rows, a problem shown, a checksum mark).
- Verify in the running IDE on the three real files (screenshot), and update
  `dev/ai/ui-theming-intent-and-lessons.md` only if a new style rule comes out of it.

**As built (2026-11-14), done.** The Bitstream section uses style 3, the listing (chosen by the project
author from the mockup).

- `TbuFileViewerPanel.tsx` (+ `.module.scss`): four `ExpandableRow` sections, File, Cores, Core n and
  Bitstream, each with its expanded state and the selected record in the document's view state. The
  dumps are `SmallIconButton`s in the headings: the header in File (and the single image of a legacy
  file beside it), the image in the core's heading.
- **The file map is the tape viewer's `TimelineStrip`**, as the theming rules require of a proportional
  strip, not the labelled, hatched blocks of the mockup: tones `header` / `code` (Next core images) /
  `data` (others) / `unplayable` (an image with an error), one segment per distinct image. Padding sizes
  are in the core's details instead.
- Registry: `matchType: "name"` (new; base name, either separator) with `ignoreCase`, before `.nex`.
  `test/renderer/tbuFileType.test.ts` pins it (10 cases).
- Texts: 95 keys under `panels.next.tbu.*`. Problem, board and stop texts come from whole-key tables,
  so the catalog check sees every key (template-built keys were reported unused).
- Colours: `--color-tbu-ok/-warning/-error` (status hues), `--bgcolor-tbu-selected` (accent subtle),
  `--color-tbu-block` (secondary accent, for frame-data rows); the listing takes the disassembly set.
  The rules are folded into `dev/ai/ui-theming-intent-and-lessons.md`.
- `test/renderer/TbuFileViewerPanel.test.tsx` (5 tests): sections, selection, a damaged image, a
  non-TBU file, the dumps.
- Checked in the running IDE with the doc-shots harness (a temporary recipe, not committed) on the
  3.02.03 file, the KS2 image's file and the 2019 legacy file: no console errors. The running app
  showed one bug the tests could not: the Slot column wrapped "1 · Next core" and doubled every row's
  height; the cells are now one line (`nowrap`, ellipsis).

### Phase 3 — Extract an image (optional, after review of Phase 2)

- "Save image as…" per core: writes the image as `maketbu pull` would (all its sectors, trailer included)
  through the existing save-file dialog, after re-checking the checksum.
- Ask before starting it: it is the one write the viewer would make.

**Skipped (2026-11-14), decided by the project author; kept as an open idea.** Klive has no use for an
extracted image (its Next is an emulator, it never runs a bitstream), flashing from outside uses the
distribution's own files, and rebuilding a TBU from pulled images risks a bricked slot 1. The image's
bytes are already one click away as a memory dump. Pick it up if a concrete need appears, such as
diffing the three Issue 2 variants (`$00`/`$10`/`$20`) to learn which is HDMI and which VGA; a script
answers that once without the viewer writing files.

### Phase 4 — Docs and bookkeeping

- Correct the article's `fig:tbu` (`ZXNFILE` → `TBUFILE`, the formats told apart by the machine string),
  regenerating it through `docs/authoring/next-fpga-boot/boot-figures.cjs`, and the paragraph after it;
  apply the same correction to `zx-next-book` if it shares the figure (ask first: another repository).
- Mention the viewer in the article ("you can open TBBLUE.TBU in Klive to see this") and in the Next
  guides page that lists Next file viewers, if there is one; `npm run doc:build && npm run doc:check`.
- One `feature` changeset with the commit that finishes Phase 2 (or Phase 3 if it is done); none for the
  intermediate commits.

**As built (2026-11-14), done.**

- Article: `fig:tbu` corrected in its generator (`0–7: TBUFILE`, record byte 1 is the **type**) and
  regenerated; only that figure changed. The caption and the paragraph after it now say both formats
  start with `TBUFILE` and the older one has no `ZX SPECTRUM NEXT`; a new paragraph links the viewer.
  The figure was checked as a picture in both themes from the built page. **`zx-next-book` was not
  touched** (another repository): its copy of the figure still says `ZXNFILE` and needs the same fix.
- Guide: `docs/content/en/guides/next/tbu-files.mdx`, "Core update files (TBBLUE.TBU)", after The SD
  card, plus a row in the guides' task index. Its screenshot comes from a new `tbu` step in
  `dev/scripts/doc-shots/recipes/guides-next.cjs`, which needs `DOC_SHOTS_TBU` (a real TBBLUE.TBU; the
  repository carries none) and is skipped without it. The published image was taken from the 3.02.03
  maker file with the Issue 4 core selected; only that image was published.
- Goldens: the route and the image added. `npm run doc:build && npm run doc:check` pass (prose: 0
  findings).
- Changeset: `dev/changes/tbblue-tbu-viewer-c0f6.md` (feature).

## 5. Risks and open questions

- **No specification.** The updater may accept things the maker never writes (e.g. a record length other
  than 15). The viewer reports, it does not reject, so a strict reading costs only a spurious warning.
- **Article vs files.** If the 26.11a file really does use `ZXNFILE`, §1 and the fix in Phase 4 change; the
  Phase 0 check settles it before any doc edit.
- **Issue 2 HDMI/VGA.** Since 3.03.00 Issue 2 has two cores, but the index record cannot tell them apart;
  the viewer can only say which by comparing with a known image, so it will not try.
- **Board variants.** The meaning of the board byte's high nibble (`$10`, `$20`, `$40`) is not known
  (§1a). The viewer shows it raw with "variant n"; a name is added only when a source states it.
- **Open:** should the File Manager's F3 viewer and the SD-card Disk Explorer offer the same view for a
  `TBBLUE.TBU` inside an image (a later step reusing the parser)? (`TBBLUE.HDMI.TBU` is settled: §1a.)
