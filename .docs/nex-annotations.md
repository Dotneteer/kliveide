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
- Manage Labels, for searchable global and current-bank local labels;
- Manage Regions, for searchable bank regions with Go To, Edit, Split, Revert,
  and Add Region actions;
- Annotate, for row-oriented synopsis comments, end-of-line comments, and
  operand label references.

Edits update the in-memory annotation model immediately and re-render the
disassembly. JSON is written only when the user explicitly saves.

## Shared Annotation Session

Open bank documents for the same `.nex.dis` path share one annotation session.
This prevents separate bank pop-outs from keeping divergent copies of the same
sidecar. Dirty state, save errors, and successful saves are broadcast to all
subscribers.

Closing a dirty popped-out bank asks for confirmation before discarding unsaved
annotation changes. Closing the app also runs the same disposal checks.

## Label Rules

Global labels have 16-bit values in `$0000..$FFFF`. Local labels are scoped to a
bank and use bank-relative values in `$0000..$3FFF`. Label names follow the
assembler identifier convention and are limited to 16 characters.

Explicit operand label references are attached to decoded 16-bit instruction
operands. If a referenced label is deleted, the user is asked before all
affected operand references are cleared.

## Region Rules

Each bank has normalized, non-overlapping coverage from `$0000` to `$3FFF`.
Regions can be:

- `disassemble`: generate Z80 instructions;
- `bytes`: generate `.defb` lines with up to four values per line;
- `words`: generate `.defw` lines with up to two words per line;
- `skip`: generate a `.skip` line.

The Memory Region dialog validates ranges before applying them. Whole-bank
changes require confirmation.
