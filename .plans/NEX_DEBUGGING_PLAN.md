# ZX Spectrum Next NEX Debugging — Implementation Plan

Make a `.nex` file a first-class debug target: launch any NEX with debugging on, and set breakpoints
at an offset **within a particular bank** of it, from the NEX viewer and its popped-out bank
documents.

**Companion document:** [`NEX_DEBUGGING_IDEAS.md`](./NEX_DEBUGGING_IDEAS.md) — the investigation, the
verified facts with `file:line`, the full idea catalogue, and the decision log. **This plan does not
restate the evidence**; where it asserts a fact, that document proves it. Read §2, §3 and §9 there
first.

**Status:** **Phases 0–4 complete** (§5–§9). **Phase 5 in progress** (§10): the bank breakpoint
gutter (§10.1) and its sidecar persistence are done. Still to do in Phase 5: the viewer's bank badge,
watchpoints (§10.2), and the entry-point stop and run-to-cursor (§10.3, §10.4). Phases 6–8 not
started.

---

## 1. Decisions this plan implements

From `NEX_DEBUGGING_IDEAS.md` §9, settled with the project author:

| # | Decision |
| --- | --- |
| Q1 | **`.nexload` typing only.** No direct NEX loader. |
| Q2 | **R3** — a bank-relative breakpoint kind, checked against the **8K** bank. No intermediate stage. |
| Q3 | **Label-anchored breakpoints are in scope** (Phase 8). |
| Q4 | Bank breakpoints and launch options persist in the **`.nex.dis` sidecar**. |
| Q5 | The entry-point stop is a **session-owned one-shot breakpoint**, armed before the injection flow, with user breakpoints suppressed during it (ideas §9.5). |
| Q6 | **Extend the `bp-set` grammar** with `<bank>:+<offset>` and `<bank>:<label>` (ideas §9.6). |
| Q7 | The popped-out bank becomes **live-capable**; the annotation UI moves out of `StaticMemoryDump.tsx` (ideas §9.5a). |
| Q8 | **ZX Spectrum Next only.** |
| **Q9** | **A positive Next partition index means an 8K page.** Raised while drafting this plan (§4.1) and settled with the author. |

Plus one design decision this plan adds, forced by Q4 and worked out in §4.5: **the sidecar carries
two independently-persisted subtrees**, because annotations save explicitly and breakpoints must not.

**Q9 is the most consequential answer in this table**, and in a good way: it collapses the feature's
central technical difficulty. §4.1 explains why.

---

## 2. Scope

### In

Breakpoint ownership; an 8K-precise bank resolver; bank-relative execution and memory breakpoints;
launching an arbitrary `.nex` with debugging; boot-checkpoint reuse; the `StaticMemoryDump`
decomposition; the bank breakpoint gutter; the entry-point stop and run-to-cursor; the live bank view,
file diff and paging readout; NEX pre-launch validation; annotation labels as live symbols;
label-anchored breakpoints.

### Out

Everything in `NEX_DEBUGGING_IDEAS.md` §11. In particular: **no direct NEX loader** (so
`ZxNextMachine.injectCodeToRun`'s banked-segment `// TODO` is left as it is, and
`MF_INJECT_SUPPORT: false` stays correct), no machines other than the Next, no conditional
breakpoints or logpoints, no revival of `hitCount`, and no NEX editing.

### Deliberately not fixed here

`resolveBreakpoint`'s flag clobbering (ideas §8.3) is a pre-existing defect on the *source*
breakpoint path. Phase 2 stops the new path from repeating the mistake (it ORs rather than assigns),
but repairing the old path is a separate change with its own regression surface. The
`allRamsBanks`/`allRamBanks` mismatch (ideas §8.5) is fixed locally in Phase 6, which depends on it.

**One item moved *into* scope while drafting:** the partition index-space inconsistency (§4.1). It was
recorded in ideas §8.4 as an over-declaration and a docs error; it is in fact two incompatible
meanings of the same number, and the feature cannot be built correctly on top of it. Resolved as Q9 —
positive partition indices mean 8K pages — which turned out to *remove* work from the plan rather than
add it (§4.1). Phase 2 makes the change and pins it with a test.

The `MF_BANK: 224` "over-declaration" is consequently **not a defect at all** and needs no change:
under Q9 there really are 224 RAM partitions.

---

## 3. Architecture

Four layers, bottom-up. Each is independently testable, and the two lowest have no NEX in them at
all.

| Layer | What it adds | Where |
| --- | --- | --- |
| **L1 — Ownership** | every breakpoint has exactly one persister; replaces become owner-scoped | `BreakpointInfo`, `DebugSupport`, `EmuApi`, `projects.ts` |
| **L2 — Bank-relative breakpoints** | a breakpoint keyed by (bank, offset) rather than address, checked against the live 8K paging | `BreakpointInfo`, `DebugSupport`, `MemoryDevice` + WASM facade, `BreakpointCommands` |
| **L3 — The NEX debug session** | which NEX is being debugged, its header, its sidecar; launch and the entry stop | new session module, `MachineController`, `ZxNextMachine` |
| **L4 — UI** | the gutter, the live bank view, diffs, symbols | `StaticMemoryDump` (decomposed), `NexFileViewerPanel`, panels |

**The one invariant that holds the design together:** a bank-relative breakpoint is a *runtime
predicate* — "8K page *p*, offset *o*" — and nothing about which file it came from. Ownership is
therefore purely a persistence concern and is **not** part of breakpoint identity. §4.4 records the
one consequence of that.

Note what L2 is *not*, after Q9: it is not a new breakpoint mechanism. It is a new **authoring and
persistence** shape over the partition-scoped breakpoints the emulator already evaluates.

---

## 4. Design decisions worth settling before code

### 4.1 A blocking inconsistency: what does a positive Next partition index mean?

**Found while drafting this plan, and it must be decided before Phase 2.** `NEX_DEBUGGING_IDEAS.md`
§2.2 states that a Next RAM partition index is the 16K bank number. That is true of the *breakpoint*
path and false of the *memory-reading* path — **the same index space has two incompatible meanings**:

| Path | Positive index means | Code |
| --- | --- | --- |
| Breakpoints, the disassembly bank column | **16K bank** (`0..111`) | `getPartitionForPage` returns `bank8k >> 1` (`MemoryDevice.ts:582`); WASM `bank8 >> 1` (`ZxNextWasmV2Machine.ts:1378`) |
| Memory view, Disassembly view byte fetch | **8K page** (`0..223`) | `getMemoryPartition(index)` → `OFFS_NEXT_RAM + 0x2000 * index` (`MemoryDevice.ts:1088`; WASM `:870`) |

Both cores agree with themselves and disagree with each other. The label space
(`getPartitionLabels()`, 224 entries), `MF_BANK: 224`, and `memory.mdx`'s "224 RAM banks, 8K each"
all describe **8K pages**; only `getPartitionForPage` deviates.

**The live consequence:** `bp-set 0A:$C000` scopes the breakpoint to 16K bank 10 (physical
`$28000..$2BFFF`), while selecting bank `0A` in the Memory view shows 8K page 10 (physical
`$14000..$15FFF`). The breakpoint dialog's bank matrix is built from the 8K label space and handed to
a layer that reads it as 16K. The disassembly view labels an 8K window of bytes with a 16K bank
number, so `0A` in its bank column and `0A` in its selector are different memory.

This is not cosmetic and it is not the "over-declaration" recorded in ideas §8.4 — that entry
understated it and should be corrected.

### ✅ Decided (Q9): a positive partition index means an **8K page**

Four things already said so and one deviated, so the change is to make `getPartitionForPage` and its
WASM twin return `bank8k` rather than `bank8k >> 1` — **one line per core**:

```ts
// MemoryDevice.ts:582                    was:  return pageInfo.bank16k;
    if (pageInfo.bank8k < 224) return pageInfo.bank8k;

// ZxNextWasmV2Machine.ts:1378            was:  if (bank8 < 224) return bank8 >> 1;
    if (bank8 < 224) return bank8;
```

After it, `getPartitionLabels()`'s 224 entries, `MF_BANK: 224`, `getMemoryPartition`, the bank
selectors and `memory.mdx` are all describing the same quantity. Nothing in the label space, the
picker or the docs needs to change — they were right and the resolver was wrong.

#### This collapses the feature's central difficulty

`NEX_DEBUGGING_IDEAS.md` §3(b) described the hard part of bank-relative breakpoints: a 16K partition
cannot distinguish a bank's low half from its high half, so a breakpoint for bank *B* offset `$0100`
also fires where *B*'s **high** half is paged — a false positive. That problem **exists only because
of the 16K reading.** With 8K partitions the two halves are different partitions, and the ambiguity is
gone by construction.

So the inconsistency found while drafting and the feature's core obstacle were the same bug. Three
consequences, all simplifications:

1. **No new resolver is needed.** §7.1's `getBank8kForPage` — a new method on `MemoryDevice`, a WASM
   facade rewiring, a new export — **is deleted from the plan.** `getPartition(address)` already
   returns exactly the number a bank-relative breakpoint must match.
2. **The per-instruction check is untouched.** A bank-relative breakpoint reuses the existing
   `PART_BP` mechanism verbatim (§4.6), so `shouldStopAt` needs no new parameter, and
   `DebugStepDecision.ts` (§19) needs no new field. Phase 2 stops depending on the concurrent
   refactor.
3. **No new flag bit.** `BANK_BP` / `DIS_BANK_BP` are dropped.

**What does not change:** a NEX bank is 16K by definition and the annotation model is 16K throughout
(`NEX_BANK_SIZE = 0x4000`, offsets `0..$3FFF`), so the feature's user-facing unit stays the 16K bank.
`bank` and `bankOffset` remain separate fields from `partition` (§4.2) — that separation is the whole
point.

#### The cost: two visible behaviour changes

Both are corrections, and both need a CHANGELOG entry.

- **The Disassembly view's bank column shows different numbers on the Next.** An address in 16K bank
  5's low half showed `05`; it will show `0A`. This *fixes* a real incoherence — the column labelled
  an 8K window of bytes (fetched via `getMemoryPartition`) with a 16K bank number — but existing users
  will notice.
- **`bp-set 05:$C000` changes meaning on the Next**, from 16K bank 5 to 8K page 5. The *grammar* is
  untouched, which is what `PARTITION_NAMING_UNIFICATION_PLAN.md` protected, but the *semantics* move.
  Saved scripts and any `.kliveproject` holding Next partition breakpoints are affected.

**No retroactive migration.** `.kliveproject` has no version marker anywhere (verified: no `version`
field in `projects.ts`), and a saved positive partition is genuinely ambiguous — a user following the
documented "8K each" already meant the new reading, while one who worked out the behaviour empirically
meant the old. Doubling every index would break the first group to fix the second. **Recommendation:**
accept the break, say so in the CHANGELOG, and add a `schemaVersion` to `DebuggerState` now so the
*next* such change is migratable. The affected population is likely small — Next partition breakpoints
were themselves broken for bank 0 (§5.1) and unreachable for all sixteen DivMMC banks until recently.

### 4.2 The new fields

Three additions, and `bank` is deliberately **not** folded into `partition` — that conflation is
precisely the bug §4.1 describes:

```ts
// src/common/abstractions/BreakpointInfo.ts — additions
  /**
   * The NEX 16K bank this breakpoint is relative to, `0..111`.
   *
   * Deliberately separate from `partition`: a NEX bank is 16K by definition, while a partition
   * index is an 8K page (§4.1). The 8K page actually matched is derived — see §4.6.
   */
  bank?: number;

  /**
   * Offset within that 16K bank, `$0000..$3FFF`.
   *
   * Presence of `bank` + `bankOffset` with `address` absent is what makes a breakpoint
   * *bank-relative*: it fires wherever that bank is paged in, rather than at one Z80 address.
   * Next only.
   */
  bankOffset?: number;

  /** Who persists this breakpoint. Absent means the project. See §4.3. */
  owner?: BreakpointOwner;

  /** Removed automatically the first time it fires. Never persisted. See §7.3. */
  oneShot?: boolean;
```

`BreakpointInfo` therefore grows **four** optional fields and gains a third mutually exclusive shape.
The shape test in `buildBreakpointKey` becomes a three-way branch.

Also: delete the stale `partition` doc comment ("reserved for future use") — it has been live for a
long time and this plan makes it load-bearing.

### 4.3 Ownership and scoped replacement

```ts
export type BreakpointOwner =
  | { kind: "project" }                  // .kliveproject  (the default when `owner` is absent)
  | { kind: "nex"; sidecar: string }     // that .nex.dis file
  | { kind: "session" };                 // nobody: one-shots, run-to-cursor

export type BreakpointScope =
  | { kind: "all" }                      // machine teardown only
  | { kind: "project" }
  | { kind: "nex"; sidecar: string };
```

`resetBreakpointsTo(bps, scope)` gains a **required** second parameter: remove every breakpoint whose
owner matches `scope`, then add `bps`, **stamping the scope's owner onto each**. A breakpoint in `bps`
whose own `owner` contradicts the scope is a programming error. `{kind:"all"}` takes owners from the
objects and is the only scope that clears session-owned ones.

Required, not optional, deliberately: the codebase already uses this idiom for
`getBreakpointDisplayKey`'s label map, where the comment notes that "forgetting it is now a compile
error rather than a silent fall back". Defaulting the scope would preserve exactly the bug L1 exists
to fix.

### 4.4 Two NEX files, one bank offset

Because ownership is not part of identity, two open NEX files that both breakpoint bank 5 offset
`$0100` produce **one** breakpoint with one owner — last writer wins. This is right at runtime (there
is one machine and one bank 5, so the predicate is genuinely the same) and only ambiguous for
persistence. **Accepted, and documented**; the alternative is merge semantics over a multi-owner set,
which is a great deal of machinery for a situation that requires two NEX files sharing a bank number
*and* an offset *and* both being open.

Label-anchored breakpoints do **not** get this treatment: before resolution, `05:DrawSprite` means
different offsets in different sidecars, so their key is file-qualified in the same way a source
breakpoint's is (§4.7, §13.2).

### 4.5 The sidecar has two independently-saved subtrees

The sidecar's existing contract is **explicit save**: annotation edits mutate memory and JSON is
written only when the user asks (`.docs/nex-annotations.md`). Breakpoints cannot work that way — a
breakpoint you set and then lose because you did not press Save is a bug, not a policy.

So schema v2 splits the file:

```jsonc
{
  "schemaVersion": 2,
  "source": { ... },          // unchanged
  "globalLabels": [ ... ],    // unchanged   \
  "banks": { ... },           // unchanged   / annotations — dirty-tracked, explicit save
  "debug": {                  //             \
    "breakpoints": [ ... ],   //              > debug — written immediately on every change
    "launch": { ... }         //             /
  }
}
```

