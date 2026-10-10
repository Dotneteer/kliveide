# Annotations for Any Machine and Annotated ROMs — Implementation Plan

Status: **decisions recorded** (2026-10-09). The author accepted every suggested answer in §9 except
Q4: the ZX80 and ZX81 are **in scope**, for program annotations (§4.7) and for their ROMs (§5.4).
Q1's answer unblocks the G7.2 authoring phases.

Scope:
- [CLOSING_THE_GAPS_PLAN.md](CLOSING_THE_GAPS_PLAN.md) **G7.1**: generalise the `.nex.dis`
  annotation sidecar. You can label, comment and mark regions in code on the 48K, 128K/Pentagon,
  +2A/+3/+3E, Scorpion, Timex, **ZX80 and ZX81** (Q4). That works in a running program, in a snapshot (G2) and in its
  bank documents. The annotations show in the **live** Disassembly view, which today shows only
  operand names.
- **G7.2**: ship labels, comments and data regions for the 48K, 128K and +3 ROMs, and for the ZX81
  and ZX80 ROMs (Q4), so ROM calls and
  jumps read by name. Under **decision D4** they are written from scratch (§6).
- The **shared address-to-name resolver** both features need. Today each view builds its own (§2.4).

Builds on:
- [NEX_DEBUGGING_PLAN.md](NEX_DEBUGGING_PLAN.md) §4.5, §9, §13 and `.docs/annotations.md`. These
  give the sidecar, its two subtrees, the annotation session, the annotation editor (MVC), label
  breakpoints and annotation labels as live symbols.
- [NEX_DMA_COPPER_REGIONS_PLAN.md](NEX_DMA_COPPER_REGIONS_PLAN.md): the decoded region types, and
  how they are written to disk as `bytes` + `decode`.
- [ZX_SPECTRUM_SNAPSHOT_PLAN.md](ZX_SPECTRUM_SNAPSHOT_PLAN.md): `zx-snapshot`, the snapshot viewer
  and its bank documents (`Spectrum/spectrumBankDocument.ts`).
- [CODE_COVERAGE_AND_HEAT_MAP_PLAN.md](CODE_COVERAGE_AND_HEAT_MAP_PLAN.md) (G5.1): the coverage map
  that G7.2's authoring tools use to tell ROM code from ROM data.

Used later by:
- G7.3, code/data auto-detection: it writes regions into the same model.
- G7.5, SkoolKit import/export: it maps to and from the same model.
- G7.6, export as source: it walks the same annotated listing.

Not in scope:
- The Z88 and C64. The model leaves room for them (§4.1).
- The Timex DOCK and EXROM chunks. Timex HOME memory is covered (Q4).
- A static, annotated view of a ZX80/ZX81 `.p`/`.o` file. Such a file still opens in the binary
  viewer; its annotations are made and shown on the running machine (§4.7).
- Editing the *shipped* ROM annotations inside the IDE. They are authored in the repo. A user's own
  ROM labels go to a separate, writable sidecar (§5.2).
- Exposing ROM labels to the assemblers and Klive BASIC (`include "rom48.inc"`). This is a natural
  follow-up once the shipped ROM sidecars exist (§8).

---

## 1. What is being added, and why

Spectrum Analyser owns reverse engineering on the classic machines. It offers an annotated ROM,
code/data marking, labels, comments and SkoolKit. Klive already has the whole model: labels,
regions, line and end-of-line comments, operand references, bank comments, a sidecar with two
independently persisted subtrees, an MVC annotation editor, and label-anchored breakpoints. All of
it is wired to the ZX Spectrum Next and `.nex` files only. The NEX ideas document said so
deliberately: *Next-only for now, named so a later generalisation is possible*
(`NEX_DEBUGGING_IDEAS.md` §9).

Three things stop it working elsewhere:

1. **The bank arithmetic is Next 8K-page arithmetic.** It lives in four places:
   - `bankSiteAtAddress` (`nexLiveSymbols.ts:36`);
   - `bankRelativePartition` / `bankRelativeAddresses` (`breakpoint-scope.ts:202-216`);
   - `bankPartitions` (`nexLiveBank.ts:48`);
   - `bank16kPages` (`nextBankLocation.ts:34`).

   On the 128K and +3 a partition already *is* the 16K bank, and `resolvedPartitionFor`
   (`source-breakpoint-partition.ts:44`) already makes that distinction once. The 48K has no
   partitions at all.
2. **Annotations attach to a launched NEX.** `useLaunchedNexAnnotations` keys on `getNexLoad()`,
   and `nex-label`, `nex-run` and `bp-set <bank>:+<offset>` all check for `MI_ZXNEXT`. A 48K
   program has no `.nex` file to put a `.dis` beside.
3. **The live Disassembly view is not an annotated listing.** It takes operand names from the
   sidecar and from system variables, and nothing else:
   - no row labels (rows keep `L1234`);
   - no synopsis or end-of-line comments;
   - no regions;
   - no compiled program's labels either;
   - no way to edit annotations from the view.

   It also reads the sidecar only when `getNexLoad()` changes, so a label added afterwards does not
   reach it until the next launch (§2.3).

G7.2 adds the ROM. On a Spectrum most interesting calls go into it, and today `CALL $0DAF` stays a
number. Once the resolver of §4.4 exists, a ROM sidecar is just one more name source. It is
the same annotation model, with the sidecar sitting beside a ROM file instead of a program file.

### 1.1 Decisions this plan proposes

Each decision's default is recorded here. The ones marked **(Q)** wait for the author (§9).

