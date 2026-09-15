# NEX Annotations

Klive stores optional NEX disassembly annotations in a JSON sidecar next to the
source file. A file named `Game.nex` uses `Game.nex.dis`.

## Viewer Behavior

The NEX viewer shows a compact create link only when the sidecar is missing. If
the sidecar exists and loads successfully, no annotation banner is shown. If the
sidecar exists but cannot be loaded, the viewer shows a short error.

When a bank is popped out, its memory dump can switch between Memory and
Disassembly views. For annotated banks, the view mode, decimal flag, and
disassembly offset are stored per bank in the sidecar.

## Interactive Editing

The popped-out bank disassembly toolbar provides:

- Save annotations, enabled only while the shared annotation model is dirty;
- Annotations, enabled when a disassembly row or range is selected.

The Annotations button opens the same menu as right-clicking the selected
disassembly row or range. The menu contains Manage Labels, Manage Regions,
synopsis comments, end-of-line comments, label actions, operand label
references, region marking, and row annotation clearing.

Edits update the in-memory annotation model immediately and re-render the
disassembly. JSON is written only when the user explicitly saves.

## Shared Annotation Session

Open bank documents for the same `.nex.dis` path share one annotation session.
This prevents separate bank pop-outs from keeping divergent copies of the same
sidecar. Dirty state, save errors, and successful saves are broadcast to all
subscribers.

Closing a dirty popped-out bank asks for confirmation before discarding unsaved
annotation changes. Closing the app also runs the same disposal checks.

## Two Subtrees, Two Save Policies

Schema 2 added a `debug` subtree beside the annotations, holding the bank breakpoints the NEX
carries. The two halves are saved **independently and on different policies**:

- **annotations** (`source`, `globalLabels`, `banks`) stay dirty-tracked and are written when the
  user asks, as described above;
- **`debug`** is written the moment a breakpoint changes, because a breakpoint lost to an unpressed
  Save button is a bug rather than a policy.

Both writers read the file, replace only their own keys and write back, so neither can revert the
other and a key a newer build adds survives an older build's save. A schema 1 file loads unchanged
and is only rewritten as 2 when something is actually saved into it.

The `debug` subtree holds two kinds: `breakpoints`, an offset in a bank, and `labelBreakpoints`,
anchored to one of the file's labels with **no offset** — the label is the anchor, and resolution
finds where it currently points, which is what lets such a breakpoint survive code moving within its
bank. Both are written together, because the subtree is replaced wholesale.

Breakpoints in the sidecar are the *only* place these are persisted: `.kliveproject` deliberately
excludes them, so a NEX opened with no project still keeps its breakpoints.

Annotations can also be written from the debugger rather than only in the viewer: `nex-label <name>`
adds a bank-local label at the address the machine is paused at. It follows the same two save
policies as every other annotation edit — into the session when a viewer is open, written through
when one is not — which is why it asks whether a session exists before deciding.

A popped-out bank's memory view can show the bank's **live** contents instead of the file's, marking
what differs. The disassembly view deliberately cannot: the annotation model's listing is derived
from the file's bytes and addresses its actions by row index, and live bytes disassemble to different
instruction lengths — so the two listings would drift apart and the annotation menu would act on the
wrong row. Annotations describe the file.

The NEX viewer's bank headings show how many breakpoints each bank carries, counted from the
*emulator* rather than from the sidecar — what is armed now, including another NEX's breakpoints in
the same bank, because the machine will stop at those too.

## Label Rules

Global labels have 16-bit values in `$0000..$FFFF`. Local labels are scoped to a
bank and use bank-relative values in `$0000..$3FFF`. Label names follow the
assembler identifier convention and are limited to 16 characters.

Explicit operand label references are attached to decoded 16-bit instruction
operands. If a referenced label is deleted, the user is asked before all
affected operand references are cleared.

An operand the annotations cannot name falls through to the machine's own system
variable table, so `ld hl,$5C08` reads `ld hl,LAST_K` in a bank listing exactly as
it does in the live Disassembly view. Annotations always win: a label written
about this program is a more specific claim than a fact about the machine. Only
data operands are named this way — `jp`/`call` targets keep their `L` labels. See
`src/renderer/appIde/disassemblers/sys-var-operand-labels.ts`.

## Region Rules

Each bank has normalized, non-overlapping coverage from `$0000` to `$3FFF`.
Regions can be:

- `disassemble`: generate Z80 instructions;
- `bytes`: generate `.defb` lines with up to four values per line;
- `words`: generate `.defw` lines with up to two words per line;
- `skip`: generate a `.skip` line.

The Memory Region dialog validates ranges before applying them. Whole-bank
changes require confirmation.
