# NEX Debugging: the Follow-up Plan

**Status:** proposed (2026-11-04). Nothing started.

NEX debugging is built (`dev/ai/nex-debugging.md` is the record: decisions Q1-Q9, the breakpoint model,
the sidecar, the launch, the paused machine). This plan holds what the first round left. It was
written from the two closed documents (`dev/plans/NEX_DEBUGGING_IDEAS.md`, `dev/plans/NEX_DEBUGGING_PLAN.md`,
in git history) after checking each open item against the code on 2026-11-04. Items done since those
documents were last updated are not here: the `bp-set <bank>:<label>` grammar, the live
Disassembly row menu and its label editing, the annotation regions shaping the live disassembly,
labels in the Call Stack, "Debug (break at entry)" in the menus, `DebuggerState.schemaVersion`, the
sidecar's IO split.

The decisions and non-goals of `dev/ai/nex-debugging.md` bind this plan unchanged.

---

## 1. Prove it in the running app (do first)

**Why first:** nothing in the first round's Phases 5-8 was seen working in the app. Every headless
layer is tested, but the original plan's own acceptance test was never run: *set a breakpoint in a
popped-out bank, launch, and stop there.* A defect found here changes what the other phases are worth.

1. Write `dev/scripts/nex-ide-check.cjs` in the style of `dev/scripts/boriel-ide-check.cjs` (Playwright through
   `dev/scripts/doc-shots/harness.cjs`, a throwaway home, a NextZXOS card image, a fixture `.nex` with a
   `.nex.dis` sidecar). Build the fixture with Klive's own assembler (`.model Next`, a `.bank` section,
   a global and a local label), so the test owns its input.
2. Parts, each printing PASS/FAIL:
   - `gutter`: pop out a bank, click the gutter at an offset, `nex-run -d`, the machine pauses there;
     the breakpoint is in the sidecar's `debug.breakpoints` and survives a restart.
   - `entry`: **Debug (break at entry)** pauses at the header's entry point, bank paged in.
   - `run-to`: `run-to 05:+$0100` from a pause stops there.
   - `watch`: a bank write watchpoint set in the breakpoint dialog stops on the write.
   - `readouts`: while paused, the popped-out bank says where it is paged, marks changed bytes, and
     spotlights the PC; the Memory Mapping tooltip names the NEX.
   - `symbols`: the live Disassembly view names an operand with the sidecar's label.
   - `label`: `nex-label Found` at a pause writes a local label (with no viewer open: into the file;
     with one open: into the session, unsaved); a label-anchored `bp-set [x.nex.dis]:05:Found` stops.
3. Each failure is a defect to fix in this phase, with a unit test that fails before the fix.

**Done when** every part passes twice in a row, and the check is listed in `AGENTS.md` beside the
other IDE checks.

## 2. Labels in the Watch panel

The Call Stack, profiler and execution history name addresses through the annotation layer
(`useAddressSymbols`); the Watch panel does not.

- Decide what a watch row shows: the watched address's label beside the value, and a label as the
  watch expression (`Score` resolving through the active annotation set as `$C010` does today).
- Use `useAddressSymbols`; no NEX-specific code in the panel. A local label resolves only while its
  bank is paged (`bankSiteAtAddress`); say so in the row rather than show a stale address.
- Tests: the panel's view model with a fixture annotation set (global label, local label paged and
  not paged).
- Docs: the Watch section of the debugging guide.

## 3. Tests the first round owed

1. **A component test that a gutter click issues the right command** (`bp-set 05:+$0100`, then
   `bp-del` on the second click, `bp-en` on a disabled one), and that a watchpoint row's name has no
   `:W` suffix. `test/renderer/nexBankGutter.test.ts` covers only which breakpoint a row shows.
2. **Re-partition the `StaticMemoryDump` DOM suite** (step 6 of `dev/ai/ui-mvc-guide.md`'s recipe): the
   DOM tests still assert rules the headless layers own (region algebra, label bookkeeping, menu
   enablement). Move each such assertion to the headless test that owns the rule, keep in the DOM
   suite only what needs React, and name in the commit every DOM test removed and the test that
   replaces it.

## 4. Launch options (Q4)

Q4 decided that launch options persist in the sidecar, beside the bank breakpoints. Only
break-at-entry exists, as a menu choice and `nex-run -e`. The ideas named two more:

| Option | Meaning | Default |
| --- | --- | --- |
| SD target folder | where on the card the file is copied (today `_klive/`) | `_klive/` |
| Boot | warm (restore the `zxnext-boot` checkpoint, today) or cold (boot NextZXOS from reset) | warm |
| Break at entry | as `-e` | off |

- Stored as `debug.launch` in the sidecar, written immediately like `debug.breakpoints` (the
  read-merge-write rule of `dev/ai/nex-debugging.md`, "The sidecar"); `nex-run` options override them.
- A cold boot is also the fix for the named, never-observed stale-checkpoint risk (a checkpoint taken
  before the card changed): offer it, do not change the default.
- **Decide before building:** whether a launch-options UI is worth it (a small form in the NEX
  viewer's toolbar), or whether `nex-run` options plus the sidecar suffice. Ask the author.
- Tests: the sidecar round trip (schema 2 with and without `launch`, an old file untouched until a
  change), `nex-run` option precedence, a cold boot reaching the `.nexload` prompt (slow tier).

## 5. Documentation screenshots

The NEX guide (`docs/content/en/guides/next/nex-files.mdx`) has one shot, the viewer. Add, through a
`guides-*` recipe (`dev/ai/doc-screenshots-guide.md`; generated, never hand-captured; dark theme):

- a popped-out bank paused at a gutter breakpoint, with the PC spotlight and the "Bank at" readout;
- the bank's changed bytes marked against the file;
- the breakpoint dialog creating a bank watchpoint.

Uses §1's fixture. Within the page's 1.5 MB budget.

## 6. Cleanups

1. `ExecutionContext.terminationPartition` is written (`MachineController.ts`) and read by no machine:
   remove it, or make the machines honour it. Check `UntilExecutionPoint` callers first; run-to-cursor
   deliberately does not use it.
2. **Type-check `test/`** (found by the first round: three tests passed a bare string where a
   `BreakpointScope` is required, and nothing told them). Measure the cleanup first: add a third
   project to `dev/scripts/check-types.cjs` over `test/**`, record the error count in
   `build/type-errors-baseline.json`, and decide with the author whether to burn it down here or in
   its own change. It is project-wide, not NEX work, and may well become its own plan.

## 7. Not in this plan

The non-goals of `dev/ai/nex-debugging.md` stand: no direct NEX loader (so `ZxSpectrumBase`'s banked
injection TODO stays), no machine but the Next, not a NextZXOS/esxDOS debugger, not a NEX editor, no
8K-bank NEX files, no automated reverse engineering.

## 8. Order and gates

1 → 3.1 (it tests what §1 exercises) → 2 → 5 (needs §1's fixture) → 4 (after the author's answer) →
3.2 and 6 (any time; independent).

Each phase: focused tests, `npm run build:check`, `npm run lint:renderer` for renderer work, and the
electron-vite build. A phase that changes the sidecar adds a round-trip test that an old file loads
and is written only when something changes. One `feature` changeset when the plan completes (§2 and
§4 are user-visible; §1's fixes are `fix` lines folded into it); none for the phase commits.
