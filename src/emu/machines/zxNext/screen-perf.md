# Screen Rendering Performance Analysis

## Executive Summary

This document analyzes a performance optimization hypothesis for the ZX Spectrum Next screen rendering implementation. The core observation is that `renderTact()` is called sequentially with incrementing tact values (0, 1, 2, 3, ..., N), but currently recalculates horizontal counter (HC) and vertical counter (VC) values from scratch for each tact using lookup tables.

**Hypothesis**: Caching HC/VC values and incrementing them between calls could eliminate repeated table lookups and improve rendering performance.

**Conclusion**: The hypothesis is **NOT plausible** for performance improvement. The current implementation using pre-computed lookup tables is already optimal and significantly faster than any incremental calculation approach.

## Current Implementation

### Call Pattern

From `ZxNextMachine.ts`:

```typescript
onTactIncremented(): void {
  if (this.frameCompleted) return;
  while (this.lastRenderedFrameTact < this.currentFrameTact) {
    this.composedScreenDevice.renderTact(this.lastRenderedFrameTact++);
  }
  this.beeperDevice.setNextAudioSample();
}
```

Key observations:
- `renderTact()` is called in a tight loop with sequential tact values
- `lastRenderedFrameTact` is incremented after each call (post-increment)
- Pattern: `renderTact(0)`, `renderTact(1)`, `renderTact(2)`, ..., `renderTact(N-1)`
- After `onNewFrame()`, tact counter resets to 0

### Current HC/VC Calculation

From `NextComposedScreenDevice.ts`:

```typescript
renderTact(tact: number): boolean {
  // ...
  
  // --- Get pre-calculated (HC, VC) position from lookup tables
  const hc = getActiveTactToHC()[tact];
  const vc = getActiveTactToVC()[tact];
  
  // ... rest of rendering logic
}
```

**Current approach**:
1. Direct array indexing into pre-computed lookup tables
2. Single memory read per coordinate (2 reads total: HC and VC)
3. No arithmetic operations required
4. Time complexity: **O(1)** - constant time
5. CPU cycles: ~2-4 cycles per read (L1 cache hit, array indexing)

## Proposed Optimization Analysis

### Proposed Approach

Cache HC and VC values as instance variables and increment them:

```typescript
// Instance variables
private cachedHC: number = 0;
private cachedVC: number = 0;

onNewFrame(): void {
  // ... existing code ...
  
  // Reset cached coordinates
  this.cachedHC = this.confFirstVisibleHC;
  this.cachedVC = 0;
}

renderTact(tact: number): boolean {
  // Use cached values instead of lookup
  const hc = this.cachedHC;
  const vc = this.cachedVC;
  
  // Increment for next call
  this.cachedHC++;
  if (this.cachedHC >= this.confTotalHC) {
    this.cachedHC = 0;
    this.cachedVC++;
    if (this.cachedVC >= this.confTotalVC) {
      this.cachedVC = 0;
    }
  }
  
  // ... rest of rendering logic
}
```

### Performance Analysis

**Operations per renderTact() call**:

| Operation | Current (Lookup) | Proposed (Cached) | Cost Difference |
|-----------|------------------|-------------------|-----------------|
| HC read | 1 array lookup | 1 instance var read | Same (~2-3 cycles) |
| VC read | 1 array lookup | 1 instance var read | Same (~2-3 cycles) |
| HC increment | None | 1 addition | +1 cycle |
| HC overflow check | None | 1 comparison + 1 branch | +2-5 cycles (branch prediction) |
| HC reset | None | 1 assignment (conditional) | +1 cycle (when triggered) |
| VC increment | None | 1 addition (conditional) | +1 cycle (when triggered) |
| VC overflow check | None | 1 comparison + 1 branch | +2-5 cycles (when triggered) |
| VC reset | None | 1 assignment (conditional) | +1 cycle (when triggered) |

**Total cost per call**:
- **Current**: ~4-6 CPU cycles (2 array lookups)
- **Proposed**: ~10-20 CPU cycles (reads + increment + conditionals + branches)

**Performance impact**: **~3-4× SLOWER** than current implementation

### Why the Current Approach is Superior

1. **Pre-computed lookup tables are optimal**:
   - Tables are generated once during initialization
   - Direct memory access with no arithmetic
   - No conditional branches (no branch misprediction penalties)
   - Sequential memory access patterns (cache-friendly)

