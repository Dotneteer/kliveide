# Annotations

Klive stores disassembly annotations — labels, comments, regions, label-anchored
breakpoints — in a JSON sidecar next to the file they describe: `Game.nex.dis`,
`jetpac.z80.dis`, `game.p.dis`, a project's `annotations.dis`, a ROM's
`sp48.rom.dis`. One model serves every machine with a *bank space*: the ZX Spectrum
Next, the 48K, 128K/Pentagon, +2A/+3/+3E, Scorpion, Timex (HOME memory), ZX80 and
ZX81. The plan is `.plans/REVERSE_ENGINEERING_ANNOTATIONS_PLAN.md`; the code is in
`src/renderer/appIde/annotations/` and `src/common/annotations/bankSpace.ts`.

The NEX-specific behaviour below (the NEX viewer, bank pop-outs, sprites, Copper and
DMA regions) is unchanged; the sections after "Machines and Bank Spaces" describe
what is the same on every machine.

## Machines and Bank Spaces

An annotation names a place as a **16K bank and an offset in it**, because that is
what survives paging. Each machine's arithmetic between that site and a Z80 address
lives in one object, its bank space (`bankSpaceFor(machineId, config)` is the only
place a machine id is looked at):

| Bank space | A bank site is | A partition (what a breakpoint matches) is |
|---|---|---|
| `next` | 8K pages `2B`/`2B+1`, in any slots | the 8K page |
| `sp128`, `plus3`, `scorpion` | the 16K bank in a 16K slot | the bank itself |
| `sp48` | `$4000` bank 5, `$8000` bank 2, `$C000` bank 0 (the 128K's names, so a 48K file carries over) | none: the fixed address decides |
| `timex` | HOME as the 48K; DOCK/EXROM are not annotatable | the HOME chunk |
| `zx81`, `zx80` | the *canonical* address (the lowest one a data read reaches the byte at) in 16K blocks; mirrors depend on the model | none |

`DebugSupport` takes the machine's bank space, so `bp-set <bank>:+<offset>` and a
sidecar's bank breakpoints work on every machine with one; a machine without
partitions arms its site with `ANY_PARTITION`. `test/annotations/bankSpace.test.ts`
round-trips every space under every paging, and `test/zx8081-hw/annotation-mirrors.test.ts`
checks the ZX80/ZX81 folds against the real core.

## Schema Versions

A Next sidecar stays at schema **2**, byte for byte, with no `machine` key. Every
other machine's is schema **3**, which adds `machine` (`sp48`, `sp128`, `plus3`,
`scorpion`, `timex`, `zx81`, `zx80`, or `rom` for a ROM sidecar). A version 2 file
with `machine` is refused (an older build would read it as a Next's), as is a version
3 file without one. The debug writer never stamps 2 on a schema 3 file.

## The Active Annotation Set

One `.dis` file is live (`annotations/activeAnnotationSet.ts`). It is made active by:

- `nex-run` (the NEX's sidecar), `zx-snapshot` (`<snapshot>.dis`), and `tape-load` of a
  ZX80/ZX81 program file (`<file>.dis`) — whether or not the file exists yet;
- opening a Klive project: `.kliveproject`'s `annotations` property (relative to the
  folder), else `annotations.dis` in the project root;
- `ann-open <file>`, `ann-new <file> [-m <machine>]`; `ann-close` deactivates;
  `ann-info` describes it and the ROM pages' annotations.

The first edit creates a missing file. The snapshot viewer pops a bank out annotated
when `<snapshot>.dis` exists, and offers a create link (`AnnotationFileBanner`) when it
does not, as the NEX viewer does. `ActiveAnnotationSetHost` (mounted in the
IDE) keeps the set's session, its sidecar breakpoints and its condition symbols
alive with or without a document open, and everything that shows names follows the
session — so a label added anywhere is on screen at the next refresh.

## The Shared Resolver

`annotations/symbolResolver.ts` answers "what is this address called" for every view,
from four sources in a fixed order: the last build's labels, the active set, the paged
ROM page's annotations (the user's layer, then the shipped one), and — for data
operands only — the system variables. A row shows one name; the others are in its
label tooltip. The live Disassembly view, Execution History, the raw Call Stack
(`MAIN+12`), the Profiler's routine map (a routine source between `.proc` and call
targets) and `dis` all use it.

## The Live Disassembly View

The view is an annotated listing (`annotations/liveAnnotatedDisassembly.ts`): its range
is split where the memory behind it changes (`livePieces`), each annotated bank or ROM
page is listed from its own regions — a data region the viewport starts inside is not
decoded as code — and every row is labelled through the resolver. ROM labels are set
back by weight and slant (`--color-disassembly-rom-label`); the **ROM labels** toggle
hides the ROM's annotations. On the ZX80/ZX81 a mirror row repeats the canonical row's
label and says `(mirror of $4082)`.

