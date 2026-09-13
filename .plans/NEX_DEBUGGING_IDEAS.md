# Debugging a NEX File — Idea Collection

Make a ZX Spectrum Next `.nex` file a **first-class debug target**: start it with debugging turned
on, and place breakpoints at an address *within a particular bank of that NEX file*, using the NEX
viewer and its popped-out bank documents as the debugger front end.

**Status:** idea collection. **The eight scoping questions are now answered by the project author —
see §9, which is the decision log.** No implementation plan yet; §10 records the sequencing those
decisions imply.

The decisions in one line each: keep the `.nexload` route (no direct loader); bank-relative
breakpoints checked against the **8K** bank (R3); label-anchored breakpoints are in; both persist in
the `.nex.dis` sidecar; extend the `bp-set` grammar; Next-only for now; and make the paused-machine
experience first-class rather than optional.

Three sub-designs carry the weight and were worked out rather than assumed: **§9.4a** — breakpoint
*ownership*, which is what makes sidecar persistence possible and fixes a pre-existing bug on the way;
**§9.5** — how the entry-point stop is made reliable; **§9.5a** — moving the annotation UI out of
`StaticMemoryDump.tsx` so the gutter and live view have a small component to attach to.

This document deliberately separates three things that are easy to blur:

- **§2 Facts** — verified against the source, with `file:line`. Quoted code is verbatim.
- **§4–§8 Ideas** — proposals, each with its evidence and its cost. Sections now carrying an
  **in scope** / **out of scope** marker were settled by §9.
- **§3 the central problem**, and **§9 the decisions taken** — where the idea met something the
  codebase cannot currently express, and what was chosen.

---

## 1. Why this is a smaller feature than it looks

Three pieces of machinery already exist and already fit together, which is what makes the idea
worth pursuing:

1. **Partition-scoped breakpoints work today**, including on the ZX Next, in both the TypeScript and
   WASM cores. `bp-set 05:$C000` is already valid, already persisted, and already checked once per
   instruction.
2. **A Next RAM partition index *is* a 16K bank number** — the same numbering a NEX file uses. The
   mapping from "NEX bank 5" to "Klive partition 5" is the identity function (§2.2).
3. **The popped-out bank document already knows its bank**, and every disassembly row in it already
   carries `bank` + `bankOffset` metadata. The breakpoint gutter component it renders is the same one
   the live Disassembly view uses — it is simply handed no breakpoint props (§2.4).

And one piece already works that is easy to miss: **Ctrl+F5 on a Next project already debugs the
exported `.nex`** (§2.5). The *core* of the feature is therefore less "build NEX debugging" and more
"connect four things that are each already built, and fix what breaks when you do".

**But the decisions in §9 deliberately grew it past that core, and the title of this section should not
be read as an estimate.** Three of them add real work: R3 needs a new breakpoint kind through both
cores (Q2), label-anchored breakpoints add a third binding mode and a sidecar schema (Q3, Q4), and
making the paused-machine experience first-class (Q7) requires decomposing a 2168-line component
before anything can be added to it. The cheap part is genuinely cheap — §5.1 and §6.1 are close at
hand — and the rest is a deliberate investment, not an accident.

---

## 2. What was established

### 2.1 The breakpoint model and how a partition is checked

`src/common/abstractions/BreakpointInfo.ts` — one type, two mutually exclusive shapes:
**address-bound** (`address`, optionally `partition`) or **source-bound** (`resource` + `line`).

The partition test is **dynamic**, resolved against the live paging at the moment the CPU is at that
address — `src/emu/machines/DebugSupport.ts:82-112`:

```ts
  shouldStopAt(
    address: number,
    partitionResolver: (address: number) => number | undefined
  ): boolean {
    const flags = this.breakpointFlags[address];
    if (!(flags & (EXEC_BP | PART_BP))) return false;
    if (flags & EXEC_BP) return !(flags & DIS_EXEC_BP);
    const bpData = this.breakpointData.get(address);
    if (!bpData?.partitions || bpData.partitions.length === 0) return false;
    const partition = partitionResolver(address);
    const partitionEntry = bpData.partitions.find((p) => p[0] === partition);
    return !!partitionEntry && !partitionEntry[1];
  }
```

The Next supplies the resolver: `debugSupport.shouldStopAt(this.pc, () => this.getPartition(this.pc))`
(`src/emu/machines/zxNext/ZxNextWasmV2Machine.ts:793`).

**The consequence that shapes this whole feature:** a partition breakpoint is keyed by a **16-bit Z80
address**, and the partition is only a *filter* on it. A NEX bank breakpoint is naturally
`(bank, bankOffset)` — which has no Z80 address until you decide which slot the bank is paged into.
That gap is §3.

Also worth knowing: **no breakpoint state lives in Redux** (only a `breakpointsVersion` counter), and
breakpoint evaluation is entirely TypeScript — there is no breakpoint table inside the WASM core.
Anything but plain non-debug running drives the core one instruction at a time
(`ZxNextWasmV2Machine.ts:558-570`).

### 2.2 A Next RAM partition is a 16K bank number — identical to NEX bank numbering

This is the load-bearing fact, and it contradicts the current documentation.

Both cores compute a RAM partition by halving the 8K page number:

```ts
// src/emu/machines/zxNext/MemoryDevice.ts:1170  (TypeScript core)
      this.setPageInfo(pageNo, offset, offset, bank8k >> 1, bank8k);
```

```ts
// src/emu/machines/zxNext/ZxNextWasmV2Machine.ts:1378  (WASM core)
    if (bank8 < 224) return bank8 >> 1;
```

`bank8k` maxes out at 223, so **reachable RAM partition indices are `0..111`** — and a NEX file's
banks are `0..111` too (`NEX_MAX_BANK = 111`, `nexAnnotations.ts:4`; `NEX_BANK_FILE_ORDER = [5, 2, 0, 1, 3, 4, 6..111]`,
`nexFileLoader.ts:3-11`).

So on this path **NEX bank N ↔ Klive partition N, directly.** No conversion, no table.

