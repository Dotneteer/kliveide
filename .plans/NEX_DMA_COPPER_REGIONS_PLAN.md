# NEX Annotations — DMA and Copper Regions Plan

Status: **implemented** (2026-10-07; open questions resolved in §8). Phases 1-5 are done; §6 lists the follow-ups.

## 1. Goal

A NEX bank's annotated disassembly can mark a range as **Disassembly**, **Bytes**, **Words** or
**Skip** today. Add two more region kinds:

- **Copper**: the range is a Copper list, and each 2-byte word is listed as a `.copper` pragma
  (`.copper wait 96, 8`, `.copper move $41, $1C`, `.copper nop`, `.copper halt`).
- **DMA**: the range is a zxnDMA program (the byte stream a program sends to port `$6B`), and each
  register write is listed as a `.dma` pragma (`.dma reset`, `.dma wr0 a_to_b, transfer, $8000,
  $0100`, `.dma wr4 continuous, $4000`, `.dma load`, `.dma enable`).

The listing should read like the source a Klive programmer would have written, using the same
pragmas the assembler accepts.

## 2. What already exists

| Piece | Where | Reuse |
|---|---|---|
| Region model `disassemble \| bytes \| words \| skip`, validation, normalization, merge | `DocumentPanels/Next/nexAnnotations.ts` (`NexAnnotationRegionType` :29, `REGION_TYPES` :230, `normalizeRegions` ~:870, `sameRegionLayout` :73) | extend |
| Row generation per region | `DocumentPanels/Next/nexAnnotatedDisassembly.ts` (`createAnnotatedNexDisassemblyItems` :147, `createByteItems`, `createWordItems`, `dataRowLength`) | extend |
| Row-level region type | `disassemblers/common-types.ts:134` (`DisassemblyAnnotationRegionType`), `DisassemblyRow.tsx:176,451,482` | extend |
| Mark As menu + intents | `annotationEditor/NexAnnotationEditorViewModel.ts:348-351, 487` (`regionTypeOfAction`), `NexAnnotationEditorIntents.ts:74`, controller `markRegion` | extend |
| Region dialogs | `NexRegionDialog.tsx:37, 224, 282`, `NexRegionsDialog.tsx:43, 269` | extend |
| Content-mix bar | `nexBankSummary.ts:17` (`NEX_REGION_TYPES`, `bankContentMix`), `NexBankBrowser.module.scss:91-103` | extend |
| Copper decoder (pure, shared) | `src/common/zxnext/copper/copperDecoder.ts` — `decodeCopperWord`, `formatCopperOperands`, `describeCopperInstruction` | **reuse as is** |
| `.copper` / `.dma` emission | `src/main/compiler-common/common-assembler.ts` (`processDmaWr0Pragma` … `processCopperWordPragma`) | reference + round-trip oracle |
| DMA hardware protocol | `src/emu/machines/zxNext/wasm/zxnext/zxnext-dma.c` (`zxnextDmaWriteBase`, `zxnextDmaWritePort`); reference `_input/next-fpga/src/device/dma.vhd` | reference |
| User docs for the pragmas | `docs/content/z80-assembly/zx-next-dma.mdx`, `zx-next-copper.mdx` | reference |

**There is no DMA decoder.** Copper decoding exists; the DMA side needs a new pure module.

## 3. Decisions

**D1. The listing must reassemble.** Every row's instruction text must assemble back to exactly the
bytes it covers (with `.model next`). A row the pragma syntax cannot express falls back to a form
that can (`.dma cmd $xx`, `.copper word $xxxx`, `.defb`). The meaning goes in the generated comment.
This is the main correctness property, and the round-trip tests in §7 enforce it with the real
assembler.

**D2. Decode the DMA stream the way the hardware does, not the way the assembler writes it.** The
follow-byte bits in each base byte decide how many bytes the command takes, as in
`zxnextDmaWriteBase`/`zxnextDmaWritePort`. That is what gives the right answer for the documented
runtime-patching pattern: `.dma wr0 a_to_b, transfer` sets all four follow-byte bits and the program
supplies the bytes with `.dw`. The decoder reads those four bytes as port A and block length, which
is what the DMA will do with them.

**D3. Sidecar storage stays readable by shipped builds.** Shipped builds treat an unknown region
`type` as an **error and reject the whole sidecar** (`nexAnnotations.ts:883`). So on disk the new
kinds are stored as `bytes` regions with an extra key, which older builds ignore:

```json
{ "start": 4096, "end": 4159, "type": "bytes", "rowBytes": 2, "decode": "copper" }
{ "start": 4160, "end": 4191, "type": "bytes", "decode": "dma" }
```

An older build lists a Copper region as one `.defb` word per row, which is what the doc already
recommends for Copper data, and lists a DMA region as plain bytes. As with bank comments and
`sprites`, an older build that rewrites the bank drops `decode`. This trade-off is already accepted
and documented, and it needs **no schema bump**.

