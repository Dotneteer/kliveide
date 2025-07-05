# Toolbar Component Optimization Options

This document lists potential optimization options for the Toolbar component. As optimizations are implemented, they will be marked as completed.

## Performance Optimizations

- [x] **Memoize derived values** - Use `useMemo` for computed values like `isStopped`, `isRunning`, `canStart` etc.
- [x] **Use React.memo for child components** - Wrap IconButton components with React.memo to prevent unnecessary re-renders
- [x] **Extract large conditional blocks** - Move IDE and non-IDE sections into separate components
- [x] **Use callback memoization** - Apply `useCallback` to event handlers to maintain referential equality

## State Management Optimizations

- [x] **Consolidate redundant state** - Remove redundancy between `startMode` and `currentStartOption`
- [x] **Group related state** - Combine keyboard shortcut states into a single object
- [x] **Fix dependency arrays** - Correct dependencies in `useEffect` hooks (remove isWindows from settings useEffect)
- [x] **Add cleanup for async operations** - Add cleanup functions to prevent memory leaks

## Code Structure Optimizations

- [x] **Extract reusable logic to custom hooks** - Create `useButtonAvailability`, `useEmulatorSettings` etc.
- [x] **Move inline styles to CSS modules** - Replace inline styles with className references
- [x] **Add proper TypeScript typing** - Add comprehensive type definitions for props and state
- [x] **Add JSDoc documentation** - Add documentation for component, props, and functions
- [x] **Implement error boundaries** - Add error handling for async operations
- [x] **Implement debounce handlers** - Add debouncing for handlers like speedChange
- [x] **Batch state updates** - Use batch updates with dispatch functions