> **⚠ Corrected while drafting the implementation plan, then superseded by a decision.** The claim
> above held for the *breakpoint* path only, and **the project author has since settled the question
> the other way: a positive Next partition index means an 8K page** (`NEX_DEBUGGING_PLAN.md` §4.1,
> Q9). So the identity is **NEX 16K bank N ↔ partitions 2N and 2N+1**, not N.
>
> That decision is a net simplification, because the 16K reading was the sole cause of the
> false-positive problem in §3(b) below — with 8K partitions the two halves of a bank are distinct
> partitions and the ambiguity cannot arise. §3's R3 therefore needs no new resolver, no new flag bit
> and no change to the per-instruction check.
>
> The original evidence, for the record. The *memory-reading* path treats the same positive index as
> an **8K page**:
> `getMemoryPartition(index)` computes `OFFS_NEXT_RAM + 0x2000 * index` (`MemoryDevice.ts:1088`, and
> the WASM twin at `ZxNextWasmV2Machine.ts:870`), which is what the Memory and Disassembly views
> fetch bytes through. So the same number means a 16K bank to the debugger and an 8K page to the
> viewers. The label space (224 entries), `MF_BANK: 224` and the docs all describe 8K pages; only
> `getPartitionForPage` deviates. **See `NEX_DEBUGGING_PLAN.md` §4.1**, which treats this as a
> blocking decision rather than a footnote, and §8.4 below, which understated it.

### 2.3 The NEX file model, and the entry-state bank map

`src/renderer/appIde/DocumentPanels/Next/nexFileLoader.ts` parses the whole file in the renderer:
`NexHeader` (`:147-169`) carries `programCounter`, `stackPointer`, `entryBank`, `borderColor`,
`bankFlags` (112 booleans), `fullRamRequired`, `requiredCoreVersion*`, `preserveNextRegisters`,
`fileHandleAddress`; `NexFileContents.bankData` is `[number, Uint8Array][]`, each exactly `0x4000`
bytes.

The NEX **entry state** — which bank is visible at which address when the program starts — is already
computed, but privately, in the viewer panel (`NexFileViewerPanel.tsx:589-602`):

```ts
function getDefaultDisassemblyOffsetForBank (
  bank: number,
  header: NexHeader
): number {
  if (bank === header.entryBank) {
    return NEX_SLOT_3_START;      // 0xC000
  }
  if (bank === NEX_SLOT_1_BANK) {  // 5
    return NEX_SLOT_1_START;       // 0x4000
  }
  if (bank === NEX_SLOT_2_BANK) {  // 2
    return NEX_SLOT_2_START;       // 0x8000
  }
  return 0x0000;
}
```

with the inverse, `getMappedBankForAddress(header, address)`, beside it. **This is the canonical
NEX-bank-to-address map and it is trapped inside a React panel file** — see idea §4.1.

### 2.4 The viewer and the popped-out bank already carry the right identity

A pop-out is not a window; it is a document of type `STATIC_MEMORY_DUMP_VIEWER` holding a copy of the
16K bank bytes (`StaticMemoryDump.tsx:2093-2123`), opened with id
`memoryDump-bankDump<projectPath>:<bank>` and a view state that already includes
`nexAnnotationPath`, `nexAnnotationBank` and `disassOffset`.

The annotation sidecar (`<file>.nex.dis`) already stores, per bank, **which 16K slot the bank is
viewed at**:

```ts
// src/renderer/appIde/DocumentPanels/Next/nexAnnotations.ts:7
export type NexAnnotationOffsetIndex = 0 | 1 | 2 | 3;
```

and every generated disassembly row is stamped with `bank`, `bankOffset` and `byteLength`
(`DisassemblyAnnotationMetadata`, `common-types.ts:132-167`).

`StaticMemoryDump` renders `DisassemblyRow`, which renders `BreakpointIndicator` — but passes it no
breakpoint props (`StaticMemoryDump.tsx:1841-1864`), so the gutter is inert.

### 2.5 Debug already reaches the Next — via simulated typing

`ZxNextMachine.getCodeInjectionFlow` (`:1423`) builds a **keyboard macro**: cold-boot to
`ROM0/$1202` (cached under the `zxnext-boot` checkpoint), dismiss the NextZXOS boot menu with
Down+Enter, then queue one keystroke per character of

```ts
  const prompt = `.nexload ${additionalInfo}\n`;   // ZxNextMachine.ts:1429
```

The file gets there via `copyToSdCard(filePath, "_klive/" + nexConfig.filename)`
(`KliveCompilerCommands.ts:988`), into the fixed SD image `ks2.cim`.

Debug mode is then armed **in place, after the flow finishes** —
`src/emu/machines/MachineController.ts:526-540`:

```ts
    if (debug) {
      if (this.state === MachineControllerState.Running) {
        // --- The injection flow left the machine running (e.g. ZX Spectrum Next
        // --- after typing the .nexload command). Switch to debug mode in-place
        // --- so the ongoing execution is not interrupted while the machine
        // --- still processes in-flight keystrokes.
        this.isDebugging = true;
        this.context.debugStepMode = DebugStepMode.StopAtBreakpoint;
```

and `"Start"` steps deliberately never start in debug mode, because a breakpoint hit mid-flow would
expire the queued keystrokes (`:464-468`).

So Ctrl+F5 works, with four gaps:

| Gap | Evidence |
| --- | --- |
| Only the **current project's build output** can be launched; an arbitrary `.nex` cannot | the SD path is built from `compiledOutput.nexConfig.filename` (`KliveCompilerCommands.ts:1091-1101`); `.nex` has no `contextMenuInfo` in `registry.ts:614-621` |
| Debug arms *after* `.nexload` is typed, so a breakpoint at the NEX entry point is a **race** against `startDelay` / `loadingDelayPerBank` | `MachineController.ts:526-540` |
| No "break at NEX entry point" affordance exists | — |
| No way to place a breakpoint from the viewer or a popped-out bank | §2.4 |

Two more relevant facts: there is **no launch-configuration concept** anywhere (F5 is a hardcoded
two-way branch in `ExecutionControls.tsx:101-110`), and **banked injection on the Next is
unimplemented** — `ZxNextMachine.injectCodeToRun:1543` has a bare `// TODO: Implement this` for
`segment.bank !== undefined`, with `MF_INJECT_SUPPORT: false` in the registry.

---

## 3. The central problem: a bank offset is not an address

Everything else in this document is comparatively mechanical. This is the part that needs a decision.

A NEX bank breakpoint means "offset `$0100` inside bank `$20`". The core can only arm a breakpoint at
a 16-bit Z80 address. Bank `$20` might be paged anywhere — and the Next's MMU is **8K**-granular, so
its two halves can be in unrelated slots.

**Two distinct difficulties, not one:**

