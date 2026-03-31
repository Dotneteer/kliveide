# ZX Spectrum Next Sprites — MAME vs Klive Discrepancy Analysis

## Reference Files

| Role | File | Notes |
|------|------|-------|
| MAME header | `_input/src/mame/sinclair/specnext_sprites.h` | `specnext_sprites_device` — clip window, mirror, palette |
| MAME impl | `_input/src/mame/sinclair/specnext_sprites.cpp` | `draw()`, `update_sprites_cache()`, `io_w()`, `mirror_data_w()` |
| MAME wiring | `_input/src/mame/sinclair/specnext.cpp` | NR$15, NR$19, NR$34, NR$43-$4B port wiring |
| Klive device | `src/emu/machines/zxNext/SpriteDevice.ts` | `SpriteDevice` class — attributes, pattern upload, mirror |
| Klive renderer | `src/emu/machines/zxNext/screen/NextComposedScreenDevice.ts` | `renderSpritesPixel()` — line-buffer pipeline |
| Klive palette | `src/emu/machines/zxNext/PaletteDevice.ts` | `getSpriteRgb333()` |

---

## Discrepancy Summary

| # | Area | MAME | Klive | Severity |
|---|------|------|-------|----------|
| D1 | Relative sprite compositing | Full anchor-relative transform pipeline in `update_sprites_cache()` | Not implemented — raw attributes used | 🔴 Critical |
| D2 | Clip window (NR $19) | 3-mode clip: `over_border && !clip`, `!over_border`, `over_border && clip` — uses register values | Fixed boundaries only (0-319/0-255 or 32-287/32-223), register values ignored | 🔴 Critical |
| D3 | Transparency mask for 4-bit | `transp_colour & 0x0f` for 4-bit sprites | Compares full 8-bit `transparencyIndex` against 4-bit pixel — never matches | 🔴 Critical |
| D4 | X/Y coordinate wrapping | `if (destx > area_right) destx -= 512; if (desty > area_bottom) desty -= 512` | No wrapping — 9-bit position used directly | 🟡 Medium |
| D5 | Collision detection | Per-pixel: temporary render → check non-transparent overlap | Line-buffer overlap: any two non-transparent writes to same X | 🟡 Medium |
| D6 | Mirror port (`mirror_data_w`) | Full: `mirror_index`, `mirror_inc`, `mirror_tie`, `mirror_sprite_q`, bidirectional sync | Only lockstep mode (`spriteIdLockstep`) — no `mirror_index`, `mirror_inc`, `mirror_tie` | 🟡 Medium |
| D7 | Port 0x57 attribute auto-increment | Raw byte index into 1024-byte memory, advances by 1 or 8 | Structured `spriteSubIndex` 0-4; extra "direct write" heuristic using port upper byte (dead code) | 🟢 Low (functionally equivalent, but direct-write logic is spurious) |
| D8 | Zero-on-top draw order priority | Uses MAME priority bitmap (`pmask` in `prio_zoom_transpen`) | Line-buffer `existingValid` check — should be equivalent for normal use | 🟢 Low |
| D9 | Anchor state stored at write-time | Computed at draw time from raw attribute memory | Cached at attr-write time — stale if anchor attributes change after relative sprites are written | 🟡 Medium |
| D10 | `tooManySpritesPerLine` (status bit 1) | `TODO` in MAME — always 0 | `spritesOvertime` flag set when not enough CLK_28 cycles — partially implemented | 🟢 Info |
| D11 | 4-bit pattern storage model | `gfx_16x16x4` layout: MAME's gfx subsystem handles nibble unpacking on the fly | Pre-unpacked into separate `patternMemory4bit[]` arrays (lower nibble only per byte) | 🟢 Info (functionally equivalent) |

---

## Detailed Discrepancy Notes

### D1 — Relative Sprite Compositing (🔴 Critical)

MAME's `update_sprites_cache()` performs a comprehensive compositing pass at draw time:

1. **Detection**: `spr_relative = BIT(attr3, 6) && ((attr4 >> 6) == 0b01)` — a sprite is relative when `has5AttributeBytes=true` AND `colorMode=01`.

2. **Visibility gating**: `is_visible &= anchor_vis` — relative sprites are only visible when their anchor is visible.

3. **`rel_type` flag** (`anchor->rel_type = BIT(attr4, 5) && BIT(attr3, 6)`):
   - **Composite type (rel_type=true)**: Anchor's rotate/mirror/scale transforms are inherited and XOR-composed with the relative sprite's own transforms. The relative sprite's X/Y offsets are rotated, mirrored, sign-extended and scaled by the anchor's transforms before being added to the anchor position.
   - **Uniform type (rel_type=false)**: Anchor transforms are zeroed — only position offset is added. Mirror/rotate/scale come directly from the relative sprite's own byte 2/4.

