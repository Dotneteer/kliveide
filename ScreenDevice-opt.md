# NextComposedScreenDevice Performance Optimization Analysis

## Critical Hot Path: renderTact() and renderULAStandardPixel()

### Current Performance Characteristics
- **renderTact()**: Called ~100,000 times per frame (311 lines × 456 HC = 141,816 tacts @ 50Hz)
- **renderULAStandardPixel()**: Called every iteration when ULA is enabled (most common case)
- Both methods contain operations that could be pre-calculated

## Optimization Opportunities

### 4. Optimize Pixel Shift Calculation
**Location**: Line 1138

**Current Code**:
```typescript
const pixelWithinByte = displayHC & 0x07;
const pixelBit = (this.ulaShiftReg >> (7 - pixelWithinByte)) & 0x01;
```

**Issue**:
- Calculation `7 - pixelWithinByte` performed for every pixel
- Result is always 0-7

**Solution**: Pre-calculate shift amount table
```typescript
// Pre-calculated shift table (8 entries, negligible memory)
private static readonly PIXEL_SHIFT_AMOUNTS = new Uint8Array([7, 6, 5, 4, 3, 2, 1, 0]);

// Usage:
const pixelWithinByte = displayHC & 0x07;
const pixelBit = (this.ulaShiftReg >> NextComposedScreenDevice.PIXEL_SHIFT_AMOUNTS[pixelWithinByte]) & 0x01;
```

**Impact**: Eliminates 1 subtraction per pixel in display area

---

### 5. Cache Flash Attribute Decoding
**Location**: Lines 1141-1156

**Current Code**:
```typescript
const flash = (this.ulaShiftAttr >> 7) & 0x01;
const bright = (this.ulaShiftAttr >> 6) & 0x01;
const paperColor = (this.ulaShiftAttr >> 3) & 0x07;
const inkColor = this.ulaShiftAttr & 0x07;

let finalInk = inkColor;
let finalPaper = paperColor;
if (flash && this._flashFlag) {
  finalInk = paperColor;
  finalPaper = inkColor;
}

const colorIndex = pixelBit ? finalInk : finalPaper;
const paletteIndex = colorIndex + (bright << 3);
```

**Issue**:
- Attribute decoding happens for every pixel, even though it only changes once per 8 pixels
- Same attribute byte decoded 8 times in a row

**Solution**: Cache decoded attribute values during shift register load
```typescript
// Add to class properties:
private _cachedFinalInk: number;
private _cachedFinalPaper: number;
private _cachedBright: number;

// In ULA_SHIFT_REG_LOAD block (line ~1080):
if ((cell & ULA_SHIFT_REG_LOAD) !== 0) {
  this.ulaShiftReg = /* ... existing calculation ... */;
  this.ulaShiftCount = 0;
  this.ulaShiftAttr = this.ulaAttrByte1;
  
  // Decode attribute once for next 8 pixels
  const flash = (this.ulaShiftAttr >> 7) & 0x01;
  this._cachedBright = (this.ulaShiftAttr >> 6) & 0x01;
  const paperColor = (this.ulaShiftAttr >> 3) & 0x07;
  const inkColor = this.ulaShiftAttr & 0x07;
  
  if (flash && this._flashFlag) {
    this._cachedFinalInk = paperColor;
    this._cachedFinalPaper = inkColor;
  } else {
    this._cachedFinalInk = inkColor;
    this._cachedFinalPaper = paperColor;
  }
}

// In pixel generation (simplified):
const colorIndex = pixelBit ? this._cachedFinalInk : this._cachedFinalPaper;
const paletteIndex = colorIndex + (this._cachedBright << 3);
```

**Impact**: Eliminates 5 bit operations + 1 conditional per pixel (replaces with cached read)

---

### 6. Pre-calculate Clipping Test Results
**Location**: Lines 1164-1169

**Current Code**:
```typescript
const clipped =
  displayHC < this.ulaClipWindowX1 ||
  displayHC > this.ulaClipWindowX2 ||
  displayVC < this.ulaClipWindowY1 ||
  displayVC > this.ulaClipWindowY2;
```

**Issue**:
- 4 comparisons per pixel
- Clip window values change infrequently
- Could be pre-calculated per scanline or per rendering flag cell

**Solution Option A**: Add clipping flag to rendering cells
```typescript
// Add to ULA_* bit flags:
export const ULA_CLIPPED = 0b100000000; // bit 8

// In generateULAStandardRenderingFlags():
if (displayHC < clipWindowX1 || displayHC > clipWindowX2 ||
    displayVC < clipWindowY1 || displayVC > clipWindowY2) {
  flags |= ULA_CLIPPED;
}

// In renderULAStandardPixel():
const clipped = (cell & ULA_CLIPPED) !== 0;
```

**Solution Option B**: Per-scanline clipping flags
```typescript
// Pre-calculated per-VC clipping state
private _vcClipped: Uint8Array; // [vc] -> 1 if VC is clipped, 0 otherwise

// In pixel rendering:
const clipped = this._vcClipped[vc] || 
                displayHC < this.ulaClipWindowX1 || 
                displayHC > this.ulaClipWindowX2;
```

