# NEX File Annotations Plan

Created: 2026-08-30

Status: Steps 1, 2, 3, 4, 5, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, and 6.10 implemented. Later steps pending.

## Implementation Progress

### Step 1 Result

Added a pure TypeScript NEX annotation model and validation layer in
`src/renderer/appIde/DocumentPanels/Next/nexAnnotations.ts`, with focused tests
in `test/renderer/nexAnnotations.test.ts`.

The module currently supports:

- deriving and recognizing `.nex.dis` sidecar paths;
- creating default annotation documents for loaded NEX banks;
- parsing JSON and returning structured diagnostics;
- validating schema version, bank keys, offset indexes, labels, regions, line
  annotations, and operand references;
- normalizing bank regions into full-bank non-overlapping coverage;
- resolving labels at bank offsets and finding global/local operand label
  candidates.

Validation run:

```text
npm test -- --project node test/renderer/nexAnnotations.test.ts
npm run build:check
npm run lint:renderer
```

`npm run lint:renderer` completed with the existing hook-warning baseline and
no errors.

### Step 2 Result

Registered `.nex.dis` files as read-only JSON code documents in
`src/renderer/registry.ts`, with focused tests in
`test/renderer/nexAnnotationFileType.test.ts`.

The registration currently supports:

- selecting `.nex.dis` files in Explorer as text/code documents;
- JSON syntax highlighting through `subType: "json"`;
- read-only editor behavior;
- preserving regular `.nex` files as binary NEX viewer documents.

Validation run:

```text
npm test -- --project node test/renderer/nexAnnotations.test.ts test/renderer/nexAnnotationFileType.test.ts
npm run build:check
npm run lint:renderer
```

`npm run lint:renderer` completed with the existing hook-warning baseline and
no errors.

### Step 3 Result

Added NEX viewer sidecar discovery and actions in
`src/renderer/appIde/DocumentPanels/Next/NexFileViewerPanel.tsx`, supported by
`src/renderer/appIde/DocumentPanels/Next/nexAnnotationSidecar.ts`.

The viewer now supports:

- deriving the associated `.nex.dis` path for the loaded `.nex` document;
- showing a compact missing-sidecar line with an inline `create` action;
- hiding the annotation header entirely when the sidecar is loaded or has just
  been created;
- showing one short error line when the sidecar exists but cannot be loaded;
- creating a default sidecar JSON file next to the source NEX file without
  overwriting an existing file;
- refreshing Explorer after sidecar creation;
- relying on Explorer for opening `.nex.dis` JSON files instead of duplicating
  that action in the NEX viewer;
- keeping annotation state in memory after the initial load, without an
  explicit reload action in the NEX viewer;
- reading sidecar contents from the file system instead of the project file
  cache when the NEX viewer initializes, so deleting a sidecar and reopening the
  NEX file shows the missing/create state correctly;
- surfacing validation diagnostics without breaking the bank list;
- using loaded bank annotations to choose the default disassembly offset for
  bank pop-out documents;
- passing the annotation sidecar path and bank number into static memory dump
  documents for the later annotated rendering steps.

Validation run:

```text
npm test -- --project node test/renderer/nexAnnotations.test.ts test/renderer/nexAnnotationFileType.test.ts test/renderer/nexAnnotationSidecar.test.ts
npm test -- --project jsdom test/renderer/NexFileViewerPanel.test.tsx test/renderer/NexFileViewerAnnotations.test.tsx test/controls/StaticMemoryDump.test.tsx
npm run build:check
npm run lint:renderer
```

`npm run lint:renderer` completed with the existing 55 hook-warning baseline and
no errors.

### Step 4 Result

Added annotated static NEX bank disassembly rendering in
`src/renderer/appIde/DocumentPanels/Next/nexAnnotatedDisassembly.ts`, integrated
into `src/renderer/features/memory/StaticMemoryDump.tsx`.

The annotated static disassembly now supports:

- loading the associated `.nex.dis` sidecar into the popped-out bank memory dump
  and keeping that model in memory;
- falling back to the existing static disassembly behavior when no valid bank
  annotation is available;
- mapping annotation regions to generated output;
- rendering `disassemble` regions with the existing Z80 disassembler;
- rendering byte regions as `.defb` with up to 4 byte values per generated
  line;
- rendering word regions as `.defw` with up to 2 word values per generated
  line;
- rendering skip regions as `.skip`;
- rendering synopsis annotations as prefix comment rows;
- rendering end-of-line annotations in the hard-comment lane;
- rendering annotation global/local label names at matching addresses;
- widening the disassembly label cell to fit 16-character annotation labels plus
  a colon.

Operand label substitution for 16-bit instruction operands remains deliberately
deferred to Step 5, where the Z80 disassembler will get the necessary resolver
extension without brittle string replacement.

Validation run:

```text
npm test -- --project node test/renderer/nexAnnotations.test.ts test/renderer/nexAnnotationFileType.test.ts test/renderer/nexAnnotationSidecar.test.ts test/renderer/nexAnnotatedDisassembly.test.ts
npm test -- --project jsdom test/renderer/NexFileViewerPanel.test.tsx test/renderer/NexFileViewerAnnotations.test.tsx test/controls/StaticMemoryDump.test.tsx test/controls/DisassemblyRow.test.tsx
npm run build:check
npm run lint:renderer
```

