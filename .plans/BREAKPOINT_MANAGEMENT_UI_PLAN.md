# Breakpoint Management UI Plan

Status: **implemented** — Phases 1-4 complete (see §11 for what was deliberately skipped)
Scope: renderer only (`src/renderer`), plus one docs page and new icon assets
Related docs: `.docs/dialog-pattern.md`, `.docs/dialog-mvc-pattern.md`

## 1. Problem

Every way to *create or change* a breakpoint today is either a typed command or a single-gesture
toggle. There is no way to author one.

**Commands** (`src/renderer/appIde/commands/BreakpointCommands.ts`):

| Command | Aliases | What it does |
| --- | --- | --- |
| `bp-set <addr-spec> [-r] [-w] [-i] [-o] [-m <mask>]` | `bp` | create/update |
| `bp-del <addr-spec> [-r] [-w] [-i] [-o] [-m <mask>]` | `bd` | remove |
| `bp-en <addr-spec> [-r] [-w] [-i] [-o] [-d] [-m <mask>]` | `be` | enable / disable |
| `bp-list` | `bpl` | list |
| `bp-ea` | `eab` | erase all |

**Gestures** (`BreakpointsPanel.tsx`, `BreakpointIndicator.tsx`): the indicator's checkbox toggles
enabled, right-clicking the indicator removes, clicking the address navigates to source. Nothing
else.

So to place a memory-write watchpoint at `r1:$32ac`, or to change an I/O breakpoint's port mask, a
user must know the flag grammar, the partition-label syntax, and which flag combinations are legal.
The rules are real and non-obvious — `BreakpointWithAddressCommand.validateCommandArgs`
(`BreakpointCommands.ts:102-205`) rejects more than one of `-r/-w/-i/-o`, rejects `-m` without
`-i`/`-o`, rejects a partition together with an I/O breakpoint, and rejects partitions entirely on
machines without `MF_ROM`/`MF_BANK` — and none of them are discoverable from the UI.

**Goal:** author and edit **binary (address-bound) breakpoints** from a modal dialog, and manage the
set (add, edit, toggle, remove, remove all) from the Breakpoints panel, without changing or
deprecating the commands.

## 2. The data being edited

A `BreakpointInfo` (`src/common/abstractions/BreakpointInfo.ts`) is either **address-bound** —
`address` (+ optional `partition`) — or **source-bound** — `resource` + `line`. Never both:
`getBreakpointKey` (`src/common/utils/breakpoints.ts:11`) branches on exactly that and throws if
neither is present.

**This dialog authors address-bound breakpoints only.** Source-bound breakpoints stay owned by the
Monaco glyph margin (`MonacoEditor.tsx:1063-1075`, gated on `languageInfo?.supportsBreakpoints`),
which already places and removes them by clicking a line, tracks them as lines move
(`scrollBreakpoints`), and carries its own undo/redo stack over `resetBreakpointsTo`. A dialog that
asked a user to type a filename and a line number would be a strictly worse way to do something the
editor already does well — and it would need a second, divergent path through
`getBreakpointAddressInfo` to validate what the gutter validates by construction.

So the fields, for a binary breakpoint:

| Field | Owner | In the dialog? |
| --- | --- | --- |
| `address` | user | yes |
| `partition` | user | yes — when the machine has partitions, and not for I/O kinds |
| `exec`, `memoryRead`, `memoryWrite`, `ioRead`, `ioWrite` | user | yes — one "kind" radio |
| `ioMask` | user | yes — I/O kinds only |
| `disabled` | user | yes — checkbox |
| `resource`, `line` | user, **via the editor gutter** | no — out of scope |
| `resolvedAddress`, `resolvedPartition`, `hitCount` | emulator | no — read-only display |

Dropping source mode removes a whole axis: memory and I/O breakpoints are address-only anyway, so
with `exec` also address-only the dialog has **no mode switch at all** — one flat form.

One fact still shapes the design: **a breakpoint has no id.** Its identity is its
`getBreakpointKey(bp)`, derived from address+partition+kind. Therefore *editing is remove-then-set*,
and an edit that changes any key component can collide with an existing breakpoint. §5.3 handles
this.

## 3. Non-goals

