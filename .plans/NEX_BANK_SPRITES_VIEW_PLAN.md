# NEX Bank Sprites View Plan

Created: 2026-09-17

Status: Implemented.

## Implementation notes

- **4-bit layout verified against the FPGA** (`_input/next-fpga/src/video/sprites.vhd`): 128 bytes per
  pattern, high nibble first. Klive's emulator does *not* match it (it stores one pixel per byte,
  low nibble only); raised as a separate task rather than fixed here.
- Model `Next/nexBankSprites.ts`; sidecar block and `withBankSprites` in `nexAnnotations.ts` /
  `nexAnnotationEdits.ts`; intents `spriteSettingsChanged` and `regionSpanMarked`; `vm.bankSprites` and
  `vm.bankRegions`.
- View `Next/NexBankSpritesView.tsx` (+ `.module.scss`): `NexBankSpritesToolbar` renders into the
  dump's own header (no second chrome row); `NexBankSpritesView` is the sheet + inspector.
- **Deviation from §6**: one small 16×16 canvas per pattern, scaled by CSS with
  `image-rendering: pixelated`, instead of one canvas per row. At most 128 patterns of 256 pixels,
  a redraw is trivial, and the grid then wraps with plain CSS; transparency shows a CSS checker through
  transparent canvas pixels.
- `useSpritePalette` gained `bank` (controlled choice) and `enabled` (read the machine only while the
  view shows); the sprite editor passes neither and is unchanged. With no machine the view uses the
  Next reset palette rather than the editor's index ramp.
- Navigation locators accept `viewMode: "sprites"`; a sprite's locator address is the listed address
  of the selected pattern.
- `--sprite-px` added to the token contract's runtime-provided list.
- **Follow-up (reopen in Sprites):** the open view was first kept in view state only, so closing and
  reopening a bank fell back to `lastView`. It is now saved as `banks.<n>.sprites.active: true`
  (additive, warning-only validation), published in the same write as `lastView` through the editor
  environment's `spritesViewActive`, and read by the NEX viewer's pop-out button
  (`getAnnotatedPopOutViewForBank`) and the dump's adopt-view effect. Verified close/reopen in the app.
- Checked in the running app (bank 5 of `ScrollNutter.nex`): 8-bit, 4-bit, 1×–3× zoom, inspector,
  live-palette ring.

Decisions (2026-09-17):

- Layout: **S2** (grid + inspector).
- **4-bit** patterns are in the first cut, with the palette offset control.
- Offered for **NEX banks only**.
- The pattern **format and start offset are saved per bank in the sidecar** (additive
  `banks.<n>.sprites`, §3).
- **Mark as Bytes** is in the first cut, and works on a multi-pattern selection (§4.3).

## 1. Goal

A third view for a popped-out bank, beside **Memory** and **Disassembly**: **Sprites**. It renders
the bank's 16K bytes as a sheet of 16×16 ZX Spectrum Next sprite patterns, so a reader can tell at a
glance whether (and where) a bank holds graphics, and what they look like.

- The user chooses the **primary or secondary sprite palette** (Next Reg `$43` bit 3 picks between
  them on the machine).
- It works with the file's bytes and, while a machine runs, with the bank's live bytes (the same rule
  as the other two views).
- It costs nothing when not selected.

Non-goals: editing pixels (the `.spr` editor exists for that), showing the machine's *pattern
memory* (uploaded via port `$5B`, not a bank), Layer 2 / tilemap renderings (possible later, §9).

## 2. What exists and can be reused