A schema bump was considered and **rejected** (Q1): shipped builds would then refuse the whole
sidecar — labels, comments and breakpoints — over what is in effect a view hint. That is the outcome
`sprites.active` and bank comments were designed to avoid.

In memory, `NexAnnotationRegionType` gains `"copper" | "dma"`, so every consumer (dialogs, menu,
mix bar, rows) sees a plain type. The mapping is done in exactly two places: the region parser
(`bytes` + `decode` → `copper`/`dma`) and a new `toSidecarRegion` used by the writer
(`formatNexAnnotations`, `saveNexAnnotationSubtree`). An unknown `decode` value gives a **warning**,
not an error, and the region stays `bytes`. That leaves room for future decoders.

**D4. Region-shape rules.**
- Copper: even length, like `words`. Words are big-endian, as the Copper reads them, and are
  aligned to the region start.
- DMA: any length. A command cut off by the region end is shown as `.defb` with a
  `; truncated: WRn expects N more bytes` comment.
- Neither kind is ever cut at the program counter. This already holds, because only `disassemble`
  regions are cut.

**D5. Labels inside a command.**
- **Copper:** a word is never split. A label on its second byte still names that address in
  operands, but it does not get its own row. This matches the existing `rowBytes` record rule.
- **DMA:** a label on a follow byte splits the command into the documented runtime-patching form,
  which also reassembles. For example:
  ```
  .dma wr0 a_to_b, transfer
  PORT_A:    .defw $8000
  BLOCK_LEN: .defw $0100
  ```
  The split happens at a field boundary (`.defw`). A label on the odd byte of a field falls back to
  `.defb`.

**D6. Number base follows the bank's decimal flag**, as `.defb`/`.defw` rows do. WAIT operands stay
decimal by default, as `formatCopperOperands` already does.

**D7. No new single-key shortcuts** (Q2). The hint table in `NexAnnotationEditorViewModel.ts` is
documented as "the whole set" by decision. Copper and DMA ranges are rare and typically marked once
per program, so the Annotations menu and the region dialogs are enough. Keys can be added later if
marking turns out to be frequent; once taken they are hard to give back.

**D8. One DMA command per row, never collapsed** (Q4). A collapsed "×N" row would break D1 (it would
need a repeat construct to reassemble) and complicate selection and labels. A long run of identical
commands — typically `$00` decoding as `.dma wr2 memory, decrement` — means the range is too long;
the remedy is to shorten the region, not to hide the symptom. To help with that, the region dialogs
**suggest trimming** when a DMA range ends in a long run of `$00` (threshold: 8 bytes or more),
showing the trimmed end; the user decides.

**D9. The DMA decoder is a standalone deliverable.** `dmaDecoder.ts` is useful beyond this
feature: a hover on `.dma` lines in the editor and a future DMA panel can use the same module, as the
Copper decoder already serves several views. Phase 1 builds and tests it independently of the
annotation work, and its API must not depend on annotation types.

## 4. The DMA decoder — `src/common/zxnext/dma/dmaDecoder.ts` (new, pure)

This is a sibling of `copperDecoder.ts`, with no React and no Node. Decoding is done in Klive's own
words from the C core and `dma.vhd`.

```ts
type DmaCommand =
  | { kind: "wr0"; offset; length; base; dirAtoB; transferType; follow: DmaField[] }
  | { kind: "wr1" | "wr2"; ...; portIsIo; addrMode; timing?; prescaler? }
  | { kind: "wr3"; ...; dmaEnable; intEnable; stopOnMatch; mask?; match? }
  | { kind: "wr4"; ...; mode; portB?: DmaField; extraFollow?: boolean /* D4: DMA goes deaf */ }
  | { kind: "wr5"; ...; autoRestart }
  | { kind: "wr6"; ...; command: number; readMask?: number }   // $BB takes one follow byte
  | { kind: "invalid"; ... };                                  // e.g. D7=1, D1D0=10 but not 10xxx010
type DmaField = { offset: number; size: 1 | 2; value: number; role: "portA" | "length" | ... };

decodeDmaStream(bytes, start, end): DmaCommand[]       // greedy, hardware sequencing
formatDmaCommand(cmd, opts): { text: string; representable: boolean }
describeDmaCommand(cmd): string                       // the comment column
```

Representability rules. When a rule fails, the fallback is `.dma cmd $base` plus `.defb` follow
bytes on the same row:

| Group | Pragma form when… |
|---|---|
| WR0 | D6–D3 = `1111` and all four follow bytes are inside the region |
| WR1 | addr mode ≠ `11`; if D6, timing byte ∈ {0,1,2} and timing D5 (the swallowed port-A prescaler) clear |
| WR2 | addr mode ≠ `11`; if D6, timing byte has only bits 0–1 (value ≤ 2) and D5 |
| WR3 | mask and match both present or both absent (the pragma takes the pair) |
| WR4 | D3 = D2 = 1, D4 = 0, D7–D5 a valid mode |
| WR5 | exactly `$82` / `$A2` |
| WR6 | `$C3/$CF/$87/$83/$D3` → keyword, `$BB nn` → `readmask`; any other → `.dma cmd $xx` with its meaning (`$8B` reinit status, `$A7` start read sequence, `$BF` read status, `$C7/$CB` reset port timing, others "no effect on the Next") |

## 5. Phases

### Phase 1 — DMA decoder
- Add `dmaDecoder.ts` with node tests in `test/zxnext/dmaDecoder.test.ts`. Cover every row of the
  §4 table and every example in `zx-next-dma.mdx`, plus the runtime-patching program.
- **Round-trip test:** for a corpus of `.dma` sources, assemble with the real Z80 assembler, then
  decode, format, and reassemble. The bytes must be identical. Add a property test over random byte
  streams: the formatted text must reassemble to the input bytes. This checks D1 for the fallbacks
  too.
- Keep the API free of annotation types (D9): it takes bytes and a range, and returns commands
  and text, so an editor hover or a DMA panel can use it unchanged.
- **Gate:** the round trip is green, and no decoder path reads past `end`. This phase can merge on
  its own, before any UI work.

### Phase 2 — Region model and sidecar
- Add `"copper" | "dma"` to `NexAnnotationRegionType` and `DisassemblyAnnotationRegionType`.
- Parser: accept `decode`, map it, and validate the Copper even length. Writer: `toSidecarRegion`.
  `sameRegionLayout` compares the kind, so a Copper region never merges with a neighbouring
  `bytes, rowBytes: 2` region.
- Tests in the existing `nexAnnotations` suites:
  - parse ↔ write round trip;
  - the written JSON never has `"type": "copper"`/`"dma"`;
  - a sidecar written by this build passes the **previous** validator's rules (the type is in the
    old set, `rowBytes` is valid on `bytes`);
  - an unknown `decode` warns and keeps the file.
- **Gate:** all existing annotation suites pass unchanged, including the dialog-consistency suite.

### Phase 3 — Listing generation
- `nexAnnotatedDisassembly.ts`: add `createCopperItems` (one row per word, using
  `decodeCopperWord` and `formatCopperOperands`, lowercase `.copper` mnemonics; a NOP with a
  non-zero value is listed as `.copper word $00vv`) and `createDmaItems` (one row per command, with
  the D5 label split and the D4 truncation rule).
- Put the meaning in `generatedHardComment`, so the existing rule holds: a user end-of-line comment
  replaces the generated one and clearing it brings the generated one back. Copper uses
  `describeCopperInstruction` (register name and slice meaning); DMA uses `describeDmaCommand`.
- Row metadata: `createAnnotationMetadata(..., "copper" | "dma")` with the row's byte length, so
  selection, the context menu and `item.annotation.bankOffset` work unchanged.
- Tests: snapshot listings for a Copper split-screen list and the documented DMA program, the label
  splits, truncation, and decimal view. Also check that the live-bank view (bytes differing from the
  file) re-decodes the region.

### Phase 4 — Editing UI
- Menu: add **Mark As Copper** and **Mark As DMA** after Mark As Words (`ViewModel.ts:348`),
  actions `mark-copper` / `mark-dma`, and `regionTypeOfAction`. No new shortcut keys (D7).
- `NexRegionDialog` / `NexRegionsDialog`: add the two types to the type list, the even-length check
  for Copper, and the per-type label switches at :224 / :269.
- The trim suggestion for DMA ranges ending in a `$00` run (D8): a non-blocking hint in the dialog
  with a one-click "Trim to $xxxx". Validation logic lives in the dialog's pure helpers so it is
  tested without rendering.
- Content mix: extend `NEX_REGION_TYPES`, `bankContentMix` and the mix bar, with new `.mix_copper` /
  `.mix_dma` classes whose colours are aliased in the token layers, never as literals.
  `DisassemblyRow` already exposes `data-annotation-region`. Use it only if the data rows are styled
  per type today.
- Controller journey tests for marking a range as Copper/DMA (including the whole-bank
  confirmation) and for the odd-length Copper rejection.
- Per AGENTS.md: update `.ai/ui-theming-intent-and-lessons.md` in the same change, with the rule
  for how the mix-bar hues were chosen.
- Verify in the running app: open a NEX, pop out a bank, mark a Copper list and a DMA program, and
  check the listing and the bank browser's mix bar.

### Phase 5 — Documentation
- `.docs/annotations.md`: the Region Rules section (two new kinds, the D3 storage form and its
  older-build behaviour, the D5 label rule).
