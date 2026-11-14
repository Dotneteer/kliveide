# TBBLUE.FW Viewer Plan

**Status: done (2026-11-14).** Phases 0-4 are complete; each has an "As built" note below.

A read-only viewer for the ZX Spectrum Next's firmware file, `TBBLUE.FW`, built on the principles of the
TBBLUE.TBU viewer (`dev/plans/TBBLUE_TBU_VIEWER_PLAN.md`): a pure reader that never throws, problems as
codes, a viewer chosen from mockups, opened by the exact file name and from Machine › SD Card. It shows
which modules the file holds, which key starts each, where each sits, which firmware version it is, and
each module's code as a Z80 disassembly at the address it runs at.

Background: the Under the Hood article `docs/content/en/under-the-hood/emulator-internals/next-fpga-boot.mdx`,
"The firmware file".

## 1. What the file is (research, 2026-11-14)

### Sources

| Tag | Source |
|---|---|
| [src] | The firmware's published source, `gitlab.com/thesmog358/tbblue`, `src/firmware/` (`master`): the packer `firmware/src/main.c`, `hardware.h` (`FW_BLK_*`), `app/src/fwfile.c` (how a module is found), `app/src/modules.c` and `app/Makefile` (where a module runs), `app/src/boot.c` (the version text, the screens block). GPL: read for **interface facts only**, no code used. The original packer, `github.com/fbelavenuto/TBBlue` `ROMs/bootrom/makefirmware/src/main.c`, has the same layout. |
| [bin] | Real files: firmware 1.44 (`ks2-base.cim` and the KS2 image), 1.45 (`nextzxos-2.10-base.cim`), 1.46 (`nextzxos-26.11-base.cim`), all committed cards, and the 2019 TBBlue 1.03 file. |
| [rom] | Klive's own boot ROM annotations (`src/public/roms/zxnext/*/bootrom_ab.bin.dis`): the anti-brick boot ROM reads words 8 and 10 of the first sector to load the update module. |
| [doc] | `gitlab.com/thesmog358/tbblue` and `specnext.com/latestdistro` (System/Next 26.11a): "for KS3 machines the card should NOT have a TBBLUE.FW file on its root" (to be read in full in Phase 0). |

### Layout [src][bin]

- **The map**: the first 512 bytes. Entry *n* is 4 bytes at offset 4*n*: the module's first block, then
  its length in blocks, both 16-bit little-endian. Blocks are 512 bytes and **counted after the map**:
  module *n* starts at file offset (start + 1) × 512 (`fwOpenAndSeek`: `initial_block = 1 + start`).
  Unused entries are zero; the map has room for 128.
- **The modules** follow in entry order, each padded with **`$00`** to whole blocks (the packer
  `memset`s 0 before each read). The last module ends exactly at the end of the file in every real file.
- **Aliases**: an entry may repeat entry 0's start and length. The packer does this on purpose for
  entries 1 and 3 ("old loaders may load to boot. This ensures the loader can only load boot or updater").

### The entries [src]

| # | `FW_BLK_*` | Module | Started by (article, "The firmware file") |
|---|---|---|---|
| 0 | `BOOT` | the start-up screen, then the machine (`boot.bin`) | no key; "DO NOT MOVE: may be started by AB loader" |
| 1 | `OLD_EDITOR` | alias of 0 | old loaders |
| 2 | `UPDATER` | writes TBBLUE.TBU's core (`updater.bin`) | U; DRIVE + M1 at power-on (the anti-brick ROM loads entry 2 [rom]) |
| 3 | `OLD_CORES` | alias of 0 | old loaders |
| 4 | `EDITOR` | the settings menu (`editor.bin`) | Space |
| 5 | `CORES` | the extra cores menu (`cores.bin`) | C |
| 6 | `TESTCARD` | the video test card (`videotest.bin`) | A, D, V, R on the start-up screen |
| 7 | `RESET` | `config.ini` back to its defaults (`reset.bin`) | N and X together |
| 8 | `SCREENS` | the start-up pictures (`screens.bin`), data | read by the boot module |

### What the real files hold [bin]