- No change to the five commands, their grammar, or their aliases. The dialog is a second front
  door onto the same `EmuApi` calls.
- No conditional breakpoints, hit counts as a *condition*, or log points. `BreakpointInfo` has no
  room for them; adding them is a separate plan.
- **No authoring of source-code breakpoints** (§2). The editor gutter keeps that job. The dialog
  never sets `resource`/`line`, and never opens against a source-bound breakpoint.
- No change to how source-bound breakpoints resolve (`refreshSourceCodeBreakpoints`), scroll with
  edits (`scrollBreakpoints`), or undo/redo (`resetBreakpointsTo`).

## 4. Architecture decision: plain dialog + pure logic module

`.docs/dialog-mvc-pattern.md` says explicitly: use the MVC split when a dialog has *async
orchestration plus derived display rules*, and leave one-question dialogs
(`SetMemoryDialog`, `RenameDialog`) on the plain pattern. This dialog sits between the two — it has
no interleaving async work, but it does carry a real decision table (§2, and the four rejection
rules from `validateCommandArgs`).

**Decision:** plain dialog pattern (`useDialogs().open(...)` → `Modal` → `DialogForm`, exactly like
`SetMemoryDialog.tsx`), with **every rule extracted into a pure, React-free module** that runs in
the fast `node` vitest project. This borrows the one property of the MVC pattern that pays for
itself here — decisions testable without mounting React — without the Intent/Event ceremony.

The async inputs (partition labels, the existing breakpoint list, machine features) are **resolved
by the caller before the dialog opens** and passed in as one `BreakpointEnvironment` object. This
follows the MVC doc's rule that "Redux state is not a port, it is data": no layer below the opener
knows about `EmuApi` or Redux, and tests construct the environment as a literal.

If the dialog later grows genuinely interleaving async work (live symbol lookup, say), migrating it
to `src/renderer/mvc/` is mechanical, because the model is already pure.

## 5. Design

### 5.1 The pure module — `src/renderer/appIde/utils/breakpoint-form.ts`

```ts
export type BreakpointKind = "exec" | "memRead" | "memWrite" | "ioRead" | "ioWrite";

export type BreakpointFormState = {
  kind: BreakpointKind;
  address: string;        // raw text: "$32ac" | "12972" | "%0011..."
  partition: string;      // partition label, or "" for none
  ioMask: string;         // raw text, I/O kinds only
  disabled: boolean;
};

export type BreakpointEnvironment = {
  partitionLabels: Record<number, string>;   // emuApi.getPartitionLabels()
  supportsPartitions: boolean;               // MF_ROM || MF_BANK on the current machine
  existingKeys: string[];                    // getBreakpointKey() of every current breakpoint
  editingKey?: string;                       // the key being edited, excluded from collision check
};

export type FieldErrors = Partial<Record<keyof BreakpointFormState, string>> & {
  form?: string;   // cross-field error, e.g. duplicate key
};
```

Five fields, no mode, no project dependency, no async resolver — the environment is a plain data
literal a test can write by hand.

Four pure functions:

- `parseNumericInput(text): { value: number } | { error: string }` — wraps the existing
  `parseCommand` + `getNumericTokenValue` from `services/command-parser` and `services/ide-commands`
  so the dialog accepts *exactly* the literal forms the commands accept (`$1234`, `1234`, `%0101`,
  `1_234`). **Reuse, do not reimplement** — a second number parser that drifts from the command
  parser is the failure mode to avoid here.
- `validateBreakpointForm(form, env): FieldErrors` — the whole decision table, per-field.
- `formToBreakpointInfo(form, env): BreakpointInfo` — only valid on an error-free form. Never emits
  `resource`/`line`.
- `breakpointToForm(bp, env): BreakpointFormState` — the inverse, for the edit path. Its input is
  narrowed to address-bound breakpoints; add an `isBinaryBreakpoint(bp)` type guard
  (`bp.address !== undefined`) beside it and let the callers in §5.4 gate on it, so a source-bound
  breakpoint cannot reach the dialog at all.

**Rules encoded in `validateBreakpointForm`,** each traceable to a command-side rule:

| Rule | Command-side source | How the UI expresses it |
| --- | --- | --- |
| exactly one kind | `bpOptions > 1` check, `BreakpointCommands.ts:191` | structural — a radio group, so unrepresentable |
| `ioMask` only with I/O kinds | `BreakpointCommands.ts:194` | structural — field hidden unless `kind` is `ioRead`/`ioWrite` |
| no partition on I/O breakpoints | `BreakpointCommands.ts:197` | partition control disabled + explanatory hint for I/O kinds |
| partitions need `MF_ROM`/`MF_BANK` | `BreakpointCommands.ts:150-158` | partition control absent when `!env.supportsPartitions` |
| address must parse | `BreakpointCommands.ts:129-186` | field error from `parseNumericInput` |
| address in `0..0xffff` | implied by `& 0xffff` masking | field error rather than silent truncation |
| **new:** no duplicate key | *not checked today* | form-level error (see §5.3) |

The command's source-line branch (`[file]:line` → `getBreakpointAddressInfo`,
`BreakpointCommands.ts:117-124`) has **no counterpart here** — that is the §2 scope decision. The
dialog's address field rejects a `[…]` spec outright with "Set source-code breakpoints from the
editor's left margin."

The duplicate check is genuinely new. `bp-set` on an existing key silently updates it (that is why
it reports "set" vs "updated"), which is fine for a command but is a footgun in an edit dialog where
it would look like a rename and act like a merge.

### 5.2 The dialog — `src/renderer/appIde/dialogs/BreakpointDialog.tsx`

Use the **managed-body form**, which `.docs/dialog-pattern.md` names the preferred shape for new
dialogs: the component takes `DialogComponentProps<BreakpointDialogResult>` and the provider owns
the `Modal` frame. `RenameDialog.tsx:17-45` is the canonical 45-line example.
`SetMemoryDialog.tsx` uses the older custom-renderer form; copy its *field layout*, not its shell.

Body content is `DialogForm` → one row per field, using the existing primitives (`TextInput` with
its `error` prop, `Dropdown`, `Checkbox`). Prefer `DialogField`
(`src/renderer/controls/DialogField.tsx:14`) over bare `DialogRow` for the validated fields — it is
purpose-built for `label` + `required` + `helpText` + `error` and emits a real `<label>` plus
`role="alert"`. It is currently unused by any dialog and exercised only by
`test/controls/DialogForm.test.tsx:40`, so expect to shake out small gaps on first real use; fall
back to `DialogRow` + `TextInput`'s own inline error (the pattern every shipped dialog uses) if it
fights back. No new control primitives are needed except a radio group (§7).

Since `DialogForm` renders its own footer, the managed `Modal` must not render a second one — the
provider already passes `primaryVisible={false}` and friends for managed bodies; a container that
renders its own `Modal` (as the MVC dialogs do) must pass `footerVisible={false}` explicitly.

```
┌─ Add breakpoint ───────────────────────────────────┐
│ Type   ( ) Execution   ( ) Memory read              │
│        ( ) Memory write                             │
│        ( ) I/O read    ( ) I/O write                │
│                                                     │
│ Partition [ (none) ▾ ]   Address [ $32ac         ]  │
│                                                     │
│ Port mask [ $00ff ]                                 │  ← I/O kinds only
│                                                     │
│ [x] Enabled                                         │
│                                                     │
│                             [ Cancel ]  [ Add ]     │
└─────────────────────────────────────────────────────┘
```

Four rows, one of them conditional. That is the whole dialog.

- **Type** is a radio group, not a dropdown: five mutually exclusive options, two of which change
  which other fields exist. Making the branch visible is the point.
- **Partition** is a `Dropdown` fed from `env.partitionLabels`, with a `(none)` option; it is absent
  when the machine has no partitions and disabled for I/O kinds.
- **Address** is the only required field. Its placeholder shows the accepted forms (`$32ac`,
  `12972`, `%0011…`).
- **Enabled** is shown positively even though the model field is `disabled`; the mapping happens in
  `formToBreakpointInfo`.
- Title and submit label switch on add/edit: "Add breakpoint" / "Add" versus "Edit breakpoint" /
  "Save".