`npm run lint:renderer` completed with the existing 55 hook-warning baseline and
no errors.

### Step 5 Result

Added typed 16-bit operand label resolution to
`src/renderer/appIde/disassemblers/common-types.ts` and
`src/renderer/appIde/disassemblers/z80-disassembler/z80-disassembler.ts`, and
wired NEX annotation labels through
`src/renderer/appIde/DocumentPanels/Next/nexAnnotatedDisassembly.ts`.

The resolver now supports:

- replacing `^L`, `^W`, and `^w` operands while the Z80 disassembler is still
  processing the operand pragma;
- exposing operand metadata including instruction address, raw instruction
  offset, operand index, operand value, pragma kind, and default rendered text;
- keeping existing numeric output unchanged when no resolver is supplied;
- using explicit NEX operand references before automatic label matches;
- resolving explicit references only when the referenced label still matches
  the decoded operand value;
- resolving automatic global labels from the raw 16-bit operand value;
- resolving automatic local labels when the operand falls inside the current
  16K bank address window.

Validation run:

```text
npm test -- --project node test/z80-disassembler test/renderer/nexAnnotatedDisassembly.test.ts test/renderer/nexAnnotations.test.ts
npm test -- --project jsdom test/controls/StaticMemoryDump.test.tsx test/controls/DisassemblyRow.test.tsx
```

### Step 6.1 Result

Added the first interactive annotation toolbar infrastructure for popped-out NEX
bank documents and the NEX viewer bank header pop-out action.

The implementation now supports:

- optional per-bank `lastView` annotation metadata with `memory` and
  `disassembly` values;
- validating `lastView` while keeping older annotation files valid when the
  property is omitted;
- applying the annotated bank's saved `lastView` when opening the popped-out
  bank document;
- applying the annotated bank's saved `decimalView` and `offsetIndex` when
  opening the popped-out bank document;
- storing Memory/Disassembly view changes, Decimal changes, and disassembly
  offset changes back into the in-memory annotation model;
- marking the popped-out bank document dirty when the annotation model changes;
- showing only quiet dirty/error annotation markers in the popped-out bank
  toolbar, with no persistent loaded-state text;
- showing Manage Labels, Manage Regions, and Annotate controls in the popped-out
  bank toolbar;
- saving changed annotations back to the associated `.nex.dis` file;
- keeping the dirty marker after failed saves;
- asking for discard confirmation when a dirty popped-out bank document is
  closed;
- cancelling document close when the disposal hook returns `false`;
- rendering a pop-out icon directly in each expandable bank header in the NEX
  viewer.

Validation run:

```text
npm test -- --project node test/renderer/nexAnnotations.test.ts test/renderer/nexAnnotationSidecar.test.ts test/controls/DocumentHubService.test.ts
npm test -- --project jsdom test/renderer/NexFileViewerAnnotations.test.tsx test/controls/StaticMemoryDump.test.tsx
npm run build:check
npm run lint:renderer
git diff --check
```

### Step 6.5 Result

Added interactive end-of-line comment editing for popped-out NEX bank
disassembly rows.

The implementation now supports:

- opening an End-of-Line Comment dialog from the row context menu;
- opening the same dialog from the Annotate toolbar action for the active row;
- showing the row location and generated instruction or pragma in the dialog;
- showing an existing disassembler-generated hard comment separately when one
  exists;
- editing only the user-owned end-of-line annotation comment;
- previewing the final rendered hard-comment lane with generated and user
  comments joined by ` | `;
- treating empty Save as Clear;
- preserving synopsis comments while updating or clearing end-of-line comments;
- storing changes in the in-memory annotation model and marking the popped-out
  bank document dirty until saved.

Validation run:

```text
npm test -- --project jsdom test/renderer/NexEndOfLineCommentDialog.test.tsx test/controls/StaticMemoryDump.test.tsx
npm test -- --project node test/renderer/nexAnnotatedDisassembly.test.ts
npm run build:check
npm run lint:renderer
```

### Step 6.6 Result

Added interactive global and current-bank local label editing for popped-out NEX
bank disassembly rows.

The implementation now supports:

- opening a Label dialog from Add/Edit Global Label and Add/Edit Local Label in
  the row context menu;
- defaulting global labels to the active row's effective address;
- defaulting local labels to the active row's bank-relative offset;
- pre-filling an existing label when the selected scope already has a label at
  the default value;
- suggesting generated labels such as `L_C000` and `L_0123` when no matching
  label exists;
- accepting `$`, `0x`, `#`, trailing-`h`, and decimal label values;
- validating assembler-style identifier names, maximum 16-character names,
  duplicate names in the same scope, and global/local value ranges;
- showing a searchable existing-label list with scope, value, and referenced
  state;
- loading a listed label into the form for editing;
- saving added or edited labels back into the in-memory annotation model;
- deleting labels;
- confirming deletion of referenced labels;
- clearing explicit operand references that point to deleted labels, across all
  banks for global labels and only the current bank for local labels.

