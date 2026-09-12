# Sprite Editor Modernization Plan

Status: **proposed** — no code written yet
Scope: `src/renderer/features/sprite-editor/*` (5 files, 1622 lines), plus two L4 token aliases, one
existing emu API call, a handful of new icons, and the first tests this feature has ever had
Related docs: `.ai/ui-theming-intent-and-lessons.md`, `.plans/UI_MODERNIZATION_PLAN.md` §10/§11
Design prototype: `sprite-lab.html` at the repo root — **a design artefact, not evidence.** Delete it
once §4.1 is decided (`.ai/ui-theming-intent-and-lessons.md`, "Prototype For Design Decisions").

---

## 1. Problem

The sprite editor has three unrelated problems that happen to live in the same folder, and it is
worth keeping them apart because they have different fixes, different risk, and different urgency.

**It is broken** (§1.1) — including one reachable renderer hang.
**It is slow** (§1.2) — one full-file disk write and a Redux dispatch *per mouse-move*.
**It is cramped** (§1.3) — the canvas is the smallest thing in the editor and gets relatively
smaller as the window gets bigger.

Only the third is a design question. The first two are defects with known fixes, and nothing in §4
depends on them.

### 1.1 Correctness

| # | Defect | Evidence | Effect |
| --- | --- | --- | --- |
| C1 | **Filled-ellipse drag off the grid edge hangs the renderer.** The span fill is `while (!pixels[row][col]) { plot(); col--; }`; out of bounds `pixels[row][col]` is `undefined`, so the condition never goes false while `plotPixel` silently no-ops on its own bounds check. If `row` is out of range, `pixels[row]` is `undefined` and it throws instead. | `SpriteEditorGrid.tsx:419-433`, reachable via `:64-73` | Infinite loop or `TypeError`. **The worst bug in the feature.** |
| C2 | **Drag coordinates are never clamped to 0..15.** `_move` derives row/col from raw `clientX/clientY` and hands them to every tool. The pencil writes `newMap[row2 * 16 + col2]` with no bounds check, so `col2 = -1` wraps into the previous row's last pixel. | `SpriteEditorGrid.tsx:64-73`, `:158`; `areaFill` at `:508-509` | Pixels land in the wrong row, or vanish. Also the trigger for C1. |
| C3 | **Undo of a pixel edit is applied to whichever sprite is selected *now*.** `EditInfo` for a `SpriteChange` records no sprite index, and `undo` calls `updateSpriteMap(edit.oldSpriteMap)`, which writes to the current selection. | `SpriteEditor.tsx:633-641`, `:129`, `:105` | Draw on sprite 1 → click sprite 3 → Undo → **sprite 3 is overwritten with sprite 1's old bitmap.** Silent data loss. |
| C4 | **Undo/redo of a sprite-list change is never written to disk**, and neither is **Cut**. Both mutate `context.fileInfo.sprites` and call `setSpriteMap` without ever calling `saveToFile`. | `SpriteEditor.tsx:125-127`, `:141-143`, `:207-231` | Deleting a sprite does not persist until some unrelated later edit happens to rewrite the file. |
| C5 | **Escape does nothing, and quietly reverts itself.** It calls `changeViewState(vs => vs.currentTool = "pointer")` but never `setCurrentTool`, so the toolbar and the `tool` prop keep the old tool — and the view-state sync effect overwrites the persisted value on the next state change. | `SpriteEditorGrid.tsx:554-563` → `SpriteEditor.tsx:588`; reverted by `:76-96` | Escape cancels the in-flight drag and nothing else. |
| C6 | **A `.spr` whose length is not a multiple of 256 renders as a load error.** `readBytes` throws at EOF; `GenericFilePanel` catches it and reports the *whole file* invalid, discarding every complete sprite already parsed. | `SprFileEditorPanel.tsx:58`, `BinaryReader.ts:63-78`, `GenericFilePanel.tsx:82-84` | A one-byte-long tail loses the file. |
| C7 | **An empty `.spr` is reported valid and then crashes the panel.** `sprites` is `[]`, `spriteMap` is `undefined`, and the grid does `Array.from(undefined)`. Every transform button also dereferences `spriteMap.slice(0)` unguarded. | `SprFileEditorPanel.tsx:55-60`, `SpriteEditor.tsx:68`, `SpriteEditorGrid.tsx:665` | Uncaught `TypeError`. |
| C8 | **Window listeners leak on unmount mid-drag**, and `removeEventListener` is generally handed a *different* closure than `addEventListener` got, because `_move`/`_endMove` are recreated every render and renders are frequent during a drag. `document.body.style.cursor` stays `crosshair`. | `SpriteEditorGrid.tsx:64-74`, `:127-128`, `:138-140` | Stuck cursor; orphaned handlers. |
| C9 | A tool value not in the `switch` propagates `sprite: null` into the parent *before* the null check, which stores `null` into the sprite list and then `sprites.set(null, …)`. Unreachable today only because `"pointer"` bails at mousedown. | `SpriteEditorGrid.tsx:97-99`, `:194-196`, `SpriteEditor.tsx:105`, `:112` | A landmine for the next tool anyone adds. |
| C10 | `setVersion(version + 1)` closes over a stale `version`, so two moves inside one commit produce the same value and React bails out of the second. `lastMovePos` is a plain `let` in the render body, so the de-dup guard resets on every render and never actually de-dups. | `SpriteEditorGrid.tsx:59`, `:103`, `:54` | Dropped frames mid-drag. |
| C11 | `zoomFactor` is clamped only by the buttons' `enable` props; a value restored from persisted view state goes straight into the size maths unchecked. | `SpriteEditor.tsx:61`, `:341`, `:347` | Latent. |
| C12 | The `@pointer` button's tooltip — and therefore its `aria-label` — says **"Pencil tool"**. Two indistinguishable "Pencil tool" buttons for a screen reader. | `SpriteEditor.tsx:353` vs `:359`, `IconButton.tsx:51` | — |