**(a) Which address?** The candidates are `slot * 0x2000 + (bankOffset & 0x1FFF)` for slot `0..7` —
eight of them, or four if we insist on 16K-aligned pairs.

**(b) The partition cannot disambiguate the two halves of a bank.** `getPartitionForPage` returns
`bank8k >> 1` for *both* 8K halves, so both report the same partition. Concretely: a breakpoint for
bank `B` offset `$0100` (low half) projected to `$C100` with `partition: B` **also fires when B's
*high* half is paged at `$C000`** — where `$C100` actually holds bank B offset `$2100`. A false
positive, and a confusing one.

The fix for (b) is cheap, because the 8K bank number is already available on both cores:
`MemoryDevice.bank8kLookup[pageIndex]` (`:40`, `:222`) and
`wasm.zxnextGetMemoryPageBank8(pageIndex)` (`ZxNextWasmV2Machine.ts:1379`). What is missing is a
resolver that exposes it and a breakpoint field that wants it.

### Three candidate representations

| | How | Slot-independent? | Exact? | Core change | Breakpoint rows per gesture |
| --- | --- | --- | --- | --- | --- |
| **R1 — project through `offsetIndex`** | `address = offsetIndex*0x4000 + bankOffset`, `partition = bank`. Uses the slot the sidecar already records | no | yes, *if* the program pages the bank where the annotation says | none | 1 |
| **R2 — expand to every slot** | one breakpoint per slot, all with `partition = bank` | yes | **no** — suffers (b) | none | 4 or 8 |
| **R3 — a bank-relative breakpoint kind** | new fields on `BreakpointInfo`; core checks the **8K** bank and the offset | yes | yes | small, both cores | 1 |

**R1's honest appeal** is that it matches what the user is looking at: the popped-out bank listing
shows exactly those addresses, so a gutter click means "break here, at the address written on this
row". It is the cheapest correct-for-the-common-case option, and a NEX's own entry state (§2.3) makes
the common case genuinely common.

**R3 is the trustworthy answer** and is the only one that survives a program that pages a bank
somewhere unexpected — which is precisely what multi-bank Next code does.

> **Decided: R3** (§9 Q2), with no intermediate R1 stage. Two things follow. The false-positive class
> in (b) never ships, and the UI is built once against the final representation. And because Q4 puts
> persistence in the `.nex.dis` sidecar rather than `.kliveproject`, R3's one real drawback — that a
> new `BreakpointInfo` field is a change to a stored format — mostly evaporates: the new fields are
> written to a *new* schema, not bolted onto the project file. The ownership rule that makes this safe
> is in §9.4a.
>
> **And difficulty (b) has since dissolved entirely.** Q9 (`NEX_DEBUGGING_PLAN.md` §4.1) makes a
> partition an 8K page, so the two halves of a 16K bank are different partitions and the false
> positive cannot occur. R3 is consequently implemented by *reusing* the existing partition-scoped
> mechanism at eight candidate addresses — no new resolver, no new flag, and no change to the
> per-instruction check. R2's fatal flaw was never the fan-out; it was the 16K granularity.

---

## 4. Ideas — foundations

### 4.1 Extract the NEX entry-state map out of the viewer panel

`getDefaultDisassemblyOffsetForBank` / `getMappedBankForAddress` / `getProgramCounterBank` /
`getStackPointerBank` (`NexFileViewerPanel.tsx:562-610`) are the canonical answer to "where does this
NEX bank live at startup". Breakpoint projection (§3), the entry-state preview (§7.3), launch
diagnostics (§7.1) and the live bank view (§6.3) all need the same answer.

Move them beside `nexFileLoader.ts` as pure functions. Cheap, and it is a precondition for most of
§5–§7 rather than a feature of its own.

### 4.2 A "NEX debug session" as an explicit subject

Most ideas below need the IDE to know *which NEX is currently being debugged* — otherwise there is
nothing to attribute a live bank to. A small piece of session state (the `.nex` path, its parsed
header, its bank list, its sidecar path) is what makes §5.3, §6.3, §6.5 and all of §7 possible. It is
the spine of the feature.

### 4.3 An 8K-precise partition resolver

Needed by R3, and useful on its own: the Memory and Disassembly views currently cannot tell you which
*half* of a 16K bank you are looking at. Both cores already hold the number (§3).

---

## 5. Ideas — launching and running

### 5.1 Run / Debug an arbitrary `.nex`

A toolbar action in the NEX viewer and an Explorer context menu entry on `.nex` files: **Run**,
**Debug**, **Debug (break at entry)**. Today `.nex` contributes no context menu at all
(`registry.ts:614-621`), and the launch path is welded to the compiler output.

Mechanically this is: copy the chosen file to the SD image, then reuse the existing
`.nexload`-typing flow with `additionalInfo` pointing at it. The plumbing is all present
(`copyToSdCard`, `ZxNextStorageCopyRequest`, `getCodeInjectionFlow`).

This is the single highest value-to-effort idea in the document, and it is what the user literally
asked for first.

### 5.2 Break at the NEX entry point

A launch option that arms a breakpoint at `header.programCounter`, scoped to the bank that the entry
state puts at that address (§2.3 — `entryBank` for `$C000+`, bank 2 for `$8000..$BFFF`, bank 5 for
`$4000..$7FFF`). This is the natural first thing anyone wants and it currently cannot be expressed.

It also needs the race in §2.5 addressed: either arm before the keystrokes are queued and accept that
`"Start"` must stay non-debug until the last keystroke is consumed, or detect the `.nexload` handover
some other way. Worth prototyping before committing — see §9 Q5.

### 5.3 Reuse the boot checkpoint across debug cycles — **promoted to core scope** (§9 Q1, Q7)

> Choosing the `.nexload` route means every single launch pays for NextZXOS. Combined with the author's
> "nice and easy" requirement, this stops being an optimisation and becomes the difference between a
> usable debug loop and an unusable one. It is also fully orthogonal to the breakpoint work, so it can
> land early and makes manually testing everything else faster.

`ReachExecPoint`'s `checkpoint` already skips the cold boot by snapshotting WASM linear memory
(`ZxNextWasmV2Machine.ts:620`, `:646`). But it deliberately excludes the SD image, so **any card
write invalidates it** (`processWasmV2SdWriteFrameCommand:1009` calls `invalidateCheckpoints()`) —
and copying the NEX onto the card is a card write.