Validation run:

```text
npm test -- --project jsdom test/renderer/NexLabelDialog.test.tsx test/controls/StaticMemoryDump.test.tsx
npm test -- --project node test/renderer/nexAnnotations.test.ts test/renderer/nexAnnotatedDisassembly.test.ts
npm run build:check
npm run lint:renderer
git diff --check
```

### Step 6.7 Result

Added interactive operand label reference assignment for popped-out NEX bank
disassembly rows.

The implementation now supports:

- opening an Operand Label Reference dialog from Assign Operand Label in the
  row context menu;
- opening the same dialog from the Annotate toolbar action for the active row;
- showing the selected instruction and 16-bit operand value;
- showing an operand selector when an instruction exposes multiple 16-bit
  operand candidates;
- preferring an existing explicit operand reference when one is stored;
- otherwise preferring exact global labels, then exact current-bank local
  labels;
- grouping candidate labels as exact matches, nearby labels, and all labels;
- filtering candidates by name, hex value, decimal value, effective value, and
  scope;
- applying an explicit operand reference to the selected operand;
- clearing an explicit reference for the selected operand;
- creating a generated global or local label inline and immediately assigning it
  as the explicit operand reference;
- enabling local label creation only when the operand maps into the current
  16K bank window.

Validation run:

```text
npm test -- --project jsdom test/renderer/NexOperandLabelDialog.test.tsx test/controls/StaticMemoryDump.test.tsx
npm test -- --project node test/renderer/nexAnnotations.test.ts test/renderer/nexAnnotatedDisassembly.test.ts test/z80-disassembler/operand-label-resolver.test.ts
npm run build:check
npm run lint:renderer
git diff --check
```

### Step 6.8 Result

Added interactive memory region marking for popped-out NEX bank disassembly
rows.

The implementation now supports:

- opening a Memory Region dialog from Mark As Disassembly, Mark As Bytes, Mark
  As Words, and Mark As Skip in the row context menu;
- defaulting the dialog type from the selected Mark As action;
- defaulting Start and End to the clicked row's source byte span, or to the
  selected row range when right-clicking inside a multi-row selection;
- editing Start and End with `$`, `0x`, `#`, trailing-`h`, or decimal values;
- showing the selected length in hex and decimal;
- validating bank offset range, Start <= End, and even byte count for word
  regions;
- showing affected existing regions and whether each one will be split,
  replaced, or left unchanged;
- showing a small preview for byte, word, skip, and disassembly region output;
- replacing the selected byte span while preserving before/after fragments of
  intersecting regions;
- sorting and merging adjacent regions of the same type after the edit;
- marking the popped-out bank document dirty until annotations are saved.

Validation run:

```text
npm test -- --project jsdom test/renderer/NexRegionDialog.test.tsx test/controls/StaticMemoryDump.test.tsx
npm test -- --project node test/renderer/nexAnnotations.test.ts test/renderer/nexAnnotatedDisassembly.test.ts
npm run build:check
npm run lint:renderer
git diff --check
```

## Goal

Add optional sidecar annotations for `.nex` files so a user can reverse engineer
and comment a NEX program directly from the IDE.

The sidecar file is JSON and uses the file-name convention:

```text
<source-file>.nex -> <source-file>.nex.dis
```

Example:

```text
ScrollNutter.nex -> ScrollNutter.nex.dis
```

The NEX viewer should be able to create and use this sidecar file. The Explorer
should display `.nex.dis` files as read-only JSON with syntax highlighting.

## Product Decisions

### Local Label References

Local labels should also be usable as 16-bit operand references.

Recommended resolution rules:

- Explicit operand references stored in the annotation file win over automatic
  label matching.
- Global labels match the absolute 16-bit operand value.
- Local labels match the operand value after translating it into the current
  bank window: `operandValue - bankAddressOffset`, where `bankAddressOffset` is
  `$0000`, `$4000`, `$8000`, or `$C000`.
- If an operand could match both a global and a local label, the UI should show
  both choices while editing and store the selected scope explicitly.
- For automatic display without an explicit reference, prefer the global label
  for absolute operands and the local label only when the operand falls inside
  the selected 16K bank window.

This keeps global labels useful for true addresses while making local labels
useful for bank-relative reverse engineering.

### Raw JSON View

The `.nex.dis` document should open read-only from Explorer. Editing should be
done through the NEX disassembly UI so the IDE can validate names, ranges,
overlaps, offset choices, and operand references before writing JSON.

## Annotation File Format

Use a versioned JSON document. The first implementation should validate and
normalize this structure in a dedicated module, rather than scattering shape
checks through React components.

Draft schema:

```json
{
  "schemaVersion": 1,
  "source": {
    "fileName": "ScrollNutter.nex",
    "sha256": "optional-source-hash"
  },
  "globalLabels": [
    {
      "name": "MainLoop",
      "value": 49152
    }
  ],
  "banks": {
    "5": {
      "offsetIndex": 1,
      "regions": [
        {
          "start": 0,
          "end": 16383,
          "type": "disassemble"
        }
      ],
      "localLabels": [
        {
          "name": "DrawSprite",
          "value": 4660
        }
      ],
      "lineAnnotations": {
        "0": {
          "synopsis": "Entry point\nInitializes display state.",
          "comment": "sets up SP"
        }
      },
      "operandReferences": {
        "12": [
          {
            "operandIndex": 0,
            "scope": "global",
            "name": "MainLoop"
          }
        ]
      }
    }
  }
}
```

Rules:

- `schemaVersion` is required and starts at `1`.
- `source.fileName` is informational; association is still determined by the
  `.nex.dis` sidecar path.
- `source.sha256` is optional, but useful later for stale-annotation warnings.
- Bank keys are decimal bank numbers matching the NEX file banks.
- `offsetIndex` is `0`, `1`, `2`, or `3`, mapping to `$0000`, `$4000`, `$8000`,
  or `$C000`.
- Region `start` and `end` are inclusive bank-relative offsets in
  `$0000..$3FFF`.
- Region types are `disassemble`, `bytes`, `words`, and `skip`.
- The editor should write normalized non-overlapping regions that cover the
  entire `0..0x3fff` range. New banks default to a single `disassemble` region.
- Byte regions generate `.defb` lines with up to 4 byte values per line.
- Word regions generate `.defw` lines with up to 2 word values per line.
- Skip regions generate `.skip` pragmas.
- `lineAnnotations` keys are bank-relative offsets.
- `synopsis` renders before the generated line as one or more comment lines,
  each prefixed with `; `.
- `comment` renders at the end of the generated line where hard comments are
  currently displayed.
- Label names must follow the assembler identifier convention and be at most
  16 characters long.
- Global label values are `0..0xffff`.
- Local label values are `0..0x3fff` and are bank-relative.
- Operand references store scope and label name so global and local labels with
  the same name can still be distinguished if the format later permits it.

## Current Code Areas To Inspect

Primary implementation areas expected from the current NEX and disassembly
work:

- `src/renderer/appIde/DocumentPanels/Next/NexFileViewerPanel.tsx`
- `src/renderer/appIde/DocumentPanels/Next/nexFileLoader.ts`
- `src/renderer/features/memory/StaticMemoryDump.tsx`
- `src/renderer/controls/memory/MemoryDumpViewer.tsx`
- `src/renderer/appIde/DocumentPanels/DisassemblyPanel.tsx`
- `src/renderer/appIde/DocumentPanels/DisassemblyRow.tsx`
- `src/renderer/appIde/DocumentPanels/DisassemblyToolbars.tsx`
- `src/renderer/appIde/disassemblers/Z80Disassembler.ts`
- `src/renderer/appIde/disassemblers/common-types.ts`
- document and Explorer registration code for file extension handling
- renderer/main file APIs used to create and save project files

Before implementation, inspect the document registry and project file APIs to
choose the narrowest integration point for `.nex.dis` documents.

## Implementation Slices

### 1. Add Annotation Model, Parser, And Validation

Create a NEX annotation module near the NEX viewer or disassembler code.

Responsibilities:

- derive sidecar path from a `.nex` path;
- create a default annotation object for a loaded NEX file;
- parse and validate JSON from disk;
- normalize region ordering and full-bank coverage;
- validate bank numbers against the loaded NEX file;
- validate label names, label value ranges, comments, offset indexes, and
  operand references;
- expose small helper APIs such as `getBankOffset(offsetIndex)`,
  `getBankAnnotation(bank)`, and `resolveAnnotationLabel(...)`.

Acceptance:

- Invalid annotation files produce clear non-crashing diagnostics in the NEX
  viewer.
- Unknown future fields are preserved if practical, or ignored deliberately with
  a documented rule.

Tests:

- parser accepts a minimal valid file;
- default file generation creates loaded banks with full disassembly regions;
- invalid ranges, duplicate labels, bad names, and overlapping regions are
  rejected;
- sidecar path derivation maps `ScrollNutter.nex` to `ScrollNutter.nex.dis`.

### 2. Register `.nex.dis` As Read-Only JSON

Add document handling so selecting a `.nex.dis` file in Explorer opens a
read-only text/code document with JSON syntax highlighting.

Important detail:

- Match `.nex.dis` before any generic `.dis` or unknown-file handling.

Acceptance:

- Explorer opens `.nex.dis` files with JSON highlighting.
- The editor surface is read-only.
- Opening ordinary `.json`, `.dis`, and `.nex` files keeps existing behavior.

Tests:

- focused document registration or Explorer-open test, depending on existing
  test patterns.

### 3. Add NEX Viewer Sidecar Actions

Extend the NEX viewer with annotation awareness.

UI:

- when there is no annotation sidecar, show one compact header line with a
  short message and an inline `create` action;
- when the annotation sidecar is loaded, or has just been created, do not show
  an annotation header;
- when the annotation sidecar exists but cannot be loaded, show one short error
  line;
- pass the loaded annotation context when popping out a bank document.

