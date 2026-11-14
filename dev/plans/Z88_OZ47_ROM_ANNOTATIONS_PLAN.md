# Cambridge Z88 OZ 4.7 ROM Annotations — Plan

**Status:** In progress (2026-11-14). Phase 0 done (the build identified; no rebuild, D-OZ5). Phase 1
done (Z88 bank space, ROM pages, `z88-oz` decoding, `source` provenance; checked in the running IDE).
Phase 2 under way: the aligner works, and its pilot (the FPP, bank $0D) imports to level 1 and
reassembles. Next: the OZ call forms and multi-module projects.
**Goal:** a shipped sidecar `src/public/roms/z88v47.rom.dis` that annotates all 32 16K banks of the
OZ 4.7 ROM to level 2. It is built mostly from the OZ project's own assembler source,
<https://bitbucket.org/cambridge/oz/src/V4.7/>, which the owner has given permission to use.

Read first: `dev/ai/rom-annotations/README.md` (file format, levels, tools, Q1), `dev/patterns/annotations.md`
("ROM Annotations") and `dev/ai/rom-annotations/ep-authoring-guide.md` (the newest per-machine guide, the
template for the Z88 one).

---

## 1. Decisions

- **D-OZ1. This ROM is exempt from D4.** OZ 4.7 is annotated from its original source, used with the
  owner's permission. The exemption covers OZ 4.7 and the other OZ releases built from the same
  repository. For any other ROM, D4 still applies unchanged. The README's D4 section names the
  exemption and points here, and `CLOSING_THE_GAPS_PLAN.md` D4 gets a one-line note.
- **D-OZ2. The permission is recorded in the repository** before anything taken from the source ships:
  who granted it, when, and its scope (shipping labels and comments derived from the GPL v2 source inside
  an MIT application, and under which notice). It goes in `src/public/roms/z88-roms-readme.txt`, with an
  entry in `THIRD_PARTY_NOTICES.md` that credits the OZ authors and the repository and tag.
  *Open: the exact wording, which needs the author's input (Q1).*
- **D-OZ3. A new provenance value, `source`,** marks an entry taken from the original source. It sits
  beside `observed`, `manual` and `derived`. `shippedRomSidecars.test.ts` accepts it only in a sidecar
  whose header names a source (a new `source` key: repository, tag, commit). That keeps `source` from
  turning up anywhere else by accident.
- **D-OZ4. Entries are generated, not hand-copied.** A script reads the source and places it on the ROM
  (Phase 2), so every `source` entry can be traced to a file and line, and a later OZ release can be
  imported the same way. Hand edits afterwards follow the house style (Q5). An edited entry keeps the
  value `source`.
- **D-OZ5. The source is placed by aligning it with the ROM, not by assembling it** (2026-11-14). The
  developer accepts that `z88v47.rom` is the slot 0 build of tag V4.7 (the evidence is Q2), so OZ is not
  rebuilt: `mpm` 1.5+ is not available on this machine (the guide says why). The importer walks the
  source in link order over Klive's own disassembly of the ROM, and accepts a label or comment only where
  the source instruction or data at that point matches the bytes. Wherever the walk fails, it stops, and
  that part goes on the review list. This check works line by line, which is finer than comparing whole
  banks.

## 2. Facts established so far

- The repository builds a 512K image (32 banks) using `mpm` (assembler, V1.5+) and `z88card` (V2.0+,
  load map `rom.ldm`), driven by `makerom.sh [0|1]`. Slot 0 writes `oz.bin` and slot 1 writes
  `oz.epr`. Neither tool is available here, and none is needed (D-OZ5).
- The build writes the Git revision into the ROM (`def/ozrevision.def`, `defc ozrev=$<hash>`), so an
  image built from a working tree with a different commit differs in at least those bytes.
- Source areas: `os/` (kernel, split into `kernel0` at $C000 and `kernel1` at $8000, plus `ostables`
  and `lowram/`, the LOWRAM image copied into RAM at reset), `gn/`, `dc/` (with Index), `fp/` (the
  floating-point package), `mth/` (MTH, DORs, keymaps, fonts, ROM header), `apps/` (Alarm, BBC BASIC,
  Calculator, Calendar, Clock, Diary, EazyLink, Filer, FlashStore, Imp/Export, Index, Panel/PrinterEd,
  PipeDream, Terminal) and `def/` (the shared `.def` symbol files).
