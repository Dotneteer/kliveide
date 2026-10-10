# Editing ROM Annotations in the IDE — Implementation Plan

Status: **implemented** (2026-10-10), phases W-0 to W-5. The suggested answers in §9 are the decisions; §10 records where the implementation differs from the text.

## 0. The model, in the author's terms

- **An override folder, `<Klive home>/RomAnnotations/`, holds working copies of ROM sidecars.**
  A file there is named after its ROM, the same as the shipped file: `RomAnnotations/sp48.rom.dis`
  overrides `src/public/roms/sp48.rom.dis`.
- **A working copy *replaces* the shipped sidecar of its ROM.** It is not stacked on top of it.
  Whatever the copy holds is what is displayed and edited, and nothing from the shipped file shows
  through.
- **No working copy, no editing.** The shipped sidecar is displayed, read-only, as it is today.
- **A working copy is a shipped sidecar in every respect.** When the author is satisfied with it,
  it is copied **unchanged** into `src/public/roms/`, and from then on it must pass
  `npm run rom:annotations -- --check` and `shippedRomSidecars.test.ts`. Everything the IDE writes
  therefore keeps that format, provenance included.
- **Selecting a working copy opens the ROM annotation editor.** If no ROM matches it (no loadable
  ROM page has the CRC the file's `pages` names), a message says so instead.
- **Every ROM can be edited this way, shipped or custom.** For a custom ROM (one Klive does not
  ship), the working copy can still sit beside the ROM file as `<path>.dis`, as today.

This replaces the approach of the first draft: editing `src/public/roms/` directly, an authoring
mode, and layers that hide each other's entries. None of that is needed when the working copy is
the whole file.

Builds on:
- [REVERSE_ENGINEERING_ANNOTATIONS_PLAN.md](REVERSE_ENGINEERING_ANNOTATIONS_PLAN.md) §5 (ROM
  sidecars, the index, byte binding) and §6 (provenance, D4). **This plan amends its §5.2/§5.3 and
  Q6:**
  - the user overlay becomes a *replacement* named by ROM file, not an additive layer named by CRC;
  - the user layer is no longer merged over the shipped one.
- [NEX_DEBUGGING_PLAN.md](NEX_DEBUGGING_PLAN.md) §9/§13: the annotation editor (MVC) and the bank
  document reused here.
- `.ai/rom-annotations/README.md`: the authoring rules (D4). They bind work in the IDE exactly as
  they bind editing the JSON.

---

## 1. What exists today (2026-10-10)

| Piece | Where | State |
|---|---|---|
| ROM sidecar format: `machine: "rom"`, `pages` (CRC per page), `inherits`, `provenance`, `source`, `authoring`, `level` | `annotations/programAnnotations.ts`, `common/roms/romAnnotationTools.ts` | Done |
| Formatter, provenance checks, level measure, skeleton | `romAnnotationTools.ts`: `formatRomSidecar`, `missingProvenance`, `strayProvenance`, `measureRomLevel`, `skeletonOf`; CLI `scripts/rom-annotations.cjs` | Done, used by the CLI only |
| User overlay of a shipped ROM | `romAnnotationLoader.ts`: `RomAnnotations/<crc32>.rom.dis`, **additive**, merged over the shipped layer by `mergeRomLayers` | Changes (§4.2) |
| Custom ROM sidecar `<path>.dis` beside the ROM file | `romAnnotationLoader.ts` | Kept |
| Editing a ROM row from the live Disassembly view, into the user layer, which it creates on the first edit | `liveListingPort.ts`, `liveAnnotationEditing.ts` | Changes: it writes only into an existing working copy (§4.4) |
| A machine-neutral bank document with the full editor | `features/memory/StaticMemoryDump.tsx` (`annotationPath`, `annotationBank`, `annotationMachine`) | Reused; never used for a ROM yet |
| ROM-specific decoding (`RST $08` report byte, `RST $28` calculator literals) | `romDecoder.ts`, `romDisassemblyGate.ts` | Used by the live view and `export-asm` only; **the static listing does not use it** |
| A `.dis` file opened from the Explorer | `registry.ts`: read-only JSON in the code editor | Changes for ROM sidecars (§4.3) |

The shipped `sp48.rom.dis` is still a seed: level 0, 12 labels.

## 2. What is missing

- **M1 — The override is a layer, not a file you can ship.** `RomAnnotations/<crc32>.rom.dis` holds
  only your additions, named by CRC. Copying it into `src/public/roms/` would *replace* the shipped
  content with your additions alone, and it would carry no `source`, `authoring`, `level` or
  provenance.
- **M2 — No ROM editor document.** Annotating a page today needs a running machine with that page
  paged in. On a 128K you cannot reach ROM 0 while BASIC runs in ROM 1.
- **M3 — The static listing would decode the ROM wrongly** (no `romDecoder`).
- **M4 — Nothing in the IDE keeps a working copy shippable.** New entries get no provenance,
  deleted ones leave stray keys behind, and the generic sidecar writer does not produce the
  formatter's output.
- **M5 — There is no way to tell that a working copy is ready to ship** without copying it and
  running the CLI.

## 3. Decisions

| # | Decision |
|---|---|
| R1 | **The working-copy folder is `<Klive home>/RomAnnotations/`.** It is read and written with `resolveIn: "kliveHome"`, so a portable Klive keeps it in `KliveData`. A shipped ROM's working copy has the shipped file's name. A custom ROM's working copy stays beside the ROM file (`<path>.dis`), and goes into this folder, under the ROM file's name, only when that folder is not writable. |
| R2 | **Lookup per ROM page:** (1) a working copy whose `pages` names this page's CRC; (2) otherwise the shipped sidecar found through the CRC index; (3) otherwise, for a 48K BASIC page with an unknown CRC, byte binding against the effective `sp48.rom.dis` (Q7 of the reverse-engineering plan). Only (1) is editable. **Only one sidecar is ever in effect for a page**; `mergeRomLayers` is reduced to "this page's sidecar, plus its `inherits`". |
| R3 | **A working copy's `inherits` resolve through the same lookup.** A working `sp128-1.rom.dis` that inherits `sp48.rom.dis` picks up the working `sp48` when there is one, otherwise the shipped one. That way you can work on the base ROM and see the result on every ROM that inherits from it. |
| R4 | **Selecting a working copy opens the ROM annotation editor.** A `.dis` file with `machine: "rom"` opens in a new `ROM_ANNOTATION_EDITOR`. That applies to a file opened from the Explorer, from `RomAnnotations/`, or through a command. The editor matches the file to its ROM (§4.3). With no match it shows a message, the CRCs it looked for and the places it looked; there is no editor. Other `.dis` files keep opening as read-only JSON. |
| R5 | **Shippable by construction.** Every write uses `formatRomSidecar`, the CLI's own formatter, over the whole raw file. `source`, `authoring`, `level`, `inherits` and `pages` are kept, and so are any keys not known yet. Every created or changed entry gets a provenance key; a deleted or moved one loses it. A write that would leave `missingProvenance` or `strayProvenance` non-empty is refused, with the reason. |
| R6 | **Provenance through the dialogs.** Each dialog that creates or changes an entry gets a **Provenance** selector, `observed` by default or `manual`. `derived` is never offered: only the formatter fills it in, for inherited entries. **(Q2)** |
| R7 | **A readiness check, `rom-ann-check [<file>]`.** It runs, in process, exactly what the CI does to a shipped file: it validates the sidecar, checks the page CRCs against the ROM, checks provenance and identifiers, and confirms the formatter would change nothing. It reports the measured level. The editor's toolbar shows the result as a chip: "Ready to ship · level 1", or "2 problems". |
| R8 | **Starting a working copy: `rom-ann-new <rom>`.** For a shipped ROM it copies the shipped sidecar into `RomAnnotations/` unchanged. For a custom ROM, or a shipped ROM with no sidecar, it creates a fresh file with `pages` filled in from the bytes. Then it opens the editor. A hand-copied file works the same way. **(Q1)** |
| R9 | **`level` is never raised by the IDE.** The chip shows the measured level. Recording a higher one in the file stays a deliberate step, made with the CLI or by hand, as the authoring README requires. |

## 4. Design

### 4.1 The editor document (M2, M3)

- `ROM_ANNOTATION_EDITOR` is modelled on `NexFileViewerPanel`. Its header shows the file, its ROM
  (the shipped file or the user's ROM path) and the readiness chip (R7). Below it is one row per
  page: name, CRC, size and the page's label count. Each row has **Disassembly** and **Memory**
  actions.
- A page's document is a `StaticMemoryDump`:
  - `annotationPath`: the working copy;
  - `annotationBank`: the page;
  - `annotationMachine: "rom"`;
  - `disassOffset: 0x0000`;
  - the new `disassemblyFlavor: "rom"`, which makes the listing build its rows through `romDecoder`
    for the identified ROM, the same gate as `romDisassemblyGate.ts`.

  Every NEX-viewer feature then applies unchanged: selection, shortcuts, the label, comment,
  region, bank comment and manage dialogs, and Go to Definition. No machine needs to run.
- **Open ROM annotations** on a ROM row in the live Disassembly view opens the working copy's
  editor at the row's page and offset. With no working copy, the entry is **Start editing ROM
  annotations…**, which is `rom-ann-new`.

### 4.2 Lookup and loading (R1–R3, M1)

- `romAnnotationLoader.ts`:
  - It builds a *working index* from `RomAnnotations/*.rom.dis`, mapping each `pages[].crc32` to
    its file and page. It does the same for a custom ROM's `<path>.dis`.
  - It looks that index up **before** the shipped index.
  - It reads the working copies through ordinary writable sessions and the shipped files through
    the existing read-only ones.
- **A page has one layer kind.** The `user`-over-`shipped` stacking and its tooltip ("Your ROM
  annotations") are removed. The tooltip names the file in effect: "ROM: sp48.rom (working copy)",
  or "ROM: sp48.rom".
- **Reloading.** `RomAnnotationsHost` already re-reads on an edit to a sidecar it loaded. It is
  extended in three ways:
  - it also re-reads when a file appears in or leaves `RomAnnotations/` (`rom-ann-new`, a manual
    copy, a delete);
  - it drops the binding cache of every ROM that inherits from an edited file (R3);
  - it refreshes the `ROM:<name>` condition symbols.
- **The old `<crc32>.rom.dis` overlays are migrated.** On first load each one is merged into a new
  working copy of the shipped file, its entries winning, with `observed` provenance for what it
  added. It is then renamed `<crc32>.rom.dis.bak`. `ann-info` reports the migration. The feature is
  recent, so this mostly matters to the author's own machine. **(Q3)**

### 4.3 Matching a selected file to its ROM (R4)

For each page in the file's `pages`, the editor looks for ROM bytes with that CRC, in this order:
1. the ROM file the name implies, if this is a custom ROM's `<path>.dis` beside it;
2. `roms/<name without .dis>` in the public folder, the shipped ROM. Its page CRC is checked
   rather than trusted;
3. any shipped ROM page with that CRC, through the shipped index;
4. the ROM partitions of the machine running now (`getRomSources`).

- Pages that match are listed and can be edited.
- A page with no match shows "No ROM page with CRC `a90a7b3c` was found", with the places searched.
- If **no** page matches, the editor shows only that message.
- A file that does not validate shows its diagnostics instead, and is never written.

### 4.4 The live view (R2)

- `liveRowTarget` for a ROM row returns the working copy and the page, or a reason: "No working
  copy of sp48.rom — use Start editing ROM annotations…". It no longer creates a sidecar on the
  first edit.
- Since a working copy is the whole file, editing a row that has a shipped name is editing *that*
  name. The rename, delete and region changes the first draft needed hiding entries for are
  ordinary edits here.

### 4.5 Provenance and writing (R5, R6)

- `provenanceDelta(before, after, chosen)` is a pure function over the bank before and after an
  edit. It yields the `<page>:<offset>:label|line|region` keys to add and to remove. The ROM writer
  applies the delta to the raw file and formats it with `formatRomSidecar`, the whole file at once.
- **The generic subtree writer is not used for ROM sidecars.** It is what would drift from the
  CLI's output (trap T2).

## 5. The traps

- **T1 — Two files for one ROM.** Once a working copy exists, the shipped file must not leak back
  in anywhere: not in the listing, the resolver, the Call Stack, `dis`, or the condition symbols.
  One lookup function serves them all, and a test checks each consumer against a working copy that
  renames a shipped label.
- **T2 — Formatter drift.** If the IDE's output ever differs from the CLI's, a copied file fails
  `--check` in CI. Both call `formatRomSidecar`, and a test runs an IDE edit and then the CLI
  check on the result.
- **T3 — Provenance written as part of the edit, not checked afterwards.** A refused write is
  better than a working copy that only fails once it has been copied.
- **T4 — `inherits` cycles and stale bindings.** A working copy can point `inherits` anywhere.
  Resolution stops at a cycle, with a diagnostic, and the bindings follow edits to the base (R3).
- **T5 — The shipped file changes under a working copy.** A Klive update can bring a newer shipped
  `sp48.rom.dis` while the working copy is based on the old one. The editor compares them and says
  "The shipped sidecar has changed since this copy was made". `rom-ann-new` records the shipped
  file's hash, under a key the formatter keeps and the shipped test ignores. Merging the two is out
  of scope. **(Q4)**
- **T6 — D4 is about sources, which a UI cannot enforce.** The editor's header links to
  `.ai/rom-annotations/README.md`. An AI session that drives the IDE is bound exactly as one
  editing JSON is.
- **T7 — StrictMode and focus.** The editor reuses the bank document's shortcuts and dialogs, so
  `StaticMemoryDumpShortcutFocus.test.tsx` also runs against a ROM page document.

## 6. Tests

- **Lookup:**
  - a working copy beats the shipped file;
  - with no working copy the shipped file is shown, read-only;
  - an unknown CRC on a 48K BASIC page binds against the *effective* `sp48`;
  - `inherits` resolves through working copies (R3);
  - a cycle produces a diagnostic.
- **Writer:**
  - an edit to a copy of `sp48.rom.dis` comes out exactly as the formatter would write it;
  - provenance is added and removed for create, rename, move and delete of each entry kind;
  - unknown keys survive;
  - a write that would break provenance is refused.
- **The shipping contract:** a copy of each shipped sidecar is edited through the controller and
  run through the same assertions as `shippedRomSidecars.test.ts`.
- **Editor (jsdom):**
  - the pages of `sp48.rom.dis` and of a multi-page custom file;
  - the no-match message, and a partial match;
  - opening a page lists through `romDecoder` (an `RST $08` row is followed by its report byte);
  - the shortcuts and dialogs write into the working copy.
- **Live view:** a ROM row is editable only when a working copy exists; **Start editing…** creates
  the copy.
- **Migration:** a `<crc32>.rom.dis` overlay becomes a working copy plus a `.bak`.

## 7. Phases

| Phase | Content | Size |
|---|---|---|
| **W-0** | `disassemblyFlavor: "rom"` in `StaticMemoryDump` through `romDecoder` (M3). | S |
| **W-1** | Lookup: the working index, one sidecar in effect per page, `inherits` through the lookup, reloading on folder changes, the migration of old overlays (R1–R3, M1). | M |
| **W-2** | The ROM writer: whole-file `formatRomSidecar`, `provenanceDelta`, refusals; provenance in the dialogs (R5, R6, M4). | S–M |
| **W-3** | `ROM_ANNOTATION_EDITOR`: matching and the no-match message, page documents, `rom-ann-new`, the live-view entries (R4, R8, M2). | M |
| **W-4** | `rom-ann-check` and the readiness chip (R7, R9, M5). | S |
| **W-5** | Docs: `.docs/annotations.md` "ROM Annotations", the docs-site page, `.ai/rom-annotations/README.md` (authoring in the IDE, then copying to `src/public/roms/`), and `.ai/ui-theming-intent-and-lessons.md` for the chip and the editor header. | S |

The order matters:
- W-1 and W-2 come before the editor, because they are what keeps a working copy shippable.
- W-0 is independent and can go first.
- Done before R2 of the reverse-engineering plan, this turns authoring `sp48` into work in the
  listing.

Standing rules on completion:
- Mark the feature done under G7.2 in `CLOSING_THE_GAPS_PLAN.md`.
- Update the "General reverse engineering (48K/128K)" row (§2) and the annotated-ROM part of W7
  (§4) in `LANDING_PAGE_COMPETITIVE_ANALYSIS.md`.
- New colours come from tokens.

## 8. Not in scope

- Writing into `src/public/roms/` from the IDE. Copying a working copy there stays a manual step.
- Merging a working copy with a newer shipped file (T5 only detects it).
- Editing `pages` or `inherits` from the UI. `level` is never raised by the IDE (R9).
- Per-project ROM annotations.

## 9. Questions for the author

| # | Question | Suggested answer |
|---|---|---|
| **Q1** | Is `rom-ann-new` (plus **Start editing ROM annotations…** in the live view) the way a working copy is first made, or only a hand-made copy? | Both. The command copies the shipped file exactly, so it is the same as a hand copy, minus the chance of copying the wrong file. |
| Q2 | Should every new entry default to `observed`, with `manual` chosen in the dialog? Or should the dialog ask each time? | Default to `observed`. Almost every entry is written from the bytes, and asking every time slows down level-1 work. |
| Q3 | Should the old additive `<crc32>.rom.dis` overlays be migrated automatically (§4.2), or simply ignored? | Migrate them, keeping a `.bak`. The cost is small, and no annotation is lost silently. |
| Q4 | Should a working copy record the hash of the shipped file it started from, so the editor can say the shipped file has moved on (T5)? | Yes. A Klive update would otherwise put the working copy silently out of date, and copying it back would undo the update. |

## 10. Implementation notes (2026-10-10)

Where the code differs from the plan above, and why:

- **Working copies are found by name, not by an index of the folder (§4.2).** A page's working copy is
  `RomAnnotations/<shipped sidecar>` when Klive ships one for its CRC, otherwise `<path>.dis` beside a
  custom ROM (or `RomAnnotations/<file>.dis` when not writable). It applies only when its `pages` name
  the page's CRC, read from the file because the model does not carry `pages`. The result is the same,
  with no folder listing: a byte-identical copy of `sp48.rom` still finds `RomAnnotations/sp48.rom.dis`.
- **Provenance is chosen in the editor's toolbar, not in each dialog (R6).** **New entries:
  observed | manual** sets what a *created* entry is recorded as. A *changed* entry keeps the
  provenance it had (fixing a `manual` name's typo must not turn it into `observed`), unless it had none
  or was `derived`. `rom-ann-provenance` sets an existing entry's. This keeps the seven dialogs
  unchanged.
- **The shipped text's CRC is kept in `<working copy>.base`, not in a key of the sidecar (T5),** so a
  working copy stays byte for byte what `rom:annotations` writes and can be copied without editing.
- **A custom 48K ROM's working copy still gets `sp48.rom.dis` byte-bound below it (Q7)** when it
  declares no `inherits`, as an implicit inheritance. Otherwise the first edit would make every shipped
  name vanish from a ROM that still has the 48K routines.
- **Next unlabelled target (E10) is a button on each page row of the editor,** which opens the page at
  the next unlabelled target, cycling. There is no `N` key in the listing.
- **Open ROM Annotations opens the editor, not the page at the row.** The live view does not hold the
  page's bytes, and the editor is one click from the page.
- **A page document lists the file's own entries.** A working copy that `inherits` another sidecar shows
  the inherited names in the live view and the resolver, but not in its own page document, which edits
  the file and lists what is in it.
- **A shipped sidecar opened in the editor is read-only,** through a new `readOnly` flag in the
  annotation editor's environment (`annotationReadOnly` in the bank document's view state): every
  editing entry is unavailable, nothing is written (the controller's `publish` refuses), and no warning
  is shown.
- **`ann-detect rom` needs a working copy,** like any other edit to a ROM page.

