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

The Annotations button opens the same menu as right-clicking a disassembly row
or range. It is enabled whenever annotations are loaded, even with nothing
selected: the whole-bank entries (Manage Labels, Bank Comment) need no row, and
the row entries disable themselves until one is selected. The menu contains
Manage Labels, Manage Regions, Bank Comment, synopsis comments, end-of-line comments, label actions, operand label
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

## Bank Comments

A bank can carry one free-text comment, stored as `banks.<n>.comment` in the
sidecar. It may span several lines; it is normalized like a synopsis comment
(LF line breaks, trailing whitespace trimmed) and an emptied comment removes the
key rather than storing `""`. Validation rejects a non-string and warns, without
refusing the file, beyond 4,000 characters.

It is additive within the bank, **not a schema bump**, for the same reason as
`debug.labelBreakpoints`. The cost is the same too: a previously shipped build
rebuilds each bank from the keys it knows, so opening a newer sidecar in an old
build and editing anything in that bank drops the comment.

Where it shows:

- **NEX viewer bank browser.** The viewer lists banks instead of expanding
  them (`Next/NexBankBrowser.tsx`, summaries in `nexBankSummary.ts`). A row
  shows the bank number, a `BP` chip (the gutter's execution / memory-read /
  memory-write glyphs, each with its count of enabled breakpoints; grey and
  dashed when all are disabled), PC/SP marks, the comment's non-blank lines
  joined with ` · ` and truncated with an ellipsis, a content-mix bar, and a
  pop-out icon. Double-click or Enter pops the bank out in its last view; the
  row context menu offers Bank Comment... and Clear Bank Comment. The selected
  bank's details pane has a split *Pop out* button (▾ picks Memory, Disassembly
  or Sprites), size, a Breakpoints line naming each kind and how many are disabled,
  listed-at address, last view, sprite format, the content
  mix with percentages, the full comment with *Edit comment...* / *Add
  comment...*, and up to 16 labels. The selection and the All / Non-empty /
  Annotated filter are document view state, never written to the sidecar.
- **Popped-out bank.** A toolbar chip (at most `32ch`) that opens a popover with
  the whole text, *Edit...* and *Pin*. Pinned, the chip is replaced by a strip
  under the toolbar, one line until expanded, with an unpin button. The
  expand button appears only when the one-line text does not fit the strip
  (measured, and re-checked on resize). Pinned and
  expanded are document view state (`bankCommentPinned`,
  `bankCommentExpanded`), never written to the sidecar.
- **Editing** goes through the Bank Comment dialog, from any of the above, from
  the Annotations menu, or with `B` in the focused listing. Its preview is the
  one-line row text. `Ctrl+Enter` / `Cmd+Enter` saves; Enter is a new line.

The NEX viewer **follows the shared session** once its sidecar has loaded, so a
comment edited in a pop-out appears in the viewer heading straight away. The
viewer seeds an empty session with the model it just read
(`seedNexAnnotationSession`), so subscribing does not read the file twice; a
session that already exists is kept, being at least as current.

## Sprites View

A popped-out **NEX bank** offers a third view, *Sprites*, beside Memory and
Disassembly (a plain dump does not). It shows the bank as a sheet of 16×16 ZX
Spectrum Next sprite patterns with an inspector for the selected one.

- **Layout follows the hardware** (`_input/next-fpga/src/video/sprites.vhd`), not
  Klive's emulator: an 8-bit pattern is 256 bytes, one byte per pixel; a 4-bit
  pattern is 128 bytes, two pixels per byte, high nibble for even x. 4-bit pixels
  take `paletteOffset << 4 | nibble`; transparency compares the whole byte (8-bit)
  or the low nibble of Reg `$4B` (4-bit). The pure model is `nexBankSprites.ts`.
- **Format and start offset are saved** in the sidecar as
  `banks.<n>.sprites: { format?: "8bit" | "4bit", offset?: number }`. Defaults
  (8-bit at `$0000`) are not stored, and a block equal to them is removed.
  **Validation only warns** about bad values and ignores them: an error would make
  this build refuse the whole file over a view setting. An older build drops the
  block when it rewrites that bank, the same exposure as bank comments.
- **Sprites as the open view is saved as `sprites.active: true`, not in
  `lastView`.** A shipped build rejects any `lastView` other than
  `memory`/`disassembly`, but ignores an unknown key inside `sprites`. `lastView`
  keeps the last *listing* view (what an older build opens), and a reopened bank
  shows Sprites when `active` is set. Both are written in **one** publish: the dump
  adopts the view the sidecar names on every snapshot, so a separate `lastView`
  write while `active` was still set would bounce a switch back to Sprites.
  Palette choice, 4-bit palette offset, zoom, checker and selection stay view
  state.
- **Palette**: Primary/Secondary, read from the machine through
  `useSpritePalette` only while the view is showing; the palette the sprite engine
  uses (Reg `$43` bit 3) carries a ring. With no Next machine both show the Next's
  reset palette (`RRRGGGBB`, low blue bit = B1 | B0), labelled *Default palette*.
- **Mark as Bytes** (inspector or a cell's context menu) turns the selected
  patterns (Shift extends) into one `bytes` region through the `regionSpanMarked`
  intent — no region dialog, but the whole-bank confirmation still applies.
  Patterns already inside a bytes region carry a corner mark, and the inspector
  then offers *Mark as Disassembly*.
- **Keyboard**: arrows / PageUp / PageDown / Home / End move (Shift extends),
  Enter opens Memory at the pattern and Shift+Enter Disassembly, `B` edits the
  bank comment. Show in Memory/Disassembly and Go To are navigation jumps, so Go
  Back returns to the pattern.

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
