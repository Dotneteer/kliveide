# Authoring the Cambridge Z88 OZ ROM Annotations

Read `README.md` beside this file first (file format, levels, tools). This guide covers what is
specific to the Z88's OZ 4.7 ROM, `src/public/roms/z88v47.rom`. The plan is
`dev/plans/Z88_OZ47_ROM_ANNOTATIONS_PLAN.md`.

## D4 here: OZ is annotated from its source

D4 has an exception for OZ, granted with the owner's permission (plan D-OZ1, D-OZ2): the
annotations come from the OZ project's own assembler source, <https://bitbucket.org/cambridge/oz>,
and are imported by a script, never copied by hand. Entries are marked `source` (plan D-OZ3). The
OZ source is GPL v2. Nothing from it ships until the permission is recorded (plan Q1).

The pre-OZ-4 ROMs (`z88ukv30` and the national 3.x ROMs) are **not** covered: they stay under D4.
So does any ROM Klive annotates by carrying from this sidecar.

## Which build the ROM is (Phase 0, 2026-11-14)

- **Commit:** `z88v47.rom` is the **V4.7 tag**, commit `603c979a` (2016-12-20). The build writes
  `git log -1 %h` into the ROM as `ozrev` (`def/ozrevision.def`, used by `.OZRevision` in
  `os/process1.asm`). The 32-bit value `$0603C979` is at file offset $5E36.
- **Slot:** the **slot 0** build (`makerom.sh 0`, `oz.bin`). The revision word is in bank 1, the
  lower kernel (`KN1_BNK = $01`, run at `KN1_ORG = $8000`, so address $9E36). A slot 1 build puts
  the kernel in banks $7D/$7E. The ROM header (front DOR, `'OZ'`) is at the top of bank $1F, as
  `RO0_BNK`/`ROM_DOR = $3FC0` give for slot 0.
- **OZ is not rebuilt (plan D-OZ5).** The developer accepts the identification above. The importer
  checks the source against the bytes line by line instead (plan Phase 2). The reasons:
  - `mpm` (V1.5+) and `z88card` (V2.0+) have no public source; the `cambridge/mpm` and
    `cambridge/z88card` repositories ask for a login.
  - They ship only as the Z88 Assembler Workbench installers on SourceForge (latest 2018.2). The
    macOS installer's program is a 32-bit i386 executable, which current macOS cannot run, and
    Rosetta cannot help. Only the Linux installers remain.
- **mpm 1.3 cannot build OZ 4.7.** The last public `mpm` source is 1.3, in the `cambridge/z88`
  repository's history (`tools/mpm` before commit `2ba8b155`, 2012-07-26); after that, `tools/mpm`
  and `tools/z88card` are submodules of the private repositories. 1.3 compiles on macOS
  (`cc -std=gnu89 -DMPM_Z80=1 -DUNIX=1 -I. *.c`), but on `os/lowram` it stops with 168 errors, the
  first ones in `def/macros.def`, which OZ 4.7 uses throughout. That is why the importer aligns the
  source with the ROM rather than reading mpm's map and listing files.

## The banks (slot 0)

From `def/oz.def`, `def/sysapps.def` and `rom.ldm` at V4.7, and the bytes. "Run at" is the
address the code is assembled for; `$FF%` is the share of $FF bytes in the bank.

| Bank | CRC-32 | $FF% | Contents (run at) |
|---|---|---|---|
| 00 | `007cedde` | 2 | Kernel upper part `kernel0` ($C000), OS call table `ostables` ($FF00) |
| 01 | `2017da5d` | 8 | Kernel lower part `kernel1` ($8000) |
| 02 | `d4e5a522` | 40 | Keymaps (offset 0), HIRES1 font ($0C00), LORES1 font ($1000), LOWRAM image ($C800, copied to RAM at reset), date filter ($7300) |
| 03 | `2aa311c4` | 14 | GN system calls and the CRC-32 table ($C000) |
| 04 | `55151167` | 7 | Diary ($C000); Clock, Calendar and Alarm ($E7EE) |
| 05 | `28e683fd` | 0 | PipeDream, first 16K ($8000) |
| 06 | `6f97110f` | 0 | PipeDream, second 16K (listed from offset 0) |
| 07 | `7c7f4303` | 21 | Panel and PrinterEd ($C000), Terminal ($D400), Calculator ($D600), Imp/Export ($E400) |
| 08 | `a2e9469c` | 40 | MTH: system token table, static structures, application DORs (offset 0) |
| 09 | `c0559406` | 17 | BBC BASIC ($CA50) |
| 0A | `d5330412` | 1 | EazyLink ($8000), Filer ($E400) |
| 0B | `05384d83` | 23 | FlashStore ($C000) |
| 0C | `fe619c3e` | 29 | DC system calls and Index ($8000) |
| 0D | `6979f058` | 79 | Floating-point package ($C000) |
| 0E-0F | `690b37d3` | 100 | Empty |
| 10 | `252d4bba` | 66 | FlashStore file area: `welcome.pdd` (`filearea` in `rom.ldm`), data |
| 11-1E | `690b37d3` | 100 | Empty |
| 1F | `6c007aa0` | 99 | ROM front DOR and `'OZ'` header at $3FC0 |

