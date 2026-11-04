# Debugging a NEX file: decisions and how it is built

Klive debugs a ZX Spectrum Next `.nex` file at the bank level: launch any `.nex` (`nex-run`), set
breakpoints and watchpoints relative to a NEX 16K bank, stop at the entry point, run to a cursor,
see where a bank is paged and how it differs from the file, name addresses with the file's
annotations, and break on annotation labels. It was built in nine phases from an idea collection and
a plan, both closed on 2026-11-04 (git history: `.plans/NEX_DEBUGGING_IDEAS.md`,
`.plans/NEX_DEBUGGING_PLAN.md`). What is left is `.plans/NEX_DEBUGGING_FOLLOWUP_PLAN.md`. Read this
before changing `DebugSupport`, the breakpoint model, `src/renderer/appIde/DocumentPanels/Next/` or
the NEX launch. Source-level debugging of a compiled NEX (its sidecar) is
`dev/patterns/source-debugging-model.md`.

## Decisions (Q1-Q9)

| # | Decision |
| --- | --- |
| Q1 | **`.nexload` typing only.** No direct NEX loader: the program starts the way NextZXOS starts it. `ZxNextMachine.injectCodeToRun`'s banked-segment TODO stays, and `MF_INJECT_SUPPORT: false` is correct. |
| Q2 | Bank breakpoints are **a bank-relative breakpoint kind checked against the 8K page** (the plan's "R3"), with no intermediate stage. |
| Q3 | **Label-anchored breakpoints** are in scope. |
| Q4 | Bank breakpoints (and launch options, once built) persist in the **`.nex.dis` sidecar**, so a NEX debugs with no project open. |
| Q5 | The entry-point stop is a **session-owned one-shot breakpoint**, armed before the injection flow. |
| Q6 | `bp-set` grammar: `<bank>:+<offset>` and `<bank>:<label>`. |
| Q7 | The popped-out bank is **live-capable**; the annotation UI left `StaticMemoryDump.tsx`. |
| Q8 | **ZX Spectrum Next only**: no 128K bank breakpoints, no snapshot debugging, no speculative seams. |
| Q9 | **A positive Next partition index means an 8K page** (`0..223`), never a 16K bank. |

## The partition convention (Q9), the decision everything rests on

The same index once meant a 16K bank on the breakpoint path (`getPartitionForPage` returned
`bank8k >> 1`) and an 8K page on the memory path (`getMemoryPartition`, the label space, `MF_BANK:
224`, the docs). Q9 made every reporter answer in 8K pages: `getPartitionForPage`,
`MemoryDevice.getPartitions()` and their WASM twins (`ZxNextWasmV2Machine`). Three test helpers had
been doubling the 16K answer by hand to read memory; that was the proof. `wasm-next-partition-labels`
tests pin both cores to the 8K answer, and agreeing with each other.

- It removed the feature's hardest problem: a 16K partition cannot tell a bank's low half from its
  high half, so a breakpoint at bank 5 offset `$0100` would also have fired where bank 5's *high* half
  is paged. With 8K partitions the halves are different partitions. **That false-positive test stays**
  (`test/debug/BankRelativeBreakpoints.test.ts`): the property is now emergent from the granularity,
  and a change to it would break it silently.
- User-visible: the Disassembly bank column shows 8K pages, and `bp-set 05:$C000` on the Next means 8K
  page 5. `DebuggerState` carries a `schemaVersion` (`projects.ts`) so the next such change can migrate.
- **A NEX bank is still 16K** (`NEX_BANK_SIZE = 0x4000`): the user-facing unit stays the 16K bank, and
  `bank`/`bankOffset` are separate fields from `partition`. In keys and `bp-set`, the bank of a
  bank-relative or label form is a plain hex NEX bank (`00`-`6F`) that **must not** go through
  `getPartitionLabels()`/`parsePartitionLabel`: those describe 8K pages.
- Machines duplicate 16K slots in `mem64kLabels` (one entry per 8K page; the 128K returns
  `[slot0, slot0, slot1, ...]`), so `address >> 13` indexing is right and a fixture with fewer than eight
  entries is under-specified.

## The breakpoint model

`BreakpointInfo` (`src/common/abstractions/BreakpointInfo.ts`) has four shapes, keyed by
`buildBreakpointKey` (`src/common/utils/breakpoints.ts`; storage form uses the partition index,
display form its label, and the display form is exactly what `bp-set` accepts, so `bp-list` and
`BreakpointIndicator` round-trip):

| Shape | Fields | Storage key | Display key |
| --- | --- | --- | --- |
| address | `address`, `partition?` | `$C000`, `5:$C000` | `$C000`, `05:$C000` |
| source | `resource`, `line` | `[main.asm]:12` | same |
| bank-relative | `bank`, `bankOffset` (no `address`) | `5:+$0100` | `05:+$0100` |
| label-anchored | `label`, `labelFile`, `bank?` | `[Game.nex.dis]:5:DrawSprite` | `[Game.nex.dis]:05:DrawSprite` |

- **Ownership** (`owner`: `project`, `nex` with its sidecar, or `session`; absent = project). Every
  breakpoint has exactly one persister. `resetBreakpointsTo(bps, scope)` takes a **required**
  `BreakpointScope`: it removes what the scope owns and stamps its owner on what it adds; `{kind:"all"}`
  keeps each breakpoint's own owner and is the only scope that clears session ones. Opening a project
  used to wipe every breakpoint it did not hold; the project's save is now filtered to project-owned
  and its load scoped. A machine change drops session-owned breakpoints. Helpers
  (`breakpointMatchesScope`, `withScopeOwner`, `isBankRelative`, `bankRelativePartition`,
  `bankRelativeAddresses`) live in the dependency-free `src/common/utils/breakpoint-scope.ts`, because
  main needs them and `breakpoints.ts` imports renderer code. **Passing a bare string where a
  `BreakpointScope` is required returned `undefined` and turned the replace into an append**: the
  scope is an object, always.
- **Ownership is not identity.** Two open NEX files that break bank 5 offset `$0100` make one
  breakpoint, last writer owning it: right at run time (one machine, one bank 5), accepted for
  persistence. Label-anchored breakpoints are file-qualified, because a label means different offsets
  in different sidecars.
- **Why ownership and not a kind-based filter:** filtering "NEX breakpoints" out of the project save by
  their shape would store a project's own bank-relative breakpoints nowhere. One home per breakpoint is
  the rule.
- **Bank-relative breakpoints reuse the partition mechanism.** One breakpoint is registered at the
  eight candidate addresses `slot * 0x2000 + (bankOffset & 0x1FFF)`, each as an ordinary
  partition-scoped entry for `page8 = bank * 2 + ((bankOffset >> 13) & 1)`. That conversion lives in
  one place. Partition entries are `[partition, disabled, tag?]`: the tag (provenance) lets a user's
  `bp-set <page>:<addr>` and a bank breakpoint share an address and be added, removed and enabled
  independently. The read paths ask `some((p) => p[0] === partition && !p[1])`, so a disabled entry
  cannot mask an enabled one. Memory read/write bank watchpoints come with it.
- **One flags word, one authority.** `breakpointFlags[address]` is shared by every breakpoint at that
  address; `refreshFlagsAt(address)` derives it from the definitions, and every mutation calls it.
  Assigning or masking the word in place broke a co-located breakpoint each time (`addBreakpoint`,
  `resolveBreakpoint`, `resetBreakpointResolution`, `removeBreakpoint` all did, silently). "Disabled" is
  decided per kind from whether every contributor is disabled. `addBreakpoint` must carry every field
  (`owner`, `disabled`, `hitCount`, `partition`); rebuilding the definition field by field is how three
  of these defects happened. `test/debug/BreakpointFlagIntegrity.test.ts` pins it.
- **A breakpoint in partition 0** never fired while a check read `if (partition)`; compare with
  `!== undefined`. Bank 0 is a real NEX bank.
- **One-shots** (`oneShot`, always session-owned, never persisted) are removed the first time they fire
  (`consumeOneShotsAt`) and bump the breakpoints version like any mutation. The entry stop and
  run-to-cursor both use them. A session stop is looked up from the definitions, not from a cached
  address set (a set keyed by address answers "session" for a user breakpoint sharing it).
- **Label-anchored:** identity is the label; the site is only ever resolved (`resolvedPartition`,
  `resolvedBankOffset`), so a rebuild that moves the routine leaves the key alone. A local label
  resolves to a bank-relative site, a global one to an address.
- **Source breakpoints carry the compiler's bank:** a list-file item's `segmentIndex` joins
  `compilation.result.segments`, whose `.bank` sections give `bank`/`bankOffset`, so a breakpoint on a
  line in one `.bank` section no longer fires in another assembled at the same addresses.

## The sidecar (`<name>.nex.dis`, `programAnnotations.ts`, `annotationSidecar.ts`)

Schema 2 has **two independently saved subtrees**: the annotations (`source`, `globalLabels`, `banks`)
save explicitly, when the user asks; `debug` (`breakpoints`, `labelBreakpoints`) is written on every
change. **Both writers read, merge and write disjoint subtrees** (`saveDebugSubtree`,
`saveAnnotationSubtree` in `src/renderer/appIde/annotations/annotationSidecar.ts`), so neither
clobbers the other; getting this wrong loses user data
silently. Schema 1 still reads (normalised with an empty `debug`) and is rewritten only when something
is saved. Label-anchored breakpoints are stored in their own field, because storing a resolved one as a
bare bank and offset would lose the label that is its identity. The subtree counts both halves before
deciding it is empty.

## Launching (`nex-run <file> [-d] [-e]`, `NexLaunchCommand.ts`)

- One command behind the Explorer's **Run / Debug / Debug (break at entry)**, the document tab's
  buttons (`NexLaunchContextMenu.tsx`) and scripts, so they cannot drift. It copies the file to the SD
  card under `_klive/` (`nex-launch-paths.ts`) and types `.nexload`; `codeToInject` is
  `{ model, segments: [], options: {} }`, because the Next's flow has a `KeepPc` step and no inject step.
- **The boot checkpoint already survives a launch.** `invalidateCheckpoints()` runs only when the
  *emulated machine* writes a sector (or ROMs are uploaded); `invalidateSdCardHandler()`, which a
  host-side copy calls, only closes main's file handle. Named risk, never observed: a checkpoint taken
  before the card changed restores NextZXOS's older view of the card. `.nexload` does a fresh directory
  lookup, and the fix if it shows is to invalidate the checkpoint on a host-side write.
- **The entry stop** (`-e`): `getEntryPointBreakpointSite(header)` (`nexEntryState.ts`) gives the entry
  bank and `programCounter & 0x3FFF`, or nothing below `$4000` (ROM at hand-over: a warning, the run goes
  on). It is armed before the flow; the flow starts the machine in `NoDebug`, in which the
  per-instruction callers skip the breakpoint decision, so no user breakpoint fires during the typing.
- The header is read on every launch (`readNexHeader`), for the entry stop and the bank provenance
  record (`nexLoadSession.ts`).
- **Run to cursor** (`run-to`/`rtc`, `RunToCursorCommand`) is a session one-shot that inherits
  `bp-set`'s address grammar, `<bank>:+<offset>` included; not `UntilExecutionPoint`.
- **Pre-launch validation** (`nexValidation.ts`, shown in `NexFileViewerPanel.tsx`): `entry-bank-missing`,
  `entry-point-bank-missing` (an entry at `$4000`/`$8000` runs from bank 5 or 2, not the entry bank),
  `entry-point-in-rom`, `stack-in-rom` (errors); `core-too-old` (against `EMULATED_CORE_VERSION`,
  exported from `NextRegDevice.ts`), `bank-count-mismatch` (warnings). The `fullRamRequired` rule can
  never fire on today's Next (224 banks always) and is tested only on a synthetic context.

## The paused machine (the popped-out bank and the panels)

- `nexEntryState.ts` is the canonical NEX entry-state map (pure; extracted from the viewer panel).
  When the entry bank *is* bank 5 or 2 the bank is paged twice, so bank → address is not a function.
- **The bank gutter**: a row names its bank-relative breakpoint by its key, and
  `BreakpointIndicator` builds `bp-set`/`bp-del`/`bp-en` from that name. Name it by the **storage form
  without the kind suffix**: a display key ending `:W` made a watchpoint unremovable.
  `selectBankRowBreakpoint` picks among several at one offset: execution first, then enabled.
  Watchpoints are created in the breakpoint dialog (the gutter's double-click); right-click toggles,
  app-wide. The viewer shows a per-bank badge, because bank rows are collapsed by default.
- **The popped-out bank shows the machine** whenever there is one (memory and disassembly, with the
  bytes that differ from the file marked and counted, `nexLiveBank.ts`); the file's bytes are the
  fallback. A switch was tried and removed: a bank opened to debug a program must show what runs.
- "Bank at `$8000`" / "Bank not paged in" (`nextBankLocation.ts`, through `useEmuStateListener`), and
  the PC spotlight (`bankOffsetOfAddress`, the inverse).
- **Memory Mapping** names the launched NEX in a page's tooltip when the slot holds a bank the file
  declares. **RAM has no provenance**: it says the bank is one the file declares, not that the bytes
  came from it. (Fixed there: the all-RAM readout's `allRamsBanks`/`allRamBanks` name mismatch, and a
  "16K bank" column that held the 8K page.)
- **Live symbols:** a NEX's labels name operands in the live Disassembly view (`nexLiveSymbols.ts`;
  `bankSiteAtAddress` inverts the paging map, the 8K page's low bit giving the bank's half). The
  annotations source is read during render from the launch session, which changes once per launch.
  The general annotation layer (`src/renderer/appIde/annotations/`, `useAddressSymbols`) now feeds the
  Call Stack, profiler and execution history too, and its regions (`bytes`/`words`/`skip`) shape the
  live disassembly (`annotatedDisassembly.ts`).
- **`nex-label <name> [<address>]`** (`nl`, `nexLabelPromotion.ts`) names where the machine stopped, as
  a **local** label of the bank paged there, refused for a bank the file does not declare. It needs a
  pause unless an address is given. With a viewer open the edit joins the annotation session (saved
  when the user asks); without one it goes through `saveAnnotationSubtree`. The live Disassembly
  view's row menu also edits labels, through the general annotation layer (`liveAnnotationEditing.ts`).

## Non-goals (still binding)

Direct NEX loading (Q1); anything but the Next (Q8); a NextZXOS or esxDOS debugger; a NEX editor (the viewer is read-only, the sidecar is
the writable surface); 8K-bank NEX files (NEX is a 16K-bank format); automated reverse engineering.
Conditional breakpoints and logpoints were kept out as a separate feature; they have since shipped
on their own (`BreakpointInfo.condition`).