**Both writers do read-merge-write on disjoint subtrees.** Saving annotations preserves the on-disk
`debug`; saving debug state preserves the on-disk `banks`/`globalLabels`. Neither can clobber the
other, and both keep their own policy. This is the single most important implementation detail in the
plan — getting it wrong loses user data silently.

`NEX_ANNOTATION_SCHEMA_VERSION` becomes `2`. `validateNexAnnotations` currently rejects anything but
an exact match (`nexAnnotations.ts:173`); it must accept `1` and `2`, and normalize `1` by adding an
empty `debug`. A v1 file is never rewritten as v2 until something is actually saved.

### 4.6 How a bank-relative breakpoint works — reusing the partition mechanism

`breakpointFlags` is a `Uint16Array(0x10000)` indexed by Z80 address, read once per instruction. A
bank-relative breakpoint has no address — so **register it at all eight candidate addresses**:

```
half        = (bankOffset >> 13) & 1          // which 8K half of the 16K bank
pageOffset  = bankOffset & 0x1FFF
page8       = bank * 2 + half                 // the 8K partition index to match
candidates  = slot * 0x2000 + pageOffset      for slot = 0..7
```

`page8` is derived here and nowhere else — the one place the 16K-bank-to-8K-page conversion lives,
which is what keeps the two units from leaking into the rest of the design.

**Because of Q9, each candidate is just an ordinary partition-scoped breakpoint.** Push
`[page8, disabled]` into that address's `breakpointData.partitions`, exactly as a user's
`bp-set` does, and the existing check does the rest unmodified:

```ts
    const partition = partitionResolver(address);            // now the 8K page
    const partitionEntry = bpData.partitions.find((p) => p[0] === partition);
    return !!partitionEntry && !partitionEntry[1];
```

So there is no new flag, no new parameter and no change to `DebugStepDecision.ts`, and
memory-read/write bank breakpoints (§10.2) come free, since `hasMemoryRead` / `hasMemoryWrite` use the
same structure.

> **Corrected during Phase 2.** This section first claimed the read path was untouched. It is not:
> because two entries can now share a partition at one address, `find` could return a *disabled*
> entry and mask an enabled one, so all three read paths became
> `some((p) => p[0] === partition && !p[1])`. Same cost, one more term in the predicate — but not
> "unchanged". See §7. Eight entries per breakpoint, against the 65,536 that I/O breakpoints already fan out
to (`DebugSupport.ts:275-281`).

Correctness rests on one fact: under Q9 the two halves of a 16K bank are *different* partitions, so a
breakpoint for `page8 = B*2` cannot match a page holding `B*2+1`. That is the ideas §3(b) false
positive, gone by construction rather than by an extra check.

**One entanglement to handle.** A bank-relative breakpoint and a user's own
`bp-set <page>:<addr>` can land on the same `[partition, disabled]` entry at the same address, and
removing one must not remove the other's. Tag the tuple with its provenance —
`[number, boolean, tag?]` — so `partitions.find(p => p[0] === partition)` and `p[1]` keep their exact
positions and the hot path still does not change, while `removeBreakpoint` and `enableBreakpoint` can
select only their own entries. (Rejected: two parallel arrays, which would force the check to consult
both.)

### 4.7 Key notation

`buildBreakpointKey` (`src/common/utils/breakpoints.ts:44`) gains a third branch. Storage form uses
the partition *index*, display form the partition *label* — the existing split is unchanged.

| Shape | Storage key | Display key |
| --- | --- | --- |
| address (existing) | `$C000`, `5:$C000` | `$C000`, `05:$C000` |
| source (existing) | `[main.asm]:12` | same |
| **bank-relative (new)** | `5:+$0100` | `05:+$0100` |
| **label-anchored (new, Phase 8)** | `[Game.nex.dis]:5:DrawSprite` | `[Game.nex.dis]:05:DrawSprite` |

The display forms are exactly what the extended `bp-set` accepts, preserving the round-trip
`BreakpointIndicator` depends on — it builds its command string from the display label
(`BreakpointIndicator.tsx:125-134`).

**One consequence of §4.1:** the bank in these two new forms is a **NEX 16K bank**, not a partition
index, so it is rendered and parsed as a plain hex bank number (`00`–`6F`) and **must not** go through
`getPartitionLabels()` / `parsePartitionLabel`. Under the recommended 8K resolution those label maps
describe a different quantity, and routing a bank through them is how the two index spaces got
confused in the first place. Bank-relative keys therefore need no label map at all, which is why they
are identical in both columns apart from zero-padding.

---

## 5. Phase 0 — Two defect fixes, no feature — ✅ **COMPLETE**

Independently landable, independently valuable, and Phase 5 is incorrect without them.

**Outcome.** Both fixed, both with tests that were confirmed to fail against the old code. Full unit
suite green (20,895 passed), `npm run build:check` reports no new type errors against its 123-entry
baseline, `npm run lint:renderer` reports 0 errors and no new warnings.

| Change | File |
| --- | --- |
| `if (partition)` → `if (partition !== undefined)` | `src/emu/machines/DebugSupport.ts:291` |
| 5 partition-0 regression tests | `test/debug/DebugSupport.test.ts` |
| New pure matching module | `src/renderer/appIde/DocumentPanels/breakpointRowMatch.ts` |
| `breakpointMap` regrouped, local builder removed | `useDisassemblyRefresh.ts` |
| Partition-aware row lookup, paging inverted once per render | `DisassemblyPanel.tsx` |
| 18 unit tests for the matching module | `test/renderer/breakpointRowMatch.test.ts` |
| Negative regression test + `pageLabels` harness option | `test/controls/DisassemblyPanelRefactor.test.tsx` |
| Assertion updated to the grouped map shape | `test/controls/DisassemblyRefresh.test.tsx` |

### 5.1 A breakpoint in bank 0 never fires

`DebugSupport.addBreakpoint:291` gates on `if (partition)`, which is false for partition `0`, while
`collectBpFlags:592-600` has already withheld `EXEC_BP` and set `PART_BP`. The result is a breakpoint
the machine can never stop at. Removal at `:351` uses `!== undefined`, so add and remove disagree.

**Fix:** `if (partition !== undefined)`. One character class, and bank 0 is a real NEX bank.

**Test:** already written during the investigation and reproduced; add it permanently to
`test/debug/DebugSupport.test.ts` — a partition-`3` breakpoint stops, and the identical partition-`0`
breakpoint must too. Existing tests only cover `-2` and `3`, which is why this survived.

### 5.2 The disassembly breakpoint gutter ignores the partition

`buildBreakpointMap` (`useDisassemblyRefresh.ts:144-155`) keys by address alone, so two breakpoints at
one address in different banks collide, and a breakpoint in bank `$20` lights the gutter while you are
viewing bank `$05`.

**Fix:** key by the storage key and match against the row's partition. `DisassemblyPanel` already
computes its partition (`resolveDisassemblyPartition`, `:109-116`) and passes it to
`getMemoryContents` — it simply is not used for breakpoint matching.

**As built.** The matching logic went into a new pure module,
`src/renderer/appIde/DocumentPanels/breakpointRowMatch.ts` (node-testable, no React), following the
`branchVerdict.ts` precedent in the same folder. `breakpointMap` became
`Map<number, BreakpointInfo[]>` — the old `Map<number, BreakpointInfo>` *could not* hold two
breakpoints at one address, which is why the last one silently won. The row then picks with
`selectRowBreakpoint(candidates, resolveRowPartition(...))`.

The rule is deliberately conservative, this being a bug fix rather than a redesign: a
**partition-scoped** breakpoint shows only where its partition applies; a **partitionless** one keeps
today's behaviour and shows at its address in any view. A scoped match beats a partitionless one at
the same address.

**Two things learned while doing it, worth keeping:**

1. **`mem64kLabels` has one entry per 8K page, and machines duplicate 16K slots into it.** The 128K
   returns `[slot0, slot0, slot1, slot1, slot2, slot2, slot3, slot3]`
   (`ZxSpectrum128WasmV2Machine.ts:182-189`), matching `getPartition`'s own
   `getCurrentPartitions()[(address >>> 13) & 0x07]`. So the views' `address >> 13` indexing is
   correct, and any fixture supplying fewer than eight entries is under-specified.
2. **`DisassemblyPanelRefactor.test.tsx` was exactly such a fixture** — `partitionLabels: ["R0", "R1"]`,
   two entries, harmless only while nothing read past index 1. Its partition-0 breakpoint at `$6000`
   (page 3) had no paging to be applicable to. Corrected to eight entries that agree with the
   breakpoint, and given a `pageLabels` option so the negative case can page something else in.

**Tests:** 18 unit tests on the pure module (grouping, label inversion, row-partition resolution in
both view modes, unpaged pages, partition 0, scoped-vs-partitionless precedence), plus a panel-level
negative regression — *"hides a partition-scoped breakpoint when its partition is not paged in"* —
verified to fail when `selectRowBreakpoint` is stubbed back to partition-blind behaviour.

**Gate:** ✅ both fixes green; full unit suite, type check and renderer lint clean.

**Not done, deliberately:** this leaves the *bank view* showing partitionless breakpoints at their
numeric address, which in a bank view is a bank-relative display address rather than a Z80 one.
Changing that is a behaviour change beyond the reported defect, and Phase 5 will revisit it when bank
addressing becomes first-class.

---

## 6. Phase 1 — Breakpoint ownership (L1) — ✅ **COMPLETE**

Fixed a second real bug: opening a project destroyed any breakpoint it did not itself hold, because
`restoreBreakpoints` was a whole-set replace (ideas §9.4a).

**Outcome.** Full unit suite green (20,915 passed, up 20), `build:check` no new type errors,
`lint:renderer` 0 errors and 44 warnings — the same count as before, so none new. `electron-vite
build` clean, which is the check that matters here (see "the one design change" below).

**The one design change from the plan.** §4.3 said the helpers would live in
`src/common/utils/breakpoints.ts`. They cannot: that module imports `@renderer/...` for `toHexa4`
and `getBreakpoints`, and the **main process** needs `breakpointMatchesScope` to filter a project
save — which would have dragged renderer code into the main bundle. They live in a new
dependency-free `src/common/utils/breakpoint-scope.ts` instead, re-exported from `breakpoints.ts` so
renderer callers still have one import site. `electron-vite build` is what confirms this.

**Two things the plan did not anticipate, both of which would have broken the feature silently:**

1. **`addBreakpoint` rebuilds the stored definition field by field**, so it dropped `owner` — every
   breakpoint would have become project-owned the instant it was registered, and a project save would
   have adopted a sidecar's breakpoints. `owner: bp.owner` added to that literal, with a test that
   fails without it (7 of the 18 ownership tests do).
2. **`breakpoint-utils.removeBreakpoint` stripped fields too**, not just `addBreakpoint` as §6.2
   noted. Removal looks a breakpoint up by `getBreakpointStorageKey`, which includes the partition —
   so rebuilding it from `address`/`resource`/`line` produced a *different* key and **removing a
   partition-scoped breakpoint silently did nothing**. Both helpers now forward the whole object,
   with `exec` still defaulted because `collectBpFlags` computes no flags for a kindless breakpoint.

**Scope semantics as built.** `resetBreakpointsTo(bps, scope)` captures the breakpoints the scope may
*not* touch, rebuilds from `[...survivors, ...stamped]`, and re-applies `disabled` for both groups.
That last part moved *into* `DebugSupport`: `MainToEmuProcessor.restoreBreakpoints` used to re-apply
`disabled` itself in a follow-up loop, which every future caller would have had to know about. It is
now a single call.

`applyBreakpointEdit` uses `{ kind: "all" }` — it is a read-modify-write of the whole set it just
read, and `"all"` keeps each breakpoint's own owner rather than stamping one, which is precisely what
makes that round trip ownership-preserving (§6.2 flagged this as "verify"; verified, and now tested).

| Change | File |
| --- | --- |
| `BreakpointOwner`, `BreakpointScope`, `owner?:` field | `src/common/abstractions/BreakpointInfo.ts` |
| `breakpointMatchesScope`, `ownerForScope`, `withScopeOwner` | **new** `src/common/utils/breakpoint-scope.ts` |
| Scoped `resetBreakpointsTo`; `owner` preserved; `disabled` re-applied | `src/emu/machines/DebugSupport.ts` |
| Scope parameter | `EmuApi.ts`, `MainToEmuProcessor.ts`, `IDebugSupport.ts` |
| Save filtered to project-owned; load scoped to `project` — **the wipe fix** | `src/main/projects.ts` |
| Undo/redo scoped to `project` | `MonacoEditor.tsx` |
| `refreshSourceCodeBreakpoints` scoped | `src/common/utils/breakpoints.ts` |
| Session-owned dropped on machine change | `MachineService.ts` |
| Read-modify-write scoped to `all` | `breakpoint-actions.ts` |
| Both helpers forward the whole breakpoint | `breakpoint-utils.ts` |
| 18 ownership tests | **new** `test/debug/BreakpointOwnership.test.ts` |
| 2 save-filter tests | `test/main/save-klive-project.test.ts` |

**Verified by reverting.** Stubbing `survivors` to `[]` (the old whole-set replace) fails 3 ownership
tests; removing `owner: bp.owner` fails 7; removing the save filter fails the save test.

**Left deliberately.** `DebugSupport`'s *constructor* still does not re-apply `disabled` when it
seeds from a previous machine's breakpoints — the same wart `resetBreakpointsTo` now handles. The
flags are right, so the emulator behaves correctly and only `listBreakpoints` misreports. It wants
its own test and is outside this phase; worth folding in when Phase 2 touches the class.

`eraseAllBreakpoints` is unchanged and still clears everything, session-owned included. That is the
right answer for "Remove all breakpoints" — a user erasing all expects bank breakpoints gone too —
and its semantics are settled elsewhere.

### 6.1 Core

- `BreakpointInfo.owner`, plus the `BreakpointOwner` / `BreakpointScope` types (§4.3).
- `DebugSupport.resetBreakpointsTo(bps, scope)` — owner-scoped removal, then add with owner stamping.
- `IDebugSupport.resetBreakpointsTo` (`src/renderer/abstractions/IDebugSupport.ts:140`) follows.
- A helper `breakpointMatchesScope(owner, scope)` in `src/common/utils/breakpoints.ts`, pure and
  node-tested.

### 6.2 API and every call site

`EmuApi.resetBreakpointsTo` / `restoreBreakpoints` (`EmuApi.ts:235`, `:245`) and their handlers
(`MainToEmuProcessor.ts:625`, `:643`) take the scope. Then each caller states its intent:

| Call site | Scope | Note |
| --- | --- | --- |
| `main/projects.ts:204` (project open) | `{kind:"project"}` | **the wipe fix** |
| `main/projects.ts:333-336`, `:365` (project save) | — | filter to project-owned before writing |
| `MonacoEditor.tsx:722`, `:745` (breakpoint undo/redo) | `{kind:"project"}` | its snapshots are whole-set; scoping at least stops editor undo destroying NEX breakpoints. Narrowing further, to per-resource, is **out of scope** |
| `common/utils/breakpoints.ts:117` (`refreshSourceCodeBreakpoints`) | `{kind:"project"}` | read-modify-write, so owners survive either way; scope it for intent |
| `breakpoint-actions.ts:49` (`applyBreakpointEdit`) | read-modify-write | safe as-is once `owner` round-trips; **verify** it does |
| `MachineService.ts:74-95` (machine change) | — | carries breakpoints into the new `DebugSupport`; must **drop session-owned** ones, since a machine change ends any session |

One more, easy to miss: `breakpoint-utils.ts:addBreakpoint` rebuilds the breakpoint from **three
fields only** (`address`, `resource`, `line`), so it silently drops `partition`, `owner` and anything
else. It must forward the whole object, or Phase 2's breakpoints will lose their identity on the way
to the emulator.

### 6.3 Tests

`test/debug/BreakpointOwnership.test.ts` (new, node):

- project-scoped reset leaves `nex`- and `session`-owned breakpoints untouched — *the regression test
  for the wipe*;
- nex-scoped reset leaves project-owned untouched, and touches only the named sidecar;
- `{kind:"all"}` clears everything including session;
- absent `owner` behaves as `{kind:"project"}` (backward compatibility with existing
  `.kliveproject` files);
- a scope stamps its owner onto added breakpoints.

Plus `test/main/`: a project save omits non-project breakpoints; a project open preserves them.

**Gate:** the wipe regression test fails before the change and passes after. No behaviour change
visible to a user who has no NEX open.

---

## 7. Phase 2 — Bank-relative breakpoints (L2) — ✅ **COMPLETE**

**Outcome.** Full unit suite green (20,951 passed, up 34), `build:check` no new type errors,
`lint:renderer` 0 errors and 44 warnings (unchanged), `electron-vite build` clean, and
`doc:build` + `doc:check` pass — links, assets and the Z80 highlighting all intact.

### What differed from the plan

**Q9 touched four sites, not two.** §4.1 named `getPartitionForPage` and its WASM twin. Two more
reporters answered in 16K banks and had to move with them, or the system would merely have relocated
the inconsistency: `MemoryDevice.getPartitions()` (`b.bank16k` → `b.bank8k`) and
`ZxNextWasmV2Machine.getCurrentPartitions()` (`zxnextGetMemoryPageBank16` →
`...Bank8`).

**Three test helpers were compensating for the bug by hand.** `wasm-next-debug-step`,
`wasm-next-interrupts` and `wasm-next-nmi` each carried

```ts
const memoryPartition = partition < 0 ? partition : partition * 2 + (pageIndex & 0x01);
```

— taking `getPartition`'s 16K answer and doubling it to index `getMemoryPartition`'s 8K pages. After
Q9 the conversion is wrong, and two of the three failed with *CPU-state* divergences (they were
writing their fixture bytes to the wrong page). This is the strongest corroboration Q9 was right: the
tests could only work by re-deriving the conversion the resolver should never have needed. All three
now pass the partition straight through.

**I had to change the hot path after all** — §4.6 claimed otherwise, and that was wrong. Two entries
can now share a partition at one address (a user's `bp-set <partition>:<address>` and a bank-relative
breakpoint projected onto it), so `find((p) => p[0] === partition)` could return a *disabled* entry
and mask an enabled one. The three read paths now ask `some((p) => p[0] === partition && !p[1])` —
"is there any enabled entry", which is also what the single-entry case always meant. Same cost, one
extra term in the predicate.

**Three more places were not tag-aware, and the tests caught it.** §4.6 only anticipated removal.
In fact `addBreakpoint`'s dedupe (`some((p) => p[0] === partition)`) **swallowed** a user breakpoint
whose partition a bank breakpoint had already claimed, and `removeBreakpoint`/`enableBreakpoint`
selected entries by partition alone, so each kind clobbered the other's. All three now match on the
tag as well, and four tests cover the co-location cases in both directions.

**§7.3's one-shot logic is built; its call site is deferred to Phase 5.** `consumeOneShotsAt` lives in
`DebugSupport` with tests, but the only place a breakpoint hit is now recorded is
`DebugStepDecision.ts` — the concurrent session's uncommitted file (§19). Wiring a hook into it would
create exactly the entanglement §19 says to avoid, and nothing in Phase 2 consumes it. Phase 5 adds
the one call, alongside the entry stop and run-to-cursor that need it.

### Changes

| Change | File |
| --- | --- |
| Q9: positive partition = 8K page, four reporters | `MemoryDevice.ts`, `ZxNextWasmV2Machine.ts` |
| `bank`, `bankOffset`, `oneShot` fields | `BreakpointInfo.ts` |
| `isBankRelative`, `bankRelativePartition`, `bankRelativeAddresses` | `breakpoint-scope.ts` |
| `<bank>:+$<offset>` key branch | `common/utils/breakpoints.ts` |
| Eight-address fan-out, tagged partition entries, tag-aware add/remove/enable, `some`-based reads, `consumeOneShotsAt` | `DebugSupport.ts` |
| `bp-set`/`bp-del`/`bp-en` grammar, Next-only and non-I/O guards | `BreakpointCommands.ts` |
| 23 bank-relative + one-shot tests | **new** `test/debug/BankRelativeBreakpoints.test.ts` |
| 11 grammar tests | **new** `test/commands/BankBreakpointGrammar.test.ts` |
| 2 value-pinning cross-core tests | `wasm-next-partition-labels.test.ts` |
| Hand-rolled conversion removed | `wasm-next-{debug-step,interrupts,nmi}.test.ts` |
| Q9 breaking change, the five fixes, the new grammar | `CHANGELOG.md` |
| 8K-page clarification; bank pairs | `docs/.../memory.mdx` |
| Bank-relative section and grammar | `docs/.../breakpoints.mdx`, `commands-reference.mdx` |

**The §3(b) test exists and passes**, named for what it protects: a breakpoint at bank 5 offset
`$0100` must not fire where bank 5's *high* half is paged, and the paired assertion shows the low half
at the same address still does, so it is not vacuous.

### One layering smell, knowingly left

`BreakpointCommands.ts` now imports `NEX_MAX_BANK` / `NEX_BANK_LAST_OFFSET` from
`DocumentPanels/Next/nexAnnotations.ts` — a command reaching into a document-panel module. The
constants belong with the NEX format helpers that §11.1 extracts; duplicating them would be worse.
Fold this into that extraction.

### 7.1 The convention change (Q9)

**This replaces the "8K resolver" an earlier draft called for.** Q9 makes `getPartition(address)`
itself return the number a bank-relative breakpoint needs, so there is no new method, no WASM facade
rewiring, and no new export — only the two one-line returns in §4.1.

Do this **first in the phase**, on its own commit, with its test.

**Test** (`test/wasm/zxNext/wasm-next-partition-labels.test.ts` or a sibling): for a spread of MMU
configurations, both cores return the **8K page** from `getPartitionForPage` and agree with each
other; `getPartition(address)` equals `nextRegs[0x50 + (address >> 13)]` for every RAM page; and ROM,
alt-ROM, DivMMC ROM and DivMMC RAM still map to their negative indices unchanged. This test is what
stops the two index spaces drifting apart again, so write it before the change and watch it fail.

