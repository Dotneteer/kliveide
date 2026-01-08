# Plan: Implement 80x32 Tilemap Mode

## Approach
Clone the entire 40x32 tilemap rendering implementation and adapt it step-by-step for 80x32 mode. This preserves the proven architecture and performance characteristics.

## Step-by-Step Implementation

### 1. Clone Rendering Code ✅ COMPLETED
**Status**: Most of this was already implemented! Found existing:
- `renderTilemap_80x32Pixel()` - Full renderer with scrolling/clipping
- `fetchTilemapTileIndex()` - Already supports both modes via `mode80x32` parameter
- `fetchTilemapTileAttribute()` - Already supports both modes
- `fetchTilemapPattern()` - Shared between both modes
- `generateTilemap80x32RenderingFlags()` - Generates fetch timing flags
- `activeRenderingFlagsTilemap_80x32` - Precomputed flag table

**What was added**:
- ✅ Created `renderTilemap_80x32Pixel_FastPath()` - Optimized version for no scrolling/transforms
- ✅ Integrated fast path into rendering loop with mode detection
- ✅ Both modes now have parallel fast/regular paths

### 2. Add Mode Routing ✅ COMPLETED
**Status**: Already implemented in the codebase!
- ✅ Mode detection: `this.tilemap80x32Resolution` reads control register bit 6
- ✅ Routing logic in `renderFrame()` selects correct renderer based on mode
- ✅ Separate rendering flag tables for each mode
- ✅ Mode can be switched dynamically during frame rendering

### 3. Adjust Horizontal Timing ✅ VERIFIED
**Status**: Already correctly implemented!
- ✅ 80x32: `displayX = (hc - ultraWideDisplayXStart) * 2` (generates 2 pixels per HC)
- ✅ 40x32: `displayX = hc - this.confDisplayXStart + 32` (generates 1 pixel per HC)
- ✅ Tile fetch timing handled by separate flag tables for each mode
- ✅ Display width: 640 pixels (80x32) vs 320 pixels (40x32)

### 4. Update X Coordinate Wrapping ✅ VERIFIED  
**Status**: Already correctly implemented!
- ✅ 80x32: `absX = (displayX + this.tilemapScrollXField) % 640` (wraps at 640)
- ✅ 40x32: `absX = (fetchX + this.tilemapScrollXField) % 320` (wraps at 320)
- ✅ Clip window caching:
  - 80x32: `tilemapClipX1Cache_80x32` (0-639 range)
  - 40x32: `tilemapClipX1Cache_40x32` (0-319 range)

### 5. Modify Y Row Offset Multiplier ✅ VERIFIED
**Status**: Already correctly implemented in shared fetch methods!
- ✅ `fetchTilemapTileIndex()`: Uses `tileWidth = mode80x32 ? 80 : 40`
- ✅ `fetchTilemapTileAttribute()`: Uses same `tileWidth` calculation
- ✅ Address calculation: `tileArrayIndex = tileY * tileWidth + tileX`
  - 80x32: multiplies by 80 (80 tiles per row)
  - 40x32: multiplies by 40 (40 tiles per row)
- ✅ This matches VHDL's Y row offset multiplier difference

### 6. Verify Unchanged Elements ✅ VERIFIED
Confirmed these work identically (no changes needed):
- ✅ Tile definition pixel fetching - `fetchTilemapPattern()` shared between modes
- ✅ Palette offset extraction - Same logic in both renderers
- ✅ Flag handling - `fetchTilemapTileAttribute()` shared, handles mirror/rotate/attributes
- ✅ Textmode rendering - Same text mode path in both renderers
- ✅ Transparency detection - Identical logic for both modes
- ✅ Clipping windows - Both use clip window Y1/Y2, different X caches per mode
- ✅ Memory addressing structure - Shared `getTilemapVRAM()` method
- ✅ Vertical resolution - Both use 32 tiles vertically (256 pixels)

### 7. Test Both Modes 🔄 READY FOR TESTING
- ⏳ Verify 40x32 still works (regression test)
- ⏳ Test 80x32 displays 80 tiles horizontally
- ⏳ Verify scrolling works in both modes
- ⏳ Test mode switching
- ⏳ Validate performance is acceptable
- ⏳ Test fast path optimization for both modes

## Implementation Summary

### What Was Already Done
The codebase already had **~95% of the 80x32 implementation complete**:
- Full 80x32 renderer with all transformations
- Shared fetch methods supporting both modes
- Separate rendering flag tables
- Mode detection and routing
- Correct coordinate calculations and wrapping

### What Was Added (Step 1)
- ✅ `renderTilemap_80x32Pixel_FastPath()` - Fast path for common case (no scrolling/transforms)
- ✅ Fast path routing in render loop for 80x32 mode
- ✅ This brings 80x32 to feature parity with 40x32

### Architecture Verification
The implementation correctly matches the VHDL specification:
- ✅ Horizontal timing: 2× pixel generation rate (2 pixels per HC)
- ✅ X wrapping: 640-pixel boundary vs 320-pixel
- ✅ Y row multiplier: 80 tiles/row vs 40 tiles/row
- ✅ All other logic (palette, flags, tiles) is identical

## Next Steps
1. Test the implementation with actual ZX Spectrum Next software
2. Verify performance is acceptable for both modes
3. Test edge cases (scrolling, transformations, clipping)
4. Ensure mode switching works correctly during frame rendering
