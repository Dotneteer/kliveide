# Tilemap Rendering Performance Analysis

## Current Architecture

The tilemap renderer processes 81,920 pixels per frame (320×256) at ~50-60 fps, executing `renderTilemap_40x32Pixel()` ~82K times per frame.

**Rendering Pipeline:**
1. **Fetch phase** (positions 6-7 in tile): Index → Attribute → Pattern
2. **Render phase**: Buffer read → Palette lookup → Transparency check

**Fast path optimization exists** for: no scroll, no transformations, full clip window.

## Performance Bottlenecks

### 1. **Object Allocation in getTilemapAbsoluteCoordinates** (Eliminated in main path, still called elsewhere)
```typescript
return { absX, absY }; // Creates object every call
```
**Impact:** Avoided in renderTilemap_40x32Pixel via inlining, but called 3× per pixel (index/attr/pattern fetch).  
**Fix:** Already inlined in main render path. Consider inlining in fetch functions.

### 2. **Double Buffer Array Creation Per Pixel**
```typescript
const buffers = [this.tilemapPixelBuffer0, this.tilemapPixelBuffer1];
const currentBuffer = buffers[this.tilemapCurrentBuffer];
```
**Impact:** Creates 2-element array 82K times/frame.  
**Fix:** Direct conditional selection:
```typescript
const currentBuffer = this.tilemapCurrentBuffer === 0 
  ? this.tilemapPixelBuffer0 
  : this.tilemapPixelBuffer1;
```
**Savings:** ~164K array allocations/frame eliminated.

### 3. **Redundant Palette Lookups**
```typescript
const rgb333 = this.paletteDeviceCache.getTilemapRgb333(paletteIndex & 0xff);
const paletteEntry = this.paletteDeviceCache.getTilemapPaletteEntry(paletteIndex & 0xff);
```
**Impact:** Two separate lookups with same index. Likely hits cache but unnecessary method calls.  
**Fix:** Single lookup returning both values if palette device supports it.

### 4. **Tile Boundary Check Overhead**
```typescript
if ((displayX & 0x07) === 0) { /* 5 field assignments + buffer swap + conditional */ }
```
**Impact:** Checked 82K times, executed 10K times (every 8 pixels).  
**Status:** Unavoidable, but assignments could be optimized.

### 5. **getTilemapAddresses Called 2-3× Per Pixel**
```typescript
fetchTilemapTileIndex() { getTilemapAddresses(...) } // Call 1
fetchTilemapTileAttribute() { getTilemapAddresses(...) } // Call 2
```
**Impact:** Index and attribute fetch call same function with identical parameters.  
**Fix:** Call once, pass both addresses:
```typescript
const { tileIndexAddr, tileAttrAddr } = this.getTilemapAddresses(...);
this.fetchTilemapTileIndex(tileIndexAddr);
this.fetchTilemapTileAttribute(tileAttrAddr);
```
**Savings:** Eliminate 82K redundant address calculations/frame.

### 6. **Modulo Operation in Scroll Calculation**
```typescript
const fetchAbsX = (fetchX + this.tilemapScrollXField) % 320;
```
**Impact:** Modulo is expensive (~10× slower than bitwise AND).  
**Fix:** For power-of-2, use bitwise: `& 319` (only if 320 were 256/512).  
**Status:** Cannot optimize (320 not power-of-2). Fast path avoids this.

### 7. **Boolean to Number Conversion in Text Mode**
```typescript
paletteIndex = ((this.tilemapTileAttr >> 1) << 1) | pixelValue;
```
**Status:** Efficient bit manipulation, no improvement needed.

### 8. **getTilemapVRAM Address Calculation**
```typescript
const highByte = ((offset & 0x3f) + ((address >> 8) & 0x3f)) & 0x3f;
const fullAddress = (highByte << 8) | (address & 0xff);
const physicalAddress = bankBase + fullAddress;
```
**Impact:** 3× address calculations per fetch (pattern fetch does 8 in graphics mode).  
**Status:** Hardware-mandated calculation. Consider lookup table for common addresses if patterns repeat.

## Recommended Optimizations (Priority Order)

### High Impact

