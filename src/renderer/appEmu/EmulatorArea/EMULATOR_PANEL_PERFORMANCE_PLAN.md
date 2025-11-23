# EmulatorPanel Performance Improvement Plan

## Overview
This document outlines a comprehensive performance optimization strategy for the `EmulatorPanel.tsx` component, which handles the core emulation display, input handling, audio rendering, and state management.

## Current Performance Issues

### 1. **Global State Management & Excessive Re-renders**
**Issue**: Multiple global state variables and refs with loose coupling
- `machineStateHandlerQueue` and `machineStateProcessing` are module-level globals that persist across component lifecycles
- Multiple `useSelector` calls for different pieces of state can cause re-renders even when irrelevant state changes
- Global `currentDialogId`, `savedPixelBuffer` pollute the module scope

**Impact**: Medium - Can cause memory leaks and stale closures across component remounts

---

### 2. **Canvas Context Retrieval in Every Frame**
**Issue**: `applyScanlineEffect()` and `displayScreenData()` retrieve canvas 2D contexts repeatedly
```tsx
const shadowCtx = shadowScreenEl.getContext("2d", { willReadFrequently: true });
const screenCtx = screenEl.getContext("2d", { willReadFrequently: true });
```

**Impact**: High - `getContext()` is not free; caching the context would eliminate this overhead

**Solution Priority**: HIGH

---

### 3. **Pixel Buffer Processing is Inefficient**
**Issue**: In `displayScreenData()`:
- Retrieves entire pixel buffer from machine every frame
- Performs manual array copy with loop: `pixelData.current[j++] = screenData[i]`
- Creates `Uint8Array` view that's copied element-by-element to shadow canvas

**Impact**: High - Core frame rendering path runs at 50+ FPS; optimization here has significant impact

**Optimization Ideas**:
- Use `set()` method instead of manual loop for buffer copying
- Consider using `ArrayBuffer` directly if possible
- Cache the offset/length calculations

---

### 4. **Scanline Effect Processing is Expensive**
**Issue**: `applyScanlineEffect()` performs heavy operations:
- Calls `ctx.getImageData()` to read back pixels (GPU→CPU transfer, very slow)
- Iterates through entire pixel buffer to adjust alpha
- Multiple conditional branches per pixel in tight loop
- `ctx.putImageData()` transfers data back (CPU→GPU, slow)

**Impact**: Very High - This is a readback operation (one of the most expensive GPU operations)

**Optimization Ideas**:
- Use WebGL/GPU-accelerated scanline effect instead of CPU processing
- Cache scanline intensity calculation results
- Use `requestAnimationFrame` batching for scanline updates
- Consider pre-computing scanline patterns as textures
- Only update scanlines when the effect setting changes, not every frame
- Use worker threads for heavy pixel processing

---

### 5. **Excessive Effect Hook Dependencies**
**Issue**: Multiple `useEffect` hooks with complex dependency tracking:
- `useEffect` for scanline effect changes re-renders even if only the setting changed
- Shadow screen useEffect runs when settings change but doesn't properly memoize

**Impact**: Medium - Causes unnecessary re-renders and state recalculations

---

### 6. **Event Listener Attachments**
**Issue**: Keyboard event listeners
```tsx
window.addEventListener("keydown", _handleKeyDown);
window.addEventListener("keyup", _handleKeyUp);
```
- `_handleKeyDown` and `_handleKeyUp` are recreated on every render
- Event listeners depend on `hostElement.current` but use global window

**Impact**: Low - Listeners properly cleaned up but can be optimized

---

### 7. **Shadow Canvas Unnecessary Operations**
**Issue**: Shadow canvas is hidden but being updated every frame
- Shadow canvas is marked with `display: none` but still maintains pixel data
- Two canvas contexts being managed and updated synchronously

**Impact**: Medium - GPU memory and bandwidth for invisible canvas

**Consider**: Is shadow canvas truly necessary for scanline effect?

---

### 8. **Memory Allocations in Hot Path**
**Issue**: `applyScanlineEffect()` calls `getImageData()` which allocates new ImageData
- Happens in every frame when scanline effect is enabled
- `ImageData` allocation and pixel data copying is expensive

**Impact**: High when scanline effect is active

---

## Optimization Priority Matrix

| Priority | Issue | Impact | Effort | Estimated Gain |
|----------|-------|--------|--------|-----------------|
| **CRITICAL** | Scanline GPU readback in hot path | Very High | Medium | 30-40% FPS improvement |
| **HIGH** | Canvas context caching | High | Low | 10-15% FPS improvement |
| **HIGH** | Pixel buffer copy inefficiency | High | Low | 5-10% FPS improvement |
| **MEDIUM** | Global state persistence | Medium | Medium | 5% improvement + stability |
| **MEDIUM** | useEffect optimization | Medium | Low | 2-5% re-render reduction |
| **LOW** | Keyboard event optimization | Low | Low | 1-2% improvement |
| **RESEARCH** | Shadow canvas architecture | Medium | High | TBD |