| File | Firmware | Size | Entries | Map |
|---|---|---|---|---|
| `ks2-base.cim` | 1.44 | 304,640 (595 blocks) | 9 | 0:0+54 1=0 2:54+52 3=0 4:106+66 5:172+62 6:234+62 7:296+57 8:353+241 |
| `nextzxos-2.10-base.cim` | 1.45 | 286,720 (560) | 9 | 0:0+48 1=0 2:48+47 3=0 4:95+59 5:154+56 6:210+56 7:266+52 8:318+241 |
| `nextzxos-26.11-base.cim` | 1.46 | 635,904 (1,242) | **17** | 0-8 as above (8:345+316), then 9:661+69 10:730+63 11:793+66 12:859+52 13:911+6 14:917+66 15:983+48 16:1031+210 |
| TBBlue 1.03 (2019) | 1.03 | 109,568 (214) | 6 | 0:0+53 1:53+63 2:116+39 3:155+30 4:185+14 5:199+14, no aliases |

- **Firmware 1.46 has eight entries no published source names** (9-16). The published `master` source
  has 9 (8 modules and the screens); a forum report says recent binaries were updated without their
  sources. They are shown numbered, with what can be read from their bytes (code or data, size).
- **The 2019 layout is older**: no aliases, six entries, and the old packer's order (boot, editor,
  updater). The names by index above apply only to a file whose entries 1 and 3 alias entry 0.
- **Where a module runs** [src]: loaded into DivMMC RAM and run at **`$6000`**; the code is linked at
  `$6010` (`--code-loc 0x6010`) after a start-up stub. Klive's disassembler on 1.46's boot module gives
  `ld sp,$FFFF / di / call LDEA4 / call L818B / jp L6010`, so the listing is meaningful as is.
- **The version** [src][bin]: the boot module holds it as text (`FW_version = "1.44"`, printed after
  "Firmware v"); a search for a NUL-terminated `d.dd` in the boot module finds 1.44, 1.45 and 1.46. The
  2019 file prints it differently. Best effort, labelled as read from the module's text.
- **The oldest core it accepts** [src]: `minimal = 0x03010a` (3.01.10) in 1.44's `boot.c`, a 32-bit
  value in the boot module's data; found in 1.44 by a byte search, unknown for 1.45/1.46 until Phase 0.
- **The screens block** [src]: starts with a 256×192 Layer 2 picture (49,152 bytes), then a Layer 2
  palette (`FW_L2_PAL_SIZE` 227 bytes, not a plain 512-byte palette), tilemap data
  (`FW_TILEMAP_DAT_SIZE` 2,464 per machine id) and its palette (13); the boot module seeks to
  `49152 + 227 + 8896 × s[mach_id]`. Whether the picture and palette can be drawn is Phase 0.

### 1a. Phase 0 results (2026-11-14)

**The 26.11a notes on KS3** [doc]: the "should NOT have a TBBLUE.FW" sentence is about the **fresh
update card** a KS3 owner prepares for `updater.bas` ("Copy the install.bas, updater.bas and
sn-update-26.11a.dsu files onto the root of a fresh card, which should NOT have a TBBLUE.FW file on its
root"), because the anti-brick boot ROM boots from whichever card holds the file [rom]. It says nothing
against TBBLUE.FW on a KS3's system card; the release calls 1.46 "Firmware 1.46 for all Nexts and
Clones". D6 is corrected below.

**Entries 9-16 of firmware 1.46** [bin]: each is either a code module, starting with the stub every
named module starts with (`31 FF FF F3`: `ld sp,$FFFF / di`), or data. Their texts (observed, **not
names**):

| # | Kind | Blocks | Texts in it |
|---|---|---|---|
| 9 | code | 69 | "Flash core", "Erase core", "No other core on the card" |
| 10 | code | 63 | `/machines/`, `/core.cfg`, `userfile=`, `filetypes=` |
| 11 | code | 66 | `/machines/%s/core.cfg`, `romnote=`, `resource=` |
| 12 | code | 52 | `FILESEL1`, `core.cfg`, `roms.inf` |
| 13 | data | 6 | the credits: "The Creators", "Victor Trucco", "Fabio Belavenuto", ... |
| 14 | code | 66 | "%s (KS%c) - %s - %uK", `config.ini`, `espreset=`, `timing=` |
| 15 | code | 48 | "The credits cannot be read.", "SPACE pause" |
| 16 | data | 210 | starts with `SCRLM`: graphics |

No source names them, so the viewer does not either (D3). What it can show truthfully is each entry's
**kind** (code by the stub, otherwise data) and **the texts it contains** (D8).

**The oldest core** [bin]: in 1.44 the value 3.01.10 sits in the boot module's initialised data
(`0A 01 03 00` after a `6B 6D`); 1.45 and 1.46 still print "You need at least core v" but hold the value
elsewhere (not as those bytes, not as an `ld hl,nn` / `ld de,$0003` pair). Finding it means reverse
engineering each version's boot module, so **the viewer does not show it** (the article states 1.44's).