If the copy happens *before* the restore, or the checkpoint is keyed to the card's content, the
edit-debug loop stops paying for a full NextZXOS boot every time. For an iterative debugging feature
this is probably the biggest usability win available, and it is orthogonal to everything else.

### 5.4 Direct NEX loading, as an alternative mode — **OUT OF SCOPE** (§9 Q1)

> Decided against. Kept here because the reasoning is worth not re-deriving, and because it is the
> obvious thing a later reader will propose. Its consequence for this feature: `injectCodeToRun`'s
> banked-segment `// TODO` stays as it is, and `MF_INJECT_SUPPORT: false` remains correct.

Parse the NEX and install it directly: banks into RAM, palette and border, MMU 6/7 from `entryBank`,
`SP`/`PC` from the header — no NextZXOS, no typing, deterministic, and it can break **before the
first instruction**.

Everything needed exists (`runtime.memory` and `runtime.nextRegs` typed views,
`memoryDevice.directWrite`, `tbblueOut`, `NEX_BANK_FILE_ORDER`) except banked injection, which is the
`// TODO` at `ZxNextMachine.ts:1543`.

**Recorded with its caveat:** a NEX is a *program run under NextZXOS*, not a firmware image. It may
expect a live file handle in `BC` (`fileHandleAddress`), initialised NextZXOS variables, and a
configured machine. A direct loader is faster and more debuggable but less faithful. It should be an
*additional* mode with an honest label, never a silent replacement — §9 Q1.

### 5.5 Launch options, and where they live

Break-at-entry, load mode, SD target path, warm vs cold boot. There is no launch-configuration
concept to hang these on (§2.5). Two candidate homes: the `.nex.dis` sidecar (already exists, already
per-NEX, already stores view preferences) or `.kliveproject`. Note the sidecar is currently
registered read-only in the editor and is conceptually *annotations*, so putting launch settings
there may be a category error — §9 Q4.

---

## 6. Ideas — breakpoints and the paused machine

### 6.1 A live breakpoint gutter in the popped-out bank

Pass the breakpoint props `DisassemblyRow` already accepts. Clicking the gutter creates a bank-scoped
breakpoint from the row's own `bank` + `bankOffset` (§2.4). This is the user's core request, and the
components are already in place — what is missing is the representation decision (§3) and one
blocker:

**`buildBreakpointMap` keys by address alone** (`useDisassemblyRefresh.ts:144-155`). So two
breakpoints at the same address in different banks collide, and a breakpoint in bank `$20` lights up
the gutter while you are looking at bank `$05`. The panel *knows* its partition
(`resolveDisassemblyPartition`, `DisassemblyPanel.tsx:109-116`) and passes it to `getMemoryContents`
— it just does not use it for breakpoint matching. **Any bank-aware gutter has to fix this first**,
and fixing it improves the existing live Disassembly view too.

### 6.2 Bank-scoped watchpoints

Memory-read / memory-write breakpoints on `(bank, offset)`. `hasMemoryRead` / `hasMemoryWrite` are
already partition-aware (`DebugSupport.ts:120-176`). "Who is writing to my tilemap bank" is one of
the questions a bank-aware debugger exists to answer, and it costs nothing beyond §3.

### 6.3 Live-vs-file view in the popped-out bank

The pop-out is a *static* snapshot of file bytes. When the machine is paused, offer the **live** bank
(`getMemoryPartition(bank)`) in the same window.

### 6.4 Diff the live bank against the file

Highlight bytes that differ from the NEX file. Both arrays are already in hand, so this is nearly
free — and it directly shows self-modifying code, decompressed payloads, and corrupted banks. Of all
the inspection ideas this is the one that tells you something you cannot currently find out at all.

### 6.5 "Where is this bank right now?"

In the pop-out header, name the MMU slot(s) currently holding the bank, or say **not paged in**. Read
from `getNextMemoryMapping().pageInfo` (`EmuApi.ts:300`, consumed today by `MemMappingPanel`). This is
the smallest thing that closes the conceptual gap between a static bank and a live address — and it
makes §3's difficulty visible to the user instead of surprising.

### 6.6 Follow the PC into the bank

When paused with the PC inside a page holding bank B, highlight the corresponding row in bank B's
pop-out — the same spotlight the Disassembly view has.

### 6.7 Bank provenance in the Memory Mapping panel

Annotate each slot with "from `Game.nex` bank `$20`" when a NEX debug session is live. Requires §4.2.

### 6.8 Run to cursor, bank-aware

There is **no run-to-cursor anywhere** in the codebase. In a popped-out bank it would mean "run until
the CPU reaches this offset in this bank" — which must be built as a temporary bank breakpoint, *not*
on `UntilExecutionPoint`: `ExecutionContext.terminationPartition` is written
(`MachineController.ts:616`) but **no machine ever reads it** (`testTerminationPoint` compares
`pc === terminationPoint` only, `Z80NMachineBase.ts:542-547`).

### 6.9 A bank-offset notation for `bp-set` — **in scope** (§9 Q6); notation proposed in §9.6

`bp-set 05:$C000` already works but takes an absolute address. A bank-*offset* form would let a
script say what the viewer shows. **Handle with care:** the partition plan records that
`bp-set <partition>:<address>` is public API appearing "in the docs and in users' scripts"
(`PARTITION_NAMING_UNIFICATION_PLAN.md:103-105`), and that hex bank labels already own the `A0`/`D0`
namespace. A new separator is a grammar change — §9 Q6.

---

## 7. Ideas — annotations as debug symbols, and diagnostics

This group is where the feature stops being "breakpoints in banks" and starts paying back the
existing annotation work.

### 7.1 Validate the NEX before running it

Check, and report in the viewer: `requiredCoreVersion*` against the emulated core; `fullRamRequired`
and RAM size against the configured machine; `entryBank` actually present in `bankFlags`;
`programCounter` inside a bank the entry state maps in; `stackPointer` sane. All of it is available
from the already-parsed header. Cheap, and it converts a class of baffling silent failures into a
sentence.

### 7.2 Annotation labels as live symbols

There is a per-machine `ICustomDisassembler` hook (`zx-spectrum-next-disassembler.ts`, installed via
`setCustomDisassembler`). With a NEX session active, resolve live addresses through the annotations of
whichever bank is paged in — so hand-reverse-engineered names appear in the **live** Disassembly
view, the Watch panel, and the Call Stack panel.

This is the idea that most increases the value of what already exists: the `.nex.dis` sidecar
currently only improves a static listing.