**There are no tests.** Nothing in `test/` touches `SpriteEditor`, `SpriteImage` or `SprFile`; the
`sprite` hits are all emulator-side (`test/zxnext/SpriteDevice-*.test.ts`). The neighbouring pieces
*are* covered — `test/controls/NextPaletteViewer.test.tsx`, `test/controls/GenericFilePanel.test.tsx`
— which is why they work.

### 1.2 Performance

Every one of these fires **per mouse-move over a pixel**, and they compound:

| # | Cost | Evidence |
| --- | --- | --- |
| P1 | **A full-file rewrite and an IPC round trip per pixel.** `onSpriteChange` → `updateSpriteMap` rebuilds the entire `16*16*N` byte array and awaits `saveToFile`, which maps to the **non-debounced** `saveFileContent` — it explicitly cancels pending delayed jobs and does a `saveBinaryFile` IPC call. | `SpriteEditorGrid.tsx:98` → `SpriteEditor.tsx:578-580`, `:109-115`; `ProjectService.ts:355-358` |
| P2 | **Merely opening a `.spr` writes it to disk**, and so does clicking a thumbnail. The `[spriteMap]` effect calls `onSpriteChange` unconditionally. | `SpriteEditorGrid.tsx:56-61`, `SpriteEditor.tsx:509-512` |
| P3 | **A Redux dispatch per mouse-move.** The view-state sync effect runs on each `currentColorIndex` change → `changeViewState` → `setDocumentViewState` → `signHubStateChanged`. | `SpriteEditor.tsx:76-96`, `GenericFilePanel.tsx:90-102`, `DocumentHubService.ts:471-473` |
| P4 | **All 256 palette swatches re-render.** `NextPaletteViewer` is not `memo`; `PaletteItem` *is*, but its memo never hits because `onSelection`/`onRightClick` are fresh inline arrows every render. | `NextPaletteViewer.tsx:73`, `:130-144`, `:338`; `SpriteEditor.tsx:601-602` |
| P5 | **Every thumbnail in the strip does a full canvas redraw.** `SpriteImage` passes `data={spriteMap.slice(0)}` — a new `Uint8Array` identity each render — and `ScreenCanvas`'s effect keys on `[data]`. | `SpriteImage.tsx:57`, `ScreenCanvas.tsx:86` |
| P6 | **Both toolbars unmount and remount.** `SpriteFileToolbar` and `SpriteEditorToolbar` are declared in the component body, so their function identity changes every render — taking every `SmallIconButton` and its `TooltipFactory`/popper with them. `GenericFilePanel.tsx:33-46` documents exactly this hazard one level up; the sprite editor reintroduces it one level down. | `SpriteEditor.tsx:164`, `:336`, used at `:493`, `:519` |
| P7 | 1024 inline closures rebuilt per render (four per `<rect>` × 256), and `onPositionChange` is called from **both** `onMouseEnter` and `onMouseMove`, so the parent state is written twice per cell crossing. | `SpriteEditorGrid.tsx:670-694` |
| P8 | `defaultPalette.slice(0)` allocates a fresh 256-element array every render. | `SpriteEditor.tsx:53` |

