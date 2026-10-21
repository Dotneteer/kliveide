# ZX Spectrum Next ROM annotations

Annotate the ROMs the Next runs (NextZXOS, the alternate ROM, the DivMMC and Multiface ROMs) the way the
48K, 128K and +3 ROMs are: labels, synopses, comments and regions, written from the bytes, to level 2.
This continues G7.2 of `CLOSING_THE_GAPS_PLAN.md` (R0-R4 covered the 48K, 128K, +2A/+3 and +2E/+3E).

Status: **N0, N1 and N2 done (2026-10-21), N3 next.** Where the work stands and how to go on: `NEXT_ROM_ANNOTATIONS_HANDOFF.md`.

## 1. The ROM files

| File | Pages | Partition (core) | CRC-32 | Kind | What it is |
|---|---|---|---|---|---|
| `enNextZX.rom` | 0 | R0 (`-1`) | `95ba84d4` | `next-os0` | NextZXOS; little in common with the +3E's ROMs (~0.4K matches) |
| | 1 | R1 (`-2`) | `74dbb504` | `next-os1` | NextZXOS; ~0.7K matches with the +3E's ROM 1 |
| | 2 | R2 (`-3`) | `cafb1e32` | `next-os2` | ~3K matches with the +3E's ROM 0 (editor-like) |
| | 3 | R3 (`-4`) | `92d23960` | `next-basic` | 48K BASIC, changed: ~9.7K matches with the 48K ROM; `$0028` is the calculator |
| `enNextLG.rom` | 0-3 | | page 2 `43fc1f2f` | `next-os2` | `enNextZX.rom` with another page 2; pages 0, 1, 3 identical |
| `enAltZX.rom` | 0, 1 | X0, X1 (`-5`, `-6`) | `574ec214`, `74bc5674` | `next-os` | the alternate ROM |
| `enNxtmmc.rom` | 0 (8K) | DM (`-7`) | `5a443736` | `next-divmmc` | the DivMMC ROM (esxDOS) |
| `enNextMf.rom` | 0 (8K) | — | `36db4453` | `next-multiface` | the Multiface ROM; not a partition the core reports yet |

Pages 0-2 each use their restarts differently (`nextzxos-disassembler.ts` records how, from their own
routines); a new inline convention goes into its table with a test. Much of NextZXOS runs from RAM
banks loaded from the SD card; only the ROM is in scope here.

## 2. Sources (D4)

`.ai/rom-annotations/README.md`'s D4 rule holds unchanged: the bytes, Klive's own sidecars and probes on
the core. Allowed as **interface facts** (provenance `manual`, the document named in PROVENANCE):

- `_input/NextZXOS_and_esxDOS_APIs.pdf`: the documented API calls, their numbers and entry/exit
  conditions;
- `_input/zx-next-dev-guide-r3.pdf`, `_input/next-fpga/` (VHDL, `nextreg.txt`): ports and NextRegs;
- `_input/MMC+Specification+version+4.2.pdf`: the SD/MMC card protocol.

Forbidden: NextZXOS's or esxDOS's published sources (they are commented source code), any commented
disassembly, and remembered names. The other files of `_input/` stay closed, as before.

## 3. How it is followed

Each ROM file has one working copy, `~/Klive/RomAnnotations/<file>.dis`, with a bank per page:
`enNextZX.rom.dis` (pages 0-3), `enAltZX.rom.dis` (0, 1), `enNxtmmc.rom.dis`, `enNextMf.rom.dis`.
Open one in the IDE with `rom-ann-open enNextZX.rom -page 3` (or from the ROM row's context menu on a
running Next): the IDE re-reads the file whenever the authoring writes it
(`AnnotationFileWatchHost`), so the document shows the work as it lands. The running Next's
Disassembly view applies the same working copies to its ROM pages. A file is copied to
`src/public/roms/` (shipped) only when its pages reach level 2.

The tools take `PAGE=<n>` for a page of a several-page file (`sp48-dis.cjs`, `apply-annotations.cjs`,
`annotated-view.py`, `reassemble-test.ts.txt`); `check-annotations.cjs` measures every page.

## 4. Phases

| Phase | Work | Size |
|---|---|---|
| **N0** ✅ (2026-10-21) | The Next reports its ROM pages (R0-R3, X0, X1, DM) to the annotations (`getRomSources`); a 16K ROM page's sites count within the page; the pages' CRCs and kinds are known (`KNOWN_ROM_PAGES`, with `page`); ROM 3 decodes as the 48K ROM in the live view; the tools take `PAGE=`; the working copies exist. | S |
| **N1** ✅ (2026-10-21) | `enNextZX` page 3 at level 2 in the working copy (1,148 labels, 5,416 comments, reassembling byte for byte): the 48K ROM's entries mapped (749 labels), the rest drafted by three helpers. It is a new kind, `next-basic` (48K decoding with the Z80N's opcodes). What NextZXOS changed: no tape code (the DivMMC does it), the operand jump table at $0600 and new functions in its place, no 48K start-up (selectors and string modifiers instead), a 256-byte operator table at $1A99, the calculator's tables moved to $3B02/$3C02, number bases, long names, local and integer variables, BANK/SPRITE/bitwise functions at $386E-$3CFC, `CALL $2705` + an inline word into DivMMC memory. | S–M |
| **N2** ✅ (2026-10-21) | Pages 0 and 1 at level 2 in the working copy (1,068 and 1,038 labels, reassembling byte for byte). Each page has its own restarts and inline data: kinds `next-os0`-`2` and `NextZxOsCustomDisassembler` (ROM-to-ROM stubs + word, `RST $28` into ROM 3 through $5B48, the alternate ROM through `CALL $0068`, error bytes, `RST $10` functions, DivMMC calls). Page 0 is the system ROM (start-up, menu, channels, window driver, line editor, Browser); page 1 NextBASIC's command ROM (syntax tables, reports, LOAD/SAVE, PROC/loops, BANK). API names from the API document (`manual`). | L |
| **N3** | Page 2 (its decoding is in place: `RST $08` + byte + word, `CALL $3E00`/`$3F00` + word). | M |
| **N4** | `enNxtmmc.rom` (esxDOS, 8K) with its `RST $08` API (document), and `enNextMf.rom`. | M |
| **N5** | `enAltZX.rom` (two pages) and `enNextLG.rom`'s page 2: map from the above where they share code. | M |
| **N6** | Ship at level 2, docs (Disassembly guide), roadmap, competitive analysis; the changeset. | S |

## 5. Decisions

- One sidecar per ROM file, a bank per page (not a file per page as the +3's): the core loads them as
  files, and `getRomSources` names a page by file and page.
- No `inherits` on the four-page file for now: inheriting applies to every page of the file, and the
  48K ROM's entries would byte-bind by chance on pages 0-2. Page 3 gets the 48K's entries by mapping.
