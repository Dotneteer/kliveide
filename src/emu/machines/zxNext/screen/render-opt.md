# Performance Optimization Analysis: renderTilemap_40x32Pixel

Called **140,000 times per 20ms frame** (7 million times/second).

## Performance Bottlenecks

### 1. **Method Call Overhead**
- `getTilemapAbsoluteCoordinates()`: Object creation `{ absX, absY }` on every call
- `fetchTilemapTile()`: 3 nested calls to `getTilemapVRAM()`
- `fetchTilemapPattern()`: Loop with repeated `getTilemapVRAM()` calls
- `machine.paletteDevice.getTilemapRgb333()`: External device call
- `machine.paletteDevice.getTilemapPaletteEntry()`: External device call

### 2. **Repeated Calculations**
```typescript
// Calculated on EVERY pixel, even when unchanged:
const wideDisplayYStart = this.confDisplayYStart - 34;
const displayX = hc - this.confDisplayXStart + 32;
const displayY = vc - wideDisplayYStart;
const clipX1 = Math.min((this.tilemapClipWindowX1 << 1), 319);
const clipX2 = Math.min((this.tilemapClipWindowX2 << 1) | 1, 319);
```

### 3. **Conditional Branches**
- Multiple `if` checks per pixel: sampling, clipping, text mode, transparency
- `displayX & 0x07 === 0` check for buffer position reset

### 4. **Object Property Access**
- Repeated access to `this.tilemap*` properties (40+ property reads per call)
- Repeated access to `this.machine.paletteDevice`

### 5. **Diagnostic Code in Hot Path**
```typescript
// DIAGNOSTIC: Log HC when rendering first pixel of top-left tile
if (displayX === 0 && displayY === 0) {
  console.log(...); // Should be removed or behind debug flag
}
```

## Optimizations

### Priority 1: Critical Path

#### A. Cache Computed Display Coordinates
Store frequently-used computed values as class fields, recalculate only when configuration changes:

```typescript
// Add to class fields:
private tilemapWideDisplayYStart: number;
private tilemapClipX1Cache: number;
private tilemapClipX2Cache: number;

// Update in configuration setter or onNewFrame():
private updateTilemapCaches(): void {
  this.tilemapWideDisplayYStart = this.confDisplayYStart - 34;
  this.tilemapClipX1Cache = Math.min((this.tilemapClipWindowX1 << 1), 319);
  this.tilemapClipX2Cache = Math.min((this.tilemapClipWindowX2 << 1) | 1, 319);
}

// In renderTilemap_40x32Pixel:
const displayX = hc - this.confDisplayXStart + 32;
const displayY = vc - this.tilemapWideDisplayYStart; // Use cached value
```

#### B. Inline getTilemapAbsoluteCoordinates
Eliminate object allocation and method call overhead:

```typescript
// Before:
const { absX: fetchAbsX, absY: fetchAbsY } = this.getTilemapAbsoluteCoordinates(
  fetchX, displayY, this.tilemapScrollXField, this.tilemapScrollYField, false
);

// After (inline):
const fetchAbsX = (fetchX + this.tilemapScrollXField) % 320;
const fetchAbsY = (displayY + this.tilemapScrollYField) & 0xff;
```

#### C. Cache Palette Device Reference
Reduce property chain traversal:

```typescript
// Add to class fields:
private paletteDeviceCache: PaletteDevice;

// Initialize in constructor:
this.paletteDeviceCache = machine.paletteDevice;

// Use in method:
const rgb333 = this.paletteDeviceCache.getTilemapRgb333(paletteIndex & 0xff);
```

#### D. Optimize getTilemapVRAM Method
Reduce calculation overhead by caching memory reference:

```typescript
// Add to class fields:
private memoryArray: Uint8Array;

// Initialize in constructor:
this.memoryArray = this.machine.memoryDevice.memory;

// Optimize getTilemapVRAM:
private getTilemapVRAM(useBank7: boolean, offset: number, address: number): number {
  const highByte = ((offset & 0x3f) + ((address >> 8) & 0x3f)) & 0x3f;
  const fullAddress = (highByte << 8) | (address & 0xff);
  const bankBase = useBank7 ? OFFS_BANK_07 : OFFS_BANK_05;
  return this.memoryArray[bankBase + fullAddress] || 0;
}
```

### Priority 2: Moderate

#### E. Early Exit for Disabled Tilemap
Add check at method entry:

```typescript
private renderTilemap_40x32Pixel(vc: number, hc: number, cell: number): void {
  // Fast exit if tilemap is disabled
  if (!this.tilemapEnabled) {
    this.tilemapPixel1Rgb333 = this.tilemapPixel2Rgb333 = null;
    this.tilemapPixel1Transparent = this.tilemapPixel2Transparent = true;
    return;
  }
  // ... rest of method
}
```

