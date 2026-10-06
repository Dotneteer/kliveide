# Tilemap Inspector Plan: the Live Tilemap and Its Tile Definitions

Status: **draft** (2026-10-05). Decisions D1–D10 are proposed; the §8 questions are open. No phase
started.

Scope:
- [CLOSING_THE_GAPS_PLAN.md](CLOSING_THE_GAPS_PLAN.md) **G3.4**: the live tilemap with tile indices
  and attributes, plus the tile definitions.
- It is delivered as **one document, the Tilemap Inspector**, with a **Map** view, a **Tiles** view
  and an inspector pane. The two questions it answers are linked: "what is in cell (12, 5)?" and
  "where is tile 40 used?".

Not in scope: Layer 2 (G3.5, [LAYER2_INSPECTOR_PLAN.md](LAYER2_INSPECTOR_PLAN.md)), the layer
composition view (G3.6, [LAYER_COMPOSITION_PLAN.md](LAYER_COMPOSITION_PLAN.md)), the beam overlay
(G3.7, [BEAM_POSITION_OVERLAY_PLAN.md](BEAM_POSITION_OVERLAY_PLAN.md)), and editing. §1.2 lists the
hooks this plan leaves.

Related plans:
- [SPRITE_INSPECTOR_PLAN.md](SPRITE_INSPECTOR_PLAN.md) and
  [COPPER_DEBUGGING_PLAN.md](COPPER_DEBUGGING_PLAN.md) are the sibling G3 inspectors. Neither is
  implemented yet. This plan copies their shape: a pure decoder in `src/common/zxnext/`, a snapshot
  read through `IZxNextIdeMachine`, and a singleton special document. **Whichever G3 inspector lands
  first creates the shared pieces** listed in §4.6; the others reuse them.
- [LAYER2_INSPECTOR_PLAN.md](LAYER2_INSPECTOR_PLAN.md) shares the clip-window module, the device
  palette hook and the pixel-sheet canvas with this plan (§4.6).

Hardware reference: `_input/next-fpga/src/video/tilemap.vhd`. The C engine
`src/emu/machines/zxNext/wasm/zxnext/zxnext-tilemap.c` (registers) and the tilemap pass in
`zxnext-ula.c` (`zxnextUlaRenderTilemapScreen`) already mirror it, and an independent reference
model exists in `test/zxnext-hw/tilemap/_tilemap-helpers.ts`. The core is not changed except for
the read-only exports in §4.2.

---

## 1. What is being added, and why

A tilemap program writes a map of 1- or 2-byte entries and a set of 8×8 tile definitions into
bank 5 or bank 7, and configures them with six NextRegs. When the picture is wrong, the usual causes
are:
- the map base (`$6E`) or the definitions base (`$6F`) pointing at the wrong offset, often
  overlapping each other or the ULA screen at `$4000–$5AFF`;
- the wrong entry format: attribute-less mode (`$6B` bit 5) with a 2-byte map, or the reverse;
- 512-tile mode (`$6B` bit 1), which turns attribute bit 0 into tile bit 8, so "ULA over tilemap"
  stops working;
- the palette offset in the attribute's high nibble, or the second tilemap palette (`$6B` bit 4);
- the transparency index (`$4C`), or, in text mode, the global transparency colour (`$14`);
- scroll (`$2F`/`$30`/`$31`) and the clip window (`$1B`), which use different units in 40- and
  80-column mode;
- rotate and mirror bits applied in the wrong order.

None of this is visible from the Z80 side, and Klive has **no tilemap view at all**: there is no
live view, no file view, and no `.til`/`.nxt` handling. The Next Registers panel shows the six
registers as raw values; the Next Palettes panel shows palettes 3 and 7. The competitive analysis
rates "live Next sprite / Copper / layer inspectors" ✗ for Klive and ✅ for ZEsarUX.

### 1.1 Decisions (proposed)

