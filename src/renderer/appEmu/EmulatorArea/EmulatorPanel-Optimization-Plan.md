# EmulatorPanel Optimization Plan - Comprehensive Analysis

## Current Architecture

### Component Structure
- **611 lines** of mixed concerns: rendering, input handling, state management, audio
- **Single canvas** (refactored from dual-canvas pattern)
- **React + Ref hybrid**: Optimized use of refs for display coordination
- **Direct pixel rendering**: Native resolution canvas with CSS scaling

### Current Optimizations (Implemented)
1. ✅ Canvas context caching
2. ✅ ImageData object reuse
3. ✅ Optimized pixel buffer transfer (TypedArray.set)
4. ✅ Selective canvas updates (with every() comparison)
5. ✅ RequestAnimationFrame synchronization
6. ✅ Machine change detection (hash-based)
7. ✅ Global state moved to component refs
8. ✅ Display renderer custom hook
9. ✅ Unified update scheduler
10. ✅ Consolidated dual-canvas to single canvas
11. ✅ Integer-multiplier canvas scaling (pixel-perfect)
12. ✅ Memoized key mapping merge (Phase 2)
13. ✅ Conditional canvas smoothing (Phase 2)
14. ✅ Smart pixel comparison (Phase 2)

---

## Analysis: Structure Issues

### 1. **Global Mutable State** (High Priority - Correctness)
**Location**: Lines 25-30
```typescript
let machineStateHandlerQueue = [];
let machineStateProcessing = false;
let currentDialogId = 0;
let savedPixelBuffer = null;
```

**Issues**:
- Module-level state creates memory leaks and state corruption across component instances
- If multiple EmulatorPanel instances exist, they'll share state
- Hard to debug and test
- `savedPixelBuffer` should be managed by component lifecycle

**Impact**: Memory leaks, incorrect behavior with multiple panels

**Solution**: Move to component state/refs with proper cleanup

### 2. **Excessive Ref Usage** (Medium Priority - Code Quality)
**Lines**: 74-81 (display buffers), 92-95 (key state)
```typescript
const shadowContext = useRef<...>()
const screenContext = useRef<...>()
const shadowImageData = useRef<...>()
const previousPixelData = useRef<...>()
const rafId = useRef<...>()
const pendingDisplayUpdate = useRef(false)
```

**Issues**:
- 10+ display-related refs create cognitive overhead
- No unified management or validation
- Refs don't participate in component lifecycle properly
- Makes it hard to track dependencies

**Solution**: Extract into custom hook `useDisplayManager()` to encapsulate logic

### 3. **Oversized Component** (Medium Priority - Maintainability)
**Line count**: 597 lines in single component

**Responsibilities**:
1. Display rendering (pixel buffers, canvas ops)
2. Input handling (keyboard events)
3. Machine state management
4. Audio rendering coordination
5. Disk I/O handling
6. Overlay management
7. Tool registry integration

**Solution**: Extract into smaller focused components and hooks:
- `useDisplayRenderer()` - Canvas rendering logic
- `useKeyboardInput()` - Key handling
- `useEmulatorState()` - Machine state coordination
- Smaller component for overlay

### 4. **Multiple Render Update Paths** (Low-Medium Priority)
**Lines**: 191, 197, 205, 222, 321, 346

Six different code paths call `scheduleDisplayUpdate()`:
- `useEffect` for instant screen
- `useEffect` for emuViewVersion
- `useResizeObserver` callback
- `machineStateChanged` (Paused state)
- `machineFrameCompleted` (periodic updates)
- Inline in return value's onClick

**Issues**:
- Hard to reason about when updates happen
- Multiple dependencies means potential race conditions
- No central update scheduler

**Solution**: Unified update coordinator that manages all update sources

---

## Performance Issues & Opportunities

### 1. **Unnecessary Comparisons in Pixel Change Detection** (Medium Impact)
**Current**: `every()` with arrow function callback
```typescript
hasChanges = !current.every((val, idx) => val === previous[idx]);
```

**Issues**:
- Creates closure for every element check
- Arrow function overhead even with early exit
- Comparing 256K+ pixels every frame (typical 320×256 screen)
- Previous snapshot created even for static screens

**Better Options**:
1. **Fast path**: Check if machine indicates dirty/changed regions
2. **Smart buffering**: Skip comparison on frames where machine hasn't changed
3. **Region-based tracking**: Only compare changed rectangles instead of whole buffer
4. **Threshold sampling**: Sample pixels instead of full comparison (for performance monitoring)

### 2. **Missing Machine Change Detection** (High Impact)
**Issue**: `displayScreenData()` called via `scheduleDisplayUpdate()` without checking if machine actually changed

**Current Flow**:
- Frame completed → scheduleDisplayUpdate → always compares all pixels
- No early exit for unchanged machines

**Optimization**:
- Ask machine if screen changed: `machine.hasScreenChanges?.()`
- Skip entire render pipeline if false

