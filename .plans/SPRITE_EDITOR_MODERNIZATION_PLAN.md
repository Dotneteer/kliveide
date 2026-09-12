# Sprite Editor Modernization Plan

Status: **Complete.** All eight phases and §7's icon set are in, except the system-clipboard half
of §4.7 — see the Phase 8 retrospective. Layout and scope decided (§10); only §10.6 remains open, and it is
not this plan's.
Scope: `src/renderer/features/sprite-editor/*` (5 files, 1622 lines), plus two L4 token aliases, one
existing emu API call, a handful of new icons, and the first tests this feature has ever had
Related docs: `.ai/ui-theming-intent-and-lessons.md`, `.plans/UI_MODERNIZATION_PLAN.md` §10/§11
Design prototypes: **deleted**, having done their job — `sprite-lab.html` (the four layouts) and
`spr-icons-lab.html` (the icon contact sheet). They were design artefacts, never evidence, and
leaving them behind invites the next session to treat them as a reference
(`.ai/ui-theming-intent-and-lessons.md`, "Prototype For Design Decisions"). §4.1 records what they
showed; the generators are gone with them.

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
| C13 | **The two flip buttons are swapped.** "Flip vertically" mirrored *columns* (a left-to-right flip) and "Flip horizontally" mirrored *rows*. Label and icon both said the opposite of what the button did, against the GIMP/Aseprite/Photoshop convention. | `SpriteEditor.tsx:446-455` vs `:468-477` (pre-fix) | Found while porting the transforms; fixed in Phase 1. |
| C14 | **The pencil plots a dot per event, not a stroke.** Nothing interpolated between the previous position and the current one, so any drag faster than the event rate left gaps - compounded by C10's dropped frames. | `SpriteEditorGrid.tsx:158` (pre-fix) | Fixed in Phase 1: with C10 fixed, this was the only thing left making the pencil feel unreliable. |
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

### 4.1 Layout

The prototype (since deleted) drew four layouts, each in dark and light, from the real tokens and
the real Next colour maths. Every frame was the **same markup** with a different `data-v`, so the
comparison was about the design and not the mock-up, and "A — Current" was a replica of what shipped
rather than an impression of it — same 2 px pixel gutters, same diagonal transparency hatch, same
missing selection ring. The table below is the record of what it showed.

| | Layout | Buys | Costs |
| --- | --- | --- | --- |
| **A** | Current | — | U1, U2, U8, U10, U11; canvas is the smallest thing in the editor |
| **B** | Tool rail + fitted canvas + right inspector; sheet strip docked below | Canvas fills the pane at an integer zoom; tools land against the canvas; pen/fill/palette/preview get a real column | 300 px permanently to the inspector (wants a draggable splitter); the sheet strip costs ~82 px of height always |
| **C** | B + rulers, 8 px guides, onion skin, animation preview, sheet as a wrapping browser with index labels | Everything a pixel editor is judged on | The most chrome and the most to build; a wrapping browser is better for a 40-sprite sheet and worse for scrubbing a 4-frame animation |
| **D** | Canvas-first: 44 px rail with tools + pen/fill + recents, palette as a popover, thin unlabelled sheet strip | The biggest canvas by a wide margin; usable in a narrow split | The palette is a click away, which is expensive on multi-colour work; recents only help after you have used a colour |

**Decided: C, with all of its extras** (§10.2). B is C without the extras, so C's structure — tool
rail, pane-fitted canvas, right inspector, sheet as a wrapping browser — is the target, and rulers,
8 px guides, onion skin, the 1:1 preview and the animation preview are all in scope. D is not
pursued.

> **This overrides a settled decision, and the override is deliberate.**
> `.ai/ui-theming-intent-and-lessons.md` records *"Restyle + targeted layout fixes only. Nothing
> moves, everything is re-drawn."* C moves things: tools go from two horizontal toolbars to a
> vertical rail, the palette goes from beside the canvas to a right-hand inspector, the sheet goes
> from between the toolbars to a bottom dock. The reading this plan proceeds on is that the rule was
> scoped to the **shell** — sidebar, tab bar, status bar, panels — and that a document *editor*
> whose canvas cannot use its own pane is a different case. §11 owes the lessons file a
> `Settled Intent` row saying exactly that, so the next session does not have to re-derive it.
> **§10.1 is answered: document editors are exempt from the rule.** The scope of `Layout freedom`
> is the shell.

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

### 4.7 Selection and a real clipboard

Decided (§10.3): **build a real clipboard**, not a rename. That has a consequence worth stating up
front — it makes the `select` tool, which does nothing today (U13), the load-bearing part of the
feature, because a clipboard with no way to choose a region is only half of what "copy" means in a
pixel editor.

Two clipboards, deliberately separate, because they hold different things:

| | Scope | Cut | Paste |
| --- | --- | --- | --- |
| **Sheet clipboard** | whole 256-byte sprites | removes the sprite from the sheet | inserts **after** the selection (§4.8) |
| **Region clipboard** | a rectangular pixel region of the current sprite | clears the region to the transparency index | drops a *floating* region the user places; commits on click-away or `Enter` |

Rules:

- **`Ctrl/Cmd+X/C/V` act on whichever is active** — a pixel region if one is selected, the sprite
  otherwise. One key set, no modifier gymnastics.
