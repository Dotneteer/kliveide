# React Component Optimization Checklist

Use this checklist when optimizing React components in this project. Check off each item as you apply it to ensure a comprehensive optimization.

## Optimization Workflow

1. **Analysis Phase**: When asked to optimize a component, review it and create a tracking file (e.g., `_ComponentName.md`) with notes following this checklist without making actual changes.
2. **Implementation Phase**: Wait for explicit instructions on which optimizations to implement, then execute them as requested.
3. **Status Update**: After implementing optimizations, update the status in the tracking file.
4. **Completion**: When all optimizations are complete and confirmed, remove the tracking file.

## Initial Analysis
- [ ] Review component structure and purpose
- [ ] Identify performance bottlenecks
- [ ] Analyze state management
- [ ] Check for proper typing
- [ ] Create optimization tracking document (e.g., `_componentname.md`)

## Performance Optimizations

### Memoization
- [ ] Memoize expensive calculations with `useMemo`
- [ ] Wrap pure child components with `React.memo()`
- [ ] Use `useCallback` for event handlers passed as props
- [ ] Memoize selector results or derived values

### Rendering Optimization
- [ ] Extract large conditional blocks into separate components
- [ ] Implement early returns for conditional rendering
- [ ] Eliminate unnecessary re-renders
- [ ] Remove duplicate code/calculations
- [ ] Replace array/object spreads with direct references when possible

### State Management
- [ ] Consolidate related state into single objects
- [ ] Replace state with derived values where possible
- [ ] Use functional updates for state based on previous state
- [ ] Consider `useReducer` for complex state logic
- [ ] Add proper cleanup for async operations
- [ ] Fix dependency arrays in hooks
- [ ] Verify React Hook rules compliance (call hooks at the top level only, don't use hooks in conditions)

## Code Structure Improvements

### Component Organization
- [ ] Extract reusable logic into custom hooks
- [ ] Create separate components for complex UI sections
- [ ] Move business logic out of render functions

### Type Improvements
- [ ] Create explicit interfaces/types for props and state
- [ ] Replace `any` types with specific types
- [ ] Add JSDoc comments for props and functions
- [ ] Use proper return types for functions and hooks

### Styling
- [ ] Move inline styles to CSS modules
- [ ] Use theme variables for consistent styling
- [ ] Apply proper CSS class names

## Event Handling
- [ ] Add debouncing for frequent user actions
- [ ] Implement comprehensive error handling for async operations
- [ ] Use batched updates for related state changes
- [ ] Ensure proper event cleanup

## Documentation
- [ ] Document component purpose and behavior
- [ ] Add JSDoc comments for props and functions
- [ ] Include section comments for code organization
- [ ] Document complex logic or important decisions

## Final Validation
- [ ] Verify no regressions in functionality
- [ ] Check for TypeScript errors
- [ ] Run performance tests if applicable
- [ ] Update test files if necessary
- [ ] Document optimizations in tracking file

## Example Optimization Tracking Table

| Category | Issue | Optimization | Status |
|----------|-------|--------------|--------|
| Performance | Re-renders too often | Memoized component with React.memo | ✓ |
| Performance | Recalculating derived values | Added useMemo for calculation | ✓ |
| State | Multiple related state values | Consolidated into single object | ✓ |
| TypeScript | Any types | Replaced with specific interfaces | ✓ |
| Structure | Large render method | Extracted components for sections | ✓ |
| Hooks | Missing dependency | Fixed useEffect dependencies | ✓ |
| Event Handling | No error handling | Added try/catch with feedback | ✓ |
| Documentation | Missing prop docs | Added JSDoc comments | ✓ |

Use this checklist to track progress and ensure comprehensive component optimization.