### 7.3 Region types stop the live disassembler mis-decoding data

The sidecar's `bytes` / `words` / `skip` regions already prevent nonsense in the static listing. The
same information would stop the live view decoding a sprite table as instructions.

### 7.4 Label-anchored breakpoints — a third binding mode — **in scope** (§9 Q3)

Today a breakpoint is address-bound or source-bound. A NEX has neither: it has a bank and a label in
a sidecar. **"Break at `DrawSprite` in bank `$20`"** would resolve through the annotation label table
exactly as a source breakpoint resolves through the compiler's list file — and would survive a rebuild
that moves the code within the bank, which no offset-based breakpoint can.

The seam for this is already cut and unused: `resolvedPartition` is declared on `BreakpointInfo` and
**read in five places** in `DebugSupport` (`:256`, `:273`, `:332`, `:387`, `:593`) but
**written nowhere** — `ResolvedBreakpoint` has no partition field and `resolveBreakpoint` has no
partition parameter. The consumer side is written and waiting.

Was the largest and most speculative idea here; now accepted. It is the one that turns the annotation
sidecar into a genuine symbol file — and with Q4 putting the breakpoints in that same sidecar, a
label-anchored breakpoint and the label it names become neighbours in one file, which is why these two
decisions fit together better than either does alone.

### 7.5 Promote a live discovery into an annotation

Paused at an address inside bank B: **"Add a label here in the NEX annotations."** Closes the
reverse-engineering loop — you find something by running it, and the finding is saved where the next
session will see it.

### 7.6 Carry the compiler's bank information into source breakpoints

For a *project* that builds a NEX, a source-line breakpoint could be bank-scoped instead of
bank-blind. The compiler already knows: `ListFileItem.segmentIndex` → `BinarySegment.bank`
(`CompilerInfo.ts:603-612`, `:54-78`). `refreshSourceCodeBreakpoints` discards it, taking only
`lineInfo.address` (`src/common/utils/breakpoints.ts:109-114`).

This matters because `.bank` sections in Next assembly are routinely assembled at overlapping
addresses — so a source breakpoint in one bank can currently fire in another. It is the same
`resolvedPartition` seam as §7.4.

---

## 8. Defects found while investigating

These are not ideas; they are things that are already wrong and that this feature would either trip
over or expose.

### 8.1 An execution breakpoint in bank 0 never fires — **proven**

`DebugSupport.addBreakpoint:291` gates on truthiness:

```ts
          if (partition) {
```

while `collectBpFlags:592-600` withholds `EXEC_BP` whenever a partition is present and sets
`PART_BP`. So for `partition: 0` the flags say "partitioned breakpoint" but `bpData.partitions` stays
empty, and `shouldStopAt` falls through to `return false`. Removal, by contrast, tests
`partition !== undefined` (`:351`) — so add and remove disagree.

Verified by running a throwaway test against `DebugSupport` (since removed): a breakpoint with
`partition: 3` at `$C000` stops correctly; the identical breakpoint with `partition: 0` does not stop
at all.

Bank 0 is a real NEX bank — it is third in `NEX_BANK_FILE_ORDER`. Existing tests only exercise
partitions `-2` and `3`, which is why this survived.

### 8.2 The disassembly breakpoint gutter is not bank-aware

`buildBreakpointMap` keys by address only (`useDisassemblyRefresh.ts:144-155`). Pre-existing, affects
the live Disassembly view today, and blocks §6.1.

### 8.3 `resolveBreakpoint` clobbers flags at its address

`DebugSupport.ts:536-549` assigns `this.breakpointFlags[address] = EXEC_BP`, wiping `PART_BP` /
`MEM_*` / `IO_*` for any other breakpoint at the same address. `addBreakpoint:283` likewise assigns
rather than OR-ing.

### 8.4 The Next partition index space has two incompatible meanings

**This entry originally read "over-declared and mis-documented". That understated it** — the problem
is not that 224 labels exist for 112 banks, it is that the same index is read as a 16K bank by one
half of the system and an 8K page by the other:

- **16K bank** — `getPartitionForPage` returns `bank8k >> 1` (`MemoryDevice.ts:582`, WASM
  `ZxNextWasmV2Machine.ts:1378`). This is what breakpoints are scoped by and what the disassembly
  bank column displays.
- **8K page** — `getMemoryPartition(index)` reads `OFFS_NEXT_RAM + 0x2000 * index`
  (`MemoryDevice.ts:1088`, WASM `:870`). This is what the Memory and Disassembly views fetch bytes
  through, via `getMemoryContents(partition)` (`MainToEmuProcessor.ts:514-524`).

So `bp-set 0A:$C000` scopes to 16K bank 10 while the Memory view's bank `0A` shows 8K page 10 — 
different memory. The breakpoint dialog's bank matrix is built from the 8K label space and consumed by
a 16K reader. The disassembly view labels an 8K window with a 16K bank number.

Four things say 8K (the 224 labels, `MF_BANK: 224`, `getMemoryPartition`, `memory.mdx`) and one says
16K (`getPartitionForPage`).

**✅ Resolved (Q9): the 8K page wins.** `getPartitionForPage` and its WASM twin change to return
`bank8k` — one line each — after which the whole system is consistent and `MF_BANK: 224` and the docs
are correct as they stand. See `NEX_DEBUGGING_PLAN.md` §4.1 for the two user-visible behaviour changes
this causes and why no retroactive migration is possible.

### 8.5 Smaller items

- `ExecutionContext.terminationPartition` is written but never read (§6.8) — dead field.
- `ZxNextMachine.injectCodeToRun:1543` — `// TODO: Implement this` for banked segments (§5.4).
- `BreakpointInfo.partition`'s doc comment still says "reserved for future use"; it is fully live.
- `hitCount` is stored and flagged (`HIT_BP`) but never incremented or compared — dead weight.
- **The Memory Mapping panel's allRAM readout is always empty.** The wire type and the consumer say
  `allRamsBanks` (`EmuApi.ts:688`, `MemMappingPanel.tsx:138-139`); both producers emit `allRamBanks`
  (`MemoryDevice.ts:1077`, `ZxNextWasmV2Machine.ts:1317`). The field never matches, so the optional
  chain silently yields nothing. A one-character name, and it is the panel §6.7 would build on.
- `isMissingFileError` (`nexAnnotationSidecar.ts:190-193`) detects a missing sidecar by string-matching
  `"file does not exist"` / `"enoent"`.

---