4. **Offset calculation** (composite path):
   ```
   x0 = anchor_rotate ? attr1 : attr0            // swap X/Y if anchor rotated
   y0 = anchor_rotate ? attr0 : attr1
   x1 = (anchor_rotate ^ anchor_xmirror) ? -x0 : x0  // negate if mirrored
   y1 = anchor_ymirror ? -y0 : y0
   x2 = sign_extend_9(x1) << anchor_xscale       // scale by anchor
   y2 = sign_extend_9(y1) << anchor_yscale
   x3 = (anchor.x + x2) & 0x1ff                  // add to anchor pos
   y3 = (anchor.y + y2) & 0x1ff
   ```

5. **Palette offset**: When `BIT(attr2, 0)` (attributeFlag1) is set, palette = `anchor.paloff + relative.paloff`. Otherwise palette = `relative.paloff`.

6. **Pattern offset**: When `BIT(attr4, 0)` is set for relative sprites, pattern = `(pattern + anchor_pattern) & 0x7F`.

7. **Composite transforms**: Final mirror/rotate = anchor XOR relative (only for composite rel_type).

**Klive**: Only stores `anchorX`, `anchorY`, `anchorRotate`, `anchorMirrorX`, `anchorMirrorY` at attribute-write time. The renderer reads raw sprite attributes without any compositing — no offset transformation, no visibility gating, no palette/pattern offset composition, no `rel_type` handling.

**Fix plan**:
- Add a `resolveRelativeSprites()` method to `SpriteDevice` that recomputes absolute positions/transforms for all 128 sprites, following MAME's algorithm.
- Call it at the start of each sprite rendering cycle (when `SCR_SPRITE_INIT_RENDER` fires).
- Store resolved attributes in a separate array (or shadow the existing one) so the renderer can use them without change.
- Store anchor's `scaleX`, `scaleY`, `h` (is4Bit), `pattern7Bit`, `paloff`, and `rel_type` in the anchor state.

---

### D2 — Clip Window (🔴 Critical)

MAME `update_config()` implements three modes:

| Conditions | Clip window result |
|---|---|
| `over_border=1` AND `border_clip_en=0` | Full SCREEN_AREA: `(0, 319, 0, 255)` |
| `over_border=0` | `(clip_x1+32, clip_x2+32, clip_y1+32, clip_y2+32)` — register values offset by OVER_BORDER |
| `over_border=1` AND `border_clip_en=1` | `(clip_x1<<1, (clip_x2<<1)|1, clip_y1, clip_y2)` — register values doubled horizontally |

The clip window is then doubled horizontally again and offset by `m_offset_h`/`m_offset_v` for MAME's 2× screen resolution.

**Klive** `updateSpriteClipBoundaries()`:
```ts
if (spritesOverBorderEnabled) {
    // Fixed: 0-319, 0-255
} else {
    // Fixed: 32-287, 32-223
}
```

The sprite device stores `clipWindowX1/X2/Y1/Y2` via NR $19, but these values are **never used** in the clipping calculation. The `spriteClippingEnabled` flag (NR $15 bit 5, `border_clip_en`) is also stored but never consulted.

**Fix plan**:
- Rewrite `updateSpriteClipBoundaries()` to implement the three-mode logic from MAME.
- Call it when any of `spritesOverBorderEnabled`, `spriteClippingEnabled`, or clip registers change.

---

### D3 — Transparency Mask for 4-Bit Sprites (🔴 Critical)

MAME:
```cpp
m_transp_colour & (spr.h ? 0x0f : 0xff)
```
For 4-bit sprites (`h=true`), only the lower 4 bits of the transparency colour are compared. For 8-bit sprites (`h=false`), the full byte is used.

Klive compares the raw pixel value against full `transparencyIndex`:
```ts
const isTransparent = (pixelValue === this.spriteDevice.transparencyIndex);
```

Since 4-bit pattern memory stores values 0-15, but `transparencyIndex` defaults to 0xE3, the comparison **will never match** for 4-bit sprites. All pixels (including index 3 which should be transparent per `0xE3 & 0x0F = 0x03`) will be drawn opaque.

**Fix plan**:
- Before the transparency check, mask `transparencyIndex` to 4 bits for `is4BitPattern` sprites:
  ```ts
  const transpMask = sprite.is4BitPattern ? 0x0f : 0xff;
  const isTransparent = (pixelValue === (this.spriteDevice.transparencyIndex & transpMask));
  ```

---

### D4 — X/Y Coordinate Wrapping (🟡 Medium)

MAME wraps sprites with large 9-bit positions to negative screen coordinates:
```cpp
s32 destx = offset_h + ((spr.x & 0x1ff) << 1);
if (destx > (offset_h + ((319 << 1) | 1))) destx -= 512 << 1;
s32 desty = offset_v + (spr.y & 0x1ff);
if (desty > (offset_v + 255)) desty -= 512;
```

So sprites at Y=257 appear at Y=-255 (off the top). Sprites at X=321 appear off the left.

Klive uses the 9-bit position directly (0-511). Sprites at positions > 319/255 extend beyond the screen area and are simply clipped by the line buffer bounds check (`bufferPos >= 0 && bufferPos < 320`). However, since spriteY is unsigned 9-bit (0-511), sprites using the hardware Y-wrap trick (e.g., Y = 480 meaning Y = -32) will appear at the wrong position.