| # | Decision |
| --- | --- |
| D1 | **One document, two linked views.** A singleton special document `$tilemap`, "Tilemap Inspector", with a **Map** view, a **Tiles** view and an **inspector** pane. No side-bar panel. |
| D2 | **One snapshot, one read.** `NextTilemapState` carries the registers and **copies of bank 5 (16K) and bank 7 (16K)**, read in one `getNextTilemapState()` call. Both views and the inspector render from it. It never goes through `getMemoryContents`, which returns 8K pages plus the CPU registers per call. |
| D3 | **Decoding is TypeScript, and is cross-checked twice.** Unlike sprite anchor resolution (Sprite plan D4), a tilemap cell is a pure function of two bytes and six registers, so a pure module, `src/common/zxnext/tilemap/tilemapDecode.ts`, decodes it. A harness test compares its image with both the core's tilemap layer and the VHDL-derived model in `_tilemap-helpers.ts`. |
| D4 | **The Map view shows the whole map, unscrolled, with the visible window drawn on it.** The display is a scrolled, clipped window into a 320×256 (or 640×256) map, so the map is drawn whole and the scroll and clip windows are outlines on top. A second mode, *As displayed*, applies scroll and clip so it matches the screen. |
| D5 | **Raw bytes are always reachable.** Every cell shows its entry address and raw bytes in the inspector, because most tilemap bugs are an encoding or base-address mistake. |
| D6 | **The live palette comes from a generalised device-palette hook** (§4.6), following `$6B` bit 4, with the same pinning as the sprite palette. With no Next running, the document shows an empty state; it never falls back to a default palette. |
| D7 | **Read-only**, like the other G3 inspectors. |
| D8 | **Reading never disturbs the machine.** Every value comes from side-effect-free getters or a copy of physical memory. |
| D9 | **Refresh follows the state-panel cadence** (`useEmuStateListener`), with no read while the document is hidden and no re-decode while the bytes and registers are unchanged (a cheap FNV hash over the 32K plus the registers). |
| D10 | **Overlap diagnostics are first-class.** The map, the definitions (256 or 512 tiles, 1-bit or 4-bit), the ULA bitmap and attributes, and the bank-7 8K wrap are checked against one another, and any overlap is a warning chip in the globals strip. This is the commonest tilemap bug, and it is invisible on screen until the program writes. |

### 1.2 Out of scope, and the hooks left for later

- **Per-line register changes (Copper splits).** The inspector shows the registers *at the stop*. A
  Copper program that changes the scroll or the palette offset per line produces a picture no single
  register set reproduces. The *As displayed* mode says so when the Copper is running. The exact
  per-row picture is G3.6's capture (see [LAYER_COMPOSITION_PLAN.md](LAYER_COMPOSITION_PLAN.md)
  §4.3); that plan's pixel probe links back to this document's cell.
- **Editing** tiles or the map, and **export** of the map or definitions as files. Revisit after use
  (Q5).
- **Tile-write breakpoints.** Memory breakpoints on the map range already work; the inspector's
  context menu offers "Break on write to this entry", which creates an ordinary memory breakpoint on
  the entry's Z80 address when it is mapped (no new breakpoint kind).

---

## 2. Current code paths this touches