- **A pasted region floats before it commits.** Nudge with the arrow keys, cancel with `Escape` —
  which is now the *second* thing Escape has to do correctly (C5), and the reason the tool state
  machine belongs in `useSpriteTool.ts` (§5) rather than inside the grid component.
- **Paste clips at the sprite edge.** It does not resize, wrap or scroll. Same clamping rule as C2.
- **System clipboard: sheet only, and only as `.spr` bytes**, so a sprite can move between two open
  `.spr` documents. Pixel regions stay in-process. Reading image data off the OS clipboard means
  quantising arbitrary colours into the Next palette — a real feature, and not this one.
- **Cut stops being a lie.** Today's "Cut sprite" is a delete with a scissors icon and no paste
  (U12). Once paste exists the name becomes true, and **Delete** gains its own separate button.

The `select` tool therefore needs: drag to mark a rectangle, an outline that reads over arbitrary
artwork (accent dashes, not marching ants — animation in a canvas competes with the artwork),
`Ctrl/Cmd+A` for select-all, `Escape` to clear, and arrow-key nudge of the region's *contents*. This
is the largest single piece of work in the plan, hence its own phase.

### 4.8 Insert position

Decided (§10.4): **Duplicate inserts after the selection.** Today Duplicate *and* Add both insert
before it (`SpriteEditor.tsx:176-205`, `:285-310`), which is the opposite of every list UI.

`Add new sprite` gets the same treatment in the same change — not because it was asked for, but
because one of a pair inserting before and the other after is worse than either rule applied
consistently. **If Add should stay as it is, say so and it stays.** Both continue to select the
sprite they just created.

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

Each phase is independently shippable and independently revertable. **Phases 1–4 carry no visual change at
all**; the layout work starts at Phase 5.

### Phase 1 — stop the bleeding (no visual change)
Fix C1, C2, C7, C9, C11 and the save storm P1/P2. Clamp every coordinate at the raster boundary;
give the ellipse fill a terminating condition; guard the empty-sprite-list path; coalesce saves to
the operation boundary. Extract `sprite-raster.ts` and `sprite-file.ts` and **write their tests
first** — C1 and C2 should both fall out of a test that drags a filled ellipse from `(-4,-4)` to
`(20,20)`.

> **Phase 1 retrospective.**
>
> Shipped: C1, C2, C7, C9, C11, C12, C13, C14, P1, P2, and C8/C10.
>
> - **The hang was real, and is now proven both ways.** The original span fill was replayed against
>   the six drag geometries the new test uses: three throw `TypeError` and two spin forever (stopped
>   only by a 5,000,000-iteration trip counter). All six now complete, and a filled ellipse dragged
>   400 px off every edge *in the running app* returned in **3 ms** with the renderer alive.
> - **`sprite-raster.ts` and `sprite-file.ts`** now carry every raster operation and the `.spr`
>   format. `SpriteEditorGrid.tsx` fell from **724 lines to 331**. The midpoint-ellipse and
>   Bresenham-circle maths, including the quarter-pixel `up`/`down` nudges, were ported
>   *unchanged* - they are what gives small ellipses their hand-tuned look, and altering them would
>   silently redraw everyone's existing sprites.
> - **Two rules make the bounds bugs unrepeatable**: every write goes through one `plot()` that is
>   the only place testing bounds, and shapes **clip rather than clamp**, so a caller may pass any
>   coordinate. `MAX_SPAN` bounds the work a wild `clientX` can cost.
> - **The drag position comes from the grid's own `getBoundingClientRect`**, not from a mousedown
>   delta, so it stays correct when the grid is scrolled or scaled mid-drag.
> - **38 pure tests + 10 component tests, and all 48 were confirmed to fail against the old code.**
>   That check is worth repeating every phase: two component tests passed for the wrong reason until
>   it was run.
> - **The mislabelled pointer tooltip (C12) was found by the tests, not by reading.** `title` feeds
>   `aria-label`, so `[aria-label="Pencil tool"]` matched two buttons and would have silently driven
>   the wrong tool. The test now asserts that label is unique.
> - **Verified in the running app over CDP**, not in a replica: an isolated fixture project in the
>   scratchpad, seeded through `KLIVE_SETTINGS_FILE`, so nothing of the author's was touched. **The
>   file on disk is the ground truth for the save model** - unchanged immediately after mouse-up,
>   changed after the debounce - and that is the one thing jsdom cannot prove, because it stubs the
>   IPC boundary the old code was hammering.
> - **A fast drag of two mouse-moves wrote ten contiguous pixels**, confirming C14's fix end to end.
>   The old code would have written two.
> - **No visual change, so `.ai/ui-theming-intent-and-lessons.md` is deliberately untouched.**
>   Phase 5 owes it the entries listed in section 11.
> - Type errors unchanged (161, no new messages); lint warnings 49 -> 48; all 20,188 tests pass.

### Phase 2 — undo, escape, and the tooltip
§4.5's indexed edit model; C3, C4, C5. (C12 came forward into Phase 1, and §4.8's insert-after came
forward into Phase 2 - see the retrospectives.) One test per undo/redo path, including the
cross-sprite case C3 describes.

