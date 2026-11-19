# Screen File Viewers Modernization Plan

Status: **implemented** (2026-11-19, branch `plan/screen-file-viewers`): all six phases. The as-built
notes and the deviations from the sketch below are §9.

Mockup: `dev/plans/screen-file-viewers/mockup.html`. Open it in a browser, or serve `dev/plans/`
with the `plan-mockups` entry of `.claude/launch.json` and open `/screen-file-viewers/mockup.html`.
Rebuild it with `node dev/plans/screen-file-viewers/build-mockup.cjs`.

The mockup's bar (mockup only) has:
- **File**: the sixteen sample files of the manual tests (`screen-file-viewers/samples/`, §8). The
  mockup and the files come from one generator (`samples.js`), built with the real byte layouts: the
  +3DOS header with its checksum, the SCR interleave, Layer 2 row- and column-major, 4-bit nibbles,
  the LoRes halves, the Timex hi-colour and hi-res halves.
- **Width**: wide or narrow document.
- **Theme**: dark or light.
- **View**: *Proposed* or *Today*, for comparison.

The text in the samples is drawn with the 48K ROM's character set. **The mockup's code is a sketch,
never a source to copy**: the viewers are built on Klive's own decoders, `FileFacts`, `OverlayCanvas`
and `IndexedImageCanvas` (§4).

## 1. Goal

Klive opens four kinds of screen files today, and they look like four different products:

| File | Today |
|---|---|
| `.scr` (`ScrFileViewerPanel`) | An old `HeaderRow` with one button (memory dump) above a canvas at a fixed 2× zoom. Nothing says what the file is, and nothing explains a pixel. |
| `.sl2`, `.nxi` (`Layer2FileViewerPanel`) | A modern one-line toolbar (resolution, palette source, Banks, zoom), but no facts and no pixel readout. The 256 colours it draws with are not shown. |
| `.slr`, `.shc`, `.shr` | "Not implemented" stubs (`notImplemented.ts`). This plan replaces them (Q1). |

The goal is **one screen file viewer**: a single frame that every screen format plugs into, with a
toolbar, the picture, an inspector column of facts and a pixel probe. Each format brings only its
decoder and its own facts. A user who knows one viewer then knows them all, and the remaining stubs
become a decoder each (Phase 5).

| Today | After |
|---|---|
| Fixed 2× zoom (`.scr`) | **Fit** on first open, then the remembered zoom; 1×-4× |
| Nothing about the file | **Inspector**: file, header (PLUS3DOS type, load address, length), format, size, colours used |
| No pixel readout | **Probe**: hover reads the pixel; click pins it. SCR shows the pixel and attribute bytes with their screen address and file offset, and the decoded INK/PAPER/BRIGHT/FLASH. Layer 2 shows the palette index, the 9-bit colour, the bank and its offset. |
| FLASH cells drawn as stored, with no way to tell they blink (`.scr`) | **Blink FLASH** shows the picture as the machine does; **FLASH cells: highlight** shows which cells blink |
| No attribute grid (`.scr`) | **Grid**: the 8×8 attribute cells |
| Layer 2 palette not shown | **Palette section**: 256 swatches, unused ones hollow. A click highlights the pixels that use the colour and dims the rest. |
| One action (memory dump of the whole file) | **Show bytes** at the probed byte; **Save as PNG**; **Copy picture** |
| Errors are one line of text | An error card: the file's size, the sizes it may have, and **Show bytes** so the file can still be looked at |

## 2. Decisions

- **D1. One frame, many decoders.** `ScreenFileViewer` owns the toolbar, the stage, the inspector,
  the status probe, the layouts and the view state. A format is a record: its sizes, its header
  rule, `decode(bytes, view) → { pixels, palette, width, height, zoomY }`, `probe(x, y) → facts`,
  its overlays and its inspector sections. No format draws chrome of its own.
- **D2. Decoders are pure and live in `src/common/`.** The SCR decode moves out of
  `ScrFileViewerPanel` (`createScrPixelData`) into `src/common/zxspectrum/scrDecode.ts`. Layer 2
  keeps `src/common/zxnext/layer2/` (`layer2File.ts`, `layer2Decode.ts`). The tape, disk, file
  manager and snapshot previews that draw a SCR today import the common decoder, so a picture and
  its preview cannot drift apart.