| Concern | Where |
| --- | --- |
| Register state | `zxnext-tilemap.c:3-14`: enable, clip window and index (`$1B`), scroll X (10 bits, `$2F`/`$30`) and Y (`$31`), transparency (`$4C`), control (`$6B & $6F`), default attribute (`$6C`), map base (`$6E`: bank 7 flag + MSB), definitions base (`$6F`). Reset values at `:16-32` (clip 0,159,0,255; `$4C=$0F`; map MSB `$2C`; definitions MSB `$0C`). Writes at `:34-71`. |
| Control bits | `zxnext-tilemap.c:92-96`: 80×32 (`$40`), attribute-less (`$20`), text mode (`$08`), 512 tiles (`$02`), force on top (`$01`) |
| Second tilemap palette | Not in the tilemap module: `zxnext-palette.c:18`, setter `:187`, getter `:188`; set from `zxnext-nextreg.c:606` |
| Rendering | `zxnext-ula.c:918-926` `zxnextUlaReadTilemapVram` (bank 7 wraps at 8K, bank 5 at 16K); `:928-935` transform; `:937-939` text-mode transparency against `$14`; `:955-1023` `zxnextUlaRenderTilemapScreen` |
| Existing exports | `zxnext.c:639-653`: `zxnextGetTilemapNextReg(reg)`, `...Clip(i)`, `...Enabled`, `...PaletteOffset`, `...ScrollX/Y`, `...BaseAddressUseBank7/Msb`, `...DefinitionAddressUseBank7/Msb`. No getters for the control flags, the default attribute or the transparency index. |
| Export plumbing | `zxnext.c`; `scripts/build-zxnext-wasm.cjs` (`productionExports` tilemap block `:249-258`); `ZxNextWasmV2Loader.ts` (types `:192-201`, `requiredV2Exports` `:569-578`) |
| Physical memory | `runtime.memory` covers all of physical RAM (`ZxNextWasmV2Loader.ts:770ff`); bank 5 at `0x054000`, bank 7 at `0x05C000` (`zxnext-memory.c:7-12`, `nextMemoryLayout.ts`). `getCopperState` (`ZxNextWasmV2Machine.ts:1519-1535`) is the copy-a-view template. |
| Machine contract | `IZxNextIdeMachine.ts:20-46`, type guard `:52-63` |
| Emu API | `EmuApi.ts` (`getCopperState` `:540`, `PaletteDeviceInfo` `:1113-1136`); `MainToEmuProcessor.ts:1079-1085` via `requireZxNextIdeMachine` |
| Palette | `PalettePanel.tsx:46-77` (the `DEVICES` table: tilemap live bank from `$6B` bit 4, transparency `$4C`); `useSpritePalette.ts` (the hook to generalise); `emu/machines/zxNext/palette.ts` (`getAbrgForPaletteCode`) |
| Drawing to reuse | `controls/Next/ScreenCanvas.tsx` (shadow canvas + scaled `drawImage`); `NexBankSpritesView.tsx` `SpriteCanvas` `:657-698`, `toAbgrTable` `:870`, the checker style |
| Special documents | `specialDocuments.ts:11-44`; `common-ids.ts:4-9`; `MEMORY_EDITOR` registry `registry.ts:414-418`; `ShowMemoryCommand` `ToolCommands.ts:49-80`, registered `IdeCommands.ts:157`; `IdeApi.ts:68`; `MainToIdeProcessor.ts:126`; `restoreLastOpenDocuments.ts` |
| Menu | No "Machine → ZX Spectrum Next" group exists. Next items are spliced flat from `machine-menu-registry.ts:151-162` (`zx-next-menus.ts`). |
| Tests | `test/zxnext-hw/tilemap/` (`tilemap.test.ts` TM-001…025, `tilemap-bank7.test.ts`, the model `_tilemap-helpers.ts`: `tilemapIndex :56`, `tilemapBelow :83`, `tilemapScreen :108`); `test/visual/copper/P02-tilemap-merge`; harness `ideState()` at `script/session.ts:908-918` |

---

## 3. The traps

1. **T1: Two address spaces.** `$6E`/`$6F` hold an MSB *within the bank*: bank 5 address =
   `$4000 + (msb << 8)` as the Z80 sees it with default paging, physical `0x054000 + (msb << 8)`.
   With bank 7 the MSB is masked to 5 bits and reads **wrap at 8K** (`zxnextUlaReadTilemapVram`).
   The inspector shows every address three ways: bank:offset, physical, and the Z80 address *if the
   page is currently mapped* (from the MMU state), never assuming the default mapping.
2. **T2: The entry size depends on attribute-less mode.** 2 bytes per entry normally, 1 byte with
   `$6B` bit 5, when every attribute is `$6C`. The map's byte length is 1280/2560 (40×32) or
   2560/5120 (80×32). A test covers all four.
3. **T3: 512-tile mode steals attribute bit 0.** It becomes tile bit 8, and the "ULA over tilemap"
   bit no longer exists; the cell is *below* the ULA when the mode is on, unless `$6B` bit 0 forces
   the tilemap on top (`zxnext-ula.c:997-998`). The inspector shows "tile 300 (bit 8 from attr)" and
   never decodes bit 0 as "ULA on top" in that mode.