| # | Decision |
|---|---|
| A1 | **One annotation model for every machine.** The NEX types become machine-neutral (`ProgramAnnotations`, in `src/renderer/appIde/annotations/`). The Next keeps its file format byte for byte. |
| A2 | **A per-machine *bank space* describes the memory**: bank size, bank count, which partitions are RAM banks, how an address maps to (bank, offset) under the current paging, and which region types and opcode sets apply (§4.2). Every piece of 8K arithmetic above goes behind it. |
| A3 | **48K memory is named as the 128K's banks 5, 2 and 0** (`$4000`, `$8000`, `$C000`), which is what a 48K snapshot's RAM already maps to (`parseSpectrumSnapshot(...).ram`). A 48K program annotated once keeps its annotations on a 128K in 48K mode. **(Q2)** |
| A4 | **An *active annotation set* replaces "the launched NEX"**. It is one `.dis` file, made active by `nex-run`, by `zx-snapshot`, by opening a project that names one, or by a command (§4.3). |
| A5 | **The sidecar is named `<host file>.dis`**: `game.nex.dis` as today, `game.z80.dis`, `game.tzx.dis`. A project without a program file uses `<project>/annotations.dis` **(Q3)**. |
| A6 | **The schema stays at version 2 for Next files.** A file for another machine is version 3, which adds `machine` (§4.1). Older builds therefore never open a 48K file as a NEX's. |
| A7 | **The live Disassembly view becomes an annotated listing.** It gets row labels, comments, regions and the annotation editor, through the existing controller with a new *live listing* port. |
| A8 | **One address-to-name resolver**, with sources in a fixed order: build symbols > the active annotation set > the user's ROM sidecar > the shipped ROM sidecar > system variables. The Disassembly view, Call Stack, Execution History, Profiler and `dis` command use it. |
| A9 | **ROM annotations are ROM sidecars, `<rom file>.dis`**, in the same model, with `machine: "rom"` (§5.1). Shipped ones sit beside the shipped ROMs and are read-only. A user's own sit beside the user's ROM file, or, for a shipped ROM, in the Klive home folder, named by CRC (§5.2). A shipped sidecar is found by the ROM page's CRC-32, and each label is bound to the bytes it describes, so it also annotates a *different* ROM wherever the bytes are identical (§5.3). |
| A10 | **ROM names are written as identifiers** (`CL_ALL`, not `CL-ALL`), so breakpoints, conditions and the command line can use them. That is the same rule `sys-var-operand-labels.ts` applies to `CH-ADD`. |
| A11 | **Provenance (D4) is enforced by process, by a per-entry `source` field, and by review.** No commented disassembly is copied or consulted. The community's conventional routine *names* are interface facts (Q1): a name list may be used, written as identifiers and marked `manual`, but never the comments, region boundaries or descriptions that come with it. |
| A12 | **The ZX80 and ZX81 are annotated by canonical address** (§4.7). They have no banks; their memory is a fixed map with mirrors, and the core already names every byte by its canonical address (`src/common/profile/layouts/zx8081.ts`). A label set at a mirror shows at every mirror of the same byte. |

---

## 2. Current code paths this touches

These were found by investigation on 2026-10-09; the paths are as of that day.

### 2.1 The model and the sidecar (`src/renderer/appIde/DocumentPanels/Next/`)

**Model.** `nexAnnotations.ts` (1218 lines) holds:
- the types: `NexFileAnnotations`, `NexBankAnnotation`, `NexAnnotationRegion`, `NexLineAnnotation`,
  `NexOperandReference`, `NexDebugState`;
- the constants: `NEX_ANNOTATION_SCHEMA_VERSION = 2`, readable versions `[1,2]`,
  `NEX_BANK_SIZE = 0x4000`, `NEX_MAX_BANK = 111`;
- parsing and validation (`parseNexAnnotations`, `validateNexAnnotations`).

Banks are **16K**, keyed by decimal string. Offsets are bank-relative, `$0000-$3FFF`.
`globalLabels` are 16-bit addresses.

**Pure edits.** `nexAnnotationEdits.ts` holds the functions `withLabelChange`, `withRegion`,
`withLineAnnotation`, `withOperandLabel` and so on. Validation helpers are in `nexValidation.ts`.

**The sidecar.** `nexAnnotationSidecar.ts`:
- Two read-merge-write writers. `saveNexAnnotationSubtree` writes
  `schemaVersion`/`source`/`globalLabels`/`banks`; `saveNexDebugSubtree` writes `debug`.
- `loadNexAnnotationSidecar` reports `missing`/`loaded`/`invalid`/`error`.
- `createNexAnnotationSidecar` creates a sidecar.
- The path is `getNexAnnotationPath = nexPath + ".dis"`.

**The session.** `nexAnnotationSession.ts`: one shared session per sidecar path. Writes are
coalesced, and a failed write leaves the session `dirty` and sets `saveError`.

**The listing.** `nexAnnotatedDisassembly.ts` has `createAnnotatedNexDisassemblyItems` (region walk,
PC-anchored runs, data-row generators) and `decorateAnnotatedItems` (labels, synopsis rows,
end-of-line comments).

**Next-only pieces:**
- `nexEntryState.ts` (default offset index per bank);
- the `copper`/`dma` regions;
- the sprites view;
- `allowExtendedSet: true`.

**File types.** In `registry.ts`, `.nex.dis` opens in the code editor as read-only JSON (`:882`), and
`.nex` opens in `NEX_VIEWER`.

### 2.2 Editing UI

`features/memory/StaticMemoryDump.tsx` (1822 lines) hosts bank documents. It switches on
annotations when its view state carries `nexAnnotationPath`/`nexAnnotationBank`. It wires:
- `useNexAnnotationEditor` (the MVC in `Next/annotationEditor/`: Intents, Ports, Model, Controller,
  ViewModel, View);
- `useNexSidecarBreakpointSync`;
- `useNexLiveBankBytes`;
- `useNexBankLocation`.

Snapshot bank documents (`Spectrum/spectrumBankDocument.ts`) and Z88 bank documents reuse the
component **without** annotations.

The dialogs are `Nex{Label,Labels,OperandLabel,Region,Regions,SynopsisComment,EndOfLineComment,
BankComment}Dialog.tsx`.

The commands are:
- `nex-label` (`NexLabelCommand.ts`; Next only, uses `pageInfo.bank8k`);
- `nex-run` (records `nexLoadSession`);
- `bp-set <bank>:+<offset>` (`BreakpointCommands.ts:507-556`; Next only at `:512`).

### 2.3 The live Disassembly view

The view's files:
- `DocumentPanels/DisassemblyPanel.tsx`;
- `DisassemblyRow.tsx` (reads `formattedLabel`; has a row menu for breakpoints);
- `useDisassemblyRefresh.ts`, which builds `operandLabelResolver` per refresh from that read's
  `partitionLabels` and supplies `getRomPage` (`:225-246`).

The operand resolver chains two sources:
- `createNexLiveOperandLabelResolver(annotations, resolveMem64kPartitions(...))`;
- `createSysVarOperandLabelResolver`, which names `W`/`w` data operands only, never `L` jump
  targets.

**The gap.** `useLaunchedNexAnnotations` (`useNexLiveBank.ts:286`) reads the sidecar again only
when the `getNexLoad()` object changes. That contradicts the claim in `NexLabelCommand.ts:39-42`
that labels apply "on the next refresh". Phase A2 fixes it by subscribing to the session.

**The disassembler** is `disassemblers/z80-disassembler/z80-disassembler.ts`:
- `MemorySectionType` covers `Skip`, `Disassemble`, `ByteArray` and `WordArray`.
- Every referenced address gets a generated `L`+hex label.
- `partitionLabels` is stored but never used.
- The operand resolver hook is at `:665-692`.

**Custom disassemblers** are registered in `machine-registry.ts`. The 48K one decodes `RST 08`
report codes and `RST 28` calculator literals. It is also used for the Timex and, oddly, the C64.
**The 128K, +3 and Scorpion have none**, so their calculator bytes are not decoded.

### 2.4 Symbol consumers (no shared resolver)

