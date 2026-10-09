# Reverse-Engineering Tools — Implementation Plan (G7.3–G7.6)

Status: **decisions recorded** (2026-10-09). The author accepted the suggested answer to every
question in §10, and the text below already assumes them. Nothing here is built yet.

Scope, from [CLOSING_THE_GAPS_PLAN.md](CLOSING_THE_GAPS_PLAN.md) G7:
- **G7.3 Code/data auto-detection.** Classify bytes as code or data from the coverage flags and
  the heat map (G5.1–G5.2), then write the result as regions into the annotation model.
- **G7.4 Graphics finder.** Browse memory as bitmaps at a chosen width (UDGs, sprites, fonts), find
  graphics and name them.
- **G7.5 SkoolKit import/export.** Exchange annotations with SkoolKit's skool and control (`.ctl`)
  files.
- **G7.6 Export as source.** Export an annotated region as Klive asm source that reassembles to the
  same bytes.

Builds on:
- [REVERSE_ENGINEERING_ANNOTATIONS_PLAN.md](REVERSE_ENGINEERING_ANNOTATIONS_PLAN.md) (G7.1/G7.2,
  decisions recorded, **not built yet**). This plan needs:
  - the machine-neutral model `ProgramAnnotations` (its A0);
  - the bank space (A1);
  - the active annotation set and its session (A2);
  - the shared resolver and the live annotated listing (A3).

  This plan calls these *G7.1-A0* to *G7.1-A3*. It uses G7.1's names (`annotations/…`,
  `BankSpace`, `MemorySite`, `SlotPaging`) as if they existed.
- [CODE_COVERAGE_AND_HEAT_MAP_PLAN.md](CODE_COVERAGE_AND_HEAT_MAP_PLAN.md) (G5.1/G5.2, done):
  - the per-byte flags `PF_EXECUTED`/`PF_CODE`/`PF_READ`/`PF_WRITTEN`/`PF_SELF_MODIFIED`;
  - the counters;
  - `getProfileView` and `getProfileTouched`;
  - `.kcov` load and merge.
- [PROFILER_PLAN.md](PROFILER_PLAN.md) (G5.4, done): the call edges (`getProfileEdges`). They are
  the most reliable list of entry points.
- [NEX_DMA_COPPER_REGIONS_PLAN.md](NEX_DMA_COPPER_REGIONS_PLAN.md) D3: a region type that older
  builds do not know is stored as `bytes` + `decode`. This plan uses that mechanism again for `text`
  and `graphic`.
- [TRACE_EXPORT_PLAN.md](TRACE_EXPORT_PLAN.md): `showSaveFileDialog`, which was added with G7.6 in
  mind.

Not in scope:
- **A graphics editor.** G7.4 finds and names graphics; it does not draw them.
- **SkoolKit's HTML side.** That means `skool2html`, its `ref` files, and rendering skool macros
  (`#R`, `#UDG`, …) in Klive's views. Macros are kept as text (S6).
- **Static analysis beyond reachability.** G7.3 follows branches from code it has seen run. It does
  not simulate registers, so it cannot resolve `JP (HL)` tables, except through the heat map's
  observed targets (§4.4).
- **The Z88 and C64**, as in G7.1.

---

## 1. What is being added, and why

Spectrum Analyser is the reference on the classic machines. Its row in §2 of
[LANDING_PAGE_COMPETITIVE_ANALYSIS.md](LANDING_PAGE_COMPETITIVE_ANALYSIS.md) lists four features
that G7.1/G7.2 do not cover:
- automatic code/data detection;
- a graphics finder;
- SkoolKit;
- (through SkoolKit) a path from an annotated disassembly to source.

**Klive starts from a stronger position on all four:**

- **Per-bank coverage.** Klive's coverage is per *physical* byte. It records a separate *code* flag
  for operand fetches, beside the instruction-start flag. The coverage plan's D3 says that flag
  exists for G7.3. Spectrum Analyser's classification works on the 64K view, so paged banks
  confuse it.
- **A full annotation model.** Klive already has labels, regions, comments, sessions and an MVC
  editor. Auto-detection, naming graphics and SkoolKit import all become *writers of the same
  model*. None of them needs a store of its own.
- **Its own assembler.** "Export as source" can therefore be proven: the export is assembled and
  compared with the bytes it came from.

**Four things are missing:**

1. **No classifier.** Nothing in `src` turns flags into regions. Nothing does reachability either:
   the disassembler is a linear sweep per section, and nothing follows a jump. The building blocks
   do exist: `DisassemblyItem.branch` (`z80-branch-info.ts`), `z80InstructionLength` /
   `instructionStarts` (`src/common/profile/z80InstructionLength.ts`) and `findSmcRuns`
   (`smcReport.ts`).
2. **No bitmap view of arbitrary memory.** The pixel views are tied to hardware:
   - the Next's sprite, pattern, tilemap and Layer 2 viewers;
   - ZX screen previews.

   The closest precedent is the static dump's `"sprites"` view mode (`NexBankSpritesView.tsx`). It
   can mark a span, but it decodes only Next sprite formats.
3. **No exchange formats.** The repo has no skool or ctl code at all.
4. **No source export.** The `dis` command opens a result document only. The disassembler's text
   does *not* always reassemble to the same bytes (§2.4).

### 1.1 Decisions this plan proposes

The decisions marked **(Qn)** were questions for the author. Each one is settled by the suggested
answer in §10.

| # | Decision |
|---|---|
| **R1** | **Every feature writes the G7.1 model through the active set's session** (G7.1 T5). No feature writes a `.dis` file itself. |
| **R2** | **Model additions are backward-compatible keys, not new schema versions.** The additions are `text` and `graphic` decoded regions, the region `origin`, the bank `graphics` list, the line `endComment`, and the bank `interop.skool` passthrough (§3). A shipped build ignores all of them, as it ignores `decode` today. Next files stay at version 2 (G7.1 A6). |
| **R3** | **Auto-detection proposes; the user applies.** A detection run produces a *proposal*: a list of region changes per bank, with counts. Applying it is one session update. Regions it wrote carry `origin: "auto"`, so they can be told apart, re-detected and cleared later. Without a flag, a user's own regions are never overwritten. |
| **R4** | **Classification has three evidence levels:** *observed* (coverage flags), *reached* (followed by static reachability from observed code), and *inferred* (heuristics: text, pointer tables). Each level can be switched on or off, and the proposal reports each level's count. |
| **R5** | **The graphics finder is a view of the static memory dump and of a live document.** It is one component, `GraphicsView`. It is added as a fourth `viewMode` of `StaticMemoryDump` (snapshots, NEX/tape/Z88 banks) and as a live *Graphics* document over the paused machine. |
| **R6** | **A named graphic is a label plus a `graphic` region plus a `graphics` entry.** The entry holds width, height, count and layout, so the finder, the listing, the source export and the SkoolKit export all show it the same way. |
| **R7** | **Provenance for SkoolKit (G7.5).** SkoolKit is GPL-3 Python. Klive's parser and writer are written from SkoolKit's *documented file formats* only; the formats are interface facts. No SkoolKit code is read, copied or translated. **Running** an installed SkoolKit (`skool2ctl`, `skool2asm`, `sna2skool`) as a behavioural oracle on Klive's own test files is allowed, but not in CI (the same rule as Klive BASIC's D12). |
| **R8** | **D4 still holds for ROMs.** A published skool or ctl file of a Spectrum ROM is never imported into, compared with, or used for a shipped ROM sidecar. A *user* may import any skool file into their own annotation set or their own ROM layer; that is their data. `.ai/rom-annotations/PROVENANCE.md` (G7.2 R1) gets this sentence. |
| **R9** | **Skool import binds to bytes Klive already has.** It brings in structure and text and checks them against the snapshot or live memory. It never builds memory from a skool file's instruction text. Mismatching instructions are reported, and the import does not apply their region. |
| **R10** | **Source export is verified, not hoped for.** The emitter writes a `.defb` line, with the instruction as a comment, for every encoding the assembler would not reproduce. The table of such encodings is checked exhaustively by a test (§6.3). After writing, the export is assembled, and the export reports whether it is byte-identical. |
| **R11** | **One dialect first: Klive asm** (`.kz80.asm`). The emitter goes through a small dialect interface, so that sjasmplus can follow in a later plan **(Q4)**. |
| **R12** | **The shared code lives outside React.** The classifier, the reachability walk, the skool/ctl parser and writer, and the source emitter are pure modules in `src/common/reverse/`, with unit tests. G7.2's ROM authoring scripts (R1 `coverage`/`skeleton`) reuse the classifier and the walk instead of writing their own. |