- **D3. The picture is a device surface.** Machine colours are theme-invariant (see "Colour That
  Belongs To The Machine" in `dev/ai/ui-theming-intent-and-lessons.md`). The grid, the FLASH
  outlines, the bank outlines, the probe and the pinned pixel are chrome: shapes on the one
  `OverlayCanvas`, coloured from `--color-screenfile-*` aliases (L4) of the inspectors' existing
  roles.
  - Probe and pinned pixel: the primary accent.
  - Grid: `--border-strong`.
  - Bank outlines: as in the Layer 2 Inspector.
- **D4. Zoom: Fit on first open, then 1×-4×** (Q3). The remembered zoom wins when the document is
  opened again. Fit picks the largest whole zoom that fits the stage,
  so pixels stay square-edged. A 640×256 picture doubles its **height**
  (`zoomY = zoom * 2`), never halves its width (the Layer 2 Inspector's rule).
- **D5. The toolbar is one line at every width.** It is the Layer 2 viewer's strip as it is today.
  - On the left, format controls:
    - the resolution switch, only when the size cannot tell (80K: 320×256 or 640×256);
    - Grid (SCR), or Banks (Layer 2);
    - Blink FLASH (SCR and hi-colour, D9);
    - the ink of a hi-res picture (D13);
    - Highlight-off, when a palette colour is selected.
  - On the right: zoom.
  - Below about `70ch`, Grid/Banks, Blink FLASH and the actions fold into a `⋯` menu.
- **D6. The inspector is `34ch` of `FileFacts` sections.**
  1. **File**: path with its reveal button, size.
  2. **Header**: only when there is one. "PLUS3DOS, CODE, 6,912 bytes at `$4000`". A header whose
     load address is not the screen's is a `FactNote` in the warning tone, not an error.
  3. **Picture**: format, resolution, bytes, banks (Layer 2), palette source (file or default).
  4. **Colours**:
     - SCR and hi-colour: the 16 colours with their cell (strip) counts, plus counts of BRIGHT
       and FLASH cells. The FLASH count carries a **highlight** link (D8).
     - Layer 2: a 16×16 palette grid. Used entries are solid, unused ones hollow, and the
       selected one is ringed. Under it: the number of distinct indices. A 640×256 (4-bit) picture
       can use only one row, its palette offset (0 in a file), so only that row is shown ("A
       Palette Shows Only The Colours The Thing Being Drawn Can Use").
  5. **Pixel**: the pinned pixel's probe, in full. Empty until a click.

  The facts follow the data hierarchy: a file's facts are neutral. Bytes and addresses are values in
  `--color-state-value`, as in the other Next inspectors.
- **D7. The status strip is the probe.** Hover writes one line:
  - SCR: `x 132 y 47 · cell 16,5 · pixel $47B0 (+07B0) · attr $58B0 (+18B0) = $47 INK 7 PAPER 0
    BRIGHT`.
  - Layer 2: `x 132 y 47 · index $E3 · RGB 7,0,7 · bank +1 $2F84 (+6F84)`.

  Leaving the picture shows the pinned pixel again, if there is one. Offsets in parentheses are
  **file offsets after the header**: the number a hex editor needs.
- **D8. A colour selected in the palette dims the other pixels.** This uses
  `IndexedImageCanvas`'s `dim` mask (the priority-highlight rule), so the highlighted pixels keep
  their real colour. For SCR and hi-colour, selecting one of the 16 colours highlights the cells
  whose INK or PAPER is that colour, and the FLASH count's **highlight** link highlights the cells
  that blink. The toolbar shows what is highlighted, with a button that stops it.
- **D9. FLASH: one toggle, off by default.** An attribute's bit 7 (FLASH) makes the ULA swap INK
  and PAPER in that cell every 16 frames (0.32 s). A file only stores the bit, so a still picture
  cannot show it. **Blink FLASH** (off by default) draws the picture as the machine shows it; off,
  the viewer draws what the file stores. *Which* cells blink is answered by the FLASH count's
  highlight (D8), not by outlines: the first mockup's two buttons (outline the cells, animate them)
  were not understood in the review. Blinking stops while the document is hidden. Hi-colour has
  FLASH too, per 8×1 strip.
- **D10. The document lays itself out by its own width** (`container-type: inline-size`, queries
  in `ch`):
  - Wide (≥ `100ch`): the stage, with the inspector as a rail on the right.
  - Narrow: the inspector stacks under the stage, its sections side by side
    (`repeat(auto-fill, minmax(30ch, 1fr))`).

  Stage and inspector each scroll in their own `ScrollViewer`.
- **D11. The viewer never writes the file.** Editing belongs to the bitmap editors the research
  (`dev/research/next-graphics-assets/README.md`, §7) calls for. Their plan will add an "Open in
  editor" action here. The view state (zoom, grid, FLASH, resolution, selected colour, pinned
  pixel) is per document, as now.
- **D12. Actions:**
  - **Show bytes** opens the static memory dump, scrolled to the pinned pixel's byte, or to the
    start of the file when nothing is pinned.
  - **Save as PNG** saves at 1× or at the current zoom, reusing the graphics finder's PNG writer
    (`features/graphics/graphicsPng.ts`).
  - **Copy picture** copies the picture at 1×.

  They are icon buttons in the inspector's File section header, not toolbar buttons.
- **D13. A hi-res picture has no colour in its file.** On the machine, port `$FF` bits 3-5 choose
  one ink for the whole screen and the paper is its complement. The toolbar has an **Ink** choice
  (0-7, swatches), black on white by default (port `$FF` = 0), kept in the view state. The Picture
  section says where the colour comes from.
- **D14. Colours the files do not carry** (Q5). SCR and hi-colour draw with the 48K colours
  (`SPECTRUM_48_COLORS`), also in a Next project. LoRes draws with the Next's ULA palette as the core
  resets it: the 16 colours repeated in every block of 16. NextZXOS leaves it so after `LAYER 1,0`
  (checked by booting NextZXOS in the harness and reading the palette), so that is what a `.slr`
  loaded from NextBASIC looks like. LoRes artwork is usually drawn for RGB332 (the Layer 2 default),
  so the toolbar switches between **ULA palette** and **RGB332**.

## 3. Formats

| Format | Sizes (after an optional 128-byte PLUS3DOS header) | Decoder | Probe |
|---|---|---|---|
| `.scr` | 6,912 | `scrDecode.ts` (new, from `createScrPixelData`) | pixel byte, attribute byte, INK/PAPER/BRIGHT/FLASH |
| `.sl2` / `.nxi` 256×192 | 49,152, or 49,664 with a palette | `layer2Decode.ts` | index, 9-bit colour, bank and offset |
| `.nxi` 320×256 / 640×256 | 81,920, or 82,432 with a palette; the reader picks the mode | `layer2Decode.ts` | same; 640 also names the nibble (high/low) |
| `.slr` *(Phase 5)* | 12,288 (128×96, 8bpp) | new | index, address and half, offset |
| `.shc` *(Phase 5)* | 12,288 (6,144 pixels + 6,144 8×1 attributes) | new | pixel and attribute byte, INK/PAPER/BRIGHT/FLASH |
| `.shr` *(Phase 5)* | 12,288 (two 6,144 halves, 512×192 mono) | new | byte, which half (left/right byte of the 16-pixel word) |

The three layouts are taken from Klive's Next core, which follows the VHDL
(`src/emu/machines/zxNext/wasm/zxnext/`):
- **LoRes**: one byte per pixel, row-major. Rows 0-47 at `$4000`, rows 48-95 at `$6000`
  (`zxnextLoResStandardAddress`), so the file is the two 6K halves in order.
- **Hi-colour**: the SCR-layout pixel bytes, then an attribute per 8×1 strip at `$6000` in the same
  layout (`zxula.vhd` ~236-250).
- **Hi-res**: each 16-pixel word is a byte from `$4000` (left) and the byte at the same offset from
  `$6000` (right) (`zxnextUlaRenderHiResScreen`).

The files the Next itself writes have not been seen yet. The manual tests (§8) include saving one
of each from NextBASIC in Klive's emulated Next and opening it.

## 4. What exists (the base this builds on)

- `src/common/zxnext/layer2/layer2File.ts`: the parser. It skips a PLUS3DOS header since #1672.
- `layer2Decode.ts`: `layer2Image`, `layer2Size`, `layer2ByteOffset`, the pixel address.
- `layer2Geometry.ts`: `bankRegions`.
- `Layer2FileViewerPanel.tsx`: today's Layer 2 viewer. Its toolbar is the model for D5.
- `ScrFileViewerPanel.tsx`: `loadScrFileContents` (skips a PLUS3DOS header since #1672) and
  `createScrPixelData`, which six previews import.
- `controls/Next/IndexedImageCanvas.tsx` (with the `dim` mask) and `Layer2OverlayCanvas` /
  `OverlayCanvas`.
- `controls/data/FileFacts.tsx`: `FactSection`, `Facts`, `Fact`, `FactNote`, `FactsWithPicture`.
- `NextPaletteViewer`: the 16×16 swatch grid, with `firstRow`/`rowCount`.
- `features/memory/StaticMemoryDump`: `openStaticMemoryDump`. Phase 4 adds a start offset.
- `features/graphics/graphicsPng.ts`: PNG encoding.
- `SpriteZoomButtons`: 1-4. Phase 2 adds Fit.

## 5. Phases

1. **Decoders.** Add `src/common/zxspectrum/scrDecode.ts`:
   - `scrImage(bytes, { flashPhase })` returns indexed pixels (0-15) for `IndexedImageCanvas`.
   - `scrProbe(bytes, x, y)` and `scrColourCounts(bytes)`.

   Point the six SCR previews at it and delete `createScrPixelData`. Add a `layer2Probe` beside
   `layer2Image`. Write unit tests, including the SCR interleave at the three thirds' boundaries
   and a probe on a 640×256 nibble.
2. **The frame, with SCR.** Build `ScreenFileViewer` (D1, D3-D7, D10) and the `.scr` format: Grid,
   FLASH Static/Animate (D9), Colours with counts and the highlight (D8), Header and Pixel
   sections. Retire `ScrFileViewerPanel`'s body. Write component tests in jsdom (the probe, the
   pinned pixel, view-state round trip) and a doc-shots recipe check.
3. **Layer 2 on the frame.** Move `.sl2`/`.nxi` onto it:
   - resolution switch (80K only);
   - Banks overlay;
   - palette section with highlight;
   - probe with bank/offset;
   - the "palette from file / default" fact.

   Retire `Layer2FileViewerPanel`'s body.
4. **Actions.** Show bytes at the probe (D12): `openStaticMemoryDump` gains a start offset. Save as
   PNG, Copy picture. The error card (§1).
5. **The stubs** (Q1: yes): `.slr`, `.shc`, `.shr` decoders and their facts, the hi-res Ink choice
   (D13), LoRes on the core's default ULA palette (D14). Delete `notImplemented.ts`'s users among
   them. `.vid` stays a stub; it is not a screen file.
6. **Finish:**
   - i18n keys with translator context;
   - the Guides page for viewing files;
   - doc-shots screenshots;
   - the durable rules in `dev/ai/ui-theming-intent-and-lessons.md`: "A screen file viewer is one
     frame" and the `--color-screenfile-*` roles;
   - a `feature` changeset describing the result as a whole;
   - `npm run build:check`, `lint:renderer`, the focused tests.

Phases 2 and 3 change visible UI. They are checked in the running app with the CDP recipe, in both
themes and the `qps` locale, before the plan closes.

## 6. The review's answers

- **Q1. Fill the `.slr`/`.shc`/`.shr` stubs here?** Yes: Phase 5.
- **Q2. Sample files?** Generated, for the manual tests: `screen-file-viewers/samples/` (§8).
- **Q3. Fit as the default zoom?** Yes, on first open; the remembered zoom after that (D4).
- **Q4. "Show on machine"?** No. Not in this plan.
- **Q5. Next palette for `.scr` in a Next project?** No: keep the 48K colours (D14).
- **FLASH**: the first mockup's FLASH and Animate buttons were not clear. Replaced by one
  **Blink FLASH** toggle and a highlight link on the FLASH count (D9).

## 7. Not in scope

- Editing pixels or palettes (the bitmap editors' plan).
- Writing a picture into the running machine ("Show on machine", Q4).
- `.vid`, `.bmp` and `.png` (the image viewer).
- The live inspectors (Layer 2, Tilemap, Sprite). They already have their own probes; this plan
  reuses their overlay and palette pieces, not their documents.

## 8. Manual tests

The sample files are in `dev/plans/screen-file-viewers/samples/`, written by
`node dev/plans/screen-file-viewers/generate-samples.cjs` from the same generator as the mockup
(`samples.js`). Their `README.md` says what each file is and what a viewer must show. Every Layer 2
and SCR sample opens in Klive's parsers today (checked when they were generated); the `.slr`, `.shc`
and `.shr` ones need Phase 5.

They are Klive's own reading of the layouts. Before Phase 5 closes, also open files the Next writes
itself: in Klive's emulated Next, draw on each layer in NextBASIC, save it, and open the saved file
from the SD card (the README has the steps).

## 9. As built

- **Phase 1.** The decoders are `src/common/screenFiles/` (`zxScreen.ts`, `timexScreen.ts`,
  `loresScreen.ts`, `screenFile.ts`), pure, with `test/screen-files/decoders.test.ts`. The PLUS3DOS
  header split is one function, `splitPlus3Header` in `diskfs/plus3dos.ts`, used by these and by
  `layer2File.ts`, which now keeps the header for the viewer's Header section. The six previews that
  drew a `.scr` (tape, disk, hard disk, file manager, snapshot) import `createScrPixelData` from
  `zxScreen.ts`. No separate `layer2Probe` was needed: the view composes `layer2ByteOffset` and
  `layer2Index`.
- **Phases 2-5** landed together, the frame being small once the formats shared it:
  `src/renderer/features/screen-files/` holds the frame (`ScreenFileViewer.tsx`), its overlay canvas,
  the error card, the attribute formats (`AttrScreenView.tsx`: `.scr`, `.shc`) and the palette formats
  (`IndexedScreenViews.tsx`: Layer 2, LoRes, hi-res). The registry opens all six extensions through
  one file, `DocumentPanels/Next/ScreenFileViewerPanels.tsx`; the old `ScrFileViewerPanel`,
  `Layer2FileViewerPanel` and the three stubs are deleted. The default ULA palette is a table in
  `loresScreen.ts`, citing the core's.
- **Show bytes** needed no change to the dump: `openStaticMemoryDump` already takes a `topAddress`.
  **Copy picture** writes a PNG through `navigator.clipboard`; a refusal says so in the probe strip.
- **The FLASH redesign (D9)** is as the review asked: one Blink FLASH toggle and a highlight link on
  the FLASH count; no outlines.
- **Checked in the running app** with a doc-shots recipe, `dev/scripts/doc-shots/recipes/screen-file-viewers.cjs`,
  which opens every sample (by its upper-case name) and a narrow layout, staged under
  `.local/doc-shots/dev/screen-files/`. The hi-res sample's long text line was cut off at 512 pixels
  and was shortened.
- **Files written by NextZXOS itself (§8) were checked**, in the harness rather than by hand: SPI-014
  (`test/zxnext-hw/sd/nextzxos-save-layer.test.ts`, slow tier, 45 s) boots NextZXOS 2.08, draws a
  circle on each layer in NextBASIC, saves it with `SAVE ... LAYER`, reads the files off the card and
  decodes them with the viewers' readers. Every file has a PLUS3DOS header: the ULA screen is CODE
  (6,912 bytes at `$4000`); LoRes, Timex hi-res and hi-colour are **type 4** and Layer 2 **type 5**
  (12,288 and 49,152 bytes), with load address 0. The decoded pictures matched the machine's screen
  shot for shot. The finding changed the viewer: `Plus3Header` keeps the type byte, the Header section
  names types 4 and 5 `LAYER 1` and `LAYER 2`, and only a CODE header shows a load address and the
  "not at the screen" warning (it fired wrongly on every LAYER 1 file).
- **Copy picture was checked in the running app**: the recipe clicks it and reads the system clipboard
  from Electron's main process, which holds a 256×192 PNG (also offered as macOS's PNG and TIFF
  pasteboard types). Electron 45's main-process `clipboard` has no `readImage`; `read()` returns
  ClipboardItems.