**Also in this commit:** the Disassembly bank column and the memory bank selector now agree with the
bytes they show (§4.1's first behaviour change). Check `derivePartitionWidthCh`
(`controls/data/partitionWidth.ts:51`) still sizes the column correctly — the label set is unchanged,
so it should, but the values appearing in it are new.

### 7.2 Core breakpoint support

Thanks to Q9 this is **additive only — the stop decision is not touched**:

- `collectBpFlags`: a bank-relative breakpoint sets `PART_BP` and withholds `EXEC_BP`, exactly as a
  partition-scoped one already does. No new flag bit.
- `addBreakpoint` / `removeBreakpoint` / `enableBreakpoint`: the eight-candidate fan-out (§4.6),
  **OR-ing** flags rather than assigning (§2 "deliberately not fixed here"), with provenance-tagged
  partition entries so the two kinds can be removed independently.
- `BreakpointData.partitions` widens from `[number, boolean][]` to `[number, boolean, tag?][]` —
  positions `0` and `1` unchanged, so every existing reader compiles and behaves identically.
- `buildBreakpointKey`: the third branch (§4.7).
- `shouldStopAt`, `hasMemoryRead`, `hasMemoryWrite`: **unchanged.** So is
  `DebugStepDecision.ts` (§19), which means **Phase 2 no longer depends on the concurrent refactor
  landing** — it only has to not conflict with it.

### 7.3 One-shot breakpoints

`oneShot` breakpoints are removed the first time they fire, from wherever the stop is detected, and
the removal must `incBreakpointsVersionAction()` like any other mutation — otherwise the panel and
gutter keep showing a breakpoint that no longer exists. They are always `owner: {kind:"session"}` and
are never written by any persister.

Built here because Phase 5 (the entry stop) and Phase 5 (run-to-cursor) both need it, and building it
twice is how two subtly different one-shots get invented.

### 7.4 Commands (Q6)

`BreakpointCommands.validateCommandArgs` (`:108-208`) already splits on `:` and resolves the
partition label. Add: if the address part begins with `+`, parse the remainder as a bank offset and
produce a bank-relative breakpoint; reject it on a machine without banks, and reject it combined with
the I/O kinds exactly as a partition already is.

`bp-list` output uses the display key, so it round-trips into `bp-set` for free — which is the
property `PARTITION_NAMING_UNIFICATION_PLAN.md` established and this plan must not break.

### 7.5 Tests

`test/debug/BankRelativeBreakpoints.test.ts` (new, node) is the heart of the phase:

- a bank-relative breakpoint fires when its bank is paged at **each** of the eight slots;
- it does **not** fire when a *different* bank is paged there;
- **the false-positive case from ideas §3(b)**: offset `$0100` (low half) with the bank's *high* half
  paged at the candidate address must **not** fire. Q9 makes this pass by construction rather than by
  an added check — which is exactly why it must still be tested: it is now an emergent property of
  the partition granularity, and a future change to that granularity would silently break it. Write
  it first and name it for what it protects;
- disabled bank-relative breakpoints do not fire; re-enabling restores them;
- add-then-remove leaves all eight candidate addresses clean, and leaves a co-located address
  breakpoint intact;
- a one-shot is gone after firing and bumped the version;
- round-trip: `getBreakpointStorageKey` → `bp-set` display key → parse → the same breakpoint;
- key disjointness (§4.4): no bank-relative or label-anchored key can collide with an address,
  partition-address or source key.

**Gate:** all of the above, plus the Phase 0/1 suites still green. No UI yet.

---

## 8. Phase 3 — Launch an arbitrary `.nex` (L3) — ✅ **COMPLETE**

**Outcome.** Full unit suite green (20,966 passed, up 15), `build:check` no new type errors,
`lint:renderer` 0 errors / 44 warnings (unchanged), `electron-vite build` clean, `doc:build` +
`doc:check` pass with no broken links.

### ⚠ §8.2's premise was wrong — and there is nothing to fix

The plan (inherited from `NEX_DEBUGGING_IDEAS.md` §5.3, my own misreading) said copying the NEX to the
card destroys the `zxnext-boot` checkpoint, so every launch pays for a full NextZXOS boot. **It does
not.** Two different things share the word "invalidate":

- `invalidateCheckpoints()` drops the machine's checkpoint, and is called from exactly two places:
  `processWasmV2SdWriteFrameCommand` — when the **emulated machine** writes a sector — and
  `uploadWasmV2RomImages`.
- `invalidateSdCardHandler()` closes a cached **main-process file handle**
  (`zx-next-menus.ts:298-303`), and is what `copyToSdCard` calls. It never reaches the renderer.

So a host-side card copy leaves the checkpoint intact, and checkpoint reuse **already works** — for
the existing F5 build path as much as for this new launch. The existing suite already pins the
distinction: `wasm-next-checkpoint-flow.test.ts` has *"drops the checkpoint as soon as the machine
writes to the SD card"* beside *"keeps the checkpoint when the machine only reads"*.

No code, and no measurement, because there is no change to measure. What remains is a **pre-existing**
risk worth naming: a boot checkpoint captured before the card changed restores a NextZXOS whose cached
filesystem view predates the new file. The shipped build-and-run path has always done copy-then-restore,
so Phase 3 inherits that risk rather than introducing it, and the checkpoint is taken at the OS command
prompt where `.nexload` still does a fresh directory lookup. If a stale-cache failure is ever observed,
the fix is to invalidate the checkpoint on a host-side write too — a one-line addition to
`copyToSdCard`'s renderer caller.

### What was built

One command, reached from three places, so the Explorer, the document tab and a script cannot drift:

| Piece | File |
| --- | --- |
| `nex-run <file> [-d]`, aliased `nexrun` | **new** `src/renderer/appIde/commands/NexLaunchCommand.ts` |
| Dependency-free path helpers (`isNexFilePath`, `hostFileName`, `nexSdCardTarget`, `NEX_SD_FOLDER`) | **new** `src/common/utils/nex-launch-paths.ts` |
| Explorer **Run NEX file** / **Debug NEX file**, and the document-tab Run/Debug buttons | **new** `src/renderer/features/documents/NexLaunchContextMenu.tsx` |
| `.nex` gains `contextMenuInfo` + `documentTabRenderer` | `registry.ts` |
| Command registration | `IdeCommands.ts` |
| 15 tests | **new** `test/commands/NexLaunchCommand.test.ts` |
| `nex-run` reference, the direct-launch section, the feature entry | `commands-reference.mdx`, `run-debug.mdx`, `CHANGELOG.md` |

The launch decouples the SD path from `compiledOutput.nexConfig.filename` by deriving it from the host
file name instead, into the same `_klive/` folder the build path uses — one convention, and a short
enough `.nexload` line to type reliably through the emulated keyboard.

`codeToInject` is `{ model, segments: [], options: {} }`: the Next's flow has a `KeepPc` step and no
`Inject` step, so nothing but the model is read. `projectDebug` is `false` even with `-d`, because
there is no compilation behind an arbitrary NEX and so no source files to lock or resolve against.

### Deferred, deliberately

§8.1 listed a third menu item, **Debug (break at entry)**. Its mechanism is §10.3 — the session-owned
one-shot armed before the flow — so it ships with Phase 5 rather than as a stub here. Phase 3 offers
Run and Debug.

Deliverable on its own, and the first thing a user sees. It could equally run before Phase 2 if an
early demo is wanted — it shares nothing with the breakpoint layers.

### 8.1 Launch

- `.nex` gains `contextMenuInfo` in `registry.ts:614-621` — **Run**, **Debug**, **Debug (break at
  entry)** — following the `.ksx` precedent (`registry.ts:577`), and the same actions appear in the
  NEX viewer's own toolbar.
- A launch path that takes a `.nex` *path* rather than the compiler's output: copy it to the SD image
  and reuse `getCodeInjectionFlow` with `additionalInfo` pointing at it. Everything needed exists —
  `copyToSdCard`, `ZxNextStorageCopyRequest`, the `.nexload` flow. The only new work is decoupling
  the SD path from `compiledOutput.nexConfig.filename` (`KliveCompilerCommands.ts:1091-1101`).
- Works with **no project loaded**, which is why Q4's sidecar persistence matters.

### 8.2 Checkpoint reuse (promoted to core scope by Q1 + Q7)

Copying the NEX to the card is an SD write, and any SD write calls `invalidateCheckpoints()`
(`ZxNextWasmV2Machine.ts:1009`), destroying the `zxnext-boot` checkpoint that exists precisely to
skip the cold boot. So today every launch pays for a full NextZXOS boot.

**Fix:** do the card write **before** the checkpoint restore, so the invalidation happens while the
checkpoint is not yet needed. If ordering alone proves insufficient, key the checkpoint to the card's
content. Measure the before/after boot time and record it in this plan — the claim that this is the
biggest usability win should be a number, not an assertion.

### 8.3 Tests

Node tests for the path/SD-target derivation; a `test/commands/` test that the launch command
requires `MI_ZXNEXT` and refuses a non-`.nex`. The flow itself is timing-dependent and is verified in
the running app (§12), not in a unit test.

**Gate:** an arbitrary `.nex` in the Explorer runs and debugs; a project build still runs and debugs
exactly as before; the boot-time improvement is measured.

---

## 9. Phase 4 — Decompose `StaticMemoryDump.tsx` (ideas §9.5a)

No feature. Pure refactoring, budgeted as such.

The file is 2168 lines, of which the component is 1784 (`:151-1935`), and roughly a thousand of those
— `updateLineAnnotation` (`:583`) through `runDisassemblyContextAction` (`:1560`) — are annotation
editing: twenty-odd async dialog openers, the context menus, the label and region algebra. The
generic job is the minority of its own file, and Phase 5 and Phase 6 both attach to the generic part.

`.ai/ui-mvc-guide.md` prescribes the shape and the recipe; `src/renderer/appIde/dialogs/sjasmplus/`
is the reference implementation. Its trigger condition is met exactly: "the signal to migrate is a
test that mounts React in order to assert a *decision*", which is what
`NexFileViewerAnnotations.test.tsx` and `NexAnnotationDialogConsistency.test.ts` do today.

| Step | Work | Risk |
| --- | --- | --- |
| 4a | ✅ **Done.** All nine helpers moved verbatim to **new** `DocumentPanels/Next/nexAnnotationEdits.ts`, with 25 node tests in `test/renderer/nexAnnotationEdits.test.ts`. `removeLabel`'s parameter widened from the dialog type `NexLabelDialogLabel` to `NexAnnotationLabel` (it only ever read `name`/`value`), so the new module imports no dialog code. Every existing annotation suite passes unchanged. | none realised |
| 4b | ✅ **Done.** `NexAnnotationEditorIntents.ts` (16 intents), `NexAnnotationEditorPorts.ts` (session / dialogs / listing / confirm / dirtyChanged), `NexAnnotationEditorModel.ts` (state, 10 events, pure `reduce`, shared derivations) and `NexAnnotationEditorViewModel.ts` (`selectViewModel`, the menu as data, the discard prompt) in **new** `DocumentPanels/Next/annotationEditor/`, with **65 headless tests** and deep-merged builders in `test/dialogs/nexAnnotationEditor/`. | none realised |
| 4c | ✅ **Done.** `NexAnnotationEditorController.ts` — all 14 intents, the shared session, the seven dialogs, both confirmations and the two manage-dialog sessions — with **60 journey tests** and fakes for every port. `nexAnnotationEdits.ts` grew the pure model transforms the controller calls (`withBankSettings`, `withLineAnnotation`, `withSynopsisComment`, `withEndOfLineComment`, `withRegion`, `withClearedRowAnnotations`, `withLabelChange`, `withOperandLabel`, `listLabelsForBank`). | none realised |
| 4d | ✅ **Done.** `NexAnnotationEditorView.tsx` (the header controls and the menu, both dumb), `useNexAnnotationEditor.ts` (the wiring-only container), and `StaticMemoryDump.tsx` rewired: **2168 → 732 lines**, with ~1000 lines of annotation orchestration gone. | realised and passed |

### Progress notes

**Decided with the author:** full MVC, per §9 as written, rather than the lower-risk extract-hook
alternative I offered once the measurements were in.

**Scope, measured against the reference.** `.ai/ui-mvc-guide.md`'s reference implementation — the
SJASMPLUS dialog — was a 1098-line component that became 14 files with 139 tests. This component is
roughly twice that in the part being migrated, so the finished migration is a comparable multiple.
Building it in verifiable slices, in the guide's own order.

**Three decisions taken in the Model, each worth knowing before the rest is built on them:**

1. **Row selection moved into the editor.** It looks generic, but the listing only *has* a selection
   because annotations need ranges: every consumer of `disassemblySelection` in the old component was
   an annotation action. So `selection` and `contextTarget` are editor state.
2. **`dirty` stays owned by the shared session, not the editor.** `saveSettled` deliberately does not
   clear it. Two popped-out banks of one NEX subscribe to the same session, and an editor that kept
   its own copy would disagree with its sibling — which is the very thing the session exists to
   prevent.
3. **The listing is a port, not a selector.** `createAnnotatedNexDisassemblyItems` is async, so
   generating it is controller work whose result arrives as an event. `listingSettled` therefore has
   to **clamp the selection**: marking a range as `skip` collapses many rows into one, so the listing
   can shrink underneath a selection made against the old one.

**Two faithfulness bugs the ViewModel work turned up in my own Model, both now fixed and tested:**

- `offsetSpanOf` read the range's **boundary** rows, where the old component takes min/max over the
  *annotated* rows within it. A synopsis comment renders as a prefix row carrying no annotation, so a
  range starting or ending on one would have yielded no offset and silently abandoned the action.
- `labelRequested` carried no scope. Global and local labels share one dialog, opened on a chosen
  scope — the old `runDisassemblyContextAction` passes `"global"` / `"local"` — so the intent needs it.

**The menu is data, not markup.** `selectViewModel` returns the twelve entries and four separators
with each entry's `disabled` already decided, so the enablement rules are asserted headlessly. Two
rules beyond "annotations must be loaded": **Manage Labels/Regions** act on the whole bank and stay
available with nothing selected, and **Assign Operand Label** needs a row with a decoded 16-bit
operand — so it is refused on a generated prefix row and on any instruction without one.

**`canAssignOperandLabel` resolves its row in priority order** — an explicit argument, then the row a
menu was opened on, then the selection's active row — because the same rule is asked by the menu
(about the context target) and by the controller (about a specific row).

**A third layering correction, found while starting 4d: the listing does not belong to the editor.**
The component has a path the editor knows nothing about — a dump with **no sidecar still shows a
plain `Z80Disassembler` listing**, which is how a popped-out loading screen works. A controller that
owned generation returned `[]` in exactly that case, so it would have silently emptied those
documents. Generation stays in the component; the editor publishes the annotation model outward
(`vm.annotations`) and takes the rows back as a `listingChanged` intent. That removed a port, a
`LatestRun`, and an invented `busy: "listing"` state — the original toolbar had no busy affordance at
all, so that state was mine rather than the component's.

**The dialog ports had to widen to the dialogs' real props.** My first cut passed thin semantic
arguments (`{ bankOffset, initialValue }`); the dialogs actually want the row's `effectiveAddress`,
`instruction`, `generatedHardComment`, decoded `operands`, the bank's `regions` and its `bytes`. The
controller owns `items`, so it assembles them — which also means the region dialog now opens on the
span's *existing* type, as the original did.

**The Controller's three shaping decisions:**

1. **A handler ends at `session.update`, never by emitting the new model.** An edit is a pure
   transform published to the shared session, which broadcasts it back; the resulting snapshot is
   what updates state. That is what keeps two popped-out banks of one NEX in agreement, and it is
   why the fake session broadcasts rather than storing locally.
2. **A transform returning `undefined` means "nothing changed", and nothing is published.** Publishing
   anyway would mark the sidecar dirty for an edit that did nothing — behaviour, not an optimisation.
3. **Per-bank display settings persist from `environmentChanged`, not from their own intents.** It
   cannot be forgotten when a new control is added, and costs nothing on the way in: settings that
   came *from* the sidecar compare equal, so `withBankSettings` reports no change.

**Two port shapes the existing code forced, neither of them obvious:**

- **`manageLabels` takes callbacks, not a result.** The Labels list *stays open while you work in
  it* — add, edit and delete run as callbacks while it is mounted, each returning the refreshed list,
  so the row being changed stays visible behind the dialog asking about it. Only "Go To" resolves,
  because it scrolls the listing underneath. A port that merely resolved once could not express this.
- **`nativeConfirm`, `bankBytes` and `navigateToAddress` exist because the controller must stay
  DOM-free.** The first is the more interesting one — see below.

**`window.confirm` is preserved, deliberately.** Two questions still use it (discarding unsaved
annotations, and rewriting a whole 16K bank) while the label-delete flow beside them already uses the
app's `ConfirmPort`. `.docs/dialog-pattern.md` says the app's dialog is the one to use, so this is a
real inconsistency — **but both are asserted with their exact wording by the existing DOM suite, so
changing them is a behaviour change a refactor must not smuggle in.** They go through a `nativeConfirm`
port instead, which keeps the controller headless while preserving behaviour exactly. Worth its own
change afterwards.

**Two faithfulness bugs the ViewModel work turned up in my own Model, both now fixed and tested:** `.ai/ui-mvc-guide.md` carries a ⚠ saying
`npm run build:check` "type-checks nothing" because the root config is solution-style. That was true
before `scripts/check-types.cjs` existed; `AGENTS.md` now describes it type-checking both referenced
projects against a baseline, and it caught a real `TS6133` during step 4a. The guide's warning should
be removed so it stops misdirecting sessions to work around a fixed problem.

### The gate, and one condition it did not meet

**Passed.** `test/controls/StaticMemoryDump.test.tsx` — 27 tests, 1907 lines — is **unmodified** and
green, as are `NexFileViewerAnnotations`, `NexAnnotationDialogConsistency` and the three annotation
model suites (40 more). The suite covers every flow the migration touched: the stay-open labels list
("returns to the labels list after editing a label"), the reference-clearing delete, click /
shift-click / keyboard selection, all four comment, label, operand and region flows, the whole-bank
confirmation and the disposal confirmation. That is the strongest evidence available that the
migration preserved behaviour.

**The "no `DocumentPanels/Next/` imports" condition was not met, and could not be.** Five remain:
three are the editor itself — which *is* the composition — and two are NEX-format helpers the
component still needs because of the third layering correction: it owns listing generation
(`createAnnotatedNexDisassemblyItems`) and adopts the settings the sidecar remembers
(`getBankAnnotation`, `getNexBankAddressOffset`). The condition was written before that correction and
is wrong rather than unmet; what it was reaching for — the annotation *editing* UI out of the dump
component — is done.

### Still to do: step 6 of the guide's recipe

`.ai/ui-mvc-guide.md` step 6 is "re-partition the old suite; every deleted DOM test must name its
replacement." **No DOM test was deleted**, so nothing is unaccounted for — but the suite now
over-tests rules the headless layers own (region algebra, label bookkeeping, menu enablement), which
the guide's first non-negotiable says to avoid. Re-partitioning it is a separate, safe change now
that the headless coverage exists.

**Gate:** every existing NEX annotation test passes unchanged, including the dialog-consistency suite.
`StaticMemoryDump` no longer imports anything from `DocumentPanels/Next/`. If 4d cannot keep the tests
green without editing them, stop and reassess rather than adjusting assertions.

---

## 10. Phase 5 — The gutter, watchpoints, and stopping (L4)

### 10.1 The bank breakpoint gutter — ✅ **wired**

**It came out far smaller than the plan assumed**, because Phase 2's grammar did the work.
`BreakpointIndicator` builds its `bp-set` / `bp-del` / `bp-en` command from the *name* the row gives
its breakpoint, so naming a bank-relative one `05:+$0100` is all it takes — the whole toggle,
disable and remove path then runs through the commands that already exist. The change is three
pieces:

| Piece | File |
| --- | --- |
| Name a bank-relative breakpoint by its key, not the row's address | `DisassemblyRow.tsx` (`deriveDisassemblyRowViewModel`) |
| This bank's breakpoints, keyed by offset, refreshed on `breakpointsVersion` | **new** `useNexBankBreakpoints.ts` |
| Pass the row's breakpoint to `DisassemblyRow` | `StaticMemoryDump.tsx` |

Matched by `bank` + `bankOffset`, never by address: an address breakpoint that happens to fall inside
the bank's current window is not a breakpoint *on the bank*.

**One real fragility found and fixed:** the hook first depended on the `emuApi` object's *identity*.
`useEmuApi` memoizes, so the app was fine — but a caller that did not memoize would spin
effect → `setState` → render → effect. It read as a 600-second test hang. The API is read through a
ref now, and the dependency is gone.

**The harness needed two mock entries, and that is worth being precise about.** The refactor gate
(step 4d) passed with `StaticMemoryDump.test.tsx` genuinely unmodified — verified by `git diff`. The
gutter then introduced a *new* dependency (`useSelector`, `useEmuApi`) that the harness's
`RendererProvider` mock did not export, so two additive entries were added. That is a mock catching
up with a new dependency, not an assertion bent to fit a regression; how a bank-relative breakpoint is
named is covered by five tests in `DisassemblyRow.test.tsx`.

### 10.1a Sidecar persistence — ✅ **done**

Schema **2** adds the `debug` subtree, and §4.5's two-policy split is implemented as designed:

| Piece | File |
| --- | --- |
| `debug.breakpoints`, readable schemas 1 *and* 2, `readDebug` validation | `nexAnnotations.ts` |
| `saveNexAnnotationSubtree` / `saveNexDebugSubtree` — read-merge-write over disjoint keys | `nexAnnotationSidecar.ts` |
| The annotation save routed through the subtree writer | `nexAnnotationSession.ts` |
| Pure conversion both ways, plus a "has it changed" test | **new** `nexBreakpointSync.ts` |
| Install once per sidecar, write back on every change | `useNexBankBreakpoints.ts` |

**39 new tests**, 12 of them on the clobbering risk specifically: an annotation save preserves the
`debug` on disk, a breakpoint write preserves the annotations *and* does not flush unsaved annotation
edits, either order leaves both intact, and a key this build does not recognise survives a round
trip. A malformed breakpoint entry is dropped with a warning rather than failing the file — a
breakpoint nobody can place is worth less than the annotations beside it.

**Two deliberate behaviour changes**, both asserted by updated tests: a newly created sidecar declares
schema 2, and a v1 file gaining breakpoints is stamped 2 as it is written. A v1 file that is merely
*opened* is never rewritten.

### 10.1b The viewer's per-bank badge — ✅ **done**

A bank row is collapsed by default, so without it the only way to learn whether a bank holds
breakpoints was to expand every bank in turn.

| Piece | File |
| --- | --- |
| Grouping, row selection, per-bank summary, badge text | **new** `nexBankGutter.ts` |
| One shared `listBreakpoints` behind both hooks; `useNexBankBreakpointCounts` | `useNexBankBreakpoints.ts` |
| The chip in `BankHeading` | `NexFileViewerPanel.tsx` (+ its SCSS) |

Three decisions worth keeping:

- **One listing, not one per bank.** A NEX can carry a hundred banks; a hook per row would have been
  a hundred IPC calls per breakpoint change. `useBreakpointList` is shared by the gutter and the
  badges, which also means the two cannot disagree about what is armed.
- **It counts every bank-relative breakpoint in the bank, whoever owns it.** Two NEX files can both
  hold breakpoints in bank 5 (§4.4). Only one set is *this* file's, but the machine will stop at
  either, so a badge that hid the other would be telling the user something untrue.
- **Absent at zero, and the hue is borrowed from the gutter dot** rather than being a third accent.
  Recorded in `.ai/ui-theming-intent-and-lessons.md`; the badge is a fact about the debugger, not a
  third machine register.

**Gap:** there is no mount harness for `NexFileViewerPanel` — its two test files exercise the loader
only — so "the chip renders" is unverified. Everything it decides is in the pure module (19 tests).

### 10.2 Bank-scoped watchpoints — ✅ **done**

The plan called this "UI plus a kind flag", and the flag part was right: `bp-set 05:+$0100 -w`
already worked from Phase 2. Two defects stood between that and a usable feature, and the second was
mine.

#### The gutter collapsed several breakpoints at one offset into one

`useNexBankBreakpoints` keyed a `Map` by offset, so an offset carrying an execution breakpoint *and*
a write watchpoint kept whichever the emulator's list ended with — the glyph, and the command built
from it, depended on ordering. `selectBankRowBreakpoint` now decides it: execution first (the
gutter's own click creates those, so it is the kind the column is about), then enabled over disabled.

`selectRowBreakpoint` in the **live** view had the same gap, for the same reason, and gained the same
two tie-breakers below its existing partition rule. Partition specificity still dominates — that was
the defect the module was written for, and it is not traded away for a kind preference.

#### A watchpoint's name made it unremovable — and a Phase 5 test asserted the bug

`DisassemblyRow` named a bank-relative breakpoint by its **display key**, and the display key ends in
`:R`/`:W`/`:IR`/`:IW`. `BreakpointIndicator` builds `bp-set`/`bp-del`/`bp-en` from that string while
the commands take the kind as an *option*, so a bank write watchpoint produced
`bp-del 05:+$0100:W -w` — unparseable, nothing removed, a dot that could not be clicked away.

A Phase 5 test asserted exactly that string, with a comment saying the kind belonged in the name "so
a watchpoint is not confused with an exec breakpoint". It was wrong, and it is now a test for the
opposite with the reasoning written out.

The fix named a concept that was already being open-coded: **`getBreakpointAddressSpec`** — the
`<address-spec>` half of a key, which is what a `bp-*` command accepts. `BreakpointsPanel` was
already clearing the kind flags inline before calling `getBreakpointDisplayKey` to get the same
string; it now calls the named function, so there is one definition instead of two and the gutter
could stop getting it wrong. The row also now passes the kind flags themselves, which is what builds
the option.

#### Creating one: the breakpoint dialog, not a new menu

The plan assumed a gutter context menu. There isn't one — right-click on the indicator *toggles* the
breakpoint, across the whole app, and rebinding that to open a menu would have been a side effect on
the Breakpoints panel and the live view for the sake of this feature.

The dialog is the better home anyway: it is the app's canonical "make any kind of breakpoint" UI and
its **Type** selector already offers memory read and memory write. It gained the bank-relative shape,
spelled `05:+$0100` **into the address field** rather than given controls of its own — that is what
`bp-set` accepts, so there is one syntax and one parser, and a dedicated bank picker beside the
partition picker would have put two controls on screen that mean different things by "bank" (16K
banks and 8K pages), which is the confusion §4.1 exists to have settled.

So the flow is: click the pop-out gutter → an execution breakpoint on that bank offset → double-click
it → change Type to Memory write. `StaticMemoryDump` had no `onEditBreakpoint` at all, so that wiring
came with it, and `isBinaryBreakpoint` — the gate both the row and the Breakpoints panel use — now
accepts a bank-relative breakpoint, which made it editable from the panel too.

`BreakpointEnvironment.supportsBankRelative` is enforced in the pure module rather than only in the
UI: `bp-set` refuses bank-relative on any machine but the Next, and a dialog that authored one would
be creating a breakpoint the command layer rejects, through a path that bypasses that rejection.

**One harness entry needed:** `StaticMemoryDump.test.tsx`'s `RendererProvider` mock gained
`useDispatch`, which `useBreakpointDialog` reads. Additive, and the same "mock catching up with a new
dependency" as §10.1's two — not an assertion bent to fit.

### 10.3 The entry-point stop (Q5) — ✅ **done**

`getEntryPointBreakpointSite(header)` in `nexEntryState.ts` (§11.1) computes the site: the entry bank
from the start-up map, offset `header.programCounter & 0x3FFF`, and `undefined` below `$4000` — ROM
at hand-over, so there is no bank of the file to break in. `nex-run -e` arms it as a session-owned
one-shot **before** the flow, and runs without the stop (with a warning, not an error) when the entry
point is in ROM.

`-e` implies `-d`: stopping at the entry point without debugging is not a thing, and accepting the
combination would have created a flag that silently does nothing. The Explorer menu and the document
tab bar both gained a third item for it.

#### ⚠ Step 3's premise was too broad, and the fix is narrower than planned

The plan said to run *the whole flow* with user breakpoints suppressed, "replacing today's blanket
`NoDebug` during `Start` steps". That would have been a behaviour change for no gain: the flow
already starts the machine in `NoDebug`, and **the per-instruction callers skip the breakpoint
decision entirely in that mode**, so no user breakpoint can fire during the flow whatever the flag
says. (`run()` does attach `debugSupport` to the context even in normal mode, so the flag alone is
not what protects it.) The `Start` step's own comment already documents the keystroke hazard as the
reason it starts in normal mode.

The window that *is* unprotected is the one the flow ends with: for the Next, debug is armed while
the machine is still running and `.nexload` may be half-typed
(`MachineController.ts`, the `state === Running` branch). So suppression is scoped to exactly that:

- `DebugSupport.suppressUserBreakpoints` gates `shouldStopAt`, letting only session-owned
  breakpoints through;
- `MachineController.suppressUserBreakpointsUntilKeystrokesLand` sets it when debug is armed in
  place and lifts it on the **first** of: the keystroke queue draining (`getKeyQueueLength() === 0`,
  the hazard's actual lifetime), the machine leaving `Running` (it paused — very likely *at* the
  entry stop), a newer machine operation, or a 10s backstop. Every exit lifts it, so there is no
  path on which it outlives the flow and silently disarms the user's breakpoints.

It is deliberately **not** applied to the `startDebug` branch: that branch starts a stopped or paused
machine, nothing is in flight, and a window opened there would be closed by the first poll (state is
not `Running` yet) rather than by the keystrokes landing.

#### Session-stop lookup: derived, not cached

The first cut kept a `Set<number>` of session-owned addresses maintained alongside the flags, for an
O(1) hot-path test. It was wrong in a way tests caught: it was not updated on removal or on
`enableBreakpoint`, and — the case that matters — when a user breakpoint and a session one share an
address, a set keyed only by address answers "session" for both and lets the user's fire after all.

`hasSessionStopAt` derives the answer from the definitions instead. The scan is affordable because it
runs only while suppression is set (seconds) **and** only at an address whose flags already say a
breakpoint is there. A cache would have to be invalidated at eleven places, and a missed one fails in
the worst direction: a breakpoint that silently stops mattering.

### 10.4 Run to cursor — ✅ **done**

A session-owned one-shot, **not** `UntilExecutionPoint`, whose `terminationPartition` no machine
reads (`Z80NMachineBase.ts:542`) and which forces the per-instruction debug loop.

`RunToCursorCommand` (`run-to`, alias `rtc`) extends `BreakpointWithAddressCommand`, so it inherits
`bp-set`'s address grammar whole — including `<bank>:+<offset>`, which is what makes it work on a NEX
bank that is not paged in yet. It drops `-r`/`-w`/`-i`/`-o`/`-m` from the option list: "run until this
is read" is a watchpoint, not a cursor, and leaving them in would have accepted flags it then ignored.

Machine state decides what "run" means, and one case has to be refused:

| State | Behaviour |
|---|---|
| Paused | arm, then resume with `debug` |
| Stopped / none | arm, then start with `debug` |
| Running **in debug** | arm only — `run()` returns immediately for an already-running machine, so resuming would be a no-op |
| Running in normal mode | **refused.** Nothing checks breakpoints in `NoDebug`, and this command cannot switch a running machine into debug mode, so arming would leave the user waiting for a stop that can never come |

**UI.** A `Cmd`/`Ctrl`-click on the breakpoint gutter indicator, documented in its tooltip beside the
right-click and double-click hints. That one handler gives the gesture to both the live Disassembly
view and every popped-out NEX bank, because both render `DisassemblyRow` → `BreakpointIndicator`, and
it reuses `addrLabel` — the same display key the breakpoint gestures build their commands from, which
Phase 5 already made carry `<bank>:+<offset>`. Plain click on the gutter did nothing before, so this
adds a gesture rather than overloading one.

*Follow-up:* a row context menu is the better home, and the live Disassembly view has no row menu at
all today. The modifier-click is deliberately the cheap version; it should not be the last word.

### 10.5 Tests

Done:

- `test/renderer/nexEntryState.test.ts` (16) — the start-up map and the entry site from synthetic
  headers, including bank 0 at offset 0, an entry point in ROM, and the one case the extraction made
  visible: when the entry bank *is* bank 5 or 2, the bank is paged in twice, so bank→address is not
  a function and `getDefaultDisassemblyOffsetForBank` has to pick (it picks the entry window).
- `test/commands/NexLaunchCommand.test.ts` (+8) — `-e` arms a session-owned one-shot at the right
  bank and offset, before the run; implies `-d`; runs anyway for a ROM entry point; refuses a file
  whose header will not parse rather than starting a debug run that can never stop.
- `test/commands/RunToCursorCommand.test.ts` (12) — the grammar, the arm-before-resume order, and
  each of the four machine states.
- `test/debug/BankRelativeBreakpoints.test.ts` (+9) — suppression: a session breakpoint fires, a user
  one does not, including when they share an address; removal and disabling are followed; a scoped
  reset does not break it.
- `test/emu/debug-step-decision.test.ts` (+4) — a one-shot is spent at the address the machine
  actually stopped at, and **not** on the re-trigger the `lastBreakpoint` guard refuses (consuming
  there would delete a one-shot that never fired).

Also done, for §10.1b and §10.2:

- `test/renderer/nexBankGutter.test.ts` (19) — grouping, the row-selection order, the per-bank
  summary and the badge text, including "absent at zero" and an I/O breakpoint that claims a bank.
- `test/renderer/breakpointRowMatch.test.ts` (+7) — the live view's kind and enablement tie-breakers,
  and that partition specificity still dominates them.
- `test/debug/breakpoint-form.test.ts` (+41) — the dialog's bank-relative parsing, both conversions,
  the round trip, every validation rule, and a cross-check that the dialog and `bp-set` derive the
  same bank and offset from the same text.
- `test/controls/DisassemblyRow.test.tsx` (+7) — the kind flags reach the indicator, and the name it
  is given carries no kind suffix.

Still to do: a component test that a gutter click issues the right breakpoint. That and the badge's
rendering are verified in the running app — `NexFileViewerPanel` has no mount harness, and
`StaticMemoryDump`'s does not simulate a gutter click.

**Gate:** set a breakpoint in a popped-out bank, launch, and stop there — the feature's actual
acceptance test. Plus: break at entry works on a NEX whose entry bank is bank 0 (which Phase 0 made
possible at all).

---

## 11. Phase 6 — The paused machine (L4, core scope per Q7)

### 11.1 Extract the entry-state map — ✅ **done** (as a Phase 5 prerequisite)

`getDefaultDisassemblyOffsetForBank`, `getMappedBankForAddress`, `getProgramCounterBank`,
`getStackPointerBank` (`NexFileViewerPanel.tsx:562-610`) are the canonical NEX entry-state map and are
trapped in a React panel. Move them beside `nexFileLoader.ts` as pure functions with node tests.

Done: `nexEntryState.ts` holds them plus the slot constants and the new `getEntryPointBreakpointSite`,
with `nexEntryState.test.ts` covering them. `NexFileViewerPanel.tsx` imports them.

### 11.2 Where is this bank right now? — ✅ **done**

The pop-out header carries a readout: `Bank at $8000`, or `Bank not paged in`, with the 8K slot
numbers in its tooltip. `nextBankLocation.ts` decides it; `useNexBankLocation` feeds it through
`useEmuStateListener` — the ticker the register panels use, which reports immediately on a pause and
throttles while the machine runs, exactly the cadence this wants.

Three things the implementation had to settle that the one-line plan did not:

- **The answer is a *list*, not an address.** The Next's MMU is eight independent 8K slots, so a 16K
  bank is two pages that the hardware does not require to be adjacent, in order, or both present.
  The formatter collapses only the ordinary contiguous case to one address and spells out everything
  else — a bank with one half paged in is precisely when the user needs telling, and it is what
  `bankRelativeAddresses` arms eight addresses for.
- **Match on `bank8k`, never `bank16k`.** On the WASM Next `bank16k` is filled from the partition
  index, which after Q9 *is* an 8K page — the field's name and its contents disagree. `bank8k` is
  the MMU register's own value.
- **A slot only counts when it is writable.** A ROM'd slot's MMU register still holds whatever was
  last written to it, so matching on the register alone would announce a RAM bank at an address
  where the ROM is. That is worse than "not paged in", because the user would go and look.

The readout also says, in its tooltip, that a paged-out bank's breakpoints stay armed and will fire
once it is paged in — which is the §4.6 subtlety this item exists to stop being a surprise.

**Two harness entries needed** in `StaticMemoryDump.test.tsx`: `getCpuStateChunk` and
`getNextMemoryMapping`. Without the first, every test in the file logged an unhandled rejection —
passing, but with 25 errors in the output that would have hidden a real one.

### 11.3 Live-vs-file view, and the diff — ✅ **done**

A **Live** switch in the popped-out bank's memory view, with the changed bytes marked in the dump
and counted in the header. `nexLiveBank.ts` holds the logic, `useNexLiveBankBytes` the reads,
`MemoryDumpSection` gained a `changedBytes` prop.

Four things the plan did not anticipate:

- **A bank does not have to be paged in.** The plan said "reading `getMemoryPartition(bank)` when
  the machine is paused", but the emulator reads a partition straight out of the Next's RAM, and a
  NEX's banks are all in RAM from the moment the loader put them there. So the live view answers for
  *every* bank of the file, paused or running — which is the more useful behaviour, since a bank the
  program has finished with and paged out is exactly the one whose leftovers you want to see.
- **A bank is two reads.** A Next partition is 8K; `getMemoryPartition` returns `0x2000` bytes for
  any non-negative index. So a 16K bank is partitions `2B` and `2B+1` — Q9's pairing again, and
  `joinBankHalves` refuses a half of the wrong size rather than zero-padding, because a short bank
  compared against the file reports every byte past the join as changed.
- **The diff is not a separate mode.** The plan called for "a diff mode"; it is a property of the
  live view instead. There is nothing a third mode could show that Live-with-marks does not, and a
  mode the user has to find and switch into is worse than a highlight that is simply there.
- **It was the memory view only, and that has since been undone — see §11.3a.** The reasoning at the
  time: live disassembly would be the most valuable half — a bank that decompressed itself is
  precisely the case — but it could not be had by swapping the array, because the annotation editor
  owns a listing derived from the *file's* bytes and was believed to address its actions by **row
  index**. Live bytes disassemble to different instruction lengths, so the two listings would drift
  apart and the row menu would act on a line the user did not click.

**Two efficiency points worth keeping.** The reads were gated on the switch, so an open bank document
cost nothing until someone asked for live bytes — whether the switch could be *offered* was answered
by the location readout (§11.2), which the header needs anyway. (The switch is gone; the gate is now
that same location readout — see §11.3a.) And `changedFlagsIn` returns `undefined` for a row with
nothing changed, so an untouched bank allocates nothing and draws no overlays across its 2048 rows.

**One trap found:** `MemoryDumpSection` has **two** hand-written memo comparators on the same path,
and a prop missing from either means a row that keeps a stale rendering. Both now check
`changedBytes`; without it, switching between live and file bytes would leave the previous source's
marks on every row whose bytes happened to be identical in both.

### 11.3a No switch: the bank shows the machine — ✅ **done**

§11.3's switch is gone, and both views — memory *and* disassembly — are built from the machine's
bytes whenever there is a machine to ask. The file's bytes are what a popped-out bank falls back to,
not what it defaults to.

**Why the switch had to go.** A popped-out bank is opened to debug a program, and for that the bytes
that matter are the ones the Z80 will execute. Putting that behind a control made the debugger's most
useful view the one you had to know to ask for, and left every listing ambiguous until you checked
where the switch was sitting.

**Why the row-index objection did not survive contact.** §11.3 withheld live bytes from the
disassembly because the annotation editor was thought to address rows by index. It does not: a row
resolves through the item it rendered — `item.annotation?.bankOffset`, falling back to
`listedBankOffset(item.address, …)` — so it acts on the offset of the row that was *clicked*,
whichever byte array produced the listing. There is only one listing, so there is nothing for it to
drift against. And what the sidecar stores is bank offsets; a bank is 16K read from the file or out
of RAM, so its regions go on meaning the same thing. Only the instructions decoded inside a region
change, which is the point.

**Alignment at the program counter.** A linear decode is only as well-aligned as the offset it
started from, and self-modifying code, a jump table, or a decompressed payload can make it wrong for
the rest of the bank. A paused Z80 sits between instructions, so PC is the one offset in the bank
where the alignment is *known*. `pcAnchoredRuns` therefore cuts a `disassemble` run in two at PC and
decodes each half separately, so the rows from PC on are the instructions that will actually run.

Three properties worth recording:

- **An already-aligned listing is untouched.** The first run ends at `anchor - 1` of its own accord
  when PC was already a boundary, so the halves rejoin exactly as before. Without that, stepping
  through ordinary aligned code would reshuffle the listing on every step.
- **The seam is honest rather than tidy.** Where the old alignment *was* wrong, the instruction
  straddling PC is still emitted by the first run, so its bytes overlap the row beneath it. That
  overlap is the disagreement between the two decodes, and hiding it would hide the thing worth
  noticing.
- **Only `disassemble` regions are cut.** A region the user declared `bytes`, `words` or `skip` is a
  statement about what those bytes *are*; the program counter passing through it does not make it
  code.

PC anchoring only applies while paused, because `useNexBankPcOffset` only answers while paused — for
§11.4's reason, which is unchanged: a spotlight fed from a running machine's ticker lands on an
essentially arbitrary instruction and looks authoritative. So a running machine gets live bytes in
both views and no anchor; a paused one gets live bytes, the anchor, and the spotlight.

**What replaced the switch in the header.** A quiet `Live` readout, in both views now, next to the
existing diff badge. The state still has to be announced — a listing built from RAM and one built
from the file look identical until they differ — but it is a label rather than a control, because it
is the ordinary state whenever a machine is running rather than something the user did.

**The efficiency gate moved rather than vanished.** Reads are gated on `bankPlacements` being
non-undefined, which is true exactly when a ZX Spectrum Next is there with this bank in it and the
machine answered — the same question that used to decide whether the switch could be offered.
`useNexLiveBankBytes` additionally keeps its array identity when the bytes have not moved
(`sameBankBytes`), which matters far more now than it did behind a switch: the disassembly is keyed
on those bytes, and a fresh 16K array every tick would re-disassemble an idle bank several times a
second.

**Still open — annotation editing over a changed bank.** §11.3's follow-up asked for annotation
editing to be disabled while live bytes show. That is not implemented, and "whenever live" is now far
too broad a condition to disable it on: it would mean no annotating while debugging, which is when
annotating is most wanted. The narrow hazard is real but smaller — a bank whose live bytes *differ*
from the file (the diff badge is exactly this signal), where an annotation derived from a
decompressed payload would be written into a sidecar that describes the compressed file. The
candidate rule, if it is wanted, is to gate editing on `bankDiff.changed > 0` rather than on
liveness. Left undecided deliberately.

### 11.4 Follow the PC — ✅ **done**

The popped-out bank's disassembly spotlights the program counter's line, using `DisassemblyRow`'s
existing `pausedPc` prop — the same mark the live Disassembly view draws, which the pop-out had been
passing `-1` for since it was written.

- **`bankOffsetOfAddress` is the inverse of §11.2's `locateBank16k`**: not "where is the bank" but
  "is *this* address in it", answered from the placements the header already fetches. It costs one
  cheap CPU-state read per tick and nothing else.
- **Paused only, and that is the design rather than a limitation.** The pop-out is a listing of one
  bank, which does not change as the machine runs, and the state ticker samples once or twice a
  second while running — so a spotlight fed from it would land on an essentially arbitrary
  instruction while *looking* authoritative. A mark that is wrong but confident is worse than no
  mark.
- **The mark is numbered by the listing, not by the machine.** `pcSpotlightAddress` adds
  `disassOffset`, because the offset dropdown decides whether this bank's byte 0 reads `$0000` or
  `$C000` and the row compares its own displayed address. It is a named function rather than an
  inline expression for one reason: `disassOffset + (pcOffset ?? 0)` reads as an equivalent
  simplification and would spotlight the first row every time the PC was somewhere else.
- **The header announces it.** `formatBankLocation` gained a `· PC` marker and a sentence naming the
  offset. Without it the spotlight is only discoverable by scrolling until you find it, and "the
  program is executing in this bank right now" is the most consequential thing that header can say.

No follow-PC *scrolling*, deliberately: the toolbar is already carrying seven controls, and the Go To
box takes the address the header now shows. Worth adding if the scrolling turns out to be missed.

### 11.5 Bank provenance in the Memory Mapping panel — ✅ **done**

Each page row's tooltip gains a line naming the launched NEX, when the bank in that slot is one the
file declares. `LaunchNexCommand` records the file and its banks; `nexLoadSession.ts` holds the
record and the wording; `MemMappingPanel` reads it on its existing refresh tick.

#### The claim had to be weakened to be true

The plan's wording was "from `Game.nex` bank `$20`", which reads as a statement about the slot's
*current contents*. That cannot be known: **RAM has no provenance.** Nothing in the machine records
that a bank was written by a NEX loader rather than by the program, by a tape, or by another NEX
loaded afterwards — and the program is free to have overwritten it, which is exactly what §11.3
exists to show.

So the line is a fact about the **file**: *"This is one of Game.nex's banks, as launched — the
program may have changed it since."* Same navigational value (it tells you which pop-out to open)
without asserting something unverifiable. This follows §11.4's own rule: a mark that is wrong but
confident is worse than no mark.

I considered and rejected real invalidation — clearing the record when the machine stops, since a
stop wipes RAM. Every mechanism for it was worse than the weaker wording: a view clearing global
state on what it happens to observe, or a generation counter the emulator would have to maintain for
one tooltip line. The record *is* cleared when a launch cannot read its file's header, because
attributing the new program's banks to the previous file is the one outcome that would be actively
misleading.

#### Two structural consequences

- **The header is read on every launch**, not only for `-e`. The banks it declares are the whole
  input to this. The cost is a second read of a file `copyToSdCard` has just read and written in
  full, so it is marginal against what the command already does — and the two reads are now one
  method (`readNexHeader`) feeding both the provenance record and the entry stop, instead of the
  entry stop owning the only read. A test that asserted the file was *not* read without `-e` now
  asserts the opposite, with the reason written in it.
- **A module singleton, not app state.** The panel already refreshes on the emulator's state ticker,
  so re-reading the record there makes it current without a subscription; `nexAnnotationSession` and
  `useNexBankBreakpoints` use the same pattern. Both the command and the panel are in the IDE
  renderer.

#### The `allRamsBanks` mismatch — ✅ **fixed**, and the CHANGELOG was claiming it early

`CHANGELOG.md` has listed "The Memory Mapping panel's all-RAM readout was always empty" under Fixes
since `0daba60bd`, but the code still had the mismatch: the type and the panel said `allRamsBanks`
while both producers wrote `allRamBanks`. The entry described an intention, not a change. It is true
now.

TypeScript could not catch it because the producers build the object as a literal for a
structurally-typed target, where an unknown extra property is only rejected on a *direct* literal
assignment.

Renaming it exposed a second half: `ZxNextWasmV2Machine` hardcoded `allRamBanks: undefined`, so the
row would still have read `Off` on the machine people actually run. The four-configuration table
moved out of `MemoryDevice` into a pure `allRamBanksFor(port1ffdValue)` that both machines call —
the WASM one already normalises NextReg `$8E` into that same `$1FFD` encoding via
`getWasmV2Port1ffdValue`, so it had the input all along.

`test/wasm/zxNext/wasm-next-full-matrix.test.ts` — a guard that every `test/zxnext/` suite is
accounted for in the WASM coverage matrix — failed on the new test file until it was declared. It
was right to: the entry now records *why* there is no separate WASM suite (the function is pure, so
only `$8E`'s conversion is machine-specific, and `wasm-next-memory-mmu.test.ts` owns that).

#### A second defect found here: the panel's "16K bank" column held an 8K page

Investigating §11.2 turned this up. `ZxNextWasmV2Machine.getMemoryMappings` filled `bank16k` from
the partition index, which **after Q9 is an 8K page** — and `bank8k` is the same number, so on the
machine people run the page rows printed one value twice with the second labelled "16K bank" in the
tooltip. The interpreted `MemoryDevice` had always reported `bank8k >> 1`.

`bank16kForPartition` is now the shared derivation, and the project's own documentation states it
independently: *"The 16 KB bank number is simply `MMU6_page >> 1` (pages are paired as 2N / 2N+1 per
bank)"* (`docs/content/book/03-memory.mdx`). Negative partitions pass through unchanged (the panel
renders anything negative as `--`, which is better than the interpreted machine's `0xff` → `FF` for
the same case — a residual inconsistency between the two machines, left alone rather than changed as
a side effect of this).

This is also what makes the provenance line useful: the row now shows the real 16K bank next to it.


**Gate:** with a NEX paused, the pop-out says where its bank is, shows live bytes, and marks what
changed — **met**. **Phase 6 is complete**: §11.1 through §11.5 are all in.

Two defects in the Memory Mapping panel fell out of this phase rather than being planned for it (the
`allRamBanks` mismatch on both halves, and the `bank16k` column holding an 8K page). Both were found
by reading the code §11.2 needed, which is the argument for doing the "where is this bank" work
first: it forced a careful read of the one API that answers it.

---

## 12. Phase 7 — Pre-launch validation — ✅ **COMPLETE**

`nexValidation.ts` is the pure function, `nexValidation.test.ts` the table-driven test, and
`NexValidationPanel` renders the result above the annotation banner — as planned.

### Six rules, and which of the plan's checks survived contact

| id | Severity | Fires when |
| --- | --- | --- |
| `entry-bank-missing` | error | the file does not contain the bank it names as its entry bank |
| `entry-point-bank-missing` | error | the entry point runs from bank 5 or bank 2 and the file does not contain that bank |
| `entry-point-in-rom` | error | the entry point is below `$4000`, which is ROM at hand-over |
| `stack-in-rom` | error | the stack pointer is below `$4000`, so pushes are discarded |
| `core-too-old` | warning | the file asks for a newer core than the emulator reports |
| `bank-count-mismatch` | warning | `numOf16KBanks` disagrees with the bank flags beside it |

Two of the plan's checks needed a decision the plan had not anticipated:

- **`fullRamRequired` against the machine's RAM cannot fire.** The Next has no configurable memory
  size: `MF_BANK` is 224 unconditionally and `MemoryDevice` allocates 2MB regardless, so the flag's
  1792K demand is always met. The rule is implemented anyway, driven from
  `NexValidationContext.bankCount` rather than read from the machine inside the module, and it is
  exercised only by a synthetic context — because the side that could change is the *machine's*
  capability, not the file's demand. This is written down rather than left for someone to discover
  when the test looks unmotivated.
- **"`programCounter` inside a bank the entry state actually maps in" is two rules, not one.** An
  entry point at `$4000` or `$8000` runs from bank 5 or bank 2 rather than from the entry bank, so a
  file can name a perfectly good entry bank and still begin executing in a bank it does not carry.
  The two are reported separately, and the second declines to fire when the entry point *is* in the
  entry bank — otherwise an absent entry bank would be stated twice in a banner that has one line.

Plus one the plan did not list: `bank-count-mismatch`. It breaks nothing by itself (the loader reads
banks by their flags) but it means the file disagrees with its own header, which is worth knowing
before trusting anything else in it.

### The emulated core version had no reader

`CORE_VERSION_MAJOR`/`MINOR`/`SUB_MINOR` were module-private constants in `NextRegDevice.ts`, read
only by the two NextRegs that report them. They are exported now, with `EMULATED_CORE_VERSION` as
the tuple the validator compares against; `NextRegPanel` already imports values from that module, so
the renderer reading them is the established direction rather than a new one.

Note that the check skips a requirement of `0.0.0`, which is what most NEX files carry — treating
"no requirement" as "requires nothing" rather than comparing it.

### Findings

- **The viewer's own test fixture is an invalid NEX.** `createNexWithBank5` declares bank 5 and
  leaves the entry bank, the program counter and the stack pointer all at zero — so the new banner
  reports three problems for it. That is the validator working, and it makes the fixture a good
  demonstration; a second test corrects all three and asserts the banner then says nothing, which is
  the half more easily broken.
- **`machineService` was absent from the viewer's harness**, and reading it unguarded took the whole
  panel down in those tests. Fixed both ways: the lookup is optional-chained (one absent service
  should not lose the document), *and* the harness now provides the real ZX Next feature counts, so
  the tests exercise the comparison rather than skipping it.

---

## 13. Phase 8 — Annotations as live symbols, and label-anchored breakpoints

The largest and least certain group; last for that reason.

> ### Status: §13.4 done, plus a prerequisite that was not in the plan
>
> **§13.4 is complete** — and getting to it uncovered **six** defects in `DebugSupport`'s flag
> maintenance, five of them fixed here as a prerequisite (§13.0 below). §13.1, §13.2 and §13.3 are
> **not started**; they are features, and the flag work turned out to be the load-bearing part of
> the phase. §13.2 in particular should not be built on the old foundation: it adds a *second*
> writer of resolved data, and the first one exposed how little of that path worked.

### 13.0 Prerequisite: one flags word, one authority

`breakpointFlags[address]` is shared by every breakpoint at that address, and four places mutated it
as though each owned it. Each was wrong differently, and every failure was silent:

| Site | What it did | Consequence |
| --- | --- | --- |
| `addBreakpoint` | `= bpFlags` | a plain breakpoint added at an address a bank-relative one had armed erased its `PART_BP`; removing it later killed the bank breakpoint for good |
| `resolveBreakpoint` | `= EXEC_BP` | a source breakpoint resolving onto a bank breakpoint's address disarmed it |
| `resetBreakpointResolution` | deleted the field, left the flags | a rebuild that moved a line's code left the machine stopping at the **old** address as well as the new one — a phantom breakpoint with nothing in the panel to explain it |
| `removeBreakpoint` | `&= ~bpFlags \| PART_BP` | cleared bits another breakpoint at the same address still wanted |

A bank-relative breakpoint occupies **eight** addresses, so a collision is eight times likelier than
it looks. `refreshFlagsAt(address)` now derives the word from the definitions — the only approach
where this cannot be got wrong — and the four sites call it. The "disabled" marker is decided *per
kind*, from whether every contributor is disabled, so a disabled breakpoint cannot mask an enabled
one sharing its address.

Deriving the flags then exposed three more, because a derived answer is only as good as what it
derives from:

- **`addBreakpoint` dropped `disabled` and `hitCount`** when it rebuilt the stored definition field
  by field. Survivable while the flags came from the *incoming* breakpoint — only `listBreakpoints`
  was short, which is why the breakpoint dialog never showed a hit count — but fatal once the flags
  are derived: a breakpoint added disabled would have come out armed. Both fields are carried now.
- **`addPartitionEntry` hardcoded its entry as enabled**, so a partition-scoped or bank-relative
  breakpoint *added* disabled was armed. Every caller covered for it by calling `enableBreakpoint`
  afterwards — `applyBreakpointEdit` and `resetBreakpointsTo` both do, and both say in a comment
  that they must. That is how a defect survives: the workaround sits in the two paths anyone would
  test through.
- **`collectBpFlags` withheld `EXEC_BP` for a `resolvedPartition` but never granted `PART_BP` for
  one**, so a breakpoint carrying only a resolved partition got no execution flag of either kind and
  could never fire. Invisible until §13.4 gave `resolvedPartition` its first writer — which is
  exactly what the plan said about the consumer side being "already written and idle". It was half
  written.

`test/debug/BreakpointFlagIntegrity.test.ts` (18) pins all of it; each case failed before its fix.
The rest of the suite — 245 breakpoint tests across ten files — passed unchanged throughout, which is
the evidence that deriving the flags preserved semantics rather than quietly redefining them.

### 13.1 Labels as live symbols — ◐ **operand names in the live view; panels and regions owed**

In: a NEX's hand-made labels now name operands in the live **Disassembly** view. Owed: the Watch and
Call Stack panels, and using the sidecar's `bytes`/`words`/`skip` regions to stop the live
disassembler decoding data as code.

#### The plan named the wrong hook

"The hook already exists (`zx-spectrum-next-disassembler.ts`, installed via
`setCustomDisassembler`)" — it does, but it is the hook for *taking over instruction decoding*, and
`IDisassemblyApi` can neither name a label (`createLabel(address)` takes no name) nor learn which
bank is paged in. Naming ordinary instructions through it would have meant re-implementing Z80
decoding just to reach the point where a name could be attached.

