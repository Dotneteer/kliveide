# React Component Conventions

This document outlines the conventions and best practices to follow when creating or refactoring React components in this project. Following these guidelines will help maintain consistency, performance, and readability across the codebase.

## Component Structure

### 1. Component Organization

- **One Component Per File**: Define one main component per file, named to match the file name
- **Extract Nested Components**: Move complex nested components into separate files or create memoized sub-components
- **Co-locate Related Files**: Keep component-specific files like styles, tests, and types together

### 2. Component Hierarchy

- **Prefer Function Components**: Use function components with hooks over class components
- **Create Specialized Components**: Break down large components into smaller, specialized ones
- **Use Composition**: Compose components rather than inheritance or large conditional blocks

## Performance Optimizations

### 1. Memoization

- **Memoize Child Components**: Use `React.memo()` for components that render often but rarely change
- **Memoize Expensive Calculations**: Use `useMemo()` for derived values to prevent recalculation
- **Memoize Callbacks**: Use `useCallback()` for event handlers passed to child components

### 2. State Management

- **Consolidate Related State**: Group related state values into a single object
- **Minimize State**: Derive values from props or other state when possible
- **Use Reducer Pattern**: For complex state logic, prefer `useReducer` over multiple `useState` calls

### 3. Rendering Optimization

- **Early Returns**: Use early returns for conditional rendering of entire components
- **Extract Large Conditional Blocks**: Move large conditional sections into separate components
- **Avoid Unnecessary Renders**: Prevent unnecessary renders with proper dependencies and memoization
- **Avoid Spreading Arrays/Objects**: Pass direct references instead of creating new arrays/objects

## Code Quality

### 1. TypeScript Best Practices

- **Define Explicit Types**: Create interfaces/types for props and state
- **Use Descriptive Type Names**: Name types clearly to indicate their purpose
- **Document Props**: Add JSDoc comments to describe prop purposes
- **Avoid 'any'**: Replace 'any' types with specific types

### 2. Hooks Usage

- **Custom Hooks for Reusable Logic**: Extract reusable logic into custom hooks
- **Proper Dependencies**: Ensure correct dependency arrays in useEffect/useCallback/useMemo
- **Cleanup Side Effects**: Add cleanup functions in useEffect for subscriptions, timers, etc.
- **Consistent Hook Order**: Keep hooks at the top level and in a consistent order

### 3. Event Handling

- **Debounce Rapid Actions**: Use debouncing for frequently triggered events
- **Batch Related Updates**: Use functional updates to batch state changes
- **Error Handling**: Add comprehensive error handling for async operations
- **Named Event Handlers**: Use clear, descriptive names for event handlers (e.g., `handleButtonClick`)

## Styling

- **Use CSS Modules**: Prefer CSS modules for component styling to avoid global scope issues
- **Avoid Inline Styles**: Move inline styles to CSS modules except for dynamic values
- **Theme Variables**: Use CSS variables for theming and consistent design

## Documentation

- **Component Purpose**: Document the main component's purpose and key behaviors
- **Props Documentation**: Add JSDoc comments to describe the purpose of each prop
- **Code Organization Comments**: Use section comments to organize large components
- **Implementation Notes**: Document complex logic or important decisions

## Example

```tsx
/**
 * ButtonComponent displays a customizable button with optional icon.
 * It supports different variants and states.
 */
interface ButtonProps {
  /** Label text to display */
  label: string;
  /** Optional icon to display before the label */
  icon?: string;
  /** Button appearance variant */
  variant?: 'primary' | 'secondary' | 'danger';
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Click handler function */
  onClick: () => void;
}

export const Button = memo(({
  label,
  icon,
  variant = 'primary',
  disabled = false,
  onClick
}: ButtonProps) => {
  // Memoize handlers
  const handleClick = useCallback(() => {
    if (!disabled) onClick();
  }, [disabled, onClick]);

  // Derive computed values
  const buttonClass = useMemo(() => 
    `${styles.button} ${styles[variant]} ${disabled ? styles.disabled : ''}`,
    [variant, disabled]
  );

  return (
    <button 
      className={buttonClass}
      onClick={handleClick}
      aria-disabled={disabled}
    >
      {icon && <Icon name={icon} className={styles.icon} />}
      <span>{label}</span>
    </button>
  );
});
```

---

These conventions are based on optimizations applied to components like `Toolbar.tsx` and represent the current best practices for this project. This document will be updated as new patterns and optimizations emerge.