> **Phase 2 retrospective.**
>
> Shipped: C3, C4, C5, and §4.8's insert-after, which came forward from Phase 8 because the five
> sheet operations were being rewritten anyway and touching them twice would have been worse.
>
> - **C3 was worse than the plan recorded.** Replaying the original undo path shows it corrupts in
>   *both* directions: draw on sprite 1, select sprite 3, undo, and the sheet goes `[11,22,33]` →
>   `[99,22,11]`. The edit is **not** undone *and* sprite 3 is destroyed, from one keystroke.
> - **The root cause was four pieces of state kept in step by hand** - `selectedSpriteIndex`,
>   `spriteMap`, `editStack`/`editStackIndex`, and the live `context.fileInfo.sprites` array. Every
>   undo bug was a place where they came apart. `sprite-document.ts` makes them one value, and the
>   five sheet operations collapsed from ~25 lines of hand-built edit records each to one line each.
> - **`commit()` is the only place a change becomes real.** Undo, redo and Cut each used to mutate
>   the array and return without scheduling a write; routing *every* mutation through one function
>   is what stops "this operation forgot to save" recurring, rather than fixing three call sites.
> - **Undo now navigates to the sprite it affected.** Applying the change to the right sprite is
>   only half the fix - a user left looking at a different sprite sees nothing happen and presses
>   undo again.
> - **Escape backs out one level**, a deliberate narrowing of the original intent: cancelling a drag
>   no longer changes the tool, because losing your tool mid-stroke is surprising, but an Escape
>   with nothing in flight returns to the pointer, which is what the old code was reaching for.
>   Flag this if the old all-in-one behaviour was wanted.
> - **The old “Cut sprite” is now labelled “Delete sprite”.** It has no clipboard and never did;
>   §4.7 gives it a real Cut, and a separate Delete, in Phase 8.
> - **Verified in the running app, and the file on disk is again the ground truth.** Undo of a pixel
>   edit made while viewing a *different* sprite restored the sheet to byte-for-byte identical with
>   the original - which can only happen if undo both targeted the right sprite *and* persisted.
>   Delete took the file 2560 → 2304 bytes and its undo took it back to 2560 with zero differing
>   bytes. Escape during a drag left the file untouched and the pencil still selected; a second
>   Escape flipped `aria-pressed` to the pointer, which is precisely what the old code could not do.
> - **A test-harness trap worth remembering**: clicking a tool button and then dispatching a draw in
>   the *same* CDP evaluate does nothing, because React has not re-rendered and the grid still holds
>   the old `tool` prop. Split the interaction across calls. The same mistake made a thumbnail click
>   land on the wrong sprite, since `ScreenCanvas` renders **two** canvases per thumbnail.
> - 23 pure + 11 new component tests; all 34 confirmed failing against the pre-Phase-2 code. Type
>   errors unchanged (161); lint 48 warnings, 0 errors; all 20,232 tests pass.

### Phase 3 — performance
P3–P8. Extract the status bar, memoize the canvas, hoist the toolbars out of the component body,
stabilize the palette callbacks, drop the dead `version` state in `SpriteImage`. **Measure before
and after** with a React profile over a 200-pixel drag; the acceptance criterion is *no Redux
dispatch and no disk write between mouse-down and mouse-up*.