### 1.3 UX and visual

| # | Issue | Evidence |
| --- | --- | --- |
| U1 | **The canvas is fixed at 257/385/513 px** (`cellSize = (zoom-1)*8+16`, zoom 1–3) regardless of the pane. The editor gets *emptier* as the window grows. | `SpriteEditorGrid.tsx:38-39` |
| U2 | **The 285 px palette sits in the same flex row as the canvas**, so at zoom 1–2 the palette is *wider than the thing being edited*, and everything to its right is dead space. | `SpriteEditor.tsx:562-605`, `SpriteEditor.module.scss:24-31` |
| U3 | **The palette never shows what is selected.** `NextPaletteViewer` takes a `selectedIndex`; the sprite editor does not pass it. So the pen colour restored from view state shows no ring, the Swap button desyncs the viewer, and the viewer's own keyboard nav is dead until a swatch is clicked (`handleKey` returns early while `selected === undefined`). | `NextPaletteViewer.tsx:68`, `:126-128`, `:156-157`; `PaletteEditor.tsx:371` passes it; `SpriteEditor.tsx:596-603` does not |
| U4 | **The palette shown is not the sprite palette.** `defaultPalette` is a hardcoded identity ramp `0..255`, so bit 8 of the register layout is always clear — **four of the Next's eight blue levels are unreachable, and the ramp contains no pure white and no pure blue.** The real values already reach the renderer: `PaletteDevice.spriteFirst`/`spriteSecond` via `emuApi.getPalettedDeviceInfo()`, which `PalettePanel` already consumes. | `SpriteEditor.tsx:22-25`; `palette.ts:26-29`, `:61-66`; `PaletteDevice.ts:42-43`, `:243-246`; `PalettePanel.tsx:62-68`, `:137-140` |
| U5 | **The transparency index is hardcoded `0xE3` in eight places**, with no named constant — while the machine's actual value is available as `spriteTransparencyIndex` from the same call as U4. | `SpriteEditor.tsx:65, 300, 505, 527, 542, 555, 567, 599`; `PalettePanel.tsx:84-86` |
| U6 | **Selected and hovered sheet cells draw the same 2 px highlight border**, so you cannot tell which sprite you are editing while the pointer is in the strip. An all-transparent sprite is invisible. The index is only in a tooltip. | `SpriteEditor.module.scss:63-80`, `SpriteImage.tsx:50-54` |
| U7 | **No keyboard, at all** — no tool shortcuts, no `Ctrl+Z`/`Ctrl+Y`, no arrow-key cursor. The grid is `tabIndex={0}` with a focus style and handles exactly one key: Escape (which does nothing useful, C5). | `SpriteEditorGrid.tsx:547`, `:554-563` |
| U8 | **No rulers** — and `--color-ruler-sprite-editor` is declared in `theme.ts`, defined in `componentAliases.ts`, and referenced **nowhere**. `--bgcolor-sprite-editor` is likewise unused; the panel hardcodes `var(--bgcolor-editors)` instead. Per the lessons file: *"Before 'adding' a visual element, check whether it is already rendered and merely invisible."* Here it was never wired at all. | `componentAliases.ts:404-405`, `theme.ts:255-256`, `SpriteEditor.tsx:494` |
| U9 | **`styles.spriteEditorGrid` does not exist.** The class is referenced; the stylesheet has no such rule, so `className={undefined}` and the div gets only its inline size. `.spriteItem`, `.centered` and `.headerRow` are dead too. | `SpriteEditorGrid.tsx:566`; `SpriteEditor.module.scss` |
| U10 | **The position readout is `(row:col)`** — the reverse of the x,y every other pixel tool reports, unlabelled — and the RGB triple is on the Next's 0–7 scale with nothing saying so. The pen/fill chips share that one cramped strip with it. | `SpriteEditor.tsx:521-560` |
| U11 | **No preview.** Nothing shows the sprite at 1:1, which is the size it will actually be on screen, and nothing plays the sheet as an animation. | — |
| U12 | **"Cut sprite" has no clipboard and no paste** — it is a delete with a misleading name and icon. "Add new sprite" and "Duplicate" both insert *before* the selection, which is the opposite of what every list UI does. | `SpriteEditor.tsx:207-231`, `:285-310`, `:176-205` |
| U13 | The hover box is suppressed entirely while the pointer tool is active, so the one tool that does nothing is also the one that gives no feedback. | `SpriteEditorGrid.tsx:678`, `:695-699` |
| U14 | Right-click paints with the fill colour — a genuinely good feature that is completely undiscoverable. | `SpriteEditorGrid.tsx:77-81`, `:153-155` |