---

## 2. Current code this touches

These paths were found by investigation on 2026-10-09. G7.1 will move the `Next/` annotation files
to `annotations/`; the references below give today's location.

### 2.1 Coverage and the heat map (input to G7.3, overlay for G7.4)

**Flag bits.** They are in `src/emu/z80/wasm/z80-profile.h:92-98`, mirrored in
`src/common/profile/profileTypes.ts:10-17`:

| Flag | Value | Meaning |
|---|---|---|
| `PF_EXECUTED` | `0x01` | An M1 fetch of the first opcode or prefix byte (an instruction start). |
| `PF_CODE` | `0x02` | Any code fetch: opcode, prefix, displacement or operand. |
| `PF_READ` | `0x04` | A data read. |
| `PF_WRITTEN` | `0x08` | A data write. |
| `PF_SELF_MODIFIED` | `0x10` | A write to a byte fetched as code, or a fetch from a written byte. |
| `PF_INTERRUPT` | `0x20` | An instruction started here inside an interrupt service. |
| `PF_HALT` | `0x40` | |

**Counters.** `exec` counts instruction starts only; read and write counts are per byte.

**Addressing.** Flags are kept in one linear "profile offset" space over all physical ROM and RAM.
`profileLayoutOf(machineId)` (`src/common/profile/layouts/index.ts:27`), `profileOffsetOf` and
`profileLocationOf` (`profileLayout.ts`) convert between offsets and locations.

**The renderer's API** (`EmuApi.ts:638-717`):
- `getProfileView(partition?, withCounts?)` gives one partition's flags and counts. **On the Next
  a partition is 8K**, and a 16K ROM partition view covers only its first 8K. A 16K bank therefore
  takes two views (`bankPartitions(bank)`), and G7.1's bank space must hide this (T3).
- `getProfileTouched(mask?)` gives every touched byte by profile offset.
- `getProfileEdges()` gives the call edges, if the call tracker was on.
- `.kcov` load and merge: `coverage load <file>`, in `CoverageCommands.ts`. Several runs can
  therefore be merged before a detection.

**Where it is shown today:**
- the Disassembly coverage cell (`DisassemblyPanel.tsx:533-591`), which looks only at `PF_EXECUTED`;
- the memory heat map (`features/coverage/heatModel.ts`, `MemoryPanel.tsx:275`).

The NEX bank views use no coverage data.

### 2.2 The annotation model (output of G7.3–G7.5, input of G7.6)

The files are `DocumentPanels/Next/nexAnnotations.ts`, `nexAnnotationEdits.ts` and
`nexAnnotatedDisassembly.ts`. They move under G7.1-A0.

**Region types.** `"disassemble" | "bytes" | "words" | "skip" | "copper" | "dma"` (`:34`). There is
no text type. `copper`/`dma` are stored as `bytes` + `decode` (`toSidecarRegion`, `:103`).
`rowBytes` is 1..`NEX_MAX_ROW_BYTES` (4).

**Normalisation.** `normalizeRegions` (`:896`):
- regions always tile the whole bank;
- gaps become `disassemble`;
- touching regions with the same layout merge (`sameRegionLayout`);
- an odd-length `words` region is an error.

**Editing.** `replaceAnnotationRegion` (`nexAnnotationEdits.ts:66`) trims or splits overlapping
regions; the last write wins. `withRegion` (`:422`) edits one bank and cannot set `rowBytes`.

**Per-bank data.** `NexBankAnnotation` holds `localLabels`, `lineAnnotations` (`synopsis`,
`comment`), `operandReferences`, `comment` and `sprites`. The `sprites` block is the precedent for
a per-bank view block that older builds ignore (`:143-155`).

**The editor controller.** `publish` (`NexAnnotationEditorController.ts:278`) has no undo. The
`regionSpanMarked` intent marks a span without a dialog.

### 2.3 Memory and pixel views (G7.4)

**Memory views:**
- `features/memory/MemoryPanel.tsx` is the live view. It refreshes through `useMemoryRefresh` →
  `emuApi.getMemoryContents(partition)`, on pause and stop (`useEmuStateListener`), and it stops
  refreshing while a dropdown is open.
- `features/memory/StaticMemoryDump.tsx` is the static view. Its `viewMode` is
  `"memory" | "disassembly" | "sprites"` (`:181`). It is opened by `openStaticMemoryDump` (`:1727`)
  from the snapshot, NEX, tape, Z88 and `.scr` viewers.

**Pixel rendering:**
- `controls/Next/IndexedImageCanvas.tsx`: one `ImageData`, CSS-scaled with `pixelated`,
  `zoomX`/`zoomY`, a `dim` mask, overlay children, and pixel mouse events.
- Overlays: `TilemapInspector/OverlayCanvas.tsx` and `Layer2Inspector/Layer2OverlayCanvas.tsx`.
  They draw one canvas from a shape list, with colours read from `--color-<feature>-*` tokens.
- `SPECTRUM_48_COLORS` (`src/emu/machines/spectrum-colors.ts:19`) and `createScrPixelData`
  (`ScrFileViewerPanel.tsx`) handle ZX attributes.

**Opening a document from a command.** `openSpriteInspector` (`SpriteCommands.ts:25-41`) and the
pending-reveal module `spriteReveal.ts` are the precedent. Special documents are declared in
`features/documents/specialDocuments.ts`.

**Navigation.** `show-disass <addr>` exists. `show-memory` takes no address; it reveals through
`revealWhenMounted(hub, MEMORY_PANEL_ID, locator)`.

