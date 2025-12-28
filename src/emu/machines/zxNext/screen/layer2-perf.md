# Layer 2 Rendering Performance Optimization Plan

## Current Performance Characteristics

The Layer 2 rendering implementation currently performs several calculations per pixel:
- Display coordinate transformation (VC/HC to display-relative coordinates)
- Wide coordinate offset calculation (for 320×256 and 640×256 modes)
- Clipping window bounds checking
- Scrolling coordinate calculation with wrapping
- Bank offset calculation and memory address computation
- Palette lookup with offset application

## Performance Bottlenecks

### 1. **Per-Pixel Coordinate Transformations**
**Current**: Each pixel recalculates display offsets and wide coordinate adjustments
```typescript
const displayHC_wide = (hc - device.confDisplayXStart) + 32;
const displayVC_wide = (vc - device.confDisplayYStart) + 32;
```

**Impact**: Repeated subtraction and addition operations for every pixel in the display area (92,160 pixels for 320×256 mode)

### 2. **Clipping Window Calculations**
**Current**: Every pixel performs 4 comparison operations
```typescript
if (!hc_valid || !vc_valid ||
    displayHC_wide < clipX1 || displayHC_wide > clipX2 ||
    displayVC_wide < clipY1 || displayVC_wide > clipY2)
```

**Impact**: Clipping checks are expensive when most pixels are not clipped

### 3. **Bank Offset Calculation**
**Current**: Bank offset calculated per pixel fetch
```typescript
const segment16K = (offset >> 14) & 0x07;
const half8K = (offset >> 13) & 0x01;
const bank8K = (bank16K + segment16K) * 2 + half8K;
```

**Impact**: Repeated bit operations and arithmetic for sequential memory access

### 4. **320×256 X-Coordinate Wrapping Logic**
**Current**: Conditional wrapping with upper bit manipulation
```typescript
if (x_pre >= 320) {
  const upper = ((x_pre >> 6) & 0x7) + 3;
  x = (upper << 6) | (x_pre & 0x3F);
}
```

**Impact**: Branch prediction issues and bit manipulation overhead

### 5. **Memory Access Pattern**
**Current**: Random access pattern due to scrolling, especially with large scroll offsets

**Impact**: Poor cache locality, potential cache misses

## Optimization Strategies

### Priority 1: Hot Path Optimizations

#### A. **Precompute Per-Scanline Constants**
Create a scanline-based rendering approach that precomputes invariant values:

```typescript
interface Layer2ScanlineState {
  vc: number;
  displayVC: number;
  displayVC_wide: number;
  vc_valid: boolean;
  clippedByVertical: boolean;
  baseYOffset: number;  // Pre-calculated Y offset for memory addressing
}

// At start of each scanline:
function prepareScanlineState(device: ILayer2RenderingState, vc: number): Layer2ScanlineState {
  const displayVC_wide = (vc - device.confDisplayYStart) + 32;
  const vc_valid = displayVC_wide >= 0 && displayVC_wide < 256;
  const clippedByVertical = displayVC_wide < device.layer2ClipWindowY1 || 
                            displayVC_wide > device.layer2ClipWindowY2;
  
  const y_pre = displayVC_wide + device.layer2ScrollY;
  const y = y_pre & 0xFF;
  
  return {
    vc,
    displayVC: vc - device.confDisplayYStart,
    displayVC_wide,
    vc_valid,
    clippedByVertical,
    baseYOffset: y << 8  // For 320×256: offset = (x << 8) | y
  };
}
```

**Expected improvement**: ~15-20% reduction in per-pixel calculations

#### B. **Early Rejection for Clipped Scanlines**
Skip entire scanlines that are completely clipped:

```typescript
if (!scanlineState.vc_valid || scanlineState.clippedByVertical) {
  // Entire scanline is clipped - skip rendering
  return transparentOutput;
}
```

**Expected improvement**: ~30-40% speedup when large portions are clipped

#### C. **Optimized Memory Access with Prefetch Hints**
Batch memory reads and use sequential access patterns when possible:

```typescript
// For non-scrolled or minimally scrolled content:
if (device.layer2ScrollX === 0 && device.layer2ScrollY === 0) {
  // Use optimized sequential memory access path
  return renderLayer2ScanlineSequential(device, scanlineState);
}
```

**Expected improvement**: ~10-15% improvement for non-scrolled content

### Priority 2: Algorithmic Optimizations

#### D. **Lookup Table for X-Coordinate Wrapping**
Pre-calculate 320-pixel wrapping for all possible input values:

```typescript
// Module-level initialization
const xWrappingTable320 = new Uint16Array(1024); // Covers 0-1023 (with scroll)
for (let i = 0; i < 1024; i++) {
  let x = i;
  if (x >= 320 && x < 512) {
    const upper = ((x >> 6) & 0x7) + 3;
    x = (upper << 6) | (x & 0x3F);
  }
  xWrappingTable320[i] = x & 0x1FF;
}

// In rendering:
const x = xWrappingTable320[x_pre & 0x3FF];
```

**Expected improvement**: ~5-10% reduction in 320×256 mode overhead

#### E. **Bank Offset Caching**
Cache bank calculations for sequential pixel access:

```typescript
interface BankCache {
  lastOffset: number;
  lastBank8K: number;
  lastMemoryBase: number;
}

function getLayer2PixelCached(
  device: ILayer2RenderingState,
  cache: BankCache,
  offset: number
): number {
  // Check if we're in the same 8K segment
  if ((offset ^ cache.lastOffset) < 0x2000) {
    const offsetWithin8K = offset & 0x1FFF;
    return device.machine.memoryDevice.memory[cache.lastMemoryBase + offsetWithin8K] || 0;
  }
  
  // Recalculate and update cache
  const segment16K = (offset >> 14) & 0x07;
  const half8K = (offset >> 13) & 0x01;
  cache.lastBank8K = (bank16K + segment16K) * 2 + half8K;
  cache.lastMemoryBase = 0x040000 + cache.lastBank8K * 0x2000;
  cache.lastOffset = offset;
  
  return device.machine.memoryDevice.memory[cache.lastMemoryBase + (offset & 0x1FFF)] || 0;
}
```

**Expected improvement**: ~20-25% reduction in memory address calculation overhead

### Priority 3: Architecture Changes

#### F. **Tile-Based Rendering**
Divide screen into 32×32 or 64×64 tiles and process in batches:
- Better cache locality
- Opportunity for SIMD-style optimizations
- Can skip entirely transparent/clipped tiles

**Expected improvement**: ~25-35% improvement for complex scenes

#### G. **Dirty Rectangle Tracking**
Track which regions have changed since last frame:
- Skip rendering unchanged tiles
- Particularly effective when Layer 2 content is static

**Expected improvement**: Up to 80-90% for static content, ~10-20% for animated content

#### H. **Separate Fast Paths for Common Cases**

```typescript
export function renderLayer2_320x256Pixel(...) {
  // Fast path: No scrolling, no clipping, standard bank layout
  if (isOptimizedPath(device)) {
    return renderLayer2_320x256_FastPath(device, vc, hc, cell);
  }
  
  // General path: Full feature support
  return renderLayer2_320x256_GeneralPath(device, vc, hc, cell);
}

function isOptimizedPath(device: ILayer2RenderingState): boolean {
  return device.layer2ScrollX === 0 &&
         device.layer2ScrollY === 0 &&
         device.layer2ClipWindowX1 === 0 &&
         device.layer2ClipWindowX2 === 319 &&
         device.layer2ClipWindowY1 === 0 &&
         device.layer2ClipWindowY2 === 255;
}
```

**Expected improvement**: ~40-50% for unscrolled, unclipped content

## Implementation Priority

### Phase 1 (Immediate - Low Hanging Fruit)
1. ✅ Scanline-based state precomputation (Priority 1A)
2. ✅ Early scanline rejection (Priority 1B)
3. ✅ X-wrapping lookup table (Priority 2D)

**Target**: 25-30% overall improvement

### Phase 2 (Near Term)
4. ✅ Bank offset caching (Priority 2E)
5. ✅ Optimized memory access for non-scrolled content (Priority 1C)
6. ✅ Fast path for common cases (Priority 3H)

**Target**: Additional 20-25% improvement (50-55% cumulative)

### Phase 3 (Future Enhancements)
7. ⬜ Tile-based rendering (Priority 3F)
8. ⬜ Dirty rectangle tracking (Priority 3G)
9. ⬜ SIMD/WebAssembly optimizations

**Target**: Additional 30-40% improvement (80-95% cumulative vs. baseline)

## Measurement and Validation

### Benchmarking Approach
1. Create test scenes:
   - Static full-screen Layer 2 (best case)
   - Scrolling Layer 2 content (common case)
   - Mixed content with clipping (worst case)

2. Measure metrics:
   - Frame rendering time (ms per frame)
   - Pixels rendered per second
   - Memory bandwidth usage
   - Cache miss rate (if available)

3. Validation:
   - Compare rendered output pixel-by-pixel with reference
   - Run existing test suite
   - Test on actual ZX Spectrum Next demo content

### Success Criteria
- Maintain 50 FPS for 50Hz mode on mid-range hardware
- Maintain 60 FPS for 60Hz mode on mid-range hardware
- Zero visual regressions
- No additional memory allocation per frame

## Notes and Considerations

### Trade-offs
- **Memory vs Speed**: Lookup tables increase memory usage but reduce computation
- **Code Complexity**: Specialized fast paths increase code size but improve performance
- **Maintainability**: Must keep optimized and reference paths in sync

### Compatibility
- All optimizations must produce identical output to current implementation
- VHDL accuracy must be preserved
- Edge cases (wraparound, clipping) must behave identically

### Future Considerations
- WebGL/GPU-based rendering for ultimate performance
- Web Workers for parallel scanline rendering
- WebAssembly for computational hotspots
- OffscreenCanvas for background rendering

## References
- ZX Spectrum Next VHDL sources: `layer2.vhd`, `zxula_timing.vhd`
- Current implementation: `Layer2Matrix.ts`, `NextComposedScreenDevice.ts`
- ULA rendering optimizations: `UlaMatrix.ts` (similar patterns applicable)