- Klive already has a Z88 custom disassembler for the OZ calls
  (`src/renderer/appIde/disassemblers/z80-disassembler/z88-custom.disassembler.ts`), a Z88 harness
  (`test/harness/z88/`) and Z88 partitions. It has **no** Z88 `RomPageKind`, and `romKindOrigin` gives
  each kind a single origin, whereas Z88 banks run at different addresses ($C000, $8000, and LOWRAM
  code in RAM).
- `z88v47.rom` is 512K. The Z88's default ROM is `z88v50b`, not 4.7.

## 3. Open questions

- **Q1.** The permission's exact scope and wording (D-OZ2). Phase 3 cannot ship without it.
- **Q2. Answered (2026-11-14):** the slot 0 build of the V4.7 tag, commit `603c979a`. The ROM carries
  that revision at $5E36, in the lower kernel bank, which is bank 1 only in slot 0. Evidence and the
  bank map are in `dev/ai/rom-annotations/z88-authoring-guide.md`. There is no rebuild to compare
  against; the developer accepts the identification (D-OZ5).
- **Q3.** Listing origin: a per-page origin is **not enough**. Bank $0A holds EazyLink ($8000) and
  the Filer ($E400), and bank $02 mixes tables for several segments. The origin has to belong to a
  region, or to a run of a page. Decided in Phase 1.
- **Q4.** Should LOWRAM code, which runs from RAM after reset, also be annotated where it is placed in
  RAM? Proposed: annotate it in the ROM bank only, and look at a RAM binding later.
- **Q5.** OZ comments are written in the authors' style. Should they be reworded into the house style
  (README, "Write every sidecar in zx81.rom.dis's style"), or kept as they are, with only the 70- and
  92-column limits applied? Proposed: keep end-of-line comments as written (apart from the length
  limits), and rewrite each routine's header into the `Entry:/Exit:/Error:/Changes:` contract.

## 4. Phases

### Phase 0 — Identify the build (done, 2026-11-14)

The source is cloned at `.local/oz47/oz` (tag `V4.7`, git-ignored). The ROM was identified from its
own bytes as the slot 0 build of commit `603c979a` (Q2), and the bank map is recorded in the Z88 guide.
OZ was not rebuilt. The only public `mpm` source is 1.3, which cannot assemble 4.7's macros, and the
1.5+ binaries are a 32-bit macOS installer that cannot run on current macOS, or a Linux installer.
The developer accepted the identification instead (D-OZ5), and Phase 2 checks every placed line
against the bytes.

### Phase 1 — Klive support for Z88 ROM sidecars

*Finding (2026-11-14):* the Z88 has **no annotation bank space**. `bankSpaceFor` in
`src/common/annotations/bankSpace.ts` returns `undefined` for it ("memory that cannot be annotated"),
and its partitions are 256 plain banks with no ROM partitions (`z88MachineInfo.ts`). The default
`getRomPartitionImages` would therefore report the first 16K of the flat memory as the ROM. Binding a
sidecar on the running Z88 (step 2) needs a Z88 bank space first:
- `siteAt` from the Blink's segment registers SR0-SR3, with segment 0's split into two 8K halves;
- banks $00-$1F (slot 0) treated as ROM;
- the per-region origin from Q3.

That is a larger piece than this phase assumed. Steps 1, 4 and 5 (kind and decoder, `source`
provenance, listing tool) do not depend on it. The OZ call names already in Klive (`z88OzApis` and
`z88FppApis`, used by `z88-custom.disassembler.ts`) are reused by the decoder.

*Design (2026-11-14), chosen with the developer ("full Z88 support"):*
- **A `z88` bank space**, following the core's own rule (`z88SetMemoryPageInfo` in `z88-memory.c`).
  $0000-$1FFF is bank $00, or RAM bank $20 with COM.RAMS: the slot paging's page 0 says which.
  $2000-$3FFF is half of bank `SR0 & $FE`, with bit 0 picking the half (offset `(SR0 & 1) * $2000`).
  Each of $4000-$FFFF shows a whole 16K bank. Banks $00-$1F (slot 0) are ROM partitions numbered by
  their bank, positive like the Enterprise's segments (`isRomPartition`). Every other bank is a bank,
  so a program's annotations work in RAM and on cards too.