---

## 2. What the editor actually edits

A `.spr` is read as a flat sequence of 256-byte chunks, each one a 16×16 sprite of 8-bit palette
indices (`SprFileEditorPanel.tsx:52-60`). That is the Next's 8bpp sprite format and it is the only
thing the editor understands.

The hardware does more — 4-bit sprites (two 16×16 patterns per 256-byte slot), anchors, composite
and relative sprites, and per-sprite palette offsets — and `SpriteDevice.ts` implements all of it.
**None of that is in scope here** (§3), but it is the reason §4.2 insists the editor stop inventing
its own palette: the moment a project's sprites use a real palette, an identity ramp is not a
placeholder, it is a lie about what the artist is drawing.

---

## 3. Non-goals

- **4-bit sprites, anchors, composite/relative sprites, per-sprite palette offsets.** Later, and
  each needs a format decision first.
- **A new file format.** `.spr` stays a flat 256-byte-per-sprite blob.
- **Changing `NextPaletteViewer`.** It already does what is needed; the sprite editor just has to
  pass the props it ignores (U3).
- **Changing `GenericFilePanel` or `ProjectService`.** P1's fix is debouncing at the sprite-editor
  boundary, not changing the save path other editors rely on.
- **Rethinking the document shell.** Tabs, panels and the activity bar are untouched.

---

## 4. Design

### 4.1 Layout — the decision to make

`sprite-lab.html` draws four layouts, each in dark and light, from the real tokens and the real Next
colour maths. Every frame is the **same markup** with a different `data-v`, so the comparison is
about the design and not the mock-up. **A — Current is a replica of what ships**, not an impression
of it: same 2 px pixel gutters, same diagonal transparency hatch, same missing selection ring.

| | Layout | Buys | Costs |
| --- | --- | --- | --- |
| **A** | Current | — | U1, U2, U8, U10, U11; canvas is the smallest thing in the editor |
| **B** | Tool rail + fitted canvas + right inspector; sheet strip docked below | Canvas fills the pane at an integer zoom; tools land against the canvas; pen/fill/palette/preview get a real column | 300 px permanently to the inspector (wants a draggable splitter); the sheet strip costs ~82 px of height always |
| **C** | B + rulers, 8 px guides, onion skin, animation preview, sheet as a wrapping browser with index labels | Everything a pixel editor is judged on | The most chrome and the most to build; a wrapping browser is better for a 40-sprite sheet and worse for scrubbing a 4-frame animation |
| **D** | Canvas-first: 44 px rail with tools + pen/fill + recents, palette as a popover, thin unlabelled sheet strip | The biggest canvas by a wide margin; usable in a narrow split | The palette is a click away, which is expensive on multi-colour work; recents only help after you have used a colour |

**Recommendation: B as the floor, with C's rulers, guides and 1:1 preview adopted individually.**
B is the smallest change that fixes U1 and U2, which are the two that make the editor feel unfinished.
C's animation preview and wrapping sheet browser are genuinely separable and can wait. D is the right
answer only if the author wants this editor usable beside a debugger panel; it is not the right
default.

> **This contradicts a settled decision and needs the author to say so explicitly.**
> `.ai/ui-theming-intent-and-lessons.md` records *"Restyle + targeted layout fixes only. Nothing
> moves, everything is re-drawn."* B moves things. The claim here is that the rule was scoped to the
> **shell** — sidebar, tab bar, status bar, panels — and that a document *editor* whose canvas cannot
> use the pane is a different case. If the author disagrees, the fallback is A-with-fixes: keep the
> layout exactly, and take only §4.2–§4.6 plus U3, U6, U8, U9, U10. That still fixes every defect in
> §1.1 and §1.2. **See §10.1.**