- On the edit path, `hitCount` renders as a read-only footnote row when present — the emulator owns
  it, so it is shown but not editable. `resolvedAddress`/`resolvedPartition` are source-breakpoint
  concepts and never appear, since the dialog never opens on one.

Props, following the plain pattern:

```ts
export type BreakpointDialogResult = {
  breakpoint: BreakpointInfo;
  replaces?: BreakpointInfo;        // the pre-edit breakpoint, when editing
};

type BreakpointDialogProps = DialogComponentProps<BreakpointDialogResult> & {
  initial?: BreakpointInfo;         // absent = add, present = edit
  env: BreakpointEnvironment;
};
```

It settles through `controls.close(result)` / `controls.cancel()`. The dialog returns data; it
performs no `EmuApi` calls itself.

### 5.3 Applying a result — `src/renderer/appIde/utils/breakpoint-actions.ts`

One place that turns a `BreakpointDialogResult` into `EmuApi` calls, shared by the panel, the
disassembly view, and any future caller:

```ts
export async function applyBreakpointEdit(emuApi: EmuApi, result: BreakpointDialogResult)
```

- **Add:** `setBreakpoint(bp)`, then `enableBreakpoint(bp, !bp.disabled)` when the user unchecked
  Enabled — `setBreakpoint` does not carry the disabled flag.
- **Edit:** the key may have changed, so this is remove-then-set. Do **not** do it as two bare calls:
  `EmuApi.restoreBreakpoints` exists precisely because "erasing and re-adding breakpoints one by one
  lets concurrent breakpoint edits be lost between the individual calls"
  (`src/common/messaging/EmuApi.ts:240-245`). Read the current list, apply the swap in memory, and
  push it back with `restoreBreakpoints`. Its doc comment says it preserves each breakpoint's
  disabled state, so re-assert the edited breakpoint's own `disabled` afterwards with
  `enableBreakpoint`.
- **Edit that does not change the key** (only `disabled` or `ioMask` moved): fall back to plain
  `setBreakpoint` + `enableBreakpoint`. Cheaper and avoids a whole-set write for a toggle.

Verify the `restoreBreakpoints` claim against `test/debug/RestoreBreakpoints.test.ts` before relying
on it; if it does not in fact preserve `disabled`, the plan is unchanged but the re-assert step
becomes mandatory rather than defensive.

### 5.4 Panel integration — `BreakpointsPanel.tsx`

**A toolbar strip inside the panel body**, above the `VirtualizedList`:

- `+` **Add breakpoint…** — opens the dialog in add mode
- `clear-all` **Remove all breakpoints** — a plain `eraseAllBreakpoints()` call, behind a
  `ConfirmDialog` (`src/renderer/mvc/dialogs/ConfirmDialog.tsx`), since it is unrecoverable

**Remove all keeps `bp-ea` semantics exactly: it erases every breakpoint, source-bound ones
included.** One command, one meaning, whichever front door you came through — a panel button that
quietly erased less than `bp-ea` would be the worse surprise, and there is no second API for a
partial erase.

But the §5.4 split makes this the one place where the panel does something the dialog's scope would
not predict, so the confirmation has to say so rather than ask a bare "Are you sure?". Count the two
kinds and name them:

> Remove all 7 breakpoints? This includes 3 source-code breakpoints set in the editor. This cannot
> be undone.

Drop the second sentence when no source breakpoints are present. This is the entire cost of keeping
the semantics aligned, and it is cheap.

`SideBarPanelInfo` (`src/renderer/abstractions/SideBarPanelInfo.ts`) has **no header-action support**
and `SideBarPanel.tsx` renders only a chevron and a title. Putting the toolbar in the panel body is
the change that touches nothing shared. Extending `SideBarPanelInfo` with `headerActions` is the
better long-term shape — several other panels would use it — but it is a separate, wider change and
should not gate this one. Flag it as follow-up work.

**A row context menu** (right-click), using `ContextMenu`, `ContextMenuItem`,
`ContextMenuSeparator` and `useContextMenuState` from `@controls/ContextMenu`. The precedent to copy
is `ExplorerContextMenu.tsx` + its wiring in `ExplorerPanel.tsx:113-145`, where each menu item calls
a `dialogs.open(...)` helper. Note the pattern's `click`-not-`mousedown` rule
(`.docs/dialog-pattern.md:153`).