- **The Z88 reports its ROM banks** (`getRomPartitionImages`): every bank of the slot 0 card, read
  through `getMemoryPartition`, so a ROM sidecar binds by CRC as on every other machine.
- **The listing origin is a property of a run, not of a page (Q3).** OZ places code so that the low
  14 bits of its address are its offset in the bank, so a run's origin is only its segment. A ROM
  sidecar's `pages` entry may carry `segments`, a list of `{ start, segment }`. The decoder that the
  level check and the tools use decodes each run at `segment * $4000`, taking the segment from the
  last entry at or before the run's start; without `segments`, a `z88-oz` page is decoded at $C000.
  The IDE's ROM page document lists every page at $0000, as it does for every machine, so it needs
  nothing.
- **Known pages:** only the banks that hold something are listed in `KNOWN_ROM_PAGES`. Banks of only
  $FF are the same bytes in every ROM, so a CRC cannot say which ROM they belong to.

*As built (2026-11-14):*
- `z88BankSpace` in `bankSpace.ts` (`z88` annotation machine, banks up to $FF, ROM sidecars up to 32
  pages), chosen for `MI_Z88` with the internal RAM from `MC_Z88_INTRAM`.
- `Z88WasmV2Machine` now has `getPartition(address)`: the core's `z88PageBank`. It was missing, so the
  IDE's slot paging was all `undefined` on the Z88. A bank breakpoint could not have fired, and the
  export said "not annotatable". It also has `getRomPartitionImages`: slot 0's banks up to its chip mask.
- The `z88-oz` kind uses `Z88CustomDisassembler` (`prepareRomDisassembler`). `romDecoderFor(kind,
  segments)` and `romRunOrigin` choose the origin for each run. The readiness check, the CLI
  (`level`, `skeleton`) and the shipped-sidecar test pass the page's `segments` through.
- `source` provenance: the `Provenance` type and `PROVENANCE_VALUES`. `hasSourceCode` requires a
  `sourceCode: { repository, tag?, commit }` (a new top-level key, written after `source`; `source`
  already names the ROM file). The readiness check, the editor's **New entries** toggle (shown only
  for such a file) and `rom-ann-provenance … source` all use it.
- Source export: the Z88 decoder's `oz`, `fpp`, `extcall` and `rst oz_mbp` rows carry
  `notAssemblable`, and the export writes them as `.defb` with the call as the comment. Before, an
  export over OZ calls did not reassemble. The inline string after `oz` $93 is now its own row, at
  its own address and with its bytes, not a zero-byte row on the call's address.
- The ROM Annotations menu lists the Cambridge Z88 (OZ 4.7's sixteen filled banks).
- `dev/ai/rom-annotations/tools/z88-dis.cjs` lists a bank, each run in its own segment.
- Tests: `test/annotations/z88RomPages.test.ts` (bank space, known pages, decoder, segments,
  provenance) and `test/z88/z88-rom-sources.test.ts` (fast e2e: OZ 4.7's 32 banks, OZ 4.0's 8). Tests
  that pinned "the Z88 cannot be annotated" now expect the Z88 to have a bank space.
- The same partition everywhere: the core's breakpoint-condition `page()` (`COND_PARTITION_OF` in
  `z88.c`) and the execution history's `z88PartitionFor` now name the bank behind the 8K page, as
  `getPartition` does. The IDE parity golden (`wasm-z88-ide-parity.json`) was re-recorded for this
  change only: `pcPartition` and `slotPartitions` now carry banks, and digests include them.
- `dev/scripts/z88-annotations-ide-check.cjs` checks it in the running IDE, and passes. A label in a
  working copy for bank 0 binds at $C038 while bank 0 is in segment 3. After boot, $0000 is RAM bank
  $20 (OZ sets COM.RAMS for its LOWRAM code), so a ROM bank 0 label is never shown at $0038. Exports
  over OZ code reassemble, and `bp-set 00:+$0038` is accepted.
- **Known limit:** a bank breakpoint at $2000-$3FFF with an odd SR0 compares the bank space's bank
  (`SR0 & $FE`) with the raw SR0, so it does not fire there. OZ keeps RAM in that window.

1. Add a `z88-oz` `RomPageKind` whose decoder uses `Z88CustomDisassembler`'s OZ call decoding
   (`prepareRomDisassembler`), and the per-page origin from Q3 (`romKindOrigin` gives way to the page's
   own origin when one is set).