## 9. Decision log

Settled with the project author. Each row records the decision and the consequence it forces, because
several of these answers constrain each other.

| # | Question | Decision | Consequence |
| --- | --- | --- | --- |
| Q1 | `.nexload` typing, direct loading, or both? | **`.nexload` typing only.** | §5.4 (direct loader) is **out of scope** and moves to non-goals; `injectCodeToRun`'s banked-segment `// TODO` stays untouched and `MF_INJECT_SUPPORT: false` is correct as it stands. **Raises the priority of §5.3** — every launch now pays for NextZXOS, so checkpoint reuse is the difference between a pleasant loop and a slow one. |
| Q2 | Which breakpoint representation? | **R3 — a bank-relative breakpoint kind, checked against the 8K bank.** | New fields on `BreakpointInfo`; new one-and-only-one resolver per core exposing `bank8k` (§4.3); no intermediate R1 stage, so the UI is built once. Also means §3's false-positive class never ships. |
| Q3 | Do label-anchored breakpoints exist? | **Yes** (§7.4). | `resolvedPartition` finally gets a writer; `ResolvedBreakpoint` grows a partition field; resolution runs against the sidecar's label table. Coheres neatly with Q4: the breakpoint and the label it names live in the same file. |
| Q4 | Where do bank breakpoints and launch options persist? | **The `.nex.dis` sidecar.** | The sidecar stops being purely *annotations* and becomes the NEX's debug companion file — schema bump, and its read-only editor registration needs revisiting. Requires **breakpoint ownership** (§9.4a), which also fixes a pre-existing bug. |
| Q5 | How is "break at the NEX entry point" made reliable? | **Open — worked out in §9.5.** | Recommends a one-shot *system* breakpoint armed before the flow, with user breakpoints suppressed during it. |
| Q6 | Extend the `bp-set` grammar? | **Yes.** | Needs a notation that cannot collide with hex bank labels or the existing `partition:address` form — proposal in §9.6. |
| Q7 | Live-capable pop-out, or a separate live-bank document? | **The pop-out becomes live-capable**, with the stated goal *"something that makes the debugging experience nice and easy."* | Promotes the whole §6.3–§6.7 cluster from "nice to have" to **core scope**. Also means `StaticMemoryDump.tsx` must be decomposed rather than extended — **the annotation UI moves out**, per the author's follow-up. Worked out in §9.5a. |
| Q8 | Next-only, or general? | **Next-only for now.** | No 128K or `.sna`/`.z80` work. Name the abstraction so a later generalisation is possible, but build no seams for it speculatively. |

### 9.4a The double-storage hazard, and the fix: breakpoint **ownership**

**The hazard is worse than a duplicate write — it is bidirectional, and one half of it is a
pre-existing bug.**

*Save leaks.* `.kliveproject` persists whatever the emulator holds, unfiltered — the whole set comes
back from `listBreakpoints()` (`src/main/projects.ts:333-336`) and goes straight into
`debugger.breakpoints` (`:365`).

*Load wipes.* Project open calls `restoreBreakpoints(restoredBreakpoints)`
(`src/main/projects.ts:204`), which is a **whole-set replace** — `resetBreakpointsTo` throws away
`breakpointDefs`, `breakpointFlags` and `breakpointData` and rebuilds from the argument alone:

```ts
  resetBreakpointsTo(bps: BreakpointInfo[]): void {
    this.breakpointDefs = new Map<string, BreakpointInfo>();
    this.breakpointFlags = new Uint16Array(0x1_0000);
    this.breakpointData = new Map<number, BreakpointData>();
```