Do not add Open JSON or Reload actions to the NEX viewer annotation strip. The
Explorer already opens `.nex.dis` files as read-only JSON, and the viewer should
keep the loaded/edited annotation model in memory rather than asking the user to
reload it manually.

Creation behavior:

- create `<nex path>.dis` next to the source file;
- seed it with `schemaVersion: 1`, source metadata, loaded banks, default
  offset indexes, and full-bank disassembly regions;
- do not overwrite an existing annotation file without confirmation.

Acceptance:

- A loaded NEX file can create its sidecar annotation file from the viewer.
- A loaded sidecar influences the default bank offset shown in bank pop-outs.
- The viewer remains useful when no sidecar exists.

Tests:

- NEX viewer discovers an existing sidecar;
- create action calls the project/main file API with the expected path and JSON;
- validation errors are surfaced without breaking the bank list.

### 4. Apply Annotations To Static Bank Disassembly

Use bank annotations when rendering the popped-out NEX bank disassembly.

Behavior:

- map annotation regions to `MemorySection` entries;
- use bank `offsetIndex` to initialize the disassembly offset dropdown;
- render `.defb`, `.defw`, and `.skip` output for non-disassembly regions;
- render synopsis comments before annotated lines;
- append end-of-line comments where hard comments appear now;
- render global and local labels with the annotation label names;
- expand the label column so 16-character labels plus the trailing colon fit
  cleanly.

Acceptance:

- Existing unannotated static disassembly output remains unchanged.
- Annotated bank output uses the sidecar regions and comments.
- A 16-character label does not get visually clipped or crowd instruction text.

Tests:

- annotated regions generate expected disassembly items;
- synopsis comments split into multiple `; ` lines;
- end-of-line comments render in the hard-comment position;
- 16-character labels are visible in `DisassemblyRow`.

### 5. Extend The Z80 Disassembler Deliberately

Modify `Z80Disassembler` only where annotations require it, keeping normal live
machine disassembly behavior stable.

Likely extensions:

- add options for byte and word grouping sizes, defaulting to current behavior
  unless annotation mode overrides them;
- add a label resolver callback or annotation resolver object;
- expose operand metadata for instructions that contain 16-bit operands;
- allow resolved label names to replace the rendered 16-bit operand text;
- allow generated disassembly items to carry explicit label text, pre-line
  comments, and annotation comments.

Avoid brittle string replacement after disassembly when possible. Prefer
resolving labels from the same instruction metadata that knows which operand is
a 16-bit address.

Acceptance:

- Existing disassembly tests continue to pass.
- Annotated static disassembly can substitute global and local label names for
  supported 16-bit operands.
- Unsupported or ambiguous operand references fail gracefully and keep the
  numeric operand text.

Tests:

- global label substitution for a 16-bit operand;
- local label substitution when operand falls inside the current bank window;
- explicit operand reference precedence;
- unchanged output when no annotation resolver is supplied.

### 6. Add Interactive Annotation Editing In Bank Disassembly

Add editing controls to the popped-out NEX bank disassembly view.

#### 6.1 Bank Disassembly Toolbar

Keep the current Memory/Disassembly, Decimal, Offset, and Go To controls. Add a
small annotation command group that is visible only for popped-out NEX banks
with annotation support.

Toolbar elements:

- quiet annotation state markers:
  - no marker for the normal loaded state;
  - dirty marker only when annotation changes are unsaved;
  - error marker only when annotation loading or saving fails;
- Save button, enabled only when the annotation model is dirty;
- Manage Labels button;
- Manage Regions button;
- Annotate dropdown for actions that apply to the current row or selection.

Dirty state:

- any interactive annotation edit sets the popped-out NEX bank document's
  annotation model to dirty;
- changing the Memory/Disassembly view for an annotated popped-out bank stores
  that bank's `lastView` preference in the annotation model and marks it dirty;
- changing the Decimal switch for an annotated popped-out bank stores that
  bank's `decimalView` preference in the annotation model and marks it dirty;
- changing the disassembly offset for an annotated popped-out bank stores that
  bank's `offsetIndex` preference in the annotation model and marks it dirty;
- the dirty state should be visible in the toolbar or document tab/header, for
  example with a small unsaved marker rather than persistent status text;
- the dirty marker should disappear immediately after a successful Save;
- failed saves should keep the document dirty and show a short error status.

Close behavior:

- closing a popped-out bank document with dirty annotations should ask for
  confirmation before discarding unsaved annotation changes;
- the confirmation should clearly name the associated `.nex.dis` file and offer
  at least Save, Discard, and Cancel choices if the app's dialog infrastructure
  supports three-way confirmation;
- if only a two-choice confirmation is available, use Cancel and Discard, and
  keep Save available from the toolbar;
- closing a clean popped-out bank document should not ask for confirmation.

The toolbar should not become crowded. If horizontal space is tight, collapse
Manage Labels and Manage Regions into a single menu button while keeping Save
and the dirty/error marker visible.

Bank pop-out behavior:

- each bank annotation may store an optional `lastView` value of `memory` or
  `disassembly`;
- popping out an annotated bank should open with that bank's saved `lastView`;
- each bank annotation may store an optional `decimalView` value and the bank's
  `offsetIndex`;