### 2.4 The assembler and the disassembler (G7.6)

**The assembler** is `src/main/z80-compiler/z80-assembler.ts`.
- In tests, `new Z80Assembler().compile(src, options)` returns segments with `emittedCode`
  (helpers in `test/z80-assembler/test-helpers.ts`).
- Symbols are **case-insensitive** by default.
- `.skip` takes a *target address*.
- `.defs` fills with zeros only.
- DEFB accepts strings (#1437). An empty string emits a NaN byte, so it is never emitted.
- Klive escapes are Spectrum codes (`\i` = `$10`, `\P` = `$60`, …). Non-printable bytes are
  therefore emitted as numbers.
- Next opcodes need `.model next`.
- `.bank` needs a model other than the 48K.
- `.disp` is the phase directive.

**Disassembler output that does not reassemble to the same bytes** (`z80-disassembler.ts`):

| Disassembled as | Bytes | Reassembles as |
|---|---|---|
| `.skip $NNNN` | a skip region (a count) | an error or a different gap: `.skip` takes a target address |
| `nop` | undefined `ED xx` (`:264`, `:478`) | 1 byte, not 2 |
| `nop` | Next `ED` opcodes when `allowExtendedSet` is off | 1 byte, not 2 |
| `neg` | `ED 4C/54/5C/64/6C/74/7C` | `ED 44` |
| `retn` | `ED 55/5D/65/6D/75/7D` | `ED 45` |
| `im 0`, `im 1`, `im 2` | `ED 4E/66/6E`, `ED 76`, `ED 7E` | `ED 46`, `ED 56`, `ED 5E` |
| `ld (nn),hl`, `ld hl,(nn)` | `ED 63`, `ED 6B` | `22`, `2A` |
| the unprefixed text (`nop`, `ex de,hl`) | `DD`/`FD` before an opcode with no indexed form (`:363`) | without the prefix byte |
| `bit b,(ix+d)` | `DD CB d 40-7F` with low bits other than 6 | the canonical encoding |
| a decoded instruction | an instruction that runs past the region end or the 64K wrap | more bytes than the region holds |

No test today assembles a disassembly.

**Writing files.** `mainApi.showSaveFileDialog` and `mainApi.saveTextFile`. The pattern: a panel
shows the dialog, then runs a command with the path. Examples: `UnitTestsPanel.tsx:98-106` →
`test-junit`, and `ProfilerPanel.tsx:117`.

**File types** are entries in `fileTypeRegistry` (`registry.ts:676`).

---

## 3. Model additions (shared by G7.3–G7.6)

All of these are added on top of G7.1-A0's `ProgramAnnotations`. Each is a key that a shipped build
ignores (R2). §8 checks that with the existing back-compatibility tests.

```ts
// Region: new decoded kinds, stored as bytes + decode like copper/dma
type RegionType = "disassemble" | "bytes" | "words" | "skip" | "copper" | "dma"
                | "text"      // G7.3 / G7.5: printable runs, shown and exported as .defm/DEFM
                | "graphic";  // G7.4: bytes laid out per its graphics entry
type Region = {
  start: number; end: number; type: RegionType; rowBytes?: number;
  /** Who wrote it. Absent: the user. "auto": G7.3; "skool": G7.5 import. */
  origin?: "auto" | "skool";
};

// Bank: the graphics the finder named (G7.4), next to `sprites`
type BankGraphic = {
  offset: number;            // start, bank-relative
  width: number;             // bytes per pixel row, 1..32
  height: number;            // pixel rows per frame, 1..256
  count: number;             // frames laid out one after another
  layout: GraphicLayout;     // §5.2
  mask?: "none" | "interleaved" | "before" | "after";
  label?: string;            // the label it is named by (also a local/global label)
};
// BankAnnotation gains: graphics?: BankGraphic[];

// Line annotation: SkoolKit's end comment has nowhere to go today (G7.5)
type LineAnnotation = { synopsis?: string; comment?: string; endComment?: string };

// Bank: what a skool file says that Klive does not model, kept for round trips (G7.5, S5)
// BankAnnotation gains: interop?: { skool?: { directives?: Record<string, string[]>; nonEntry?: string[] } };
```

**How each addition is stored and shown:**
- **`text`** is stored as `{ type: "bytes", decode: "text" }`. A shipped build lists its bytes as
  `.defb`.
- **`graphic`** is stored as `{ type: "bytes", rowBytes: <min(width,4)>, decode: "graphic" }`.
  Its true width comes from the matching `graphics` entry.
- **The listing.** `annotatedDisassembly` (G7.1-A3) learns two row generators:
  - `text`: one `.defm` row per string. A row breaks at a terminator byte: `$0D`, `$00`, or a byte
    with bit 7 set.
  - `graphic`: one `.defb` row per pixel row, in binary for `width ≤ 2`, with a pixel picture in
    the comment column (`; ..####..`).
- **`origin` and merging.** `origin` takes part in `sameRegionLayout`, so that an auto region never
  merges into a user region. `withRegion` gains an optional `origin`. The editor's own edits never
  set it, so any region the user touches becomes the user's.
- **`rowBytes`.** `NEX_MAX_ROW_BYTES` stays 4. A larger width is a graphics-entry property, not a
  `rowBytes` value, because a shipped build would reject `rowBytes > 4`.

---

## 4. Design — G7.3 Code/data auto-detection

### 4.1 The traps

- **D-T1. Executed is not the same as code.** `PF_EXECUTED` marks only the first byte of each
  instruction. The region must also cover the operand bytes, which `PF_CODE` gives. A classifier
  that used `PF_EXECUTED` alone would cut every instruction after its opcode.
- **D-T2. Unexecuted code.** An error handler that never ran has no flags. Leaving it as unknown is
  safe; calling it data would be wrong. Reachability (§4.4) is what recovers it, and it is
  reported as its own evidence level (R4).
- **D-T3. Code that reads itself.** `LD A,(patch+1)` and self-modifying code put `PF_READ` or
  `PF_WRITTEN` on bytes that are also `PF_CODE`. **Code wins.** `PF_SELF_MODIFIED` is reported, and
  the byte's region keeps code. `findSmcRuns` gives the list.
- **D-T4. Overlapping instructions.** Some code jumps into the middle of another instruction (a
  `LD BC,nn` that hides a `LD A,n`). An executed instruction start then falls inside another
  instruction's operand bytes. One linear region cannot show both decodings. The classifier marks
  the span as code, anchored at the earliest start. It reports the overlap as a warning row in the
  proposal, and the user decides.
- **D-T5. The screen and the attributes.** The ULA's reads are not CPU reads, so a screen the
  program only writes shows `PF_WRITTEN`. It is data, but listing it is useless. On the Spectrum
  bank spaces, the screen area of bank 5 (and bank 7 on the 128K) is proposed as `skip`. That is
  the same range `hideScreenArea` already hides (`SCREEN_AREA_RANGE`). The ZX80/ZX81 have no
  fixed screen. Their display file moves with `D_FILE`, and the ULA makes the CPU run through it
  with M1 cycles. Whether the ZX81 core's profile hooks flag those fetches as `PF_CODE` must be
  checked in D1. If they do, the display file's bytes (`D_FILE..VARS`) are proposed as `bytes`
  with the note `screen`.
- **D-T6. The stack.** The stack is written and read by `PUSH`/`POP`/`CALL`, with no flag to tell
  it apart. It classifies as data, which is correct, but a game that puts its stack inside a
  graphics buffer gets one large data region. That is acceptable. The proposal names the span that
  contains SP at detection time.
- **D-T7. A Next 16K bank is two 8K partitions** (§2.1). The classifier gets a bank's flags through
  G7.1's bank space (`partitionOf` → views), never by assuming one view per bank.
- **D-T8. Region boundaries must be instruction starts.** A code region that starts in the middle
  of an instruction decodes garbage until it resynchronises. A code run's start is snapped back to
  the first `PF_EXECUTED` byte of that run. A data region that would split an instruction's
  operands is shortened.
- **D-T9. Data read as code by the disassembler.** A byte that was only read, inside a run the user
  marked `disassemble`, is the case detection exists for. A byte the user marked as data that was
  later *executed* is the opposite case. That second case is reported but **not changed** without
  `-replace` (R3).

### 4.2 Classification

`src/common/reverse/classify.ts` is pure. Its input is one bank's (or ROM page's) 16K of flags,
plus optionally its bytes, and options. Its output is a list of classified runs, with the evidence
for each.