So any sidecar-owned breakpoint already installed is destroyed by opening a project. An
exclusion-filter-on-save (this section's first draft) would not have touched that half at all.

#### Why a kind-based filter is the wrong fix

Beyond missing the load direction, it cannot answer the question it needs to: **which sidecar owns
this breakpoint?** `bank $20, offset $0100` does not identify a NEX file, and the viewer happily has
two `.nex` documents open at once. A filter keyed on *kind* is structurally unable to route.

#### The fix — every breakpoint has exactly one home

The real defect is that the emulator's breakpoint set is a **union of sets owned by different
persisters**, while every persistence operation assumes a single owner. Name the owner:

```ts
/** Who persists this breakpoint — and therefore who may replace it wholesale. */
export type BreakpointOwner =
  | undefined                            // the project (.kliveproject) — today's behaviour, default
  | { kind: "nex"; sidecar: string }     // that .nex.dis file
  | { kind: "session" };                 // nobody: run-to-cursor, the entry-point stop (§9.5)
```

Then make both persistence operations **owner-scoped**:

| Operation | Today | With ownership |
| --- | --- | --- |
| Project save | writes the whole emulator set | writes only `owner === undefined` |
| Project open | `restoreBreakpoints(bps)` replaces everything | replaces only the project-owned subset |
| Sidecar load/save | — | same call, scoped to its own `{kind:"nex", sidecar}` |
| Session breakpoints | — | never persisted by anyone; dropped on stop |

The mechanical change is turning `resetBreakpointsTo` / `restoreBreakpoints` from *replace all* into
*replace the subset owned by X*. Small, contained in `DebugSupport`, and it **fixes the load-wipe bug
rather than working around it**.

#### Why this is the better answer

1. **It fixes both directions.** The filter fixed one.
2. **It can route.** `{kind:"nex", sidecar}` names the exact file; a kind cannot.
3. **It subsumes §9.5.** The one-shot system breakpoints stop being a separate invention and become
   `owner: {kind:"session"}` plus a one-shot flag. Two problems, one concept.
4. **It is backward compatible.** `owner` absent means project, so existing `.kliveproject` files and
   every current code path keep working unchanged.
5. **The invariant is testable:** every breakpoint has exactly one home, and no persister may remove
   another's.

#### The collision question, and why it does not arise

`owner` must **not** be part of `getBreakpointStorageKey` — two owners claiming one key would fire
twice. That would need merge semantics, except that it cannot happen: with R3 a bank-relative key is a
new notation (`05:+$0100`, §9.6) and a label-anchored one an identifier, both **disjoint by
construction** from the address (`$C000`), partition-address (`05:$C000`) and source (`[file]:12`)
forms that project-owned breakpoints use. Worth an explicit test asserting that disjointness, so the
question stays closed.

#### Two loose ends to settle when planning

- `refreshSourceCodeBreakpoints` round-trips the whole set through `resetBreakpointsTo`
  (`src/common/utils/breakpoints.ts:118`). It must preserve `owner` — or better, become scoped too.
- Closing a NEX *document* should not remove its breakpoints; ending the debug *session* is a
  different event. Decide which one unloads the sidecar-owned set.

#### Side benefit Q4 already bought

A NEX opened with **no Klive project loaded** still gets persistent breakpoints, because the sidecar
sits beside the `.nex`. That is the strongest argument for Q4 over the simpler
"put-everything-in-`.kliveproject`" answer, which would also have avoided the hazard but lost this.

### 9.5 Q5 — making "break at the NEX entry point" reliable

I checked the timing rather than reasoning about it, and the conclusion is that **the race I originally
flagged is real but almost never lost — and it is also not the actual problem.**

**What the numbers say.** Each prompt character costs `SP_KEY_WAIT_SHORT` twice — a `QueueKey` with
`wait: 50` plus a `Wait` of 50 (`ZxNextMachine.ts:1436-1451`), so ~100 ms of wall clock per character,
~2.5 s for `.nexload _klive/foo.nex\n`. After the final Enter the flow spends another 100 ms, then
returns and debug arms. NextZXOS must then notice Enter, parse the line, open the file over DivMMC,
and read every 16K bank — and SD sector reads are a **per-frame renderer→main round trip**
(`ZxNextWasmV2Machine.ts:970` → `mainApi.readSdCardSector`). Bank loading is therefore inherently
multi-frame and takes orders of magnitude longer than the 100 ms arming window.

**Why the keystroke queue is fragile, confirmed.** `queueKeystroke` stamps an absolute tact window at
*queue* time (`ZxNextMachine.ts:1395-1403`), and `emulateKeystroke` drops any stroke whose `endTact`
is already past (`:1358-1384`) — releasing the key without ever pressing it:

```ts
    if (keyStroke.endTact < this.tacts) {
      // --- End emulation of this very keystroke
      this.keyboardDevice.setKeyStatus(keyStroke.primaryCode, false);
```

So if the machine pauses while the flow keeps queueing on wall-clock delays, every remaining stroke
shares a frozen `startTact`, and all of them are silently discarded on resume. The existing comment at
`MachineController.ts:464-468` is exactly right, and **any design that lets a user breakpoint fire
during the typing phase breaks the launch.**

**The actual problem is simpler than the race:** arming debug mode does nothing on its own. There is
**no breakpoint at the entry point** unless something puts one there.

**Recommendation — a one-shot system breakpoint, armed before the flow:**

1. Use a **session-owned, one-shot breakpoint** — `owner: {kind:"session"}` from §9.4a plus a one-shot
   flag: not shown in the Breakpoints panel, not persisted by any persister, and **auto-removed when
   it fires**. (This was drafted as a separate "system breakpoint" category; ownership makes it a
   value of an existing concept instead of a new one.)
2. Before the injection flow starts, arm one at the NEX entry site taken from the header — with R3,
   `bank = ` the entry bank per the entry-state map (§2.3), `offset = header.programCounter & 0x3FFF`.
3. Run the flow **in debug mode but with user breakpoints suppressed**, so only system breakpoints can
   stop the machine. This is what protects the keystroke queue, and it replaces today's blanket
   `NoDebug` during `Start` steps.
4. Lift the suppression when the flow completes, exactly where debug is armed today
   (`MachineController.ts:526-540`).

This removes the arming window entirely rather than bounding it: the breakpoint is live before
`.nexload` is even typed, and nothing else can stop the machine in the meantime.

Two properties worth noting. First, **the partition is what makes it precise** — `PC == programCounter`
may well occur during NextZXOS's own execution, but not with the NEX's entry bank paged at that
address, and R3's 8K check tightens it further. Second, this machinery is **exactly what §6.8
(run-to-cursor) needs**, so it is not a cost carried for one feature.

A one-shot breakpoint also needs a home for "fired, now gone": removal must bump
`breakpointsVersion` like every other mutation, or the panel and gutter will keep showing a
breakpoint that no longer exists.

**Rejected alternative:** ending the flow with an `UntilExecutionPoint` step targeting the entry point,
which would finally give `ExecutionContext.terminationPartition` the reader it has never had (§8.5).
Correct by construction and tempting for that reason — but `UntilExecutionPoint` forces the
per-instruction debug loop (`ZxNextWasmV2Machine.ts:558-570` takes the debug path whenever
`frameTerminationMode !== Normal`), which is precisely why the cold boot needed a checkpoint in the
first place. Single-stepping through a full multi-bank `.nexload` is not an acceptable launch cost.

### 9.5a Decomposing `StaticMemoryDump.tsx` — the annotation UI moves out

Raised by the project author, and it is the right call. The numbers:
`StaticMemoryDump.tsx` is 2168 lines, of which the single `StaticMemoryDump` component is **1784**
(`:151-1935`). Inside it, the stretch from `updateLineAnnotation` (`:583`) to
`runDisassemblyContextAction` (`:1560`) is **roughly a thousand lines of annotation-editing
orchestration** — twenty-odd `useCallback` dialog openers, the context menus, and the label/region
algebra. The generic job (a byte array, an address offset, a Memory/Disassembly toggle, virtualized
rows, selection, scroll state) is the minority of its own file.

That matters here because §6.1 (breakpoint gutter) and §6.3 (live/file view) attach to the **generic**
part. Bolting them onto the file as it stands would put three unrelated concerns in one component.

**The repo already prescribes the shape.** `.ai/ui-mvc-guide.md` says the signal to migrate is "a test
that mounts React in order to assert a *decision*" — which is precisely what
`NexFileViewerAnnotations.test.tsx` and `NexAnnotationDialogConsistency.test.ts` do today — and that
the pattern is for UI with "async orchestration plus derived display rules", which twenty async dialog
openers are by definition. Its four-step recipe applies unchanged, with
`src/renderer/appIde/dialogs/sjasmplus/` as the reference implementation:

| Step | Here |
| --- | --- |
| 1. Extract the pure helpers the component accumulated, with node tests | `countLabelReferences`, `removeLabel`, `addLabelIfMissing`, `replaceAnnotationRegion`, `getRegionTypeForSpan`, `getAlternativeRegionType`, `mergeAnnotationRegions`, `removeLabelOperandReferences*` (`:1940-2091`) — **already pure and already co-located**, so this step is nearly free. They belong beside the other `nex*` files, not in a memory-dump component. |
| 2. Model + ViewModel | annotation state, the dirty/save lifecycle, region and label rules — the decisions the DOM tests currently assert |
| 3. Controller over ports | the session (`subscribe`/`update`/`save`), the dialogs, the confirm port |
| 4. Rewrite the view and container, **keeping every `data-testid`** | `StaticMemoryDump` becomes NEX-agnostic; the annotation editor composes over it |

The end state: a generic static dump/disassembly component that knows nothing about NEX, and an
annotation editor that composes with it — after which the gutter and the live/file toggle are
additions to a small component rather than a 1784-line one.

**Sequencing note:** step 1 is worth doing immediately and independently — it is a pure move with
tests and no behavioural risk. Steps 2–4 are the real cost and should be budgeted as refactoring, not
smuggled into a feature step. This is why it is its own step in §10 rather than a bullet inside §6.1.

### 9.6 Q6 — a notation proposal

The constraint the partition plan imposes is that hex bank labels already own the `A0`/`D0` namespace
and that `bp-set <partition>:<address>` is public API
(`PARTITION_NAMING_UNIFICATION_PLAN.md:103-109`). So a bank-relative form must be distinguishable from
an absolute one *after* the existing colon split:

| Form | Meaning |
| --- | --- |
| `bp-set 05:$C000` | today's meaning, unchanged — absolute `$C000`, only while bank `05` is paged there |
| `bp-set 05:+$0100` | **new** — bank-relative: offset `$0100` within bank `05`, wherever it is paged |
| `bp-set 05:DrawSprite` | **new** — label-anchored, resolved through the sidecar's label table for bank `05` |

`+` is a safe marker because no address literal can begin with it (`$`, a decimal digit, or `%`), and an
identifier is unambiguous against all three for the same reason. Both new forms are additions; no
existing spelling changes meaning.

---

## 10. Sequencing implied by the decisions

Not yet a plan — a dependency order, now that §9 has fixed the scope. Steps 1–3 are prerequisites in
the strict sense: the work after them is wrong or unbuildable without them.

1. **Fix §8.1 and §8.2.** Bank-0 breakpoints and the address-only gutter map are prerequisites, not
   follow-ups. Neither is NEX-specific, both are independently testable against existing views, and
   §6.1 is simply incorrect without them. §8.1 already has a failing test written for it.
2. **§4.1 — extract the NEX entry-state map** out of `NexFileViewerPanel.tsx`. Needed by the breakpoint
   projection, the entry-point breakpoint (§9.5), validation (§7.1) and the live bank view.
3. **§4.3 — the 8K-precise partition resolver**, one per core. R3 cannot be built without it, and it is
   a small, well-isolated change with an obvious test (`bank8kLookup` vs `zxnextGetMemoryPageBank8`
   agreement).
4. **Breakpoint ownership (§9.4a)** — the `owner` field and owner-scoped `resetBreakpointsTo` /
   `restoreBreakpoints`. Do this **before** R3, not after: it is what makes sidecar persistence
   possible at all, it fixes the pre-existing project-open wipe on its own, and it is independently
   testable with no NEX involved. It also supplies the session-owned one-shot used by step 8.
5. **R3 itself** — the `BreakpointInfo` fields, the `DebugSupport` check, and the sidecar schema
   (§9 Q4). **Tests before any UI**; this is the layer everything in §6 sits on, and where a mistake is
   invisible rather than obvious. Include the key-disjointness test from §9.4a.
6. **§5.1 — launch an arbitrary `.nex`.** Independent of everything above and deliverable on its own;
   the best first visible increment — it could equally be step 1 if an early demo is wanted.
   **§5.3 (checkpoint reuse) belongs here**, not later: it makes every subsequent manual test
   dramatically faster, and Q1 made it core scope.
7. **§9.5a — decompose `StaticMemoryDump.tsx`.** Its step 1 (move the already-pure annotation helpers
   out) can land at any time and should go early. Steps 2–4 gate §6.1 and §6.3, and are **refactoring
   cost, not feature work** — budget them as such rather than folding them into the next step.
8. **§6.1 / §6.2 — the gutter and bank-scoped watchpoints.** The core request, now attaching to a small
   generic component. **§9.5 (the entry-point stop)** and **§6.8 (run-to-cursor)** come with it: both
   are session-owned one-shots from step 4, and building them together avoids inventing the same thing
   twice.
9. **§6.5, §6.3, §6.4, §6.6 — where is this bank, live view, file diff, follow-PC.** Core scope per Q7.
   Each is independently useful; §6.5 should come first because it makes §3's paging subtlety visible to
   the user instead of surprising.
10. **§7.1 (validation)** — small and self-contained; can land at any point, including early.
11. **§7.2, §7.3, §7.5, §7.6 (annotations as live symbols)** and **§7.4 (label-anchored breakpoints)**
    last. §7.4 depends on step 5's sidecar schema and on giving `resolvedPartition` its first writer.

**The `.nex.dis` schema is touched by steps 5, 8 and 11.** Design its version bump once, in step 5,
with all three uses in view — not three times.

**Two steps are worth landing on their own merits**, independent of whether the rest proceeds:
step 4 (fixes a real breakpoint-wipe bug), and step 7's first half (a pure, tested file move).

## 11. Non-goals to state explicitly

- **Direct NEX loading** (§5.4) — decided against in §9 Q1. The `.nexload` route is the only one.
- **Anything but the ZX Spectrum Next** — §9 Q8. No 128K bank breakpoints, no `.sna`/`.z80` snapshot
  debugging, and no speculative seams built for them.
- Not a NextZXOS / esxDOS debugger.
- Not conditional breakpoints or logpoints. `BreakpointInfo` has no room, and
  `BREAKPOINT_MANAGEMENT_UI_PLAN.md:76-77` already declared them a separate plan. Note this is *not*
  contradicted by §9.5's one-shot system breakpoints, which are internal, invisible and unconditional.
- Not a NEX *editor*. The viewer is read-only and should stay so; the sidecar is the writable surface —
  and Q4 widens what it holds without changing that.
- Not 8K-bank NEX support. NEX is a 16K-bank format; the 8K concern (§3b) is only about resolving live
  paging correctly.
- Not automated reverse engineering. §7 makes hand-made annotations more useful; it does not generate
  them.
- Not fixing `hitCount` (§8.5). It is dead weight today and stays dead weight; reviving it is a
  conditional-breakpoint feature by another name.