### 3. **Canvas Smoothing Set Every Frame** (Minor Performance)
**Lines**: 470, 551
```typescript
shadowCtx.imageSmoothingEnabled = false;
// ... later in branch:
screenCtx.imageSmoothingEnabled = false;
```

**Issue**: Set even if unchanged; property changes trigger GPU state updates

**Solution**: Cache setting state, only set if different

### 4. **RAF Deduplication Overhead** (Minor)
**Current**: pendingDisplayUpdate flag prevents duplicate RAF scheduling

**Trade-off**: 
- Good: Prevents frame skips and queue buildup
- Issue: Coalesces updates—losing granularity if different update sources arrive at different times

**Optimization**: May be acceptable as-is; profile to confirm

### 5. **Instant Screen Rendering Logic Duplication** (Code Quality)
**Lines**: 186-197, 208-213, 316-325

Three separate code paths for instant screen rendering with similar logic:
```typescript
if (showInstantScreen) {
  renderInstantScreen();
  scheduleDisplayUpdate();
}
```

**Solution**: Extract helper function `renderAndScheduleUpdate()`

### 6. **Key Mapping Re-merge on Every Change** (Low Impact)
**Lines**: 107-115, 136-139
```typescript
const updateKeyMappings = () => {
  if (!keyMappings) {
    currentKeyMappings.current = defaultKeyMappings.current;
  } else {
    currentKeyMappings.current = keyMappings.merge
      ? { ...defaultKeyMappings.current, ...keyMappings.mapping }
      : keyMappings.mapping;
  }
};
```

**Issue**: 
- Object spread `{...}` creates new object every time
- Called in useEffect whenever keyMappings changes
- For large key mapping objects, unnecessary allocation

**Solution**: 
- Use `useMemo` to memoize the mapping merge
- Only recalculate if actually needed

### 7. **Aspect Ratio Calculation Inefficiency** (Very Minor)
**Lines**: 153-160
```typescript
if (controller?.machine?.getAspectRatio) {
  const [ratX, ratY] = controller?.machine?.getAspectRatio();
  xRatio.current = ratX ?? 1;
  yRatio.current = ratY ?? 1;
} else {
  xRatio.current = 1;
  yRatio.current = 1;
}
```

**Issue**: Called every machine change; should cache result

**Solution**: Cache in `useMemo` or call once

### 8. **Dimension Calculation Math Inefficiency** (Very Minor)
**Lines**: 426-433
```typescript
let widthRatio = Math.floor((1 * (clientWidth - 8)) / width) / 1 / xRatio.current;
let heightRatio = Math.floor((1 * (clientHeight - 8)) / height) / 1 / yRatio.current;
```

**Issues**:
- `(1 * x) / 1` is no-op math
- Redundant dividing and multiplying by 1
- Bitwise OR (`| 0`) is faster than `Math.floor()` for positive numbers

**Solution**: Clean up to: `(clientWidth - 8) / width / xRatio.current`

---

## Optimization Priority

### Phase 1: Critical (Correctness & Major Performance)
1. **Move global state to component state** - Fix memory leaks
2. **Implement machine change detection** - Skip unnecessary renders
3. **Extract custom hooks** - Improve maintainability
4. **Unify update scheduler** - Prevent race conditions

### Phase 2: Important (Performance & Quality) - IN PROGRESS
5. ✅ **Smart pixel comparison** - Machine state aware (skip unnecessary comparisons)
6. ✅ **Memoize key mapping merge** - Reduce object allocations
7. ✅ **Optimize canvas smoothing** - Cache state, only set when changed
8. ⏳ **Clean dimension math** - Micro-optimization (pending)

### Phase 3: Polish (Code Quality)
9. **Remove code duplication** - Instant screen helpers
10. **Cache aspect ratio** - One-time calculation
11. **Optimize canvas smoothing** - Conditional setting
12. **Extract overlay component** - Separate concerns

---

## Expected Performance Gains

| Optimization | Impact | Effort | Priority |
|---|---|---|---|
| Machine change detection | 20-30% | Medium | P1 |
| Global → component state | 10-15% (stability) | Low | P1 |
| Smart pixel comparison | 10-20% | Medium | P2 |
| Hook extraction | Maintainability | Low | P2 |
| Key mapping memoization | 5% | Very Low | P3 |
| Math simplification | <1% | Very Low | P3 |

**Overall potential**: 40-60% improvement with Phase 1-2

---

## Risk Assessment

| Change | Risk | Mitigation |
|---|---|---|
| Move global state | Low | Add cleanup in useEffect |
| Machine change detection | Medium | Verify machine API availability |
| Extract hooks | Low | Keep same component API |
| Unify scheduler | Medium | Profile update timing |
| Smart comparison | Medium | Implement fallback to full comparison |

---

## Recommended Action Plan

1. **Session 1**: Move global state to component refs/state (1-2 hours)
2. **Session 2**: Implement machine change detection (1 hour)
3. **Session 3**: Extract display manager hook (1-2 hours)
4. **Session 4**: Implement smart pixel comparison (1-2 hours)
5. **Session 5**: Code cleanup and optimization (30 mins - 1 hour)
