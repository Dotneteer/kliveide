# Disk images and file systems: hardened DSK, a disk explorer, and DivMMC hard-disk images

Status: 📝 **accepted** (2026-10-23), not started. The author's decisions are in §9; phases run in
the order of §7 (A0–A2 → B → A3 → C).
Base plan: [CLOSING_THE_GAPS_PLAN.md](CLOSING_THE_GAPS_PLAN.md), §G9 (G9.5).
Related: [BETA128_TRDOS_PLAN.md](BETA128_TRDOS_PLAN.md) (done; its "TRD/SCL catalogue viewer" was
left undone, and Part B delivers it), [PLUS3_AMSTRAD_ROMS_PLAN.md](PLUS3_AMSTRAD_ROMS_PLAN.md)
(done; the Amstrad ROMs this plan uses as the +3DOS oracle),
[SNAPSHOT_SAVING_AND_STATE_FILES_PLAN.md](SNAPSHOT_SAVING_AND_STATE_FILES_PLAN.md) (D12/D18: how
mass-storage images are referenced by state files).

> **Standing rules.** This is roadmap item G9.5 (Q1). Each part that ships updates the "Tape /
> disk" row (§2) and, where it closes one, the gap table (§4) of
> [LANDING_PAGE_COMPETITIVE_ANALYSIS.md](LANDING_PAGE_COMPETITIVE_ANALYSIS.md), and marks its part
> of G9.5 done in the base plan, in the same change. Every visual
> change (the explorer, the layout view, the media strip, menus) updates
> `.ai/ui-theming-intent-and-lessons.md`. Every new text goes through `t()` with translator context
> (`.ai/i18n-guide.md`). The changeset comes with the commit that completes each **part** (A, B, C),
> not with each phase.

---

## 1. What is being added

Three related pieces, each usable on its own:

- **Part A: hardened `.dsk` support.** A test corpus of awkward images, the parser, creation and
  write-back bugs fixed, an EDSK writer, and a +3 floppy controller that honours each sector's own
  geometry instead of flattening the disk.
- **Part B: a Disk Explorer for floppy images.** It opens `.dsk` (+3DOS), `.trd` and `.scl` (TR-DOS)
  and works mainly with **files**: list, preview, add, extract, delete, rename, attributes, new disk,
  and putting a build on a disk. A second **Layout** view shows the low-level structure (sides,
  tracks, sectors), coloured by which file or system area owns each sector.
