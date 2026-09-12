# Partition Naming Unification Plan

Status: **complete** — all phases implemented
Scope: `src/emu` (label producers and parsers), `src/renderer` (every display site), `docs/`
Related: `.plans/BREAKPOINT_MANAGEMENT_UI_PLAN.md` (which added the breakpoint dialog's picker)

## 1. Problem

The same memory partition has up to three different names depending on which window you look at.

**What each machine's `getPartitionLabels()` says** — the map the Breakpoints panel and the `bp-*`
commands use:

| Machine | ROM | RAM banks | Special |
| --- | --- | --- | --- |
| ZX Spectrum 128K | `R0` `R1` (−1,−2) | `B0`–`B7` (0–7) | — |
| ZX Spectrum +2/+3E | `R0`–`R3` (−1..−4) | `B0`–`B7` (0–7) | — |
| Cambridge Z88 | — | `00`–`FF` (0–255) | — |
| ZX Spectrum Next | `R0`–`R3` (−1..−4) | `00`–`DF` (0–223) | `Q0` `Q1` alt ROM (−5,−6); `DM` DivMMC ROM (−7); `M0`–`MF` DivMMC RAM (−8..−23) |

**What the views actually display:**

| View | 128K / +2/+3E | Z88 | ZX Next |
| --- | --- | --- | --- |
| Memory — bank selector | `ROM 0` / `BANK 0` | `00`–`FF` | `NROM0`–`NROM3`, `ALTR0`, `ALTR1`, `DivMR`, `M0`–`MF`, `00`–`DF` |
| Breakpoints panel | `R0` / `B0` | `00`–`FF` | `R0`–`R3`, `Q0`, `Q1`, `DM`, `M0`–`MF`, hex |
| Disassembly bank column | `R0` / `B0` | `00`–`FF` | `R0`–`R3`, **`A0` `A1`**, `DM`, **`D0`–`DF`**, hex, `UN` |
| `bp-set <part>:<addr>` accepts | `R0` / `B0` | `00`–`FF` | `R0`–`R3`, `Q0`, `Q1`, `DM`, `M0`–`MF`*, hex |
| **`bp-list` output** | `-1:$8000` | `0:$8000` | `-1:$8000` |
| **`wl` (watch list) output** | `-1` | `0` | `-1` |

The last two rows are not a formatting choice. `bp-list` calls `getBreakpointKey(bp)` **with no
label map** (`BreakpointCommands.ts:54`), while `bp-set`, `bp-del` and `bp-en` all pass one — so the
command that *lists* breakpoints prints them in a notation none of its sibling commands will accept
back. `getBreakpointKey`'s no-map fallback is `bp.partition.toString(16)`
(`src/common/utils/breakpoints.ts:31`), which for a ROM yields `-1`. `wl` never maps at all
(`WatchCommands.ts:281`).

Where the divergences come from:

1. **`createSegmentOptions`** (`src/renderer/features/memory/memoryViewModel.ts:70`) is handed the
   machine's label map and then ignores it, formatting `ROM ${-key - 1}` / `BANK ${key}` from the
   index instead. That is the whole 128K/+3 discrepancy.
2. **`BankDropdown`** (`src/renderer/controls/new/BankDropdown.tsx:133-141`) hardcodes `NROM0`…
   `DivMR` in its JSX, with the indices written as literals (`romItem(-5, "ALTR0")`). It knows
   nothing about the machine it is choosing for. **There are two copies of it** — `NextBankDropdown.tsx:116-124`
   carries the same name set again — and two copies of `createSegmentOptions`
   (`memoryViewModel.ts:72` and `useDisassemblyMachineSetup.ts:29`). Four hardcoded naming sites,
   not two.
3. **The ZX Next derives labels twice.** `getPartitionLabels()` builds an index→name map, while
   `MemoryDevice.getPartitionLabelForPage` (`:551`) and
   `ZxNextWasmV2Machine.getWasmV2PartitionLabelForPage` (`:1146`) build names *from memory offsets*
   with a different vocabulary — `A0`/`A1` for the alt ROMs and `D0`–`DF` for DivMMC RAM. Those are
   the labels the disassembly column shows.

Every other machine already does the right thing: `getCurrentPartitionLabels()` maps
`getCurrentPartitions()` through `getPartitionLabels()`, so it cannot disagree with itself
(`ZxSpectrum128WasmHost.ts:116`, `ZxSpectrumP3eWasmHost.ts:158`).

### 1.1 Defects found while auditing

- **`bp-set m0:$8000` is rejected on the ZX Next.** `BreakpointCommands.ts:143` lowercases the whole
  address spec, but `ZxNextMachine.parsePartitionLabel` (`:714`) switches on `label.toUpperCase()`
  while its `default:` branch tests the *original* string — `label.startsWith("M")`. `Q0` survives
  the round trip because it is an explicit `case`; `M0` does not. **All sixteen DivMMC RAM
  partitions are unreachable from every breakpoint command.** Case-insensitivity is not an
  undefined corner here: `test/wasm/zxSpectrum/wasm-partition-labels.test.ts:27` asserts
  `" b7 " → 7` on the 128K, so the Next is deviating from a contract the other machines are
  tested against.
- **Two disjoint parsers on the Next.** The public `parsePartitionLabel` accepts `Q0`/`Q1`/`M0`–`MF`
  and rejects `A0`/`A1`/`D0`; the private `parseWasmV2PartitionLabel`
  (`ZxNextWasmV2Machine.ts:1169`) is the exact mirror image. The emulator emits the second
  vocabulary as live page labels, so a name shown in the disassembly cannot be typed into `bp-set`.
- **A label string is being used as a data channel.** `ZxNextWasmV2Machine.ts:1121-1128` builds the
  Memory Mapping panel's `pageInfo` by *formatting a label and then re-parsing it*: `writeOffset` is
  decided by `label.startsWith("R") || label.startsWith("A") || label === "DM" || label === "UN"`,
  and `bank16k` comes from `parseWasmV2PartitionLabel(label)`. So "is this page read-only?" is
  answered by string inspection of a display name. This is the single most important thing the
  audit turned up, because **Phase 1 deletes that parser** — see Phase 1 step 3.
- **`Z88Machine.getPartitionLabels`** (`:177`) declares `Record<number, string>` and returns a
  `string[]`. It behaves correctly by index, so this is a type lie rather than a live fault — but it
  is why the Z88 has no ROM entries where every other machine does.
- **Dead code with a fifth naming scheme.** `getPartitionedValue()`
  (`src/renderer/appIde/services/ide-commands.ts:262-310`) hand-parses `r<n>:` / `<n>:` and returns
  its own `partitionType: "R" | "B"`. It has no callers anywhere in `src/` or `test/`. Delete it
  rather than migrate it.
- **Latent ambiguity.** `parseWasmV2PartitionLabel` tests `startsWith("D")` *before* its hex branch
  and has explicit `A0`/`A1` cases, so any label `A0`, `A1`, or `D0`–`DF` parses as a special page
  rather than a RAM bank. Today `getWasmV2PartitionLabelForPage` only emits hex `00`–`6F`, so no
  collision occurs in practice — but the two functions are a matched pair whose agreement is
  accidental. See §8 Q3: that `bank8 < 224` threshold looks wrong on its own terms.

## 2. Constraints that decide the design

- **The disassembly bank column is 2–3 characters, and it never measures the label.**
  `derivePartitionWidthCh` (`src/renderer/controls/data/partitionWidth.ts:51`) returns `0`, `2` or
  `3` — 3 only when some candidate label is *hex-parsable* and the view is decimal, because that is
  the one case where a 2-char label is rewritten as a 3-digit decimal. Width is inferred from
  parsability, not from `length`. So a five-character `NROM0` would not widen the column; it would
  be laid into a `2ch` box and overflow it. Both the disassembly and memory panels size from this
  one function, and `PartitionPrefix` (`controls/data/index.tsx:379`) renders at the fixed width it
  returns.
- **`bp-set <partition>:<address>` is public API.** It appears in the docs and in users' scripts.
  Renaming a partition breaks saved work silently — the command would report "Invalid partition"
  rather than misfiring, but it would still break.
- **Hex bank labels own the `A0`/`D0` namespace.** On the Next, banks `$A0` and `$D0`–`$DF` are
  real, in-range RAM banks. So `A0`/`A1` (alt ROM) and `D0`–`DF` (DivMMC RAM) are *ambiguous by
  construction* and cannot be canonical, whatever their mnemonic appeal. `Q0`/`Q1` and `M0`–`MF`
  are outside the hex-label space and stay unambiguous.
- **Nothing on disk holds a partition *name*.** A `.kliveproject` stores `BreakpointInfo[]`
  verbatim (`src/main/projects.ts:336`), and `BreakpointInfo.partition` is a number. So saved
  projects are index-keyed and immune to naming changes — the exposure is scripts and typed
  commands, not stored work. That is what makes the "no renames" rule in §3 cheap to keep *and*
  what would make a future rename survivable if one is ever wanted.

## 3. The principle

> **One map is the authority. The short label is the identity. Long names are descriptions.**

- `getPartitionLabels(): Record<number, string>` is the single source of every partition name.
- Its labels are the **identity**: what `getBreakpointKey` puts in a key, what `parsePartitionLabel`
  accepts, what a bank column shows, what a breakpoint row reads.
- A **description** (`ROM 0`, `Alt ROM 0`, `DivMMC RAM 3`) is presentation only. It may appear in a
  picker, a tooltip or a caption; it is never an identity, never parsed, and never put in a key.
- **Nothing else derives a partition name.** Any code that today builds a name from an offset or an
  index instead resolves the *index* and looks the name up.

The consequence worth stating plainly: **no partition is renamed.** Every canonical label in §1's
first table stays exactly as it is. The fix deletes the alternative vocabularies rather than
choosing between them, so `bp-set` grammar, saved projects and existing scripts are untouched.

## 4. What each surface shows afterwards

| Surface | Shows | Why |
| --- | --- | --- |
| Breakpoints panel, breakpoint keys | label (`R0`, `Q0`, `M3`, `7A`) | unchanged; already correct |
| Disassembly bank column | label | 2–3 char budget; fixes `A0`→`Q0`, `D3`→`M3` |
| Memory bank selector — closed | label | so the thing you picked matches the thing you see elsewhere |
| Memory bank selector — open grid | description, label as secondary | browsing wants "Alt ROM 0"; identifying wants `Q0` |
| Breakpoint dialog partition picker | same control, same rule | it already shares `PartitionPicker` |
| `bp-set` / `bp-del` / `bp-en` | label, case-insensitive | unchanged grammar |
| Tooltips anywhere | `label — description` | both, once, where there is room |

**Browse by description, identify by label** is the whole user-facing change: the memory picker's
grid keeps its friendly names, but once chosen the trigger shows `Q0`, which is what the
disassembly, the breakpoints panel and the command line all call it.

## 5. API changes

### 5.1 `getPartitionDescriptions()` — new, optional

```ts
// Z80MachineBase / Z80NMachineBase
getPartitionDescriptions(): Record<number, string> {
  return {};
}
```

Non-abstract with an empty default, so the six concrete machines opt in one at a time and a machine
that never does simply shows labels everywhere. Proposed content:

| Machine | Descriptions |
| --- | --- |
| 128K | `R0` → "ROM 0", `R1` → "ROM 1", `B0`–`B7` → "Bank 0".."Bank 7" |
| +2/+3E | `R0`–`R3` → "ROM 0".."ROM 3", `B0`–`B7` → "Bank 0".."Bank 7" |
| Z88 | `00`–`FF` → "Bank $00".."Bank $FF" (no ROM entries — see §8.2) |
| ZX Next | `R0`–`R3` → "Next ROM 0..3", `Q0`/`Q1` → "Alt ROM 0/1", `DM` → "DivMMC ROM", `M0`–`MF` → "DivMMC RAM 0..15", `00`–`DF` → "Bank $00..$DF" |

The Next's descriptions are deliberately the names the memory picker shows today, spelled out:
`NROM0` → "Next ROM 0", `ALTR0` → "Alt ROM 0", `DivMR` → "DivMMC ROM". Nothing is lost from that
grid; the abbreviations become words.

### 5.2 `EmuApi.getPartitionDescriptions()`

Alongside `getPartitionLabels`, wired through `MainToEmuProcessor` the same way. One extra IPC call
per machine change, fetched beside the labels in `useMemoryMachineSetup` and `useBreakpointDialog`.

### 5.3 `getPartitionForPage(pageIndex): number | undefined` — new on the Next

The one function that turns a paged-in memory offset into a partition **index**. Both
`getCurrentPartitionLabels()` and `getPartition(address)` are then one line each:

```ts
getCurrentPartitionLabels(): string[] {
  const labels = this.getPartitionLabels();
  return range(8).map((page) => labels[this.getPartitionForPage(page)] ?? UNPAGED);
}
```

This deletes the offset→name→index round trip that produced the second vocabulary, and with it
`parseWasmV2PartitionLabel` and the `A0`/`D0` names entirely. `UN` stays as the label for an
unpaged page — it is not a partition, so it has no index and belongs in neither map.

### 5.4 `PartitionOption` — the picker's input

`PartitionPicker` currently takes `segmentOptions: DropdownOption[]` for the list form and nothing
at all for the matrix form. Give both forms one shape:

```ts
export type PartitionOption = {
  index: number;
  label: string;          // identity
  description?: string;   // presentation
  group?: "rom" | "special" | "bank";  // which block of the matrix it belongs in
};
```

`group` is what lets `BankDropdown` lay out its three blocks (wide ROM chips, wide special chips,
16-wide hex grid) from data instead of from hardcoded JSX. Derived in one place —
`derivePartitionOptions(labels, descriptions)` next to `derivePartitionSetup` in `memoryViewModel.ts`
— and used by the memory toolbar and the breakpoint dialog alike.

## 6. Phases

### Phase 1 — the Next's second vocabulary (no UI change) — **DONE**

The largest correctness win and it is invisible, so it can land alone.

1. Add `getPartitionForPage(pageIndex)` to `ZxNextMachine` and `ZxNextWasmV2Machine`, containing the
   offset comparisons that `getPartitionLabelForPage` / `getWasmV2PartitionLabelForPage` have today,
   returning an index rather than a string.
2. Reimplement `getCurrentPartitionLabels()` and `getPartition(address)` on top of it.
3. Delete `parseWasmV2PartitionLabel` and the `A0`/`A1`/`D0`–`DF` names. **First** rewrite the
   `pageInfo` builder (`ZxNextWasmV2Machine.ts:1121-1128`), which is that parser's real consumer:
   `bank16k` becomes `getPartitionForPage(page)` directly, and the read-only test becomes a
   predicate on the *index* (`index < 0 && index >= -7`, i.e. any ROM or DivMMC ROM page) rather
   than `label.startsWith("R") || startsWith("A")`. Getting this backwards silently changes which
   pages the Memory Mapping panel reports as writable, so it needs its own test before the parser
   goes.
4. Fix `ZxNextMachine.parsePartitionLabel`'s `default:` branch to test the normalized string, so
   `bp-set m0:$8000` works (§1.1). Add `A0`/`A1`/`D0`–`DF` **as rejected**, not as aliases — they
   are ambiguous with hex banks (§2).
5. Tests: extend `test/wasm/zxSpectrum/wasm-partition-labels.test.ts`'s table-driven style to the
   Next — every index round-trips label→index→label, every emitted page label parses, and no label
   is produced that `parsePartitionLabel` rejects. That last assertion is the invariant this whole
   plan exists to establish; write it as a property over the full index range, not a sample.

### Phase 1b — the storage/display key split (independent of Phase 1) — **DONE**

Per §8 decision 4. Mechanical, compiler-guided, and it fixes `bp-list` as a side effect rather than
as a patch. Needs none of Phase 1's emulator work, so the two can proceed in either order.

5b. Split `getBreakpointKey` into `getBreakpointStorageKey(bp)` and
    `getBreakpointDisplayKey(bp, partitionLabels)` in `src/common/utils/breakpoints.ts`, the label
    map **required** on the display form.
5c. Point the internal callers at the storage form: `DebugSupport.ts:229,302,360,452,460,484,545`
    and `breakpoint-actions.ts:41,42,47`. These are identity comparisons and `Map` keys — a storage
    key must not move when a machine's labels do, which is the reason the split exists.
5d. Point the display callers at the display form. The compiler finds them;
    `BreakpointCommands.ts:54` (`bp-list`) is the one that was wrong, and it now cannot compile
    without a map.
5e. `wl` (`WatchCommands.ts:281`) maps its partition through the labels instead of printing the raw
    number. Not covered by the split — it formats its own string — so it needs its own fix.
5f. Tests: `test/debug/DebugSupport.test.ts` and `RestoreBreakpoints.test.ts` use the no-map form
    against internal state, so they move to the storage form. Add one asserting `bp-list` output
    round-trips into `bp-set`, which is the invariant that was broken.

### Phase 2 — descriptions — **DONE**

6. `getPartitionDescriptions()` on the base classes plus the four machines in §5.1.
7. `EmuApi` + `MainToEmuProcessor` plumbing.
8. `derivePartitionOptions` in `memoryViewModel.ts`; node tests over each machine's map.

### Phase 3 — the pickers — **DONE**

9. **Collapse the duplicates first**, before changing behaviour: `NextBankDropdown` into
   `BankDropdown`, and `useDisassemblyMachineSetup`'s `createSegmentOptions` into
   `memoryViewModel`'s. Four hardcoded naming sites become two, and the rest of this phase is then
   done once instead of twice.
10. `BankDropdown` driven by `PartitionOption[]` instead of hardcoded chips. Its arrow-key
    `keyBehaviors` table (`BankDropdown.tsx:186-244`) is 60 hand-written entries of literal indices
    tied to the current Next layout — deriving it from the grouped options is part of this step, and
    is the fiddliest thing in the plan. Budget for it.
11. `createSegmentOptions` uses `partitionLabels[key]` as the label and the description as secondary
    text. `ROM 0` / `BANK 0` stop being invented.
12. `PartitionPicker` takes `PartitionOption[]`; the memory toolbar and breakpoint dialog pass it.
13. jsdom tests: the closed trigger shows the label, the open grid shows descriptions, and the label
    a picker yields is the one the Breakpoints panel would print for that index.
14. Update the tests that pin the old display strings: `test/controls/MemoryViewModel.test.ts:49-57`
    and `test/controls/DisassemblyMachineSetup.test.tsx:43-50` both assert `"ROM 0"` / `"BANK 0"`.
    They are asserting the bug, so they change with it.

### Phase 4 — the remaining displays and docs — **DONE**

15. `DisassemblyItem.partition` (`disassemblers/common-types.ts:33`) is set by every disassembler
    and appears to be rendered by nothing — the panels compute their own label from `mem64kLabels`.
    Confirm, then delete it rather than converting it. A field carrying a name nobody reads is how
    a sixth vocabulary starts.
16. Delete the dead `getPartitionedValue()` (§1.1).
17. **Docs.** The gap is larger than a wording fix: `memory.mdx:57-83` and `disassembly.mdx:46-72`
    document only the *dropdown* spellings (`NROM0`, `ALTR0`, `DivMR`), while the labels those very
    views print in their bank column (`R0`, `A0`, `DM`, `M0`, `UN`) and the grammar `bp-set`
    actually accepts (`R0`–`R3`, `Q0`, `Q1`, `DM`, `M0`–`MF`, hex) are **documented nowhere**. After
    this plan there is one set of names, so: one table per machine, stated once, linked from
    `memory.mdx`, `disassembly.mdx`, `breakpoints.mdx` and the three `r1:$32ac` copies in
    `commands-reference.mdx:49,130,147`.
18. `npm run doc:build && npm run doc:check`.

## 6.1 Test inventory

The suites that pin partition naming, so the phases above know what they are moving:

| Area | Files |
| --- | --- |
| Parsing / label maps | `test/memory/partition-parsing.test.ts`, `test/wasm/zxSpectrum/wasm-partition-labels.test.ts`, `test/wasm/zxNext/wasm-next-partition-labels.test.ts` |
| WASM/TS parity on `getCurrentPartitionLabels()` | `test/wasm/zxNext/wasm-next-{ports,nextreg,memory-mmu}.test.ts`, helpers in `wasm-next-test-helpers.ts:248` |
| Display strings (`"ROM 0"`, `"BANK 0"`) | `test/controls/MemoryViewModel.test.ts`, `test/controls/DisassemblyMachineSetup.test.tsx`, `test/controls/MemoryMachineSetup.test.tsx` |
| Row rendering + column width | `test/controls/partitionWidth.test.ts`, `DisassemblyRow.test.tsx`, `MemoryDumpSection.test.tsx` |
| Breakpoint keys and form | `test/debug/breakpoint-form.test.ts`, `test/controls/BreakpointDialog.test.tsx`, `test/debug/DebugSupport.test.ts` |

The parity suites are the useful lever for Phase 1: they already assert that the WASM and TypeScript
Next implementations produce identical `getCurrentPartitionLabels()`, so a rewrite that broke one
and not the other is caught immediately.

## 7. Risks

| Risk | Mitigation |
| --- | --- |
| `BankDropdown`'s keyboard table is tied to the current layout | Phase 3 step 9 is the known-hard step; keep the derived table behind the same tests before/after, and treat "arrow keys still reach every chip" as the acceptance criterion |
| Changing the disassembly column's labels changes its width | Labels stay ≤2 chars by §2, and `derivePartitionWidthCh` is already shared; assert the width is unchanged for each machine in a node test |
| A machine's `getPartitionForPage` disagrees with its old label function | Phase 1 keeps the old functions until the round-trip property test passes over the whole index range, then deletes them |
| Phase 1 "tidies" the `bank8 < 224` threshold, which is correct as-is (§8.3) | Carry it across verbatim; the WASM/TS parity suites guard it, but confirm they cover the upper bank range first |
| A caller is pointed at the wrong half of the key split | The two names differ in arity as well as intent, so a mistaken swap is a type error rather than a silent behaviour change |
| The Z88's array-shaped map is relied on positionally somewhere | Phase 2 converts it to a real `Record`; grep for indexed access before changing it |
| Scripts using `bp-set` break | Nothing is renamed (§3); the grammar only *gains* the working `M0`–`MF` it always documented |

## 8. Decisions

All five questions from the review are settled. Recorded here as decisions, with the reasoning kept
so a later reader does not have to re-derive them.

1. **`UN` stays out of the label map.** An unpaged Next page has no partition, so it gets no index;
   the bank column renders `UN` as its own empty state rather than as a lookup result. A sentinel
   index would have put a non-partition in a map whose keys are otherwise all real partitions.

2. **The Z88 keeps no ROM partitions.** Its ROM is a card in slot 0 rather than a fixed page, so
   the hex-only map is correct, not incomplete. Phase 2 therefore gives the Z88 bank descriptions
   only. The `string[]`-returned-as-`Record` type lie (§1.1) is still fixed — that is a separate
   defect from the map's contents.

3. **`bank8 < 224` in `getWasmV2PartitionLabelForPage` is correct** and is preserved as-is. Phase 1
   rewrites that function into `getPartitionForPage`, and must carry the threshold across
   unchanged rather than "tidying" it. The WASM/TS parity suites (§6.1) are the guard: they already
   assert both implementations produce identical `getCurrentPartitionLabels()`, so a rewrite that
   changed the threshold's effect on one side would fail immediately. Implementer's note: the TS
   path keys off `pageInfo.bank16k` and the WASM path off `bank8 >> 1`, so the two are reading
   different quantities — worth confirming the parity tests actually cover the upper bank range
   before deleting the old function.

4. **Split `getBreakpointKey` in two, and make the label map required for display.** The audit's
   call-site census makes the seam obvious: of the 22 calls that pass no map, 7 are `DebugSupport`'s
   internal `Map` keys and 4 are `breakpoint-actions`' identity comparisons — all of which *should*
   be index-based, because a storage key must not change when a machine's labels do. Exactly one,
   `bp-list`, is a display call that lost its map. So:

   ```ts
   /** Stable identity for storage and comparison. Never shown to a user. */
   export function getBreakpointStorageKey(bp: BreakpointInfo): string;

   /** What a user reads. The label map is required, so it cannot be forgotten. */
   export function getBreakpointDisplayKey(
     bp: BreakpointInfo,
     partitionLabels: Record<number, string>
   ): string;
   ```

   Making `partitionLabels` a required parameter turns the `bp-list` bug into a compile error and
   prevents the same leak recurring. This supersedes Phase 1b step 5b: fixing `bp-list` becomes a
   consequence of the split rather than a separate patch. Storage keys keep today's
   `partition.toString(16)` form so existing in-memory keys are unchanged.

5. **`B0`–`B7` stays on the ZX Spectrum 128K and +2/+3E.** The Next keeps hex `00`–`DF`. The two
   schemes are each internally consistent and each are established `bp-set` grammar, so no
   cross-machine unification is attempted. This confirms §3's rule: **no partition is renamed on any
   machine.**

## 9. Phase 1b implementation notes

Landed as planned, with three things worth recording.

1. **The compiler found exactly the two call sites that were wrong.** Making `partitionLabels`
   required on the display form produced two `TS2554` errors and no others: `bp-list`
   (`BreakpointCommands.ts:54`, the known bug) and `DisassemblyRow.tsx:74`, which was not on the
   audit's list because it only builds a key for *source-bound* breakpoints — where the label map
   is irrelevant to the result but is now required to ask for it. Both fixed.

2. **The disassembly row was naming one partition two ways, inside one view model.** Its
   `breakpointPartition` field already rendered the label (`B0`) while `breakpointAddress` rendered
   the raw index (`0:$6000`) — from the same breakpoint, in the same row. Two characterization
   tests were pinning that (`DisassemblyRow.test.tsx:44`,
   `DisassemblyPanelRefactor.test.tsx:330`); both now assert the label form, and the panel test
   additionally asserts `data-partition` agrees with the address, so the row cannot drift apart
   again.

3. **`bp-list` had dead code beside the bug.** Two template literals were evaluated and discarded
   as expression statements — no-ops, presumably a half-finished address column. Removed; output is
   otherwise unchanged.

`wl` was fixed separately, as planned: it now prints `addr: R0:$8000` rather than
`addr: $8000:-1`, which also puts the partition *before* the address, matching `bp-set` and every
other surface.

New tests: `test/debug/breakpoint-keys.test.ts` (14 cases, including the invariant that a display
key parses as a partition spec and a storage key does not), plus regressions in
`test/commands/BreakpointCommands.test.ts` and `WatchCommands.test.ts`.

Verification: 19,385 node tests, 335 jsdom control tests, renderer type-check at its 165-error
baseline, `lint:renderer` clean, electron-vite build clean.

## 10. Phase 1 implementation notes

The ZX Next now derives partition names in one direction only: offset → index → label. Both
implementations grew a `getPartitionForPage(pageIndex)` — `MemoryDevice.getPartitionForPage` and
`ZxNextWasmV2Machine.getWasmV2PartitionForPage` — and `getCurrentPartitionLabels()`,
`getPartition(address)` and the Memory Mapping panel's `pageInfo` all read it. The offset→name
functions and `parseWasmV2PartitionLabel` are gone, and with them `A0`/`A1` and `D0`..`DF`.

Four things worth recording:

1. **There was a third label→index mapping**, not two. `ZxNextMachine.getPartition` carried its own
   `switch` over `A0`/`A1`/`DM` with a `default: -8 - parseInt(label.substring(1))`. It is now a
   one-line delegation.

2. **The two Next implementations did not even agree with each other.** The TypeScript path
   formatted DivMMC RAM as `D${n}` in *decimal* (`D0`..`D15`) while the WASM path used hex
   (`D0`..`DF`) — so the same page had different names depending on which machine was running, and
   `D10`..`D15` were three characters in a column that reserves two.

3. **`getPartition` got marginally stricter.** It gated on `bank16k === 0xff` while the label
   function gated on `bank16k < 224`; unified on the latter, since 224..254 is outside the
   partition map and a partition index with no label is not a useful answer.

4. **One planned assertion turned out unsound and was replaced.** "Never shows a retired name"
   cannot be tested by string: `A0` and `D5` are legitimate *bank* labels (banks $A0 and $D5 are
   both in range), so a page showing bank $A0 is indistinguishable from the old alt-ROM name. The
   test now pages the alternate ROM in and asserts it reports `Q0` — sound because `Q` is not a hex
   digit. This is the same ambiguity that disqualified `A0`/`D0` as canonical names in §2.

Also fixed, per §1.1: `parsePartitionLabel` normalizes once and uses the normalized value
throughout, so `bp-set m0:$8000` works. All sixteen DivMMC RAM partitions are reachable from the
breakpoint commands for the first time.

New tests: `test/memory/partition-label-round-trip.test.ts` — 21 cases asserting, as a property
over each machine's full index range, that every label parses back to its own index, that it does
so case-insensitively and with surrounding whitespace, and that it fits the bank column. The
existing WASM/TS parity suites continue to pass, which is what guards §8.3's threshold.

Verification: 19,406 node tests, 580 jsdom tests, renderer type-check at its 165-error baseline,
`lint:renderer` clean, electron-vite build clean.

## 11. Phase 2 implementation notes

`getPartitionDescriptions()` is on `IAnyMachine` and both machine bases (returning `{}`), with real
maps on the 128K, +2/+3E, Z88 and Next. `EmuApi` and `MainToEmuProcessor` carry it, and
`derivePartitionOptions(labels, descriptions)` in `memoryViewModel.ts` pairs the two into the
`PartitionOption[]` Phase 3 will render.

Notes:

1. **The C64 needed a stub the plan did not anticipate.** It implements `IAnyMachine` but extends
   `M6510VaCpu`, not either Z80 base, so it inherited no default. Adding the member to the interface
   surfaced that immediately — the stub sits beside its existing empty `getPartitionLabels`.

2. **`group` is two-valued, not three.** §5.4 proposed `"rom" | "special" | "bank"`, but the only
   distinction derivable from the maps alone is the sign of the index: special pages are numbered
   downwards from -1, banks upwards from 0. Splitting ROMs from other special pages would need
   either a per-machine declaration or a hardcoded index range, and how to *lay out* the special
   block is a question Phase 3 is better placed to answer with `BankDropdown` in front of it. The
   Next's 23 special partitions and 224 banks group correctly as it stands.

3. **The Z88's map is a real `Record` now**, not a `string[]` returned as one. Nothing indexed it
   positionally — checked before changing it — and a test now pins the shape.

New tests: `test/memory/partition-descriptions.test.ts` (20 cases). The one worth naming asserts
that **no description parses as a partition label** — the line between identity and presentation,
which is what was crossed when `ALTR0` became a name.

Verification: 19,426 node tests, 580 jsdom tests, renderer type-check at its 165-error baseline,
`lint:renderer` clean, electron-vite build clean.

## 12. Phase 3 implementation notes

Every partition chooser in the IDE is now one control fed by the machine's own maps. `BankDropdown`
takes `PartitionOption[]`; `PartitionPicker` chooses between the list and matrix forms on
`displayBankMatrix` alone; the Memory toolbar, the Disassembly toolbar and the breakpoint dialog all
render it.

1. **There was a third picker site the audit missed.** `DisassemblyToolbars.tsx` carried the same
   machine-id branch inline — so the disassembly view could have offered a different chooser than
   the memory view beside it. It uses `PartitionPicker` now.

2. **`NextBankDropdown` had no callers at all.** Deleted rather than merged.

3. **`PartitionPicker` no longer takes a `machineId`.** The Z88 case and the ZX Next case were the
   same control differing only in the data handed to it, which now arrives as `PartitionOption[]`.
   A new banked machine needs no case added anywhere. The unused `machineId` prop fell out of
   `MemoryBankToolbar`, `DisassemblyBankToolbar` and `BreakpointDialog` as a result.

4. **The 60-entry arrow-key table is gone.** Movement is derived from the rendered rows: left/right
   step through the flat order, up/down move a row and clamp to that row's width — which is what
   makes a 4-wide chip row above a 16-wide bank grid behave sensibly. The table encoded one
   machine's layout in literal indices.

5. **One encoding, not two.** The old control encoded bank values as hex strings and special pages
   as decimal, then parsed each back differently. Every option is now keyed by `String(index)`.

**A visual change worth a look.** Special-page chips show the label with the description beside it
(`Q0  Alt ROM 0`) instead of the old abbreviation (`ALTR0`), and bank cells keep their hex label with
the description on hover. The ZX Next's chip block is four per row rather than one long row, so the
open chooser is slightly taller than before. The information is strictly greater, but the layout is
a judgement call — `SPECIAL_PER_ROW` in `BankDropdown.tsx` is the dial.

New tests: `test/controls/PartitionPicker.test.tsx` (5 cases). Radix renders its list into a portal
only while open, which jsdom cannot drive reliably, so these assert what the trigger shows and which
form is chosen; the grid's contents are covered by the `derivePartitionOptions` node tests.

Updated: the suites pinning `"ROM 0"` / `"BANK 0"` now assert the machine's own labels, and four
setup-hook mocks gained `getPartitionDescriptions`.

Verification: 19,429 node tests, 585 jsdom tests, renderer type-check at its 165-error baseline,
`lint:renderer` clean, electron-vite build clean.

## 13. Phase 4 implementation notes

1. **`DisassemblyItem.partition` is gone**, along with `FetchResult.partitionLabel` that fed it.
   Confirmed unread first: eight write sites, no reader anywhere in `src/` or `test/`. Both writers
   drew from the same source Phase 1 corrected, so this was not yet a sixth vocabulary — it was the
   place one would have started.

2. **`getPartitionedValue()` deleted** — 54 lines of dead parser with its own `"R"`/`"B"`
   partition-type scheme and no callers.

3. **The docs now say it once.** `memory.mdx` carries a table per machine of *name*, *description*
   and what the partition is; `disassembly.mdx` linked to it instead of repeating the list;
   `breakpoints.mdx` and all three `r1:$32ac` copies in `commands-reference.mdx` link to it too. The
   page states the rule the whole plan established — the name identifies, the description explains —
   and records why the Next's alt ROMs are `Q0`/`Q1` rather than `A0`/`A1`.

   The old text documented only the *chooser's* spellings (`NROM0`, `ALTR0`, `DivMR`), which were
   names nothing else used; the labels the views actually printed, and the grammar `bp-set` accepts,
   appeared nowhere.

4. **No new route, so the goldens are untouched.** The table went into `memory.mdx`'s existing
   partition section rather than a new page. `doc:check` still reports the one pre-existing
   unregistered route (`/contribute/wasm-toolchain`, from `f176f2398`) and nothing else — leaving it
   for its author rather than absorbing it here.

Verification: 19,429 node tests, 585 jsdom tests, renderer type-check at its 165-error baseline,
`lint:renderer` clean, electron-vite build clean, `doc:build` + `doc:check` clean across 11,827
internal references.

## 14. What is left

Nothing in this plan. Two things it deliberately did not do, recorded so they are not lost:

- **`Z80Disassembler`'s `partitionLabels` constructor parameter** is now unread by anything inside
  the class. Removing it would change the `CT_DISASSEMBLER` factory signature every machine's
  registry entry implements, which is a wider change than this plan's scope.
- **`getBreakpointStorageKey`'s notation** (`-1:$8000`) remains distinct from the display form. That
  is intentional (§8, decision 4) — it is a stable identity, not a name — but it means two string
  forms still exist, one of them internal-only.

## 15. Follow-up: captioned groups in the bank chooser

Phase 3 put each partition's full description on its chip, which made the ZX Next's chooser sprawl:
"DivMMC RAM" was spelled out sixteen times and the special block ran to four rows.

The noun now lives in a caption above the block instead, so a chip carries only its label again:

```
Next ROM     R0  R1  R2  R3
Alt ROM      Q0  Q1
DivMMC ROM   DM
DivMMC RAM   M0 M1 M2 ... MF
```

- `getPartitionGroups()` joins `getPartitionLabels()` and `getPartitionDescriptions()` as a third
  optional per-machine map, plumbed through `EmuApi` the same way. Explicit rather than derived: a
  caption *could* have been cut off the front of each description, but deriving meaning from a
  display string is the habit this whole plan removed.
- `toCaptionedBlocks` groups **consecutive** options sharing a caption, so the draw order stays
  authoritative and a caption that reappeared later would start a second block.
- RAM banks get no caption. A 16-wide grid of hex indices says what it is, and a caption row there
  would cost the height this change exists to save — but every bank row still draws the empty
  caption column so its cells line up under the chips above.
- Descriptions are unchanged and still indexed (`DivMMC RAM 11`); they are the hover text now rather
  than the chip text.

Docs updated to the group/name shape. 19,441 node tests, 585 jsdom tests, type-check at its
162-error baseline, lint and build clean, docs clean.

### 15.1 Layout correction

The first captioned version used a flex row per block with a hardcoded 72px caption column. It was
wrong in two ways that only a screenshot showed: "DivMMC RAM" overflowed its 72px and ran straight
into the chips beside it, and the blocks did not align with the bank grid at all.

Rebuilt as **one CSS grid** — `max-content` caption column plus sixteen `max-content` cell columns
shared by every row, so a caption sizes itself and `M3` lands above bank `03` without anyone
choosing a pixel width.

One non-obvious detail, found by rendering the markup standalone and looking at it: the grid is
seventeen columns wide, so auto-flow puts each bank row's seventeenth item back in the *caption*
column. Only the first bank row was correct; every row after it slid one cell left. Each row's first
cell is now placed into column 2 explicitly (`index % BANKS_PER_ROW === 0`), not just the first
row's.

### 15.2 `Q0`/`Q1` renamed to `X0`/`X1`

The alternate ROMs' names were opaque — `Q` says nothing about "alternate". `A0`/`A1` remain
disqualified (banks `$A0` and `$A1` are real, so those spellings are ambiguous, §2), so the pick was
a non-hex letter with some suggestion of *alternate*: `X`.

The label map returns `X0`/`X1`, and `parsePartitionLabel` **still accepts `Q0`/`Q1`** as aliases.
That is safe precisely because nothing on disk stores a partition name (§2): a `.kliveproject` keeps
indices, so the only exposure was typed commands and scripts, which the alias covers. Two tests pin
the asymmetry — the alias parses, and the map does not offer it back.

Also added: `RAM Banks` as the caption beside the bank grid's first row, on the Next and the Z88.
Putting it to the *left* rather than above costs no height, which was the only reason it had been
left unlabelled.
