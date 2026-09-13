# ZX Spectrum Next NEX Debugging — Implementation Plan

Make a `.nex` file a first-class debug target: launch any NEX with debugging on, and set breakpoints
at an offset **within a particular bank** of it, from the NEX viewer and its popped-out bank
documents.

**Companion document:** [`NEX_DEBUGGING_IDEAS.md`](./NEX_DEBUGGING_IDEAS.md) — the investigation, the
verified facts with `file:line`, the full idea catalogue, and the decision log. **This plan does not
restate the evidence**; where it asserts a fact, that document proves it. Read §2, §3 and §9 there
first.

**Status:** **Phases 0–3 complete** (§5–§8). Phases 4–8 not started. Phase 4 is the
`StaticMemoryDump` decomposition, which gates the UI work in Phases 5 and 6.

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
| 4a | Move the already-pure helpers (`countLabelReferences`, `removeLabel`, `addLabelIfMissing`, `replaceAnnotationRegion`, `getRegionTypeForSpan`, `getAlternativeRegionType`, `mergeAnnotationRegions`, `removeLabelOperandReferences*`, `:1940-2091`) beside the other `nex*` files, with node tests | ~none; land it first and separately |
| 4b | Model + ViewModel: annotation state, the dirty/save lifecycle, region and label rules | translating rules the DOM tests already assert |
| 4c | Controller over ports: the annotation session, the dialogs, the confirm port | the async orchestration |
| 4d | Rewrite view + container; `StaticMemoryDump` becomes NEX-agnostic and the annotation editor composes over it. **Keep every `data-testid`** | the real risk |

**Gate:** every existing NEX annotation test passes unchanged, including the dialog-consistency suite.
`StaticMemoryDump` no longer imports anything from `DocumentPanels/Next/`. If 4d cannot keep the tests
green without editing them, stop and reassess rather than adjusting assertions.

---

## 10. Phase 5 — The gutter, watchpoints, and stopping (L4)

### 10.1 The bank breakpoint gutter

Every annotated disassembly row already carries `bank`, `bankOffset` and `byteLength`
(`DisassemblyAnnotationMetadata`, `common-types.ts:132-167`), and the row renders the same
`BreakpointIndicator` the live view uses — `StaticMemoryDump` merely passes it no breakpoint props
(`:1841-1864`). Wire them: a gutter click on a row creates a bank-relative breakpoint from that row's
own bank and offset, owned by `{kind:"nex", sidecar}`.

The NEX viewer's bank rows gain a breakpoint count badge, so a collapsed bank still says it carries
breakpoints.

### 10.2 Bank-scoped watchpoints

Memory-read and memory-write bank-relative breakpoints, from the same gutter's context menu.
`hasMemoryRead` / `hasMemoryWrite` already take the partition resolver and gain the 8K one in Phase 2,
so this is UI plus a kind flag.

### 10.3 The entry-point stop (Q5)

Per ideas §9.5:

1. Compute the entry site from the header — the entry bank via the extracted entry-state map (§11.1),
   offset `header.programCounter & 0x3FFF`.
2. Arm it as a session-owned one-shot **before** the injection flow starts.
3. Run the flow with **user breakpoints suppressed** so only session-owned ones can stop the machine.
   This is what protects the keystroke queue: `queueKeystroke` stamps an absolute tact window at
   queue time (`ZxNextMachine.ts:1395`) and `emulateKeystroke` silently discards any stroke whose
   window has passed (`:1358`), so a mid-flow pause loses the rest of the typed command line. It
   replaces today's blanket `NoDebug` during `Start` steps.
4. Lift the suppression where debug is armed today (`MachineController.ts:526-540`).

### 10.4 Run to cursor

Does not exist anywhere today. In a popped-out bank it means "run until the CPU reaches this offset in
this bank" — a session-owned one-shot bank-relative breakpoint, **not** `UntilExecutionPoint`, whose
`terminationPartition` no machine reads (`Z80NMachineBase.ts:542`) and which forces the
per-instruction debug loop. Add it to the live Disassembly view in the same change; it is the same
mechanism and its absence there is conspicuous.

### 10.5 Tests

Node tests for the entry-site computation from a set of synthetic headers (entry bank at `$C000`,
bank 2 at `$8000`, bank 5 at `$4000`, and a `programCounter` in ROM, which must be rejected with a
diagnostic rather than producing a nonsense breakpoint). Component tests that a gutter click issues
the right breakpoint and that the badge counts correctly. The suppression behaviour is verified in the
running app.

**Gate:** set a breakpoint in a popped-out bank, launch, and stop there — the feature's actual
acceptance test. Plus: break at entry works on a NEX whose entry bank is bank 0 (which Phase 0 made
possible at all).

---

## 11. Phase 6 — The paused machine (L4, core scope per Q7)

### 11.1 Extract the entry-state map

`getDefaultDisassemblyOffsetForBank`, `getMappedBankForAddress`, `getProgramCounterBank`,
`getStackPointerBank` (`NexFileViewerPanel.tsx:562-610`) are the canonical NEX entry-state map and are
trapped in a React panel. Move them beside `nexFileLoader.ts` as pure functions with node tests.

Strictly this is a Phase 5 prerequisite (§10.3 needs it) — do it as the first commit of Phase 5 if
Phase 6 slips.

### 11.2 Where is this bank right now?

The pop-out header names the MMU slot(s) currently holding the bank, or says **not paged in**, read
from `getNextMemoryMapping().pageInfo`. **First** of this phase's items: it makes the paging subtlety
of §4.6 visible to the user instead of surprising them.