- User docs: the region kinds wherever the NEX viewer's annotations are described. Link to
  `zx-next-copper.mdx` / `zx-next-dma.mdx`. Then run `npm run doc:build && npm run doc:check`.
- CHANGELOG entry.

## 6. Later (not in this plan)

- **DMA address operands as labels:** `.dma wr0 a_to_b, transfer, SpriteData, 256`, through the
  same `operandLabelResolver` the instruction rows use, with Go To Definition on them.
- **NextReg names in `.copper move`**, once `NEXTREG_NAMES_AND_COPPER_SHORTHANDS_PLAN.md` Part A
  lands. The listing must not emit names before the assembler accepts them (D1).
- **Suggested regions:** seed Copper regions from the compiler's `copperBlocks` debug info when the
  NEX was built by Klive, or detect `ld c,$6B` + `otir` over a table.
- Colour swatches on `.copper move $41` rows (`copperMoveSwatch`).
- **Assembler warning for a half-supplied `.dma wr0`** (Q3). Warn when `.dma wr0` has a port A
  address but **no block length**: it emits three bytes while the base byte announces four, so the
  DMA silently takes the next command's base byte as the length's high byte. **Do not** warn for
  `.dma wr0 dir, type` with no address and no length, or for `.dma wr4 mode` with no address — that
  is the documented runtime-patching pattern, and a warning there would be noise. This is a separate
  small change (a new warning code in `assembler-errors.ts`, a test, and a note in
  `zx-next-dma.mdx`); this plan does not depend on it.
- **Editor hover on `.dma` lines**, and a DMA panel, built on the Phase 1 decoder (D9).

## 7. Risks

| Risk | Mitigation |
|---|---|
| Old builds reject a new region type | D3: stored as `bytes` + `decode`, plus a test that the written JSON uses only old types |
| A listing that looks right but does not reassemble | D1 round-trip tests with the real assembler, including random streams |
| `.dma wr0 a_to_b, transfer, $8000` (address but no length) emits three bytes while the base byte announces four, so the hardware consumes the next command's base byte as length-high | The decoder shows this faithfully (D2), so the listing reveals it. An assembler warning for exactly this case is listed in §6 as its own change |
| A zero-filled tail marked DMA lists as endless `.dma wr2 memory, decrement` (`$00` is a valid WR2) | Honest per D2, listed one per row (D8). The region dialogs suggest trimming a trailing `$00` run |
| Copper word alignment if the region starts on an odd offset | Words align to the region start. Show a dialog hint when the start is odd |

## 8. Resolved questions

| # | Question | Decision |
|---|---|---|
| Q1 | Store the new kinds as `bytes` + `decode`, or as real types with a schema bump? | **`bytes` + `decode`, no schema bump** (D3). A bump would make shipped builds refuse the whole sidecar over a view hint. |
| Q2 | Single-key shortcuts for Copper and DMA? | **None for now** (D7). The hint table is "the whole set" by decision; the menu and dialogs suffice. |
| Q3 | Should the assembler warn about missing `.dma wr0` / `wr4` follow bytes? | **Yes, but only for `wr0` with an address and no length**, and as a separate change (§6). The no-address forms are the documented patching pattern. |
| Q4 | Collapse repeated identical DMA commands into one row? | **No, one command per row** (D8), with a trim suggestion for a trailing `$00` run. |

## 9. Implementation notes

Where the implementation differs from, or adds to, the text above:

- The decoder tests live beside the Copper decoder's, in `test/zxnext-shared/dmaDecoder.test.ts`; the
  annotation, listing and dialog-helper tests are in `test/renderer/nexDecodedRegions.test.ts`.
- `decodeDmaStream(bytes, start, end)` takes an **exclusive** `end`; the listing passes `region.end + 1`.
- A multi-byte fallback is one `.defb` row (an assembler line holds one statement); `.dma cmd $xx` is
  used for one-byte fallbacks and for the base byte of a split command that has no patching form.
- An odd-length Copper region **in a file** loads as Copper with a warning (its last byte listed as
  `.defb`) rather than degrading to `bytes`: a neighbouring region edit can trim one, and losing the
  kind on reload would be worse. New odd spans are refused by the dialogs and by `withRegion`.
- The round trip found an assembler bug: a bare `.dma wr3` followed by another line took the newline
  as a mask expression (Z0111). Fixed in `parseDmaWr3`, with a test.
- The mix bar's Copper and DMA segments are named in its legend and tooltip only when the bank has
  them (`mixLegendTypes`). Hues: `--color-nex-mix-copper` (success green) and `--color-nex-mix-dma`
  (favourite gold); see `.ai/ui-theming-intent-and-lessons.md`.
- `formatCopperSource` in `copperDecoder.ts` writes the `.copper` source text, shared by the listing
  and the region dialog's preview.