- Edit breakpoint… *(also bound to double-click on the row)*
- Enable / Disable *(label reflects current state)*
- Remove breakpoint
- ─────
- Remove all breakpoints

**The panel lists both kinds, so the menu must not.** `BreakpointsPanel` renders every breakpoint the
emulator holds, source-bound ones included — they are the rows showing a `[file]:line` key and a
resolved address. On those rows:

- **Edit breakpoint… is hidden** (not merely disabled — a permanently-greyed item invites a hunt for
  the state that enables it). Double-click does nothing. Gate both on `isBinaryBreakpoint(bp)` from
  §5.1.
- **Enable/Disable, Remove, and Remove all stay live.** Those are set operations, not authoring, and
  they already work on source breakpoints today through `bp-en`/`bp-del`/`bp-ea` and the indicator
  checkbox. Removing that would be a regression dressed as scope discipline. Remove all in
  particular erases source breakpoints too, per the toolbar note above.
- Where a source row's menu would otherwise be one item shorter with no explanation, add a disabled
  hint item: *"Edit from the editor's left margin"*.

This split — the panel manages every breakpoint, the dialog authors only binary ones — is the whole
scope decision made visible at the point a user meets it.

**Gesture collision — the thing most likely to break.** `BreakpointIndicator` already binds
`onContextMenu` to *remove the breakpoint outright* (`BreakpointIndicator.tsx`, `handleRemove`), and
that indicator lives inside every row. A row-level context menu would either be shadowed by it or,
worse, the indicator's silent delete would fire where the user expected a menu. Resolve it
deliberately:

- The indicator's right-click-to-remove **wins inside the indicator's own bounds** and must
  `stopPropagation()`, so the row menu does not also open. Its behavior in the disassembly view is
  unchanged.
- Consider, as a small separate follow-up, retiring the indicator's silent right-click delete in
  favour of the menu — an unconfirmed, unlabelled destructive gesture is a poor default. Out of
  scope here; do not change it in this plan's phases.

The row tooltip built by `breakpointTooltip()` currently ends with "Right-click the indicator to
remove". It must gain the row menu hint, and the `BreakpointRow` tooltip and the context menu must
not both appear — dismiss the tooltip on menu open.

### 5.5 Other entry points

- **Disassembly view** (`DisassemblyRow.tsx` / `BreakpointIndicator.tsx`): add an "Edit
  breakpoint…" affordance for a row that already has one. A natural fit for the scope, since every
  breakpoint reachable from the disassembly view is address-bound by construction. Phase 4 — the
  panel is the primary surface and must land first.
- **The editor gutter is untouched.** It keeps sole ownership of source-code breakpoints
  (`MonacoEditor.tsx:1063-1075`). No "Edit…" affordance is added there.
- **A command, and the Debug menu** — *optional, Phase 4.* `IdeCommandContext`
  (`src/renderer/abstractions/IdeCommandContext.ts`) carries no dialog service, but it does not need
  to: `DisplayDialogCommand` (`src/renderer/appIde/commands/DialogCommands.ts:29-40`) opens any
  registered dialog by id through `openRendererDialog("ide", …)`, and `publicDialogIds` (:48-53)
  gives it a friendly name. Making the **add** dialog reachable that way costs three small edits —
  a const in `src/common/messaging/dialog-ids.ts` (next free IDE number after
  `SJASMPLUS_INTEGRATION_DIALOG = 6`), an entry plus a result-union member in
  `ideDialogRegistry.tsx:34,47`, and a `publicDialogIds` name — and the same registration makes it
  available to the Electron Debug menu via `getIdeApi().displayDialog(...)`.

  Only "add" works this way: the id-addressed path passes opaque `dialogData` and returns a result
  to the main process, so an *edit* would have to serialize which breakpoint it targets. Not worth
  it. Register the add dialog only, or skip the whole item — the panel is the real surface.

**Do not route the dialog through `ideCommandsService.executeCommand("bp-set …")`.** That is what
`BreakpointIndicator.handleRemove` does today, and it is lossy: the command string cannot carry a
partition label reliably, drops `ioMask`, and re-parses data the dialog already has structured. Call
`EmuApi` directly through `useEmuApi()`.