2. Make the Z88 report its ROM pages through `getRomSources` so the Disassembly view binds the sidecar
   by CRC (check `Z88WasmHost`'s partition images against `Z80MachineBase.getRomPartitionImages`).
3. Add `romSysVarsFor` entries for the Z88 if a system-variable list applies (from the Developers'
   Notes, `manual`).
4. Add the `source` provenance (D-OZ3): types, the test, the ROM annotation editor's **New entries**
   choice, and `rom-ann-provenance`.
5. Add `tools/z88-dis.cjs` (listing with the OZ decoding, `PAGE=<n>`), matching the other `*-dis.cjs`.
6. Tests: decoder (OZ call bytes, both 1- and 2-byte forms), origin, binding of a test sidecar on the
   running Z88, and the provenance rule.

### Phase 2 — The importer

`dev/scripts/import-oz-source.cjs <oz-source-dir> <sidecar>`: a **source aligner** (D-OZ5), not an
assembler.

1. **Components and order.** `rom.ldm` gives each component's bank and start offset (slot 0
   constants from `def/oz.def` and `def/sysapps.def`). The build scripts give each component's flags
   (`-DOZ_SLOT0`, `-DCOMPILE_BINARY`, ...), and its `.prj` file the modules in link order.
2. **Read the source as mpm would, for what affects layout.** Follow `include`, evaluate
   `IF`/`ELSE`/`ENDIF` from `defc` constants and the flags, and know the few macros in
   `def/macros.def` (the OZ call and the cross-bank call forms), so it can tell how many bytes each
   expands to. The importer evaluates only what changes which lines are assembled or their size; it
   never produces code.
3. **Walk each component over the ROM.** Start at the component's offset in its bank, and step
   through its modules' lines with Klive's own decoder (`romDecoder.ts`, with the OZ call decoding):
   - a label is recorded at the current address;
   - an instruction must match the decoded instruction there (same mnemonic and register operands;
     a number or symbol operand only has to be one), and the walk moves on by the decoded length;
   - `defb`/`defw`/`defp`/`defm`/`defs`/`binary` move on by their size, and their literal bytes must
     match the ROM's;
   - `org`/`xdef`/`xref`/`lib` and the like produce nothing.

   On a mismatch, that module stops, its remaining lines go on the review list, and the walk picks up
   again at the next module start that can be placed by a label signature.
4. **Labels:** module-level and local names, at most 16 characters and unique within a page. Longer or
   clashing names go through a reviewed rename table (`dev/ai/rom-annotations/z88-label-renames.json`),
   never silently truncated. A label is kept only on an instruction start inside code, or at the start
   of a data area.
5. **Line comments:** each placed instruction's trailing `;` comment, wrapped and limited as Q5 says.
6. **Synopses:** the comment block in front of each routine. OZ headers usually have `IN:`/`OUT:` and
   "registers changed" sections, which map onto `Entry:/Exit:/Changes:`. If a block can't be mapped, it
   is kept as a plain synopsis and listed for review.
7. **Data regions:** from runs of `defb`/`defw`/`defm`/`defs` and from the `binary` includes (fonts,
   keymaps), with `defc`/`fill` decoding where it applies.
8. **Output:** every entry gets `source`, and the sidecar's `source` key names the repository, tag and
   commit. The sidecar is written through the formatter (`npm run rom:annotations`).
9. **Review list,** written to `.local/oz-import/`: per component, the share of bytes the walk covered,
   every mismatch (file, line, source text, decoded instruction), renames, and headers that couldn't be
   mapped.
10. **Tests:** the aligner on small fixture sources over hand-made bytes (match, mismatch and resync, an
    `IF` branch, a macro), so that its behaviour is pinned down without the OZ tree, which stays
    outside the repository.

*Pilot (2026-11-14): the floating-point package, bank $0D.* The aligner is
`src/common/roms/ozSourceAligner.ts` (tests: `test/annotations/ozSourceAligner.test.ts`), and the CLI is
`node dev/scripts/import-oz-source.cjs fp/fpp.asm --bank 0x0D`, which writes `.local/oz-import/`. Results:
- `fp/fpp.asm` (one module, 2,520 lines, `org FPP_TBL` = $C000) **walks to its end**. 1,839 lines are
  placed over $0000-$0CFB, exactly the bank's used bytes (the rest is $FF). All 236 labels are placed,
  and every jump and call to a module label lands on it (0 target mismatches).