| Need | Existing piece | Notes |
| --- | --- | --- |
| Live primary/secondary sprite palette | `features/sprite-editor/useSpritePalette.ts` | Reads `emuApi.getPalettedDeviceInfo()` (`spriteFirst`, `spriteSecond`, `reg43Value`, `spriteTransparencyIndex`), refreshes on emulator state, converts device values with `paletteCodeFromDeviceValue`, keeps array identity stable. Falls back to the index ramp with `source: "default"`. |
| Palette switch vocabulary | `features/sprite-editor/SpritePaletteHeader.tsx` | "Fill = bank shown, ring = bank the machine draws with". Reuse the component or its styles rather than inventing a second switch. |
| Rendering one sprite | `features/sprite-editor/SpriteImage.tsx` → `controls/Next/ScreenCanvas` | Memoized; one canvas per sprite. For 64–128 cells a single sheet canvas may be cheaper (§6). |
| Default transparency | `sprite-file.ts` `DEFAULT_SPRITE_TRANSPARENCY = 0xE3` | |
| Bank bytes, live or file | `StaticMemoryDump.tsx` `bankBytes` (`useNexLiveBankBytes`) | Already feeds Memory and Disassembly. |
| View switch | `StaticMemoryDump.tsx` `staticDumpViewModeOptions`, `StaticDumpViewMode` | Currently `"memory" \| "disassembly"`. |
| Per-bank remembered view | sidecar `banks.<n>.lastView` (`NexAnnotationBankView`) | See §3 — cannot simply gain `"sprites"`. |

## 3. The persistence trap

`readLastView` in `nexAnnotations.ts` reports any value other than `memory`/`disassembly` as an
**error**, and any error makes `validateNexAnnotations` return no model. So writing
`"lastView": "sprites"` would make every **already shipped** build refuse the whole sidecar —
labels, regions, comments, breakpoints and all.

Decisions:

- `NexAnnotationBankView` stays `"memory" | "disassembly"`; `lastView` keeps meaning exactly what it
  means today.
- **Which view is open** is remembered in **document view state** (`viewMode: "sprites"` in
  `MemoryDumpViewState`), like `sysVarNames` and `disassembleScreen`. The annotation editor's
  environment maps `sprites` to "no change" for `lastView`, so switching to Sprites never writes.
- **What the bank's sprite data is** — its format and where it starts — is a fact about the program,
  so it goes in the sidecar as an additive block:

  ```json
  "banks": {
    "10": {
      "offsetIndex": 1,
      "regions": [ ... ],
      "sprites": { "format": "4bit", "offset": 3 }
    }
  }
  ```

  - `format`: `"8bit"` or `"4bit"`. `offset`: `0..$3FFF`, the bank offset of pattern #0.
  - Both keys optional; an absent block means `8bit` at `0`. A block equal to that default is removed
    rather than stored.
  - **Validation reports bad values as warnings and ignores them — never errors.** An error would make
    this build refuse the whole sidecar over a view setting, which is the trap above.
  - Written through the shared session when the user changes format or offset, like every other
    annotation (no Save). Nudging the offset repeatedly publishes repeatedly; the session already
    coalesces writes, so a burst costs two.
  - Known exposure, same as bank comments: a previously shipped build rebuilds a bank from the keys it
    knows, so editing that bank in an old build drops `sprites`. Documented, accepted.
- **How it is looked at** — palette choice, 4-bit palette offset, zoom, transparency checker, selected
  pattern — stays in document view state.

## 4. UI

Prototypes: published artifact "Bank Sprite Views" (linked from the session that produced this
plan). Three layouts, one shared toolbar.

### 4.1 Toolbar (all layouts)

`View [Sprites ▾]` · `Palette [Primary | Secondary]` · `Format [8-bit | 4-bit]` · `Offset $0000 ◂ ▸`
· `Zoom [2× 3× 4×]` · `☐ Show transparent` · *Live* marker (existing) · annotation toolbar (existing).

- **Palette**: segmented, reusing `SpritePaletteHeader`'s meaning — the filled segment is the palette
  shown, a ring marks the one Reg `$43` currently selects. Without a Next machine: both segments stay
  usable but a quiet "Default palette — no machine" note replaces the ring, and primary/secondary are
  identical (both are the reset palette), which the tooltip says.
- **Format**: 8-bit (256 bytes/pattern, 64 in a bank) or 4-bit (128 bytes/pattern, two pixels per
  byte high nibble first, 128 in a bank). 4-bit adds a *palette offset* dropdown (`0..15`, ×16),
  matching sprite attribute 2 bits 7:4.