### 11.3 Live-vs-file view, and the diff

A Live/File toggle on the popped-out bank, reading `getMemoryPartition(bank)` when the machine is
paused — and a diff mode highlighting bytes that differ from the NEX file. Both arrays are already in
hand, so the diff is nearly free and it is the only feature here that shows something currently
undiscoverable: self-modifying code, decompressed payloads, corrupted banks.

### 11.4 Follow the PC

When paused with the PC inside a page holding this bank, highlight the row — the same spotlight the
Disassembly view has.

### 11.5 Bank provenance in the Memory Mapping panel

Each slot gains "from `Game.nex` bank `$20`" while a session is live. **This phase will hit the
`allRamsBanks`/`allRamBanks` mismatch** (`EmuApi.ts:688` vs both producers) that makes the panel's
allRAM readout permanently empty; fix it here.

**Gate:** with a NEX paused, the pop-out says where its bank is, shows live bytes, and marks what
changed.

---

## 12. Phase 7 — Pre-launch validation

Small, self-contained, and can land at any point from Phase 3 onward. Check and report in the viewer:
`requiredCoreVersion*` against the emulated core; `fullRamRequired` and RAM size against the
configured machine; `entryBank` present in `bankFlags`; `programCounter` inside a bank the entry state
actually maps in; `stackPointer` sane. All of it comes from the already-parsed header, and it converts
a class of silent, baffling failures into a sentence.

Pure function, table-driven node test, rendered as viewer warnings in the existing annotation-banner
slot.

---

## 13. Phase 8 — Annotations as live symbols, and label-anchored breakpoints

The largest and least certain group; last for that reason.

### 13.1 Labels as live symbols

A `ICustomDisassembler` for the Next resolves live addresses through the annotations of whichever bank
is paged in, so hand-made names appear in the live Disassembly view, the Watch panel and the Call
Stack panel. The hook already exists (`zx-spectrum-next-disassembler.ts`, installed via
`setCustomDisassembler`). Sidecar `bytes`/`words`/`skip` regions also stop the live disassembler
decoding data as code.

### 13.2 Label-anchored breakpoints (Q3)

A third binding mode: "break at `DrawSprite` in bank `$20`", resolved through the sidecar's label
table as a source breakpoint resolves through the compiler's list file — and surviving a rebuild that
moves code within the bank, which no offset-based breakpoint can.

The consumer side is already written and idle: `resolvedPartition` is read in five places in
`DebugSupport` (`:256`, `:273`, `:332`, `:387`, `:593`) and **written nowhere**. This phase gives it
its first writer, and adds `resolvedBankOffset` plus a partition on `ResolvedBreakpoint`.

Resolution rule: a **local** label's value is bank-relative, so it resolves to a bank-relative
breakpoint; a **global** label's value is a 16-bit address, so it resolves to a plain address
breakpoint. Keys are file-qualified (§4.4, §4.7).

### 13.3 Promote a discovery into an annotation

Paused at an address inside a bank: "add a label here in the NEX annotations" — closing the
reverse-engineering loop.

### 13.4 Source breakpoints carry the compiler's bank

For a project that builds a NEX, `ListFileItem.segmentIndex` → `BinarySegment.bank`
(`CompilerInfo.ts:603-612`, `:54-78`) is known and discarded; `refreshSourceCodeBreakpoints` takes
only `lineInfo.address` (`common/utils/breakpoints.ts:109-114`). Carrying it makes a source breakpoint
in one `.bank` section stop firing inside another — a real misfire today, since Next `.bank` sections
routinely share addresses.

---

## 14. Test strategy

| Where | What |
| --- | --- |
| `node` project | everything decidable without React: ownership scoping, bank-relative firing, key round-trips, the entry-state map, header validation, the extracted annotation helpers, the two cores' 8K agreement |
| `jsdom` project | gutter gestures, the badge, the live/file toggle, the diff rendering — and every pre-existing annotation test, unchanged |
| Running app | the injection flow (timing-dependent by nature), the entry stop, the measured boot-time improvement |

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

## 18. Open items

The one that blocked Phase 2 is **answered**: Q9, the 8K page convention (§4.1). What remains is
small enough not to block a start, and big enough not to want discovering during implementation:

0. **Does `DebuggerState` gain a `schemaVersion` now?** Recommended in §4.1 so the *next* semantic
   change to stored breakpoints is migratable — this one cannot be. Cheap, and unrelated to the rest
   of the plan.

1. **Does the breakpoint dialog author bank-relative breakpoints?** The gutter is the natural author,
   and `BREAKPOINT_MANAGEMENT_UI_PLAN.md` §3 deliberately left source breakpoints to the editor
   gutter for the same reason. Recommend: **not in Phase 5**; revisit once the gutter exists.
2. **Closing a NEX document vs ending the debug session** — which unloads the sidecar-owned
   breakpoints? Recommend the session, so closing a tab does not silently disarm breakpoints.
3. **Launch options in the sidecar** (§4.5's `debug.launch`) — only `breakAtEntry` is needed for
   Phase 5. Resist adding more until something asks for it.
4. ~~**Does `applyBreakpointEdit` round-trip `owner` intact?**~~ **Resolved in Phase 1:** yes, via the
   `{ kind: "all" }` scope, which keeps each breakpoint's own owner. Now covered by a test.
5. **A NEX with no project loaded** sets plain address breakpoints with no project to save them to —
   today's behaviour and no regression, but a case could be made for the sidecar adopting them.
   Recommend: leave alone.

---

## 19. Concurrent work in the worktree — read before starting Phase 2

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