```ts
type ByteClass = "code" | "data" | "unknown";
type Evidence = "observed" | "reached" | "inferred";
type ClassifiedRun = {
  start: number; end: number;                  // inclusive, bank-relative
  class: ByteClass;
  evidence: Evidence;
  proposedType: RegionType;                    // disassemble | bytes | words | text | skip
  notes?: ("smc" | "overlap" | "screen" | "stack" | "interrupt")[];
};
classifyBank(input: {
  flags: Uint8Array; bytes: Uint8Array; z80n: boolean;
  entryPoints?: number[];                      // §4.4
  options: DetectOptions;
}): ClassifiedRun[];
```

**The per-byte rule, in order:**
1. `PF_CODE` → code (observed).
2. `PF_READ` or `PF_WRITTEN` → data (observed).
3. Reachability marks the byte (§4.4) → code (reached).
4. Otherwise → unknown.

**Runs are then built and adjusted:**
- Adjacent bytes of the same class form a run.
- A code run is snapped to instruction starts (D-T8).
- A data run proposes `bytes` by default; the inference steps (§4.5) can refine it to `words` or
  `text`.
- **Unknown runs propose nothing** by default: the region stays as it is. Option `-unknown bytes`
  marks them as data. That suits a program that has been fully exercised.

### 4.3 What a proposal changes

`src/common/reverse/proposal.ts` compares the classified runs with the bank's current regions.

**A run counts as a change only if it can be applied.** In the default *fill* mode that means it
falls on either:
- a gap, i.e. today's default `disassemble`, which carries no origin when it came from
  normalisation; or
- a region with `origin: "auto"`.

**Two other modes:**
- `-replace` also overwrites the user's own regions. They are listed separately in the proposal and
  need a confirmation.
- `-clear` removes every `origin: "auto"` region and restores the gaps.

**Telling a gap from a user region.** A gap that normalisation filled and a region the user marked
`disassemble` look the same on disk. Rather than add a second marker key, fill mode treats every
non-auto `disassemble` region as fillable, and every non-auto data, skip or graphic region as the
user's. Only the user can have marked those, because a bank's default is code **(Q2)**.

**The proposal reports:**
- the counts per evidence level;
- the user regions it conflicts with;
- the SMC and overlap warnings;
- the bytes still unknown, in total and as a percentage of the bank.

### 4.4 Reachability

`src/common/reverse/reach.ts` is a worklist walk over one *64K view under one paging*. It stops at
the slot boundaries the bank space reports. It reuses `z80InstructionLength` and the branch table
(`z80-branch-info.ts`), without the text formatter.

**Seeds:**
- every observed instruction start;
- every call edge's callee (G5.4), if present;
- the active set's labels that sit in `disassemble` regions;
- the program's entry point, if known: the NEX PC, the snapshot PC, or the `.kliveproject` start.

**Following:**
- `JP`, `JR`, `CALL`, `RST` and `DJNZ` targets, and the fall-through of conditional branches,
  `CALL` and `RST`.

**Not followed:**
- past an unconditional `JP`/`JR`/`RET`/`RETI`/`RETN`/`JP (rr)`;
- into a byte that has `PF_READ`/`PF_WRITTEN` but not `PF_CODE`, which is data by observation;
- into a slot whose bank differs from the one being classified;
- past `RST 08` / `RST 28` on a 48K BASIC ROM. The machine's custom disassembler already knows the
  inline bytes, and the walk asks it for each RST's length.

**`JP (HL)` and friends** add nothing statically. Their observed targets are already instruction
starts, so their code is found anyway.

**Conflicts.** A reached byte that is also observed as data stops the walk, and the conflict goes
in the proposal as an overlap warning (D-T4).

### 4.5 Inference (off by default, one switch each)

