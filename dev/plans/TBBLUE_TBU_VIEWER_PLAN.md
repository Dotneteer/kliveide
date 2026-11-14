# TBBLUE.TBU Viewer Plan

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
| 1 | 1 | type | 1 = ZX Spectrum Next core (slot 1); 0 = anti-brick core (slot 0) |
| 2 | 1 | board ID | NextReg `$0F` value: board issue − 2 (0 = Issue 2, 1 = Issue 3, 2 = Issue 4, 3 = Issue 5) |
| 3 | 1 | core major | NextReg `$01`: major in the high nibble, minor in the low (`$32` = 3.02) |
| 4 | 1 | core sub-minor | NextReg `$0E` (`$03` → 3.02.03) |
| 5 | 4 | sector offset | Image start in sectors **after the header**: file offset = (offset + 1) × 512 |
| 9 | 4 | sector length | Image length in sectors |
| 13 | 2 | checksum | Fletcher-16 over every sector of the image (sum1 low byte, sum2 high byte, both mod 255, seeded 0) |

Image layout [src][bin]: the bitstream, padded with `$FF` to a fixed number of sectors (959 for boards 0-1,
4,287 for boards 2-3), then **one trailer sector**: `ZX SPECTRUM NEXT\0`, `ZXN ISSUE <n> <ANTI-BRICK|ZX
SPECTRUM NEXT>\0`, then a 7-byte flash record (length 7, type, board ID, core major, core sub-minor, a 16-bit
screen offset left at `$FFFF`), the rest `$FF`. So an image is 960 or 4,288 sectors (480K / 2,144K), which
fits the flash slot (512K / 2,176K). This trailer is what ends up at the end of the slot in flash.

What the real files show [bin]:

- 3.02.03: three records, Issue 2 / 4 / 5, all type 1; offsets and lengths add up exactly to the file size.
  The Issue 2 bitstream has the Xilinx sync word `AA 99 55 66` at byte 16 of its image (Spartan-6, 16-bit
  packets); Issue 4/5 at byte 304, with the IDCODE written at byte 400: `$0362E093` (Issue 4) and
  `$0362D093` (Issue 5) — Artix-7 device IDs, to be mapped to part names in Phase 0.
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
  `MYTBBLUE.TBU`; Phase 0 decides between `ends` with a leading separator and a new `matchType: "name"`
  (base-name equality, both separators). The new match type is preferred if it is a few lines.
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
   beyond the end of file or overlapping another, a file size that is not a whole number of sectors,
   duplicate board/type/version, checksum mismatch, trailer mismatch, and (informational) boards of the
   current profiles with no core in the file.
5. **Legacy files**: the summary shows hardware ID and name, version, stated vs actual size and the XOR
   checksum; the table has its single row; the trailer section is absent.

## 4. Phases

### Phase 0 — Spike (no product code)

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

### Phase 2 — Viewer and registration

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

### Phase 3 — Extract an image (optional, after review of Phase 2)

- "Save image as…" per core: writes the image as `maketbu pull` would (all its sectors, trailer included)
  through the existing save-file dialog, after re-checking the checksum.
- Ask before starting it: it is the one write the viewer would make.

### Phase 4 — Docs and bookkeeping

- Correct the article's `fig:tbu` (`ZXNFILE` → `TBUFILE`, the formats told apart by the machine string),
  regenerating it through `docs/authoring/next-fpga-boot/boot-figures.cjs`, and the paragraph after it;
  apply the same correction to `zx-next-book` if it shares the figure (ask first: another repository).
- Mention the viewer in the article ("you can open TBBLUE.TBU in Klive to see this") and in the Next
  guides page that lists Next file viewers, if there is one; `npm run doc:build && npm run doc:check`.
- One `feature` changeset with the commit that finishes Phase 2 (or Phase 3 if it is done); none for the
  intermediate commits.

## 5. Risks and open questions

- **No specification.** The updater may accept things the maker never writes (e.g. a record length other
  than 15). The viewer reports, it does not reject, so a strict reading costs only a spurious warning.
- **Article vs files.** If the 26.11a file really does use `ZXNFILE`, §1 and the fix in Phase 4 change; the
  Phase 0 check settles it before any doc edit.
- **Issue 2 HDMI/VGA.** Since 3.03.00 Issue 2 has two cores, but the index record cannot tell them apart;
  the viewer can only say which by comparing with a known image, so it will not try.
- **Open:** should `TBBLUE.HDMI.TBU` also open (D1)? Should the File Manager's F3 viewer and the SD-card
  Disk Explorer offer the same view for a `TBBLUE.TBU` inside an image (a later step reusing the parser)?