| View | Names today | Where |
|---|---|---|
| Disassembly | NEX annotations, system variables | `DisassemblyPanel.tsx:184-224` |
| Execution History | build `Label` symbols, first in table order | `features/history/historyDisassembly.ts:74` |
| Profiler | kbasic callables, `.proc`, labels, call targets | `src/common/profile/routineMap.ts:93` |
| Call Stack (raw) | none | `SideBarPanels/CallStackPanel.tsx:69-136` |
| `dis` command | none | `commands/DisassemblyCommand.ts:96` |
| Breakpoint conditions | build symbols + sidecar labels (`<bank>:<name>`) | `appIde/utils/condition-symbols.ts` |

### 2.5 ROMs

All ROMs ship in `src/public/roms/`:
- `sp48.rom`;
- `sp128-0/1.rom`;
- `spp3e-0..3.rom`;
- `spp3-40-*`, `spp3-41-*` and `spp3-41es-*`, the Amstrad ROM sets.

The TC2048, 2068, Scorpion and TR-DOS ROMs are the user's own and are not shipped.

**Identification.** Only the Timex identifies its ROM by CRC-32, in `timexModels.ts:106-142`
(`romCrc32`, `TIMEX_KNOWN_ROMS`). `test/machines/p3-rom-images.test.ts` records the CRCs of each +3
ROM page.

**Paging.** Each machine reports its ROM partitions as negative indexes:
- 128K: `R0`, `R1`, and `R2` (TR-DOS) on the Beta 128;
- +3: `R0`-`R3`;
- Scorpion: `R0`-`R3`;
- 48K: none.

A partition label names a *slot*, not the ROM image in it. The 128K's `R1`, a +3's `R3` and a
custom 48K ROM all look alike from the label. ROM annotations are therefore found by the page's identity, not its slot (§5.3).

**ROM knowledge already in the repo.** It is written from scratch and found by running the ROMs:
- the addresses in `ZxSpectrumBase.ts:24-34`;
- the tape traps;
- the `P3RomSet` entry points;
- the ROM entry points the kbasic runtime uses (`float.kz80.asm`, `tape.kz80.asm`).

There is no ROM symbol data.

---

## 3. The traps

- **T1. The 8K/16K mix-up is silent.** A bank-relative breakpoint resolved with the wrong
  arithmetic never fires; `source-breakpoint-partition.ts` records exactly this. Every conversion
  goes through the bank space (A2), and §7 tests every machine's round trip:
  address → site → address, under every paging the machine allows.
- **T2. The 48K has no partitions.** `getPartition` returns `undefined` and the labels are `{}`, so
  "no partition" must not be read as "unbanked = global". Under A3 the 48K's bank space knows its
  fixed map without asking the machine.
- **T3. The 128K reports eight 8K slots** (`[s0,s0,s1,s1,…]`). A bank space that assumed one entry
  per 16K slot would read slot 1 as slot 0's second half.
- **T4. Back-compatibility of `.nex.dis`.** Old builds reject an unknown `type`/`lastView` value
  but ignore unknown keys. A Next file must stay version 2 (A6), and the NEX tests must pass
  unchanged.
- **T5. Two writers, one file.** The live view becomes a third *editor* of the same session. It
  must go through `updateNexAnnotationSession`, never write the file itself. Otherwise the
  coalescing writer and `saveError` stop meaning anything.
- **T6. ROM identity is not the slot.** If a ROM sidecar were chosen by partition label, the 48K one would
  name a custom ROM's bytes, or the +3's `R0` would get the 128K editor's labels. A shipped sidecar
  is chosen by CRC, and each label is checked against the bytes it describes (§5.2).
- **T7. ROM code that is not where the disassembler starts.** The ROMs have data inside code:
  calculator literals after `RST 28`, report codes after `RST 08`, keyword and message tables, the
  character set. A ROM sidecar carries these regions. The listing must start a decode at a region
  boundary, not at whatever address the viewport happens to begin. `nexAnnotatedDisassembly`
  already does this for banks, and the live listing has to do it across slots.
- **T8. The live view's range spans slots.** One visible 64K window can cross four slots, each
  holding a different bank, and possibly a ROM. The annotated listing runs per slot and is joined,
  not run on 64K with bank-relative data looked up afterwards.
- **T9. Name clashes between sources.** A build symbol, a user label and a ROM label can name the
  same address. The precedence in A8 decides, and a row shows only one label. The others are
  listed in the tooltip, never dropped silently.
- **T10. Provenance leakage through an AI author.** A model writing ROM comments may reproduce a
  well-known commented disassembly from memory. §6 makes the rule explicit to every author, human
  or AI, and requires that each comment describe the bytes in front of it.
- **T11. ZX80/ZX81 mirrors depend on the model, not the address.** The profile layout says so
  itself: its identity map "cannot know the model". On the 1K/16K, `$C000` echoes `$4000` and the
  ROM appears again at `$2000`. On the 64K, `$2000-$FFFF` is real RAM. Folding a mirror without the
  model would put a 1K program's label on a 64K machine's unrelated byte. The ZX80/ZX81 bank space
  therefore takes the model's RAM size and ROM, and §7 checks each fold against the core's own reads.

---

## 4. Design — G7.1

### 4.1 The model

`Next/nexAnnotations.ts` and its edits, validation, session and sidecar move to
`src/renderer/appIde/annotations/`, under machine-neutral names:
- `ProgramAnnotations`, `BankAnnotation`, `annotationSidecar.ts`, `annotationSession.ts`,
  `annotationEdits.ts`, `annotatedDisassembly.ts`.

Next-only code stays in `Next/`: `copper`/`dma` decoding, sprites and `nexEntryState`. Each
consumer is updated to the direct path, and the old files are deleted rather than kept as
re-exports (AGENTS.md).

Schema version 3 adds one key:

```ts
type ProgramAnnotations = {
  schemaVersion: 2 | 3;
  /** Absent (version 2) means the ZX Spectrum Next. */
  machine?: AnnotationMachine;      // "next" | "sp48" | "sp128" | "plus3" | "scorpion" | "timex"
                                    // | "zx81" | "zx80"
  source?: { fileName?: string; sha256?: string };
  globalLabels?: AnnotationLabel[]; // 16-bit addresses, as today
  banks: Record<string, BankAnnotation>; // 16K RAM banks; key range from the bank space
  debug?: AnnotationDebugState;
};
```

`machine` names a *bank space*, not a model. A Pentagon and a 128K share `sp128`; a +2A, a +3 and
a +3E share `plus3`. A file is valid for every machine whose bank space it names. Opening a file on
another machine is allowed with a warning, because a 48K file on a 128K (A3) is the normal case.

The Next keeps writing version 2 without `machine` (A6). Everything inside `BankAnnotation` is
unchanged; it was already machine-neutral apart from the region types, which the bank space now
filters.