4. **T4: Text mode is a different format.** 1 bit per pixel, **8 bytes per tile**, and the colour is
   `attr & $FE | bit` (7-bit palette offset); transparency compares the **RGB** with `$14`, not an
   index with `$4C`. The definitions sheet switches to 8-byte tiles, and the definitions range for
   the overlap check shrinks accordingly.
5. **T5: Rotate before mirror.** As with sprites, rotation is applied first, then the mirrors in
   screen space (`zxnextUlaTilemapTransform`, `zxnext-ula.c:928-935`). `tilemapDecode` copies the
   mapping, and a test compares all 8 transforms of a known tile with the core.
6. **T6: 80 columns halve the pixel.** In 80×32 mode the layer is 640 wide; the clip window's X is in
   320-wide units doubled (`x1<<1`, `x2<<1|1`) and compared with `x >> 1`; scroll X wraps at 640.
   The geometry helpers take the column mode explicitly, and their tests copy the core's branches.
7. **T7: Bank-5 sharing is legal and common.** The ULA screen, the map and the definitions all
   default to bank 5. Overlap is a *warning*, not an error: a program can deliberately put the map
   in the ULA attribute area with the ULA disabled. The chip says what overlaps what, and it is
   suppressed for the ULA ranges when `$68` bit 7 (ULA off) is set.
8. **T8: "Transparent" has three meanings.** The `$4C` index (4-bit), the `$14` colour (text mode),
   and the cell being outside the clip window. The checker shows the first two; the clip window is
   an outline. The inspector's per-cell text says which applies.
9. **T9: The refresh must stay cheap.** The snapshot is 32K plus registers. Redrawing a 40×32 or
   80×32 map and 512 tile canvases on every refresh is not cheap: decode into **one** `ImageData` for
   the map and **one** for the tile sheet (not a canvas per cell), and only when the hash changes.
10. **T10: Registers can change after the picture.** At a breakpoint the registers are the current
    ones; the visible rows were drawn with whatever they were then. See §1.2 for the honest wording.

---

## 4. Design

### 4.1 Pure modules (no React, `node` project tests)

**`src/common/zxnext/tilemap/tilemapDecode.ts`** (D3)

```ts
export type TilemapRegs = {
  enabled: boolean;
  control: number;            // $6B, including bit 4 (second palette) re-ORed by the core export
  defaultAttr: number;        // $6C
  mapBank7: boolean; mapMsb: number;      // $6E
  defBank7: boolean; defMsb: number;      // $6F
  scrollX: number; scrollY: number;       // $2F/$30, $31
  transparencyIndex: number;  // $4C
  globalTransparency: number; // $14 (text mode)
  clip: [number, number, number, number]; clipIndex: number;  // $1B, $1C
  ulaDisabled: boolean;       // $68 bit 7, for T7
};

export type TilemapMode = {
  columns: 40 | 80; attributeLess: boolean; textMode: boolean; tiles512: boolean;
  forceOnTop: boolean; secondPalette: boolean;
  entryBytes: 1 | 2; tileBytes: 8 | 32; mapLength: number; defLength: number;
};

export type DecodedCell = {
  col: number; row: number;
  entryOffset: number;        // within the bank (T1)
  raw: [number, number?];
  tile: number;               // 0-511, with bit 8 from the attribute in 512 mode (T3)
  paletteOffset: number;      // 4-bit, or 7-bit in text mode (T4)
  xmirror: boolean; ymirror: boolean; rotate: boolean;
  ulaOnTop?: boolean;         // absent in 512 mode (T3)
};

export function tilemapMode(regs: TilemapRegs): TilemapMode;
export function decodeCell(mode: TilemapMode, regs: TilemapRegs, bank5: Uint8Array, bank7: Uint8Array, col: number, row: number): DecodedCell;
export function tilePixels(mode: TilemapMode, regs: TilemapRegs, bank5: Uint8Array, bank7: Uint8Array, tile: number): Uint8Array; // 64 colour indices or "transparent" (T4, T8)
export function transformTile(pixels: Uint8Array, rotate: boolean, xm: boolean, ym: boolean): Uint8Array; // T5
```