> **Phase 3 retrospective.**
>
> Shipped: P3-P8, measured before and after in the running app over a scripted 200-step pencil drag
> and a 100-cell hover. The counters are exact (patched `putImageData`/`drawImage`, plus a
> `MutationObserver`); wall-clock is not, because the harness yields between steps.
>
> | | Original | After Phase 3 |
> | --- | --- | --- |
> | Thumbnail redraws, **hovering** 100 cells | **1,610** | **0** |
> | DOM mutation records, hovering 100 cells | 7,323 | 532 |
> | Thumbnail redraws, 200-pixel drag | 2,010 *(after Phases 1-2)* | **1** |
> | DOM mutation records, 200-pixel drag | 9,428 *(after Phases 1-2)* | 194 |
>
> - **Merely moving the pointer across the sprite redrew all ten thumbnails, sixteen times per
>   cell.** Not clicking, not drawing. That is the number that says what the architecture was: the
>   grid pushed the hover position into the state of the component that also owns the palette, both
>   toolbars and the whole strip, and `currentColorIndex` was mirrored into the *persisted* view
>   state, so each of those renders also dispatched into Redux.
> - **Three structural changes did nearly all of it**, and none of them is a `memo` sprinkle:
>   1. **The readout is not application state.** `sprite-hover.ts` is an external store;
>      `SpriteStatusBar` subscribes with `useSyncExternalStore` and is the only thing that re-renders
>      when the pointer moves. The hovered colour is no longer persisted at all - restoring "the
>      colour under the pointer last session" was never meaningful.
>   2. **The drag preview stopped round-tripping.** Every intermediate map was published up to the
>      editor and handed straight back down as a prop - a full editor re-render per mouse-move for
>      data the grid already held in a ref. The grid owns the in-progress bitmap and reports only on
>      completion; the `preview` state is gone.
>   3. **`SpriteImage` memoizes the array it hands `ScreenCanvas`.** It passed `spriteMap.slice(0)`,
>      a new `Uint8Array` every render, and `ScreenCanvas`'s redraw effect keys on `[data]` - so
>      every sprite in the sheet did a full getImageData/putImageData/drawImage cycle on every
>      render, changed or not. The `slice` stays (retuning a shared control for one caller is the
>      wrong move); it just happens once per *real* change now.
> - **Memoization only works behind stable callbacks.** Every handler became a `useCallback` reading
>   `latestDoc.current` rather than closing over `doc`, so `commit` and everything built on it keep
>   one identity for the life of the editor. This is also what finally lets `NextPaletteViewer`'s own
>   `PaletteItem` memo hit - it was being defeated by inline arrows at the call site.
> - **Side effects stay out of `setState` updaters.** An early draft put the save scheduling inside
>   `setDoc(prev => ...)`, where StrictMode would run it twice.
> - **Both toolbars moved to module level** (`SpriteSheetToolbar`, `SpriteToolsToolbar`), which ends
>   the unmount/remount-per-render of every button and tooltip popper.
> - **A latent visual bug surfaced and was fixed**: the 20px colour swatches carried no
>   `flex-shrink: 0`, so in a narrow document pane they - the only empty elements in a nowrap row of
>   text - absorbed the entire overflow and collapsed to **0px wide** while keeping the correct
>   background colour. Pre-existing, not a Phase 3 regression (the stylesheet was untouched until
>   now), and invisible in every wide-window screenshot. **This is the one style change in Phases
>   1-3, and `.ai/ui-theming-intent-and-lessons.md` is updated in the same change** per the standing
>   instruction.
> - **Two measurement traps, both of which produced a confident wrong number first:** a
>   `MutationObserver` callback is a microtask, so reading its counter at the end of a synchronous
>   loop reports zero; and React synthesises `onMouseEnter` from the bubbling `mouseover`, not from
>   native `mouseenter`, so dispatching `mouseenter` measures nothing happening at all.
> - Type errors 161 → **160** (the `useTooltipRef` generic in `SpriteImage`, fixed in passing); lint
>   48 → **47** warnings, 0 errors; all 20,232 tests still pass, unchanged.

### Phase 4 — the real palette
§4.2 and §4.3. Pass `selectedIndex` (U3). Bank control. Visible fallback labelling.

> **Phase 4 retrospective.**
>
> Shipped: §4.2, §4.3, U3, U4, U5, and the bank control.
>
> - **The ramp was not a placeholder, it was a false claim, and the proof is one value.** On the
>   running machine the editor now paints `$FF` as `rgb(255,255,255)` and `$03` as `rgb(0,0,255)`.
>   Through the old identity ramp those were `#ffffdb` and `#0000db`. The ramp never sets bit 8 of
>   the register layout - the low blue bit - so it cannot express four of the Next's eight blue
>   levels, and it contains **no pure white and no pure blue at all**. The alien fixture's eyes went
>   from cream to white in the strip the moment the real palette was wired in, thumbnails included.
> - **The Next's own default sprite palette is not the ramp either.** `PaletteDevice` seeds it with
>   `(i << 1) | (i & 2 ? 1 : 0)`, so its blue levels are {0, 2, 5, 7} where the ramp's are
>   {0, 2, 4, 6}. Anyone assuming "the default is the identity" would have found the two agree
>   nowhere except at blue 0 and 2.
> - **The fallback is labelled, in `--status-warning`, where the colours are.** A `.spr` is
>   perfectly editable with the emulator stopped, so falling back is right - but a silently-wrong
>   palette still looks like a palette, which is precisely how the device/register rotation bug
>   survived in the sidebar. The label carries a tooltip explaining what is missing and why.
> - **Identity stability had to be designed in, not added afterwards.** The hook re-runs on every
>   emulator state change, and the palette is a prop of the memoized grid, all ten thumbnails and 256
>   swatches - so it returns the *previous* array unless the values actually differ. Without that,
>   Phase 3 would have been undone by Phase 4 on the very next CPU tick.
> - **The bank control is the sidebar's, on purpose**: fill = the bank you are looking at, accent
>   ring = the bank the machine is drawing with, following the hardware until the user pins it.
>   Verified in the app with the view pinned away from live, which is the only state where the ring
>   is visible: the live segment showed `box-shadow: rgb(69,165,230) inset` with a transparent fill,
>   the pinned one an accent fill and no ring.
> - **`selectedIndex` was a one-line fix for a three-part bug** (U3): the palette had shown no
>   selection at all - not the pen colour restored from view state, not the result of Swap - and its
>   own keyboard navigation was dead until a swatch was clicked, because `handleKey` returns early
>   while `selected` is undefined.
> - **A test expectation of mine was wrong in the instructive direction**: I predicted ramp index 1
>   would be blue level 1 (`rgb(0,0,36)`); it is level 2 (`rgb(0,0,73)`), because odd blue levels are
>   unreachable. The test now carries that as its comment.
> - 6 new component tests, all confirmed failing against the pre-Phase-4 code. Type errors unchanged
>   (160); lint 47 warnings, 0 errors; all 20,238 tests pass.
> - `.ai/ui-theming-intent-and-lessons.md` updated in the same change (new palette styles): the
>   read-from-the-device rule with its visible fallback, and the reuse-the-vocabulary rule for the
>   bank control.

