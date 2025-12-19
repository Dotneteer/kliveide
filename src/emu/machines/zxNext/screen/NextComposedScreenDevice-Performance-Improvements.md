# NextComposedScreenDevice Performance Optimization Analysis

**Date:** December 19, 2025  
**Context:** The `renderTact()` method is called 100,000+ times per frame (50Hz: ~141,816 times, 60Hz: ~120,384 times) and represents the critical bottleneck in screen rendering performance.

---

## 🎯 Executive Summary

Key findings:
- **High-frequency operations** need aggressive optimization
- **Branch prediction** can be improved through restructuring
- **Pre-calculation opportunities** exist for mode-dependent data
- **Memory access patterns** can be optimized
- **Layer composition logic** contains redundant operations

Estimated performance gain: **30-50% improvement** with combined optimizations.

---

## 📊 Current Bottleneck Analysis

### Critical Path (executed 100,000+ times per frame):

```typescript
renderTact(tact) {
  1. Interrupt check                    // 2 comparisons
  2. Blanking check                     // 1 array lookup + comparison
  3. HC/VC calculation                  // 1 modulo + 1 division
  4. Layer mode checks                  // Multiple conditional branches
  5. Array lookups per layer            // 1-5 array accesses
  6. Render methods per layer           // 1-5 function calls
  7. ULA/Tilemap merging                // Complex conditional logic
  8. Bitmap coordinate calculation      // 2 subtractions + 1 multiplication
  9. Pixel composition (×2)             // Complex switch statement
  10. Bitmap writes (×2)                // 2 array writes
}
```

### Performance Issues Identified:

1. **Repeated HC/VC calculations** (modulo/division are expensive)
2. **Redundant layer mode checks** every tact (modes rarely change)
3. **Switch statements in hot path** (composeSinglePixel)
4. **Multiple conditional branches** (layer enabled checks)
5. **Function call overhead** (render methods)
6. **Repeated config property access** (this.config.*)
7. **Array bounds check overhead** (bitmapY checks)

---

## 🚀 Optimization Strategies

### 1. **Pre-calculate Mode-Dependent Dispatch Tables** ⭐⭐⭐⭐⭐

**Problem:** Layer mode checks and array selections happen every tact.

**Solution:** Create dispatch function tables when registers change:

```typescript
// Add to class properties
private _renderUlaFunc: (vc: number, hc: number, tact: number) => [LayerOutput, LayerOutput];
private _renderLayer2Func: (vc: number, hc: number, tact: number) => [LayerOutput, LayerOutput];
private _renderTilemapFunc: (vc: number, hc: number, tact: number) => [LayerOutput, LayerOutput];

// Pre-calculate on register change
private updateRenderingFunctions(): void {
  // ULA mode selection
  if (this.loResEnabled) {
    this._renderUlaFunc = this._renderLoResMode;
  } else if (this.disableUlaOutput) {
    this._renderUlaFunc = this._renderDisabledMode;
  } else if (this.ulaHiResMode) {
    this._renderUlaFunc = this._renderUlaHiResMode;
  } else if (this.ulaHiColorMode) {
    this._renderUlaFunc = this._renderUlaHiColorMode;
  } else {
    this._renderUlaFunc = this._renderUlaStandardMode;
  }

  // Layer2 mode selection
  switch (this.layer2Resolution) {
    case 0: this._renderLayer2Func = this._renderLayer2_256x192; break;
    case 1: this._renderLayer2Func = this._renderLayer2_320x256; break;
    case 2: this._renderLayer2Func = this._renderLayer2_640x256; break;
  }

  // Similar for tilemap...
}

// In renderTact():
const [ulaOutput1, ulaOutput2] = this._renderUlaFunc(vc, hc, tact);
```

**Estimated Gain:** 15-20% (eliminates branch mispredictions)

---

### 2. **Cache HC/VC Calculation in Pre-generated Table** ⭐⭐⭐⭐⭐

**Problem:** `hc = tact % 456` and `vc = tact / 456` are expensive operations.

**Solution:** Pre-generate lookup tables:

```typescript
// Add to class
private _tactToHC: Uint16Array;  // [tact] -> HC
private _tactToVC: Uint16Array;  // [tact] -> VC

// Generate once per timing mode
private generateTactLookupTables(config: TimingConfig): void {
  const totalTacts = config.totalVC * config.totalHC;
  this._tactToHC = new Uint16Array(totalTacts);
  this._tactToVC = new Uint16Array(totalTacts);
  
  for (let tact = 0; tact < totalTacts; tact++) {
    this._tactToHC[tact] = tact % config.totalHC;
    this._tactToVC[tact] = Math.floor(tact / config.totalHC);
  }
}

// In renderTact():
const hc = this._tactToHC[tact];
const vc = this._tactToVC[tact];
```

