# NEX Bank Comments Plan

Created: 2026-09-17

Status: Implemented. Decisions: H1 heading slot, P1 chip + popover with Pin (pinned = P2 strip),
` · ` line separator, `B` shortcut. No `nex-bank-comment` IDE command (open question 5 left open).

## Implementation notes

- Model/validation/edits: `nexAnnotations.ts` (`comment`, `normalizeMultilineComment`,
  `NEX_BANK_COMMENT_SOFT_LIMIT`), `nexAnnotationEdits.ts` (`withBankComment`,
  `flattenBankComment`). The synopsis dialog now delegates to the shared normalization.
- Session: `seedNexAnnotationSession` in `nexAnnotationSession.ts`; the viewer subscribes after load.
- Superseded: the viewer no longer uses expandable bank panels. Comments now show in the bank
  browser's rows and details pane (`NexBankBrowser.tsx`), and the `ExpandableRow` additions were
  reverted.
- Dialog: `NexBankCommentDialog.tsx`. Pop-out views: `NexBankCommentViews.tsx` (chip, popover, strip).
- Editor MVC: `bank-comment` action, `bankCommentRequested` intent, `dialogs.bankComment` port,
  `vm.bankComment`; the toolbar menu button no longer needs a selection.
- Not built: an "add" chip for a bank without a comment — the Annotations menu and `B`
  cover that without spending toolbar width on every bank.
- §6 fixture not edited: `ScrollNutter.nex.dis` had uncommitted changes at implementation time.

## 1. Goal

A new annotation kind for NEX debugging: a free-text, possibly multi-line **comment attached to a
whole bank** ("Music player + IM2 ISR", "Level data, packed; loaded by `LoadLevel`", ...).

- The NEX viewer shows it **in the bank's heading**: as much as fits on the one line, closed with an
  ellipsis. The full text is one hover away.
- A popped-out bank shows it too, **without permanently spending a row** of the listing on it.
- It is edited from both places, and an edit in one shows up in the other straight away.

Non-goals: rich text / Markdown rendering, per-region comments, comments on the NEX header or
loading screens (the same shape could be reused later, see §9).

## 2. What exists today (and what it constrains)

| Area | File | Relevance |
| --- | --- | --- |
| Model + validation | `Next/nexAnnotations.ts` | `NexBankAnnotation` gets the new field. `readBankAnnotation` rebuilds a bank from the keys it knows, so an unknown key is **dropped** on the next write. |
| Pure edits | `Next/nexAnnotationEdits.ts` | `withBankSettings`, `withSynopsisComment` are the patterns to copy. |
| Shared session | `Next/nexAnnotationSession.ts` | One in-memory model per `.nex.dis`, written on change, broadcast to subscribers. |
| NEX viewer | `Next/NexFileViewerPanel.tsx` | Loads the sidecar **once** with `loadNexAnnotationSidecar` and never subscribes to the session. `BankHeading` renders `Bank $05 (5)` + chips. |
| Expandable row | `controls/layout/ExpandableRow.tsx` | Slots: chevron, `heading`, `headingAction`, `meta` (right-aligned). No slot for shrinkable detail text. |
| Pop-out bank | `features/memory/StaticMemoryDump.tsx` | `PanelHeader` with view/offset/Go To/Bank location groups, then `NexAnnotationToolbar` (warning + `note` menu button). |
| Annotation editor MVC | `Next/annotationEditor/*` | Menu entries, shortcuts (`NEX_ANNOTATION_SHORTCUTS`), intents, controller ports for dialogs. Menu button is enabled only with a row selected. |
| Multi-line comment dialog | `Next/NexSynopsisCommentDialog.tsx` | `normalizeSynopsisComment` (CRLF→LF, trailing whitespace trimmed, blank → `undefined`) is exactly the normalization a bank comment needs. |

The viewer not following the session is the one real architectural gap: today nothing in the viewer
can change after load, so it never mattered. A bank comment edited in a pop-out must appear in the
viewer heading without reopening the NEX.

## 3. Data model

```ts
export type NexBankAnnotation = {
  offsetIndex: NexAnnotationOffsetIndex;
  // ...existing keys
  /** Free text about the whole bank. LF line breaks; never empty (absent instead). */
  comment?: string;
};
```

Sidecar:

```json
"banks": {
  "5": {
    "offsetIndex": 3,
    "comment": "Music player + IM2 ISR\nCalled every frame from IsrMain",
    "regions": [ ... ]
  }
}
```

Rules:

- Additive, **no schema bump** (same reasoning as `debug.labelBreakpoints`: bumping to 3 would make
  every shipped build reject the whole file).
- Validation: must be a string when present (error otherwise); empty/whitespace-only is dropped with
  a warning-free normalization; a soft cap of 4,000 characters (warning, not error) to keep the JSON
  readable.
