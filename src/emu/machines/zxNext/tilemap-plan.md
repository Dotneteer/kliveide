# MAME vs Klive — ZX Spectrum Next Tilemap Discrepancies

## Reference files

| Side  | Path |
|-------|------|
| MAME  | `_input/src/mame/sinclair/specnext_tiles.h`, `specnext_tiles.cpp`, `specnext.cpp` |
| Klive | `src/emu/machines/zxNext/screen/NextComposedScreenDevice.ts` (tilemap renderer), `NextRegDevice.ts` (NR $6B/$6C/$6E/$6F/$1B) |

---

## Summary table

| # | Area | MAME | Klive | Severity |
|---|------|------|-------|----------|
| D1 | Per-tile ULA priority | Category 1 (below ULA) / 2 (above ULA) per tile attr bit 0; `forceOnTop` (NR $6B bit 0) overrides to always category 2 | `tilemapTilePriority` is parsed but **never consumed** in compositing; tilemap always on top of ULA when both non-transparent | 🔴 Critical |
| D2 | Map base bank 7 address mask | `m_tm_map_base & 0x1f` (5 bits) for bank 7; `m_tm_map_base & 0x3f` (6 bits) for bank 5 | `getTilemapVRAM` always uses `offset & 0x3f` (6 bits) regardless of bank | 🟡 Medium |
| D3 | 80×32 scroll X wrap | MAME tilemap `m_tilemap[1]` is 640 pixels wide (80 tiles × 8px); scrollX wraps at 640 | `fetchAbsX = (fetchX + scrollX) % 320` wraps at 320, which is correct for the 4px/tile display space but differs if scrollX is specified in MAME's 8px/tile coordinates | 🟢 Low — see note |
| D4 | 40×32 scroll X doubling | MAME: `set_scrollx(scrollX << 1)` for 40×32 tilemap (because MAME internal tilemap is 640px wide) | Klive: `(fetchX + scrollX) % 320` — no doubling; result is identical since Klive's tilemap is 320px | ✅ Match |
| D5 | Clip X cache max | MAME: `clip &= SCREEN_AREA` (0–319) intermediate clamp before doubling to 640 | Klive: `Math.min(clipWindowX << 1, 639)` — caps at 639 but displayX ranges 0–319, so right-edge clip is effectively inactive for clipWindowX2 ≥ 160 | ✅ Match |
| D6 | Tile definition base calculation | MAME: `(bank << 14) + (tm_tile_base & 0x3f) << 8` — flat pointer, always 6 bits | Klive: `getTilemapVRAM(useBank7, offset, addr)` adds offset to address high byte, wraps at 0x3f — equivalent for 6-bit tile base | ✅ Match |
| D7 | Text mode palette index | MAME: `pal_offset = BIT(attr, 1, 7)` → 7-bit palette offset; pen = `(pal_offset << 1) + pixel_bit` | Klive: `paletteIndex = ((attr >> 1) << 1) \| pixelValue` = `(attr & 0xfe) \| pixelValue` — same result | ✅ Match |
| D8 | Graphics mode palette index | MAME: `BIT(attr, 4, 4)` → upper 4 bits of attr as palette group; gfx granularity 16; pen = `palOffset * 16 + pixelValue` | Klive: `(palOffset << 4) \| pixelValue` — equivalent | ✅ Match |
| D9 | Text mode transparency (global transparent) | MAME: compares resolved RGB pen with `gt0`/`gt1` (both 9-bit expansions of `global_transparent`) per group/layer mapping | Klive: `(paletteEntry & 0x1fe) === globalTransparencyColor << 1` — compares upper 8 bits of 9-bit RGB; equivalent | ✅ Match |
| D10 | Graphics mode transparency | MAME: `set_transparent_pen(m_transp_colour)` — compares 4-bit pixel value against `transp_colour & 0x0f` | Klive: `(pixelValue & 0x0f) === (tilemapTransparencyIndex & 0x0f)` | ✅ Match |
| D11 | Tile rotation (transform) | MAME: uses pre-rotated gfx layout `gfx_8x8x4_r`; gfx index = `(rotate << 1) \| mode80x32` | Klive: `applyTileTransformation()` in `fetchTilemapPattern()` computes `(x,y)→(y,7−x)` for rotation | ✅ Match |
| D12 | Tile X/Y mirror | MAME: `TILE_FLIPX`, `TILE_FLIPY` applied post-decode by MAME tilemap infrastructure | Klive: Applied atomically in `applyTileTransformation()` | ✅ Match |
| D13 | 512-tile mode | MAME: attr bit 0 becomes tile index bit 8; disables per-tile priority (category forced to 1) | Klive: `tilemap512TileModeSampled ? false : (attr & 0x01) !== 0` for priority; `tileIndex \|= (attr & 0x01) << 8` for index | ✅ Match |
| D14 | NR $6B control byte layout | MAME: `control = BIT(nr_wr_dat, 0, 7)` = lower 7 bits; bit 7 = `tm_en` (separate) | Klive: `nextReg6bValue` setter: bit 7 = `tilemapEnabled`, bits 6:0 = control fields | ✅ Match |
| D15 | Default attr (NR $6C) | MAME: `default_flags_w(nr_wr_dat)` — full 8 bits; used when `strip_flags_n = 0` (eliminate attrs) | Klive: `tilemapDefaultAttrCache = value` — full 8 bits, used when `eliminateAttr = true` | ✅ Match |
| D16 | Stencil mode compositing | MAME: not directly in tiles device — compositing is in `screen_update` with blend modes | Klive: `ulaEnableStencilMode` → AND of ULA and tilemap colors; transparent if either is transparent | ✅ Match (per VHDL) |