### Phase 5 — layout C, structure
The tool rail, the pane-fitted canvas at an integer zoom, the right inspector, the sheet as a
wrapping browser with index labels and distinct hover/selected states (U6), and a real status bar
(U10). Rulers and the 8 px guides (U8 — wiring `--color-ruler-sprite-editor` for the first time) and
the 1:1 preview (U11) land here because they are part of the canvas geometry. New icons (§7).
Delete the dead CSS and wire the two orphan tokens (U8, U9).

> **Phase 5 retrospective.**
>
> Shipped: U1, U2, U6, U8, U9, U10, U11, U13, and layout C's structure. **§7's icon redraw is not
> done** — see the caveat at the end.
>
> - **The canvas is finally sized from the pane.** Measured in the running app, fit mode across five
>   pane sizes: 1400×900 → 656px, 1100×760 → 512px, 820×560 → 320px, 640×420 → 176px, with no
>   overflow at any of them. The old editor was 257, 385 or 513px and nothing else, ever.
> - **Two layout bugs, one cause, and neither looked like itself.** A grid item spanning an
>   intrinsically-sized track pushes its content size into that track:
>   1. The sheet toolbar had **no `grid-area`** — it rendered a bare `Row` — so it auto-placed into
>      row 1, column 1 and its row of buttons sized the tool rail's `auto` column to **358px**,
>      squeezing the canvas to under half the pane. Nothing about the toolbar looked wrong; the
>      *rail* looked wrong. My first diagnosis blamed the sheet browser instead and I shipped a
>      comment saying so before measuring properly; the comment is now corrected in the stylesheet.
>   2. The inspector (a 272px palette plus a preview) spanned the sheet's `auto` row, forcing it
>      open and starving the `1fr` stage row — the canvas collapsed to its 3px floor in a short pane.
> - **`minmax(0, 132px)` is a definite maximum, and definite maxima are satisfied before `fr` gets
>   anything.** So the sheet took its full 132px while the stage starved. The stage now carries the
>   floor (`minmax(140px, 1fr)`) and the sheet yields, which is the right way round: the sheet
>   scrolls, the canvas is what the editor is for.
> - **Integer cell sizes, re-measured on resize.** Fractional cells put every edge and hairline off
>   the device pixel grid — the same lesson `NextPaletteViewer` learned from `1fr` columns.
> - **Pixels are drawn edge to edge with the grid as an overlay.** They used to be inset 1px and 2px
>   short in each direction, so the "grid" was whatever panel background showed through the gaps:
>   the gaps grew with the zoom, the pixels were never the size they claimed, and the pointer maths
>   had to carry the inset around with it.
> - **Two tokens got their first use ever** — `--color-ruler-sprite-editor` and
>   `--bgcolor-sprite-editor` were declared, typed and aliased, and referenced by nothing. This was
>   not "rendered but invisible": the rulers had never been written. Two more were added for the
>   grid and the 8px guides.
> - **The sheet index sits *under* each thumbnail, not over it.** Overlaying needs a halo to survive
>   arbitrary pixel art, and that halo would have to work against *device* pixels — which are
>   theme-invariant, so it could not come from a theme token — besides obscuring a corner of every
>   sprite. A caption costs 10px and owes nothing to what is in the picture.
> - **`ResizeObserver` had to be stubbed in `test/vitest.setup.ts`**: jsdom does not implement it, so
>   every caller (`SplitPanel`, `AttachedShadow`, the keyboard and memory panels, and now this)
>   throws on mount without it.
> - **Tests moved to the ARIA the new markup provides** — `role="option"` cells in a `role="listbox"`
>   sheet — instead of a `data-testid` on a mocked canvas. The 256 pixel rects live in one
>   `<g data-role="pixels">` so they stay addressable without an attribute on each.
> - **The window could not be resized**: Electron exposes neither CDP's `Emulator` nor its `Browser`
>   domain, and AppleScript resizing did not take. The documented substitute — sizing the element
>   itself, which drives the same `ResizeObserver` path — is how every measurement above was taken.
> - 27 component tests still pass unchanged against the rebuilt layout, which is the useful signal:
>   the behaviour Phases 1-4 pinned survived a full restructure. Type errors 160, no new messages;
>   lint 47 warnings, 0 errors; all 20,238 tests pass.
> - `.ai/ui-theming-intent-and-lessons.md` updated in the same change: a `Settled Intent` row
>   recording that document editors are exempt from `Layout freedom`, a new **CSS Grid: What Sizes A
>   Track** section, and the two operational notes above.
>
> **Icons (§7) — done, as a follow-on pass.** 23 glyphs on Lucide's grid, replacing the legacy
> `@`-prefixed stock images. Every button in the editor now renders inline SVG: verified in the app
> as 26 buttons, 26 inline `<svg>`, **zero** legacy `<img>` and **zero** duplicate glyph signatures,
> so nothing silently fell back to `unknown`.
>
> - **The set is namespaced `spr-*`, and that was not fussiness.** A drop-in `.svg` overrides the
>   stock icon of the same name *app-wide*, and five of the natural names collide with stock icons
>   in active use elsewhere: `pencil` (Breakpoints), `zoom-in`/`zoom-out` (Image viewer), `copy`
>   (four panels) and `circle-filled` — which is the **dirty-file dot in Open Editors**. A prefix
>   makes the collision impossible instead of relying on the check being repeated next time.
>   `plus.svg` already existed as a drop-in, so "Add sprite" reuses it rather than drawing a second.
> - **The two misleading glyphs are gone**: "Fit to pane" was borrowing `@separate-vertical` and now
>   has corner brackets; "Show pixel grid" was borrowing `@rectangle` and now has a 3×3 grid.
> - **Four glyphs failed their first draft, and only a contact sheet showed it.** Lucide's own
>   `flip-horizontal`/`flip-vertical` collapse at 18px into "[:]" — unreadable, and
>   *indistinguishable from each other*, which is the one thing a pair of flip buttons must not be;
>   they were redrawn as a solid shape beside its outline mirror across a dashed axis. The outline
>   pointer was mostly empty space at 18px and is now filled. The line tool's endpoint dots merged
>   into its own stroke until they went from `r=1.7` to `r=2.2`.
> - The contact sheet that caught those four (18px dark, 18px light, 48px detail) has been deleted
>   along with the layout prototype. Build a fresh one for the next icon set; that is cheaper than
>   keeping a stale one around to be mistaken for a reference.