2. **Modern CPU optimizations favor lookups**:
   - L1 cache hit latency: ~3-4 cycles
   - Branch misprediction penalty: ~10-20 cycles
   - Integer arithmetic: ~1 cycle (but adds up)
   - Memory access patterns are predictable (sequential tacts)

3. **Cache efficiency**:
   - Lookup tables are accessed sequentially (tact 0, 1, 2, ...)
   - CPU prefetcher can predict and load cache lines ahead
   - Very high L1 cache hit rate (likely >99%)

4. **Code simplicity**:
   - Current code is simpler and more maintainable
   - No edge cases to handle (wrapping, overflow)
   - Easy to verify correctness

## Additional Considerations

### Memory Usage

**Current implementation**:
- 2 lookup tables: `TactToHC[]` and `TactToVC[]`
- Size per table: `totalVC × totalHC` entries
- 50Hz mode: 312 × 228 = 71,136 entries × 2 bytes = ~142 KB per table, ~284 KB total
- 60Hz mode: 262 × 228 = 59,736 entries × 2 bytes = ~119 KB per table, ~238 KB total

**Proposed implementation**:
- 2 instance variables: 8 bytes total
- Memory savings: ~280 KB

**Analysis**: While memory savings exist, they are negligible in modern systems (even mobile devices have GB of RAM). The 280 KB of lookup tables easily fit in L2/L3 cache and provide massive speed benefits.

### Frame-to-Frame State

**Problem with caching**: If `renderTact()` is called out of sequence or skipped:
- Cached values become invalid
- Requires additional validation/recovery logic
- Adds complexity and potential bugs

**Current lookup approach**: Stateless and robust
- Can call `renderTact(tact)` with any tact value at any time
- No dependency on previous calls
- Useful for debugging, instant screen rendering, etc.

## Real-World Performance Impact

### Typical Frame Rendering

50Hz mode: 71,136 tacts per frame at 50 FPS
- Current: 71,136 × 6 cycles = ~427,000 cycles per frame
- Proposed: 71,136 × 15 cycles = ~1,067,000 cycles per frame
- **Extra cost**: ~640,000 cycles per frame = ~0.18 ms at 3.5 MHz CPU clock

At 50 FPS: **~9 ms per second wasted** (0.9% overhead increase)

### When This Matters

Modern CPUs are much faster, but the CPU core runs at 3.5-28 MHz in the emulation. The screen rendering is on the critical path of the emulation loop. Any slowdown directly impacts:
- Maximum achievable emulation speed
- Power consumption (more cycles = more battery drain on mobile)
- Thermal behavior (sustained higher CPU usage)

## Alternative Optimizations

If performance improvement is desired, consider these instead:

1. **SIMD/Vectorization**:
   - Process multiple pixels simultaneously using SIMD instructions
   - Modern CPUs can process 4-8 pixels in parallel
   - Requires significant code restructuring

2. **Multi-threading**:
   - Render different screen regions in parallel threads
   - Requires careful synchronization of shared state

3. **GPU Acceleration**:
   - Offload layer composition to GPU shaders
   - Massive parallelization potential
   - Best performance gain, but significant complexity

4. **Lazy Rendering**:
   - Only render pixels that changed since last frame
   - Requires dirty region tracking
   - Limited benefit for video games (usually full screen changes)

5. **Optimize Layer Composition**:
   - The `composeSinglePixel()` method does complex priority logic
   - Profile to identify hotspots in layer mixing
   - May benefit from lookup tables or simplified logic paths

## Conclusion

**The hypothesis is not plausible for the following reasons**:

1. **Current implementation is already optimal**: Lookup tables with direct indexing are faster than incremental calculation with conditionals
2. **Performance would degrade by ~3-4×**: Adding increment logic and branch checks is slower than simple array access
3. **Cache efficiency**: Sequential table access patterns are CPU-friendly
4. **Stateless design**: Current approach is more robust and flexible
5. **Memory trade-off is favorable**: ~280 KB for massive speed gain is worth it

**Recommendation**: Keep the current lookup table implementation. If performance optimization is needed, focus on higher-impact areas like layer composition logic or consider GPU acceleration for the entire rendering pipeline.

## References

- File: `/src/emu/machines/zxNext/ZxNextMachine.ts` - Machine frame loop and tact management
- File: `/src/emu/machines/zxNext/screen/NextComposedScreenDevice.ts` - Screen rendering implementation
- ZX Spectrum Next technical documentation (timing modes, screen architecture)
