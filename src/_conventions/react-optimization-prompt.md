# React Component Optimization Prompt

## Component Identification
Component Name: [COMPONENT_NAME]
File Path: [FILE_PATH]
Primary Purpose: [BRIEF_DESCRIPTION]

## Performance Analysis

Please analyze the following React component and suggest optimizations for:

1. Performance
2. State management
3. TypeScript types
4. Component structure
5. Event handling
6. Hook usage

Focus on applying the following best practices:

## Performance Optimizations
- Memoize expensive calculations with `useMemo`
- Add `React.memo()` for child components to prevent unnecessary re-renders
- Use `useCallback` for functions passed as props
- Extract large conditional renders into separate components
- Optimize dependency arrays in hooks
- Remove redundant renders and calculations

## State Management
- Consolidate related state into single objects/reducers
- Replace state with derived values where possible
- Ensure immutable state updates
- Use functional updates for state based on previous state
- Add proper cleanup for side effects in useEffect

## Component Structure
- Extract reusable logic into custom hooks
- Break large components into smaller, focused components
- Use composition over conditional rendering for variant components
- Move inline styles to CSS modules
- Ensure consistent naming patterns

## Type Improvements
- Replace `any` types with specific types
- Add interfaces/types for props and state
- Add JSDoc comments to document props and functions
- Use more specific TypeScript types (avoid `any`, prefer unions/intersections)
- Make prop types more specific where possible

## Event Handling
- Implement debouncing for frequent events
- Add proper error handling for async operations
- Use batched updates for related state changes
- Apply consistent event handler naming

## Documentation
- Add component purpose documentation
- Document props with JSDoc comments
- Add section comments for code organization
- Document complex logic or important decisions

## Example Optimizations

Please present the optimizations in the following format:

1. **Issue**: [Description of the issue]
   **Optimization**: [Suggested optimization]
   **Benefit**: [Expected improvement]

2. **Issue**: [Description of the issue]
   **Optimization**: [Suggested optimization]
   **Benefit**: [Expected improvement]

After analysis, refactor the component with the suggested optimizations, and ensure:
- No regressions in functionality
- Improved readability
- Better performance
- Proper TypeScript types
- Consistent code style
- Comprehensive documentation

## Commit Message

Add an informative commit message that explains the optimizations made to the component.
