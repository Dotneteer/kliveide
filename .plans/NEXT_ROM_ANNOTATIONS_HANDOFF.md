# Handoff: ZX Spectrum Next ROM annotations

For the next session. The plan is `NEXT_ROM_ANNOTATIONS_PLAN.md` (phases N0-N6); this file says where the
work stands, what is uncommitted, and how to go on. Read first: `AGENTS.md`, `.ai/rom-annotations/README.md`
(the D4 rule), `.ai/rom-annotations/sp48-authoring-guide.md` (the method and its lessons), the plan.

## Where it stands (2026-10-21)

- Branch `dotneteer/sp128-rom1`, not pushed. `d95637bca` finished R4 (every +2A/+3/+3E ROM at level 2);
  the commit after it, "prepare the ZX Spectrum Next's ROMs (N0); handoff", holds N0 and this file.
- **N0 is done and committed.** Its changes:
  - the Next reports its ROM pages (`ZxNextWasmV2Machine.getRomPartitionImages`: R0-R3, X0, X1, DM);
  - a 16K ROM page's sites count within the page (`bankSpace.ts`, `isNext16kRom`; test in
    `test/annotations/bankSpace.test.ts`);
  - `KNOWN_ROM_PAGES` knows the Next's pages, with a `page` field (`romIdentity.ts`; `shippedRomPageOf` in
    `Z80MachineBase.ts` uses it; the table test in `test/annotations/zx8081Annotations.test.ts` reads pages);
    new kinds `next-os`, `next-divmmc`, `next-multiface` (`romSysVars.ts`: `next-os` gets the 128K
    variables);
  - the Next's live view decodes its ROM 3 (`sp48-basic`) as the 48K ROM (`machine-registry.ts`,
    `nextCustomDisassembler`);
  - test `test/zxnext-hw/rom/rom-sources.test.ts` (e2e-cores tier);
  - the tools take `PAGE=<n>` (`sp48-dis.cjs`, `apply-annotations.cjs`, `annotated-view.py`,
    `reassemble-test.ts.txt`; `check-annotations.cjs` measures every page);
  - the session's scripts moved into `.ai/rom-annotations/tools/`: `merge-drafts.py`, `apply-draft.py`,
    `map-rom.py`, `build-mapped.py`, `error-bytes.py` (headers say how to use them); helper briefs in
    `.ai/rom-annotations/helper-briefs/`;
  - `PROVENANCE.md`, the authoring guide, the plan, this file.
  - Changeset: none. N0 is a step of the plan; the changeset comes with N6 (AGENTS.md's rule).
  - Checked: `npm test` (25,242 passed), `npm run build:check`. **Not checked:** opening a working copy in
    the running IDE (`rom-ann-open enNextZX.rom -page 3`) and the Next's Disassembly view showing it.
- **Working copies** (the author follows the work by opening them; the IDE re-reads them on each write):
  `~/Klive/RomAnnotations/enNextZX.rom.dis` (pages 0-3), `enAltZX.rom.dis` (0, 1), `enNxtmmc.rom.dis`,
  `enNextMf.rom.dis` — skeletons, level 0, each page one disassemble region. Write them back with the cmp
  guard (`zx81-authoring-guide.md`): the author may edit them in the IDE meanwhile.

## Done since: N1 (2026-10-21)

`enNextZX.rom` page 3 is at level 2 in the working copy `~/Klive/RomAnnotations/enNextZX.rom.dis` (1,148
labels, 5,416 comments, no unlabelled targets, reassembling byte for byte; probes: MUL_HL_DE, NEXTREG_READ).
Code changes with it (committed with N1): the kind `next-basic`
(`romIdentity.ts`, `romKindUsesZ80N`), the Z80N's opcodes decoded on every Next page (`romDecoder.ts`,
`sp48-dis.cjs`, the ROM page document in `StaticMemoryDump.tsx`), the Next's live chain gated on
`next-basic`, test `test/annotations/nextRomDecoder.test.ts`. The file's recorded level stays 0 until every
page is done (the level is per file).

## Done since: N2 (2026-10-21)