### 4.2 The bank space

```ts
interface BankSpace {
  readonly id: AnnotationMachine;
  readonly bankSize: 0x4000;
  readonly maxBank: number;               // 111 Next, 7 128K/+3, 15 Scorpion, 7 48K/Timex (A3)
  readonly regionTypes: readonly RegionType[]; // copper/dma on the Next only
  readonly extendedSet: boolean;          // Next opcodes
  /** Where an address is now: a RAM bank site, a ROM page, or nothing (e.g. a Timex DOCK chunk). */
  siteAt(address: number, slots: SlotPaging): MemorySite | undefined;
  /** Where a bank site is mapped now: zero, one or (if a bank is paged twice) two addresses. */
  addressesOf(site: BankSite, slots: SlotPaging): number[];
  /** The breakpoint partition for a bank site (Next: the 8K page; elsewhere: the bank). */
  partitionOf(site: BankSite): number;
}
type MemorySite =
  | { kind: "bank"; bank: number; offset: number }
  | { kind: "rom"; partition: number; offset: number };
```

`SlotPaging` is the eight 8K-slot partition indexes each machine already reports
(`getCurrentPartitions`, or the `partitionLabels` of a memory read, resolved with
`resolveMem64kPartitions`).

| Bank space | Behaviour |
|---|---|
| `next` | Today's arithmetic, moved here unchanged: `bank = page >> 1`, `offset = (page & 1) * 0x2000 + (addr & 0x1FFF)`. |
| `sp128` / `plus3` / `scorpion` | The partition of the address's 8K slot is the 16K bank; `offset = addr & 0x3FFF`. Negative partitions are ROM. The +3's all-RAM special paging falls out of the same rule. |
| `sp48` | Fixed: `$0000` ROM, `$4000` bank 5, `$8000` bank 2, `$C000` bank 0 (A3). |
| `timex` | HOME chunks `H2..H7` as `sp48`. DOCK/EXROM chunks are `undefined`, i.e. not annotatable (Q4). |
| `zx81` / `zx80` | No partitions; a fixed map that depends on the model (§4.7, T11). The address is folded to its canonical address, then `bank = canonical >> 14`, `offset = canonical & 0x3FFF`. ROM addresses, including the ROM's mirror at `$2000`, are ROM sites. |

The four Next functions of §1 become `nextBankSpace` methods. `resolvedPartitionFor` and the
`bp-set` gate call `bankSpaceFor(machineId).partitionOf`. `bankSpaceFor(machineId)` is the only
place a machine id is checked.

### 4.3 The active annotation set

`annotations/activeAnnotationSet.ts` replaces `nexLoadSession` as the answer to "whose annotations
are live". It is a module singleton, for the same reasons that file gives.

```ts
type ActiveAnnotationSet = {
  path: string;           // the .dis file
  hostPath?: string;      // the .nex/.z80/.tzx it annotates, if any
  machine: AnnotationMachine;
  reason: "nex-run" | "snapshot" | "project" | "command";
};
```

What sets it:
- **`nex-run`**: the NEX's sidecar. It still records `nexLoadSession` too, which keeps its
  provenance job for the Memory Mapping panel.
- **`zx-snapshot`**: `<snapshot>.dis`, whether or not the file exists yet. It is created on first
  edit, as the NEX viewer's create link does.
- **Opening a project**: a new optional `.kliveproject` property, `annotations`, giving a relative
  path. The default is `annotations.dis` when the first annotation is made (Q3).
- **Commands**:
  - `ann-open <file>` and `ann-new <file> [-m <machine>]` make a file active;
  - `ann-close` deactivates it;
  - `ann-info` shows the path, the machine, and the counts of labels, comments and regions.

- **`tape-load` of a ZX80/ZX81 program file** (`.p`, `.81`, `.o`, `.80`; `TapeLoadCommand.ts`),
  and the program launch bar of those files: `<file>.dis`. Such a file loads at a fixed address,
  so it is as much a memory image as a snapshot is.

A Spectrum tape (`.tap`/`.tzx`) has no hook: what it loads, and where, is up to the loader it
carries. A tape-loaded Spectrum program uses the project or `ann-new`.

The Disassembly view, the condition symbols and the sidecar breakpoint sync all read the active
set, and subscribe to its session. That **fixes the stale-labels gap of §2.3**.

### 4.4 The shared resolver

`annotations/symbolResolver.ts`:

```ts
interface AddressSymbols {
  /** The label at a Z80 address under the given paging, with its source. */
  labelAt(address: number, slots: SlotPaging): SymbolHit | undefined;
  /** All names at the address, for tooltips (T9). */
  allAt(address: number, slots: SlotPaging): SymbolHit[];
  /** The containing routine and offset, for call stacks and profiles: `PRINT_OUT+12`. */
  routineAt(address: number, slots: SlotPaging): { name: string; offset: number } | undefined;
  operandResolver(slots: SlotPaging): DisassemblyOperandLabelResolver;
}
type SymbolSource = "build" | "annotation" | "rom" | "sysvar";
```

Sources are consulted in the order of A8:
- build symbols from the last compilation, which also closes the live view's "no compiled labels"
  gap;
- the active annotation set, through its bank space;
- the paged ROM page's sidecars: the user's first, then the shipped one (G7.2, §5.3);
- system variables, as today, for data operands only.

The resolver is rebuilt when one of its inputs changes: a compilation, a session update, a machine
change, or a ROM identity change. It is not rebuilt per refresh.

Its consumers are the Disassembly view, the raw Call Stack, Execution History (which replaces
`historyLabelLookup`), the Profiler's routine map (a new source between `.proc` and call targets)
and the `dis` command.

### 4.5 The live annotated listing

`annotations/liveAnnotatedDisassembly.ts` builds the Disassembly view's items for an address range
in three steps (T7, T8):

1. Split the range at slot boundaries, and map each piece to its `MemorySite`.
2. Build each piece's listing:
   - **a RAM bank with annotations**: `createAnnotatedDisassemblyItems` over that bank's regions,
     limited to the piece (today's generator, which already cuts runs at the PC);
   - **a ROM page with a sidecar**: the same, over its regions (§5);
   - **otherwise**: today's plain disassembly.
3. Join the pieces and decorate them through the resolver. Row labels come from `labelAt`; operand
   names, synopsis rows and end-of-line comments come from the owning bank's annotations or the
   ROM page's sidecars.

The machine's custom disassembler (RST decoding) still runs inside `disassemble` regions. Phase A3
also registers the 48K custom disassembler for the 128K, +3 and Scorpion, so their calculator
literals decode. Each one is gated on the ROM page being a 48K BASIC ROM (by ROM identity, §5.3).

**Editing from the live view.** The row menu gains the annotation editor's entries:
- Label…, Synopsis comment…, End-of-line comment…, Operand label…;
- Mark as code / bytes / words / skip;
- Go to definition.

The keyboard shortcuts are the same as in the bank document (`NEX_ANNOTATION_SHORTCUTS`).

The controller is reused unchanged. A new `LiveListingPort` translates a row (a Z80 address) into
the bank site the controller already works in, or, for a ROM row, into the ROM page site whose
edits go to the user's ROM sidecar (§5.3). A row in a slot the bank space cannot annotate (a Timex
DOCK chunk) gets the entries disabled, with a tooltip saying why. Writes go through the session (T5).