- **Text** (`-text`): a data run of at least *n* (default 4) printable bytes, `$20-$7E`, optionally
  ended by a byte with bit 7 set (the ROM's convention) or by `$0D`/`$00`, proposes `text`.
- **Pointer tables** (`-words`): an even-aligned data run of at least 3 words, at least 80% of
  which point at observed instruction starts or labels in the same 64K view, proposes `words`.
  It also adds those targets to the reachability seeds.
- **Screen** (on by default on the Spectrum bank spaces): D-T5.

### 4.6 UI and commands

**Command:**

```
ann-detect [<bank>|rom|all] [-mode fill|replace|clear] [-reach] [-text] [-words]
           [-unknown keep|bytes] [-apply]
```

- Without `-apply` it prints the proposal summary and opens it in the result document.
- With `-apply` it writes the proposal through the session, as one update.
- `<bank>` defaults to the banks currently paged in.
- `rom` works only on the user's ROM layer (G7.2 §5.2); the shipped sidecars are never written.

**Dialog.** *Detect code and data…* opens from:
- the live Disassembly view's toolbar;
- the bank document's annotation menu;
- the Debug → Code Coverage menu.

It is an MVC dialog (`.ai/ui-mvc-guide.md`), because it is async: it reads the profile, classifies
several banks, and publishes.
- **Model:** the options and the per-bank proposals.
- **View:** a table with one row per bank (code/data/unknown percentages, conflicts, warnings), a
  per-row *Include* switch, and an expander listing the warnings with *Go to*.
- **Apply** publishes. **Undo last detection** restores the pre-apply annotations, held in the
  controller for the session. `-mode clear` is the durable way back.

**When coverage is missing.** If profiling is off or the generation is empty, the dialog says so.
It offers *Turn on coverage* (`coverage on`) and *Load .kcov…*.

**Showing it in the listing.** A region with `origin: "auto"` gets a quiet marker in the listing's
region column, with the tooltip "Detected from coverage". The marker uses a
`--color-annotation-auto` alias.

---

## 5. Design — G7.4 Graphics finder

### 5.1 The traps

- **G-T1. Byte order is not one thing.** Games store graphics in at least four orders:
  - row-major linear;
  - character cells (8 bytes per 8×8 cell, cells in reading order);
  - column-major (one byte column top to bottom, then the next);
  - interleaved with a mask.

  A finder with only one order cannot find most sprites. `GraphicLayout` covers all four (§5.2).
- **G-T2. The live view must not fight the refresh.** It refreshes on pause like the Memory panel.
  It stops refreshing while the user drags a selection or edits the width, as `MemoryPanel` does
  while a dropdown is open.
- **G-T3. The machine's pixels are hardware colours; the chrome is tokens** (`.ai/ui-theming-intent-and-lessons.md`).
  - Ink and paper come from `SPECTRUM_48_COLORS`, or from an attribute byte the user picks. The
    default is ink black on paper white, as a 48K shows `INK 0: PAPER 7`.
  - The grid, the selection and the named frames are drawn on one overlay canvas from
    `--color-graphics-*` tokens.
- **G-T4. Wide memory, small canvas.** A 64K view at width 1 is 65,536 pixel rows. The canvas draws
  only the visible window, virtualised the way the memory dump virtualises rows. The scroll
  position is an address.
- **G-T5. Next banks are 16K but their partitions are 8K.** The view reads through the bank space
  or the dump's bytes, never per partition directly (as D-T7).

### 5.2 The view

`features/graphics/GraphicsView.tsx` takes the bytes, an address base and a look, and renders one
`IndexedImageCanvas` plus an overlay canvas.

```ts
type GraphicLayout = "linear" | "cells" | "columns" | "screen";
type GraphicsLook = {
  width: number;          // bytes per pixel row, 1..32
  height: number;         // pixel rows per frame (cells/columns: the frame size; linear: the strip break)
  layout: GraphicLayout;  // "screen" = ZX display file order, for $4000-$57FF
  mask: "none" | "interleaved" | "before" | "after";
  showMask: boolean;      // show the mask plane instead of the pixels
  invert: boolean;
  ink: number; paper: number;   // 0..15, ZX colours incl. BRIGHT
  zoom: 1 | 2 | 3 | 4 | 6 | 8;
  frameGap: boolean;      // a 1-pixel gap between frames
  dimUnread: boolean;     // §5.4
  columns: number;        // frames side by side (the "sheet" width)
};
```

**Decoding.** `src/common/reverse/graphicsDecode.ts` is pure: `(bytes, look) → Int16Array`
pixels, plus a map from each pixel to its byte offset. The map makes hover show the byte address,
and makes click-to-select work in byte terms.

**Toolbar.** It sits in the document's `PanelHeader` (a context group, as `NexBankSpritesToolbar`
does). It holds:
- width −/+ and a number field;
- height;
- layout;
- mask;
- invert;
- colours;
- zoom;
- *Go to*, an `AddressInput`;
- the presets *Font (8×8, 96 chars)*, *UDG (8×8, 21)* and *Screen ($4000)*.

**Keyboard.** `←`/`→` change the width by one byte, `↑`/`↓` scroll by one pixel row, and
`PgUp`/`PgDn` scroll by a frame. Width is the parameter people sweep, so it gets the cheapest key.

**Hover** shows the address, the byte (hex and binary), the frame index, and the label containing
the byte, through the G7.1 resolver.

### 5.3 Where it appears

- **Static dumps.** `StaticMemoryDump` gains `viewMode: "graphics"`, with `graphicsLook` in
  `MemoryDumpViewState`. This covers snapshots, NEX banks, tape blocks and Z88 banks. If the
  dump's bank is annotatable, the look is also stored in the bank annotation's `graphics` view
  block, the way `sprites.active` is.
- **Live.** A special document `$graphics` (*Graphics*), opened by the `gfx` command or from the
  Memory panel's toolbar (*Show as graphics*). It has the Memory panel's bank selector: the 64K
  view, or one bank or ROM page. It reads through `getMemoryContents(partition)` on pause.
- **Cross-navigation.** The row and pixel context menus offer *Show in memory*, *Show in
  disassembly* and *Name graphic…*. The disassembly and memory views offer *Show as graphics* on a
  selection or address.
- **Command:** `gfx [<address>] [-w <width>] [-h <height>] [-layout linear|cells|columns|screen] [-bank <n>]`.
  It opens the live document at the address. `show-memory` gains an optional address argument at
  the same time; it is a small, overdue sibling of `show-disass <addr>`.

### 5.4 Finding, not just browsing

- **Coverage dimming** (`dimUnread`). Bytes the CPU never read are dimmed through
  `IndexedImageCanvas`'s `dim` mask. Graphics are read data, so they stand out, and code and
  never-touched buffers recede. It needs a profile; without one the switch is disabled and its
  tooltip says why.
- **The annotation overlay.** Named graphics are drawn as framed, labelled boxes. Regions the
  listing would decode as code get a hatched band in the margin, so the user can see where the
  disassembly disagrees with the picture.
- **Candidates** (Phase G4): `src/common/reverse/graphicsCandidates.ts` scans a bank for:
  - fonts: 96 × 8 bytes whose first 8 bytes are zero (the space character), with most later cells
    nonzero;
  - UDG blocks;
  - data runs that are read but never executed, from G7.3's classifier, ranked by read count.

  The results are a side list with *Go to*. They are heuristics, labelled as such.

### 5.5 Naming

*Name graphic…* on a selection opens a small dialog with a name, width, height, count, layout and
mask, pre-filled from the look. It publishes one session update containing:
- a label at the start;
- a `graphic` region over the span, which clears to the user (no origin);
- a `graphics` entry.

The listing, the source export (§7.4) and the SkoolKit export (§6.6) then show the graphic.

Renaming and deleting happen through the existing label and region dialogs. Deleting the region
also drops its `graphics` entry.

**Save as PNG** is in scope **(Q5)**. It saves the selection or one named graphic, at 1:1 or at
the current zoom. It needs a binary save path from the renderer: G2 confirms that `mainApi` has
one, or adds one.

---

## 6. Design — G7.5 SkoolKit import and export

### 6.1 The formats (interface facts from SkoolKit's documentation, version 10.1)

These are recorded here in Klive's own words (R7).

**Skool file**
- Entries are separated by blank lines.
- An entry's first instruction line starts with a block character:
  - `c` code;
  - `b` bytes;
  - `t` text;
  - `w` words;
  - `s` same-value bytes;
  - `u` unused;
  - `g` game-status buffer;
  - `i` ignored.
- A `*` marks an entry point.
- Other line prefixes:
  - `;` lines are comments;
  - `@` lines are ASM directives (`@label=NAME`, `@org`, `@bank`, `@start`/`@end`, `@ignoreua`,
    the `@isub`… substitution family, and others);
  - a space starts a plain instruction line.
- An instruction line is `<marker><address> <instruction> [; comment]`. The address is decimal, or
  hex with `$`.