The hook that fits is **`DisassemblyOptions.operandLabelResolver`**, which the annotated pop-out
listing already uses. So the live view gets the same mechanism the pop-out has, rather than a second
one.

#### The inverse of the paging map

`nexLiveSymbols.ts` is pure and holds the whole decision:

- `bankSiteAtAddress` inverts `resolveMem64kPartitions` — a slot's **8K page** halves to the 16K
  bank, and the page's low bit says which half, which is the one bit that has to be recovered
  because offsets within an 8K page and within a bank's half are the same number. Negative pages
  (ROM, alt ROM, DivMMC) are not the NEX's banks and name nothing.
- `findNexLabelForAddress` compares a **global** label against the address as given (its value is a
  16-bit address, so it means the same whatever is paged) and a **local** one against the bank
  offset — so a local name appears and disappears as the program pages, which is the behaviour worth
  having.
- Global wins a tie: it names one place in the address space, where a local label names a place in
  a bank that could be anywhere.

#### A cycle, and why the parameter is a factory

The first wiring passed a finished resolver from the panel. That is a **cycle**: naming a local label
needs the current paging, the paging arrives with the memory read `useDisassemblyRefresh` performs,
and the panel derives `mem64kPartitions` from what the hook *returns*. TypeScript caught it as
"used before its declaration", which was the shallow symptom of a real ordering problem.