**The screens block** [src][bin]: from the test card module (`videotest.c`): the 256×192 Layer 2 picture
(49,152 bytes, one palette index per pixel), then **227 bytes of 9-bit palette entries**, two bytes each
(first `RRRGGGBB`, second bit 0 the low blue bit; white is `$01FF`), the rest of the 256 entries zero;
then per-machine tilemap data (the start-up text, 8 × 8,896 bytes from offset 49,379), the tilemap
palette (13 bytes) and more tilemap data. **The Layer 2 picture is the video test card**, not a
start-up logo: drawn by hand from 1.46 and 1.44 (113 colours each) it is the ZXN test card exactly.
The viewer shows it (D5).

**The 2019 layout** [bin]: entries 0-3 are the same modules by position, read from their texts: 0
"TBBLUE BOOT ROM" (boot), 1 the editor (the joystick names), 2 "Anti-Brick ... Updater", 3 "Extra Cores
Updater"; 4 and 5 are data. So `FW_BLK_OLD_EDITOR` and `FW_BLK_OLD_CORES` are where the editor and the
cores module **used to be**: names 0-3 hold in both layouts, as "Editor (old place)" and "Cores (old
place)" when they are real modules, and as aliases of Boot when they repeat entry 0. Entries 4-8 are
named only in the current layout (D3).

## 2. Decisions

- **D1. Match by file name only** (`TBBLUE.FW`, any case), with the TBU viewer's `matchType: "name"`.
- **D2. A pure reader**, `src/common/zxnext/fwFile.ts`: bytes in, a model out (map entries, aliases,
  names where the layout is the current one, module ranges and padding, version and oldest core when
  found, problems as codes). Never throws (D3 of the TBU plan).