**`src/common/zxnext/tilemap/tilemapGeometry.ts`**
- `visibleWindow(regs, mode)`: the scroll window on the unscrolled map, as up to four rectangles
  (it wraps both ways) (T6).
- `effectiveClip(regs, mode)`: the `$1B` window in layer pixels (T6); built on the shared
  `clipWindows.ts` (§4.6).
- `cellAtLayerPixel` / `layerPixelOfCell` for hover and cross-linking with G3.6's probe.

**`src/common/zxnext/tilemap/tilemapDiagnostics.ts`** (D10)
- the overlap check over map, definitions, ULA bitmap (`$4000–$57FF`), ULA attributes
  (`$5800–$5AFF`), with the 8K wrap of bank 7 (T1, T7);
- `tilemap disabled ($6B bit 7)`, `ULA disabled, tilemap below` and similar one-line states;
- a definitions range that runs past the bank end (512 tiles × 32 bytes = 16K from a non-zero base).

**`src/common/zxnext/tilemap/tilemapUsage.ts`**: tile → cells, and cell → changed-since-last-stop.

### 4.2 Core exports (D8)

In `zxnext.c`, `build-zxnext-wasm.cjs` and the loader:

| Export | Returns |
| --- | --- |
| `zxnextGetTilemapControl()` | `$6B` with bit 7 and bit 4 re-ORed, side-effect free (today only via `zxnextGetTilemapNextReg($6B)`; the dedicated getter documents the intent) |
| `zxnextGetTilemapDefaultAttr()` | `$6C` |
| `zxnextGetTilemapTransparencyIndex()` | `$4C` low nibble |
| `zxnextGetTilemapClipIndex()` | the `$1B` write index |

Bank bytes are **not** exported per byte: the machine method copies them from `runtime.memory`.
`$14` and `$68` come from `zxnextGetNextRegisterDirect`, which is already side-effect free.

### 4.3 Machine and Emu API (D2)

```ts
// src/common/messaging/EmuApi.ts
export type NextTilemapState = {
  regs: TilemapRegs;
  bank5: Uint8Array;   // 16K copy of physical 0x054000
  bank7: Uint8Array;   // 16K copy of physical 0x05C000 (the tilemap only uses the first 8K; T1)
  mmu: number[];       // the 8 MMU slots, to show Z80 addresses (T1)
  copperRunning: boolean; // for the T10 wording
};
```

- `IZxNextIdeMachine.getNextTilemapState()` in `ZxNextWasmV2Machine`, with two `slice()`s of
  `runtime.memory`; add it to `isZxNextIdeMachine`.
- `EmuApi.getNextTilemapState()` → `MainToEmuProcessor` via `requireZxNextIdeMachine`.
- Renderer hook `useNextTilemapState({ enabled })`: `useEmuStateListener`, the hidden-document gate
  and the hash (D9); returns the snapshot plus `version`, which bumps only when the hash changes.

### 4.4 The Tilemap Inspector document (D1)

- **Opening:** `TILEMAP_PANEL_ID = "$tilemap"` / `TILEMAP_EDITOR` in `specialDocuments.ts`,
  workspace-restorable, opened by:
  - `show-tilemap` (alias `shtm`); `show-tilemap <col> <row>` selects a cell;
  - `show-tiles` (alias `shtl`); `show-tiles <n>` opens the Tiles view with tile *n* selected;
  - the **Machine → ZX Spectrum Next** menu (§4.6).
- **Non-Next machine, or no machine:** an `EmptyState`; the document stays open across a machine
  switch.