- **Offset**: where the first pattern starts in the bank. Nudge by 1 byte / by one pattern, or type
  an offset. Sprite data is rarely at `$0000` in a mixed bank; a one-byte misalignment turns clean
  sprites into diagonal noise, which the sheet makes obvious.
- **Show transparent**: transparent index (Reg `$4B`, default `$E3`) drawn as a checkerboard instead
  of the palette colour.

### 4.2 Layouts

- **S1 — Sprite grid.** One cell per pattern with its pattern number and bank offset
  (`#12 $0C00`), wrapped to the panel width. Hover shows address; click selects; double-click (or
  Enter) switches to Memory/Disassembly at that offset. Simple, scannable, matches the `.spr`
  editor's sheet browser.
- **S2 — Grid + inspector (recommended).** S1 plus a right-hand inspector for the selected pattern:
  large zoomed rendering with pixel grid, offset and address, the colours it uses (swatches with
  index and RGB333), "blank / mostly one colour / looks like code" hint, and actions *Show in Memory*,
  *Show in Disassembly*, *Mark as Bytes* (§4.3). The inspector collapses to nothing below a panel
  width, becoming S1.
- **S3 — Continuous bitmap.** The bank as one image, 16 patterns per row, with a faint 16×16 grid.
  Best at *finding* sprite data and alignment in a bank that is mostly code; less good at reading
  individual sprites. Could be a zoom level of S1/S2 ("Fit") rather than a separate layout.

Chosen: **S2**, with S3's "whole bank at 1×" available as the smallest zoom step.

### 4.3 Mark as Bytes

Why: a bank starts as one `disassemble` region, so sprite data reads as nonsense instructions in the
Disassembly view. Marking it `bytes` makes that view show `.defb` lines instead.

- **Selection**: click selects one pattern; Shift+click / Shift+arrows extend a contiguous range.
  The inspector shows the first pattern and says how many are selected.