- **Part C: hard-disk images for the classic Spectrums.** A **DivMMC** interface (esxDOS) on the
  48K, 128K and +2A/+3, with FAT16/FAT32 SD card images (`.img`, `.hdf`, and the Next's `.cim`).
  The same Disk Explorer browses and edits them.

The user's focus is **using and managing the file system**. The low-level view is there to explain
and debug, not as the main way in.

**Out of scope:** `.ipf`, `.hfe`, `.scp` and other flux formats; DISCiPLE/+D (`.mgt`) and Opus
(`.opd`), which need new interface hardware; FDI/UDI/TD0; FAT12 (Q5); copy-protection schemes beyond
what EDSK itself records (weak sectors, odd sizes, status bytes); writing NextZXOS-specific
metadata.

**Later, in their own plans:** DivIDE (Q6), DivMMC on the Pentagon and Scorpion (Q4), and the +3E's
own IDE interface with IDEDOS `.hdf` disks (Q7).

## 2. What the code looks like today

All facts below were found in the source on 2026-10-23. The bugs marked ✓ were confirmed by reading
the code; the others come from a survey and are re-checked by a failing test in Phase A1 before they
are fixed.

### 2.1 Floppy model and parsing

- `src/emu/machines/disk/disk-readers.ts` reads standard (`MV - CPC`) and extended
  (`EXTENDED CPC`) DSK into `DiskInformation` (`DiskInformation.ts`: tracks with C/H/R/N, ST1/ST2,
  `actualLength`, `sectorDataPosition`). **No DSK writer exists**; changes are patched in place.
  - ✓ It refuses more than 42 tracks (":89-95", "incompatible with the +3"), so 80-track disks
    for drive B cannot be opened.
  - The weak/multiple-copy test compares the wrong quantities and inverts the modulo, so
    `multipleWeakSectors` is effectively never set.
  - A standard-DSK sector size of N = 0 or N > 6 is taken as the whole track size.
  - Track-Info headers longer than 256 bytes (more than 29 sectors) and the v5 Offset-Info block are
    not handled.
- `DiskSurface.ts` builds MFM/FM raw tracks for the viewer. It writes `actualLength` bytes into a
  slot sized `128 << N`, which overruns when a sector stores several copies.
- `src/common/utils/create-disk-file.ts`:
  - ✓ `isDoubleSided = diskFormat.endsWith("d")` is false for both `ds` and `dse`, so every DSK it
    creates is 40-track single-sided.
  - It writes no +3DOS disk-specification sector. An all-`E5` disk reads as an empty format-0 disk
    only by luck.
- **TR-DOS** has a full React-free library in `src/emu/machines/disk/trd/trdImage.ts`: catalogue and
  disk-info readers, append-only `addTrdFile`, `trdBasicFile`/`trdCodeFile`, SCL↔TRD,
  `createBlankTrd`. There is no delete, rename or compaction, and only tests use the catalogue
  functions.

### 2.2 Controllers and write-back

- **+3:** a simplified uPD765 in C (`zxSpectrumP3e/wasm/spp3e/spp3e.c`) on a flat buffer, 512K per
  drive. It handles one sector per command (no run to EOT) and treats read-deleted as plain read.
  WRITE ID (format) and SCAN are missing, READ ID always returns the first sector ID, and it uses no
  ST1/ST2 from the image.
  - The host `ZxSpectrumP3eWasmV2Machine.createWasmDiskPayload` flattens the disk to one uniform
    geometry: the largest sector count, the smallest R and the largest sector length. Protected or
    mixed-size disks lose fidelity here.
- The legacy TypeScript uPD765 (`FloppyControllerDevice.ts`, 2361 lines) runs only in tests now.
- **Beta 128:** a WD1793 in C (`zx-spectrum-beta128.c`) on a canonical 16 × 256 layout, with
  `Beta128Disks.ts` on the host side. This works and is not changed by this plan.
- **Write-back** keys a changed sector as `trackIndex * 100 + R` (`disk-changes.ts`,
  `RendererToMainProcessor.saveDiskChanges`, `collectWasmDiskChanges`):
  - R ≥ 100 (e.g. the CPC data format's `C1`–`C9`) collides with the next track.
  - Duplicate sector IDs (protection) are ambiguous.
  - Main writes the WASM's uniform `data.length`, which can overwrite the next sector on mixed-size
    disks.
- `EmulatorPanel.saveDiskChanges` runs the DSK patcher on whatever disk is mounted. On a `.trd` this
  probably throws and reports "Updating attached disk media failed" (not run; Phase A1 checks it).

### 2.3 Viewing and building

- `.dsk` opens in `DocumentPanels/DskViewerPanel.tsx`, a physical/logical track and sector browser
  with hex. It shows **no files**. `hasWeakSectors` is always true (✓: it tests
  `weakSectorData.length > 0`). There is no viewer for `.trd`, `.scl`, `.img`, `.hdf` or `.cim`.
- **No +3DOS directory reader or writer exists.** A `.dsk` build output is made by z88dk's
  `appmake` (`z88dk-targets.ts`). Klive's own compilers cannot produce a `.dsk` or a `.trd`.
- **Reusable for previews:** `DocumentPanels/basicListing.ts` (Spectrum BASIC listing), the tape
  block browser's screen and hex views, and the static disassembly used by the tape and NEX viewers.

### 2.4 Mass storage

- **No DivMMC, DivIDE, IDE or `.hdf` support exists on any classic core.** The +3E ROMs contain an
  IDE driver, but `spp3e.c` emulates no IDE hardware.
- **The Next has all the parts, Next-specific:**
  - `zxnext-divmmc.c` (port `$E3`, conmem, mapram, automap, NMI), tied to NextRegs.
  - `zxnext-sd.c` (SPI SD protocol, CRCs, two cards).
  - It pulls sectors on demand: the WASM raises a host command, then the renderer, IPC and main
    `CimHandler` serve it (`RendererToMainProcessor` :1192–:1230, guarded by `sd-card-access.ts`).
  - Writes are journaled for reverse debugging (`SdUndoLog.ts`).
- **A FAT32 driver** lives in `src/main/fat32/` (`Fat32Volume`, `FatFile` with LFN, `FileManager`),
  used by `ncp` (`ZxNextStorageCopyCommand`). It is **FAT32 only** and is built on `CimFile`, not on
  a generic sector device.
- **Machine options** come from the model (`MC_DISK_SUPPORT` on Pentagon/+3) and from user-ROM
  settings (`trdosRom`, the pattern for any firmware Klive cannot ship). Device menus are wired in
  `machine-menu-registry.ts`; media ids in `project-const.ts` (`MEDIA_SD_CARD` exists).
- **References in the repo:**
  - `_input/MMC+Specification+version+4.2.pdf`
  - `_input/NextZXOS_and_esxDOS_APIs.pdf`
  - `_input/765.pdf`
  - the Next FPGA's DivMMC VHDL under `_input/next-fpga/`
- **Fixtures:**
  - `test/testfiles/blank180K.dsk` and `ltk.dsk` (used).
  - Four broken DSKs, unreferenced by any test.
  - Two `appmake`-made EDSKs with a real +3DOS file (`test/z88dk/fixtures/tpl-spp3e*/program.dsk`).
  - No `.trd`, `.scl`, `.img` or `.hdf` files.

## 3. Decisions (accepted by the author, 2026-10-23; the answers to the open questions are in §9)

- **D1. One file-system layer, React-free, process-agnostic.**
  - It lives in `src/common/diskfs/`, with an interface `DiskFileSystem` (`info`, `list(dir)`,
    `stat`, `read`, `write(name, data, meta)`, `delete`, `rename`, `setAttributes`, `mkdir` where
    the FS has directories, `freeSpace`, `capabilities`, and `ownerOf(sector)` for the Layout view).
  - The file systems are `Plus3DosFs`, `TrdosFs` and `FatFs`.
  - They work on a `BlockDevice` (`sectorSize`, `sectorCount`, `read(lba)`, `write(lba)`): a
    floppy's logical sectors in +3DOS/TR-DOS order, or a hard image's LBAs.
  - The Disk Explorer, IDE commands, the CLI and the compilers all use this one layer.
- **D2. Images are models, not byte patches.**
  - `DskImage` parses into a per-track, per-sector model and **serializes** back to EDSK (or to
    standard DSK when the geometry allows and the file was standard).
  - Write-back addresses a sector by its **physical position** (side, track, index in track), never
    by `track * 100 + R`.
  - `TrdImage` wraps `trdImage.ts`. Hard images get `RawImage` (`.img`), `HdfImage` (RAMsoft HDF
    header) and the existing `CimFile`, all behind `BlockDevice`.
- **D3. Where the work runs.** All edits run in the **main process** through a `DiskImageService`
  over MainApi (`open`, `list`, `read`, `write`, ...), so a 4 GB SD image is never copied to the
  renderer and the CLI shares the code. Floppy images are small and are loaded whole; hard images are
  read by sector.
- **D4. Mounted media are coordinated, not locked.**
  - Opening an image that is mounted in the running machine shows a "mounted in drive A" badge.
  - **An edit pauses the machine**, waits until the controller is idle (no command in progress),
    flushes the machine's pending disk writes to the file, writes the edit, re-uploads the floppy (or
    invalidates the SD card handler, as `ncp` does), then resumes. Neither side can overwrite the
    other's changes.
  - The edit invalidates reverse-debugging checkpoints and the execution history, like an SD write.
  - The opposite direction (the machine writing to a disk the explorer shows) refreshes the explorer.
- **D5. Safe writes.** Every floppy edit writes to a temporary file and renames it over the image.
  The first edit in an editing session keeps one `.bak` of the floppy image (at most 800 KB). Hard
  images can be gigabytes: they get no `.bak`, are written in place sector by sector, and rely on the
  existing SD card backup (`sd-card-backup.ts`).
- **D6. DivMMC is a machine option, not a model.**
  - A new config key `MC_DIVMMC` is offered in the machine select dialog for the 48K, 128K and
    +2A/+3 models (Q4). It is not offered on the Pentagon or Scorpion.
  - The esxDOS ROM is **user-supplied**, like the TR-DOS ROM (a new setting
    `SETTING_EMU_ESXDOS_ROM`). Klive ships no esxDOS files.
  - "Prepare card" copies the user's esxDOS distribution (`SYS/`, `BIN/`) onto a new image.
- **D7. One DivMMC device in shared C.**
  - `zxnext-divmmc.c` and `zxnext-sd.c` move their machine-independent logic into
    `src/emu/machines/zxSpectrum/wasm/common/zx-spectrum-divmmc.c` and `zx-spectrum-sd.c`.
  - Hooks cover the Next-specific parts (NextReg control of automap, the Next's own NMI).
  - The Next and the classic cores `#include` the same files, as the Beta 128 does.
  - The Next's harness tests must pass unchanged after the move.
- **D8. Provenance.** The sources are:
  - **+3DOS:** Amstrad's +3 manual (disk specification, directory, the 128-byte `PLUS3DOS` header) and
    the CP/M 2.2 directory format.
  - **TR-DOS:** what `trdImage.ts` already records.
  - **FAT16:** Microsoft's FAT specification.
  - **HDF:** its public format note.
  - **DivMMC:** the Next FPGA VHDL and the MMC specification.

  No code is copied or translated from GPL tools or emulators (cpmtools, hdfmonkey, libdsk, Fuse,
  ZEsarUX). Facts found by running the real +3 ROM or a user's esxDOS are recorded in Klive's words.
- **D9. Test images are Klive's own.**
  - A fixture builder (`test/diskfs/fixtures/build-fixtures.ts`) writes every corpus image from code
    through the Part A writer.
  - The Amstrad +3 ROMs (which Klive ships) are the **oracle** for +3DOS: what Klive writes, the +3
    must `CAT` and `LOAD`; what the +3 writes, Klive must list and extract.
  - Real-world images stay outside the repository: `KLIVE_DISK_CORPUS=<dir>` runs a parse,
    round-trip and catalogue sweep over a local collection in the slow tier only.

## 4. Part A: hardened `.dsk` support

### Phase A0: corpus and EDSK writer (S–M)

1. Write `DskImage` (D2): parse into the model and serialize to EDSK and standard DSK. Round-trip
   `blank180K.dsk`, `ltk.dsk` and both `appmake` disks byte-identically.
2. Write the fixture builder. It produces:
   - +3 format 0 (40 × 1 × 9 × 512)
   - CPC data (R = `C1`–`C9`) and system formats
   - 80-track double-sided
   - mixed N per track
   - N = 6 and N = 0 sectors
   - a sector with `actualLength` < its N size
   - weak sectors stored as 2 and 3 copies
   - duplicate R in one track
   - deleted-data marks (ST2 bit 6)
   - CRC errors in ST1/ST2
   - unformatted tracks
   - more than 29 sectors in a track
   - a v5 Offset-Info block
3. Wire the four unreferenced broken DSKs in `test/testfiles/` into tests as reject cases with a
   clear error each.

### Phase A1: parser and model fixes (S)

Each fix starts with a failing test from A0. The fixes:
- Drop the 42-track limit. Per Q3, the drive takes its geometry from the image (up to the
  controller's cylinder limit), with no 40/80-track drive setting; +3DOS reports a disk it cannot
  read on its own.
- Fix the weak-sector detection; N = 0 / N > 6; long Track-Info headers; Offset-Info.
- Fix `DiskSurface`'s copy overrun; fix `hasWeakSectors` in the viewer.
- Check the `.trd`-through-the-DSK-patcher path in `EmulatorPanel.saveDiskChanges`; route each
  format to its own write-back.

### Phase A2: creation and write-back (S–M)

- `create-disk-file.ts` builds through `DskImage`: correct single- and double-sided disks, 40 and
  80 tracks, and a +3DOS disk-specification sector for formats that carry one.
- Write-back keys sectors by physical position (D2) in `disk-changes.ts`, `saveDiskChanges` and the
  host's change collection. Each sector writes its own length.
- Tests:
  - R ≥ 100 and duplicate-R writes land in the right place.
  - A +3 `SAVE` to a mixed-size disk changes only that sector (checked through the `sp128` harness's `spp3e` session).

### Phase A3: a per-sector +3 controller (M–L; runs after Part B, see §7)

- `createWasmDiskPayload` uploads a **sector table** per track (C, H, R, N, ST1, ST2, data offset,
  copies) instead of a flattened geometry.
- In `spp3e.c`:
  - READ DATA runs to EOT with multi-sector transfers.
  - READ ID cycles through the track's real IDs.
  - READ DELETED DATA and the deleted-mark skip rules work.
  - The image's ST1/ST2 come back on read.
  - WRITE ID (format) and SCAN are implemented, written from `_input/765.pdf`.
- `test/wasm/debug-loop-equivalence.test.ts` must still pass; the new volatile state follows the
  WASM README's rule.
- Hardware tests in `test/sp128-hw/plus3-fdc/` (the `sp128` harness runs `spp3e`) for each command. The +3's own
  `FORMAT` (via the +3 ROM) must produce a disk that `DskImage` reads and `Plus3DosFs` lists.

### Phase A4: weak sectors (S, optional)

When a sector has several stored copies, each read returns the next copy, as hardware returns
varying data. This is a speedlock-style test from the corpus. No other protection emulation.

## 5. Part B: the Disk Explorer (floppies)

### Phase B0: the file-system layer (M)

- Create `src/common/diskfs/` (D1) and the `DiskImageService` in main (D3), with `open`, `close`,
  `info`, `list`, `read`, `write`, `delete`, `rename`, `setAttributes`, `format` and `layout`.
  Wire it through MainApi.
- A file's metadata is a common shape:
  - name, extension, size
  - **kind** (BASIC, CODE, number array, character array, headerless/raw, directory)
  - BASIC's auto-run line and variables offset; CODE's load address
  - attributes (read-only, system, archive)
  - +3DOS user area
  - the sectors it occupies, as a list for the Layout view.

### Phase B1: +3DOS read (M)

`Plus3DosFs`:
- disk specification (format 0 and the CPC system/data formats)
- block size and directory size from the spec
- the CP/M directory (extents, user areas 0–15, deleted entries in user `E5`, attributes in the
  high bits of the extension)
- the 128-byte `PLUS3DOS` header with checksum
- files without a header shown as raw.

Tests: the `appmake` disks, the A0 fixtures, and disks written by the real +3 in the harness
(`SAVE "x"`, `SAVE "s" SCREEN$`, `SAVE "c" CODE`, an array) and listed by Klive.

### Phase B2: +3DOS write (M)

- Add a file with a header, delete, rename, set attributes, change the user area, and format with
  the chosen spec.
- Block allocation follows the directory's own allocation map; full disk and full directory are
  clear errors.
- The oracle test (D9): Klive writes a BASIC program, a `SCREEN$` and a CODE block to a fresh disk.
  The +3 boots it, `CAT` lists exactly those names and sizes, and `LOAD`/`RUN` gives the expected
  screen.

### Phase B3: TR-DOS completion (S–M)

`TrdosFs` over `trdImage.ts`:
- delete (TR-DOS marks it deleted)
- **compaction** (the TR-DOS `MOVE` equivalent, recovering deleted space)
- rename
- disk label
- `.scl` opened read-write in the explorer (a save offers `.trd` or `.scl`, as the menu does)

Tests run the existing harness. A run with the real TR-DOS ROM happens only when the user's ROM is
present locally (`KLIVE_TRDOS_ROM`), never in CI.

### Phase B4: the Disk Explorer panel, Files view (M–L)

- One document panel, `DocumentPanels/DiskExplorer/DiskExplorerPanel.tsx`, registered for `.dsk`,
  `.trd` and `.scl` (and later `.img`, `.hdf`, `.cim`). It replaces `DskViewerPanel`; the old panel's
  views move into the Layout view (B5), and its file is deleted.
- **Header:**
  - the image kind, geometry, file system, label, and used/free space as a bar
  - the "mounted in drive A/B" badge (D4)
  - write-protect state.
- **Files table** on `@renderer/controls/data`:
  - columns for name, type, size, start address or line, attributes and user area
  - sorting
  - deleted entries shown on request, with "undelete" where the FS allows it.
- **Preview pane** for the selected file:
  - a BASIC listing (`basicListing.ts`)
  - `SCREEN$` as a picture (reusing the tape browser's screen view)
  - CODE as hex or disassembly at its load address
  - arrays as values
  - raw as hex.
- **Actions** (toolbar, context menu and keyboard):
  - Add files from the host or by **dragging from the project explorer**, with the header taken from
    the file kind: `.bas` text is tokenised (no Spectrum BASIC text-to-token tokenizer exists yet; B4 adds one in
    `src/common/`, the inverse of `basicListing.ts`), `.scr` becomes
    `SCREEN$`, other binaries become CODE with a load address asked for.
  - Extract (raw, or with a `.tap` wrapper).
  - Delete, rename, attributes, New disk (format and label).
  - Open the image in the Layout view with the file's sectors highlighted.
- Shared shell pieces follow the Z88 slot browser's `BankBrowser` pattern where they fit.
- Built with the MVC split in `.ai/ui-mvc-guide.md` for the async actions (add, delete, format), so
  they are tested without rendering.

### Phase B5: the Layout view (low level) (M)

- A grid of **side × track**; each track shows its sectors as chips in physical order.
- Chips are coloured by owner: boot/spec, directory, a file (hovering names it), free, unformatted,
  and an error (ST1/ST2, weak, deleted).
- Selecting a chip shows C/H/R/N, ST1, ST2, actual length, copies and a hex view. Where the FS can
  say which file owns the sector, it names the file and the offset.
- Selecting a file in the Files view highlights its sectors here, and the reverse.
- The raw MFM track view from today's panel stays available as a toggle ("Show surface").
- TR-DOS images get the same grid (16 sectors × cylinders × sides).

### Phase B6: integration (M)

- **Mounted media** (D4): pause, write, re-upload, resume; refresh on machine writes.
- **IDE commands** in the command prompt, the same set for every image kind, so recipes and CI use
  them too: `disk ls <image> [dir]`, `disk cp <src> <dst>` (with `img:` prefixes, like `ncp`),
  `disk rm`, `disk mv`, `disk new <image> --format <f>`, `disk info`. `ncp` becomes an alias of
  `disk cp` on the Next's card.
- **Building to a disk:** Klive's own export (`ExportCodeModel`, `KliveCompilerCommands`) gains
  `-f dsk` and `-f trd` (with a BASIC loader, as the tape export generates), so a Klive assembly or
  Klive BASIC build no longer needs z88dk to produce a disk.
- **Automation API / CLI:** `klive disk ...` mirrors the IDE commands (`COMMAND_LINE_AUTOMATION_PLAN.md`).

### Phase B7: documentation (S)

- A guide page "Working with disk images" under `docs/content/en/guides/`, with screenshots generated
  by `scripts/doc-shots/`.
- Update the IDE commands reference.
- Close the Beta 128 plan's catalogue-viewer item by pointing to this plan.

## 6. Part C: hard-disk images

### Phase C0: references and decisions (S)

- Record the DivMMC port and automap facts from the Next VHDL and the HDF header layout in
  `.ai/diskfs/` (new): ports `$E3` control, `$E7` card select, `$EB` SPI data; automap entry points
  and the off-area.
- Check esxDOS's licence for distribution. The plan assumes user-supplied (D6).

### Phase C1: block devices and FAT16 (M)

- Add `BlockDevice` over `RawImage` (`.img`: an MBR with partitions, or a "superfloppy" with no
  MBR), `HdfImage` (`.hdf`, both header versions) and the existing `CimFile`.
- Refactor `src/main/fat32/` onto `BlockDevice`, with no behaviour change for `.cim` (the `ncp`
  tests pass unchanged). Then add **FAT16**. No FAT12 (Q5): esxDOS uses FAT16 and FAT32.
- Tests: images written by Klive's own formatter; the existing `.cim` tests; a FAT16 image round
  trip.

### Phase C2: the explorer for hard images (M)

- Register `.img`, `.hdf` and `.cim` with the Disk Explorer:
  - folders with long file names
  - the same file actions
  - a **partition picker** in the header
  - "New image" (size, FAT16/FAT32, optional esxDOS preparation).
- **Layout view for hard images:**
  - the partition table
  - the volume's regions (reserved, FATs, root, data) as a proportional bar
  - a cluster map bucketed for large volumes
  - a file's clusters highlighted
  - LBA hex view.
- The **Next's SD card gets this explorer too**, which it has never had.

### Phase C3: shared DivMMC and SD in C (M)

- Extract the machine-independent DivMMC and SD logic (D7).
- The Next's hardware tests (`test/zxnext-hw/`) and its NextZXOS boot must pass unchanged. This
  phase changes no behaviour.

### Phase C4: DivMMC on the classic cores (M–L)

- Include the device in `sp48.c`, `sp128.c` (the 128K model only) and `spp3e.c`. Enable it at hard
  reset when `MC_DIVMMC` is set and the user's ROM is present.
- Cover the 8K ROM, 128K RAM banks, conmem/mapram, automap on the documented entry points (instant
  and delayed), the NMI button, and the SD card on the same pull-per-sector path as the Next.
- Hardware tests with a Klive test ROM (like `test/sp128-hw/beta128/test-rom.ts`) drive SPI and
  paging without esxDOS.
- The debugger shows the DivMMC ROM and RAM as memory partitions.

### Phase C5: media, menus, state (M)

- An SD card device menu and media strip entry on DivMMC machines.
- The esxDOS ROM setting; "Prepare card".
- Media restored with the project.
- `.kls`/`.klr` reference the card by fingerprint (D12/D18).
- Writes journaled in `SdUndoLog` for reverse debugging.
- `.szx` writes the DivMMC block where the format has one.

### Phase C6: esxDOS end to end (S–M)

- With a user's esxDOS ROM and files: boot to the esxDOS banner, `.ls`, load a `.tap` from the card,
  `.snapload`.
- Klive-written files are visible to esxDOS; esxDOS-written files are visible in the explorer.
- This runs locally only (`KLIVE_ESXDOS_DIR`), like the TR-DOS check, and its results are recorded
  in Klive's words.

## 7. Order and size

The author's order (Q9) is **A0–A2 → B → A3 → C**:

1. **A0 → A1 → A2** first: Parts B and C build on the writer and the fixed write-back.
2. **Part B** (B0–B7) next. The explorer needs only A0–A2, so file management is usable before the
   controller work.
3. **A3** (and the optional A4) after B. It improves how existing software runs, not file
   management. It may run beside B if someone is free, since it touches only the +3 core and its
   host adapter.
4. **Part C** last: C0 → C1 → C2, then C3 → C6. C1–C2 meet Part B only in the shared `diskfs`
   layer, whose interface B0 fixes.

| Part | Phases | Size |
|---|---|---|
| A. Hardened DSK | A0–A2, then A3 after Part B (A4 optional) | M–L |
| B. Disk Explorer | B0–B7 | L |
| C. Hard-disk images | C0–C6 | L |

## 8. Verification

- **Per phase:**
  - focused tests
  - `npm run build:check`
  - `npm run lint:renderer` for UI phases
  - `npx electron-vite build --config build/electron.vite.config.ts` after moving files (D7, B4).
- **Tiers:**
  - Fixture parsing and FS tests are unit tier.
  - Anything booting a core (the +3 oracle, DivMMC tests) goes in `build/e2e-tests.ts`.
  - The `KLIVE_DISK_CORPUS` sweep and exhaustive format matrices go in the slow tier.
- **Before each part completes:** `npm run test:slow`; the explorer checked in the running app (CDP
  recipe in `.ai/ui-theming-intent-and-lessons.md`), not in a replica.
- **Part C:** the Next's `test/zxnext-hw/` suite and NextZXOS boot are the regression gate for D7.

## 9. Decisions from the author (2026-10-23)

1. **Roadmap:** this is roadmap item **G9.5** in `CLOSING_THE_GAPS_PLAN.md`, with the standing
   competitive-analysis update.
2. **Mounted images:** editing is allowed. The machine pauses, the controller is let finish, the
   machine's pending writes are flushed, then the edit is written and the disk re-uploaded (D4). All
   editing runs in main (D3).
3. **80-track disks:** any image is accepted and the drive takes its geometry from it. No 40/80-track
   drive setting for now; one is added only if software that checks the drive type misbehaves.
4. **DivMMC machines:** the 48K, 128K and +2A/+3. The Pentagon and Scorpion are left out: their
   software is mostly on TR-DOS, and DivMMC's automap clashes with the Beta 128's `$3Dxx` paging.
   Adding them later means deciding which wins, in its own plan.
5. **FAT12:** not supported. esxDOS uses FAT16 and FAT32.
6. **DivIDE:** left out, recorded as a later step. Once DivMMC and `.hdf` exist it is cheap (the same
   paging, an IDE register file instead of SPI).
7. **+3E IDE and IDEDOS:** a separate, later plan. Its design notes (an ATA register file in
   `spp3e.c` over an `HdfImage`; an `IdedosFs` reading the +3E partition table, each +3DOS partition
   through `Plus3DosFs`) carry over to it.
8. **Backups:** every floppy edit is written safely (temporary file, then rename) and keeps one
   `.bak` per editing session. Hard images get no `.bak` and rely on the existing SD card backup (D5).
9. **Phase order:** A0–A2 → B → A3 → C (§7), so the file-focused explorer ships before the
   controller work.