- **Layout:**

  ```
  ┌ toolbar: [Map|Tiles|Both]  Map: [Whole map|As displayed]  Grid ▦  Indices #  Palette: live(3)▾  Zoom 1-4  ┐
  ├ globals strip: Tilemap ON · 40×32 · 2-byte entries · 4-bit · 256 tiles · map bank 5 $6C00 · tiles bank 5 $4C00 · │
  │   scroll (0,0) · clip (0,159,0,255) · $4C=$0F · below ULA · ⚠ map overlaps ULA attributes                   │
  ├──────────── Map view ─────────────────────────┬──────────── Tiles view ──────────────┤
  ├───────────────────────────────────────────────┴──────────────────────────────────────┤
  │ inspector: the selected cell or tile                                                  │
  └───────────────────────────────────────────────────────────────────────────────────────┘
  ```

  *Both* is the default, side by side, stacking below about 90ch; panes use the existing splitter
  and persist their sizes in the document's view state.

### 4.5 The views

#### 4.5.1 Map view

- One canvas, drawn from one `ImageData` (T9), 320×256 or 640×256 layer pixels at zoom.
- **Whole map** (default, D4): unscrolled, with the visible window (scroll, wrapping) and the
  effective clip window as outlines. **As displayed**: scrolled and clipped, as the layer reaches the
  mixer.
- Overlays, each a toolbar toggle: the cell grid; tile indices as text (only at zoom ≥ 3, else on
  hover); attribute glyphs (`R` `X` `Y`, palette offset, "below ULA" dot); "changed since last
  stop" cell markers, using the treatment the Sprite plan defines (its D16).
- Hover: cell, tile, entry address (T1), and the layer pixel. Click selects the cell.

#### 4.5.2 Tiles view

- The definitions as a grid of 8×8 tiles: 256 or 512 (T3), 4-bit or 1-bit (T4), drawn into one
  `ImageData` (T9).
- **Palette offset:** *Fixed n*, or **From map**, which uses the offset of the first cell that uses
  the tile, so the sheet looks like the screen.
- **Usage badge:** how many cells reference each tile; unreferenced tiles are dimmed.
- Range markers where the definitions overlap the map or the ULA (D10).

#### 4.5.3 Inspector pane

- **Cell:** the tile *as stored* and *as shown* (`transformTile`, T5) at large zoom; the
  field-by-field decode with the raw bytes (D5); the entry's three addresses (T1); the colours used,
  as `NextPaletteViewer` swatches; the reason it might be invisible (transparent, outside clip,
  outside the visible window, tilemap disabled).
- **Tile:** the tile large, its byte range, and the cells that use it (click to select).
- Context menu on a cell: *Show entry in memory*, *Break on write to this entry* (§1.2), *Copy as
  `.db`*.

### 4.6 Shared pieces (created by whichever G3 inspector lands first)

| Piece | Home | Users |
| --- | --- | --- |
| Next special-document scaffolding and the **Machine → ZX Spectrum Next** submenu | `specialDocuments.ts`, `zx-next-menus.ts` | Copper, Sprites, Tilemap, Layer 2 |
| `clipWindows.ts`: effective clip windows for ULA (`$1A`), Layer 2 (`$18`), sprites (`$19`, three branches), tilemap (`$1B`) in one coordinate space (the 320×256 layer space, paper at (32,32)) | `src/common/zxnext/video/clipWindows.ts` | Tilemap, Layer 2, Sprites (replaces its `effectiveClipWindow`), G3.6 |
| `useNextDevicePalette(device, {bank?, enabled?})`: generalises `useSpritePalette` with the `DEVICES` table of `PalettePanel.tsx` (live bank per device, transparency) | `renderer/features/next-palette/` | Tilemap, Layer 2, Sprites, the Palettes panel |
| `IndexedImageCanvas`: an indexed-colour image (`Uint8Array` + ABGR table + transparency) drawn into one `ImageData`, with zoom, checker and an overlay slot | `renderer/controls/Next/IndexedImageCanvas.tsx`, built on `ScreenCanvas.tsx` | Tilemap, Layer 2, G3.6 |

`useSpritePalette` becomes a thin call of the general hook, and its tests keep passing.

---

## 5. Phases

**Phase 1: pure modules.** `tilemapDecode`, `tilemapGeometry`, `tilemapDiagnostics`,
`tilemapUsage`, and `clipWindows.ts` if no sibling has created it. Tests (`node`): T2 (four entry
formats), T3 (512 mode, with and without force-on-top), T4 (text mode colour and length), T5 (all 8
transforms), T6 (80 columns, clip and scroll wrap), T1/T7 overlaps including the bank-7 wrap.