**Impact**: Reduces 4 comparisons to 1-2 for most cases

---

### 7. Optimize Global Transparency Check
**Location**: Line 1172

**Current Code**:
```typescript
const transparent = pixelRGB >> 1 === this.globalTransparencyColor;
```

**Issue**:
- Right shift operation performed for every pixel
- Could be replaced with pre-calculated palette flag

**Solution**: Add transparency flag to palette device
```typescript
// In PaletteDevice, maintain:
private _ulaTransparencyLookup: Uint8Array; // [paletteIndex] -> 1 if transparent, 0 otherwise

// Update when palette or globalTransparencyColor changes:
updateTransparencyLookup() {
  for (let i = 0; i < 16; i++) {
    const rgb = this.getUlaRgb333(i);
    this._ulaTransparencyLookup[i] = (rgb >> 1) === this.globalTransparencyColor ? 1 : 0;
  }
}

// In renderULAStandardPixel():
const transparent = this.machine.paletteDevice.isUlaTransparent(paletteIndex);
```

**Impact**: Eliminates 1 right shift + 1 comparison per pixel

---

### 8. Optimize composeSinglePixel() Layer Priority Switch
**Location**: Lines 1375-1433

**Current Code**:
```typescript
switch (this.layerPriority) {
  case 0: /* 6 if statements */ break;
  case 1: /* 6 if statements */ break;
  // ... 6 cases total
}
```

**Issue**:
- Switch statement + multiple conditionals executed for every pixel pair
- Layer priority rarely changes during gameplay

**Solution**: Function pointer/method table approach
```typescript
// In class:
private _composeFn: (ula: LayerOutput, l2: LayerOutput, spr: LayerOutput) => LayerOutput;

// Generate optimized composition functions at initialization:
private generateComposeFunctions() {
  return [
    this.composeSLU.bind(this),  // Priority 0
    this.composeLSU.bind(this),  // Priority 1
    this.composeSUL.bind(this),  // Priority 2
    this.composeLUS.bind(this),  // Priority 3
    this.composeUSL.bind(this),  // Priority 4
    this.composeULS.bind(this),  // Priority 5
  ];
}

// Individual optimized methods (example for SLU):
private composeSLU(ula: LayerOutput, l2: LayerOutput, spr: LayerOutput): LayerOutput {
  if (spr && !spr.transparent) return spr;
  if (l2 && !l2.transparent) return l2;
  return ula;
}

// Update when layerPriority changes:
set layerPriority(value: number) {
  this._layerPriority = value;
  this._composeFn = this._composeFunctions[value];
}

// In composeSinglePixel():
const selectedOutput = this._composeFn(ulaOutput, layer2Output, spritesOutput);
```

**Impact**: Eliminates switch statement + reduces branching per pixel pair

---

## Memory vs Performance Trade-offs

### Recommended Optimizations (High ROI)
1. **Cache decoded attributes** (#5): ~0 bytes, eliminates 6 operations × 100K pixels = 600K ops
2. **Pixel shift lookup** (#4): 8 bytes, eliminates 100K subtractions
3. **Border RGB cache**: Already implemented ✓

### Medium Priority (Good ROI)
4. **Composition function pointers** (#8): ~48 bytes, eliminates ~100K switch statements
5. **Clipping pre-calculation** (#6): Depends on approach, but clipping is relatively rare

### Lower Priority (Requires changes to other modules)
6. **Transparency lookup** (#7): Requires PaletteDevice changes

---

## Estimated Performance Gains

### Total Operations Eliminated Per Frame
- **~600,000 operations** from cached attribute decoding
- **~100,000 operations** from pixel shift lookup
- **~100,000 operations** from composition optimization

**Total**: ~800,000 eliminated operations per frame

### Memory Cost
- **High-value optimizations**: Minimal (<1 KB)
- All memory allocated once at startup

### Expected Speedup
- Current hot path: ~10-15% faster (primarily from attribute caching)
- Overall frame rendering: ~8-12% faster
- Most impactful when ULA standard mode is active (most common case)

---

## Implementation Priority

**Phase 1 - Quick Wins** (1-2 hours):
1. Cache decoded attributes (#5)
2. Add pixel shift lookup table (#4)
3. Composition function pointers (#8)

**Phase 2 - Advanced** (2-3 hours):
4. Clipping optimization (#6)
5. Transparency lookup integration (#7)

---

## Additional Observations

### Already Well-Optimized
- ✓ Border color RGB caching (line 442-444)
- ✓ Tact-to-HC/VC lookup tables (lines 844-872)
- ✓ Bitmap offset pre-calculation (lines 887-912)
- ✓ ULA address base lookup tables (lines 285-298)
- ✓ Property hoisting in renderTact() (lines 410-420)
- ✓ 1D Uint16Array for rendering flags (vs object arrays)

### Potential Future Optimizations
- SIMD operations for pixel composition (if browser support improves)
- WebAssembly port of hot rendering functions
- Separate code paths for "common case" (ULA-only, no scrolling)
- Render directly to ImageData buffer (eliminate typed array copy)