### 4.6 Bank documents and commands

- **Bank documents.**
  - Snapshot bank documents get annotations when the snapshot's `.dis` exists, or is created from
    the snapshot viewer's new "Create annotations" link, like the NEX viewer's.
    `spectrumBankDocument` passes `annotationPath`/`annotationBank`. The `nexAnnotation*` view-state
    fields are renamed, with a read fallback so saved layouts reopen.
  - A paused machine's banks open the same way from the Memory Mapping panel.
- **`label <name> [<address>]`** (alias `lbl`) replaces `nex-label`, which stays as an alias. It
  works on every machine with a bank space. It needs an active set, or it creates the default one
  (Q3).
- **`bp-set <bank>:+<offset>` and `<bank>:<label>`** work on every bank-space machine. `bank` is the
  16K bank everywhere.
- **The breakpoint owner** `{kind:"nex", sidecar}` becomes `{kind:"sidecar", sidecar}`. The old kind
  is read as the new one, and `BreakpointOwnership.test.ts` is extended to cover it.
- **The `.dis` file type** in `registry.ts` widens from `.nex.dis` to any `*.dis` whose JSON parses
  as annotations.

---

### 4.7 ZX80 and ZX81

The two machines run on one core (`src/emu/machines/zx8081/wasm/`). One model (Q4) covers every
configuration it runs: the ZX81 1K/16K/64K and US models, the ZX80 1K/16K, and the ZX80 with the
8K ROM.

**The memory map** (from the core's README, "Models"):

| Model | ROM | RAM |
|---|---|---|
| ZX81 1K / 16K | 8K at `$0000`, again at `$2000` | from `$4000`, mirrored up to `$FFFF` |
| ZX81 64K | 8K at `$0000` | `$2000-$FFFF`; an opcode fetch above 32K reads the lower 32K |
| ZX80 1K / 16K | 4K at `$0000` | from `$4000` |
| ZX80 with the 8K ROM | the ZX81's | 16K, as the ZX80 |

**Bank space.** `zx81` and `zx80` (§4.2) take the model's RAM size and ROM from the machine
configuration (`bankSpaceFor(machineId, modelConfig)`). With them, a CPU address folds to its
canonical address: the lowest address a data access reaches the byte at, the same rule as the
profile layout. Canonical RAM is stored as 16K blocks, so the sidecar format is unchanged:
- `$4000-$7FFF` is bank 1;
- the 64K model adds blocks 0 (from `$2000`), 2 and 3.

`addressesOf` returns every mirror of a site under the current model. The Disassembly view shows a
label at its canonical row and at each mirror, with the mirror rows marked "(mirror of $4xxx)".
The 64K model's opcode-fetch redirect above 32K is not modelled: the listing shows what a data read
sees, as it does today.

**What changes for these machines:**
- **Data rows use the machine's character set.** The `bytes` region's text column and a new `text`
  region type decode with the registry's `charSet` (`Zx80Chars`, and the ZX81's), not ASCII. `text`
  is offered on the ZX80/ZX81 bank spaces only. It is written to disk as `bytes` +
  `decode: "text"`, the same rule as copper/DMA.
- **System variables.** `sysVars` returns `[]` for both machines today (`Z80MachineBase.ts:620`).
  This plan adds `Zx81SysVars.ts` and `Zx80SysVars.ts`, recorded from the machines' manuals as
  interface facts (§6), with the same `SysVar` type. So `D_FILE`, `E_LINE` and the rest name their
  operands, and the System Variables panel shows them. The addresses already in
  `zx8081MachineInfo.ts` are cross-checked against the new tables.
- **Breakpoints.** There are no partitions, so `bp-set <bank>:+<offset>` is refused. A label
  breakpoint (`bp-set <label>`) resolves to the canonical address and stays partitionless.
- **Bank documents.** These machines have none. Annotation happens in the live Disassembly view
  only.
- **The custom disassembler.** `Zx81CustomDisassembler` keeps decoding the calculator. Like the 48K
  one (§4.5), it is gated on the paged ROM being the ZX81 ROM, identified by its bytes, so RAM bytes
  after a `RST $28` are not decoded as calculator literals. This includes the ZX80 with the 8K ROM.
- **Annotation files.** A `.p`/`.o` program's sidecar sits beside it (§4.3). A program with no file
  uses the project's default sidecar, as on the Spectrum.

## 5. Design — G7.2

### 5.1 One file format: the ROM sidecar

A ROM's annotations are stored the way a program's are: in a **sidecar named after the file it
annotates**, `<rom file>.dis`. For example, `sp48.rom` gets `sp48.rom.dis`, and `sp128-0.rom` gets
`sp128-0.rom.dis`. The format is `ProgramAnnotations` at schema version 3, with
`machine: "rom"`. Two things differ from a program sidecar:

```ts
type RomSidecar = ProgramAnnotations & {
  machine: "rom";
  /** One entry per 16K page of the ROM file it sits beside. */
  pages: Record<string, { crc32: string; name: string }>;  // key = page index in the file
  /** Shipped sidecars only: sidecars whose labels apply here where the bytes match (§5.4). */
  inherits?: { sidecar: string; page: number }[];          // e.g. { sidecar: "sp48.rom.dis", page: 0 }
  /** Shipped sidecars only: per-entry provenance (§6). Key: "<page>:<offset>:label|line|region". */
  provenance?: Record<string, "observed" | "manual" | "derived">;
};
```

**How the content is keyed:**
- **`banks`** is keyed by the **16K page index within the ROM file**. Every shipped Spectrum ROM file holds
  one page, so its key is `"0"`. A user's 64K Scorpion ROM uses `"0"` to `"3"`. A ROM smaller than
  16K (the ZX81's 8K, the ZX80's 4K) is one page of its own size. Offsets are limited to that size,
  and the ROM's mirror at `$2000` maps to the same page (§4.7).
- Labels, regions, synopsis and end-of-line comments, and operand references are the existing
  `BankAnnotation` fields, at page offsets `$0000-$3FFF`. Nothing new is needed to *display* a ROM
  sidecar: §4.5's listing renders it as it renders a bank.
- `globalLabels` and the `debug` subtree are not allowed in a ROM sidecar.
  - A ROM label is always page-relative; a 16-bit address would be wrong whenever another ROM is
    paged in.
  - Breakpoints on ROM addresses belong to the program or project that set them, as today.