## 6. Phases

Each phase is independently shippable and independently testable.

### Phase 1 — pure logic (no UI)

1. `src/renderer/appIde/utils/breakpoint-form.ts` with the four functions from §5.1.
2. `test/commands/…`-style node test at `test/debug/breakpoint-form.test.ts`: one case per row of
   the §5.1 rules table, plus round-trip `breakpointToForm ∘ formToBreakpointInfo` identity for each
   of the five kinds.
3. A cross-check test that `parseNumericInput` accepts exactly what
   `BreakpointWithAddressCommand.validateCommandArgs` accepts *for address literals*, over a shared
   table. This is the test that catches drift between the two front doors. Its counterpart assertion:
   a `[file]:line` spec, which the command accepts, is **rejected** here with the editor-margin
   message (§5.1).

*Ships nothing user-visible. Everything after this is wiring.*

### Phase 2 — the dialog

4. `BreakpointDialog.tsx` + `BreakpointDialog.module.scss` per §5.2.
5. A radio-group control if none exists (§7).
6. `breakpoint-actions.ts` per §5.3, with a node test over a faked `EmuApi`.
7. jsdom test `test/controls/BreakpointDialog.test.tsx`: field visibility per kind, error display,
   and that submit emits the right `BreakpointDialogResult`. Per the MVC doc's rule 1, do **not**
   re-test validation rules here — they belong to Phase 1. The test must mount inside
   `DialogProvider`, or `useDialogs()` throws by design (`DialogProvider.tsx:227`). Watch the known
   `Dropdown` gotcha: it renders each option label twice, so a bare `getByText` on a partition label
   will fail on multiple matches.

### Phase 3 — panel integration

8. Toolbar strip + Add flow in `BreakpointsPanel.tsx`.
9. Row context menu, double-click-to-edit, and the `stopPropagation` fix on the indicator (§5.4).
10. Tooltip text update.
11. `ConfirmDialog` on Remove all, with the two-kind count in its message (§5.4).
12. jsdom test `test/controls/BreakpointsPanelActions.test.tsx`: menu contents reflect row state,
    each item calls the expected action, indicator right-click does not open the row menu, **and a
    source-bound row offers no Edit item and ignores double-click while still offering
    Enable/Disable and Remove** (§5.4).

### Phase 4 — secondary entry points and docs

13. Disassembly-view edit affordance (§5.5).
13b. *Optional:* register the add dialog by id (`dialog-ids.ts` → `ideDialogRegistry.tsx` →
    `publicDialogIds`) so it is reachable from `display-dialog` and the Electron Debug menu (§5.5).
14. `docs/content/commands-reference.mdx` gains a note that the same operations are available from
    the Breakpoints panel; a short GUI walkthrough goes in the working-with-ide section
    (`docs/content/working-with-ide/`). Both must state the division plainly: **binary breakpoints
    from the panel or the dialog, source-code breakpoints from the editor margin** — and that
    `bp-set [file]:line` remains the way to script a source breakpoint.
15. Run `npm run doc:build && npm run doc:check` — the golden route/asset diffs in
    `.plans/docs-*.golden.txt` must be updated if a page is added.

## 7. New assets and primitives

- **Icons.** `src/renderer/assets/icons/` has no add/delete glyph. Drop in Lucide `plus.svg` (and
  `trash-2.svg` if the menu wants one); the filename becomes the icon id and Lucide's `currentColor`
  is already wired to the theme (`AGENTS.md`, Icons section). Reuse the stock `pencil` for Edit,
  `clear-all` for Remove all, `close` for Remove.
- **Radio group.** `src/renderer/controls/` has `Checkbox` and `Dropdown` but no radio group. Either
  add a small `RadioGroup` control, or render the five types as a segmented row of buttons. Prefer
  the real radio group — it gets keyboard semantics for free, which a button row would have to
  reimplement, and other dialogs will want it.

## 8. Risks