- Normalization shared with the synopsis dialog: extract `normalizeSynopsisComment` into a neutral
  `normalizeMultilineComment` in `nexAnnotationEdits.ts` (or a tiny `nexCommentText.ts`) and use it
  from both dialogs.
- **Known exposure, stated in the doc:** a previously shipped build rebuilds banks from known keys,
  so opening a new sidecar in an old build and editing anything in that bank drops the comment.
  Nothing can fix an already-shipped build; record it in `.docs/nex-annotations.md`.

Edit helper:

```ts
export function withBankComment(
  annotations: NexFileAnnotations,
  bank: number,
  comment?: string
): NexFileAnnotations | undefined // undefined when bank missing or nothing changed
```

Display helper (pure, testable without DOM):

```ts
/** One line for a heading: lines joined with " · ", runs of whitespace collapsed. */
export function flattenBankComment(comment: string): string
```

CSS does the actual truncation (`text-overflow: ellipsis`), so the "as much as fits" rule follows
the panel width and font size rather than a character count. The flattened form keeps later lines
visible when the first is short; the separator makes the line breaks legible.

## 4. UI

Interactive prototypes: see the published artifact "NEX Bank Comment Prototypes" (linked from the
session that created this plan). Summary of the options and the recommendation:

### 4.1 NEX viewer bank heading

- **H1 — Inline after chips (recommended).** `▸ Bank $05 (5) [PC $C004] [↗]  Music player + IM2 ISR · Called ev…   16 KB`.
  The comment sits between the heading action and the size, in `--data-secondary`, italic-free,
  `flex: 1 1 0; min-width: 0` so it is the **only** thing that shrinks. Tooltip = full text with
  line breaks. Needs a new `ExpandableRow` slot (`detail?: React.ReactNode`) placed after
  `headingAction`, before `meta`; `meta` keeps `margin-left: auto`.
- **H2 — Inside the heading text.** Same text but part of `heading`. Simpler (no new slot), but the
  pop-out button then drifts right with the comment length and gets pushed past the visible area on
  narrow panels. Rejected unless the new slot is objectionable.
- Bank without a comment: nothing rendered; a hover-only `note` icon button appears beside the pop-out
  button ("Add a comment to this bank"). With a comment, clicking the comment text **does not**
  toggle the row: it opens the editor (the text is the affordance, with `cursor: text` / underline on
  hover). Keyboard: the row's context menu (right-click on heading) gets **Edit Bank Comment…**.
- Sidecar missing or failed to load: no note button; the existing banner already explains how to
  create one.

### 4.2 Popped-out bank

Three candidates, all zero rows by default:

- **P1 — Toolbar chip + popover (recommended).** A `note` chip in the annotation toolbar group showing
  the first ~32ch of the comment with an ellipsis. Click → a popover (anchored under the chip, width
  ~48ch) with the full text, pre-wrapped, plus *Edit* and *Pin* buttons. Costs zero listing rows;
  the chip shrinks to icon-only when the header is narrow (the header already wraps groups).
- **P2 — Collapsible strip.** A one-line strip between the toolbar and the listing, collapsed to the
  flattened comment + chevron; expanding shows all lines. Collapsed/expanded/hidden is a per-document
  view-state flag (not written to the sidecar, so toggling never causes a write). Costs one ~22px row
  while visible.
- **P3 — Scroll-away banner at the top of the listing.** Rendered as a synopsis-style block before
  row 0 of the disassembly (and above `$0000` in memory view). Costs space only when scrolled to the
  top, which is exactly when you are orienting yourself. Needs a virtual "pseudo-row" in the
  `VirtualizedList` item array, which touches row indexing, selection and go-to math — the most
  invasive of the three.

Recommendation: **P1, with P2 as the "Pin" state of P1.** The chip is always there and costs nothing;
*Pin* in the popover turns it into the P2 strip for users who want it on screen while reading a long
listing; unpinning collapses it back. Pinned state lives in the document view state.

### 4.3 Editing

- **Bank Comment dialog**, modelled on `NexSynopsisCommentDialog`: location row (`Bank $05 (5)`,
  16 KB), a resizable `textarea` (autofocus, `spellCheck` off, ~6 rows), a live **Heading preview**
  that renders the flattened, ellipsized line at the viewer's real heading width, and
  Save / Cancel / Clear (Clear only when a comment exists). `Ctrl/Cmd+Enter` saves; plain Enter is a
  newline.
- Entry points:
  - viewer: comment text click, hover note button, heading context menu;
  - pop-out: chip click → popover *Edit*, annotations menu **Bank Comment…**, shortcut **`B`**
    (currently unbound; see `NEX_ANNOTATION_SHORTCUTS`).
- The **Bank Comment…** menu entry and `B` shortcut are enabled **without a row selection** (unlike
  every current row action); the toolbar menu button must therefore become enabled whenever the
  sidecar is loaded, with the row-scoped entries disabled individually instead. This is a behavior
  change to `selectToolbar` and needs its test updated.

## 5. Implementation steps