- popping out an annotated bank should open with that bank's saved Decimal
  state and offset;
- banks without a saved `lastView` should keep the current default memory view;
- each expandable bank header in the NEX viewer should include a pop-out icon
  that opens the same bank document as the preview's pop-out action.

#### 6.2 Row And Selection Affordances

Status: Implemented.

Result:

- annotated generated rows now retain source metadata: bank, bank-relative
  offset, byte length, and region type;
- synopsis/comment rows map back to the annotated target offset and byte span;
- rows with synopsis or end-of-line annotations show a subtle comment marker;
- rows with local/global labels show a subtle label marker while still showing
  the label text in the label column;
- byte, word, and skip regions use quiet left-edge styling;
- clicking a row selects it as the active annotation target;
- Shift-click selects a range;
- Arrow Up, Arrow Down, Home, and End move the active row; holding Shift extends
  the selected range.

Disassembly rows should expose small visual cues without becoming noisy:

- a comment marker in the gutter when a row has synopsis or end-of-line notes;
- a label marker or label text when a global or local label is attached;
- subtle region styling for bytes, words, and skip rows;
- selected row and selected range styling for region actions.

Selection behavior:

- clicking a row makes it the active annotation target;
- Shift-click selects a range;
- keyboard navigation updates the active row;
- region actions default to the selected range when there is one, otherwise to
  the current generated row's source byte span.

Each generated row must retain enough metadata to map it back to a bank-relative
offset and byte span. Comment-only generated rows should map to the annotated
target offset.

#### 6.3 Row Context Menu

Status: Implemented.

Result:

- right-clicking an annotated NEX bank disassembly row opens the annotation
  context menu;
- the menu exposes the planned comment, label, operand-label, region-marking,
  and clear actions;
- Assign Operand Label is enabled only when the clicked row has a recorded
  16-bit operand candidate;
- Clear Row Annotations is enabled only when the clicked row or selected range
  has row-level annotations;
- right-clicking inside the selected row range keeps that range as the menu
  target;
- right-clicking outside the selected range selects the clicked row and uses
  that row as the menu target;
- menu actions are placeholders until the individual edit dialogs and region
  mutation steps are implemented.

Right-clicking a disassembly row opens an annotation context menu.

Items:

- Synopsis Comment...
- End-of-Line Comment...
- Add/Edit Global Label...
- Add/Edit Local Label...
- Assign Operand Label... only enabled when the row has at least one 16-bit
  operand candidate;
- Mark As Disassembly
- Mark As Bytes
- Mark As Words
- Mark As Skip
- Clear Row Annotations, enabled only when the row has row-level annotations.

Range-sensitive items should use the current selection if the right-click is
inside the selected range. Otherwise, they should use only the clicked row.

#### 6.4 Synopsis Comment Dialog

Status: Implemented.

Result:

- Synopsis Comment opens from the disassembly row context menu;
- the Annotate toolbar action opens the same dialog for the active row;
- the dialog shows the bank, bank-relative offset, and effective address;
- the dialog provides a multiline comment textarea and live `; ` preview;
- Save stores the normalized synopsis comment in the in-memory bank annotation;
- Clear, or saving an empty/whitespace-only value, removes the synopsis comment
  while preserving any end-of-line comment on the same row;
- saved synopsis edits mark the popped-out bank document dirty and are written
  to the `.nex.dis` file by the existing Save button;
- comment normalization trims trailing spaces/tabs per line and preserves
  intentionally blank lines.

Purpose:

- edit the comment lines that render before a generated disassembly line.

Suggested title:

```text
Synopsis Comment
```

Fields:

- Location, read-only:
  - Bank number;
  - bank-relative offset in hex and decimal;
  - effective address using the active bank offset;
- Comment, multi-line text area;
- Preview, read-only, showing one generated `; ` line per entered line.

Defaults:

- if the row already has a synopsis comment, prefill it;
- otherwise leave the text area empty and focus it;
- location defaults to the active row's bank-relative offset.

Actions:

- Save;
- Clear, shown only when an existing synopsis comment is present;
- Cancel.

Validation:

- empty Save is treated like Clear;
- preserve line breaks in JSON;
- trim trailing whitespace from each line, but preserve intentionally blank
  lines by rendering them as `;`.

#### 6.5 End-Of-Line Comment Dialog

Purpose:

- edit the user comment that appears in the hard-comment lane at the end of a
  generated line.

Suggested title:

```text
End-of-Line Comment
```

Fields:

- Location, read-only;
- Instruction, read-only, showing the current generated instruction or pragma;
- Generated hard comment, read-only, shown only when the disassembler already
  provides one;
- User comment, single-line text input;
- Preview, read-only, showing the rendered line comment lane.

Defaults:

- if an annotation comment exists, prefill User comment with it;
- otherwise keep User comment empty;
- do not copy generated hard comments into the annotation file automatically.

Rendering rule:

- if both a generated hard comment and a user comment exist, render them in the
  same comment lane with a compact separator, for example
  `; generated | user note`;
- if only the user comment exists, render `; user note`;
- if only the generated hard comment exists, keep current behavior.