- The generated bank passes the readiness check, measures **level 1** straight away (no unlabelled
  target), and **reassembles byte for byte** (the reassembly template).
- 154 end-of-line comments are imported (none over 70 characters), but only 19 synopses come from
  headers. The FPP's original authors left few headers, and many routines keep reverse-engineered
  names (`sub_0_E441`). Level 2 needs 217 synopses written: Phase 3 work.
- mpm facts learned: in `defs`, `$PC` is the offset from the module's start, not an address
  (`defs ($0021-$PC) ($00)` under `org $C000`). An undefined symbol in an `IF` counts as 0 (the
  `IF !__OZ_DEF__` include guards). Klive lists `(ix+0)` as `(ix)`. `lowram.def` is generated by the
  LOWRAM build and missing from the checkout; FPP only needs it for operand values.
- **Finding for the IDE:** the ROM page document and `rom-ann-export` list a page at $0000, so a
  Z88 bank's absolute operands (`jp $C0B0`) are not named, though the labels are there. On the
  running Z88 they are. The page view should list a bank's runs at their `segments`' addresses: a
  follow-up for Phase 3.

*What the rest of Phase 2 needs* (a census of `os/`, `gn/`, `dc/`, `mth/` and `apps/`: 176 modules,
about 122K lines, 18 projects):
1. The OZ call forms: `oz`, `call_oz(...)` (about 2,100 uses), `fpp` and `extcall`, compared by call
   name with Klive's `oz GN_Sop`-style rows.
2. Multi-module projects: the modules of a `.prj` linked one after another from the first `org`, with
   `xdef`/`xref` symbols shared.
3. Real macro expansion for the MTH bank's data macros (`mthcmd`, `mthtpc`, `dorappl`, ...), and
   `binary` includes (fonts, keymaps) by their file's size.
4. Bank $09, BBC BASIC, is `apps/bbcbasic/basic.dat`, a binary with no source in the repository
   (R.T. Russell's). It cannot be imported and stays under D4: from scratch, or left for later.

### Phase 3 — Import, review, reach level 2

1. Import bank by bank, in this order: kernel (`os/`, plus LOWRAM's bank and `ostables`), GN, DC, FP,
   MTH data, then the applications (BBC BASIC and PipeDream last; they are the largest).
2. For each bank: work through the review list, run `npm run rom:annotations -- level`, and fill any
   labels the source does not provide (generated jumps, data in code) from the bytes (`observed`).
3. `rom-ann-export` for each page: the sidecar reassembles to the ROM.
4. Coverage runs on `test/harness/z88/` (boot, Index, BASIC, PipeDream) to check the data regions
   against what is executed.
5. Record `level: 2` once the tool measures it. Regenerate `rom-annotations.index.json`.

### Phase 4 — Records and shipping

1. `dev/ai/rom-annotations/z88-authoring-guide.md`: banks and their origins, the build, the importer, the
   exemption, and what was learned. Update `README.md`'s D4 section and "Order of work".
2. Add a `PROVENANCE.md` session entry for each import session (commit, banks, review notes).
3. Add the permission notice and `THIRD_PARTY_NOTICES.md` entry (D-OZ2).
4. Add Z88 OZ 4.7 to the reverse-engineering row in `LANDING_PAGE_COMPETITIVE_ANALYSIS.md` (§2 and the
   gap table).
5. Add a changeset (`feature`): **Cambridge Z88 ROM annotations** for OZ 4.7.
6. Checks: focused tests, `npm run build:check`, `npm run rom:annotations -- --check`, `npm run
   lint:renderer` (Phase 1 touches the renderer), then `npm run test:slow` before closing.

## 5. Follow-ups (not in this plan)

- The other OZ releases Klive ships (`z88v50b`, `z88ukv40`), imported from their own tags with the same
  importer, if the permission covers them.
- The pre-OZ-4 ROMs (`z88ukv30` and the national 3.x ROMs) have no source in the repository and stay
  under D4. They could be annotated from scratch, or carried by byte signature where code is shared with
  4.x (only if the carry draws on a D4-clean sidecar, not this one; the decision for that is left open).
