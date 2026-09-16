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

- a warning indicator, shown when the sidecar could not be loaded or written;
- Annotations, enabled when a disassembly row or range is selected.

The Annotations button opens the same menu as right-clicking the selected
disassembly row or range. The menu contains Manage Labels, Manage Regions,
synopsis comments, end-of-line comments, label actions, operand label
references, region marking, and row annotation clearing.

Edits update the in-memory annotation model immediately, re-render the
disassembly, and are written to the sidecar straight away. **There is no Save.**
An annotation is a note about a program, and the reason to make one is always to
keep it; the per-bank view settings ride the same path, so merely switching a
bank to Memory view no longer leaves a document marked unsaved.

An **end-of-line comment replaces the disassembler's own** on that row, rather
than being appended to it. Both want the one comment column, and the generated
note is the weaker claim of the two: `; Palette Control` says what the opcode
does, which a reader who has annotated the row already knows. The generated text
is kept in the row's `generatedHardComment`, so the end-of-line dialog can show
what is being replaced while you type, and clearing the user comment brings it
back to the listing.

## Shared Annotation Session

Open bank documents for the same `.nex.dis` path share one annotation session.
This prevents separate bank pop-outs from keeping divergent copies of the same
sidecar, and it is also the single place that writes them. Annotations, write
errors, and the loading state are broadcast to all subscribers.

The session writes **one at a time, coalescing**. `saveNexAnnotationSubtree` is a
read-modify-write of a file whose `debug` subtree belongs to another writer, so
two overlapping writes would each read before the other wrote; an edit arriving
mid-write only marks that another write is owed, because the next one writes the
model as it is then. Two banks of one NEX edit the same session independently, so
this is ordinary rather than exotic.

A failed write leaves the session holding edits that exist nowhere else. That is
the one case where closing still asks: the document tab marks itself unsaved, the
toolbar warning carries the reason, the next edit retries, and closing the bank
asks before discarding. In normal use none of that is ever seen.

## Two Subtrees, One Save Policy, Two Writers

Schema 2 added a `debug` subtree beside the annotations, holding the bank breakpoints the NEX
carries. Both halves are now written **the moment they change** — `debug` always was, because a
breakpoint lost to an unpressed Save button is a bug rather than a policy, and the annotations
followed for the same reason.

They remain **separate writers**, which is the part that still matters: each reads the file,
replaces only its own keys and writes back, so a breakpoint cannot revert an annotation, an
annotation cannot revert a breakpoint, and a key a newer build adds survives an older build's
write. A schema 1 file loads unchanged and is only rewritten as 2 when something is actually
written into it.

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

A popped-out bank shows the bank's **live** contents whenever a machine is running — in both the
memory and the disassembly view — marking what differs from the file and falling back to the file's
bytes when there is no machine to read. A `Live` marker in the toolbar says which of the two is on
screen. The annotation menu stays correct because it resolves a row through the item it rendered
(`item.annotation.bankOffset`, else `listedBankOffset(item.address, …)`) rather than by row index, and
regions are bank offsets, which mean the same thing in a bank read from RAM as in one read from the
file.

While the machine is paused with the PC inside the bank, the listing is additionally cut and
re-decoded at the PC, so the rows from there on are the instructions that will actually run rather
than a linear guess from byte 0. Regions annotated as `bytes`, `words` or `skip` are never cut.

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
