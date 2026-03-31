# Palette Implementation Comparison: MAME vs Klive

## References
- **MAME**: `_input/src/mame/sinclair/specnext.cpp` (functions `palette_val_w`, `nr_palette_dat`, nextreg read/write cases 0x40–0x44, 0x4A–0x4C)
- **Klive**: `src/emu/machines/zxNext/PaletteDevice.ts`, `src/emu/machines/zxNext/NextRegDevice.ts`
- **FPGA spec**: `_input/next-fpga/nextreg.txt` (registers 0x40–0x44, 0x4A–0x4C)

## Discrepancies

### D1 — NextReg 0x44 first write modifies palette prematurely (Critical)

**MAME**: The first write to NextReg 0x44 only stores the byte in `m_nr_stored_palette_value`. The palette entry is **not** modified until the second write arrives, at which point `palette_val_w()` is called with the combined 9-bit color.

**Klive** (`PaletteDevice.ts` `nextReg44Value` setter): The first write immediately overwrites the palette entry with `palette[index] = (value & 0xff) << 1`, destroying the previous color. The second write then ORs in the blue LSB and optional priority bit.

**Impact**: Between the first and second write to 0x44, MAME preserves the old color while Klive shows a partially-updated color. Any mid-scanline palette update via 0x44 will briefly display the wrong color in Klive. Programs that rely on atomic two-write palette updates (the expected hardware behavior) will glitch.

**Fix**: On the first write, store the value in `storedPaletteValue` only (already done) but do **not** modify the palette array. On the second write, combine both bytes and write the final 9-bit color to the palette.

---

### D2 — NextReg 0x41 readback corrupted for L2 priority colors (High)

**MAME**: Reads NextReg 0x41 via `nr_palette_dat()` which reconstructs the 9-bit color from the stored RGB values (no priority bit). Returns bits 8:1 as the 8-bit RRRGGGBB value.

**Klive** (`PaletteDevice.ts` `nextReg41Value` getter): Returns `getCurrentPalette()[this._paletteIndex] >> 1`. For Layer 2 palette entries with priority set (bit 9 = 0x200), the stored value is e.g. `0x2FF`. Shifting right by 1 produces `0x17F`, a value > 255 with bit 8 set from the priority flag. This corrupts the readback.

**FPGA spec**: 0x41 reads should return the 8-bit RRRGGGBB value (bits 7:0) without priority influence.

**Fix**: Mask off the priority bit before shifting: `return (this.getCurrentPalette()[this._paletteIndex] & 0x1ff) >> 1`.

---

### D3 — NextReg 0x4A (Fallback Colour) not readable (Medium)

**MAME**: Reading NextReg 0x4A returns `m_nr_4a_fallback_rgb` (the raw 8-bit value last written).

**Klive** (`NextRegDevice.ts`): Register 0x4A has `writeFn` only — no `readFn`. Reads return undefined/last-read value.

**FPGA spec**: Register 0x4A is marked (R/W).

**Fix**: Add `readFn` that returns the stored fallback color value.

---

### D4 — NextReg 0x4B (Sprite Transparency Index) not readable (Medium)

**MAME**: Reading NextReg 0x4B returns `m_nr_4b_sprite_transparent_index`.

**Klive** (`NextRegDevice.ts`): Register 0x4B has `writeFn` only — no `readFn`. Reads return undefined/last-read value.

**FPGA spec**: Register 0x4B is marked (R/W).

**Fix**: Add `readFn` that returns `machine.spriteDevice.transparencyIndex`.

---

### D5 — NextReg 0x4A reset value 0x00 instead of 0xE3 (Medium)

**MAME**: Initializes register 0x4A to 0xE3 via `reg_w(0x4a, 0xe3)` during reset.

**Klive** (`NextRegDevice.ts` line 3198): Initializes to 0x00 via `this.directSetRegValue(0x4a, 0x00)`.

**FPGA spec**: Register 0x4A description says "soft reset = 0xe3".

**Impact**: The fallback color (used when all layers are transparent) starts as black instead of the default transparent color E3 (bright magenta). This affects initial display before NextOS configures the palette. Programs that assume the default fallback color will show wrong background.

**Fix**: Change initialization to `this.directSetRegValue(0x4a, 0xe3)` and ensure the `composedScreenDevice.fallbackColor` is also set to 0xE3 on reset.

---