`enNextZX.rom` pages 0 and 1 are at level 2 in the working copy (1,068 and 1,038 labels; 3,895 and 4,663
comments; reassembling byte for byte). Code changes with it (committed with N2): kinds
`next-os0`/`next-os1`/`next-os2` replace `next-os` for NextZXOS's pages 0-2 (`next-os` stays for the
alternate ROM until N5), `NextZxOsCustomDisassembler` (`src/renderer/appIde/disassemblers/z80-disassembler/
nextzxos-disassembler.ts`: a per-page table of restarts and CALL targets followed by inline data), wired into
`romDecoder.ts`, `romSysVars.ts` and the Next's live chain (`machine-registry.ts`); tests in
`test/annotations/nextRomDecoder.test.ts`. New tool `pdf-text.py` (the API document as text). Details in
PROVENANCE.

## Done since: N3 (2026-10-21)

`enNextZX.rom` page 2 is at level 2 (761 labels, 3,111 comments) and the working copy records level 2 for
the file; all four pages reassemble byte for byte. Page 2 is the DOS ROM (not editor-like, as the first
measure said). The decoder learned page 2's `RST $08` (a DivMMC call: byte + word) and `CALL $3E18`/`$3E32`
(+ word, the alternate ROM). The working copy is not shipped (N6).

## Done since: N4 (2026-10-21)

`enNxtmmc.rom` (617 labels) and `enNextMf.rom` (424) are at level 2 in their working copies, record level 2
and reassemble byte for byte. The decoder has tables for both (`NEXT_DIVMMC_ROM`, `NEXT_MULTIFACE_ROM`), with
tests. Details in PROVENANCE.

## The next step: N5, the alternate ROM and enNextLG's page 2

`enAltZX.rom` (two pages, kind `next-os` for now): NextZXOS calls it through `CALL $0068` (pages 0 and 1) and
`CALL $3E18` (page 2), and its `$007B` switches it off again (NextReg $8C). Its keyword table gave N1 the
token names. Read its restarts first and give its pages kinds and decoder tables of their own if they need
them. Then `enNextLG.rom`'s page 2 (`43fc1f2f`, kind `next-os2`): it differs from `enNextZX.rom`'s page 2 only
there; map page 2's sidecar onto it with `map-rom.py` (`SRC_PAGE=2 PAGE=2`), which should carry almost
everything. The merge scripts of N2-N4 are in the session scratchpad (`n4/merge.sh` refuses to write when the
check reports problems): copy that one.

## Lessons from R3-R4 to keep

- **Mapping slips** (`map-rom.py` guards against the known ones; audit anyway): constants taken for
  addresses ("$2000 misses", the PLAY period `$0FBF`), other ROMs' addresses remapped (anything after
  "ROM n" or in a "ROM n's (...)" list is left alone; an address written before "in ROM n" too), ports.
  Audit by listing every token the mapping changed with its context; fix other ROMs' addresses from that
  version's own bytes (search the byte sequence).
- **Inline data after calls** misaligns the listing: decode it (a decoder option, when the routine is at
  one address in every version) or mark one-byte regions (`error-bytes.py`, when it moves).
- **A jump into another ROM** that lands inside an instruction is reported as a mid-instruction target and
  needs no label; one landing on an instruction start gets a label saying nothing here jumps there.
- **Helpers:** five per ROM page of ~3K each worked; review a sample of each draft against the code, check
  drafts against each other for shared names, and pass findings that concern another range on to its
  helper while they run (`SendMessage`).
- **Never write a working copy from a string edit:** an unescaped newline once made the live file
  invalid JSON for a moment. Load, change and dump it as JSON, then canonicalise and check before the cmp guard.
- **Feed findings back while helpers run:** in N2 two inline conventions (`RST $00` on page 1, `CALL $08EF`)
  were found by one helper; the decoder took them and the others re-checked against the new listing.
  Helpers misread inline words whose target is in another page as "inside an instruction": check them.
- **D4 for the Next:** the NextZXOS/esxDOS API document, the developer guide, the FPGA sources and the MMC
  specification in `_input/` are interface documents (provenance `manual`); NextZXOS's and esxDOS's
  published sources are not allowed. The other `_input/` files stay closed.