The validator rejects both. ROM sidecars use only the annotation-subtree writer.

### 5.2 Where ROM sidecars are stored

There are three places. Each is chosen by who owns the ROM file and whether Klive may write next to
it.

| Kind | Location | Written by | Notes |
|---|---|---|---|
| **Shipped** | `src/public/roms/<rom file>.dis`, e.g. `src/public/roms/sp48.rom.dis` | the repo only (§6) | Packaged by the existing `extraResources` rule (`package.json`: `src/public/roms/**/*` → `resources/roms`), so no build change is needed. At run time it is read as `roms/sp48.rom.dis` through `readTextFile`, which resolves a relative path against `PUBLIC` (`resolvePublicFilePath`): `src/public` in development, `process.resourcesPath` when packaged. **Read-only**: the install folder may not be writable (a macOS app bundle), and an update replaces it. |
| **User overlay of a shipped ROM** | `<Klive home>/RomAnnotations/<crc32>.rom.dis`, e.g. `~/Klive/RomAnnotations/a90a7b3c.rom.dis` | the IDE | The user's own labels and comments on a shipped ROM. It is kept out of the install folder, so it survives updates. It is named by CRC, not by file name, because it describes those bytes whichever machine loads them: `sp48.rom` serves the 48K, the Timex fallback and the Scorpion fallback. `<Klive home>` comes from `getKliveHomeBase()` + `KLIVE_HOME_FOLDER`, so a portable Klive keeps it in `KliveData`. It is read and written with `resolveIn: "kliveHome"`. |
| **User ROM file** | beside the user's file: `<path>.dis`, e.g. `~/roms/tc2048.rom.dis` | the IDE | For ROMs Klive does not ship: the TC2048/2068, Scorpion, TR-DOS, or a custom 48K ROM set in `sp48RomFile`. It is the sidecar convention of A5, unchanged, so the annotations travel with the ROM file. If that folder is not writable, the overlay location above is used instead, by CRC. |

A **shipped index**, `src/public/roms/rom-annotations.index.json`, maps each shipped page's
CRC-32 to its sidecar and page: `{ "a90a7b3c": { "sidecar": "sp48.rom.dis", "page": 0 } }`.
`npm run rom:annotations` generates it, and a test fails if it is stale. With the index, a ROM
loaded from *any* file whose bytes equal a shipped ROM gets the shipped annotations, and nothing has
to read every sidecar to find out.

### 5.3 How a paged ROM page finds its sidecars

**The machine says where each ROM partition came from.** It already knows, because it loads the
file. A new method sits next to `getPartitionLabels`:

```ts
// IAnyMachine
getRomSources(): Record<number, { path: string; page: number }>;
// partition (-1, -2, …) → the file it was loaded from ("roms/sp128-0.rom", or an absolute path)
//                         and the 16K page within that file
```

It is recorded in `loadRomFromResource` / `loadRomFromFile` (`Z80MachineBase.ts:220-245`) and in
each machine that splits a file into pages: the Scorpion's 64K file, the Timex fallback. The 48K
reports its one ROM as partition `-1`, so the renderer has no special case (T2). `MainToEmuProcessor`
passes the map to the IDE when the machine starts and whenever a ROM property changes.

**`src/common/roms/romIdentity.ts`** generalises the Timex's `romCrc32` and known-ROM table, which
move here. It gives each ROM partition a `RomPageIdentity = { crc32, size }`, computed once from the
partition's bytes and cached until the next `getRomSources` change.

**For the page in a slot**, the resolver stacks up to two sidecars:

1. **The user layer:**
   - for a shipped ROM file (a relative `roms/…` source), `<Klive home>/RomAnnotations/<crc32>.rom.dis`;
   - for a user ROM file, `<path>.dis`, falling back to the overlay location when it is not
     writable.
2. **The shipped layer.** The shipped sidecar is found **by CRC in the index**, not by file name, so
   a user's file that is byte-identical to `sp48.rom` still gets it. If the CRC is unknown, Q7
   applies: byte binding against `sp48.rom.dis` for a 16K page in a 48K BASIC position.

Names and comments from the user layer win over the shipped layer at the same offset. That makes
the A8 order, in full: build symbols > the active annotation set > the user ROM layer > the shipped
ROM layer > system variables. Each layer is a session in `annotationSession.ts`, keyed by its path,
so edits from the live view reach the listing like program edits do (§4.3). Shipped sidecars get a
read-only session that refuses updates.

**Editing a ROM row.** In the live view, editing a ROM row writes to the user layer, creating it on
the first edit (§4.5). The menu entries say where the result goes ("Label (your ROM annotations)…"). `label <name> <address>` on a ROM
address does the same.

**Byte binding.** Each label owns a span: from its offset to the next label, or to the region end.
When a shipped sidecar is applied through `inherits`, or to an unknown CRC (Q7), a label and its
comments apply only if the span's bytes are identical. This covers four cases:
- the 128K's `R1` and the +3's `R3` inherit most of `sp48.rom.dis`;
- a user's modified 48K ROM keeps every untouched routine;
- the TC2048 ROM gets the 48K names where its code matches;
- nothing is ever named wrongly, because a changed routine loses its name (T6).

The binding is computed once per identity (about 16K of compares) and cached. A user layer is never
byte-bound: it belongs to exactly one CRC.

The CLI (`klive run`/`test`) does not read ROM sidecars; it shows no disassembly.

### 5.4 The shipped sidecars

**The shipped `.dis` files are their own source.** There is no second authoring format: JSON
diffs well when it is formatted one entry per line. `npm run rom:annotations` does three things:
- it normalises the formatting: sorted keys, sorted offsets, one entry per line;
- it fills `provenance: "derived"` for inherited entries;
- it regenerates the index.

CI fails if running it would change anything. `.ai/rom-annotations/` holds only the rules and the
provenance log (§6), not data.

**Targets, in order:**

| Sidecar | Page | Notes |
|---|---|---|
| `sp48.rom.dis` | 48K BASIC ROM | The reference. Everything else inherits from it where it can. |
| `sp128-1.rom.dis` | 128K ROM 1 | `inherits: sp48.rom.dis`. Only the differing routines are authored. |
| `sp128-0.rom.dis` | 128K editor ROM | Authored. |
| `spp3-41-3.rom.dis`, `spp3-40-3.rom.dis` | +3 48K BASIC ROMs | `inherits: sp48.rom.dis`. |
| `spp3-41-0..2.rom.dis`, `spp3-40-0..2.rom.dis` | +3 editor, syntax, +3DOS | +3DOS's documented call table first (an interface fact from the +3 manual), then the rest. |
| `spp3-41es-*.rom.dis`, `spp3e-*.rom.dis` | Spanish and +3E | Inheritance only. |
| `zx81.rom.dis` | ZX81 8K ROM | Authored (Q4). The ZX80 with the 8K ROM gets it through the CRC index. |
| `zx80.rom.dis` | ZX80 4K ROM | Authored (Q4). |