### D6 — NextReg 0x44 readback does not include L2 priority bit (Low)

**FPGA spec**: Reading NextReg 0x44 returns "the 2nd byte" which includes `bit 7 = L2 priority colour` for Layer 2 palettes.

**MAME**: Returns `(BIT(nr_palette_dat(), 9, 2) << 6) | ... | BIT(nr_palette_dat(), 0)`. Since `nr_palette_dat()` returns at most 9-bit color values (no priority), bits 10:9 are always 0 — so priority is NOT returned on readback.

**Klive**: Returns `value & 0x01` — also does not return priority.

**Both MAME and Klive** deviate from the FPGA spec here. The priority bit is stored separately in MAME (`pen_priority_w`) and inline in Klive (bit 9 of the palette entry), but neither returns it during 0x44 reads.

**Impact**: Low — reading back 0x44 to detect priority is unlikely in practice.

**Fix (optional)**: For L2 palettes, include the priority bit in the 0x44 read: `return ((palette[index] & 0x200) ? 0x80 : 0) | (palette[index] & 0x01)`.

---

### D7 — No screen sync before palette writes (Low)

**MAME**: Calls `m_screen->update_now()` before every palette-affecting operation — in `palette_val_w()`, and in the write handlers for 0x43, 0x4A, 0x4B. This ensures the screen is rendered up to the current scanline position before the color change takes effect.

**Klive**: Does not perform any equivalent screen synchronization when palette values are written.

**Impact**: Mid-frame palette changes may take effect at slightly wrong positions. For most programs this is not noticeable since palette changes typically happen during blanking intervals.

**Fix (deferred)**: This is an architectural concern. Klive's rendering pipeline may handle this differently (e.g., per-scanline rendering). Evaluate whether the current rendering approach already serializes palette changes correctly with scanline rendering.

---

## Summary

| ID  | Issue                                     | Severity | Fix Complexity | Status    |
|-----|-------------------------------------------|----------|----------------|-----------|
| D1  | 0x44 first write modifies palette early   | Critical | Simple         | **Fixed** |
| D2  | 0x41 read corrupted for L2 priority       | High     | Simple         | **Fixed** |
| D3  | 0x4A not readable                         | Medium   | Simple         | **Fixed** |
| D4  | 0x4B not readable                         | Medium   | Simple         | **Fixed** |
| D5  | 0x4A reset value 0x00 vs 0xE3             | Medium   | Simple         | **Fixed** |
| D6  | 0x44 read missing L2 priority bit         | Low      | Simple         | **Fixed** |
| D7  | No screen sync before palette writes      | Low      | Deferred       | Deferred  |

## Items Verified as Correct

- **8-bit color expansion** (0x41 write): `(value << 1) | (value & 0x03 ? 1 : 0)` is equivalent to MAME's `(nr_wr_dat << 1) | BIT(nr_wr_dat, 1) | BIT(nr_wr_dat, 0)`.
- **Palette bank selection** (0x43 bits 6:4): Klive's `getCurrentPalette()` switch correctly maps all 8 palette banks (ULA/L2/Sprite/Tilemap × first/second).
- **Active palette selection** (0x43 bits 3:1): Sprite, Layer 2, ULA palette selection for rendering is correct.
- **Tilemap palette selection**: Correctly wired via NextReg 0x6B bit 4 (not 0x43), matching MAME.
- **Auto-increment behavior**: Increments after 0x41 write and after second 0x44 write, respects disable flag. Does not increment on reads.
- **Sub-index reset**: `_secondWrite` reset on writes to 0x40, 0x41, 0x43 — matches MAME.
- **ULANext mode** (0x43 bit 0): Correctly enables/disables ULANext attribute mode.
- **ULANext format** (0x42): Attribute mask for INK/PAPER split is handled correctly.
- **L2 priority write** (0x44 second write bit 7): Correctly sets bit 9 (0x200) on Layer 2 palette entries only.
- **0x41 write clears priority**: Writing via 0x41 produces a 9-bit value (max 0x1FF), implicitly clearing any priority bit.
- **0x4B write**: Sprite transparency index correctly written to `spriteDevice.transparencyIndex`.
- **0x4C read/write**: Tilemap transparency index correctly masked to 4 bits and readable.
- **Default ULA palette colors**: Klive initializes the 16 default colors with correct 9-bit values, repeated across 16 groups, with bright magenta (index 11) adjusted to avoid default transparency.