**Memory cost:** ~483 KB (241.5 KB × 2)  
**Estimated Gain:** 10-15% (eliminates modulo/division every tact)

---

### 3. **Pre-calculate Bitmap Coordinates Table** ⭐⭐⭐⭐

**Problem:** Bitmap coordinate calculation repeated every visible tact.

**Solution:** Pre-generate bitmap offset table:

```typescript
// Add to class
private _tactToBitmapOffset: Int32Array;  // [tact] -> bitmap offset (-1 if blanking)

// Generate once per timing mode
private generateBitmapOffsetTable(config: TimingConfig): void {
  const totalTacts = config.totalVC * config.totalHC;
  this._tactToBitmapOffset = new Int32Array(totalTacts);
  
  for (let tact = 0; tact < totalTacts; tact++) {
    const hc = tact % config.totalHC;
    const vc = Math.floor(tact / config.totalHC);
    const bitmapY = vc - config.firstBitmapVC;
    
    if (bitmapY >= 0 && bitmapY < BITMAP_HEIGHT) {
      const bitmapXBase = (hc - config.firstVisibleHC) * 2;
      this._tactToBitmapOffset[tact] = bitmapY * BITMAP_WIDTH + bitmapXBase;
    } else {
      this._tactToBitmapOffset[tact] = -1; // Out of bounds
    }
  }
}

// In renderTact():
const bitmapOffset = this._tactToBitmapOffset[tact];
if (bitmapOffset >= 0) {
  this._pixelBuffer[bitmapOffset] = pixelRGBA1;
  this._pixelBuffer[bitmapOffset + 1] = pixelRGBA2;
}
```

**Memory cost:** ~483 KB  
**Estimated Gain:** 5-8% (eliminates arithmetic and bounds checks)

---

### 4. **Optimize composeSinglePixel with Function Pointers** ⭐⭐⭐⭐

**Problem:** Switch statement on `layerPriority` executed twice per tact.

**Solution:** Pre-generate composition function based on priority:

```typescript
// Add to class
private _composePixelFunc: (
  ula: LayerOutput,
  layer2: LayerOutput,
  sprites: LayerOutput
) => number;

// Generate 8 specialized composition functions
private updateCompositionFunction(): void {
  switch (this.layerPriority) {
    case 0: this._composePixelFunc = this._composeSLU; break;
    case 1: this._composePixelFunc = this._composeLSU; break;
    case 2: this._composePixelFunc = this._composeSUL; break;
    case 3: this._composePixelFunc = this._composeLUS; break;
    case 4: this._composePixelFunc = this._composeUSL; break;
    default: this._composePixelFunc = this._composeULS; break;
  }
}

// Create specialized versions (no switch/if inside)
private _composeSLU(ula: LayerOutput, layer2: LayerOutput, sprites: LayerOutput): number {
  // Layer 2 priority override
  if (layer2?.priority && !layer2.transparent) {
    return 0xff000000 | layer2.rgb;
  }
  // Inline priority: Sprites -> Layer2 -> ULA
  if (sprites && !sprites.transparent) return 0xff000000 | sprites.rgb;
  if (layer2 && !layer2.transparent) return 0xff000000 | layer2.rgb;
  if (ula && !ula.transparent) return 0xff000000 | ula.rgb;
  
  // Fallback (pre-calculated)
  return this._fallbackRGBA;
}

// Pre-calculate fallback RGBA
private _fallbackRGBA: number;
private updateFallbackColor(): void {
  const blueLSB = (this.fallbackColor & 0x02) | (this.fallbackColor & 0x01);
  this._fallbackRGBA = 0xff000000 | ((this.fallbackColor << 1) | blueLSB);
}
```

**Estimated Gain:** 8-12% (eliminates branch mispredictions in hot path)

---

### 5. **Inline Small Render Methods** ⭐⭐⭐

**Problem:** Function call overhead for layer rendering methods.

**Solution:** For simple cases, inline directly in renderTact:

```typescript
// Instead of calling renderSpritesPixel():
if (this.spritesEnabled) {
  const spritesCell = this._renderingFlagsSprites[tact];
  // Inline simple sprite rendering logic here
  // Only call function for complex cases
}
```

**Estimated Gain:** 3-5% (reduces call stack overhead)

---

### 6. **Cache Config Properties Locally** ⭐⭐⭐

**Problem:** Repeated `this.config.property` access adds overhead.

**Solution:** Cache frequently-used config values:

```typescript
// Add to class
private _cachedTotalHC: number;
private _cachedFirstBitmapVC: number;
private _cachedFirstVisibleHC: number;
private _cachedIntStartTact: number;
private _cachedIntEndTact: number;

// Update on frame/config change
private cacheConfigValues(): void {
  this._cachedTotalHC = this.config.totalHC;
  this._cachedFirstBitmapVC = this.config.firstBitmapVC;
  this._cachedFirstVisibleHC = this.config.firstVisibleHC;
  this._cachedIntStartTact = this.config.intStartTact;
  this._cachedIntEndTact = this.config.intEndTact;
}

// In renderTact():
this._pulseIntActive = tact >= this._cachedIntStartTact && tact < this._cachedIntEndTact;
```

**Estimated Gain:** 2-4% (reduces property lookup overhead)

---

### 7. **Optimize ULA Rendering with Specialized Paths** ⭐⭐⭐⭐

**Problem:** `renderULAStandardPixel()` contains many conditional checks.

**Solution:** Split into specialized versions:

```typescript
// Create versions for common scenarios:
private renderULAStandardPixel_BorderOnly(...)    // Border region only
private renderULAStandardPixel_DisplayNoClip(...) // Display, no clipping
private renderULAStandardPixel_DisplayClip(...)   // Display with clipping
private renderULAStandardPixel_Flash(...)         // Flash enabled
private renderULAStandardPixel_NoFlash(...)       // Flash disabled

// Pre-select function based on frame state
```

**Estimated Gain:** 5-8% (reduces branches in most common path)

---

### 8. **Eliminate LayerOutput Object Allocations** ⭐⭐⭐⭐⭐

**Problem:** Creating `LayerOutput` objects causes GC pressure and allocation overhead.

**Solution:** Use flat values instead:

```typescript
// Replace:
type LayerOutput = { rgb: number; transparent: boolean; clipped: boolean; priority?: boolean };

// With flat representation:
// - rgb: lower 9 bits
// - transparent: bit 9
// - clipped: bit 10
// - priority: bit 11
type PackedLayerOutput = number;

// Helper functions
function packLayerOutput(rgb: number, transparent: boolean, clipped: boolean, priority?: boolean): number {
  return rgb | 
         (transparent ? 0x200 : 0) | 
         (clipped ? 0x400 : 0) | 
         (priority ? 0x800 : 0);
}

function isTransparent(packed: number): boolean {
  return (packed & 0x200) !== 0;
}

function getRGB(packed: number): number {
  return packed & 0x1FF;
}
```

**Estimated Gain:** 10-15% (eliminates object allocations, improves cache locality)

---

### 9. **Batch Rendering for Identical Tacts** ⭐⭐

**Problem:** Border regions often have identical pixels.

**Solution:** Detect runs of identical pixels and batch-write:

```typescript
// Detect border runs and memset
if (isBorderRegion && !registersChanged) {
  // Fill multiple pixels with same border color
  const borderRGBA = this._cachedBorderRGBA;
  for (let i = 0; i < runLength; i++) {
    this._pixelBuffer[offset + i] = borderRGBA;
  }
  return runLength; // Skip ahead
}
```

**Estimated Gain:** 5-10% (for border-heavy frames)

---

### 10. **SIMD/WebAssembly for Pixel Composition** ⭐⭐⭐

**Problem:** JavaScript isn't optimal for tight loops with arithmetic.

**Solution:** Consider WebAssembly module for pixel composition:

```typescript
// Compile critical path to WASM
// - Layer composition
// - Color blending
// - Palette lookups
```

**Estimated Gain:** 20-40% (requires significant refactoring)

---

## 📋 Implementation Priority

### High Priority (Implement First):
1. ✅ **Pre-calculate HC/VC lookup tables** - Easy win, large impact
2. ✅ **Function pointer dispatch for modes** - Eliminates branch misprediction
3. ✅ **Optimize composeSinglePixel** - Hot path optimization
4. ✅ **Cache config properties** - Simple, consistent gain

### Medium Priority:
5. ⚠️ **Eliminate LayerOutput allocations** - Good gain, moderate complexity
6. ⚠️ **Pre-calculate bitmap offset table** - Memory/speed tradeoff
7. ⚠️ **Inline simple render methods** - Case-by-case basis

### Low Priority (Consider Later):
8. 🔵 **Batch render identical pixels** - Complex, situational benefit
9. 🔵 **WebAssembly compilation** - High effort, needs testing

---

## 🧪 Measurement Strategy

### Before Optimization:
```typescript
// Add profiling
const startTime = performance.now();
for (let tact = 0; tact < this.renderingTacts; tact++) {
  this.renderTact(tact);
}
const endTime = performance.now();
console.log(`Frame render: ${endTime - startTime}ms`);
```

### Metrics to Track:
- **Time per frame** (target: <16ms for 60 FPS)
- **Time per tact** (target: <150ns)
- **GC pauses** (minimize allocations)
- **Memory usage** (acceptable increase: <10 MB)