The row menu adds the bank document's annotation entries — Label, Synopsis and
End-of-Line Comment, Operand Label, Mark As Code/Bytes/Words/Skip (Text on the
ZX80/ZX81), Go to Definition — with the same shortcuts on the row last clicked. A row's
edit goes through the bank document's own controller, given the bank the row is in
(`liveListingPort.ts`, `liveAnnotationEditing.ts`): RAM rows to the active set, ROM rows
to the user's ROM layer, never to a shipped sidecar. A row nowhere annotatable (a Timex
DOCK chunk, no active set) gets the entries disabled with the reason.

The machine's custom disassembler (report codes after `RST $08`, calculator literals
after `RST $28`) runs only inside the ROM it describes (`rom-gated-disassembler.ts`):
the 48K's on any 48K BASIC page — which is how the 128K, +3 and Scorpion have it — and
the ZX81's on the ZX81 ROM, the ZX80 upgrade included.

## Commands

- `label <name> [<address>]` (formerly `nex-label`, which stays an alias): names the
  address the machine is paused at, or the one given — a bank-local label in the
  active set, or, for a ROM address, a label in your ROM annotations.
- `bp-set <bank>:+<offset>` on every machine with banks; `bp-set <bank>:<label>` is a
  label-anchored breakpoint in the active set (owned by that sidecar); `bp-set
  ROM:<name>` resolves a ROM label now, to its address and ROM partition.
- In conditions, `<bank>:<name>` reads an annotation label on every bank-space machine
  and `ROM:<name>` a ROM label.
- Breakpoint owners: `{ kind: "sidecar", sidecar }` (the former `nex` kind is read as it).
- `ann-detect [<bank>|rom|all] [-mode fill|replace|clear] [-reach] [-text] [-words] [-unknown
  keep|bytes] [-noscreen] [-apply]` and `ann-detect -undo`: code/data detection from coverage
  (`src/common/reverse/classify.ts`, `reach.ts`, `proposal.ts`; the orchestration is
  `src/renderer/appIde/reverse/detection.ts`). The *Detect code and data* dialog is the same run.
- `gfx [<address>] [-w] [-h] [-layout] [-bank]`: the graphics finder over the paused machine.
- `export-asm <file> [<from> <to>] [-bank <n>] [-skip data|gap] [-open] [-noverify]`: source export,
  verified by assembling it in the main process (`MainApi.assembleText`).
- `skool-import <file> [-ctl] [-mode fill|replace] [-apply]` and `skool-export <file> [-ctl] [<from>
  <to>] [-bank <n>|all] [-split]`: SkoolKit files (`src/common/reverse/skool/`).

## ROM Annotations

A ROM's annotations are a ROM sidecar: the same model with `machine: "rom"`, `banks`
keyed by the 16K page within the ROM file, a `pages` map of each page's CRC-32, and no
`globalLabels` or `debug`. Three places hold them:

- **shipped** — `src/public/roms/<rom file>.dis`, read-only, found **by CRC** through
  `rom-annotations.index.json`;
- **your annotations of a shipped ROM** — `<Klive home>/RomAnnotations/<crc32>.rom.dis`
  (`KliveData` when portable);
- **your annotations of your own ROM file** — `<path>.dis` beside it, or the overlay when
  that folder is not writable.

The machine reports where each ROM partition came from (`getRomSources`: CRC, size,
file and page, found by comparing bytes with the files it loaded).
`RomAnnotationsHost` loads the layers on every machine or ROM change and on every edit
of a user layer. A shipped sidecar applied to bytes it does not describe — through its
`inherits`, or to an unknown ROM in a 48K BASIC position (Q7) — is **byte-bound**: a
label and its comments apply only where the bytes from it to the next label are
identical, so a changed routine loses its name rather than being misnamed.

The shipped sidecars are authored in the repository under the rules of
`.ai/rom-annotations/`. `npm run rom:annotations` formats them and regenerates the
index (`-- --check` runs in `build:check`), `-- level` reports completeness, `--
skeleton` lists unlabelled targets, `-- bind` reports a binding, `-- coverage` runs the
ROM through BASIC with the access profile on.

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

