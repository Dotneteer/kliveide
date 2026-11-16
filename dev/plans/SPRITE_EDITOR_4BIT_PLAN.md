# 4-bit sprites in the `.spr` editor

**Status:** done on `feature/sprite-editor-4bit` (2026-11-15).

## Goal

The `.spr` editor (`src/renderer/features/sprite-editor/`) reads every file as 8-bit patterns: 256
bytes, one palette index per pixel. The ZX Spectrum Next also has **4-bit patterns** (sprite
attribute 4, bit 5): 128 bytes, two pixels per byte, high nibble on the left (even x), drawn with
palette entry `paletteOffset << 4 | nibble`, transparent when the nibble equals the low nibble of
Reg `$4B` (`src/common/zxnext/sprites/spritePatterns.ts` records the hardware facts). The emulator,
the Sprite Inspector and the NEX Sprites view already handle them; the editor cannot edit them.

## Decisions

- **D1. The editor's model does not change.** A sprite in memory stays a 256-entry `Uint8Array`, one
  value per pixel. In 4-bit mode the values are 0..15. Packing and unpacking happen only at the file
  boundary (`parseSprFile` / `serializeSprFile` take a format). The raster tools, the selection, the
  undo history and the clipboard keep working on pixels and need no 4-bit branch.
- **D2. The format is a per-document view setting, 8-bit by default.** A `.spr` is raw pattern data
  with no header, so nothing in the file says which format it holds; a guess would be wrong for some
  files and silently so. The user picks 8-bit or 4-bit in the sheet toolbar; `SprFileViewState`
  remembers it (`spriteFormat`).
- **D3. Switching the format reinterprets the bytes; it never changes them.** The sheet is
  serialized in the old format and parsed in the new one, so the switch is lossless in both
  directions (one 8-bit sprite is two 4-bit patterns) and writes nothing. The undo history is reset,
  because its entries are sprites of the other shape. The bytes after the last whole pattern are
  carried over (`trailing`). One exception: a file that was **empty** when opened and has not been
  edited becomes one blank sprite of the new format, rather than an 8-bit blank sprite read as two
  striped 4-bit ones.
- **D4. The palette offset is a view setting too** (`paletteOffset`, 0..15). On the machine it lives
  in each sprite's attribute 2, not in the pattern, so a `.spr` cannot carry it. It chooses which
  16 colours the editor draws with. The grid, the thumbnails, the preview, the colour samples and the
  status bar are handed a **16-entry view palette** (`palette[offset << 4 | n]`) and the transparency
  nibble (`$4B & $0F`), so they keep indexing `palette[value]` and comparing against one index.
- **D5. Values entering a 4-bit sheet are masked to a nibble.** Pen and fill colours are kept as
  palette choices and used as `value & $0F` in 4-bit mode; a sprite or region pasted from an 8-bit
  sheet is masked on paste. Nothing else can put a value above 15 into a 4-bit sprite.
- **D6. The palette viewer shows only the active row in 4-bit mode.** `NextPaletteViewer` gains
  `firstRow`/`rowCount`; the editor shows row `paletteOffset`, so the swatches are the 16 colours the
  sprite can use, labelled with their real palette index. An offset selector (0..F) sits in the
  palette section's header beside the bank switch.
- **D7. The read-only pattern snapshot is unchanged.** The Sprite Inspector already expands a 4-bit
  pattern into 8-bit palette indices with the sprite's offset applied; that stays an 8-bit view.

## Steps

1. `sprite-file.ts`: `SprFormat`, `parseSprFile(bytes, fill, format)`, `serializeSprFile(sprites,
   trailing, format)`, `reinterpretSprSheet`, `empty` flag on the parse result. Unit tests.
2. `sprite-common.ts`: `spriteFormat` and `paletteOffset` in the view state; `empty` in the
   contents.
3. `SprFileEditorPanel.tsx`: parse with the format from the view state.
4. `SpriteEditor.tsx`: format and offset state, the view palette and transparency, the switch (D3),
   nibble masking (D5), save in the current format.
5. `NextPaletteViewer`: `firstRow`/`rowCount` (D6), keyboard navigation inside the visible rows.
6. `SpriteSheetToolbar`: the 8-bit/4-bit switch. `SpritePaletteHeader`: the offset selector.
   `SpriteStatusBar` and the pen readout: one hex digit for a 4-bit value.
7. i18n keys, component tests in `test/sprite-editor/`, the theming-lessons note, a changeset.

## Not in scope

- Detecting the format from the file's contents (D2).
- Writing the palette offset anywhere (D4).
- A 4-bit export of the live pattern RAM (`export-patterns` writes the 16K as it is; it can be
  viewed as 4-bit with the switch).

## As built

- **D3 had a hole, found by a test.** The panel parses a file as 8-bit, which pads a file shorter
  than one sprite (one 128-byte 4-bit pattern) to 256 bytes; reinterpreting that padded sprite gave
  two patterns and lengthened the file on the next save. The panel now hands the editor the file's
  own bytes (`SprFileContents.source`), and until the first edit the editor reads *those* in the
  wanted format, on open and on a switch. After an edit the sheet is reinterpreted as planned. This
  also covers the empty file, so the editor needs no `empty` flag of its own (`reinterpretSprSheet`
  keeps one for other callers).
- `SprFileContents.format` records which shape `sprites` are in, so an editor mounted again over the
  same `fileInfo` reads them correctly.
- The status line has a 4-bit message of its own (`spriteLabel4`, "Pattern n of m · 16×16 · 4bpp")
  rather than a changed 8-bit one, so the existing translations stay current.
- Checked in the running app (doc-shots harness, a Next project, a two-pattern 4-bit file): 1 sprite
  in 8-bit, 2 patterns in 4-bit, 16 swatches, offset 14 drawn from `$E0`..`$EF`, file unchanged.
- In 4-bit mode the sheet toolbar's tooltips and position ("Pattern #n of m"), the sheet's count and
  the cells' accessible names say "pattern". Each has a `…4` message of its own next to the 8-bit one;
  the toolbar picks it from an explicit table (`PATTERN_KEYS`) so the i18n key check sees every key.