Actions:

- Save;
- Clear, shown only when an annotation comment exists;
- Cancel.

Validation:

- user comments are single-line values;
- pasted line breaks are converted to spaces or rejected with an inline message,
  depending on the app's existing dialog style.

#### 6.6 Add Or Edit Label Dialog

Purpose:

- create or edit a global or bank-local label at an address.

Suggested title:

```text
Label
```

Fields:

- Scope segmented control:
  - Global;
  - Local to Bank NN;
- Name text input;
- Value input with hex-first display and decimal support;
- Existing labels search box;
- Filtered labels list.

Defaults:

- when opened through Add/Edit Global Label, Scope defaults to Global and Value
  defaults to the active row's effective address;
- when opened through Add/Edit Local Label, Scope defaults to Local and Value
  defaults to the active row's bank-relative offset;
- if a label already exists at that value and scope, prefill the existing name;
- otherwise suggest a valid generated name such as `L_C000` for global labels
  or `L_0123` for local labels.

Existing labels list:

- filters by name, hex value, decimal value, and scope;
- shows name, value, scope, and whether the label is referenced;
- clicking a label loads it into the form;
- duplicate-name conflicts are shown inline.

Actions:

- Save;
- Delete, shown only when editing an existing label;
- Cancel.

Validation:

- label name must match the assembler identifier convention;
- label name length must be at most 16 characters;
- global value must be `$0000..$FFFF`;
- local value must be `$0000..$3FFF`;
- duplicate names in the same scope are blocked;
- deleting a referenced label requires a confirmation and clears or reports the
  affected operand references.

#### 6.7 Assign Operand Label Dialog

Purpose:

- assign a global or local label reference to a particular 16-bit operand in the
  current instruction.

Suggested title:

```text
Operand Label Reference
```

Fields:

- Instruction, read-only;
- Operand selector, shown only if the instruction exposes more than one
  candidate operand;
- Operand value, read-only, shown in hex and decimal;
- Candidate labels search box;
- Candidate labels filtered list;
- Inline Create Label action.

Defaults:

- select the existing explicit reference if one is stored;
- otherwise select an exact global label match if one exists;
- otherwise select an exact local label match if the operand maps into the
  current bank window;
- otherwise show no selected label and offer Create Global Label and, when
  applicable, Create Local Label.

Candidate labels list:

- first group: exact matches;
- second group: labels in the same numeric neighborhood;
- third group: all labels filtered by search text;
- each row shows scope, name, value, and effective address meaning;
- the search box matches name, hex value, decimal value, and scope.

Actions:

- Apply Reference;
- Clear Reference, enabled only when a reference is explicit;
- Create Global Label;
- Create Local Label, enabled only when the operand maps into `0..0x3fff` for
  the current bank offset;
- Cancel.

Validation:

- a selected label must exist in the selected scope;
- local labels can be referenced only when the operand maps into the current
  bank window;
- if a label is renamed later, operand references should be updated by the
  label manager rather than left dangling.

#### 6.8 Mark Region Dialog

Purpose:

- change a byte range to disassembly, bytes, words, or skip.

Suggested title:

```text
Memory Region
```

Fields:

- Type segmented control:
  - Disassembly;
  - Bytes;
  - Words;
  - Skip;
- Start offset input;
- End offset input;
- Length, read-only, shown in hex and decimal;
- Affected existing regions list;
- Preview, showing sample generated output for the first few lines.

Defaults:

- Start and End default to the selected range;
- if there is no range, use the clicked/generated row's source byte span;
- Type defaults to the current region type for that span;
- if opened from a specific Mark As menu item, Type defaults to that item.

Affected regions list:

- shows each intersecting region with start, end, type, and length;
- updates live as Start and End are edited;
- highlights whether the change will split, replace, or merge regions.

Actions:

- Apply;
- Cancel.

Validation:

- range must stay inside `$0000..$3FFF`;
- Start must be less than or equal to End;
- Word regions must contain an even number of bytes, or the dialog must offer
  an explicit adjustment before applying;
- applying a region normalizes neighboring regions of the same type.

#### 6.9 Manage Labels Dialog

Purpose:

- provide a searchable overview of global and current-bank local labels.

Suggested title:

```text
Labels
```

Fields:

- Scope tabs or segmented control:
  - All;
  - Global;
  - Bank NN;
- Search box;
- Sort selector:
  - Address;
  - Name;
  - Reference count;
- Label table;
- Add Label button.

Label table columns:

- scope;
- name;
- value;
- effective address for local labels under the current offset;
- reference count;
- actions: Edit, Delete, Go To.

Defaults:

- open with the current bank's labels visible;
- search box empty;
- sort by address.

Behavior:

- Go To navigates the bank disassembly to the label address;
- Edit opens the Label dialog;
- Delete follows the referenced-label confirmation rule;
- Add Label opens the Label dialog with a value defaulting to the active row.

Implementation result:

- added `NexLabelsDialog` with Bank/Global/All scope filters, search, and
  Address/Name/Reference count sorting;
- shows scope, label name, stored value, local effective address, and reference
  counts;