Breaking it from the outside would have meant naming from the *previous* refresh's paging — wrong for
exactly the case the feature exists for. So the parameter is `operandLabelSource`, a factory over the
paging: the caller supplies the symbols (a document-level concern the hook knows nothing about) and
the hook supplies the paging, fresh from the read it just did.

#### Two things worth recording

- **The annotations source is a module singleton read during render.** `useLaunchedNexAnnotations`
  reads §11.5's load session, whose identity changes only when a NEX is launched, and this panel
  re-renders on the disassembly refresh tick — so a launch is picked up within a tick. A
  subscription for a value that changes once per launch would be machinery for its own sake; the
  Memory Mapping panel reads it the same way.
- **`nexAnnotationSidecar` drags Monaco into any test that imports it.** It does file IO *and* path
  helpers, and the helpers import `project-node` as a value, which reaches the editor. Nine
  `DisassemblyPanelRefactor` tests failed with `document.queryCommandSupported is not a function`
  the moment the panel's import graph touched it. Mocked in that harness for now; the real fix is to
  split the IO out of that module, which has its own tests and several importers and deserves its
  own change.

A `ICustomDisassembler` for the Next resolves live addresses through the annotations of whichever bank
is paged in, so hand-made names appear in the live Disassembly view, the Watch panel and the Call
Stack panel. The hook already exists (`zx-spectrum-next-disassembler.ts`, installed via
`setCustomDisassembler`). Sidecar `bytes`/`words`/`skip` regions also stop the live disassembler
decoding data as code.