- An entry's header comment has up to four sections, separated by a `;` line:
  1. the title;
  2. the description;
  3. the registers (`Input:`/`Output:`, or `I:`/`O:`);
  4. the start comment.
- Paragraphs inside a section are separated by a `; .` line.
- Comments between instructions are mid-block comments; comments after the last instruction are
  the end comment.
- `{` … `}` braces spread one instruction comment over several instructions.
- In string operands, `\` and `"` are escaped.

**Control file (`.ctl`)**
- One block directive per block start: `b c g i s t u w`, then the address and an optional title.
- Sub-block directives `B C S T W` set the type for `addr[,length[,sublengths]]`.
- Sublengths can carry base prefixes (`b c d h m n`) and `:` mixes (`T 40000,,3:n1`).
- Comment directives:
  - `D` description;
  - `R` registers;
  - `N` start or mid-block comment;
  - `E` end comment;
  - `M` a comment over several sub-blocks.
- Other directives: `L` repeats a pattern; `@ addr directive=value` is an ASM directive; `>`
  preserves non-entry text.
- `#`, `%` and `;` lines are comments.
- A ctl file describes structure and comments. `sna2skool` combines it with a snapshot to make a
  skool file.

### 6.2 The traps

- **S-T1. Skool addresses are 16-bit.** A 128K skool file switches the bank at `$C000` with
  `@bank`. The importer tracks the current paging as it reads, starting from a 48K-style map
  (banks 5/2/0, the same as G7.1 A3). It resolves every address through the bank space under that
  paging. An address that falls in ROM goes to the user ROM layer, with confirmation, or is
  skipped (R8).
- **S-T2. Instruction text is not bytes** (R9). The importer assembles each skool instruction with
  Klive's assembler, using the entry's address and no labels, since skool operands are numeric. It
  compares the result with the bytes at that address.
  - On a mismatch, the entry's region is not applied, and the entry is listed.
  - SkoolKit's own syntax differences (case, `DEFB` spelling, `$`/decimal) are accepted by Klive's
    assembler.
  - Anything it still rejects is listed, and the bytes are checked by length only.
- **S-T3. Klive has no "entries".** SkoolKit's unit is an entry: a routine or data block with a
  header. Klive's units are regions and labelled addresses with a synopsis. Mapping in both
  directions needs one rule (S2), and a round-trip test proves it.
- **S-T4. Comments carry skool macros** (`#R32768`, `#N`, `#UDG…`). Converting them would be
  lossy and would grow a macro engine. They stay as text (S6).
- **S-T5. Label case.** Klive's symbols are case-insensitive, while SkoolKit names may differ only
  in case. The importer reports such collisions and renames the second one (`name_2`). The export
  keeps the names as they are.
- **S-T6. Some ASM directives change bytes** (`@defb`, `@isub` with code). The importer never
  applies them to memory. They are kept in the passthrough (S5) and listed as "not applied".

### 6.3 Decisions for G7.5

| # | Decision |
|---|---|
| S1 | **Block types:** `c` → `disassemble` · `b` → `bytes` · `w` → `words` · `t` → `text` · `s` → `bytes` · `g` → `bytes` · `u` → `bytes` with the title "Unused" if it has none · `i` → `skip`. Sub-blocks map the same way. Imported regions carry `origin: "skool"`. |
| S2 | **Entries.** On import, an entry is a label (from `@label`, otherwise none) plus a synopsis on its first address. The synopsis is made of the title, a blank line, the description paragraphs, a blank line, and the register lines, in that order. On export, a new entry starts at every region boundary and at every address that has a synopsis. The synopsis splits back: the first paragraph is the title, the paragraphs that start with `Input:`/`Output:` lines are the registers, and the rest is the description. |
| S3 | **Instruction comments** become end-of-line comments. A braced comment over *n* instructions goes on the first one, and its span is recorded in the passthrough, so the export can restore the braces. Mid-block comments become the synopsis of the address they precede. End comments become `endComment` on the entry's last address (§3). |
| S4 | **`*` without `@label`** sets no label: Klive already shows `L1234` there. The entry point is remembered in the passthrough. |
| S5 | **The passthrough** is `interop.skool`, per bank. It keeps unknown `@` directives by address, non-entry blocks, braced spans and `*` marks. The export writes them back, so a file that Klive never edited round-trips. |
| S6 | **Skool macros are verbatim** in Klive's comments. A later follow-up could render `#R` as a link. |
| S7 | **Both formats, both ways.** A ctl export suits users who also run SkoolKit: `sna2skool -c game.ctl game.z80`. A skool export suits users who publish. A ctl import goes onto bytes Klive already has; it is checked by length only, because a ctl file has no instructions. |
| S8 | **Export instruction syntax** is SkoolKit's conventional style: upper case, `$` hex, numeric operands, and `@label=` lines for names. SkoolKit substitutes labels itself in `skool2asm`. Klive's custom decodings (RST 08/28 inline bytes, copper, DMA) are exported as `DEFB` with a comment. |

### 6.4 Module and commands

`src/common/reverse/skool/` is pure:
- `skoolParse.ts` gives a `SkoolDocument` (entries, lines, directives, comments) with positions,
  for error messages;
- `ctlParse.ts` gives the same `SkoolDocument` shape, without instructions;
- `skoolToAnnotations.ts` (with a byte reader and a bank space) gives a proposal like G7.3's, plus
  the mismatch list;