- row actions support Go To, Edit, and Delete;
- Add Global and Add Bank Label open the existing validated Label dialog with
  values defaulting to the active disassembly row;
- wired the Manage Labels toolbar button in popped-out annotated NEX bank
  disassembly;
- reused the existing label save/delete path, including confirmation before
  deleting referenced labels;
- added focused dialog and StaticMemoryDump integration tests.

#### 6.10 Manage Regions Dialog

Purpose:

- provide an exact editor for all regions in the current bank.

Suggested title:

```text
Regions
```

Fields:

- Search/filter box accepting address text and region type;
- Region type filter;
- Region table;
- Add Region button;
- Preview of selected region.

Region table columns:

- start;
- end;
- length;
- type;
- generated line count estimate;
- actions: Edit, Split, Delete/Revert, Go To.

Defaults:

- filter empty;
- current row's region selected;
- regions sorted by start offset.

Behavior:

- Edit opens the Memory Region dialog for the selected region;
- Split opens the Memory Region dialog with Start defaulting to the active row
  inside the selected region;
- Delete/Revert turns the selected region back into `disassemble` and then
  normalizes adjacent regions;
- Go To scrolls the bank disassembly to the region start.

Implementation result:

- added `NexRegionsDialog` with search and region-type filtering;
- shows every current-bank region sorted by start offset;
- displays start, end, length, type, and generated-line estimate;
- selects the active disassembly row's containing region by default;
- includes a live preview for the selected region;
- row actions support Go To, Edit, Split, and Revert;
- Add Region, Edit, and Split reuse the existing Memory Region dialog for
  exact range/type editing;
- Revert turns the selected region back into `disassemble` through the same
  normalized region-update path;
- kept the full-bank confirmation guard before applying whole-bank changes;
- added focused dialog and StaticMemoryDump integration tests.

#### 6.11 Dirty State And Saving

Save behavior:

- update the in-memory annotation model immediately after each dialog Apply or
  Save;
- re-render the disassembly immediately;
- show unsaved state in the popped-out document title or toolbar status;
- write JSON only on explicit Save;
- preserve formatting with a stable two-space JSON layout.

If multiple bank pop-outs for the same NEX file are open, they should share a
single annotation model through a small document-level service or owner state so
saves and dirty state do not diverge.

#### 6.12 Implementation Notes

Acceptance:

- A user can add comments, labels, operand references, and regions without
  editing raw JSON.
- Invalid input is blocked before it reaches disk.
- Saved annotations are visible after closing and reopening the NEX file.
- Dialogs provide useful defaults from the active row, selected range, current
  bank, and current offset.
- Searchable lists are available for labels, operand-reference candidates, and
  region management.
- Row metadata is sufficient to map generated output back to source bank
  offsets, even for pragmas and comment-only rows.

Tests:

- row context actions open the correct editor state;
- adding comments updates rendered output;
- adding labels updates rendered label text and operand choices;
- region changes update generated `.defb`, `.defw`, `.skip`, or instruction
  output;
- save writes normalized JSON.
- dialog defaults are correct for current row, selected range, global label, and
  local label actions;
- label and region searches filter by name, scope, address, and type;
- deleting or renaming labels updates or reports affected operand references.

### 7. Documentation And Polish

Add short user-facing or developer-facing documentation once the behavior is
implemented.

Potential locations:

- NEX viewer docs, if the project already has a user-facing page for it;
- `.docs` developer notes if a new annotation/disassembler contract is added;
- tests as executable examples for the JSON format.

Polish items:

- stale source warning if optional `sha256` exists and no longer matches;
- small annotation marker in the NEX bank list for banks with notes, regions,
  or labels;
- import/export action if later requested;
- keyboard shortcuts for common annotation actions after the menu workflow is
  stable.

## Risks And Mitigations

- Disassembler operand replacement may touch a mature path. Mitigate by adding
  resolver hooks and keeping default output unchanged when no annotation
  resolver is supplied.
- `.defb` and `.defw` grouping requirements differ from existing defaults.
  Mitigate with option-driven grouping so annotation mode can use 4 bytes and
  2 words without changing other views unintentionally.
- Sidecar saving must not corrupt user notes. Mitigate with validation,
  explicit Save, non-overwrite creation, and stable JSON formatting.
- Label scope can be confusing. Mitigate by storing explicit scope in operand
  references and showing scope in UI choices.

## Suggested Implementation Order

1. Annotation model, validation, and tests.
2. `.nex.dis` read-only JSON document registration.
3. NEX viewer sidecar discovery, create/open actions, and load diagnostics.
4. Annotated static bank disassembly rendering.
5. Z80 disassembler resolver extensions for labels and 16-bit operands.
6. Interactive annotation editing and save workflow.
7. Polish, docs, and full verification.

## Verification Plan

Focused checks during implementation:

```text
npm test -- --project jsdom <focused annotation and viewer tests>
npm test -- --project node <focused parser/validator tests if added outside jsdom>
npm run build:check
npm run lint:renderer
```

Before finishing the implementation, also run the relevant focused NEX viewer
and static memory dump tests already touched by the recent disassembly work.