- **D3. Names by index from the published source.** Entries 0-3 in every layout (1 and 3 are "Editor
  (old place)" / "Cores (old place)" when real, aliases of Boot when they repeat entry 0); entries 4-8
  only in the current layout (where 1 and 3 are aliases). Everything else is numbered. No name is
  invented (§1a).
- **D4. Problems**: not a firmware file (map entries pointing past the end, or a file under 512 bytes),
  a file that is not whole blocks, data after the last module, partly overlapping modules (exact
  repeats are aliases, not problems), an entry 0 or 2 that is missing (the boot ROM needs 2, the
  loaders need 0).
- **D5. A module's content**: a code module's disassembly at `$6000` in the viewer (Klive's Z80N
  disassembler, the listing colours), and in the static memory dump on demand. The screens block shows
  its **test card picture** (Layer 2 and its 9-bit palette, §1a), the rest of it as bytes in the dump.
- **D6. Machine › SD Card › Show TBBLUE.FW** and `show-fw`, beside Show TBBLUE.TBU, through
  `readNextSdCardFile`. A card without the file says so in the message box, as for TBBLUE.TBU. (The
  26.11a "no TBBLUE.FW" note is about a KS3's separate update card, §1a.)
- **D7. Layout A, like the TBU viewer** (chosen by the project author from the mockups,
  `.local/fw-mockup/index.html`, 2026-11-14; B "keys first" and C "list and tabs" not taken): File
  (version, size, oldest core, verdict), Modules (the map as a `TimelineStrip` over the distinct blocks,
  then a table: number, name, the keys that start it, blocks, offset, size, note; aliases dimmed and
  pointing at entry 0), the selected module's details (what it is, its keys, block and file range, where
  it runs, its `$00` tail, the alias note), then its content: the disassembly at `$6000` for a code
  module, the picture (or its bytes) for the screens block. The key glyphs come from B, as a column.
  The File section drops "oldest core" (§1a).
- **D8. Every module's kind and texts.** Code (it starts with the `31 FF FF F3` stub) or data, and the
  printable runs of six or more characters it contains, in the details. This is how an unnamed entry
  (1.46's 9-16) is told apart without inventing a name.

## 3. Phases

### Phase 0 — Spike (no product code) — done; results in §1a

- Read the 26.11a release notes on TBBLUE.FW and KS3, and record what they mean for D6.
- Entries 9-16 of 1.46: what each looks like (a code module's stub at its start, `31 FF FF F3`, or data),
  and whether any source names them (a newer published source, the release notes).
- The oldest core in 1.45 and 1.46 (the `minimal` value in the boot module), or decide not to show it.
- The screens block: the Layer 2 picture and its 227-byte palette format; draw it once by hand (a PNG in
  `.local/`) before committing to show it.
- The 2019 layout: confirm the old order from the old packer, or show it numbered.

### Phase 1 — Reader and tests — done

- `fwFile.ts` with `parseFwFile(bytes)`; tests on files built in the test (current layout, aliases,
  unnamed entries, the old layout, every problem), plus an opt-in check of real files
  (`FW_REAL_FILES`) and a unit test reading TBBLUE.FW from the three committed cards.

**As built (2026-11-14), done.** `src/common/zxnext/fwFile.ts`, `test/zxnext/fwFile.test.ts` (15 tests on
built files) and `test/main/fw-cards.test.ts` (5, the three committed cards; plus `FW_REAL_FILES`). Notes
for Phase 2:

- `parseFwFile` reads the map until the first entry of no blocks; a file whose first entry is missing
  or does not start at block 0 is `notFirmware` (format `unknown`, the viewer refuses it).
- Names follow D3; `aliasOf` points at the first entry with the same blocks (0 for 1.44-1.46's 1 and 3).
  Overlap is checked only against entries that are not aliases, so an alias never reports one.
- Problems: `tooShort`, `notFirmware` (errors); `entryOutOfRange`, `entryOverlap` (errors);
  `noUpdater` (warning: entry 2 missing or an alias, what the anti-brick ROM loads); `notBlockAligned`
  (warning); `trailingData` (info).
- `kind` is `code` when the module starts with `31 FF FF F3`; then `runsAt` is `$6000`.
- `fwModuleTexts(data, entry, limit)` gives a module's texts (D8): runs of 6+ printable characters with
  4+ letters and 3+ different characters, which drops picture bytes such as `$%%%%%%`.
- `readFwTestCard(data, entry)` gives the test card's 49,152 indexes and 256 9-bit palette entries
  (`(byte0 << 1) | (byte1 & 1)`, the uncarried ones 0). On 1.46 the picture uses 113 colours and its top
  left pixel is red (`$1C0`), as the hand-drawn picture showed.
- `findFwVersion` finds 1.44, 1.45 and 1.46 in the three cards' boot modules; the 2019 file has none of
  that form, and both opt-in real files (2019, the KS2 image) read with no errors.

### Phase 2 — Viewer and registration — done

- The chosen layout on `GenericFilePanel`, the data primitives, the tape viewer's `TimelineStrip` for the
  map, the disassembly colours; `FW_VIEWER` registered by name; texts through `t()`; a jsdom test;
  checked in the running IDE on the four real files.

**As built (2026-11-14), done.**

- `FwFileViewerPanel.tsx` (+ `.module.scss`), layout A: File (version, size, map use, layout, verdict,
  problems; the map's dump), Modules (the `TimelineStrip` over the distinct modules, then the table with
  key caps, aliases dimmed), the selected module (what, keys, blocks, file range, kind and address,
  padding, up to 12 texts; the module's dump and its whole disassembly in the static memory dump), then
  the content: **the first 256 instructions** at `$6000` (a 35K module is ~15,000 instructions, too
  many rows for a document that scrolls as one; the whole module is one click away), or the test card.
- An alias row selects the module it repeats; in the 2019 layout entries 1 and 3 read "Editor (old
  place)" and "Cores (old place)". Key names are not translated; the updater's keys are "U, or DRIVE +
  M1 held at power-on".
- `rgb333Rgb` added beside `rgb333Css` in `layerMix.ts`, so the picture uses the core's colour levels.
- Registry: `FW_VIEWER`, `matchType: "name"` for `TBBLUE.FW`. 83 keys under `panels.next.fw.*`, from
  whole-key tables. Colours `--color-fw-*`, `--bgcolor-fw-*`; the rules are in
  `dev/ai/ui-theming-intent-and-lessons.md` (key caps, receding alias rows, the pixel-exact picture).
- Tests: `test/renderer/FwFileViewerPanel.test.tsx` (7), `test/renderer/fwFileType.test.ts` (8).
- Checked in the running IDE on firmware 1.46 (boot, updater, module 9, screens, the test card, the
  listing): no console errors. It showed one fault the tests could not: "3,072 B" (module 13) touched
  the Note column in a `7ch` Size column, now `9ch`.

### Phase 3 — Machine › SD Card › Show TBBLUE.FW — done

- The menu item and `show-fw` on the TBU viewer's pattern (document `fwCard:<card>`, fresh read each
  time, failures in a message box); tests as for `show-tbu`.

**As built (2026-11-14), done.**

- `show-fw` (`FwCommands.ts`) and `show-tbu` now share `nextSdCardFileDocument.ts` (`openNextSdCardFile`):
  the Next check, the card read through `readNextSdCardFile`, each command's own error texts, and the
  fresh-read document (`fwCard:<card>`, named `TBBLUE.FW · <card file>`).
- Menu: `show_fw` right after `show_tbu` in Machine › SD Card, on every model; the TBU item's click
  handler became `showNextSdCardFile(window, command, failedTitle)` for both.
- Texts: `menu.next.showFw`, `menu.next.showFwFailed`, `commands.fw.*` (5).
- Tests: the TBU menu test now covers both items (6), the command test both commands (9), and the card
  reader reads TBBLUE.FW from the 26.11 card (version 1.46).
- Checked in the running IDE through the real menu item on a fresh project (default model ks2-30204,
  the 2.10 card): firmware 1.45 opens, a second click replaces the tab, no console errors.

### Phase 4 — Docs and bookkeeping — done

- A guide page next to "Core update files (TBBLUE.TBU)", its screenshot from `guides-next.cjs` (the
  committed cards hold real firmware, so no `DOC_SHOTS_*` file is needed); `show-fw` in the command
  reference; the article's "The firmware file" linked to the viewer and corrected if Phase 0 finds it
  wrong (it lists seven modules; 1.46 has more entries).
- One `feature` changeset with the commit that finishes the plan; `npm run doc:build && doc:check`,
  `npm test`, and `npm run test:slow` before it completes.

**As built (2026-11-14), done.**

- Guide: `docs/content/en/guides/next/fw-files.mdx`, "The firmware file (TBBLUE.FW)", after the TBU page,
  with a row in the task index and links from the SD card and TBU pages. Its two images come from a new
  `fw` step in `dev/scripts/doc-shots/recipes/guides-next.cjs`, which opens the model's own firmware
  through Machine › SD Card › Show TBBLUE.FW (the committed card is the source; no outside file): the
  viewer with the editor selected, and the test card. Only those two images were published.
- `show-fw` in the command reference, after `show-tbu`.
- Article: "The firmware file" no longer calls the screens block a module of start-up screens (it is
  data: the test card picture and the start-up text), says every module runs at `$6000`, explains the
  two alias entries, notes 1.46's seventeen entries, and links the viewer.
- Goldens: the route and the two images. `npm run doc:build && npm run doc:check` pass (prose: 0
  findings).
- Changeset: `dev/changes/tbblue-fw-viewer-e17d.md` (feature).

## 4. Risks and open questions

- **No specification and a source that lags the binaries.** Names stop at entry 8; the viewer reports
  what it can read and leaves the rest numbered.
- **Branch**: this builds on the TBU viewer (`matchType: "name"`, `readNextSdCardFile`, the SD card menu
  item), so its branch starts from `feature/tbblue-tbu-viewer` (PR #1613) or from `master` once that is
  merged.
- The layout is settled (D7, layout A).