### Step 1 — Model, validation, edits (pure)

- `nexAnnotations.ts`: `comment?: string` on `NexBankAnnotation`; read/validate/normalize in
  `readBankAnnotation`; round-trip preserved.
- `nexAnnotationEdits.ts`: `withBankComment`, `flattenBankComment`, shared
  `normalizeMultilineComment` (synopsis dialog switched to it).
- Tests: `test/renderer/nexAnnotations.test.ts` (valid, wrong type, empty, long → warning),
  `nexAnnotationEdits.test.ts` (set/replace/clear/no-op/missing bank, flatten cases incl. CRLF and
  blank lines), `NexSynopsisCommentDialog.test.tsx` still green.

### Step 2 — Viewer follows the session

- `NexFileViewerPanel.tsx`: once the sidecar status is `loaded`, subscribe via
  `subscribeNexAnnotationSession` and render from the snapshot's annotations; keep the existing
  initial load for the missing/invalid banners. Seed the session with the already-loaded model if it
  has none, so the file is not read twice.
- Unsubscribe on unmount / path change.
- Tests: `NexFileViewerAnnotations.test.tsx` — an `updateNexAnnotationSession` call re-renders the
  heading.

### Step 3 — Heading rendering

- `ExpandableRow`: optional `detail` slot + `.headingDetail` style (`flex: 1 1 0; min-width: 0;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--data-secondary)`).
  `detail` click stops propagation only when it is interactive.
- `BankHeading` / `NexFileViewerPanel.module.scss`: `.bankComment`, tooltip with the raw text.
- Tests: `NexFileViewerPanel.test.tsx` — comment rendered flattened, tooltip holds line breaks,
  no element when absent.

### Step 4 — Bank Comment dialog + viewer entry points

- `NexBankCommentDialog.tsx` + `.module.scss` (dialog MVC pattern per `.docs/dialog-mvc-pattern.md`).
- Viewer: hover note button, comment-text click, heading context menu; write through
  `updateNexAnnotationSession(path, withBankComment(...), projectService)`.
- Tests: `NexBankCommentDialog.test.tsx` (normalize, Clear visibility, Ctrl+Enter), consistency test
  in `NexAnnotationDialogConsistency.test.ts`.

### Step 5 — Pop-out: menu, shortcut, controller

- `NexAnnotationEditorViewModel.ts`: `bank-comment` action, `B` shortcut, entry enabled when
  annotations are loaded regardless of selection; toolbar menu button enablement updated.
- `NexAnnotationEditorIntents.ts` / `Controller.ts` / `Ports.ts`: `bankCommentRequested` intent,
  dialog port, edit applied through the session.
- Tests: view-model selectors, shortcut table, controller intent.

### Step 6 — Pop-out display (P1 chip + popover, P2 pinned strip)

- `NexBankCommentChip` in `annotationEditor/NexAnnotationEditorView.tsx` (or its own file), popover
  using the existing overlay/tooltip infrastructure; pinned strip rendered by `StaticMemoryDump`
  between `PanelHeader` and `FullPanel`.
- `bankCommentPinned?: boolean` in the static memory dump view state.
- Tests: chip hidden when no comment, popover shows full text, Pin toggles strip and view state.

### Step 7 — Docs and verification

- `.docs/nex-annotations.md`: new "Bank Comments" section incl. the old-build exposure.
- User docs under `docs/content/` for the NEX viewer (screenshot recipe via `scripts/doc-shots/` if
  the NEX page already has one).
- `npm test -- --project jsdom <touched tests>`, `npm run build:check`, `npm run lint:renderer`,
  `npx electron-vite build --config build/electron.vite.config.ts`.

## 6. Test fixture

`_experiments/testprojects/disann/ScrollNutter.nex.dis` — add comments to two banks (one single
line, one three lines incl. a blank line) for manual checks of truncation, tooltip, chip, popover
and pin.

## 7. Risks

- **Old builds drop the field** (§3). Documented, accepted.
- **Viewer ↔ session wiring** could double-load or race the initial load; seed-from-loaded avoids it.
- **Toolbar menu enablement change** (§4.3) alters an existing, tested behavior.
- **Click-to-edit on the heading** conflicts with click-to-expand; mitigated by limiting the edit
  target to the comment span and stopping propagation there only.

## 8. Open questions

1. P1 alone, P1 + pin (recommended), P2 alone, or P3?
2. Separator in the flattened heading line: ` · ` (recommended), ` ⏎ `, or first line only?
3. Should the comment also appear as a tooltip on the pop-out **tab title**? (Cheap; not planned.)
4. `B` for the shortcut, or leave it menu-only?
5. Should an IDE command (`nex-bank-comment <bank> "<text>"`) be added alongside `nex-label`?

## 9. Later

The same `comment` + chip/popover could annotate the NEX header, loading screens, or regions
(`NexAnnotationRegion.comment`) without new UI concepts.