### 4.2 The palette must come from the machine

Replace the identity ramp with the device's own sprite palette, converted once at the boundary:

```
emuApi.getPalettedDeviceInfo()
  -> spriteFirst / spriteSecond      (PaletteDevice.ts:42-43)
  -> paletteCodeFromDeviceValue(v)   (palette.ts:51-53)  -- device layout -> register layout
  -> NextPaletteViewer / grid / thumbnails
```

`PalettePanel.tsx:62-68`, `:84-86` and `:137-140` are the worked example, including the conversion.
**Do not add a layout-detecting overload** — `palette.ts:38-42` explains why the two ranges cannot be
told apart by inspection.

Fall back to the identity ramp only when no machine is running, and **say so in the palette section
header** ("no machine — default ramp"), because a silently-wrong palette is exactly the failure the
Next palette panel's own colour bug was found by (`.ai/ui-theming-intent-and-lessons.md`).

The bank (`spriteFirst`/`spriteSecond`) is a two-segment control, styled the way the sidebar's Next
palette panel already does it — *the fill is the bank you are looking at, an accent ring is the bank
the machine is drawing with.* Reuse that vocabulary rather than inventing a second one.

### 4.3 One transparency index, from the same call

`spriteTransparencyIndex` comes back from `getPalettedDeviceInfo()` alongside the palette
(`PalettePanel.tsx:84-86`). It replaces all eight hardcoded `0xE3`s. Where there is no machine, a
single exported `DEFAULT_SPRITE_TRANSPARENCY = 0xe3` constant — **one** definition, not eight
literals.

### 4.4 Keyboard map

Nothing here is novel; these are the bindings every pixel editor shares, which is the point.

| Key | Action |
| --- | --- |
| `P` `L` `R` `Shift+R` `E` `Shift+E` `F` `I` `M` | pencil / line / rect / filled rect / ellipse / filled ellipse / flood fill / pick colour / select |
| `X` | swap pen and fill |
| `Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z` | undo / redo |
| `[` `]` | previous / next sprite in the sheet |
| `+` `-` `0` | zoom in / out / fit |
| arrows | move the pixel cursor; `Enter`/`Space` paints at it |
| `Escape` | cancel the in-flight drag **and** return to the previous tool — actually, this time (C5) |

The grid already has `tabIndex={0}` and a focus style (`SpriteEditorGrid.tsx:547`,
`SpriteEditor.module.scss:43-45`); it just never listens.

### 4.5 Undo model

The current stack is a list of whole-sprite and whole-list snapshots with no sprite identity (C3).
Replace with an explicit, indexed entry:

```ts
type SpriteEdit =
  | { kind: "pixels"; index: number; before: Uint8Array; after: Uint8Array }
  | { kind: "list";   before: Uint8Array[]; after: Uint8Array[]; beforeSel: number; afterSel: number };
```

`kind: "pixels"` carrying its own `index` is the whole fix for C3. Both branches must route through
the same "apply then persist" function so C4 cannot come back. Cap the stack (128 entries is ~4 MB
at 256 bytes an entry even for a large sheet) and reset it when the document's bytes change.

### 4.6 Save model

- **Coalesce.** One save per completed *operation* (mouse-up, transform, list change), not per pixel.
  The stroke already has a natural boundary — `handleMouseUp`/`endMove`.
- **Debounce on top**, ~400 ms, so a burst of small operations is one write.
- **Never save on open or on selection change** (P2): the `[spriteMap]` effect must not call
  `onSpriteChange`, and clicking a thumbnail must not write.
- Keep using `context.saveToFile`; do not touch `ProjectService`.

---

## 5. Architecture — extract a pure model

`SpriteEditorGrid.tsx` is 724 lines, of which ~450 are Bresenham line/ellipse/rect/flood-fill code
tangled with React refs, `window` listeners and SVG rendering. That is why C1 and C2 are invisible
and why nothing is testable.

Split it the way the dialogs were split (`.docs/dialog-mvc-pattern.md`, `.ai/ui-mvc-guide.md`):