| Risk | Mitigation |
| --- | --- |
| Two number parsers drift apart | `parseNumericInput` wraps the command parser; Phase 1 step 3 asserts the shared table |
| Edit loses a concurrent change | `restoreBreakpoints` for key-changing edits (§5.3), never bare remove+set |
| Indicator right-click shadows the row menu | explicit `stopPropagation` + a test asserting it (Phase 3) |
| `restoreBreakpoints` may not preserve `disabled` as documented | verify against `test/debug/RestoreBreakpoints.test.ts` before Phase 2 step 6; re-assert `enableBreakpoint` regardless |
| Panel body toolbar diverges from other panels' headers | acknowledged as interim; `SideBarPanelInfo.headerActions` noted as follow-up |
| A source-bound breakpoint reaches the dialog and `breakpointToForm` produces nonsense | `isBinaryBreakpoint` guard at every call site (§5.1), asserted in the Phase 3 panel test |
| Users read "can't edit source breakpoints here" as a missing feature | the disabled hint item (§5.4) and the docs wording (Phase 4 step 14) both name the editor margin as the place |
| `DialogField` has never been used in production and may have gaps | fall back to `DialogRow` + `TextInput`'s inline error, which every shipped dialog uses |

## 9. Verification

Per `AGENTS.md`: focused tests first, then the type-check — noting that `npm run build:check` is
**currently a no-op** (solution-style root tsconfig), so type-check against `build/tsconfig.web.json`
explicitly. `npm run lint:renderer` is required because this touches renderer React. After adding
files, run the electron-vite build to catch import-analysis errors.

```bash
npm test -- --project node test/debug/breakpoint-form.test.ts
```

```bash
npm test -- --project jsdom test/controls/BreakpointDialog.test.tsx test/controls/BreakpointsPanelActions.test.tsx
```

```bash
npx tsc --noEmit -p build/tsconfig.web.json && npm run lint:renderer
```

```bash
npx electron-vite build --config build/electron.vite.config.ts
```

## 10. Open questions

1. **Remove-all confirmation:** confirm always, or only when more than N breakpoints exist?
2. **Indicator right-click:** keep the silent delete, or migrate it to the context menu in a
   follow-up?
3. **`SideBarPanelInfo.headerActions`:** worth doing now for a nicer toolbar placement, or later as
   its own change across panels?

**Decided:** *Remove all keeps `bp-ea` semantics* — it erases every breakpoint, source-bound
included, rather than offering a binary-only variant. The confirmation names the source count so the
scope is stated at the point of action (§5.4).

## 11. Implementation notes

Phases 1-4 are implemented. Three deviations from the plan as written, all deliberate:

1. **`useBreakpointDialog` was extracted** (`src/renderer/appIde/dialogs/useBreakpointDialog.ts`).
   The plan had the panel build the dialog's environment inline. Once the disassembly view needed
   the same thing, one hook became the obvious home — and it fixed a latent bug: the panel was
   building `existingKeys` from its own render-old copy of the breakpoint list, so the
   duplicate-key check was only as fresh as the last refresh. The hook reads the list when the
   dialog opens.

2. **`applyKindChange` was added to the pure module.** Switching type left a stale partition (its
   control disabled) or a stale port mask (its field not rendered at all) in the form, failing
   validation against a field the user could not see or reach. Found on review in Phase 2.

3. **Step 13b — registering the dialog by id — was skipped.** The plan estimated "three small
   edits", which turned out to understate it: `ideDialogRegistry` renderers are
   `(data, controls) => ReactElement`, but this dialog needs an environment that can only be read
   asynchronously in the renderer. Reaching it from `display-dialog` or the Electron menu therefore
   needs a loading host component, not a registry line. That is real surface to build and test for
   a second route to something the Breakpoints panel already offers in one click. Revisit if a
   Debug-menu entry is actually wanted.

Also fixed in passing: `docs/content/commands-reference.mdx` had a committed corruption in the
`bp-del` section — its parameter list ended mid-sentence, and the missing text had been spliced
into a bodyless duplicate `## show-memory` heading further down. Repaired while editing that file.

`npm run doc:check` reports one route not in the golden snapshot,
`/contribute/wasm-toolchain/index.html`. It predates this work (committed in `f176f2398`), so the
golden was left alone rather than silently absorbing someone else's drift.
