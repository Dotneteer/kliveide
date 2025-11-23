# EmulatorPanel Component Refactoring Opportunities

## Overview
Analysis of `/src/renderer/appEmu/EmulatorArea/EmulatorPanel.tsx` for refactoring opportunities that reduce or maintain code lines while improving clarity and maintainability.

---

## Accepted Refactoring Opportunities

### 1. **Replace Hardcoded If Statements with Loop in handleMappedKey** ✅
**Issue**: The `handleMappedKey` function contains three separate if statements to handle multiple key mappings.

**Current Code** (lines 526-533):
```tsx
if (mapping.length > 0) {
  machine?.setKeyStatus(keyCodeSet.current[mapping[0]], isDown);
  keyStatusSet?.(keyCodeSet.current[mapping[0]], isDown);
}
if (mapping.length > 1) {
  machine?.setKeyStatus(keyCodeSet.current[mapping[1]], isDown);
  keyStatusSet?.(keyCodeSet.current[mapping[1]], isDown);
}
if (mapping.length > 2) {
  machine?.setKeyStatus(keyCodeSet.current[mapping[2]], isDown);
  keyStatusSet?.(keyCodeSet.current[mapping[2]], isDown);
}
```

**Proposed Code** (fewer lines, same functionality):
```tsx
mapping.forEach(key => {
  machine?.setKeyStatus(keyCodeSet.current[key], isDown);
  keyStatusSet?.(keyCodeSet.current[key], isDown);
});
```

**Impact**: Reduces ~12 lines to ~3 lines. Maintains readability. ✅

---

### 2. **Remove Redundant useEffect Dependency** ✅
**Issue**: The keyboard event setup useEffect (lines 170-179) includes `[hostElement.current]` as a dependency. Since `hostElement` is a ref that never changes, this is redundant.

**Current Code**:
```tsx
useEffect(() => {
  window.addEventListener("keydown", _handleKeyDown);
  window.addEventListener("keyup", _handleKeyUp);
  return () => {
    window.removeEventListener("keydown", _handleKeyDown);
    window.removeEventListener("keyup", _handleKeyUp);
  };
}, [hostElement.current]);
```

**Proposed Code**:
```tsx
useEffect(() => {
  window.addEventListener("keydown", _handleKeyDown);
  window.addEventListener("keyup", _handleKeyUp);
  return () => {
    window.removeEventListener("keydown", _handleKeyDown);
    window.removeEventListener("keyup", _handleKeyUp);
  };
}, [_handleKeyDown, _handleKeyUp]);
```

**Impact**: Same number of lines, clearer intent. The handlers are the actual dependencies. ✅

---

### 3. **Simplify Key Event Handler Wrappers** ✅
**Issue**: `_handleKeyDown` and `_handleKeyUp` (lines 110-116) are simple arrow function wrappers that can be inlined as inline event handlers or removed entirely by using useCallback.

**Current Code**:
```tsx
const _handleKeyDown = (e: KeyboardEvent) => {
  handleKey(e, currentKeyMappings.current, globalStateRef.current.currentDialogId, true);
};
const _handleKeyUp = (e: KeyboardEvent) => {
  handleKey(e, currentKeyMappings.current, globalStateRef.current.currentDialogId, false);
};
```

**Proposed**: Use useCallback to create stable references while maintaining the same code footprint or slightly reducing it by removing redundancy.

**Impact**: Same or fewer lines with better semantic clarity. ✅

---

## Rejected Refactoring Opportunities

### ❌ Consolidate Duplicated Shadow Screen Logic
**Reason**: Creates new helper function that adds extra "hops" when reading the code. Callers would need to jump to another function definition. The duplication is acceptable as-is.

### ❌ Consolidate Screen Dimension Refs
**Reason**: Requires creating a new composite object structure, increasing complexity when accessing values (e.g., `screenDimensionsRef.current.sourceWidth` vs `sourceWidth.current`). Current approach is straightforward.

### ❌ Break Down displayScreenData Function
**Reason**: Splitting into multiple functions creates additional indirection and code hops. Current function is self-contained despite its length.

### ❌ Extract Audio Renderer Initialization
**Reason**: Would require creating a separate async function, adding complexity and extra hops without reducing line count.

### ❌ Extract Disk Changes Handler
**Reason**: Currently nested helper that's only used once. Extracting adds unnecessary code without reducing line count.

### ❌ Memoize Selector Operations
**Reason**: useMemo would add lines of code without a clear performance benefit. Current selectors are efficient enough.

---

## Summary - Accepted Refactorings Only
- **1. Loop in handleMappedKey**: Reduces ~12 lines to ~3 lines ✅
- **2. Fix useEffect dependency**: Clarifies intent without adding lines ✅
- **3. Simplify key event wrappers**: Reduces boilerplate with useCallback ✅

**Total Impact**:
- **Code Reduction**: ~12 lines total
- **Maintainability**: Improved (clearer patterns, less boilerplate)
- **Reading Flow**: No extra hops introduced
- **Risk Level**: Very Low (minimal, focused changes)