#### F. Optimize Conditional Chains
Reorder conditions by likelihood (most common first):

```typescript
// Before: multiple separate checks
if ((cell & SCR_TILEMAP_SAMPLE_MODE) !== 0) { ... }
if ((cell & SCR_TILEMAP_SAMPLE_CONFIG) !== 0) { ... }

// After: if these are rare, combine into single check:
const cellFlags = cell & (SCR_TILEMAP_SAMPLE_MODE | SCR_TILEMAP_SAMPLE_CONFIG | 
                          SCR_TILE_INDEX_FETCH | SCR_PATTERN_FETCH);
if (cellFlags !== 0) {
  if ((cellFlags & SCR_TILEMAP_SAMPLE_MODE) !== 0) { ... }
  if ((cellFlags & SCR_TILEMAP_SAMPLE_CONFIG) !== 0) { ... }
  // ... etc
}
```

#### G. Flatten Nested Object Access
```typescript
// Before:
if (this.tilemapTextModeSampled) {
  transparent = (paletteEntry & 0x1fe) === (this.globalTransparencyColor << 1);
} else {
  transparent = (pixelValue & 0x0f) === (this.tilemapTransparencyIndex & 0x0f);
}

// After: Pre-compute comparison values
const transparencyCheck = this.tilemapTextModeSampled 
  ? (paletteEntry & 0x1fe) === this.globalTransparencyColorShifted
  : (pixelValue & 0x0f) === this.tilemapTransparencyIndexMasked;
```

#### H. Use Typed Arrays for Pixel Buffers
Already done, but ensure optimal access patterns:

```typescript
// Current buffer selection creates a conditional branch:
const currentBuffer = this.tilemapCurrentBuffer === 0 
  ? this.tilemapPixelBuffer0 
  : this.tilemapPixelBuffer1;

// Alternative: Use array indexing
private tilemapPixelBuffers: [Uint8Array, Uint8Array];
// In method:
const currentBuffer = this.tilemapPixelBuffers[this.tilemapCurrentBuffer];
```

### Priority 3: Micro-optimizations

#### I. Remove Console Logging
```typescript
// DELETE or wrap in debug flag:
if (displayX === 0 && displayY === 0) {
  console.log(`[Tilemap-TopLeft] HC=${hc}...`);
}
```

#### J. Use Bitwise Operations Consistently
```typescript
// Replace modulo with bitwise AND where power-of-2:
const absY = (displayY + scrollY) & 0xff; // Already optimized ✓
const absX = (displayX + scrollX) & 0x13f; // For 320 (not power of 2, keep modulo)
```

#### K. Reduce Variable Declarations
Reuse variables when possible within scope:

```typescript
// Before:
const rgb333 = this.paletteDevice.getTilemapRgb333(paletteIndex & 0xff);
const paletteEntry = this.paletteDevice.getTilemapPaletteEntry(paletteIndex & 0xff);

// After (if paletteIndex is only used here):
paletteIndex &= 0xff;
const rgb333 = this.paletteDevice.getTilemapRgb333(paletteIndex);
const paletteEntry = this.paletteDevice.getTilemapPaletteEntry(paletteIndex);
```

## Advanced Strategies

### Scanline Caching
- Cache rendered tilemap scanlines
- Invalidate only when scroll/config changes

### SIMD/WebAssembly Port
- Process 4-8 pixels simultaneously

### Dirty Rectangle Tracking
- Track which tile regions changed
- Skip rendering unchanged tiles

### Separate Fast Paths

```typescript
// Fast path: No transformations, no clipping
private renderTilemap_40x32Pixel_FastPath(vc: number, hc: number, cell: number): void {
  // Minimal conditionals, direct array access
}

// Use dispatcher:
if (this.tilemapCanUseFastPath) {
  this.renderTilemap_40x32Pixel_FastPath(vc, hc, cell);
} else {
  this.renderTilemap_40x32Pixel(vc, hc, cell);
}
```

## Benchmarking

```typescript
// Add performance counters:
private tilemapRenderCount = 0;
private tilemapRenderTime = 0;

// In renderTilemap_40x32Pixel:
const t0 = performance.now();
// ... method body ...
this.tilemapRenderTime += performance.now() - t0;
this.tilemapRenderCount++;

// Report every N frames:
if (frameCount % 60 === 0) {
  const avgTime = this.tilemapRenderTime / this.tilemapRenderCount;
  console.log(`Avg tilemap render time: ${avgTime.toFixed(3)}μs`);
}
```

###