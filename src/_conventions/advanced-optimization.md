# Advanced React Component Optimization Guide

This guide provides deeper technical details on optimizing React components, building on the conventions and checklist already established.

## Component Rendering Lifecycle

### Understanding When Components Re-render

A React component re-renders when:
1. Its state changes
2. Its props change
3. Its context provider value changes
4. Its parent component re-renders

Optimizing renders requires addressing each of these triggers.

## Advanced Memoization Techniques

### Component Memoization

```tsx
// Basic memoization
const MemoizedComponent = React.memo(MyComponent);

// With custom comparison
const MemoizedComponent = React.memo(MyComponent, (prevProps, nextProps) => {
  return prevProps.value === nextProps.value;
});
```

### Value Memoization with Dependencies

```tsx
// Memoizing derived values
const derivedValue = useMemo(() => {
  return expensiveCalculation(prop1, prop2);
}, [prop1, prop2]);

// Memoizing callbacks
const handleClick = useCallback(() => {
  performAction(dependency1, dependency2);
}, [dependency1, dependency2]);
```

## Custom Hook Patterns

### State Manager Hooks

```tsx
function useToggle(initialState = false) {
  const [state, setState] = useState(initialState);
  
  const toggle = useCallback(() => setState(prev => !prev), []);
  const setTrue = useCallback(() => setState(true), []);
  const setFalse = useCallback(() => setState(false), []);
  
  return [state, toggle, setTrue, setFalse];
}
```

### Async Operation Hooks

```tsx
function useAsyncOperation(asyncFn, dependencies = []) {
  const [state, setState] = useState({
    loading: false,
    error: null,
    data: null
  });
  
  const execute = useCallback(async (...args) => {
    setState(prev => ({ ...prev, loading: true }));
    try {
      const data = await asyncFn(...args);
      setState({ loading: false, error: null, data });
      return data;
    } catch (error) {
      setState({ loading: false, error, data: null });
      throw error;
    }
  }, [...dependencies]);
  
  return [state, execute];
}
```

## Advanced State Management

### Using useReducer for Complex State

```tsx
// Define action types
type Action = 
  | { type: 'increment' }
  | { type: 'decrement' }
  | { type: 'reset', payload: number };

// Define state type
interface CounterState {
  count: number;
}

// Reducer function
function counterReducer(state: CounterState, action: Action): CounterState {
  switch (action.type) {
    case 'increment':
      return { count: state.count + 1 };
    case 'decrement':
      return { count: state.count - 1 };
    case 'reset':
      return { count: action.payload };
    default:
      return state;
  }
}

// Using the reducer
function CounterComponent() {
  const [state, dispatch] = useReducer(counterReducer, { count: 0 });
  
  return (
    <div>
      Count: {state.count}
      <button onClick={() => dispatch({ type: 'increment' })}>+</button>
      <button onClick={() => dispatch({ type: 'decrement' })}>-</button>
      <button onClick={() => dispatch({ type: 'reset', payload: 0 })}>Reset</button>
    </div>
  );
}
```

## Advanced Event Handling

### Debounce Implementation

```tsx
function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  return useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  }, [callback, delay]);
}
```

### Throttle Implementation

```tsx
function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): (...args: Parameters<T>) => void {
  const lastRun = useRef(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  return useCallback((...args: Parameters<T>) => {
    const now = Date.now();
    const elapsed = now - lastRun.current;
    
    if (elapsed >= delay) {
      lastRun.current = now;
      callback(...args);
    } else {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        lastRun.current = Date.now();
        callback(...args);
      }, delay - elapsed);
    }
  }, [callback, delay]);
}
```

## Advanced Rendering Optimizations

### Component Splitting

```tsx
// Before: Single large component
function LargeComponent({ data, config }) {
  // Many calculations and renders
  return (/* complex JSX */);
}

// After: Split into focused components
function LargeComponent({ data, config }) {
  return (
    <>
      <HeaderSection data={data.header} />
      <ContentSection 
        items={data.items}
        config={config} 
      />
      <FooterSection data={data.footer} />
    </>
  );
}
```

### Conditional Rendering Optimization

```tsx
// Bad: Unnecessary rerenders of both components
function ParentComponent() {
  const [showA, setShowA] = useState(true);
  
  return (
    <div>
      {showA ? <ComponentA /> : <ComponentB />}
    </div>
  );
}

// Better: Extract to separate components
function ParentComponent() {
  const [showA, setShowA] = useState(true);
  
  return (
    <div>
      <ConditionalRenderer show={showA} />
    </div>
  );
}

const ConditionalRenderer = memo(({ show }) => {
  return show ? <ComponentA /> : <ComponentB />;
});
```

## Performance Testing

### Using React DevTools

1. Install React DevTools browser extension
2. Use the Profiler tab to record renders
3. Look for unnecessary re-renders
4. Identify components that render too often

### Using Performance Timing

```tsx
function Component() {
  useEffect(() => {
    performance.mark('component-start');
    
    return () => {
      performance.mark('component-end');
      performance.measure(
        'component-render',
        'component-start',
        'component-end'
      );
      
      const measurements = performance.getEntriesByName('component-render');
      console.log('Render time:', measurements[0].duration);
      
      performance.clearMarks();
      performance.clearMeasures();
    };
  }, []);
  
  // Component logic
}
```

## TypeScript Advanced Patterns

### Discriminated Union Types

```tsx
type ButtonProps = 
  | { variant: 'primary'; color?: string }
  | { variant: 'secondary'; outline: boolean }
  | { variant: 'text'; underline?: boolean };

const Button = ({ variant, ...props }: ButtonProps) => {
  switch (variant) {
    case 'primary':
      return <PrimaryButton color={props.color} />;
    case 'secondary':
      return <SecondaryButton outline={props.outline} />;
    case 'text':
      return <TextButton underline={props.underline} />;
  }
};
```

### Generic Components

```tsx
interface SelectProps<T> {
  items: T[];
  selectedItem: T | null;
  onSelect: (item: T) => void;
  getLabel: (item: T) => string;
  getValue: (item: T) => string | number;
}

function Select<T>({
  items,
  selectedItem,
  onSelect,
  getLabel,
  getValue
}: SelectProps<T>) {
  return (
    <select 
      value={selectedItem ? getValue(selectedItem).toString() : ''}
      onChange={(e) => {
        const selected = items.find(
          item => getValue(item).toString() === e.target.value
        );
        if (selected) onSelect(selected);
      }}
    >
      {items.map(item => (
        <option key={getValue(item)} value={getValue(item)}>
          {getLabel(item)}
        </option>
      ))}
    </select>
  );
}
```

## CSS Modules Best Practices

### Composition Over Inheritance

```scss
// Button.module.scss
.button {
  padding: 8px 16px;
  border-radius: 4px;
  font-weight: 500;
  cursor: pointer;
}

.primary {
  composes: button;
  background-color: var(--color-primary);
  color: white;
}

.secondary {
  composes: button;
  background-color: transparent;
  border: 1px solid var(--color-primary);
  color: var(--color-primary);
}
```

### Dynamic Class Names

```tsx
// Using classnames library
import classNames from 'classnames';
import styles from './Button.module.scss';

function Button({ variant, disabled, fullWidth }) {
  const className = classNames(
    styles.button,
    styles[variant],
    {
      [styles.disabled]: disabled,
      [styles.fullWidth]: fullWidth
    }
  );
  
  return <button className={className}>Click me</button>;
}
```

---

Use these advanced patterns and techniques alongside the conventions document and optimization checklist to create highly optimized React components.
