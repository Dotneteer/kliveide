# Panel Components Refactoring Suggestions

This document outlines potential improvements for the React components in `Panels.tsx`.

## Current Issues and Improvement Opportunities

### ✅ 1. Code Duplication (COMPLETED)
Both `FullPanel` and `Stack` components contained nearly identical code for handling hover states and styling. This duplication has been extracted into a custom hook called `usePanelHover`.

The implementation:
- Created a shared hook that manages hover state
- Simplified the conditional background color logic
- Added useCallback for event handlers to prevent unnecessary re-renders
- Returned a consistent interface with elementStyle and hoverHandlers
- Removed duplicate code from both components
- Improved readability and maintainability

### ✅ 2. Prop Types (COMPLETED)
The components now use specific prop types with detailed documentation for each component:

- `PanelProps`: Base props with comprehensive JSDoc comments for each property
- `FullPanelProps`: Extended props specific to the FullPanel component
- `StackProps`: Extended props specific to the Stack component with added wrap functionality
- `VStackProps`: Specific type for VStack
- `HStackProps`: Specific type for HStack

Additionally, the `usePanelHover` hook was updated to use generic types to properly handle any prop type that extends from PanelProps.

### ✅ 3. Memoization (COMPLETED)
All components now use React.memo() to prevent unnecessary re-renders, and computations within components are memoized:

- All components (FullPanel, Stack, VStack, HStack) are wrapped with `React.memo()` to prevent re-renders when props don't change
- Class name calculations are memoized with `useMemo` to avoid recomputing them on each render
- The `usePanelHover` hook uses `useMemo` for:
  - Background color calculation
  - Combined style object
  - Hover handlers object
- Event handlers are already memoized with `useCallback`

### 4. Performance Considerations
- The hover state triggers re-renders on mouse events which could impact performance in deeply nested structures
- Style objects are recreated on every render

### ❌ 5. Accessibility Improvements (DROPPED)
After further consideration, these panel components are layout primitives without semantic meaning, so they do not require ARIA attributes. The accessibility of the content inside the panels should be handled by the components placed within them.

### ✅ 6. Event Handling Optimization (COMPLETED)
Event handlers have been optimized using useCallback to prevent creating new functions on each render:

- Mouse event handlers are now created with `useCallback` in the `usePanelHover` hook
- These memoized handlers are passed down to components via the `hoverHandlers` object
- Spread syntax `{...hoverHandlers}` is used to apply these optimized event handlers

### ✅ 7. Style Object Memoization (COMPLETED)
Style objects are now memoized to prevent recreation on every render:

- The combined style object in `usePanelHover` is memoized using `useMemo`
- Dependencies are properly tracked: `[elementStyle, backgroundColor]`
- This prevents unnecessary style recalculations when other props change but the style-related props remain the same

### ✅ 8. Simplified Conditional Styling (COMPLETED)
The hover background color logic has been simplified and is now memoized:

```typescript
// Simplified and memoized
const backgroundColor = useMemo(() => {
  return hovered && props.hoverBackgroundColor
    ? processStyleValue(props.hoverBackgroundColor)
    : elementStyle.backgroundColor;
}, [hovered, props.hoverBackgroundColor, elementStyle.backgroundColor]);
```

### ✅ 9. Testing Considerations (COMPLETED)
Added data-testid attributes to make components easier to test:

- Added `data-testid="full-panel"` to the FullPanel component
- Added `data-testid="stack"` to the Stack component
- These attributes make it easier to target specific components in tests using testing libraries like React Testing Library

### ✅ 10. Props Spreading (COMPLETED)
The component props are now handled more explicitly with destructuring and specific prop handling:

- Created separate `PanelStyleProps` and `PanelDOMProps` types in PanelProps.tsx
- All components now destructure their props to make usage explicit
- In each component:
  - DOM-related props like `id` and `classExt` are explicitly passed
  - Style-related props are grouped and passed to the usePanelHover hook
  - Feature-specific props like `orientation` and `wrap` are handled individually
- The `usePanelHover` hook now takes a `PanelStyleProps` object instead of the full props object
- Property names are more descriptive (`style` instead of `elementStyle`)

## Next Steps

✅ 1. Create a custom hook to handle hover state and styling (COMPLETED)
✅ 2. Refine prop types with better documentation (COMPLETED)
✅ 3. Apply memoization where appropriate (COMPLETED)
❌ 4. Add accessibility attributes (DROPPED)
✅ 5. Optimize event handlers with useCallback (COMPLETED)
✅ 6. Memoize style objects with useMemo (COMPLETED)
✅ 7. Make prop usage more explicit (COMPLETED)

## All Refactoring Tasks Completed! 🎉