### Phase 6 — keyboard and discoverability
§4.4. Right-click-paints-with-fill gets said out loud in the pen/fill tooltip (U14).

> **Phase 6 retrospective.**
>
> Shipped: §4.4's keyboard map and U14. The editor previously had **no keyboard at all** - not a
> tool shortcut, not undo, not an arrow key. The grid carried `tabIndex={0}` and a focus style and
> listened for exactly one key, Escape, which did nothing.
>
> - **The tool table moved to `sprite-tools.ts` before the keyboard was written.** A keypress has to
>   apply a tool *exactly* as a click does, and the alternative - a second `switch` for the keyboard
>   - is the kind of duplicate that gets one case added to it and not the other. `applyTool` now
>   serves both, with `from === to` for a keypress, so a keyboard press on a shape tool draws a
>   one-pixel shape just as a mouse click does.
> - **One cursor, not two.** Arrow keys write to the same hover store the pointer does, so there is
>   no caret that can disagree with the mouse - and the status bar readout follows both. Verified in
>   the app: four arrow presses put the readout on `x 11, y 10` and `Enter` painted exactly that
>   pixel.
> - **The cursor moved into its own component.** `SpriteCursor` subscribes to the store itself, so
>   the grid no longer re-renders all 256 `<rect>`s to move a single outline - a Phase 3-style win
>   that fell out of needing the cursor to be keyboard-addressable.
> - **The first arrow press summons the cursor to the centre without moving it.** Applying the delta
>   immediately would offset it from an origin the user never saw. My first test asserted the other
>   behaviour; the code was right and the test was wrong, and the rule is now written down where the
>   constant is defined.
> - **Only keys the editor claims are swallowed.** Anything with an unclaimed modifier falls through,
>   so `F5`, `Ctrl+S` and the debugger keys still work with the editor focused. Two tests pin this
>   from both sides: unclaimed keys must not be `defaultPrevented`, claimed ones must be.
> - **U14 is the other half of a keyboard map: publishing it.** Every tool's tooltip now carries its
>   shortcut, and the drawing tools say that **right-dragging paints with the fill colour** - true
>   since long before this work and mentioned nowhere in the UI.
> - **Test helpers moved to prefix matching** (`button(container, "Pencil tool")`), since labels now
>   carry help text. The helper still asserts exactly one match, so the Phase 1 duplicate-label
>   regression stays covered.
> - **A process failure worth recording: I corrupted the working tree with `git stash`.** The
>   `git stash push -- <paths>` I used to A/B the change failed because some paths were untracked,
>   and the `git stash pop` that followed popped an *unrelated* WIP stash from another branch into
>   the tree - seven conflicted files across `emu/machines/zxNext/`, which first showed up as the
>   type-error count dropping from 160 to 38. Recovered fully: the files were reset to HEAD, the
>   author's two stashes were intact throughout (a conflicted pop keeps its entry), and the suite
>   returned to green. The isolation check was then redone by disabling the single `onKeyDown`
>   line, which is both safer and a sharper test - it isolates Phase 6 instead of conflating it with
>   the five phases before it. The rule is now in the lessons file.
> - 20 new tests (7 pure + 13 component), and the 9 that depend on the key handler were confirmed to
>   fail with that one line removed. Type errors 160, no new messages; lint 47 warnings, 0 errors;
>   all 20,258 tests pass.

### Phase 7 — onion skin and animation preview
Grouped because both are the same new capability: **rendering a sprite other than the selected one**.
Onion skin needs the previous/next sheet cell composited under the canvas at low alpha — device
surfaces are theme-invariant, so the under-layer dims toward the checkerboard, not toward a theme
colour. The animation preview needs a frame timer, a frame-rate control, and a play/stop that stops
itself when the document loses focus.