Open bank documents for the same `.dis` path share one annotation session (and so do the live
Disassembly view, the `label` command and the snapshot viewer's bank pop-outs).
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
than a linear guess from byte 0. Regions annotated as `bytes`, `words`, `copper`, `dma` or `skip` are never cut.

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
data operands are named this way — `jp`/`call`/`jr`/`djnz` targets keep their `L` labels
unless an annotation names them. See
`src/renderer/appIde/disassemblers/sys-var-operand-labels.ts`.

## Region Rules

Each bank has normalized, non-overlapping coverage from `$0000` to `$3FFF`.
Regions can be:

- `disassemble`: generate Z80 instructions;
- `bytes`: generate `.defb` lines with up to four values per line;
- `words`: generate `.defw` lines with up to two words per line;
- `skip`: generate a `.skip` line;
- `copper`: generate one `.copper` row per big-endian word (a Copper list);
- `dma`: generate one `.dma` row per register write (a zxnDMA program);
- `text`: printable runs as `.defm` rows (the ZX80/ZX81's own character set as `.defb` with the
  text in the comment); a row breaks at `$0D`, `$00` and a byte with bit 7 set;
- `graphic`: one `.defb` row per pixel row (binary up to two bytes, hex beyond), the pixels drawn
  in the comment, laid out by the bank's matching `graphics` entry.

Data rows normally start at a labelled byte, so a label inside a table gets a row
of its own. A `bytes` region may instead set `rowBytes` (1–4) to lay its data out
in fixed records — `{ "type": "bytes", "rowBytes": 2 }` puts each two-byte copper
instruction on its own line. Its rows are never cut at a label: a label naming a
byte inside a record (the operand a routine patches) still names that address in
operands, but the record stays whole. `rowBytes` is valid only on `bytes` regions;
the default of 4 is written as no field, and touching `bytes` regions with
different row sizes are never merged. It is edited in the sidecar; the Memory
Region dialog does not set it, but changing a region keeps it on the parts left
either side.

The Memory Region dialog validates ranges before applying them. Whole-bank
changes require confirmation.

### Copper and DMA Regions

See `.plans/NEX_DMA_COPPER_REGIONS_PLAN.md`. The decoders are pure shared modules:
`src/common/zxnext/copper/copperDecoder.ts` and `src/common/zxnext/dma/dmaDecoder.ts`.

- **Every row reassembles.** A row's text assembles (with `.model next`) to exactly the bytes it
  covers. What the pragma cannot express falls back to `.dma cmd $xx`, `.copper word $xxxx` or
  `.defb`, and the meaning goes in the generated comment (`generatedHardComment`), so a user
  end-of-line comment replaces it as on every other row.
- **Storage.** In memory the types are `copper` and `dma`. On disk they are `bytes` regions with a
  `decode` key — `{ "type": "bytes", "rowBytes": 2, "decode": "copper" }` and
  `{ "type": "bytes", "decode": "dma" }` — written by `toSidecarRegion` (used by both
  `formatNexAnnotations` and `saveNexAnnotationSubtree`) and read back by `normalizeRegions`.
  Shipped builds reject an unknown region `type` and with it the whole file, but ignore an unknown
  key: they list a Copper region as one `.defb` word per row and a DMA region as plain bytes, and a
  build that rewrites the bank drops `decode`. No schema bump. An unknown `decode` value, or
  `decode` on a region that is not `bytes`, is a warning and the region stays as stored.
- **Copper** regions are even-length (the dialogs and `withRegion` refuse an odd span; an odd one
  in a file loads with a warning and lists its last byte as `.defb`). Words align to the region
  start. A word is never split at a label, like a `rowBytes` record.
- **DMA** regions are decoded as the hardware sequences the bytes (`zxnextDmaWriteBase` /
  `zxnextDmaWritePort`): the follow-byte bits of each base byte decide the command length, not the
  assembler's conventions. A command cut off by the region end is `.defb` with a
  `truncated: WRn expects N more bytes` comment. A label on a follow byte splits the command into
  the documented runtime-patching form: the base byte alone (`.dma wr0 a_to_b, transfer`,
  `.dma wr4 continuous`, otherwise `.dma cmd $xx`), then each field as a `.defw` (or `.defb`) row; a
  label on the second byte of a word field splits that field into two `.defb` rows. Commands are
  never collapsed; the region dialogs suggest trimming a DMA range that ends in 8 or more `$00`
  bytes (cut at a command boundary).
- Neither kind is cut at the program counter (only `disassemble` regions are).

### The Reverse-Engineering Tools' Keys

`.plans/REVERSE_ENGINEERING_TOOLS_PLAN.md` §3. Every one is a key a shipped build ignores (R2); no
schema bump, and Next files stay at version 2.

- **`text` and `graphic` regions** are stored as `bytes` + `decode`, like Copper and DMA. A
  graphic keeps its stored `rowBytes` (`min(width, 4)`), so an older build lists it a pixel row per
  line where it can. Both are offered on every machine.
- **`origin`** on a region: absent for the user's, `"auto"` for code/data detection, `"skool"` for
  a SkoolKit import. It takes part in `sameRegionLayout`, so a tool's region never merges into the
  user's; `withRegion` takes it as an optional argument and the editor never passes it, so a region
  the user touches becomes theirs. The listing marks a tool's rows with a dotted rail
  (`regionOrigin` on the row metadata). Code over the default gap is no change, so it carries none.
- **`graphics`** on a bank: the named graphics (`offset`, `width` 1–32, `height` 1–256, `count`,
  `layout` `linear|cells|columns|screen`, optional `mask` and `label`). Naming a graphic
  (`withNamedGraphic`) writes the label, the `graphic` region and the entry in one update;
  retyping or clearing the region drops its entry (`pruneGraphics`). A bad entry is a warning.
- **`endComment`** on a line annotation: lines after the row (SkoolKit's end comment). A line
  annotation with only an end comment is kept.
- **`interop.skool`** on a bank: what a SkoolKit file said that Klive does not model — unknown
  `@` directives, non-entry text, braced spans, `*` entry points, block characters, each entry's
  header shape, ignored entries, hex addresses — written back by the export so an unedited file
  round-trips. Only its shape is checked; Klive never acts on it.