**One origin per page is not enough** (plan Q3). Bank 0A holds code for segment 2 ($8000) and
segment 3 ($E400), and bank 02 holds tables placed for several segments. The listing origin has
to be a property of a region (or of a run of a page), not of the whole page.

## Klive's side (Phase 1, 2026-11-14)

- **The `z88` bank space** (`z88BankSpace`, `src/common/annotations/bankSpace.ts`) names Z88 memory
  by bank and offset, following the core's paging rule. Banks $00-$1F are ROM pages under their own
  numbers, and every other bank is a bank, so user annotations and bank breakpoints (`bp-set
  0A:+$2400`) work on the Z88 too.
- **The running Z88 reports its ROM banks** (`getRomSources`): slot 0's banks, each named
  `roms/z88v47.rom` page n. A working copy or the shipped `z88v47.rom.dis` therefore binds by CRC.
- **Page kind `z88-oz`** for the sixteen filled banks of OZ 4.7 (`KNOWN_ROM_PAGES`). The decoder lists
  `RST 20h` with the OZ call bytes and `RST 18h` with the FPP operation byte, as one row each.
- **Where a run runs:** a sidecar page's `segments` (`[{ "start": offset, "segment": 0-3 }]`) gives
  each run's segment. Without it, a bank is decoded at $C000. The level check, the CLI and
  `z88-dis.cjs` use it. The IDE's ROM page document lists every page at $0000, as on every machine.
- **Provenance `source`** needs the file's `sourceCode` (`{ "repository", "tag", "commit" }`).
- **Source export:** an `oz`/`fpp`/`extcall` row is written as `.defb` with the call as the comment,
  so an export over OZ code reassembles.
- **Checking it:** `node dev/scripts/z88-annotations-ide-check.cjs` (after an `electron-vite build`).
- **Known limit:** a bank breakpoint in $2000-$3FFF does not fire while SR0 is odd. The bank space
  names bank `SR0 & $FE`, and the machine reports SR0 as written.

## Importing the source (Phase 2)

```
node dev/scripts/import-oz-source.cjs fp/fpp.asm --bank 0x0D      # writes .local/oz-import/
```

The aligner (`src/common/roms/ozSourceAligner.ts`) reads a module as mpm would, as far as the layout
depends on it, and walks it over Klive's decoding of the bank. It stops at the first line that does not
match, and checks every jump and call to a module label afterwards. The report (`<bank>.report.txt`)
gives what was placed, the stop, target mismatches, renames needed and the measured level. Check the
result with `tools/check-annotations.cjs` and the reassembly template before using it.

mpm facts the aligner relies on:
- in `defs (count) (fill)`, `$PC` is the offset from the module's start;
- an unknown symbol in an `IF` is 0 (include guards: `IF !__OZ_DEF__` / `define __OZ_DEF__`);
- `defvars base` ... `enddef` lays out `name ds.b|w|p|l n` fields, and `defvars -1` continues;
- `os/lowram/lowram.def` is generated by the LOWRAM build, so it is missing from a plain checkout.

Bank $09 (BBC BASIC) has no source in the repository, only `apps/bbcbasic/basic.dat`.

Since the pilot: `node dev/scripts/import-oz-source.cjs --all` imports every component listed in
`z88-oz47-components.json` into a fresh `.local/oz-import/z88v47.rom.dis`; `--write-renames` records
new label-name proposals in `z88-label-renames.json`. Names in that table are `shortLabelName`'s
proposals until someone reviews them; an entry edited by hand wins. The plan's Phase 2 "Handoff"
section says what is done, how to check it and what is left.

Decoder facts learned on the way: `EXTCALL` (OZ 4.5+) is `RST 28h` plus 4 bytes, the address, the
bank and a spare byte OZ skips. OZ 3.x and 4.0 have no `EXTCALL`: their $0028 is ordinary code.