---

## 💾 Memory vs Speed Tradeoffs

| Optimization | Memory Cost | Speed Gain | Recommended |
|-------------|-------------|------------|-------------|
| HC/VC tables | ~483 KB | 10-15% | ✅ Yes |
| Bitmap offset table | ~483 KB | 5-8% | ✅ Yes |
| Function dispatch | <1 KB | 15-20% | ✅ Yes |
| Packed outputs | 0 KB | 10-15% | ✅ Yes |
| Specialized functions | ~20 KB | 5-10% | ⚠️ Maybe |

**Total estimated memory increase:** ~1 MB (acceptable for modern systems)

---

## 🔧 Register Change Management

Key insight: **Most registers change rarely** (once per frame or less).

### Create update hook system:

```typescript
// Track dirty flags
private _modeDirty: boolean = true;
private _priorityDirty: boolean = true;
private _paletteDirty: boolean = true;

// Update hook on register write
set layerPriority(value: number) {
  if (this._layerPriority !== value) {
    this._layerPriority = value;
    this._priorityDirty = true;
  }
}

// Rebuild caches at frame start (not per-tact)
onNewFrame(): void {
  if (this._modeDirty) {
    this.updateRenderingFunctions();
    this._modeDirty = false;
  }
  if (this._priorityDirty) {
    this.updateCompositionFunction();
    this._priorityDirty = false;
  }
  // ... other updates
}
```

---

## 📝 Code Structure Improvements

### Current renderTact structure:
```
if (loRes) { ... }
else if (!disableUla) {
  if (hiRes || hiColor) {
    if (hiRes) { ... }
    else { ... }
  }
  else { ... }
}
```

### Optimized structure:
```
// Pre-selected function pointer (no branches)
[output1, output2] = this._renderUlaFunc(vc, hc, tact);
```

---

## 🎁 Quick Wins (Low Effort, High Impact)

1. **Replace `Math.floor(tact / totalHC)` with `tact / totalHC | 0`**  
   → Integer division is faster with bitwise OR

2. **Hoist constant expressions out of loops**  
   → Move `config.property` reads outside renderTact where possible

3. **Use `!==` instead of `== false` or `!`**  
   → More explicit, potentially better optimization

4. **Pre-calculate border color RGBA once per frame**  
   → Avoid repeated palette lookups for border

5. **Use typed arrays throughout** (already done)  
   → Ensures JIT optimization

---

## 🔍 Advanced Optimization (Future)

### Scanline-based Rendering:
Instead of tact-by-tact, process entire scanlines when possible:
- Detect scanlines with no sprite activity
- Batch-process ULA/Layer2 pixels
- Reduces loop overhead

### Multi-threading (Web Workers):
- Render multiple scanlines in parallel
- Synchronize before composition
- Requires careful memory management

### GPU Acceleration (WebGL/WebGPU):
- Offload layer composition to GPU shaders
- Massive parallelism
- Complex integration with existing code

---

## 📚 References & Research

- [JavaScript Performance Tips](https://v8.dev/blog/elements-kinds)
- [TypedArray Performance](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Typed_arrays)
- [Branch Prediction in JavaScript](https://mrale.ph/blog/2015/01/11/whats-up-with-monomorphism.html)
- [WebAssembly Performance](https://hacks.mozilla.org/2018/01/making-webassembly-even-faster-firefoxs-new-streaming-and-tiering-compiler/)

---

## ✅ Action Items

### Phase 1 (Week 1):
- [ ] Implement HC/VC lookup tables
- [ ] Implement function dispatch for mode selection
- [ ] Cache config properties
- [ ] Measure baseline vs optimized performance

### Phase 2 (Week 2):
- [ ] Optimize composeSinglePixel with function pointers
- [ ] Eliminate LayerOutput allocations (packed format)
- [ ] Pre-calculate bitmap offset table
- [ ] Profile and measure improvements

### Phase 3 (Week 3):
- [ ] Fine-tune based on profiling results
- [ ] Consider inline optimizations
- [ ] Document performance characteristics
- [ ] Write unit tests for optimization correctness

---

## 🎯 Expected Results

**Conservative estimate:**
- Phase 1: 25-30% improvement
- Phase 2: Additional 15-20% improvement
- **Total: 40-50% faster rendering**

**Optimistic estimate:**
- With all optimizations: **50-70% improvement**
- Target achieved: **<10ms per frame at 50Hz** (current: ~15-20ms estimated)

This would enable smooth 60 FPS rendering with headroom for other emulation tasks.

---

**Document Version:** 1.0  
**Author:** GitHub Copilot  
**Review Status:** Draft - Ready for Implementation Planning