**Fix plan**:
- After computing sprite position from attributes, apply wrapping:
  ```ts
  let spriteY = spriteAttrs.y;
  if (spriteY > 255) spriteY -= 512;
  let spriteX = spriteAttrs.x;
  if (spriteX > 319) spriteX -= 512;
  ```

---

### D5 — Collision Detection (🟡 Medium)

MAME performs true **per-pixel collision detection**: for each pair of overlapping sprites, it renders both sprites into temporary 1-pixel-high bitmaps and checks whether any non-transparent pixel from sprite A coincides with a non-transparent pixel from sprite B. This correctly handles sprites with transparent holes.

Klive checks collision at **line-buffer write time**: when writing a non-transparent pixel to a position that already has a valid pixel (`existingValue & 0x100`), `collisionDetected = true`. This is simpler but can produce false positives (two sprites that overlap in bounding box but not in actual opaque pixels) or false negatives (if sprite0OnTop prevents the overwrite, collision is still correctly detected since the check happens before the write allow).

Actually, Klive's approach should be accurate for non-transparent pixel overlaps since it checks at the pixel level of the line buffer. The main difference is that Klive only detects collision for the first pair encountered per scanline, while MAME checks the whole frame at once. This should be acceptable for most software.

**Assessment**: Functionally close but not identical. Low-priority fix.

---

### D6 — Mirror Port (🟡 Medium)

MAME's `mirror_data_w()` implements the full __NextReg $35-$75 sprite mirror__ protocol:
- `mirror_index` (0-7): selects which attribute byte or sprite number to write
  - 0-4: writes attribute byte 0-4 of `mirror_sprite_q`
  - 7: writes `mirror_sprite_q` directly
- `mirror_inc`: auto-increments `mirror_sprite_q` after each write
- `mirror_tie`: bidirectional sync — when the mirror sprite changes, it updates `m_attr_index` and `m_pattern_index` (and vice versa via `io_w`)

Klive implements only `spriteIdLockstep` which syncs `spriteIndex`/`patternIndex` with `spriteMirrorIndex` — a subset of the mirror_tie behavior. The `mirror_index`, `mirror_inc`, and the per-attribute-byte mirror writes are missing.

**Fix plan**:
- Add `mirrorIndex`, `mirrorInc`, `mirrorTie`, and `mirrorSpriteQ` fields.
- Implement them per MAME's `mirror_data_w()` logic.
- Wire NR $34 writes to activate mirror_data_w instead of just updating spriteMirrorIndex.
- Wire NR $09 bits for `mirror_tie`, `mirror_inc`.

---

### D7 — Port 0x57 direct-write heuristic (🟢 Low)

Klive's `writeSpriteAttribute()` examines the upper byte of the port address to detect "direct" attribute writes. This code path will never trigger because port 0x57 is only matched by the lower 8 bits (`pmask = 0x00FF`), so the upper byte will always be 0x00 (not 0x30-0x35). The direct-write attributes (NR $35-$79) are correctly handled separately through `writeSpriteAttributeDirect()`.

The heuristic code should be removed to avoid confusion, but it causes no functional harm.

---

### D9 — Anchor state snapshot timing (🟡 Medium)

Klive caches anchor state (X, Y, rotate, mirrorX, mirrorY) at **attribute write time** (in `writeIndexedSpriteAttribute` case 2). MAME computes relative sprite positions at **draw time** from raw attribute memory.

This means if an anchor sprite's attributes are modified after its relative sprites were written, Klive's cached anchor state may be stale. In practice, games typically write all sprite attributes sequentially (0→127) each frame, so this is unlikely to cause visible bugs. But attribute modifications via the mirror port or out-of-order writes could expose this.

The fix from D1 (runtime resolution of relative sprites) would also fix this.

---

## Fix Priority

### Step 1 — Transparency mask for 4-bit sprites (D3) 🔴
Smallest change, highest impact. One-line fix in `renderSpritesPixel()`.

### Step 2 — Clip window (D2) 🔴
Rewrite `updateSpriteClipBoundaries()` to use register values and implement the 3-mode logic. Medium effort.

### Step 3 — Relative sprite compositing (D1) 🔴
Largest change. Implement `resolveRelativeSprites()` with full MAME-matching algorithm. Consider building a resolved sprite cache at the start of each scanline's rendering pass.

### Step 4 — X/Y coordinate wrapping (D4) 🟡
Small fix in the QUALIFYING phase — apply 9-bit → signed conversion for positions > screen boundary.

### Step 5 — Mirror port (D6) 🟡
Add missing fields and implement `mirror_data_w` logic. Wire NR registers.

### Step 6 — Collision detection improvement (D5) 🟡
Current implementation is acceptable for most software. Could be refined later if specific games exhibit incorrect behavior.

### Step 7 — Cleanup port 0x57 direct-write code (D7) 🟢
Remove dead `isDirect` heuristic from `writeSpriteAttribute()`.