> **Phase 7 retrospective.**
>
> Shipped: onion skin and the animation preview - grouped, as planned, because both are the same new
> capability: rendering a sprite other than the selected one.
>
> - **The onion layer goes *above* the pixels, not below them.** Below renders nothing at all: a
>   transparent pixel is painted with the crosshatch, which is opaque, so a ghost underneath is
>   hidden by exactly the pixels it is supposed to show through. Drawn above but masked to the cells
>   the current sprite leaves transparent, it does the right thing in both directions - the previous
>   frame shows through the holes, and never over the work in progress. Verified in the app on the
>   bobbed-alien fixture: 18 ghost rects at opacity 0.38, and the current sprite's own feet
>   unobscured.
> - **Opacity only, no tint.** Other editors colour-code onion frames red/blue. Device artwork is
>   theme-invariant and a hue laid over pixel art reads as *part of the pixel art*, so the ghost is
>   the neighbour's real colours at low alpha and nothing else.
> - **Previous frame only, and that is a narrowing of the plan.** §6 said "previous/next". Showing
>   both needs them told apart, and the only honest way to do that over pixel art is the tint just
>   ruled out - so the control ghosts the frame *before* this one, which is the direction a sheet is
>   read when it is an animation. It disables itself on the first sprite rather than ghosting
>   nothing. Say the word if the next frame is wanted too and it can carry a second control.
> - **The animation timer lives in `SpritePreview`, not in `SpriteEditor`.** Hoisting the frame
>   counter would have put a `setState` at up to 24 Hz above the grid, the palette and the sheet -
>   undoing Phase 3 the moment anyone pressed play. Playing re-renders three 16x16 thumbnails.
> - **It stops itself when the window is hidden**, rather than throttling: a timer running behind
>   another tab is invisible work, and pausing means the frame you come back to is the one you left.
>   It also refuses to "play" a one-sprite sheet, and recovers if sprites are deleted out from under
>   a running animation.
> - `play.svg` and `stop.svg` already existed as drop-in icons, so only `spr-onion` was drawn.
> - **Isolation checks were done by disabling one expression at a time** - the onion source, then the
>   preview's frame selection - which is the technique that replaced `git stash` after Phase 6.
>   Two tests fell over for each, and none for the other, which is what says they test what they
>   claim.
> - 18 new tests (10 for the animation hook, 8 component). Type errors 160, no new messages; lint 47
>   warnings, 0 errors; token contract green; all 20,276 tests pass.

### Phase 8 — selection and clipboard
§4.7, in this order: the `select` tool and its outline → region cut/copy/paste with the floating
commit → sheet cut/copy/paste (insert-after already landed in Phase 2) → renaming Delete back to
Cut alongside a real Delete → `.spr` bytes
on the system clipboard. Each step is usable on its own; stop anywhere and what shipped still works.

> **Phase 8 retrospective.**
>
> Shipped: the `select` tool, both clipboards, the floating paste, and Cut/Copy/Paste/Delete as four
> distinct commands. The system-clipboard half of §4.7 is **not** done - see the end.
>
> - **The tool is no longer called `pointer`.** It was named for doing nothing; it now marks
>   regions, so it is `"select"`, with the persisted old value migrated on load rather than left to
>   restore a tool that no longer exists.
> - **Phase 8's tests found a bug I shipped in Phase 1.** `endDrag` cleared `drag.current` *before*
>   calling `moveTo(at)`, and `moveTo` bails when there is no drag - so the cell the button came up
>   over was silently dropped. Invisible for a pencil, because the window `mousemove` had usually
>   already covered that cell; fatal for the select tool, where a region could never extend past
>   where the drag began. **Apply the terminal event before tearing down the gesture state.**
> - **Escape needed restructuring, not extending.** It now unwinds four levels - drag, floating
>   paste, selection, tool - and the drag lives in the canvas while the rest live above it. The
>   first attempt had both listening and neither stopping, so one press collapsed two levels. The
>   canvas now handles only its own case and calls `stopPropagation()`; everything else bubbles to
>   one handler that owns the chain. The `cancelledDrag` boolean that used to be plumbed back up is
>   gone.
> - **One key set, two clipboards.** `Ctrl+X/C/V` act on the marked pixel region when there is one
>   and on the whole sprite otherwise, so there is no modifier to remember. The buttons relabel to
>   match - "Cut region" / "Cut sprite" - which is also how the feature explains itself.
> - **A floating paste touches nothing until it is committed.** Verified against the file on disk:
>   cut blanked exactly the 3×2 region (6 bytes changed), paste wrote nothing, three arrow nudges
>   wrote nothing, `Enter` committed as **one** undo entry, and `Ctrl+Z` returned to the post-cut
>   state.
> - **Pasting a sprite makes a new sprite** rather than overwriting the current one. Silently
>   replacing what someone is working on is not what Paste means.
> - **"Cut sprite" is finally true.** It was a delete with a scissors icon and no paste anywhere in
>   the editor; there are now four commands where there was one, and Delete kept the trash icon it
>   always should have had.
> - **The clipboard is module-level**, so a sprite or a region carries between two open `.spr`
>   documents, and Paste lights up in one document when the copy happened in another.
> - 12 pure + 14 component tests. Type errors 160, no new messages; lint 47 warnings, 0 errors; all
>   20,300 tests pass.
>
> **Not done: the system clipboard.** §4.7 specified "sheet only, and only as `.spr` bytes", so a
> sprite could reach another application. What shipped is an in-process clipboard, which covers the
> case that actually comes up — moving pixels between two documents in the same window — and needs
> no answer to the question a real system format raises: what should an outside application
> *receive*? A PNG is lossy about palette indices, and raw `.spr` bytes mean nothing to anything
> else. Worth asking separately rather than answering by default.