---

## Detailed discrepancy notes

### D1 — Per-tile ULA priority (🔴 Critical)

**MAME behaviour:**

In `get_tile_info()` (specnext_tiles.cpp line ~79):
```cpp
if (BIT(m_control, 1))       // 512-tile mode
    code |= BIT(attr, 0) << 8;  // attr bit 0 → tile index bit 8
else
    category = BIT(attr, 0) ? 1 : 2;  // attr bit 0 → priority

const bool tm_on_top = BIT(m_control, 0);  // NR $6B bit 0 = forceOnTop
tileinfo.category = tm_on_top ? 2 : category;
```

Category determines draw order in `screen_update()` (specnext.cpp):
- **Category 1** tiles are drawn BEFORE ULA → appear below ULA
- **Category 2** tiles are drawn AFTER ULA → appear above ULA
- When `forceOnTop` (NR $6B bit 0) is set, ALL tiles are category 2 (always on top)

In the SLU (standard) compositing order (specnext.cpp line ~993):
```cpp
m_tiles->draw(screen, bitmap, clip, TILEMAP_DRAW_CATEGORY(1), l[0]); // tiles below ULA
// ... ULA drawn here ...
m_tiles->draw(screen, bitmap, clip, TILEMAP_DRAW_CATEGORY(2), l[0]); // tiles above ULA
```

**Klive behaviour:**

`tilemapTilePriority` is parsed correctly from attr bit 0:
```ts
this.tilemapTilePriority = this.tilemap512TileModeSampled
    ? false
    : (this.tilemapCurrentAttr & 0x01) !== 0;
```

But `tilemapTilePriority` is **never consumed** in the compositing logic (line ~747):
```ts
// Both non-transparent: tilemap on top (simplified)
this.ulaPixel1Rgb333 = this.tilemapPixel1Rgb333;
```

The tilemap always wins when both layers are non-transparent.

**Fix:** In the compositing section, when both ULA and tilemap are non-transparent:
- If `tilemapForceOnTopOfUla` → tilemap wins (category 2)
- Else if `tilemapTilePriority` (attr bit 0 = 1) → ULA wins (category 1 = below ULA)
- Else → tilemap wins (category 2 = above ULA)

Note: This needs to correctly track `tilemapTilePriority` through the pixel pipeline since the
compositing section processes the already-rendered pixels. The per-tile priority needs to be
carried along with each tilemap pixel output (similar to how `tilemapPixel1Transparent` is tracked).

**Implementation plan:**
1. Add fields: `tilemapPixel1BelowUla`, `tilemapPixel2BelowUla`
2. In each tilemap render path (40×32, 80×32, fast paths), set the per-pixel priority:
   `tilemapPixelNBelowUla = !forceOnTop && (tilePriority)` (attr bit 0 = 1 means below ULA)
3. In the compositing merge section, when both ULA and tilemap are non-transparent:
   - If `tilemapPixelNBelowUla` → keep ULA pixel (tilemap is below)
   - Else → keep tilemap pixel (tilemap is above)

---

### D2 — Map base bank 7 address mask (🟡 Medium)

