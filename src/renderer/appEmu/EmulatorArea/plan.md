# EmulatorPanel.tsx Performance Optimization Plan

## 1. Canvas Context Caching
**Current**: `getContext("2d")` called every frame in `displayScreenData()`
**Impact**: Medium
**Fix**: Cache both shadow and screen contexts in refs, reuse across frames
```typescript
const shadowCtxRef = useRef<CanvasRenderingContext2D | null>(null);
const screenCtxRef = useRef<CanvasRenderingContext2D | null>(null);
```

## 2. ImageData Reuse
**Current**: `shadowCtx.getImageData()` allocates new ImageData every frame
**Impact**: High - major GC pressure
**Fix**: Cache ImageData object, reuse the same buffer
```typescript
const shadowImageDataRef = useRef<ImageData | null>(null);
```

## 3. Pixel Copy Loop Optimization
**Current**: Manual for-loop with index increment `for (let i = startIndex; i < endIndex; i++)`
**Impact**: Medium
**Fix**: Use `subarray()` and `set()` for bulk copy (already optimal in original refactored code)
```typescript
pixelData.current.set(screenData.subarray(startIndex, endIndex));
```

## 4. Selector Optimization
**Current**: Multiple separate `useSelector` calls cause re-renders
**Impact**: Low-Medium
**Fix**: Combine related selectors into single calls with shallow equality
```typescript
const { machineState, audioSampleRate, emuViewVersion } = useSelector(
  (s) => ({ 
    machineState: s.emulatorState?.machineState,
    audioSampleRate: s.emulatorState?.audioSampleRate,
    emuViewVersion: s.emulatorState?.emuViewVersion
  }),
  shallowEqual
);
```

## 5. Event Handler Memoization
**Current**: `_handleKeyDown` and `_handleKeyUp` recreated on every render
**Impact**: Low
**Fix**: Use `useCallback` with proper dependencies
```typescript
const _handleKeyDown = useCallback((e: KeyboardEvent) => {
  handleKey(e, currentKeyMappings.current, currentDialogId, true);
}, []);
```

## 6. Remove Console Logs
**Current**: Debug logs in production code
**Impact**: Low
**Fix**: Remove all `console.log` statements from `displayScreenData()` and `scanlineEffect.ts`

## 7. Module-Level State to Refs
**Current**: Module-level variables (`machineStateHandlerQueue`, `currentDialogId`, etc.)
**Impact**: Low - memory leak risk across remounts
**Fix**: Move to component refs wrapped in a state object
```typescript
const componentStateRef = useRef({
  machineStateHandlerQueue: [],
  machineStateProcessing: false,
  currentDialogId: 0,
  savedPixelBuffer: null
});
```

## Priority Order
1. **High**: ImageData caching (#2)
2. **High**: Canvas context caching (#1)
3. **Medium**: Pixel copy optimization (#3) - if not already using subarray
4. **Low**: Selector optimization (#4)
5. **Low**: Remove console logs (#6)
6. **Low**: Event handler memoization (#5)
7. **Low**: Module state to refs (#7)