`sp48-alt1.rom`, which no code loads, gets none.

### 5.5 Display

No new UI is needed for showing a ROM sidecar. The additions are:
- a toolbar toggle, **ROM labels**, next to the system-variable toggle, defaulting to on and stored
  in the view state like `sysVarNames`;
- a row-label tooltip naming the source: "ROM: sp48.rom", or "Your ROM annotations";
- `bp-set ROM:<name>` and `ROM:<name>` in conditions, resolved against the paged ROM's layers. A
  breakpoint on a ROM label stores the address *and* the ROM partition.

### 5.6 Completeness levels

A shipped sidecar is "done" for the roadmap at **level 2**:

| Level | Content |
|---|---|
| 1 | Every `CALL`/`JP`/`RST`/`JR` target reached from code regions has a label. Every data region is marked: tables, messages, character set, calculator literals. |
| 2 | Level 1, plus a synopsis comment for every labelled routine (inputs, outputs, registers changed) and an end-of-line comment where an instruction's purpose is not obvious. |
| 3 | Comments on every non-trivial line. Not a goal of this plan. |

The level is measured by a script (§7) and recorded in the sidecar.

---

## 6. Provenance discipline for G7.2 (decision D4)

This is the same discipline as Klive BASIC (AGENTS.md):

1. **Not used, not copied, not consulted:** any commented ROM disassembly, in print or online; any
   existing label or symbol file for these ROMs; any SkoolKit control or skool file for them.
2. **Allowed sources:**
   - **The ROM bytes themselves**, read through Klive's own disassembler.
   - **Klive's own observation**: coverage runs (G5.1), execution history and breakpoints in the
     `test/harness/sp48` / `sp128` / `zx81` harnesses, driving BASIC to exercise routines.
   - **Interface facts from the official manuals.** The system variables (already in
     `ZxSpectrum48SysVars.ts`), report codes, the +3DOS call table and entry conditions, and the
     128K/+3 paging ports. These are recorded in Klive's own words, with the manual named in the
     entry's provenance.
3. **Names** are Klive's unless Q1 allows the conventional ones.
4. **Every entry carries `provenance`**:
   - `observed`: from the bytes or a run;
   - `manual`: an interface fact;
   - `derived`: inherited by byte binding.

   `.ai/rom-annotations/PROVENANCE.md` states the rule. It also logs each authoring session's
   method: which harness runs, which manual pages.
5. **Instructions to an AI author** go in `.ai/rom-annotations/README.md`, which the shipped
   sidecars' `source` field points to. Describe only what the instructions in front of you do. Never
   write a comment from recollection of a published disassembly. If a sentence comes to mind
   ready-made, rewrite it from the code. Review checks for this (T10).

**Authoring tools** (`scripts/rom-annotations/`):
- `skeleton`: runs Klive's disassembler over a ROM and emits the level-1 to-do list (unlabelled call
  targets, suspected data from the coverage map).
- `coverage`: runs harness scenarios with coverage on and marks code versus data-only bytes. Its
  harness tests are listed in `build/e2e-tests.ts`.
- `bind`: computes inheritance and reports which labels survived on each inheriting ROM.
- `level`: the completeness report of §5.3.

---

## 7. Tests

**Bank spaces.**
- For each bank space and every paging the machine allows: address → site → address round trips,
  `partitionOf` matches what the core reports, and the `next` space's results are identical to
  today's functions (T1, T3).
- The 48K's fixed map; Timex DOCK/EXROM give `undefined` (T2).

**Model.**
- Every existing `nex*` model, edit, session and sidecar test passes, moved to the new paths.
- A version 2 file round-trips byte for byte (T4).
- Version 3 is accepted with `machine`, and rejected for an unknown `machine`.
- A 48K file opens on a 128K with the documented warning.

**Active set.**
- `zx-snapshot` activates `<snapshot>.dis`, and `nex-run` the NEX's sidecar.
- `ann-*` commands.
- A label added through the session reaches the live view's next refresh (the §2.3 gap; this test
  fails today).

**Resolver.**
- Precedence across the four sources, with `allAt` listing every name (T9).
- `routineAt` gives offsets.
- Each consumer (history, profiler, call stack, `dis`) shows a name for an annotated address.

**Live listing.**
- A range spanning ROM, bank 5, bank 2 and a paged-in bank 7 on the 128K gives each piece the right
  regions and labels (T8).
- A data region that starts above the viewport is not decoded as code (T7).
- Editing from the live view calls the controller with the right bank site.
- On a ROM row, an edit goes to the user layer: `<Klive home>/RomAnnotations/<crc32>.rom.dis` for a
  shipped ROM, `<path>.dis` for a user ROM file. The shipped sidecar is never written.
- In `StaticMemoryDump.test.tsx`, snapshot bank documents with annotations.

**Breakpoints.**
- `bp-set 5:+$0123` and `bp-set 7:Label` fire on a real 128K and a real +3 (e2e tier).
- `bp-set ROM:<name>` fires on the 48K.
- The owner migration `nex` → `sidecar`.

**Shipped ROM sidecars (unit tier; they need ROM bytes, not a core).** For every
`src/public/roms/*.rom.dis`:
- a `.rom` of the same name exists;
- the CRC matches the shipped ROM;
- each label sits on an instruction start inside a code region, per Klive's disassembler;
- regions do not overlap;
- names are valid, unique identifiers;
- `provenance` is present for every entry;
- it has no `globalLabels` and no `debug` (§5.1);
- `npm run rom:annotations` leaves it and `rom-annotations.index.json` unchanged.

**Storage and lookup.**
- `getRomSources` on every machine: the 48K, the 128K, the +3 (each Amstrad set), the Scorpion's
  split 64K file, and the Timex with and without a user ROM.
- The index finds the shipped sidecar for a user ROM file that is byte-identical to `sp48.rom`.
- The user layer's name wins at the same offset.
- An unwritable folder beside a user ROM falls back to the Klive home overlay.
- A portable Klive puts the overlay in `KliveData`.

**ZX80/ZX81 (§4.7).**
- For every model, each address folds to the canonical address the core itself reads (T11). The
  check reads a byte through every mirror on the real core: an e2e-tier test in
  `test/zx8081-hw/`.
- A label set at a mirror shows at the canonical row and at every mirror.
- The `text` region decodes with each machine's character set.
- The new system-variable tables agree with the addresses in `zx8081MachineInfo.ts`.
- `tape-load` of a `.p` activates `<file>.p.dis`.
- The calculator decoding is gated on the ZX81 ROM.

**Byte binding.**
- On a copy of `sp48.rom` with one routine patched, exactly that routine's labels disappear.
- `sp128-1` keeps the expected share of the 48K labels; the number is recorded once measured.