**MAME behaviour** (specnext_tiles.cpp line ~139):
```cpp
m_tiles_info = m_host_ram_ptr;
if (BIT(m_tm_map_base, 6))
    m_tiles_info += (7 << 14) + ((m_tm_map_base & 0x1f) << 8);  // 5 bits for bank 7
else
    m_tiles_info += (5 << 14) + ((m_tm_map_base & 0x3f) << 8);  // 6 bits for bank 5
```

Bank 7 restricts the offset to 5 bits (0–31 × 256 = 0–7936), while bank 5 allows 6 bits (0–63 × 256 = 0–16128). This is a hardware constraint.

**Klive behaviour:**

`getTilemapVRAM` always uses `offset & 0x3f` (6 bits) regardless of bank selection:
```ts
const highByte = ((offset & 0x3f) + ((address >> 8) & 0x3f)) & 0x3f;
```

For bank 7, this allows offsets 32–63 which would access beyond the intended bank.

**Fix:** In `getTilemapVRAM`, mask the offset based on bank:
```ts
const offsetMask = useBank7 ? 0x1f : 0x3f;
const highByte = ((offset & offsetMask) + ((address >> 8) & 0x3f)) & 0x3f;
```

Alternatively, apply the 5-bit mask at store time in the NR $6E handler.

---

### D3 — 80×32 scroll X wrap (🟢 Low)

**MAME:** The 80×32 internal tilemap is 80 tiles × 8px = 640 pixels wide. `set_scrollx(scrollX)` wraps at 640.

**Klive:** Uses `(fetchX + scrollX) % 320` which wraps at 320. Each 80×32 tile is displayed at 4 pixels (half-width), so 80 × 4 = 320 display pixels.

**Analysis:** The ZX Next scrollX register is 10 bits (NR $2F/$30). In 80×32 mode, each tile occupies 4 display pixels, so the tilemap virtual width is 320 display pixels. Klive wraps in display pixels (0–319), while MAME wraps in tile pixels (0–639). If the hardware scrollX is specified in tile pixels (8px units), then Klive should either divide by 2 or wrap at 640. If the scrollX is in display pixels (4px units), Klive's wrapping at 320 is correct.

Per the VHDL, `tm_scroll_x` is applied in the pixel coordinate space of the resolution mode. For 80×32, tiles are 4 pixels wide on screen, and the tilemap virtual width in the hardware's pixel domain is 320. Klive's `% 320` matches the hardware for normal scrollX values (0–319). Values 320–1023 behave identically to values 0–703 modulo 320.

**Verdict:** No fix needed — Klive follows the hardware convention.

---

## Steps

### Step 1 — Fix per-tile ULA priority compositing (D1) (🔴 Critical)

1. Add `tilemapPixel1BelowUla` and `tilemapPixel2BelowUla` boolean fields.
2. In each of the 4 tilemap render methods (40×32, 40×32 fast, 80×32, 80×32 fast), after computing the pixel:
   ```ts
   const belowUla = !this.tilemapForceOnTopOfUla && this.tilemapTilePriority;
   this.tilemapPixel1BelowUla = belowUla;
   this.tilemapPixel2BelowUla = belowUla;
   ```
   In 80×32, set pixel1/pixel2 independently since they're from the same tile.
3. In the compositing section (around line ~747), replace the "tilemap on top (simplified)" branch:
   ```ts
   // Before (wrong):
   // Both non-transparent: tilemap on top (simplified)
   this.ulaPixel1Rgb333 = this.tilemapPixel1Rgb333;

   // After (correct):
   if (!this.tilemapPixel1BelowUla) {
     // Tilemap above ULA — tilemap wins
     this.ulaPixel1Rgb333 = this.tilemapPixel1Rgb333;
   }
   // else: ULA stays on top (tilemap is below, ULA was already set)
   ```
4. Same for pixel2.
5. Ensure `tilemapTilePriority` is also tracked per-pixel correctly through the tile boundary swap
   (copy from `tilemapNextTilePriority` to `tilemapTilePriority` at tile boundaries, same as palette offset).

### Step 2 — Fix bank 7 address mask (D2) (🟡 Medium)

1. In `getTilemapVRAM`, change the offset mask based on bank:
   ```ts
   const offsetMask = useBank7 ? 0x1f : 0x3f;
   const highByte = ((offset & offsetMask) + ((address >> 8) & 0x3f)) & 0x3f;
   ```

### Step 3 — Add unit tests

1. Test D1: per-tile priority — tile with attr bit 0 = 1 should appear below ULA
2. Test D1: forceOnTop overrides per-tile priority
3. Test D2: bank 7 offset mask (addresses above 31 should wrap within 5-bit space)
