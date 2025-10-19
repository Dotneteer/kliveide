# MemoryPanel Refactoring Plan

## Current Complexity Analysis

### State Variables (15 total)
1. `topIndex` - scroll position
2. `isFullView` - 64k vs 16k view mode
3. `currentSegment` - which ROM/Bank to show
4. `bankLabel` - show bank labels?
5. `decimalView` - decimal vs hex display
6. `twoColumns` - 2-column vs 1-column layout
7. `charDump` - show character dump?
8. `memoryItems` - array of addresses for virtualized list
9. `mem64kLabels` - partition labels for display
10. `partitionLabels` - ROM/Bank labels
11. `scrollVersion` - force scroll effect to run
12. `lastJumpAddress` - highlight recently jumped address
13. `romFlags` - which partitions are ROM
14. `banksView` - show bank controls?
15. `displayBankMatrix` - complex bank layout?

### Refs (10 total)
1. `memory` - actual memory bytes
2. `cachedItems` - cached memoryItems array
3. `vlApi` - VirtualizedList API
4. `pointedRegs` - register tooltips
5. `refreshInProgress` - prevent concurrent refreshes
6. `allowRefresh` - enable/disable refresh
7. `cachedRefreshState` - previous refresh params
8. `isInitialMount` - first render flag
9. `isInitializing` - machine setup phase
10. `componentInstanceId` - for logging
11. `lastScrolledIndex` - prevent redundant scrolls

### Effects (7 total)
1. Mount/unmount logging
2. Machine ID changes → setup ROM/Bank options
3. Save viewState when any setting changes
4. Initial refresh with useInitializeAsync
5. Scroll when topIndex/scrollVersion changes
6. Refresh when machine paused/stopped
7. Refresh when segment/view/decimal/emuVersion changes
8. useEmuStateListener → refresh

## Problems Identified

1. **Triple initialization tracking**: `isInitialMount`, `isInitializing`, and checks in effects
2. **Redundant scroll management**: Both `scrollVersion` state and `lastScrolledIndex` ref
3. **Complex refresh guards**: Multiple places checking if refresh should run
4. **ViewState save triggers too often**: Effect runs on every state change
5. **Flickering root cause**: VirtualizedList renders before scroll completes

## Simplification Plan

### Phase 1: Consolidate Initialization
- Remove `isInitialMount` - use `isInitializing` only
- Remove `componentInstanceId` logging ref (keep logs simpler)
- Combine initial setup into one clear phase

### Phase 2: Simplify Scroll Management
- Remove `scrollVersion` state entirely
- Use only `lastScrolledIndex` ref
- Let topIndex changes naturally trigger scroll effect
- Add small delay in scroll effect to let DOM settle

### Phase 3: Optimize Refresh Logic
- Consolidate the 3 refresh effects into one
- Remove `allowRefresh` ref (unused?)
- Keep `refreshInProgress` to prevent concurrent calls only

### Phase 4: Fix ViewState Management
- Debounce viewState saves (don't save on every state change)
- Or only save on specific user actions (not automatic)

### Phase 5: Fix Flickering
**Root cause**: Component renders → VirtualizedList shows wrong position → scroll command sent → corrects position = flicker

**Solutions to try**:
A. Hide component until scroll position set (loading overlay)
B. Pass initial scroll position to VirtualizedList via startOffset prop
C. Delay initial render until all state settled
D. Use CSS opacity: 0 until first scroll completes

## Recommended Approach

Start with **Solution C + Phase 1-3**:

1. Add `isReady` state (false initially)
2. In initialization effect, set `isReady = true` AFTER:
   - Machine setup complete
   - Initial refresh complete  
   - Initial scroll position set
3. Show loading spinner while `!isReady`
4. This eliminates all flickering by preventing premature renders

Then apply Phase 1-3 simplifications to reduce complexity.

## Implementation Steps

1. Add `isReady` state with loading UI
2. Remove `isInitialMount`, use `isInitializing` only
3. Remove `scrollVersion`, rely on topIndex changes
4. Consolidate refresh effects
5. Test thoroughly
6. Remove diagnostic logging
7. Re-enable StrictMode