**1. Eliminate Buffer Array Allocation**
```typescript
// Current (82K allocations/frame)
const buffers = [this.tilemapPixelBuffer0, this.tilemapPixelBuffer1];
const currentBuffer = buffers[this.tilemapCurrentBuffer];

// Optimized
const currentBuffer = this.tilemapCurrentBuffer === 0 
  ? this.tilemapPixelBuffer0 
  : this.tilemapPixelBuffer1;
```
**Effort:** 1 line change  
**Gain:** ~164K allocations eliminated, ~5-10% frame time reduction

**2. Merge getTilemapAddresses Calls**
```typescript
// In fetch phase, call once and pass results
if ((cell & (SCR_TILE_INDEX_FETCH | SCR_TILE_ATTR_FETCH)) !== 0) {
  const { tileIndexAddr, tileAttrAddr } = this.getTilemapAddresses(...);
  if ((cell & SCR_TILE_INDEX_FETCH) !== 0) {
    this.fetchTilemapTileIndexDirect(tileIndexAddr);
  }
  if ((cell & SCR_TILE_ATTR_FETCH) !== 0) {
    this.fetchTilemapTileAttributeDirect(tileAttrAddr);
  }
}
```
**Effort:** Refactor fetch functions to accept pre-calculated addresses  
**Gain:** Eliminate 82K redundant calculations, ~3-5% improvement

### Medium Impact

**3. Cache Palette Lookups**
If palette rarely changes, cache last lookup:
```typescript
if (paletteIndex === this.lastPaletteIndex) {
  rgb333 = this.cachedRgb333;
  paletteEntry = this.cachedPaletteEntry;
} else {
  // lookup and cache
}
```
**Effort:** Add cache fields, check/update logic  
**Gain:** Variable (depends on palette locality), ~2-8% if high hit rate

**4. Inline fetchTilemapPattern in Text Mode**
Text mode pattern fetch is simple (single byte read, bit extraction).  
Inlining eliminates function call overhead.  
**Effort:** Medium (code duplication)  
**Gain:** ~2-3% for text mode only

### Low Impact

**5. Optimize Tile Boundary Assignments**
```typescript
// Group related assignments
if ((displayX & 0x07) === 0) {
  this.tilemapBufferPosition = 0;
  this.tilemapCurrentBuffer = 1 - this.tilemapCurrentBuffer;
  // Use local var for buffer-swapped reads
  const attr = this.tilemapNextTileAttr;
  this.tilemapTileAttr = attr;
  this.tilemapTilePaletteOffset = (attr >> 4) & 0x0f;
  // etc.
}
```
**Gain:** Marginal (<1%)

**6. SIMD for Graphics Mode Pattern Fetch**
Graphics mode loops 8 times extracting nibbles. WASM SIMD could process in parallel.  
**Effort:** High (requires WASM build)  
**Gain:** ~5-10% for graphics mode

## Fast Path Optimization Review

Current fast path skips:
- Scroll calculations (no modulo)
- Clip window checks (assumed full window)
- Transformation flag copying (not used)

**Missing optimization:** Still creates buffer array.

**Recommendation:** Apply buffer array fix to fast path for additional gain.

## Profiling Targets

Run Chrome DevTools profiler on tilemap-heavy scene:

1. Measure time in `renderTilemap_40x32Pixel`
2. Check `getTilemapVRAM` call count/time
3. Verify buffer array allocation (Allocation Profile)
4. Check `getTilemapAddresses` CPU time

## Implementation Plan

**Phase 1 (1 hour):**
- Fix buffer array allocation in all render paths
- Apply to fast path

**Phase 2 (2-3 hours):**
- Refactor fetch functions to accept pre-calculated addresses
- Merge address calculations

**Phase 3 (Optional, 4+ hours):**
- Implement palette lookup cache with hit/miss metrics
- Profile to validate gains

**Expected Total Gain:** 8-15% frame time reduction in tilemap-heavy scenes.

## Notes

- Fast path already optimizes common case well
- Biggest wins are eliminating unnecessary allocations and redundant calculations
- Hardware-mandated calculations (address mapping) cannot be optimized without lookup tables
- Text mode is inherently more efficient than graphics mode (1 read vs 8 reads per tile)