**Phase 2: core exports and the read path.** §4.2, §4.3, `useNextTilemapState`. Harness tests in
`test/zxnext-hw/tilemap/inspector-state.test.ts`, registered in `build/e2e-tests.ts`; add
`session.tilemapState()` (harness README, "Adding a method"). Assert, for the configurations TM-001…
TM-025 already cover: the image `tilemapDecode` produces equals both `_tilemap-helpers.tilemapScreen`
and the core's rendered tilemap pixels (D3); the snapshot is identical across two reads; the state
determinism test still passes.

**Phase 3: shared rendering pieces.** `useNextDevicePalette` (with `useSpritePalette` rewritten on
top of it, its tests unchanged) and `IndexedImageCanvas`, if not already present.

**Phase 4: the document shell.** `$tilemap`, registry, `show-tilemap`/`shtm`, `show-tiles`/`shtl`,
the Next submenu item, IdeApi, workspace restore, empty state, toolbar, globals strip. Tests (jsdom):
the commands, the empty state, the globals-strip model including the overlap chip.

**Phase 5: the Map view.** §4.5.1. Tests: the overlay model and hover mapping as pure functions.
Verify in the running IDE with the CDP recipe in `.ai/ui-theming-intent-and-lessons.md`; update that
file in the same change (a standing rule).

**Phase 6: the Tiles view and the inspector pane.** §4.5.2–4.5.3, with cross-linking. Tests: the
usage index, "From map" palette offsets, the selection-sync model.

**Phase 7: docs, roadmap and verification.**
- Docs: a "Tilemap Inspector" section in `docs/content/working-with-ide`, screenshots via
  `scripts/doc-shots/` (read `.ai/doc-screenshots-guide.md`), the commands in `commands-reference`;
  `npm run doc:build && npm run doc:check`.
- Roadmap: mark G3.4 done in `CLOSING_THE_GAPS_PLAN.md`; update §2 and §4 of
  `LANDING_PAGE_COMPETITIVE_ANALYSIS.md` (a standing rule).
- `npm run build:check`, `npm run lint:renderer`, the Vite build check, and a manual pass on a
  tilemap program in 40- and 80-column mode, comparing the *As displayed* view with the screen.

---

## 6. Effort

| Item | Phases | Estimate |
| --- | --- | --- |
| Pure decode, geometry, diagnostics | 1 | S |
| Exports and read path | 2 | S |
| Shared palette hook and canvas | 3 | S (zero if a sibling built them) |
| Document shell, Map view | 4–5 | S–M |
| Tiles view, inspector, cross-linking | 6 | S–M |
| Docs and verification | 7 | S |

About **M**, as the roadmap estimated.

---

## 7. Risks

| Risk | Mitigation |
| --- | --- |
| The TypeScript decode drifts from the core | D3: one harness test compares it with both the core and the VHDL-derived model |
| Users read register-at-stop values as "what the screen used" | T10 wording, and the G3.6 probe for the exact per-row picture |
| Refresh cost with 512 tiles | One `ImageData` per view, hash-gated, hidden-document gate (T9) |
| The G3 inspectors each create their own shared pieces | §4.6 names the owner: whichever lands first |

---

## 8. Open questions (proposed answers)

| # | Question | Proposed answer |
| --- | --- | --- |
| Q1 | Default Map mode: *Whole map* or *As displayed*? | *Whole map*, because it shows the scroll and clip windows (D4) |
| Q2 | Also add `show-tiles` as a separate command, or a view switch on `show-tilemap`? | Two commands, one document, as the Sprite plan's D11 |
| Q3 | Show the ULA layer faintly under the map for orientation? | No; that is G3.6's job |
| Q4 | Treat overlaps as warnings even when deliberate? | Yes, with the T7 suppression when the ULA is off |
| Q5 | Export the map and definitions (`.map`/`.til`) in this plan? | No; revisit after use |