- **Action**: *Mark as Bytes* (inspector button, and the grid's context menu) replaces the regions
  over `patternOffset(first) .. patternOffset(last) + patternSize - 1` with one `bytes` region, through
  the existing `withRegion` edit and the shared session. The span covering the whole bank asks the
  existing whole-bank confirmation.
- **State shown**: a pattern whose bytes are already entirely `bytes` gets a small corner mark in the
  grid, and the button reads *Marked as Bytes* (disabled) when the whole selection already is. A
  partly marked selection keeps the button enabled.
- **Undoing** is the existing route: Manage Regions, or Mark As Disassembly in the Disassembly view.
  The inspector also offers *Mark as Disassembly* when the selection is marked, so the reverse is
  as close as the action.

## 5. Behaviour details

- **Selection** in the sprites view is its own (an anchor and an active pattern index), not the
  disassembly row selection; it reaches the annotation editor only through *Mark as Bytes* /
  *Mark as Disassembly*, as an offset span.
- **Keyboard**: arrows move the selected pattern (Shift extends), PageUp/PageDown by a row, Home/End,
  Enter → Memory
  at offset, `B` still opens Bank Comment (the one bank-wide shortcut). Letters bound to row actions
  are not live in this view.
- **Live bytes**: re-render only when `bankBytes` identity changes (already stable while idle).
- **Blank patterns** (all transparent) are drawn dimmed so a sheet of mostly-empty cells still reads.
- **Bank comment chip / pinned strip** keep working unchanged: they are outside the view body.
- **Changing format or offset** keeps the selection on the pattern containing the previously
  selected first byte, and drops a range selection to that single pattern.
- **Go To** in the toolbar for this view accepts an address/offset and selects the pattern
  containing it.

## 6. Rendering approach

Draw the whole sheet on **one canvas** (or one per visible row inside the existing
`VirtualizedList`) with `ImageData`, rather than 64–128 `SpriteImage` components: a palette switch
or a live byte change then costs one `putImageData` per visible row. The inspector uses
`SpriteImage` for the single enlarged pattern. Palette lookup: `getAbrgForPaletteCode` on the
256-entry register-layout palette, built once per palette identity.

A pure module `nexBankSprites.ts` does the byte → pixel-index work (format, offset, palette offset,
transparency), so it is testable without a canvas.

## 7. Implementation steps

1. **Pure model** — `Next/nexBankSprites.ts`: `patternSize(format)`, `patternCount(format, offset)`,
   `patternOffset(index, format, offset)`, `patternAt(bankOffset, format, offset)`,
   `patternPixels(bytes, index, format, offset, paletteOffset, transparencyIndex)`, `isBlankPattern`,
   `patternSpan(first, last, format, offset)`. Tests in `test/renderer/nexBankSprites.test.ts`
   (8-bit, 4-bit nibble order, partial last pattern ignored, offset alignment, palette offset wrap,
   4-bit transparency by low nibble). **First verify the 4-bit layout (128 bytes, high nibble first)
   against the emulator's port `$5B` pattern upload code**, and fix the tests to what it does.
2. **Sidecar block** — `nexAnnotations.ts`: `NexBankSprites = { format?: "8bit" | "4bit"; offset?:
   number }` on `NexBankAnnotation`; `readBankSprites` with warnings only; round trip.
   `nexAnnotationEdits.ts`: `withBankSprites(annotations, bank, patch)` (normalizes the default away,
   `undefined` for no change). Tests in `nexAnnotations.test.ts` and `nexAnnotationEdits.test.ts`,
   including "an invalid block warns and the file still loads".
3. **View mode** — add `"sprites"` to `StaticDumpViewMode` and the dropdown when `nexAnnotationBank`
   is set; view-state keys `spritePalette: 0 | 1`, `spritePaletteOffset`, `spriteZoom`,
   `spriteShowTransparent`, `spriteSelection`. Annotation editor env: `sprites` never persists to
   `lastView`. Tests: switching to Sprites writes nothing; reopening restores it; an old sidecar
   still loads.
4. **Editor MVC** — intents `spriteSettingsChanged { format?, offset? }` (publishes `withBankSprites`)
   and `regionSpanMarked { start, end, type }` (reuses the region path and whole-bank confirmation);
   `vm.bankSprites` (resolved format and offset). Controller tests for both, including no publish
   for an unchanged setting and the confirmation on a whole-bank span.
5. **Palette** — let `useSpritePalette` take a controlled bank (`shownBank` from view state) as well as
   its own pin; the sprite editor's behaviour stays identical. Tests for both callers.
6. **Sheet** — `Next/NexBankSpritesView.tsx` (+ `.module.scss`): toolbar groups, virtualized rows drawn
   on one canvas each, range selection, keyboard, hover tooltip, "marked as bytes" corner mark. Row
   heights from `theming/tokens/rowSizes.ts` (M3), widths in `ch` (M2).
7. **Inspector** — enlarged pattern with pixel grid (`SpriteImage`), offset/address, colours used,
   hint, *Show in Memory*, *Show in Disassembly*, *Mark as Bytes* / *Mark as Disassembly*; folds away
   below a panel width.
8. **Navigation** — Show in Memory / Disassembly at the pattern's offset via the existing
   `recordJump` + `topAddress` path, so Go Back returns to the sprite.
9. **Docs & verification** — `.docs/nex-annotations.md` (Sprites view, the `sprites` block and its
   warning-only validation, Mark as Bytes), `npm run build:check`, `npm run lint:renderer`, jsdom and
   node tests, electron-vite build, and a manual check on a NEX that uploads sprites (compare with the
   running machine's sprites, both palettes, both formats).

## 8. Open questions

All decided (see the top of this plan). Smaller calls made without asking, easy to reverse:

- The 4-bit **palette offset** is view state, not sidecar: it is a per-sprite attribute on the
  machine, so one value for a whole bank is a viewing aid rather than a fact about the data.
- Transparency uses Reg `$4B` from the running machine, else `$E3`; it is not stored.

## 9. Later

- Layer 2 (256×192 / 320×256), tilemap and font views of a bank, sharing the toolbar and offset
  control.
- A "sprite data here" heuristic that proposes offsets.
- The machine's live pattern memory as a read-only sheet.
