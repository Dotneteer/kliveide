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

## The next step: N1, NextZXOS's ROM 3 (`enNextZX.rom` page 3)

Measured: page 3 shares ~9.7K with the 48K ROM. A first mapping pass (run in the last session, not kept)
carried 742 of `sp48.rom.dis`'s 1,043 labels and 3,435 of its 5,263 lines, leaving 346 unlabelled targets
and one data region unplaced (the 48K's `SYNTAX_ENTRIES` area, `$1A48-$1B16`). To redo it:

```
W=<a work folder in the scratchpad>
PAGE=3 SRC_PAGE=0 python3 .ai/rom-annotations/tools/map-rom.py $W src/public/roms/sp48.rom.dis sp48.rom enNextZX.rom $W/p3
PAGE=3 python3 .ai/rom-annotations/tools/build-mapped.py $W $W/p3 enNextZX.rom "ZX Spectrum Next NextZXOS ROM 3 (48K BASIC)" $W/p3.dis
# second pass, listing the target with the first pass's regions
PAGE=3 SRC_PAGE=0 python3 .ai/rom-annotations/tools/map-rom.py $W src/public/roms/sp48.rom.dis sp48.rom enNextZX.rom $W/p3 $W/p3.dis
PAGE=3 python3 .ai/rom-annotations/tools/build-mapped.py $W $W/p3 enNextZX.rom "ZX Spectrum Next NextZXOS ROM 3 (48K BASIC)" $W/p3.dis
```

`build-mapped.py` writes a sidecar holding only bank 3. Put that bank (its `banks["3"]`, `pages["3"]` and
the `3:`-prefixed provenance) into `~/Klive/RomAnnotations/enNextZX.rom.dis`, then let helpers complete it
(`helper-briefs/complete-a-mapped-sidecar.md`, merged with `PAGE=3 apply-draft.py`), audit the mapped texts
(below), probe on the Next core (`test/harness/zxnext`, which needs an SD image for NextZXOS to boot:
`attachSdCard` and `runFramesAsync`, see its README), and reassemble
(`PAGE=3 SIDECAR=... ROM=enNextZX.rom`, the template in `tools/reassemble-test.ts.txt`).

Then N2 (pages 0 and 1): read their new `RST $28` first (`LD ($5B54),BC / EX (SP),HL / JP ...`) and decide
whether `next-os` pages need a decoder (as `plus3SyntaxDecoder` in
`zx-spectrum-128-editor-disassembler.ts` does for the +3's ROM 1).

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
- **D4 for the Next:** the NextZXOS/esxDOS API document, the developer guide, the FPGA sources and the MMC
  specification in `_input/` are interface documents (provenance `manual`); NextZXOS's and esxDOS's
  published sources are not allowed. The other `_input/` files stay closed.
