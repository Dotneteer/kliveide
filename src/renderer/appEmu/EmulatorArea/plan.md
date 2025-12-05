# EmulatorPanel.tsx Simplification Plan

## Current State Analysis
The EmulatorPanel component is well-optimized after recent refactoring:
- ✅ Single canvas architecture (eliminated shadow canvas)
- ✅ Canvas context and ImageData caching
- ✅ Optimized pixel copy with TypedArray operations
- ✅ Event handler memoization with useCallback
- ✅ Module-level state moved to component refs

## Simplification Opportunities

### 1. Remove Unused shadowScreenElement Reference
**Current**: `shadowScreenElement` ref is declared but never used (legacy from two-canvas architecture)
**Impact**: Low - minor cleanup
**Fix**: Remove the unused ref declaration
```typescript
const shadowScreenElement = useRef<HTMLCanvasElement>(); // REMOVE THIS
```
**Lines affected**: Line 42, Line 421 (in calculateDimensions)

### 2. Consolidate getTempCanvas and scanlineEffect Temporary Canvas
**Current**: Two places create temporary canvases:
  - `getTempCanvas()` in EmulatorPanel.tsx
  - `applyScanlineEffectToCanvas()` creates its own temp canvas in scanlineEffect.ts
**Impact**: Medium - reduces canvas allocations
**Fix**: Pass the temp canvas from EmulatorPanel to scanlineEffect function
**Benefit**: Reuses single cached temp canvas instead of creating new ones

### 3. Extract getScanlineDarkening to Shared Module
**Current**: `getScanlineDarkening()` duplicated in both files:
  - EmulatorPanel.tsx (line 534)
  - scanlineEffect.ts (line 11)
**Impact**: Low - DRY principle, easier maintenance
**Fix**: Keep only in scanlineEffect.ts, import where needed

### 4. Simplify renderInstantScreen Wrapper
**Current**: Single-line wrapper function that just calls controller method
**Impact**: Low - reduces indirection
**Fix**: Call `controller?.machine?.renderInstantScreen()` directly where needed
```typescript
// Current wrapper (line 127)
const renderInstantScreen = (savedPixelBuffer?: Uint32Array) => {
  return controller?.machine?.renderInstantScreen(savedPixelBuffer);
};
```

### 5. Simplify calculateDimensions Logic
**Current**: References shadowScreenElement that no longer exists in DOM
**Impact**: Low - removes dead code
**Fix**: Remove the shadowScreenElement.current assignment (lines 419-422)
```typescript
if (shadowScreenElement.current) {
  shadowScreenElement.current.width = width;
  shadowScreenElement.current.height = height;
}
```

### 6. Extract Disk Change Handler
**Current**: Nested function `saveDiskChanges` inside `machineFrameCompleted`
**Impact**: Low - better code organization
**Fix**: Move to top-level component function
```typescript
// Currently nested at line 389
async function saveDiskChanges(diskIndex: number, changes: SectorChanges): Promise<void> {
  // ...
}
```

### 7. Consolidate Pause Overlay Logic
**Current**: `setPauseOverlay()` repeated in multiple locations with similar patterns
**Impact**: Medium - reduces duplication
**Locations**: 
  - Line 132 (setPauseOverlay function)
  - Line 197 (useEffect)
  - Line 206 (useEffect)  
  - Line 308 (machineStateChanged)
**Fix**: Create unified `handlePauseState()` function that encapsulates overlay + screen rendering

### 8. Simplify tempCtxRef
**Current**: `tempCtxRef` declared but never used
**Impact**: Low - cleanup
**Fix**: Remove unused ref (line 85)

### 9. Extract Screen Rendering Path Selection
**Current**: Complex conditional logic in displayScreenData for scanline on/off
**Impact**: Medium - improves readability
**Fix**: Split into `renderWithoutScanlines()` and `renderWithScanlines()` helper functions

## Priority Order
1. **High**: Remove unused refs (#1, #8) - immediate cleanup
2. **High**: Remove dead code in calculateDimensions (#5) - prevents confusion
3. **Medium**: Consolidate temporary canvas creation (#2) - performance
4. **Medium**: Extract getScanlineDarkening duplication (#3) - DRY
5. **Medium**: Consolidate pause overlay logic (#7) - reduces duplication
6. **Low**: Extract disk change handler (#6) - organization
7. **Low**: Simplify renderInstantScreen wrapper (#4) - readability
8. **Low**: Extract screen rendering path selection (#9) - readability

## Implementation Notes
- Start with cleanup items (#1, #5, #8) as they have no dependencies
- Then address duplication (#3, #7)
- Finally refactor for readability (#2, #4, #6, #9)
- Test after each change to ensure no flickering is reintroduced