---

## Recommended Implementation Plan

### Phase 1: Quick Wins (Low Effort, High Impact)
1. **Cache canvas 2D contexts** in refs instead of retrieving every frame
   - Move `getContext()` calls to setup/reset functions
   - File: `EmulatorPanel.tsx` - `displayScreenData()` function

2. **Optimize pixel buffer copying**
   - Replace manual loop with `pixelData.current.set(screenData.subarray(startIndex, endIndex))`
   - File: `EmulatorPanel.tsx` - `displayScreenData()` function

3. **Memoize scanline intensity calculation**
   - Create a ref to cache the calculated `scanlineDarkening` value
   - Only recalculate when setting changes
   - File: `EmulatorPanel.tsx` - `applyScanlineEffect()` function

### Phase 2: Medium-Effort Optimizations
4. **Isolate scanline effect into separate memoized component**
   - Extract `ScanlineOverlay` component that only re-renders when scanline setting changes
   - Wrap with `React.memo()` and custom comparison
   - File: Create `ScanlineOverlay.tsx`

5. **Optimize state selectors**
   - Use `useShallow()` or similar to prevent re-renders from unrelated state changes
   - Combine related selectors into single objects
   - File: `EmulatorPanel.tsx` - selector calls

6. **Encapsulate global state in a ref or context**
   - Move `machineStateHandlerQueue`, `machineStateProcessing`, etc. into a state object
   - Prevents memory leaks from multiple component mounts
   - File: `EmulatorPanel.tsx` - top-level globals

### Phase 3: Major Architectural Changes (High Effort, High Impact)
7. **Migrate scanline effect to GPU (WebGL/Canvas Filters)**
   - Use CSS filters or WebGL for scanline rendering
   - Eliminates CPU readback (`getImageData`)
   - Potential 30-40% performance gain
   - File: New `GpuScanlineEffect.ts` utility

8. **Evaluate shadow canvas necessity**
   - Profile whether shadow canvas is necessary
   - Consider direct rendering to main canvas
   - File: Review rendering pipeline

9. **Worker thread for pixel processing**
   - Move heavy pixel operations to worker thread
   - Non-blocking pixel buffer transfers
   - File: New `PixelProcessor.worker.ts`

---

## Metrics to Track

### Before Optimization
- [ ] Frame rate (target: maintain 50+ FPS)
- [ ] Frame time variance
- [ ] GPU memory usage (canvas textures)
- [ ] CPU time in `displayScreenData()`
- [ ] CPU time in `applyScanlineEffect()`
- [ ] Re-render frequency during emulation

### After Optimization
- [ ] Frame rate improvement %
- [ ] Frame time consistency
- [ ] Memory savings
- [ ] CPU time reduction %
- [ ] GPU operations reduction

---

## Code Sections to Review

1. **displayScreenData()** - Lines 530-575
   - Primary rendering function called 50+ times per second
   - Bottleneck for pixel operations

2. **applyScanlineEffect()** - Lines 450-530
   - GPU readback operation (very expensive)
   - Loop over entire pixel buffer

3. **machineFrameCompleted()** - Lines 340-395
   - Called on every frame
   - Calls `displayScreenData()` frequently

4. **Module-level globals** - Lines 29-35
   - Global state that persists across remounts
   - `machineStateHandlerQueue`, `machineStateProcessing`

5. **useEffect hooks** - Lines 130-210
   - 8 separate useEffect hooks
   - Some with overly broad dependencies

---

## Testing Strategy

1. **Performance profiling before changes**
   - Use Chrome DevTools Performance tab
   - Record 10-second emulation session
   - Measure frame timing and task duration

2. **Unit tests for optimized functions**
   - Pixel buffer copying correctness
   - Scanline effect visual output
   - State handling during controller changes

3. **Integration tests**
   - Emulation stability with optimizations
   - No visual artifacts
   - Audio synchronization preserved

4. **Regression testing**
   - Full test suite pass
   - E2E tests for emulation workflows

---

## Implementation Checklist

- [x] Phase 1 complete
  - [x] Canvas context caching
  - [x] Pixel buffer optimization
  - [x] Scanline intensity memoization
- [x] Phase 2 complete
  - [x] ScanlineOverlay component extraction
  - [x] State selector optimization
  - [x] Global state encapsulation
- [x] Phase 3 complete
  - [x] GPU scanline effect
  - [x] Shadow canvas review & elimination
  - [ ] Worker thread implementation
- [ ] Performance metrics collected
- [ ] All tests passing
- [ ] Code review completed
- [ ] Merged to main

---

## Notes

- Prioritize Phase 1 quick wins first - they have minimal risk and high impact
- Profile continuously to validate assumptions about bottlenecks
- Consider using React.memo() strategically but avoid premature optimization
- GPU operations should be preferred over CPU pixel manipulation
- Watch for memory leaks with refs and event listeners during cleanup