| New file | Holds | Tested |
| --- | --- | --- |
| `sprite-raster.ts` | `drawLine`, `drawRect`, `drawEllipse`, `floodFill`, `rotate`, `flip` — pure `(Uint8Array, …) => Uint8Array`, every one clamping to 0..15 | yes — this is where C1/C2 die |
| `sprite-document.ts` | the sheet: add/duplicate/remove/move/select, the undo stack of §4.5, dirty tracking | yes |
| `sprite-file.ts` | `.spr` parse/serialize, including the partial-tail and empty-file cases of C6/C7 | yes |
| `useSpriteTool.ts` | pointer capture, the drag state machine, one `useEffect` cleanup that removes listeners on unmount (C8) | partly |
| `SpriteCanvas.tsx` | rendering only; memoized; stable handlers | render test |

Two rules that follow from §1.2 and must not be relaxed:

- **`onPositionChange` must not drive parent state.** Hover position belongs in the canvas, published
  to a `<SpriteStatusBar />` that subscribes — not lifted into the component that owns the palette
  and the toolbars. This is P3/P4/P6 at the root.
- **Hoist the toolbars out of the component body** (P6) and give `NextPaletteViewer` stable
  callbacks (`useCallback`) so its `PaletteItem` memo actually hits (P4).

Per `AGENTS.md`: import from the file that owns the component; do not leave re-export shims behind.

---

## 6. Phases

Each phase is independently shippable and independently revertable. **Phase 1 is worth doing even if
§4.1 is rejected outright.**

### Phase 1 — stop the bleeding (no visual change)
Fix C1, C2, C7, C9, C11 and the save storm P1/P2. Clamp every coordinate at the raster boundary; give
the ellipse fill a terminating condition; guard the empty-sprite-list path; coalesce saves to the
operation boundary. Extract `sprite-raster.ts` and `sprite-file.ts` and write their tests first —
C1 and C2 should be caught by a test that draws a filled ellipse from `(-4,-4)` to `(20,20)`.

### Phase 2 — undo, escape, and the tooltip
§4.5's indexed edit model; C3, C4, C5, C12. One test per undo/redo path, including the cross-sprite
case that C3 describes.

### Phase 3 — performance
P3–P8. Extract the status bar, memoize the canvas, hoist the toolbars, stabilize the palette
callbacks, drop the dead `version` state in `SpriteImage`. **Measure before and after** with a
React profile over a 200-pixel drag; the acceptance number is "no Redux dispatch and no disk write
between mouse-down and mouse-up".

### Phase 4 — the real palette
§4.2 and §4.3. Pass `selectedIndex` (U3). Bank control. Fallback labelling.

### Phase 5 — layout
Whichever of §4.1 the author picks. New icons (§7). Delete the dead CSS and wire the two orphan
tokens (U8, U9). Rulers, status bar, 1:1 preview if C's items are adopted.

### Phase 6 — keyboard and discoverability
§4.4. Right-click-paints gets said out loud in the pen/fill tooltip (U14). Rename Cut → Delete, or
give it a real clipboard and a Paste (U12) — **§10.3**.

---

## 7. New assets and primitives

Icons needed that are not in `src/renderer/assets/icons/` (which holds 33 files today): `pointer`,
`pencil`, `line`, `rect`, `rect-filled`, `ellipse`, `ellipse-filled`, `bucket`, `dropper`, `select`,
`rotate-ccw`, `rotate-cw`, `flip-h`, `flip-v`, `zoom-in`, `zoom-out`, `fit`, `pixel-grid`,
`checkerboard`, `onion`, `swap`. Today these are `@`-prefixed stock IDs from the legacy
`icon-defs.ts`.

Per `AGENTS.md` and the lessons file: drop `.svg` files in `renderer/assets/icons/` (the filename is
the ID), draw them **on Lucide's grid — 24×24, `stroke-width 2`, round caps, `currentColor`** — and
**check whether the name is already used elsewhere before overriding a stock icon**, the way
`symbol-event` forced `bp-exec` to get a new file. `sprite-lab.html` carries a first draft of all of
them, drawn to that spec.

`--color-ruler-sprite-editor` and `--bgcolor-sprite-editor` already exist and finally get used.
No new colour literals: anything else gets aliased at L4.