## 7. New assets and primitives

**Done** — see the icon note at the end of the Phase 5 retrospective. The set shipped as `spr-*`
rather than the bare names listed below, because five of those names shadow stock icons that other
panels use. Original list, for the record — icons needed that were not in
`src/renderer/assets/icons/` (which held 33 files then, 56 now): `pointer`,
`pencil`, `line`, `rect`, `rect-filled`, `ellipse`, `ellipse-filled`, `bucket`, `dropper`, `select`,
`rotate-ccw`, `rotate-cw`, `flip-h`, `flip-v`, `zoom-in`, `zoom-out`, `fit`, `pixel-grid`,
`checkerboard`, `onion`, `swap`. Today these are `@`-prefixed stock IDs from the legacy
`icon-defs.ts`.

Per `AGENTS.md` and the lessons file: drop `.svg` files in `renderer/assets/icons/` (the filename is
the ID), draw them **on Lucide's grid — 24×24, `stroke-width 2`, round caps, `currentColor`** — and
**check whether the name is already used elsewhere before overriding a stock icon**, the way
`symbol-event` forced `bp-exec` to get a new file. **Done** — see the icon note in the Phase 5
retrospective for what shipped and why it is namespaced `spr-*`.

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
  `.ai/ui-theming-intent-and-lessons.md`. **A prototype is never evidence that anything works.**
- A manual pass that must be green before Phase 5 closes: drag a filled ellipse off every edge;
  draw on sprite 1, select sprite 3, undo; cut the last sprite and reopen the file; open a `.spr`
  padded with 3 trailing bytes; open a zero-byte `.spr`; close the tab mid-drag.

---

## 10. Decisions and remaining questions

Answered by the author on 2026-09-12, except §10.6, which is deliberately out of scope.

1. **Does the "nothing moves" rule bind a document editor?** — **answered: no. Document editors are
   exempt.** The `Layout freedom` row of `Settled Intent` governs the **shell** — sidebar, activity
   bar, tab bar, status bar, panels — where moving things spends users' muscle memory for little
   gain. A document editor is a workspace, and this one's defect is that its canvas cannot use its
   own pane, which no amount of redrawing fixes. §11 owes the lessons file a `Settled Intent` row
   recording the scope, so the next session does not re-derive it.
2. **Which of C's extras are wanted?** — **all of them.** Rulers, 8 px guides, onion skin, animation
   preview and the wrapping sheet browser are in scope (§4.1). Split across Phases 5 and 7 by what
   they need, not by how much they cost: the canvas-geometry ones ship with the layout, the two that
   require rendering a *different* sprite ship together afterwards.
3. **Cut with no paste** — **build a real clipboard.** §4.7. This is the largest piece of work in
   the plan and it drags the dead `select` tool in with it, which is the point: a clipboard without
   region selection is half a feature.
4. **Insert before or after the selection?** — **after.** §4.8. Applied to Add as well as Duplicate,
   for consistency; say so if Add should keep inserting before.
5. **Does the sprite editor deserve view-scoped colour?** — **no.** Settled. The accent's whole job
   here is pen/fill/selection markers, and more hues would compete with the artwork. Recorded so it
   reads as a decision rather than an omission, per the lessons file's rule that view-scoped colour
   is granted panel by panel and never taken by drift.
6. **The document-type icon colours** (`registry.ts:326-459`) — **still open, and deliberately not
   this plan's.** All 20 document types draw their tab icon with an `iconFill` from the console's
   ANSI palette, and `registry.ts` is the *only* consumer of those tokens outside the console itself.
   Whether that is the same mistake `WatchPanel` and `BreakpointIndicator` made is a question about
   the whole table — 20 entries sharing 6 colours, with `vm` appearing in five different ones — not
   about `.spr`. Fixing one row would only make the table less consistent. Raise separately.

## 11. Documentation obligation

**Any style, theming or visual change here must update `.ai/ui-theming-intent-and-lessons.md` in the
same change** — a standing instruction from the project author. Write the durable rule the change
taught, fold it into the existing sections, replace anything it supersedes, and keep no history.

Candidates this plan already knows it will produce:

- The `Settled Intent` table gains a **sprite editor** row once §10.1 is answered, whichever way.
- ~~A rule for **canvas-style views**: a device palette is read from the device with a *visible*
  fallback.~~ **Done in Phase 4** — the read-from-the-device rule and the reuse-the-bank-vocabulary
  rule are both in the lessons file now. The remaining half — that a canvas is sized from its pane
  rather than from a constant — is still owed, and belongs to Phase 5.
- A rule for **selection outlines on a canvas**: accent dashes, not marching ants — animation inside
  a drawing surface competes with the artwork it is drawn over (§4.7).
- The existing "check whether it is already rendered and merely invisible" note gains its sharper
  sibling: **a token can exist, be typed, be aliased, and never have been wired to anything at all**
  (`--color-ruler-sprite-editor`). Grep for the *token*, not just for the element.