### 13.2 Label-anchored breakpoints (Q3) — ◐ **mechanism done, two entry points owed**

In: the fields, the key notation, the resolution, the arming, and the sidecar-driven resolver.
Owed: the `bp-set` grammar and a UI affordance for *creating* one.

#### Identity is the label; the site is only ever resolved

The rule the whole shape depends on. `buildBreakpointKey` gained a **first** branch — before address
and bank — that reads only the *stated* fields, so a rebuild that moves `DrawSprite` leaves the key
alone. Keying it by where it resolved to would change its identity every time the code moved, which
is the one thing it exists not to do.

`effectiveBankSite(bp)` is the bank-relative twin of `address ?? resolvedAddress`, and the single
place that fallback lives: the arming, the partition test and the one-shot consumption all go
through it and none of them can tell a stated site from a resolved one. It takes the pair
**atomically** — for a label-anchored breakpoint `bank` is the *scope its name was looked up in*,
not a site, so mixing a stated bank with a resolved offset would be reading two different things as
one.

Resolution follows §13.2's rule exactly: a **local** label's value is bank-relative so it resolves
to a bank site; a **global** label's is a 16-bit address so it resolves to an address. The scope is
taken from the breakpoint rather than searched for — `Shared` can be both a global label and a local
one, and preferring one would make the two breakpoints the same whenever only one label existed and
then silently different once the other was added.

#### A pre-existing defect this uncovered: `resetBreakpointsTo` never replaced anything

`breakpointMatchesScope` takes a `BreakpointScope` **object**. Passed the bare string `"project"` it
fell off the end of its switch and returned `undefined` — falsy — and `resetBreakpointsTo` reads the
predicate to decide what *survives*. So every breakpoint survived and the replace quietly became an
append.

It hid because a breakpoint's key normally implies where it is armed: re-adding the same key
overwrote the definition, and the duplicate *arming* was invisible. Label-anchored breakpoints
separate identity from site, which is what exposed it — as a breakpoint still firing at the address
its label had moved away from.

Three **test** call sites were passing the string; `build:check` does not type-check `test/`, so
nothing told them. One of those was this session's own "survives a scoped reset" test, which was
therefore passing for the wrong reason. All three now pass objects, and the switch has a `default`
that throws: a closed union deserves an exhaustiveness guard precisely because the silent branch is
this expensive.

#### Persisted in their own field

`toSidecarBreakpoints` skips label-anchored breakpoints outright: a *resolved* one has an effective
bank site, so anything keyed off `isBankRelative` would store it as a bare bank and offset — losing
the label that is its identity and reloading as a breakpoint that follows nothing.

They live in `debug.labelBreakpoints` instead, storing the label, the bank for a local one (absent
means global), the kind and the disabled flag — **and no offset**, which is the point: the label is
the anchor and resolution finds where it points. They are restored **unresolved** and arm nowhere
until `resolveLabelBreakpointsFor` runs against the loaded annotations, the same sequence a source
breakpoint follows before its list file is read.

An additive field within `debug`, not a schema bump: bumping to 3 would make a build reading only
`[1, 2]` reject the whole file and lose access to the annotations too — much worse than losing
these. The cost is worth stating plainly: `readDebug` rebuilds the subtree from the keys it knows, so
a **previously shipped** build that opens such a file and then changes a breakpoint will drop these
entries. Nothing here can fix that, since that build already exists.

**One bug found writing it.** `saveNexDebugSubtree` decided the subtree was empty from
`breakpoints` alone, so a sidecar whose only debug state was a label breakpoint had its `debug` key
deleted. It counts both halves now, and omits each when empty so a file with one does not carry an
empty array for the other.

#### Original plan

A third binding mode: "break at `DrawSprite` in bank `$20`", resolved through the sidecar's label
table as a source breakpoint resolves through the compiler's list file — and surviving a rebuild that
moves code within the bank, which no offset-based breakpoint can.

The consumer side is already written and idle: `resolvedPartition` is read in five places in
`DebugSupport` (`:256`, `:273`, `:332`, `:387`, `:593`) and **written nowhere**. This phase gives it
its first writer, and adds `resolvedBankOffset` plus a partition on `ResolvedBreakpoint`.

Resolution rule: a **local** label's value is bank-relative, so it resolves to a bank-relative
breakpoint; a **global** label's value is a 16-bit address, so it resolves to a plain address
breakpoint. Keys are file-qualified (§4.4, §4.7).

### 13.3 Promote a discovery into an annotation — ✅ **done** (as a command)

`nex-label <name> [<address>]` (alias `nl`) names the address the machine is stopped at, in the
launched NEX's annotations. `nexLabelPromotion.ts` holds the decision; the command supplies the
address, the paging and the write policy.

**Phase 8 is now complete** in the sense that all four sub-items have landed; what each still owes
is listed under it.

#### Always a local label

The address is only meaningful as "offset X in bank B" — the same routine sits at a different Z80
address the next time its bank is paged elsewhere, which is exactly what a local label expresses and
a global one does not. Which bank is read from the live mapping at the moment of naming, through
§13.1's `bankSiteAtAddress`, and refused if the launched file does not declare it: a label written
into annotations for code that is not this file's would be worse than no label.

#### Paused, or told where

Naming "where we are" on a running machine names an arbitrary instruction, for the same reason
§11.4's spotlight only shows while paused. So the command requires a pause *unless* an address is
given explicitly — which also makes it useful from a script.

#### The write policy is §4.5's, and the interesting half

With a **viewer open**, the edit goes into the annotation session and inherits "written when you
ask": its copy may carry edits the user has not saved, so reading the file instead would drop them,
and writing the file *with* them would flush edits they have not finished. With **no viewer**, there
is nothing in memory to conflict with and the file is read, changed and written through
`saveNexAnnotationSubtree` — which also means a breakpoint set since the file was read survives.

That distinction needed a `peekNexAnnotationSession`: a one-shot command wants to know whether a
session exists, not to subscribe to one.

#### Two smaller findings

- **`DEFAULT_REGION` is now exported.** Promoting into a bank the sidecar does not describe has to
  create the entry — `withLabelChange` declines for a bank it cannot find, and losing the label is
  the worst of the three options. Creating it with the same default a new sidecar uses is better
  than this module inventing its own idea of an empty bank.
- **The result type is not a discriminated union**, because the project compiles with
  `strictNullChecks: false` and TypeScript will not narrow one by a boolean literal — so
  `if (!result.ok) return result.error` does not compile. `NumericParseResult` in
  `breakpoint-form.ts` already documents this and uses optional members; this follows it. The
  compiler caught the attempt, which is the system working.

#### Owed: an affordance in the UI

A command, not a menu item. The live Disassembly view still has no row context menu (§10.4), and
adding one to place a single item is the wrong order — the same reasoning that made run-to-cursor a
gutter gesture. When that menu exists, "Add a label here" belongs in it and should call this
command.

### 13.4 Source breakpoints carry the compiler's bank — ✅ **done**

The join was there to be made: `ListFileItem.segmentIndex` indexes `compilation.result.segments`,
and `.bank N, offset` records `bank`, `bankOffset` and `startAddress` on the segment. Nothing joined
them, so the partition was discarded and a breakpoint on a line in one `.bank` section fired inside
another — both are assembled at the same Z80 addresses, which is the point of `.bank`.