**Level.** `scripts/rom-annotations/level` passes at level 2 for the sidecars the roadmap marks done.

**In the IDE.** `scripts/`-style CDP checks in the running app:
- a 48K boots, and the Disassembly view at `$0000` shows ROM labels and comments;
- a label added from the live view persists in the `.dis` file and survives a restart.

---

## 8. Phases

The G7.1 phases come first; G7.2's display phase depends on A1-A4.

| Phase | Content | Size |
|---|---|---|
| **A0** | Move the model, edits, session and sidecar to `annotations/` under neutral names; schema version 3 with `machine`; T4 tests. No behaviour change. | S |
| **A1** | `BankSpace` for every machine; the four Next functions, `resolvedPartitionFor` and the `bp-set` gate behind it; round-trip tests. | S–M |
| **A2** | Active annotation set: `nex-run`, `zx-snapshot`, project property, `ann-*` commands, session subscription (fixes the stale-labels gap). | S–M |
| **A3** | Shared resolver; live annotated listing; 48K custom disassembler on the 128K/+3/Scorpion; resolver adopted by history, profiler, call stack, `dis`. | M |
| **A4** | Editing from the live view (live listing port, row menu, shortcuts); snapshot bank documents with annotations; `label` command; bank and label breakpoints on all bank-space machines; owner migration. | M |
| **A4b** | ZX80/ZX81 (§4.7): the `zx81`/`zx80` bank spaces with model-aware mirror folding, mirror rows in the listing, the `text` region and character-set data rows, the ZX80/ZX81 system-variable tables, the `tape-load` hook, the gated ZX81 custom disassembler. | S–M |
| **A5** | Docs (`.docs/annotations.md` → `.docs/annotations.md`; a docs-site page), roadmap and competitive-analysis updates for G7.1. | S |
| **R0** | `romIdentity.ts`; `getRomSources` on every machine; ROM sidecar validation, the three storage places and the CRC index (§5.2-§5.3); byte binding; user-layer editing from the live view; `ROM:` breakpoints and conditions; ROM labels toggle. Ships a *tiny* `sp48.rom.dis`: the entry points already in the repo (§2.5), all `observed`. | M |
| **R1** | Authoring tools (`skeleton`, `coverage`, `bind`, `level`), `.ai/rom-annotations/` rules and provenance log, `npm run rom:annotations` (formatter and index generator) and its CI check. | S–M |
| **R2** | `sp48` to level 1, then level 2. **Blocked on Q1.** | M (mostly data) |
| **R3** | `sp128-1` and `spp3-*-3` by inheritance, plus their differing routines; `sp128-0` to level 2. | M |
| **R4** | +3 ROMs 0-2: the +3DOS call table first (manual interface facts), then level 1. | M |
| **R4b** | `zx81.rom.dis` and `zx80.rom.dis` to level 2 (Q4). These are small ROMs (8K and 4K), and the coverage tool runs on the `test/harness/zx81/` harness. | M |
| **R5** | Docs, roadmap and competitive-analysis updates for G7.2. | S |

**Totals:**
- G7.1 (A0-A5) is **M**, at the upper end because of A3/A4. The ZX80/ZX81 add A4b.
- G7.2 (R0-R5) is **M–L**, as the roadmap says. The code is small; the authoring is the bulk, and
  R4b adds two more ROMs to author.

**Follow-ups this plan enables but does not include:**
- generated `rom48.inc` / Klive BASIC `ROM` constants from a shipped ROM sidecar;
- G7.3, writing auto-detected regions into the active set;
- G7.5, SkoolKit, which maps onto `ProgramAnnotations` directly;
- G7.6, which walks `liveAnnotatedDisassembly` per bank.

**Standing rules on completion:**
- Mark G7.1 and G7.2 done in `CLOSING_THE_GAPS_PLAN.md`.
- In `LANDING_PAGE_COMPETITIVE_ANALYSIS.md`, update the §2 rows "General reverse engineering
  (48K/128K)" and "NEX reverse engineering" (and say the ZX80/ZX81 are covered), and move W7's annotated-ROM and annotation parts out
  of §4.
- The Disassembly view's new ROM-label and source styling is a visual change, so it updates
  `.ai/ui-theming-intent-and-lessons.md` in the same change. Colours come from tokens.

---

## 9. Questions for the author

Answered 2026-10-09: the author accepted every suggested answer except **Q4**, where the ZX80 and
ZX81 are in scope (the *Answer* column records the result).

| # | Question | Answer |
|---|---|---|
| **Q1** | ROM routine **names**. The community's names (`CL-ALL`, `PRINT-OUT`, `STK-FETCH`) come from a published commented disassembly. Are they interface facts (a vocabulary everyone uses, like an API's names, and the kbasic runtime's comments already use some), or must Klive name routines itself? | Treat a *name list* as interface facts, written as identifiers (A10). Each name is marked `manual` with its source named. Comments, region boundaries and descriptions are never taken from it. The alternative, Klive's own names, is safe but makes every user translate. |
| Q2 | 48K memory as banks 5/2/0 (A3), or a flat 64K space of its own? | Banks 5/2/0: snapshots already map that way, and annotations carry over to a 128K in 48K mode. |
| Q3 | Where annotations live for a program with no file (built in a project, loaded from tape). | `annotations` in `.kliveproject`; default `annotations.dis` in the project root, created on first edit. Without a project, `label` asks for a file. |
| Q4 | Timex DOCK/EXROM chunks, ZX81, Z88: in or out? | **ZX80 and ZX81: in**, both program annotations (§4.7, A4b) and their ROMs (§5.4, R4b). Timex DOCK/EXROM and the Z88 stay out: the bank space returns `undefined`, and the UI says the memory cannot be annotated. |
| Q5 | Shipped ROM sidecars beside the ROMs in `src/public/roms` (§5.2), or bundled into the renderer? | Beside the ROMs. The existing `extraResources` rule packages them, they load on first use, and the sidecar convention is the same as for programs. |
| Q6 | Where do a user's own ROM labels go? | In a ROM sidecar of their own (§5.2): beside their ROM file, or, for a shipped ROM, `<Klive home>/RomAnnotations/<crc32>.rom.dis`. Not in a program's sidecar: a ROM label belongs to the ROM and should follow it into every program. Shipped sidecars are never edited in the IDE. |
| Q7 | Apply shipped sidecars to a ROM whose CRC is unknown (a custom ROM) by byte binding? | Yes, for a 16K page in a 48K BASIC position, against `sp48.rom.dis` only. A notice in `ann-info` says how many labels bound. |
| Q8 | Is the live Disassembly view also getting build-symbol row labels (A8's first source) in this plan, or is that separate? | In this plan: it is one line in the resolver and closes a gap users see immediately. |