---

## 8. Risks

- **The layout change contradicts a settled decision.** §4.1's callout. Resolve before Phase 5.
- **Reading the machine palette couples the editor to a running emulator.** The fallback must be
  visible, not silent (§4.2), or this trades a wrong-palette bug for a different wrong-palette bug.
- **Debounced saves can lose work on a crash or a fast tab close.** Flush on blur, on tab close and
  on unmount.
- **`ScreenCanvas` redraw cost** (P5) is in a shared control; fix the sprite editor's call site
  (stable `data` identity), do not retune `ScreenCanvas` for one caller — the lessons file's rule
  about not retuning a shared thing for one consumer applies to components as well as tokens.
- **166 pre-existing TS errors** is the baseline (`.ai/ui-theming-intent-and-lessons.md`). Diff by
  message, not by line.

---

## 9. Verification

- `npx vitest run --config build/vitest.config.ts --project=jsdom` — new suites for
  `sprite-raster`, `sprite-document`, `sprite-file`. **These are the first tests this feature has
  had**; the raster suite is the deliverable of Phase 1, not an afterthought.
- `npx tsc --noEmit -p build/tsconfig.web.json` — compare by message against the 166 baseline.
- `npm run lint:renderer`.
- `npx electron-vite build --config build/electron.vite.config.ts` after any file move.
- **Visual check in the running app over CDP, never in a replica.** Relaunch first; confirm port
  9222 is refused before launching, or the single-instance lock hands you the previous build. The
  recipe, the `.plans/baseline/` scripts and the `KLIVE_SETTINGS_FILE` seeding trick are in
  `.ai/ui-theming-intent-and-lessons.md`. **`sprite-lab.html` is not evidence that anything works.**
- A manual pass that must be green before Phase 5 closes: drag a filled ellipse off every edge;
  draw on sprite 1, select sprite 3, undo; cut the last sprite and reopen the file; open a `.spr`
  padded with 3 trailing bytes; open a zero-byte `.spr`; close the tab mid-drag.

---

## 10. Open questions

1. **Does the "nothing moves" rule bind a document editor?** §4.1. Everything in Phase 5 waits on
   this; nothing in Phases 1–4 does.
2. **Which of C's extras are wanted** — rulers, 8 px guides, onion skin, animation preview, wrapping
   sheet browser? They are individually adoptable and the prototype shows each.
3. **Cut with no paste** (U12): rename it Delete, or build a real sprite clipboard? A clipboard also
   wants pixel-region copy/paste, which implies the `select` tool actually does something — that is
   a larger piece of work than the rest of Phase 6.
4. **Should insert go before or after the selection?** Today both Add and Duplicate insert *before*.
5. **Does the sprite editor deserve view-scoped colour?** Per the lessons file this must be asked for
   panel by panel and never taken by drift. My read: **no** — it is a canvas, not a data panel; the
   accent's whole job here is the pen/fill/selection markers, and adding more hues would compete with
   the artwork. Recorded so it is a decision and not an omission.
6. Minor: the registry gives the `.spr` document type `iconFill: "--console-ansi-bright-green"`
   (`registry.ts:453`). The lessons file's rule is about not spending the console palette on *data
   panels*, and a file-type identity colour is arguably a different case — but the whole
   `documentPanelRegistry` table (three entries share this exact fill) does this, so it is a separate, table-wide question, not this plan's.

---

## 11. Documentation obligation

**Any style, theming or visual change here must update `.ai/ui-theming-intent-and-lessons.md` in the
same change** — a standing instruction from the project author. Write the durable rule the change
taught, fold it into the existing sections, replace anything it supersedes, and keep no history.

Candidates this plan already knows it will produce:

- The `Settled Intent` table gains a **sprite editor** row once §10.1 is answered, whichever way.
- A rule for **canvas-style views**: they are sized from the pane, not from a constant, and a device
  palette is read from the device with a *visible* fallback — the sprite editor is the second place
  (after the Next palette panel) where a plausible-looking hardcoded palette was wrong in a way no
  screenshot could show.
- The existing "check whether it is already rendered and merely invisible" note gains its sharper
  sibling: **a token can exist, be typed, be aliased, and never have been wired to anything at all**
  (`--color-ruler-sprite-editor`). Grep for the *token*, not just for the element.