`resolvedPartitionFor` (in `@common/utils/source-breakpoint-partition.ts`) does the conversion, and
it is **machine-dependent**, which the plan did not say:

- on the **Next** a partition is an 8K page (Q9), so a 16K bank is two of them and which one a line
  is in depends on its offset — the same conversion `bankRelativePartition` does for a bank-relative
  breakpoint;
- on the **128K and +3** a partition *is* the 16K bank, so it passes through.

Getting that backwards is silent in the worst way: the breakpoint compares against a number that is
never paged anywhere, and simply never fires. Unbanked code stays partitionless, because such a
breakpoint must keep firing whatever is paged in.

`ResolvedBreakpoint` gained `partition`, `resolveBreakpoint` gained the parameter, and — the part
that is easy to miss — it also **registers the partition entry** in `breakpointData`. Setting only
the field leaves `PART_BP` over an empty list, which reads as "no breakpoint here": listed, shown in
the gutter, unable to fire. `resetBreakpointResolution` removes the entry again, matching on
*untagged* entries only, since a bank-relative breakpoint can share both the address and the
partition and owns its own entry's lifetime.

**Not done: resolving to a bank-relative site.** A partition makes the breakpoint fire only in the
right bank, which is what §13.4 asked for. Resolving to `bank` + `bankOffset` instead would also make
it follow the bank wherever it is paged — strictly better, and the natural shape given `.bank`
records exactly those two numbers — but it needs `resolveBreakpoint` to arm eight addresses rather
than one. Worth doing with §13.2, which needs the same machinery.

---

## 14. Test strategy

| Where | What |
| --- | --- |
| `node` project | everything decidable without React: ownership scoping, bank-relative firing, key round-trips, the entry-state map, header validation, the extracted annotation helpers, the two cores' 8K agreement |
| `jsdom` project | gutter gestures, the badge, the live/file toggle, the diff rendering — and every pre-existing annotation test, unchanged |
| Running app | the injection flow (timing-dependent by nature), the keystroke-suppression window, the gutter's run-here gesture, the measured boot-time improvement |

Two tests are load-bearing enough to name as acceptance criteria:

1. **The §3(b) false-positive test** (§7.5) — it is the whole reason R3 was chosen over R2.
2. **The project-open wipe regression** (§6.3) — it must fail before Phase 1 and pass after.

Per `AGENTS.md`: focused tests first, then `npm run build:check`, and `npm run lint:renderer` for the
renderer phases (4, 5, 6). Phases touching `.kliveproject` or the sidecar need a round-trip test that
an old file loads and a new file is only written when something changes.

---

## 15. Sequencing and gates

```
Phase 0  defect fixes ───────────────┐
Phase 1  ownership ──────────────────┼──> Phase 2  bank-relative breakpoints ──┐
                                     │                                          │
Phase 3  launch + checkpoint ────────┘                                          │
                                                                                │
Phase 4  decompose StaticMemoryDump ────────────────────────────────────────────┼──> Phase 5  gutter, entry stop, run-to-cursor
                                                                                │         │
                                                                                │         v
                                                                                └──> Phase 6  paused-machine UI
Phase 7  validation      (any time from Phase 3)
Phase 8  symbols + label breakpoints   (last; needs Phase 2's schema and Phase 5's UI)
```

- **Phases 0, 1, 3 and 4a are independent of the feature** and of each other. Any of them can land
  alone and each is defensible on its own merits.
- **Phase 2 is the gate for all breakpoint UI.** Tests before UI; a mistake in this layer is invisible
  rather than obvious.
- **Phase 4 gates Phases 5 and 6.** Do not begin attaching UI to `StaticMemoryDump` before 4d.
- **The `.nex.dis` schema is touched by Phases 2, 5 and 8.** Design the v2 bump once, in Phase 2, with
  all three uses in view.

## 16. Risks

| Risk | Mitigation |
| --- | --- |
| **Phase 4d breaks annotation behaviour subtly.** The largest single risk in the plan: 1784 lines of component with behaviour asserted through the DOM. | Follow the documented recipe in order; keep every `data-testid`; treat any test needing modification as a stop signal, not a merge conflict. |
| **The sidecar's two save policies clobber each other** (§4.5) — silent user data loss. | Read-merge-write on disjoint subtrees, with an explicit test that saving each subtree preserves the other. |
| **The `.nexload` flow's timing is fragile** and Phase 5 changes what runs during it. | The suppression design (§10.3) exists precisely so no pause can occur mid-flow; verify in the running app across several NEX sizes, including a single-bank one. |
| **Checkpoint reuse may not be fixable by ordering alone** (§8.2). | Measure first. If ordering is insufficient, content-keying is the fallback; if both fail, the phase still delivers launch, just slowly. |
| **`oneShot` removal racing the UI.** | Version bump on removal (§7.3), asserted by test. |
| **Q9's silent semantic change to saved Next partition breakpoints** (§4.1). No migration is possible — `.kliveproject` carries no version. | CHANGELOG entry; add `DebuggerState.schemaVersion` now so the next one is migratable. Accepted knowingly: the affected population is small and the documented behaviour was already the new one. |
| **Q9 makes the §3(b) false positive impossible *by construction*,** so nothing fails if the granularity is later changed back. | The named test in §7.5 exists precisely to catch that, and the §7.1 cross-core test pins the convention itself. |
| **Scope creep from the adjacent defects** in ideas §8. | §2 names what is explicitly not fixed. Fix `allRamBanks` in Phase 6 because that phase depends on it; leave the rest. |

## 17. Documentation

- `docs/content/working-with-ide/breakpoints.mdx` — the bank-relative kind and the extended `bp-set`
  grammar.
- `docs/content/commands-reference.mdx` — `bp-set` / `bp-del` / `bp-en` grammar; the new launch
  command; `dis`'s "does not support bank operations (yet)" note may need revisiting.
- `docs/content/working-with-ide/memory.mdx` — the Next partition table becomes **correct as written**
  under Q9 ("224 RAM banks, 8K each"), so no correction is needed. Worth one clarifying sentence that
  these are 8K pages and that a 16K bank *B* is the pair `2B` / `2B+1` — which is the relationship a
  NEX user needs.
- **`CHANGELOG.md` — required, not optional.** Q9 changes two user-visible behaviours on the Next
  (§4.1): the Disassembly bank column's numbers, and the meaning of a partition in `bp-set` and in
  saved projects. Both are corrections; neither should arrive unannounced.
- `.docs/nex-annotations.md` — schema v2 and the two save policies.
- A new page (or a section of `run-debug.mdx`) for debugging a NEX.
- `.ai/ui-theming-intent-and-lessons.md` — **required by `AGENTS.md`** for Phases 4, 5 and 6, since
  they are visual changes. Record the durable rule, not the narrative.
- Screenshots via `scripts/doc-shots/`; read `.ai/doc-screenshots-guide.md` first.

## 18. Open items — all closed

0. ~~**Does `DebuggerState` gain a `schemaVersion` now?**~~ **Done.** `DEBUGGER_STATE_SCHEMA_VERSION`
   is 1 — "breakpoints as written since a positive Next partition means an 8K page" — written into
   every saved project. The read side warns when a project declares a *newer* schema than this build
   understands and loads it anyway: refusing would be worse than a warning for something usually
   harmless, but the user is told where to look if a breakpoint then behaves oddly. Bump it when the
   *meaning* of a stored breakpoint changes, not when a field is added.
1. ~~**Does the breakpoint dialog author bank-relative breakpoints?**~~ **Yes, done in §10.2** — and
   the recommendation ("not in Phase 5; revisit once the gutter exists") was followed exactly: the
   gutter came first, and the dialog gained the shape when watchpoints needed an author the gutter
   could not be. It is spelled into the **address field** (`05:+$0100`) rather than given controls of
   its own, because that is what `bp-set` accepts.
2. ~~**Closing a NEX document vs ending the debug session?**~~ **The recommendation's load-bearing
   half already holds:** nothing unloads a sidecar's breakpoints on document close, so closing a tab
   cannot silently disarm them. `installedSidecars` is forgotten only on a failed install (so the
   next open retries) and in tests. Unloading them at *session end* is deliberately not implemented:
   they are persisted in the sidecar and re-installed on the next open, so leaving them armed across
   a machine stop costs nothing and removing them would need a session-end signal that does not
   exist. Revisit only if something observes a problem.
3. ~~**Launch options in the sidecar** (§4.5's `debug.launch`)~~ **Not needed, and not added.**
   `breakAtEntry` turned out to belong to the *launch*, not to the file: it is `nex-run -e` and a
   menu item, chosen per run. Nothing asked for a persisted launch option, so the field does not
   exist. This is the recommendation ("resist adding more until something asks") honoured by
   subtraction.
4. ~~**Does `applyBreakpointEdit` round-trip `owner` intact?**~~ **Resolved in Phase 1:** yes, via the
   `{ kind: "all" }` scope, which keeps each breakpoint's own owner. Now covered by a test.
5. ~~**A NEX with no project loaded**~~ **Left alone, as recommended** — and it is no longer the gap
   it looked like: bank-relative *and* label-anchored breakpoints on a NEX are persisted in its
   `.nex.dis` sidecar (§10.1a, §13.2), which needs no project at all. Only plain address breakpoints
   set with no project open have nowhere to go, which is unchanged behaviour for every machine.

## 19. Concurrent work in the worktree — read before starting Phase 2

> ## ✅ Resolved — the concurrent work has landed
>
> `DebugStepDecision.ts` and its tests are tracked and committed. Consequence 3 below ("whichever
> lands second rebases") is settled: it landed first, and this plan's §10.3 now **modifies it** —
> `consumeOneShotsAt` is called on the stop path, inside the `lastBreakpoint` guard. Consequence 5
> is confirmed: the decision function passes `getPartition`'s value straight through to
> `shouldStopAt` and interprets nothing, so Q9's change of meaning needed nothing here.
>
> Both of its test files carried a `debugSupport` stub built with `as unknown as IDebugSupport`, so
> adding a method to the interface type-checked and failed at runtime. Both stubs now provide
> `consumeOneShotsAt`. The equivalence test's header records that one-shot consumption is a
> deliberate behaviour change *after* the fold — like `retExecuted` — and that its matrix arms no
> one-shot, so the added call cannot make the two paths diverge there.

The rest of this section is kept as the record of the situation it described.

While this plan was being drafted, uncommitted changes appeared in the working tree from another
session, and they overlap Phase 2 directly:

| Path | State | Relevance |
| --- | --- | --- |
| `src/emu/machines/DebugStepDecision.ts` | new, untracked | **Unifies the stop decision.** Extracts `shouldStopAtDebugPoint(input)` from four WASM machines plus `MachineFrameRunner`, with `getPartition` already an injected resolver. Phase 2 does not modify it — see consequence 1 below. |
| `MachineFrameRunner.ts`, the four `*WasmV2Machine.ts`, `Z80NMachineBase.ts` | modified | now delegate to the above |
| `test/emu/debug-step-decision.test.ts`, `debug-step-decision-equivalence.test.ts`, `step-out-stack.test.ts`, `z80n-step-over-lengths.test.ts` | new, untracked | branch coverage for the extracted decision |
| the `*.c` / `*WasmV2Loader.ts` files, `Z80Cpu.ts` | modified | same change reaching into the cores |

Its own header notes it was motivated by two shipped bugs caused by the four copies drifting — a
dropped `imminentJustCreated` guard in all four, and a missing `retExecuted` in the +3E copy.

**Consequences for this plan — much reduced by Q9:**

1. **No dependency any more.** Q9 means a bank-relative breakpoint reuses the existing `PART_BP`
   mechanism and the stop decision is not modified at all (§4.6, §7.2). So this plan neither needs
   `DebugStepDecision.ts` nor is blocked by it; it only has to avoid conflicting with it. An earlier
   draft of §7.2 added a `getBank8k` field to `DebugStopDecisionInput` — that is no longer required.
2. **No phase is gated on it.** Phases 0, 1, 3 and 4 never touched the stop decision; Phase 2 no
   longer does either.
3. **Still worth coordinating**, because both changes touch `DebugSupport`-adjacent code and the same
   four machine classes. Whichever lands second rebases. Ask the author which that is.
4. Several `file:line` references in `NEX_DEBUGGING_IDEAS.md` §2.1 and §6 point at the pre-refactor
   per-machine code (`ZxNextWasmV2Machine.ts:789-830`, `:793`). They were accurate when written;
   re-derive them against `DebugStepDecision.ts` before relying on them.
5. One thing to *check* rather than assume: that refactor's `getPartition` resolver feeds
   `debugSupport.shouldStopAt`, so **Q9 changes what it returns**. Nothing in the decision function
   interprets the value — it only passes it through — but confirm that when the two changes meet.

---

## 20. What is left

Every phase has landed. What remains is listed here rather than left implicit, and none of it is
load-bearing for the feature.

### Owed by sub-items that shipped

| Item | Owed |
| --- | --- |
| §9 (Phase 4) | Step 6 of the MVC guide's recipe: re-partition the DOM suite, which now over-tests rules the headless layers own. No test was deleted, so nothing is unaccounted for. |
| §10.5 | A component test that a gutter click issues the right breakpoint. |
| §13.1 | The Watch and Call Stack panels; and using the sidecar's `bytes`/`words`/`skip` regions to stop the live disassembler decoding data as code. |
| §13.2 | The `bp-set` grammar for `[Game.nex.dis]:05:DrawSprite`, and an affordance for *creating* one. The notation is built and round-trips through the key; nothing parses it yet. |
| §13.3 | A menu item. It is a command (`nex-label`) because the live Disassembly view still has no row context menu, and adding one to place a single item is the wrong order — the same reasoning that made run-to-cursor a gutter gesture. |
| §17 | Screenshots via `scripts/doc-shots/`, which need the running app. |

### Two structural follow-ups this work exposed

Neither belongs to this plan, and both are recorded here because this is where they were found:

1. **`test/` is outside `build:check`.** Three test call sites passed a bare string where a
   `BreakpointScope` object was required; nothing told them, and the silent `undefined` that produced
   turned `resetBreakpointsTo` into an append for as long as it went unnoticed (§13.2). Type-checking
   the test directory would have caught it at the keystroke. The cleanup behind that switch is of
   unknown size.
2. **`nexAnnotationSidecar` mixes file IO with path helpers**, and the helpers import `project-node`
   as a value, which reaches the editor — so any test whose import graph touches the module loads
   Monaco. Nine `DisassemblyPanelRefactor` tests failed that way (§13.1) and are mocked for now.
   Splitting the IO out is the fix.

### Never verified

**The app has not been run.** Every headless layer is tested and the suite is green, but nothing in
Phases 5–8 has been seen working: the gutter's click-to-break, the entry stop, run-to-cursor, the
four readouts and banners, the live symbol names, the PC spotlight, and the `nex-label` round trip.
The plan's own gates say as much — "**Gate:** set a breakpoint in a popped-out bank, launch, and stop
there — the feature's actual acceptance test" is still owed.