- `annotationsToSkool.ts` gives a skool or ctl file from the listing (§7.2's walk) and the
  passthrough.

**Commands:**
- `skool-import <file> [-ctl] [-mode fill|replace] [-apply]`: the format is guessed from the
  extension. It previews, then applies, like `ann-detect`, and reuses that dialog's proposal table.
- `skool-export <file> [-ctl] [<from> <to>] [-bank <n>|all]`.

**Menus.** The live Disassembly view and the bank documents get *Import SkoolKit file…* and
*Export as SkoolKit…*. Each uses the panel-dialog → command pattern of §2.4.

**File types.** `.skool` and `.ctl` open in the text editor. `.ctl` is registered only as text,
because the extension is generic. Monaco colouring for skool files is a later follow-up.

### 6.5 Banks

**Export.** A 48K export is one file, `@org` at the first entry. A 128K or +3 export:
- writes the 48K view (banks 5/2/0) followed by each other annotated bank as an `@bank`-switched
  section at `$C000`;
- uses one file per bank if `-split` is given, matching how SkoolKit projects split large
  disassemblies.

**Next banks** export one file per bank at `$C000`, with a header comment naming the bank.
SkoolKit does not model the Next's paging, and the plan does not pretend it does **(Q6)**.

### 6.6 Graphics in skool output

A named graphic (§5.5) becomes a `b` entry. Its description gets a `#UDGARRAY` macro that rebuilds
the image in `skool2html`. The macro is generated text, written from SkoolKit's documented macro
syntax. The rows are `DEFB` lines in binary, one pixel row per line.

---

## 7. Design — G7.6 Export as source

### 7.1 The traps

- **E-T1. The disassembly is not always canonical** (§2.4). Emitting its text as-is silently
  changes the bytes.
- **E-T2. Labels Klive generates are not names Klive accepts.** An annotation label can:
  - clash with a register or a mnemonic (`HL`, `LD`, `AF`);
  - clash with another label by case only (S-T5);
  - start with a character Klive does not allow.

  The emitter validates every name against the assembler's own identifier rule. Its tokenizer
  function is reused, not reimplemented. Failures are renamed, with a report.
- **E-T3. Operands outside the exported range.** A `CALL $0DAF` into the ROM, or a `JP` into
  another bank, needs a symbol. Exporting it as a label without a definition does not assemble.
  External names become `NAME .equ $0DAF`. ROM labels are included (G7.2), and so are the other
  banks' labels when they are paged at a fixed address.
- **E-T4. A named immediate.** `LD HL,$5C00` named `SCREEN_BUF` is only safe to write as
  `LD HL,SCREEN_BUF` because the label's value *is* `$5C00`. Operand references
  (`operandReferences`) are honoured exactly as the listing shows them, and the final verification
  (R10) catches anything else.
- **E-T5. A skip region has unknown bytes.** "Not shown" does not mean "not there". The default is
  to export a skip region as `.defb` data, which keeps byte identity. Option `-skip gap` ends the
  segment and starts a new `.org`, which reassembles to fewer bytes. The report says so.
- **E-T6. Banked exports.** On a 128K, `.bank n` needs `.model Spectrum128`, and the Next needs
  `.model next` for its opcodes. The model is chosen from the bank space, never from the user's
  current project.

### 7.2 The walk

`src/common/reverse/sourceExport.ts` is pure. It walks `annotatedDisassembly` items:
- for a bank: the G7.1 bank listing;
- for a 64K range under the current paging: the live listing, joined across slots (G7.1 T8).

It produces `SourceLine[]`: kind, label, text, comment and synopsis lines. A dialect then renders
the lines (R11). G7.5's skool writer walks the same items, through its own dialect.

### 7.3 Canonical encodings

`src/common/reverse/canonicalEncoding.ts` holds `isReassemblable(opcodes, z80n): boolean`. It is
backed by a table of the non-canonical patterns in §2.4.

**The table is checked exhaustively** by a unit test over every opcode pattern:
- unprefixed, `CB`, `ED`, `DD`/`FD`, and `DD CB`/`FD CB`;
- with fixed operand values;
- with and without the Next set.

For each pattern it disassembles, assembles, and checks that `isReassemblable` predicts
`assemble(disassemble(x)) === x` exactly.

A new disassembler or assembler change that breaks a round trip therefore fails a test before it
reaches a user. Today's list of non-canonical forms becomes the test's expected table.

### 7.4 What a region becomes

| Region | Klive asm |
|---|---|
| `disassemble` | Each instruction, with operand names from the resolver. A non-reassemblable instruction becomes `.defb $ED,$4C ; neg (non-canonical)`. An instruction that runs past the region end becomes `.defb` of the remaining bytes. |
| `bytes` | `.defb`, `rowBytes` per line, in hex. |
| `words` | `.defw`, as the listing rows it. |
| `text` | `.defb "PRINTABLE",$8D`: printable ASCII except `\` and `"` goes in quotes, everything else is numeric. Never an empty string (§2.4). |
| `graphic` | `.defb %01111110` per pixel row (`width ≤ 2`), otherwise hex, with the pixel picture as the comment. |
| `copper` / `dma` | `.defb` in the listing's row grouping, with the decoded text as the comment. |
| `skip` | `.defb` (default), or a new `.org` (`-skip gap`, E-T5). |
| RST 08/28 inline bytes | `.defb` with the custom disassembler's decoding as the comment. |

**Comments:**
- the bank comment and the source host go in the header block;
- each synopsis becomes `;` lines above its row;
- each end-of-line comment becomes a trailing `;`;
- each `endComment` becomes `;` lines after the row.

### 7.5 Verification and UI

**Verification.** The emitter is pure, and the assembler lives in the main process. The command
therefore:
1. writes the file;
2. asks the main process to compile it, with a new `MainApi.assembleText(source, options)` that
   returns the segments, and no file I/O;
3. compares the segments with the source bytes.

The result is shown in the command output and the dialog: "Byte-identical: yes", or the first five
differing addresses. `-noverify` skips it.

**Command:**

```
export-asm <file> [<from> <to>] [-bank <n>] [-skip data|gap] [-dialect klive] [-open] [-noverify]
```

- `<from> <to>` is a range in the current 64K view.
- `-bank` takes a bank-relative export; the default is the whole bank.
- `-open` opens the result in the editor.

**Menus.** *Export as source…* is available on:
- the live Disassembly view's toolbar, for a range or the current selection;
- the bank document's menu, for the whole bank;
- the Graphics view's named-graphic menu, for one graphic.

Each shows `showSaveFileDialog` (`settingsId: "asmExport"`) and runs the command.

**Default file name:** `<host>-<bank|range>.kz80.asm`, inside the project folder if there is one.

---

## 8. Tests

**Model additions (§3):**
- A sidecar with `text`/`graphic` regions, `origin`, `graphics`, `endComment` and `interop` loads
  in today's parser with no error (shipped-build compatibility). It round-trips byte for byte
  through the new one.
- `sameRegionLayout` keeps an auto region apart from a user region.
- The listing's `text` and `graphic` generators.

**G7.3:**
- `classifyBank` on synthetic flag arrays: operands covered (D-T1), SMC code wins (D-T3), overlap
  warnings (D-T4), snapping (D-T8), and screen and stack notes.
- Reachability: conditional fall-through, stop after `RET`, stop at data, stop at slot boundaries,
  and RST 08/28 lengths on the 48K ROM.
- Proposal modes: fill never touches user data regions, replace lists them, and clear restores the
  gaps.
- A Next bank is classified from both of its 8K partitions (D-T7).
- **e2e tier** (`build/e2e-tests.ts`), on the real cores through the harnesses:
  - Boot the 48K, run a short BASIC program with coverage on, detect on the ROM page, and check
    that known code (the entry points already in the repo) is code and the character set is data.
  - On the Next, a NEX fixture with a known code/data layout.
  - **This is Klive's own observation of the ROM**, which is the G7.2 provenance-allowed source.
    It is not a comparison with any published ROM map.

**G7.4:**
- `graphicsDecode` for each layout and mask mode, with the pixel → byte map, on hand-built bytes.
- The candidate finder on the 48K ROM's character set (found) and on random data (nothing found).
- `StaticMemoryDump.test.tsx`: the graphics view mode, view-state persistence, and *Name graphic*
  publishing one session update.
- An IDE check in the running app (CDP, as in `.ai/ui-theming-intent-and-lessons.md`): the 48K's
  `$3D00` font at width 1, height 8, layout `cells`, shows letters.

**G7.5:**
- The parsers: every construct of §6.1, error positions, braces, paragraphs, and registers.
- Import: block mapping (S1), entries (S2), comments (S3), `@bank` paging (S-T1), mismatch
  rejection (S-T2), case collisions (S-T5), and the passthrough (S5).
- **Round trip:** skool → annotations → skool is identical, modulo documented normalisation
  (trailing whitespace, a canonical register-line form), for Klive-authored fixtures that cover
  every construct.
- Export → import gives the same annotations.
- The fixtures are written for the test. **No published skool or ctl file is checked in** (R7, R8).
- **The oracle** (local only, not CI; a script in `scripts/skoolkit-oracle.cjs`) runs
  `skool2ctl`/`skool2asm` on Klive's exports and `sna2skool -c` on its ctl exports, and records
  pass/fail only.

**G7.6:**
- **The exhaustive canonical-encoding test** (§7.3).
- `sourceExport` for each region type of §7.4, names (E-T2), externals (E-T3) and skip modes.
- **Round trip on real bytes:** export, assemble with `Z80Assembler` in the test, and get the same
  bytes. This is run on a 48K snapshot fixture with annotations, a 128K bank with `.bank`, and a
  Next bank with Next opcodes and copper.
- `MainApi.assembleText` returns segments and errors.

---

## 9. Phases

G7.1 must land first for everything except the pieces marked *standalone*. Those can start now on
today's NEX model, and move with G7.1-A0's rename.

| Phase | Content | Needs | Size |
|---|---|---|---|
| **M0** | Model additions (§3): `text`/`graphic` decoded regions, `origin`, `graphics`, `endComment`, `interop`; listing generators; compatibility tests. | G7.1-A0 | S |
| **D1** | `classify.ts` and `proposal.ts` (fill, replace, clear), with unit tests. | M0, A1 | S–M |
| **D2** | `reach.ts`; seeds from edges, labels and entry points; inference (text, pointer tables). | D1 | S–M |
| **D3** | `ann-detect`; the Detect dialog (MVC); undo last detection; the auto-region marker; e2e tests on 48K and Next. | D2, A2–A3 | M |
| **G1** | `graphicsDecode.ts`; `GraphicsView` with the overlay; static-dump `viewMode: "graphics"`. *Standalone*: a static dump needs no G7.1. | — | M |
| **G2** | The live `$graphics` document, `gfx`, `show-memory <addr>`, cross-navigation, coverage dimming, Save as PNG (Q5). | G1 | S–M |
| **G3** | *Name graphic*, the `graphics` entries, the overlay of named graphics, the annotated-region band. | G1, M0, A2 | S–M |
| **G4** | Candidate finder (fonts, UDG blocks, read-only data runs). | G1, D1 | S |
| **E1** | `canonicalEncoding.ts` and the exhaustive round-trip test. *Standalone*. | — | S |
| **E2** | `sourceExport.ts`, the Klive dialect, names and externals. | E1, M0, A3 | S–M |
| **E3** | `MainApi.assembleText`, verification, `export-asm`, the menus. | E2 | S |
| **S1** | The skool and ctl parsers. *Standalone*. | — | S–M |
| **S2** | The import mapping, the mismatch check, `skool-import` with the proposal dialog (shared with D3). | S1, M0, D3's dialog | M |
| **S3** | Skool and ctl export through the E2 walk; `#UDGARRAY` for graphics; the oracle script. | S2, E2 | S–M |
| **Z** | Docs and the standing rules (below). | each feature | S |

**Suggested order:**
1. E1 and S1, which are standalone and have the largest test value.
2. G1, also standalone and the most visible.
3. Once G7.1-A0–A3 are in: M0 → D1–D3 → E2–E3 → G2–G4 → S2–S3.

**Totals:**
- G7.3 is **M**, as the roadmap says.
- G7.4 is **M**.
- G7.5 is **M**, at the upper end: two parsers and a round trip.
- G7.6 is **S–M** once G7.1's listing exists. The roadmap's M included the listing.

**Standing rules on completion of each feature:**
- Mark it done in `CLOSING_THE_GAPS_PLAN.md` (G7 table and overview).
- In `LANDING_PAGE_COMPETITIVE_ANALYSIS.md`, update:
  - the §2 rows "General reverse engineering (48K/128K)", "External toolchains" (SkoolKit) and
    "Export";
  - the W7 gap in §4. Remove it once G7.1–G7.6 are all done.
- G7.4's view and G7.3's auto-region marker are visual changes. Update
  `.ai/ui-theming-intent-and-lessons.md` in the same change. Add the `--color-graphics-*` and
  `--color-annotation-auto` aliases at L4, with no literals.
- Docs-site pages under `docs/content/`:
  - *Detecting code and data*;
  - *Graphics finder*;
  - *SkoolKit*;
  - *Exporting source*.

  Screenshots come from `scripts/doc-shots/`, with recipes added for the four views. Run
  `npm run doc:build && npm run doc:check`.
- `.docs/annotations.md` (G7.1-A5) gains the model additions of §3.

---

## 10. Questions for the author

All eight are answered (2026-10-09): the author accepted the suggested answers.

| # | Question | Answer |
|---|---|---|
| **Q1** | Should auto-detection also **create labels**, for example `sub_8000` at call targets and `loc_8123` at jump targets? | No. The listing already shows `L8000` at every referenced address. Generated names in the sidecar would crowd out the user's own, and the resolver could not tell them apart. Call targets *are* used as reachability seeds and are listed in the proposal, with *Label…*. |
| **Q2** | Should a user's explicit `disassemble` region be protected from fill mode, which would need a marker key, or treated like a gap (§4.3)? | Treat it like a gap. Marking code is the default state, so there is little to protect. The proposal lists every change. Undo and clear exist. |
| **Q3** | Should the screen area of bank 5 (and 7) be proposed as `skip` by default (D-T5)? | Yes, on the Spectrum bank spaces, with a switch to turn it off. It matches `hideScreenArea`. |
| **Q4** | Is a sjasmplus dialect for G7.6 in this plan, or later? | Later. The dialect interface is in from the start. sjasmplus needs `DEVICE`/`PAGE` banking and C-style escapes, and its own round-trip harness (`test/sjasm-int/`). That is a phase of its own once Klive asm export is proven. |
| **Q5** | Should the Graphics view offer **Save as PNG**? | Yes, for the selection or for one named graphic, at 1:1 and at the current zoom. It is small, and it is the usual next step after finding a sprite. It needs a binary save path from the renderer; confirm that `mainApi` has one in G2, or add one. |
| **Q6** | How should **Next banks** export to SkoolKit, which does not model the Next? | One skool file per 16K bank at `$C000`, with a header comment naming the bank. Klive's own `.dis` stays the Next's real format. |
| **Q7** | Should **skool import into a ROM page** (S-T1) be allowed at all, given D4? | Yes, into the user's own ROM layer only, after a confirmation that says where it goes. It is the user's data (R8). The shipped sidecars cannot be written, and the provenance rule forbids using such a file for them. |
| **Q8** | Should G7.3 also run **headlessly** (`klive run … --detect <out.dis>`), for long unattended coverage runs? | Not in this plan. The classifier is pure (R12), so a CLI verb is a small follow-up on top of G6.1's `klive run`, once there is demand. |
