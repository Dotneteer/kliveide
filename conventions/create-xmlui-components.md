# Creating XMLUI Components

This document outlines the conventions, patterns, and best practices for creating new XMLUI components.

## Table of Contents

1. [Component Structure](#component-structure)
2. [Component Metadata](#component-metadata)
3. [Component Parts Pattern](#component-parts-pattern)
4. [Component Renderers](#component-renderers)
5. [Theme and Styling](#theme-and-styling)
6. [Component Implementation](#component-implementation)
7. [Testing](#testing)
8. [Component Implementation Patterns](#component-implementation-patterns)
9. [Default Values Pattern](#default-values-pattern)
10. [ForwardRef Pattern](#forwardref-pattern)
11. [State Management Patterns](#state-management-patterns)
12. [Event Handling Patterns](#event-handling-patterns)
13. [API Registration and Programmatic Control Patterns](#api-registration-and-programmatic-control-patterns)
14. [XMLUI Renderer Patterns](#xmlui-renderer-patterns)
15. [Performance Patterns](#performance-patterns)

## Component Structure

XMLUI components are built from four crucial concepts:

1. **Native React Component**: The actual UI implementation using standard React patterns
2. **Metadata**: Complete API description including props, events, APIs, and theme variables
3. **Renderer Function**: Maps XMLUI markup to React component calls
4. **Component Registration**: Makes the component available in XMLUI markup

### Core Component Concepts

XMLUI components expose several key concepts that enable rich interactivity:

- **Properties**: Configuration values passed to components (e.g., `size`, `variant`, `disabled`)
- **Events**: User interactions that components can emit (e.g., `click`, `change`, `focus`)
- **Event Handlers**: Functions that respond to events, often updating application state
- **Exposed Methods**: Programmatic APIs that allow parent components to control child behavior (e.g., `setValue()`, `focus()`)
- **Context Variables**: Data that components expose to their children, accessible via `$variableName` syntax

### Component Creation Conventions

When creating new XMLUI components, follow these strict conventions:

**File Structure:**
- **Never create `index.ts` files** when creating components
- **Never create example files** to demonstrate the component
- **Only create end-to-end tests and documentation when explicitly requested**
- **Do not add the React component to the xmlui folder's package.json file**

**Focus on Core Functionality:**
- Prioritize the component's core functionality and API design
- Ensure proper XMLUI integration and registration
- Examples and comprehensive documentation are secondary concerns unless specifically requested

### File Organization

Each component should have its own directory under `src/components/` with the following structure:

```
ComponentName/
├── ComponentName.tsx              # Component definition (required)
├── ComponentNameNative.tsx        # Native implementation (dual-file pattern)
└── ComponentName.module.scss      # Component styles (optional)
```

**Key files:**
- **Component definition**: Always named exactly like the component (e.g., `Avatar.tsx`)
- **Native file**: Appended with "Native" suffix (e.g., `AvatarNative.tsx`)
- **SCSS module**: Always follows `.module.scss` pattern for scoped styles

**Important conventions:**
- **Never create `index.ts` files** when creating components - components should be imported directly from their main files
- **Never create example files** to demonstrate the component - examples should be in documentation or playground only
- **Create end-to-end tests and documentation only when explicitly requested** - focus on core functionality first

### Standard Dual-File Pattern

Most XMLUI components use a dual-file pattern that separates concerns:

- **Component Definition** (`ComponentName.tsx`)
  - Contains component metadata using `createMetadata`
  - Defines the renderer function with `createComponentRenderer`
  - Specifies theme variables and their defaults
  - Maps XMLUI props to native component props

- **Native Component** (`ComponentNameNative.tsx`)
  - Pure React implementation using `forwardRef`
  - Contains actual rendering logic and component behavior
  - Defines TypeScript interfaces for props
  - Exports `defaultProps` object

> **Note**: For very simple components, the native implementation can be included directly in the component definition file instead of creating a separate `*Native.tsx` file.

### Component Registration

Components must be registered in `ComponentProvider.tsx` to be available in XMLUI markup:

```typescript
// Import the component renderer
import { avatarComponentRenderer } from "./Avatar/Avatar";

// Register in ComponentProvider class  
this.registerCoreComponent(avatarComponentRenderer);
```

## Component Metadata

Component metadata is a **fundamental and critical concept** in XMLUI. It serves as the single source of truth that describes a component's complete API surface, including properties, events, exposed methods, context variables, and theme variables. This metadata is not just documentation—it's actively used by:

- **XMLUI Documentation System**: Auto-generates component documentation
- **VS Code Extension**: Provides IntelliSense, auto-completion, and validation
- **Type Checking**: Validates component usage at build time  
- **Developer Tools**: Powers debugging and inspection features
- **Code Generation**: Enables automated tooling and scaffolding

### Metadata Structure

Component metadata is defined using the `createMetadata` helper. Some components are non-visual and do not render any UI - these use the `nonVisual` metadata property set to `true`.

Component metadata is defined using the `createMetadata` helper:

```typescript
import { createMetadata, d, dClick } from "../metadata-helpers";

const COMP = "ComponentName";

export const ComponentNameMd = createMetadata({
  status: "stable" | "experimental" | "deprecated",
  description: "Brief description of the component and its purpose",
  
  props: {
    propName: {
      description: "What this prop does",
      type: "string" | "number" | "boolean",
      availableValues: optionsArray, // For enum-like props
      defaultValue: defaultProps.propName,
      isRequired: false,
    },
  },
  
  events: {
    onClick: dClick(COMP),
    onCustomEvent: d("Description of custom event"),
  },
  
  apis: {
    setValue: {
      description: "API method description",
      signature: "setValue(value: string): void",
    },
  },
  
  contextVars: {
    // Variables exposed to child components
  },
  
  themeVars: parseScssVar(styles.themeVars),
  defaultThemeVars: {
    [`property-${COMP}`]: "defaultValue",
  },
});
```

### Metadata Helper Functions

- `d(description, availableValues?, valueType?, defaultValue?, isValid?, isRequired?)` - General property descriptor
- `dClick(componentName)` - Standard click event descriptor
- `dGotFocus(componentName)` - Focus event descriptor
- `dLostFocus(componentName)` - Blur event descriptor
- `dInternal(description?)` - Internal-only property descriptor

## Component Parts Pattern

The **parts pattern** is a metadata-driven approach that allows referencing and styling nested sub-components within complex XMLUI components. This pattern adds metadata to components that enables targeting specific parts for testing, styling, and layout applications.

### Parts Metadata Structure

Components that use the parts pattern define a `parts` object in their metadata, where each part has a descriptive name and description:

```typescript
export const ComponentNameMd = createMetadata({
  // ... other metadata
  parts: {
    label: {
      description: "The label displayed for the component.",
    },
    input: {
      description: "The main input area.",
    },
    startAdornment: {
      description: "The adornment displayed at the start of the component.",
    },
    endAdornment: {
      description: "The adornment displayed at the end of the component.",
    },
  },
  defaultPart: "input", // Optional: specifies which part receives layout properties by default
  // ... rest of metadata
});
```

### Part Implementation in Native Components

Parts are implemented in native components by applying CSS classes that mark specific DOM elements as parts. This is done using the `partClassName` function from the parts infrastructure:

```typescript
import { partClassName, PART_INPUT, PART_START_ADORNMENT, PART_END_ADORNMENT } from "../../components-core/parts";

export const ComponentNative = forwardRef(function ComponentNative(props, ref) {
  return (
    <div className={styles.container}>
      {/* Start adornment part */}
      {startAdornment && (
        <div className={classnames(partClassName(PART_START_ADORNMENT), styles.adornment)}>
          {startAdornment}
        </div>
      )}
      
      {/* Main input part */}
      <input
        className={classnames(partClassName(PART_INPUT), styles.input)}
        {...inputProps}
      />
      
      {/* End adornment part */}
      {endAdornment && (
        <div className={classnames(partClassName(PART_END_ADORNMENT), styles.adornment)}>
          {endAdornment}
        </div>
      )}
    </div>
  );
});
```

### Standard Part Names

XMLUI defines common part constants for consistency across components:

- `PART_LABEL` - For component labels
- `PART_INPUT` - For main input areas
- `PART_START_ADORNMENT` - For decorative elements at the start
- `PART_END_ADORNMENT` - For decorative elements at the end

### Component Examples Using Parts

#### TextBox Component Parts
```typescript
parts: {
  label: { description: "The label displayed for the text box." },
  startAdornment: { description: "The adornment displayed at the start of the text box." },
  endAdornment: { description: "The adornment displayed at the end of the text box." },
  input: { description: "The text box input area." }
},
defaultPart: "input"
```

#### TimeInput Component Parts
```typescript
parts: {
  hour: { description: "The hour input field." },
  minute: { description: "The minute input field." },
  second: { description: "The second input field." },
  ampm: { description: "The AM/PM indicator." },
  clearButton: { description: "The button to clear the time input." }
}
```

#### Checkbox Component Parts
```typescript
parts: {
  label: { description: "The label displayed for the checkbox." },
  input: { description: "The checkbox input area." }
}
```

### Benefits of the Parts Pattern

1. **Testing**: Parts provide stable selectors for automated testing by generating predictable CSS classes like `_PART_input_`
2. **Styling**: Theme variables and CSS can target specific parts of complex components
3. **Layout**: Layout properties can be applied to specific parts rather than the entire component
4. **Documentation**: Auto-generated documentation includes part descriptions for better developer understanding
5. **Consistency**: Standardized part names create consistent patterns across the component library

### When to Use Parts

Use the parts pattern for components that:
- Have multiple distinct visual elements that users might want to style separately
- Contain input elements alongside labels, adornments, or other decorative elements
- Have complex internal structure that benefits from targeted styling or testing
- Need fine-grained control over layout application to sub-elements

Simple components with a single visual element typically don't need the parts pattern.

## Component Renderers

Component renderers are functions that bridge XMLUI markup and React components. They receive a `RendererContext` object containing all necessary information to render the component and return a React element.

### Renderer Context

The `RendererContext` provides these key properties for accessing component data and functionality:

- **`node`**: The component definition containing props, children, and metadata
- **`state`**: The current state of the container in which the component is rendered
- **`appContext`**: The application context for binding expressions and component usage
- **`renderChild`**: Renders child components with optional layout context
- **`layoutContext`**: Information about the layout context in which the component is rendered
- **`uid`**: Unique identifier for the component instance
- **`updateState`**: Updates component's internal state using reducer pattern
- **`extractValue`**: Extracts and evaluates property values (handles binding expressions)
- **`extractResourceUrl`**: Converts logical resource URLs to physical URLs
- **`lookupEventHandler`**: Creates event handler functions from XMLUI event definitions  
- **`lookupAction`**: Obtains async action handlers by name with specified options
- **`lookupSyncCallback`**: Retrieves synchronous callback functions
- **`layoutCss`**: Pre-computed CSS properties for layout (position, size, etc.)
- **`registerComponentApi`**: Registers component methods for programmatic access

### Value Extraction Patterns

The `extractValue` function handles different data types with specialized methods:

```typescript
// Basic extraction (any type)
const value = extractValue(node.props.someProperty);

// Typed extraction with defaults
const size = extractValue.asOptionalString(node.props.size, "medium");
const enabled = extractValue.asOptionalBoolean(node.props.enabled, true);
const count = extractValue.asOptionalNumber(node.props.count, 0);

// Display text (handles spacing properly)
const label = extractValue.asDisplayText(node.props.label);

// CSS size values (with units)
const width = extractValue.asSize(node.props.width);
```

### Event Handler Patterns

Event handlers are created through `lookupEventHandler` and connected to React component events:

```typescript
// Simple event handlers
onClick={lookupEventHandler("click")}
onFocus={lookupEventHandler("gotFocus")}
onBlur={lookupEventHandler("lostFocus")}

// Custom events with specific payloads
onDidChange={lookupEventHandler("didChange")}
onSelectionChanged={lookupEventHandler("selectionDidChange")}
```

### Renderer Examples

#### Complex Component Renderer with Children
```typescript
export const buttonComponentRenderer = createComponentRenderer(
  "Button",
  ButtonMd,
  ({ node, extractValue, renderChild, lookupEventHandler, layoutCss }) => {
    const iconName = extractValue.asString(node.props.icon);
    const label = extractValue.asDisplayText(node.props.label);
    
    return (
      <Button
        variant={extractValue.asOptionalString(node.props.variant)}
        disabled={!extractValue.asOptionalBoolean(node.props.enabled, true)}
        icon={iconName && <Icon name={iconName} aria-hidden />}
        onClick={lookupEventHandler("click")}
        onFocus={lookupEventHandler("gotFocus")}
        style={layoutCss}
      >
        {renderChild(node.children, { type: "Stack", orientation: "horizontal" }) || label}
      </Button>
    );
  },
);
```

#### Component with State and API Registration
```typescript
export const colorPickerComponentRenderer = createComponentRenderer(
  "ColorPicker", 
  ColorPickerMd,
  ({ node, extractValue, state, updateState, registerComponentApi, lookupEventHandler, layoutCss }) => {
    return (
      <ColorPicker
        value={state.value}
        initialValue={extractValue(node.props.initialValue)}
        updateState={updateState}
        registerComponentApi={registerComponentApi}
        onDidChange={lookupEventHandler("didChange")}
        style={layoutCss}
        enabled={extractValue.asOptionalBoolean(node.props.enabled, true)}
      />
    );
  },
);
```

## Theme and Styling

Non-visual components do not use styling or theme variables.

Each visual component requires a SCSS module file with this structure:

```scss
// ComponentName.module.scss
@use "../../components-core/theming/themes" as t;

// --- This code snippet is required to collect the theme variables used in this module
$themeVars: ();
@function createThemeVar($componentVariable) {
  $themeVars: t.appendThemeVar($themeVars, $componentVariable) !global;
  @return t.getThemeVar($themeVars, $componentVariable);
}

// Define theme variables
$backgroundColor-ComponentName: createThemeVar("backgroundColor-ComponentName");
$borderColor-ComponentName: createThemeVar("borderColor-ComponentName");
$textColor-ComponentName: createThemeVar("textColor-ComponentName");

// --- This part defines the CSS styles
.componentName {
  background-color: $backgroundColor-ComponentName;
  border-color: $borderColor-ComponentName;
  color: $textColor-ComponentName;
  
  // Component-specific styles
  
  &.variantClass {
    // Variant styles
  }
}

// --- We export the theme variables to add them to the component renderer
:export{
  themeVars: t.json-stringify($themeVars)
}
```

This structure is important because it helps collect all theme variables a particular component supports for documentation purposes. The pattern uses the `createThemeVar()` function to define theme variables that can be customized through the design system, then uses those variables in CSS styles, and finally exports them for the component renderer.

## Component Implementation

Follow this implementation flow for creating new XMLUI components:

1. **Create the component metadata** - This information helps understand the component design and facilitates discussion
2. **Create the renderer function and export it** - Use the native component and pass XMLUI component properties and events to it (the code won't build yet as no native component exists)
3. **Create a rudimentary version of the native component** - Make the code compile with basic functionality
4. **Add component registration** - At this point you can test the rudimentary component in XMLUI markup
5. **Implement the native component in full** - Add complete functionality, styling, and behavior

**Note**: End-to-end tests and comprehensive documentation should only be created when explicitly requested. Focus on core functionality first.

### Native Component Structure

Native components must follow these patterns:

```typescript
import React, { forwardRef, useRef, useEffect } from "react";
import classnames from "classnames";
import styles from "./ComponentName.module.scss";

// Define props interface
type Props = {
  id?: string;
  // Component-specific props
  children?: React.ReactNode;
  style?: CSSProperties;
  // Event handlers
  onClick?: (event: React.MouseEvent) => void;
  // Accessibility props
} & React.HTMLAttributes<HTMLElement>;

// Define default props
export const defaultProps: Required<Pick<Props, "prop1" | "prop2">> = {
  prop1: "defaultValue",
  prop2: "anotherDefault",
};

// Component implementation with forwardRef
export const ComponentName = forwardRef(function ComponentName(
  {
    prop1 = defaultProps.prop1,
    prop2 = defaultProps.prop2,
    children,
    style,
    onClick,
    ...rest
  }: Props,
  ref: React.ForwardedRef<HTMLElement>,
) {
  const innerRef = useRef<HTMLElement>(null);
  
  // Compose refs if needed
  const composedRef = ref ? composeRefs(ref, innerRef) : innerRef;
  
  // Component logic here
  
  return (
    <div
      ref={composedRef}
      className={classnames(styles.componentName, {
        [styles.variantClass]: condition,
      })}
      style={style}
      onClick={onClick}
      {...rest}
    >
      {children}
    </div>
  );
});

// Note: We do NOT use displayName in XMLUI components
// React.displayName is not used in our component convention
```

**Key patterns**: Always use `forwardRef`, define clear TypeScript interfaces, provide sensible defaults via `defaultProps`, use scoped CSS modules, support standard HTML attributes, handle accessibility through proper ARIA attributes, and do **not** set `displayName` on components.

## Testing

Component testing follows established patterns and conventions detailed in [testing-conventions.md](./testing-conventions.md). This includes component driver patterns, test structure, and best practices for ensuring component reliability and functionality.

---

## Component Implementation Patterns

*Note: This is a temporary list for detailed expansion later*

### XMLUI Component Patterns

**Specialized Component Patterns:**
- Form components: Integration with FormContext, validation handling
- Data-driven components: List virtualization, table column management
- Interactive components: Complex state management, event propagation
- Container components: Layout management, child component orchestration

### React Native Component Patterns

**Accessibility Patterns:**
- ARIA attribute management
- Focus management and trap patterns
- Screen reader optimization
- High contrast and reduced motion support

---

## Default Values Pattern

**Purpose**: Components need consistent, predictable default behavior while allowing customization. This pattern solves the problem of ensuring components work correctly when properties are omitted, reducing the need for consumers to specify every property explicitly.

**Implementation Pattern**:

1. **Define defaults object in Native component**:
```typescript
// In ComponentNative.tsx
export const defaultProps = {
  enabled: true,
  variant: "primary" as const,
  size: "md" as const,
  showIcon: false,
  // ... other defaults
};
```

2. **Apply defaults in Native component implementation**:
```typescript
interface Props {
  enabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
}

export const ComponentNative = ({
  enabled = defaultProps.enabled,
  variant = defaultProps.variant,
  size = defaultProps.size,
  showIcon = defaultProps.showIcon,
  ...rest
}: Props) => {
  // Component implementation uses the resolved defaults
  return (
    <div
      className={classnames(styles.component, {
        [styles.disabled]: !enabled,
        [styles[variant]]: variant,
        [styles[size]]: size,
      })}
      {...rest}
    />
  );
};
```

3. **Reference defaults in XMLUI metadata**:
```typescript
export const ComponentMd = createMetadata({
  props: {
    enabled: dEnabled(defaultProps.enabled),
    variant: {
      description: "Visual style variant",
      availableValues: ["primary", "secondary", "danger"],
      defaultValue: defaultProps.variant,
      valueType: "string",
    },
    // ... other props with defaults
  },
});
```

4. **Pass values directly in renderer (no fallbacks needed)**:
```typescript
export const componentRenderer = createComponentRenderer(
  COMP,
  ComponentMd,
  ({ node, extractValue }) => {
    return (
      <ComponentNative
        enabled={extractValue.asOptionalBoolean(node.props.enabled)}
        variant={extractValue(node.props.variant)}
        size={extractValue(node.props.size)}
        // Native component handles undefined values with its own defaults
      />
    );
  },
);
```

**Key Benefits**:
- Consistent behavior across all components
- Native components work correctly when used directly by other XMLUI components
- Single source of truth for default values
- Eliminates duplication between renderer and native component
- Supports both XMLUI and direct React usage patterns seamlessly

## ForwardRef Pattern

**Purpose**: React components need to expose DOM element references to parent components for imperative operations like focusing, scrolling, or measuring. The forwardRef pattern solves the problem of ref forwarding through component boundaries, enabling parent components to directly interact with child DOM elements and supporting imperative APIs.

**React API Overview**:
- **`forwardRef`**: A React function that enables a component to receive a `ref` from its parent and forward it to a child element or expose custom APIs

> **⚠️ Important - useImperativeHandle Antipattern**: The XMLUI team has determined that `useImperativeHandle` is an antipattern and **should NOT be used** in XMLUI components. All instances have been removed from the codebase. Instead, imperative APIs should be exposed through the XMLUI `registerComponentApi` mechanism, which provides better framework integration and more predictable behavior.

**Implementation Pattern**:

1. **Basic forwardRef structure with typed ref**:
```typescript
import React, { forwardRef } from "react";

interface Props {
  children?: React.ReactNode;
  className?: string;
  // ... other props
}

export const ComponentNative = forwardRef<HTMLDivElement, Props>(
  function ComponentNative({ children, className, ...rest }, ref) {
    return (
      <div ref={ref} className={className} {...rest}>
        {children}
      </div>
    );
  }
);
```

2. **ForwardRef with internal ref composition**:
```typescript
import React, { forwardRef, useRef } from "react";
import { composeRefs } from "../../utils/ref-utils";

export const ComponentNative = forwardRef<HTMLDivElement, Props>(
  function ComponentNative({ children, ...rest }, ref) {
    const internalRef = useRef<HTMLDivElement>(null);
    const composedRef = composeRefs(ref, internalRef);
    
    // Use internalRef for component logic
    const handleClick = () => {
      internalRef.current?.focus();
    };
    
    return (
      <div ref={composedRef} onClick={handleClick} {...rest}>
        {children}
      </div>
    );
  }
);
```

3. **ForwardRef with imperative API exposure via registerComponentApi** (recommended pattern):
```typescript
import React, { forwardRef, useRef, useState, useEffect } from "react";

interface Props {
  initialValue?: string;
  registerComponentApi?: (api: any) => void;
  updateState?: (state: any) => void;
  onDidChange?: () => void;
}

export const ComponentNative = forwardRef<HTMLInputElement, Props>(
  function ComponentNative({ initialValue, registerComponentApi, updateState, onDidChange, ...rest }, ref) {
    const elementRef = useRef<HTMLInputElement>(null);
    const [value, setValue] = useState(initialValue || "");
    
    // Compose refs to expose both DOM element and internal ref
    const composedRef = composeRefs(ref, elementRef);
    
    // Register imperative API using XMLUI's registerComponentApi pattern
    useEffect(() => {
      if (registerComponentApi) {
        registerComponentApi({
          focus: () => elementRef.current?.focus(),
          blur: () => elementRef.current?.blur(),
          scrollIntoView: () => elementRef.current?.scrollIntoView(),
          getValue: () => value,
          setValue: (newValue: string) => {
            setValue(newValue);
            updateState?.({ value: newValue });
            onDidChange?.();
          },
        });
      }
    }, [registerComponentApi, value, updateState, onDidChange]);
    
    return (
      <input
        ref={composedRef}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          updateState?.({ value: e.target.value });
          onDidChange?.();
        }}
        {...rest}
      />
    );
  }
);
```

4. **Registration in XMLUI renderer with API exposure**:
```typescript
export const componentRenderer = createComponentRenderer(
  COMP,
  ComponentMd,
  ({ node, extractValue, registerComponentApi, updateState, lookupEventHandler }) => {
    return (
      <ComponentNative
        initialValue={extractValue(node.props.initialValue)}
        registerComponentApi={registerComponentApi}
        updateState={updateState}
        onDidChange={lookupEventHandler("didChange")}
      />
    );
  },
);
```

**Key Benefits**:
- Enables parent components to access child DOM elements directly
- Supports imperative APIs for programmatic component control through `registerComponentApi`
- Maintains clean separation between declarative props and imperative methods
- Allows XMLUI components to expose methods callable from event handlers
- Facilitates complex component interactions (focus management, animations, measurements)
- Essential for form components that need validation and value access
- Provides better framework integration compared to `useImperativeHandle` antipattern

## State Management Patterns

**Purpose**: React components need different approaches to manage state depending on their complexity, interaction patterns, and integration requirements. These patterns solve various state-related challenges from simple local state to complex cross-component communication and XMLUI framework integration.

**React Hooks Overview**:
- **`useState`**: Manages component-local state with getter/setter pattern
- **`useRef`**: Creates mutable references that persist across renders without causing re-renders
- **`useMemo`**: Memoizes expensive calculations to prevent unnecessary recomputation
- **`useCallback`**: Memoizes functions to prevent unnecessary re-creation and child re-renders
- **`useEffect`**: Handles side effects, subscriptions, and cleanup operations

### Controlled vs Uncontrolled Component Pattern

**Purpose**: Components need to handle user input and data flow in predictable ways, either allowing parent components to control the state (controlled) or managing it internally (uncontrolled).

**Implementation Pattern**:

```typescript
// Uncontrolled component - manages its own state
export const UncontrolledComponent = ({ defaultValue, onChange }: Props) => {
  const [value, setValue] = useState(defaultValue || "");
  
  const handleChange = (newValue: string) => {
    setValue(newValue);
    onChange?.(newValue); // Notify parent but don't depend on it
  };
  
  return <input value={value} onChange={(e) => handleChange(e.target.value)} />;
};

// Controlled component - parent controls the state
export const ControlledComponent = ({ value, onChange }: Props) => {
  // No internal state - everything comes from props
  const handleChange = (newValue: string) => {
    onChange?.(newValue); // Parent must handle this
  };
  
  return <input value={value} onChange={(e) => handleChange(e.target.value)} />;
};

// Hybrid approach - supports both patterns
export const FlexibleComponent = ({ value, defaultValue, onChange }: Props) => {
  const [internalValue, setInternalValue] = useState(defaultValue || "");
  const isControlled = value !== undefined;
  const effectiveValue = isControlled ? value : internalValue;
  
  const handleChange = (newValue: string) => {
    if (!isControlled) {
      setInternalValue(newValue);
    }
    onChange?.(newValue);
  };
  
  return <input value={effectiveValue} onChange={(e) => handleChange(e.target.value)} />;
};
```

### Internal State with External Synchronization Pattern

**Purpose**: Components need to maintain internal state while staying synchronized with external data sources or parent component changes.

**Implementation Pattern**:

```typescript
export const SynchronizedComponent = ({ externalValue, onValueChange }: Props) => {
  const [internalState, setInternalState] = useState({
    value: externalValue || "",
    isDirty: false,
    lastSyncedValue: externalValue || "",
  });
  
  // Sync with external changes
  useEffect(() => {
    if (externalValue !== internalState.lastSyncedValue) {
      setInternalState(prev => ({
        ...prev,
        value: externalValue || "",
        lastSyncedValue: externalValue || "",
        isDirty: false,
      }));
    }
  }, [externalValue, internalState.lastSyncedValue]);
  
  const handleInternalChange = (newValue: string) => {
    setInternalState(prev => ({
      ...prev,
      value: newValue,
      isDirty: newValue !== prev.lastSyncedValue,
    }));
    
    // Debounced external notification
    onValueChange?.(newValue);
  };
  
  return (
    <div>
      <input 
        value={internalState.value} 
        onChange={(e) => handleInternalChange(e.target.value)} 
      />
      {internalState.isDirty && <span>*</span>}
    </div>
  );
};
```

### Context Consumption for Shared State Pattern

**Purpose**: Components need access to shared state across component trees without prop drilling, such as themes, user authentication, or application-wide settings.

**Implementation Pattern**:

```typescript
// Theme context example
const ThemeContext = createContext<{
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}>({
  theme: 'light',
  toggleTheme: () => {},
});

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  
  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  }, []);
  
  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);
  
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

// Component consuming theme context
export const ThemedComponent = ({ children }: Props) => {
  const { theme, toggleTheme } = useContext(ThemeContext);
  
  return (
    <div className={`theme-${theme}`}>
      {children}
      <button onClick={toggleTheme}>Toggle Theme</button>
    </div>
  );
};

// Form context example for shared form state
const FormContext = createContext<{
  formData: Record<string, any>;
  updateField: (field: string, value: any) => void;
  errors: Record<string, string>;
}>({
  formData: {},
  updateField: () => {},
  errors: {},
});

export const FormFieldComponent = ({ fieldName }: { fieldName: string }) => {
  const { formData, updateField, errors } = useContext(FormContext);
  
  return (
    <div>
      <input
        value={formData[fieldName] || ''}
        onChange={(e) => updateField(fieldName, e.target.value)}
      />
      {errors[fieldName] && <span className="error">{errors[fieldName]}</span>}
    </div>
  );
};
```

### Effect Hooks for Side Effects and Cleanup Pattern

**Purpose**: Components need to handle side effects like data fetching, subscriptions, timers, and external API interactions while ensuring proper cleanup to prevent memory leaks.

**Implementation Pattern**:

```typescript
export const EffectfulComponent = ({ url, pollingInterval }: Props) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Data fetching effect
  useEffect(() => {
    let isCancelled = false;
    
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch(url);
        const result = await response.json();
        
        if (!isCancelled) {
          setData(result);
        }
      } catch (err) {
        if (!isCancelled) {
          setError(err.message);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };
    
    fetchData();
    
    // Cleanup function
    return () => {
      isCancelled = true;
    };
  }, [url]);
  
  // Polling effect with cleanup
  useEffect(() => {
    if (!pollingInterval) return;
    
    const interval = setInterval(() => {
      // Refetch data
      fetch(url)
        .then(res => res.json())
        .then(setData)
        .catch(setError);
    }, pollingInterval);
    
    return () => clearInterval(interval);
  }, [url, pollingInterval]);
  
  // Event listener effect
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Refetch when tab becomes visible
        setData(null);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);
  
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  return <div>{JSON.stringify(data)}</div>;
};
```

### XMLUI State Management using updateState/state Reducer Pattern

**Purpose**: XMLUI components need to integrate with the framework's container-based state management system, enabling complex state sharing across component hierarchies and integration with XMLUI's binding expressions and event system.

**Implementation Pattern**:

```typescript
// XMLUI component renderer using updateState/state pattern
export const xmluiInputComponentRenderer = createComponentRenderer(
  COMP,
  ComponentMd,
  ({ node, state, updateState, extractValue, lookupEventHandler, registerComponentApi }) => {
    // State is managed by XMLUI's container system
    const currentValue = state.value || extractValue(node.props.initialValue);
    
    return (
      <InputNative
        value={currentValue}
        updateState={updateState} // Pass XMLUI's state updater
        initialValue={extractValue(node.props.initialValue)}
        onDidChange={lookupEventHandler("didChange")}
        registerComponentApi={registerComponentApi}
        placeholder={extractValue(node.props.placeholder)}
      />
    );
  },
);

// Native component using XMLUI state management
export const InputNative = ({ 
  value, 
  updateState, 
  initialValue, 
  onDidChange,
  registerComponentApi 
}: Props) => {
  const [localValue, setLocalValue] = useState(value || initialValue || "");
  
  // Sync with XMLUI state changes
  useEffect(() => {
    if (value !== undefined && value !== localValue) {
      setLocalValue(value);
    }
  }, [value, localValue]);
  
  const handleChange = useCallback((newValue: string) => {
    setLocalValue(newValue);
    
    // Update XMLUI container state through reducer pattern
    updateState({ value: newValue });
    
    // Trigger XMLUI event handlers
    onDidChange?.();
  }, [updateState, onDidChange]);
  
  // Register imperative API with XMLUI
  useEffect(() => {
    registerComponentApi({
      setValue: (newValue: string) => {
        setLocalValue(newValue);
        updateState({ value: newValue });
      },
      getValue: () => localValue,
      focus: () => {
        // Focus implementation
      },
    });
  }, [registerComponentApi, localValue, updateState]);
  
  return (
    <input
      value={localValue}
      onChange={(e) => handleChange(e.target.value)}
    />
  );
};

// Complex state update patterns
export const ComplexStateComponent = ({ state, updateState }: Props) => {
  const handleComplexUpdate = () => {
    // Update multiple state properties atomically
    updateState({
      currentPage: 1,
      filters: { category: 'electronics', minPrice: 100 },
      sortBy: 'price',
      lastUpdated: Date.now(),
    });
  };
  
  const handleNestedUpdate = () => {
    // Update nested state properties
    updateState({
      'user.preferences.theme': 'dark',
      'user.preferences.notifications': true,
    });
  };
  
  return (
    <div>
      <button onClick={handleComplexUpdate}>Update Multiple Fields</button>
      <button onClick={handleNestedUpdate}>Update Nested Fields</button>
    </div>
  );
};
```

**Key Benefits of Each Pattern**:
- **Controlled/Uncontrolled**: Clear data flow, predictable behavior, flexible usage patterns
- **External Synchronization**: Maintains UI responsiveness while staying in sync with external data
- **Context Consumption**: Eliminates prop drilling, centralizes shared state, improves maintainability
- **Effect Hooks**: Proper lifecycle management, memory leak prevention, external system integration
- **XMLUI State Management**: Framework integration, binding expression support, container hierarchy benefits, imperative API registration

## Event Handling Patterns

**Purpose**: Components need robust, accessible, and performant event handling to respond to user interactions, manage complex input scenarios, and integrate with both React and XMLUI event systems. These patterns solve challenges around event propagation, accessibility, keyboard navigation, and framework integration.

### Event Callback Prop Pattern

**Purpose**: Components need flexible event handling that supports optional callbacks while maintaining predictable behavior when handlers are not provided.

**Implementation Pattern**:

```typescript
interface Props {
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onFocus?: (event: React.FocusEvent<HTMLButtonElement>) => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
  onValueChange?: (value: string, event: React.ChangeEvent<HTMLInputElement>) => void;
}

export const EventHandlerComponent = ({
  onClick,
  onFocus,
  onKeyDown,
  onValueChange,
  children
}: Props) => {
  const [value, setValue] = useState("");

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    // Internal logic
    console.log("Button clicked");
    
    // Call optional external handler
    onClick?.(event);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    // Handle specific keys internally
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleClick(event as any);
    }
    
    // Call optional external handler
    onKeyDown?.(event);
  };

  const handleValueChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    setValue(newValue);
    
    // Pass both value and event to external handler
    onValueChange?.(newValue, event);
  };

  return (
    <div>
      <input
        value={value}
        onChange={handleValueChange}
        onFocus={onFocus}
      />
      <button
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onFocus={onFocus}
      >
        {children}
      </button>
    </div>
  );
};
```

### Event Object Creation and Propagation Pattern

**Purpose**: Components need to create custom event objects and control event propagation for complex interactions and framework integration.

**Implementation Pattern**:

```typescript
// Custom event types
interface CustomChangeEvent {
  type: 'change';
  value: string;
  previousValue: string;
  isValid: boolean;
  timestamp: number;
}

interface CustomSelectionEvent {
  type: 'selection';
  selectedItems: string[];
  action: 'add' | 'remove' | 'clear';
  item?: string;
}

export const CustomEventComponent = ({
  onSelectionChange,
  onValidatedChange
}: {
  onSelectionChange?: (event: CustomSelectionEvent) => void;
  onValidatedChange?: (event: CustomChangeEvent) => void;
}) => {
  const [value, setValue] = useState("");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const createChangeEvent = (newValue: string, previousValue: string): CustomChangeEvent => ({
    type: 'change',
    value: newValue,
    previousValue,
    isValid: newValue.length >= 3,
    timestamp: Date.now(),
  });

  const handleValueChange = (newValue: string) => {
    const changeEvent = createChangeEvent(newValue, value);
    setValue(newValue);
    
    // Only trigger external handler if validation passes
    if (changeEvent.isValid) {
      onValidatedChange?.(changeEvent);
    }
  };

  const handleItemSelection = (item: string, action: 'add' | 'remove') => {
    let newSelection: string[];
    
    if (action === 'add') {
      newSelection = [...selectedItems, item];
    } else {
      newSelection = selectedItems.filter(i => i !== item);
    }
    
    setSelectedItems(newSelection);
    
    const selectionEvent: CustomSelectionEvent = {
      type: 'selection',
      selectedItems: newSelection,
      action,
      item,
    };
    
    onSelectionChange?.(selectionEvent);
  };

  return (
    <div>
      <input
        value={value}
        onChange={(e) => handleValueChange(e.target.value)}
        placeholder="Type at least 3 characters"
      />
      <div>
        {['apple', 'banana', 'cherry'].map(item => (
          <button
            key={item}
            onClick={() => handleItemSelection(
              item, 
              selectedItems.includes(item) ? 'remove' : 'add'
            )}
            className={selectedItems.includes(item) ? 'selected' : ''}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
};
```

### Keyboard Event Handling with Accessibility Pattern

**Purpose**: Components need comprehensive keyboard support for accessibility compliance and enhanced user experience, following ARIA patterns and keyboard navigation standards.

**Implementation Pattern**:

```typescript
export const AccessibleComponent = ({
  items,
  onItemSelect,
  onEscape
}: {
  items: string[];
  onItemSelect?: (item: string) => void;
  onEscape?: () => void;
}) => {
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setFocusedIndex(prev => 
          prev < items.length - 1 ? prev + 1 : 0
        );
        break;
        
      case 'ArrowUp':
        event.preventDefault();
        setFocusedIndex(prev => 
          prev > 0 ? prev - 1 : items.length - 1
        );
        break;
        
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (isOpen && items[focusedIndex]) {
          onItemSelect?.(items[focusedIndex]);
          setIsOpen(false);
        } else {
          setIsOpen(true);
        }
        break;
        
      case 'Escape':
        event.preventDefault();
        setIsOpen(false);
        onEscape?.();
        break;
        
      case 'Home':
        event.preventDefault();
        setFocusedIndex(0);
        break;
        
      case 'End':
        event.preventDefault();
        setFocusedIndex(items.length - 1);
        break;
        
      case 'Tab':
        // Allow normal tab behavior
        setIsOpen(false);
        break;
        
      default:
        // Handle alphanumeric navigation
        if (event.key.length === 1) {
          const char = event.key.toLowerCase();
          const nextIndex = items.findIndex((item, index) => 
            index > focusedIndex && 
            item.toLowerCase().startsWith(char)
          );
          if (nextIndex !== -1) {
            setFocusedIndex(nextIndex);
          }
        }
        break;
    }
  };

  // Focus management
  useEffect(() => {
    if (isOpen && itemRefs.current[focusedIndex]) {
      itemRefs.current[focusedIndex]?.focus();
    }
  }, [focusedIndex, isOpen]);

  return (
    <div
      role="combobox"
      aria-expanded={isOpen}
      aria-haspopup="listbox"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle dropdown"
      >
        Select Item
      </button>
      
      {isOpen && (
        <ul
          ref={listRef}
          role="listbox"
          aria-label="Available options"
        >
          {items.map((item, index) => (
            <li
              key={item}
              ref={el => itemRefs.current[index] = el}
              role="option"
              aria-selected={index === focusedIndex}
              tabIndex={-1}
              onClick={() => {
                onItemSelect?.(item);
                setIsOpen(false);
              }}
              onMouseEnter={() => setFocusedIndex(index)}
              className={index === focusedIndex ? 'focused' : ''}
            >
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
```

### Mouse/Touch Interaction Pattern

**Purpose**: Components need to handle complex mouse and touch interactions including drag and drop, gestures, and multi-touch scenarios while maintaining performance.

**Implementation Pattern**:

```typescript
export const InteractiveComponent = ({
  onDragComplete,
  onTap,
  onLongPress
}: {
  onDragComplete?: (startPos: { x: number; y: number }, endPos: { x: number; y: number }) => void;
  onTap?: () => void;
  onLongPress?: () => void;
}) => {
  const [dragState, setDragState] = useState<{
    isDragging: boolean;
    startPos: { x: number; y: number } | null;
    currentPos: { x: number; y: number } | null;
  }>({
    isDragging: false,
    startPos: null,
    currentPos: null,
  });

  const longPressTimerRef = useRef<NodeJS.Timeout>();
  const tapStartTimeRef = useRef<number>(0);

  const handleMouseDown = (event: React.MouseEvent) => {
    const pos = { x: event.clientX, y: event.clientY };
    setDragState({
      isDragging: false,
      startPos: pos,
      currentPos: pos,
    });

    tapStartTimeRef.current = Date.now();

    // Start long press timer
    longPressTimerRef.current = setTimeout(() => {
      onLongPress?.();
    }, 500);
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    if (dragState.startPos) {
      const currentPos = { x: event.clientX, y: event.clientY };
      const distance = Math.sqrt(
        Math.pow(currentPos.x - dragState.startPos.x, 2) +
        Math.pow(currentPos.y - dragState.startPos.y, 2)
      );

      // Start dragging if moved more than 5 pixels
      if (distance > 5) {
        setDragState(prev => ({
          ...prev,
          isDragging: true,
          currentPos,
        }));

        // Cancel long press if dragging
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
        }
      }
    }
  };

  const handleMouseUp = (event: React.MouseEvent) => {
    const endPos = { x: event.clientX, y: event.clientY };

    // Clear long press timer
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }

    if (dragState.isDragging && dragState.startPos) {
      onDragComplete?.(dragState.startPos, endPos);
    } else if (dragState.startPos) {
      // Check if it's a tap (quick and didn't move much)
      const tapDuration = Date.now() - tapStartTimeRef.current;
      const distance = Math.sqrt(
        Math.pow(endPos.x - dragState.startPos.x, 2) +
        Math.pow(endPos.y - dragState.startPos.y, 2)
      );

      if (tapDuration < 500 && distance < 5) {
        onTap?.();
      }
    }

    setDragState({
      isDragging: false,
      startPos: null,
      currentPos: null,
    });
  };

  // Touch events for mobile support
  const handleTouchStart = (event: React.TouchEvent) => {
    const touch = event.touches[0];
    handleMouseDown({
      clientX: touch.clientX,
      clientY: touch.clientY,
    } as React.MouseEvent);
  };

  const handleTouchMove = (event: React.TouchEvent) => {
    event.preventDefault(); // Prevent scrolling
    const touch = event.touches[0];
    handleMouseMove({
      clientX: touch.clientX,
      clientY: touch.clientY,
    } as React.MouseEvent);
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    const touch = event.changedTouches[0];
    handleMouseUp({
      clientX: touch.clientX,
      clientY: touch.clientY,
    } as React.MouseEvent);
  };

  return (
    <div
      style={{
        width: 200,
        height: 200,
        backgroundColor: dragState.isDragging ? '#e0e0e0' : '#f0f0f0',
        border: '2px solid #ccc',
        cursor: dragState.isDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        position: 'relative',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp} // Handle mouse leaving component
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div>Interactive Area</div>
      {dragState.isDragging && dragState.startPos && dragState.currentPos && (
        <div
          style={{
            position: 'absolute',
            left: Math.min(dragState.startPos.x, dragState.currentPos.x) - 200,
            top: Math.min(dragState.startPos.y, dragState.currentPos.y) - 200,
            width: Math.abs(dragState.currentPos.x - dragState.startPos.x),
            height: Math.abs(dragState.currentPos.y - dragState.startPos.y),
            border: '2px dashed #007acc',
            backgroundColor: 'rgba(0, 122, 204, 0.1)',
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  );
};
```

**Key Benefits of Each Pattern**:
- **Event Callback Props**: Flexible, optional event handling with predictable defaults
- **Custom Event Objects**: Rich event data, controlled propagation, framework integration
- **Keyboard Accessibility**: WCAG compliance, enhanced UX, comprehensive navigation support
- **Mouse/Touch Interactions**: Cross-platform compatibility, gesture recognition, performance optimization

## API Registration and Programmatic Control Patterns

**Purpose**: XMLUI components need to expose programmatic APIs that allow parent components and external systems to control behavior imperatively. This enables complex interactions like focus management, value manipulation, data refresh, and animation control beyond what declarative props can provide.

### Basic API Registration Pattern

**Purpose**: Components need to expose simple methods for common operations like focus, blur, and value access that can be called from XMLUI event handlers or external JavaScript.

**Implementation Pattern**:

```typescript
// Native component with imperative API
export const InputNative = forwardRef<HTMLInputElement, Props>(
  function InputNative({ registerComponentApi, updateState, onDidChange }, ref) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [value, setValue] = useState("");

    // Register API methods with XMLUI framework
    useEffect(() => {
      if (registerComponentApi) {
        registerComponentApi({
          // Basic DOM operations
          focus: () => inputRef.current?.focus(),
          blur: () => inputRef.current?.blur(),
          
          // Value operations
          getValue: () => value,
          setValue: (newValue: string) => {
            setValue(newValue);
            updateState?.({ value: newValue });
            onDidChange?.();
          },
          
          // Validation operations
          isValid: () => value.length >= 3,
          validate: () => {
            const valid = value.length >= 3;
            updateState?.({ isValid: valid });
            return valid;
          },
        });
      }
    }, [registerComponentApi, value, updateState, onDidChange]);

    return (
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
    );
  }
);

// XMLUI renderer with API registration
export const inputComponentRenderer = createComponentRenderer(
  "Input",
  InputMd,
  ({ node, registerComponentApi, extractValue, updateState, lookupEventHandler }) => {
    return (
      <InputNative
        ref={(instance) => {
          // Forward imperative API to XMLUI
          if (instance && registerComponentApi) {
            registerComponentApi(instance);
          }
        }}
        registerComponentApi={registerComponentApi}
        updateState={updateState}
        onDidChange={lookupEventHandler("didChange")}
        placeholder={extractValue(node.props.placeholder)}
      />
    );
  },
);
```

### Async API Operations Pattern

**Purpose**: Components need to expose asynchronous operations like data fetching, file operations, or animations that return promises and can be awaited by calling code.

**Implementation Pattern**:

```typescript
export const DataTableNative = forwardRef<DataTableAPI, Props>(
  function DataTableNative({ registerComponentApi, dataSource, updateState }) {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refreshData = async (): Promise<void> => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch(dataSource);
        const newData = await response.json();
        setData(newData);
        updateState?.({ data: newData, lastRefresh: Date.now() });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        updateState?.({ error: errorMessage });
        throw err; // Re-throw for caller handling
      } finally {
        setLoading(false);
      }
    };

    const exportData = async (format: 'csv' | 'json' | 'xlsx'): Promise<Blob> => {
      switch (format) {
        case 'csv':
          const csvContent = data.map(row => 
            Object.values(row).join(',')
          ).join('\n');
          return new Blob([csvContent], { type: 'text/csv' });
          
        case 'json':
          return new Blob([JSON.stringify(data, null, 2)], { 
            type: 'application/json' 
          });
          
        case 'xlsx':
          // Simulate async Excel generation
          await new Promise(resolve => setTimeout(resolve, 1000));
          return new Blob(['Excel data'], { 
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
          });
          
        default:
          throw new Error(`Unsupported format: ${format}`);
      }
    };

    const searchData = async (query: string): Promise<any[]> => {
      // Simulate async search
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const results = data.filter(item =>
        Object.values(item).some(value =>
          String(value).toLowerCase().includes(query.toLowerCase())
        )
      );
      
      updateState?.({ searchResults: results, searchQuery: query });
      return results;
    };

    // Register async API methods
    useEffect(() => {
      if (registerComponentApi) {
        registerComponentApi({
          // Async data operations
          refreshData,
          exportData,
          searchData,
          
          // Sync getters
          getData: () => data,
          getRowCount: () => data.length,
          isLoading: () => loading,
          hasError: () => error !== null,
          getError: () => error,
          
          // Selection operations
          selectRow: (index: number) => {
            updateState?.({ selectedRowIndex: index });
          },
          selectAll: () => {
            updateState?.({ selectedRows: data.map((_, i) => i) });
          },
          clearSelection: () => {
            updateState?.({ selectedRows: [], selectedRowIndex: -1 });
          },
        });
      }
    }, [registerComponentApi, data, loading, error, updateState]);

    return (
      <div className="data-table">
        {loading && <div>Loading...</div>}
        {error && <div className="error">Error: {error}</div>}
        <table>
          <tbody>
            {data.map((row, index) => (
              <tr key={index}>
                {Object.values(row).map((value, colIndex) => (
                  <td key={colIndex}>{String(value)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
);
```

### Complex State Management API Pattern

**Purpose**: Components with complex internal state need APIs that allow external control over multiple state aspects while maintaining internal consistency and validation.

**Implementation Pattern**:

```typescript
interface FormState {
  values: Record<string, any>;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  isSubmitting: boolean;
  isDirty: boolean;
}

export const FormNative = forwardRef<FormAPI, Props>(
  function FormNative({ registerComponentApi, updateState, onValidationChange }) {
    const [formState, setFormState] = useState<FormState>({
      values: {},
      errors: {},
      touched: {},
      isSubmitting: false,
      isDirty: false,
    });

    const validators = useRef<Record<string, (value: any) => string | null>>({});

    const validateField = (fieldName: string, value: any): string | null => {
      const validator = validators.current[fieldName];
      return validator ? validator(value) : null;
    };

    const validateForm = (): Record<string, string> => {
      const errors: Record<string, string> = {};
      
      Object.keys(formState.values).forEach(fieldName => {
        const error = validateField(fieldName, formState.values[fieldName]);
        if (error) {
          errors[fieldName] = error;
        }
      });
      
      return errors;
    };

    const setFieldValue = (fieldName: string, value: any, shouldValidate = true) => {
      setFormState(prev => {
        const newValues = { ...prev.values, [fieldName]: value };
        const newErrors = { ...prev.errors };
        
        if (shouldValidate) {
          const error = validateField(fieldName, value);
          if (error) {
            newErrors[fieldName] = error;
          } else {
            delete newErrors[fieldName];
          }
        }
        
        const newState = {
          ...prev,
          values: newValues,
          errors: newErrors,
          isDirty: true,
        };
        
        // Update XMLUI state
        updateState?.({
          formValues: newValues,
          formErrors: newErrors,
          formIsDirty: true,
        });
        
        return newState;
      });
    };

    const resetForm = (newValues?: Record<string, any>) => {
      const resetState: FormState = {
        values: newValues || {},
        errors: {},
        touched: {},
        isSubmitting: false,
        isDirty: false,
      };
      
      setFormState(resetState);
      updateState?.({
        formValues: resetState.values,
        formErrors: resetState.errors,
        formIsDirty: false,
      });
    };

    const submitForm = async (): Promise<boolean> => {
      setFormState(prev => ({ ...prev, isSubmitting: true }));
      
      try {
        const errors = validateForm();
        
        if (Object.keys(errors).length > 0) {
          setFormState(prev => ({
            ...prev,
            errors,
            isSubmitting: false,
            touched: Object.keys(prev.values).reduce((acc, key) => ({
              ...acc,
              [key]: true,
            }), {}),
          }));
          
          onValidationChange?.(false, errors);
          return false;
        }
        
        // Form is valid, proceed with submission
        onValidationChange?.(true, {});
        return true;
        
      } catch (error) {
        setFormState(prev => ({ ...prev, isSubmitting: false }));
        throw error;
      }
    };

    // Register comprehensive form API
    useEffect(() => {
      if (registerComponentApi) {
        registerComponentApi({
          // Field operations
          setFieldValue,
          getFieldValue: (fieldName: string) => formState.values[fieldName],
          setFieldError: (fieldName: string, error: string) => {
            setFormState(prev => ({
              ...prev,
              errors: { ...prev.errors, [fieldName]: error },
            }));
          },
          clearFieldError: (fieldName: string) => {
            setFormState(prev => {
              const newErrors = { ...prev.errors };
              delete newErrors[fieldName];
              return { ...prev, errors: newErrors };
            });
          },
          
          // Validation operations
          validateField: (fieldName: string) => {
            const error = validateField(fieldName, formState.values[fieldName]);
            if (error) {
              setFormState(prev => ({
                ...prev,
                errors: { ...prev.errors, [fieldName]: error },
              }));
            }
            return !error;
          },
          validateForm: () => {
            const errors = validateForm();
            setFormState(prev => ({ ...prev, errors }));
            return Object.keys(errors).length === 0;
          },
          registerValidator: (fieldName: string, validator: (value: any) => string | null) => {
            validators.current[fieldName] = validator;
          },
          
          // Form operations
          submitForm,
          resetForm,
          setValues: (values: Record<string, any>) => {
            setFormState(prev => ({
              ...prev,
              values: { ...prev.values, ...values },
              isDirty: true,
            }));
          },
          
          // State getters
          getValues: () => formState.values,
          getErrors: () => formState.errors,
          isDirty: () => formState.isDirty,
          isSubmitting: () => formState.isSubmitting,
          isValid: () => Object.keys(formState.errors).length === 0,
        });
      }
    }, [registerComponentApi, formState, updateState, onValidationChange]);

    return (
      <form onSubmit={(e) => { e.preventDefault(); submitForm(); }}>
        {/* Form content will be rendered by child components */}
        <div className="form-content">
          {/* Child components access form state through context */}
        </div>
      </form>
    );
  }
);
```

### Animation and Media Control API Pattern

**Purpose**: Components that handle animations, media playback, or complex visual effects need APIs for controlling timing, playback state, and visual transitions.

**Implementation Pattern**:

```typescript
export const VideoPlayerNative = forwardRef<VideoPlayerAPI, Props>(
  function VideoPlayerNative({ registerComponentApi, updateState, onPlaybackChange }) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [playerState, setPlayerState] = useState({
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      volume: 1,
      playbackRate: 1,
      isFullscreen: false,
    });

    const play = async (): Promise<void> => {
      if (videoRef.current) {
        await videoRef.current.play();
        setPlayerState(prev => ({ ...prev, isPlaying: true }));
        updateState?.({ isPlaying: true });
        onPlaybackChange?.('play');
      }
    };

    const pause = (): void => {
      if (videoRef.current) {
        videoRef.current.pause();
        setPlayerState(prev => ({ ...prev, isPlaying: false }));
        updateState?.({ isPlaying: false });
        onPlaybackChange?.('pause');
      }
    };

    const seekTo = (timeInSeconds: number): void => {
      if (videoRef.current) {
        videoRef.current.currentTime = timeInSeconds;
        setPlayerState(prev => ({ ...prev, currentTime: timeInSeconds }));
        updateState?.({ currentTime: timeInSeconds });
      }
    };

    const setVolume = (volume: number): void => {
      const clampedVolume = Math.max(0, Math.min(1, volume));
      if (videoRef.current) {
        videoRef.current.volume = clampedVolume;
        setPlayerState(prev => ({ ...prev, volume: clampedVolume }));
        updateState?.({ volume: clampedVolume });
      }
    };

    const setPlaybackRate = (rate: number): void => {
      if (videoRef.current) {
        videoRef.current.playbackRate = rate;
        setPlayerState(prev => ({ ...prev, playbackRate: rate }));
        updateState?.({ playbackRate: rate });
      }
    };

    const toggleFullscreen = async (): Promise<void> => {
      if (!document.fullscreenElement) {
        await videoRef.current?.requestFullscreen();
        setPlayerState(prev => ({ ...prev, isFullscreen: true }));
      } else {
        await document.exitFullscreen();
        setPlayerState(prev => ({ ...prev, isFullscreen: false }));
      }
    };

    const captureFrame = (): string | null => {
      if (videoRef.current) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (ctx) {
          canvas.width = videoRef.current.videoWidth;
          canvas.height = videoRef.current.videoHeight;
          ctx.drawImage(videoRef.current, 0, 0);
          return canvas.toDataURL('image/png');
        }
      }
      return null;
    };

    // Register media control API
    useEffect(() => {
      if (registerComponentApi) {
        registerComponentApi({
          // Playback controls
          play,
          pause,
          stop: () => {
            pause();
            seekTo(0);
          },
          toggle: () => playerState.isPlaying ? pause() : play(),
          
          // Navigation controls
          seekTo,
          seekBy: (deltaSeconds: number) => {
            seekTo(playerState.currentTime + deltaSeconds);
          },
          seekToPercentage: (percentage: number) => {
            seekTo((percentage / 100) * playerState.duration);
          },
          
          // Audio controls
          setVolume,
          mute: () => setVolume(0),
          unmute: () => setVolume(1),
          adjustVolume: (delta: number) => {
            setVolume(playerState.volume + delta);
          },
          
          // Playback rate controls
          setPlaybackRate,
          setSpeed: setPlaybackRate, // Alias for common usage
          normalSpeed: () => setPlaybackRate(1),
          
          // Display controls
          toggleFullscreen,
          enterFullscreen: () => {
            if (!document.fullscreenElement) {
              toggleFullscreen();
            }
          },
          exitFullscreen: () => {
            if (document.fullscreenElement) {
              toggleFullscreen();
            }
          },
          
          // Utility functions
          captureFrame,
          getCurrentTime: () => playerState.currentTime,
          getDuration: () => playerState.duration,
          getVolume: () => playerState.volume,
          getPlaybackRate: () => playerState.playbackRate,
          isPlaying: () => playerState.isPlaying,
          isFullscreen: () => playerState.isFullscreen,
          
          // Advanced controls
          setCurrentTime: seekTo, // Alias for clarity
          getCurrentTimePercentage: () => 
            playerState.duration > 0 ? (playerState.currentTime / playerState.duration) * 100 : 0,
        });
      }
    }, [registerComponentApi, playerState, updateState, onPlaybackChange]);

    return (
      <video
        ref={videoRef}
        onTimeUpdate={(e) => {
          const currentTime = e.currentTarget.currentTime;
          setPlayerState(prev => ({ ...prev, currentTime }));
          updateState?.({ currentTime });
        }}
        onLoadedMetadata={(e) => {
          const duration = e.currentTarget.duration;
          setPlayerState(prev => ({ ...prev, duration }));
          updateState?.({ duration });
        }}
        controls
      />
    );
  }
);
```

**Key Benefits of API Registration Patterns**:
- **Basic API Registration**: Simple imperative operations, consistent interface, framework integration
- **Async Operations**: Promise-based APIs, error handling, progress tracking, external system integration
- **Complex State Management**: Multi-faceted control, validation integration, state consistency, external synchronization
- **Animation/Media Control**: Real-time control, frame-accurate operations, hardware integration, performance optimization

## XMLUI Renderer Patterns

**Purpose**: XMLUI renderer functions need consistent, efficient patterns for translating component markup into React elements while handling complex scenarios like child rendering, state management, and dynamic property passing. These patterns solve architectural challenges and ensure optimal performance across the component ecosystem.

### Standard Component Renderer Structure Pattern

**Purpose**: All XMLUI components need consistent renderer structure for maintainability, debugging, and framework integration. This pattern provides a standardized template that handles common concerns and reduces boilerplate.

**Implementation Pattern**:

```typescript
// Import dependencies
import { createComponentRenderer } from "../renderer-helpers";
import { ComponentNameMd } from "./ComponentNameMetadata";
import { ComponentNameNative } from "./ComponentNameNative";

// Component constant for consistency
const COMP = "ComponentName";

// Standard renderer structure
export const componentNameComponentRenderer = createComponentRenderer(
  COMP,                    // Component name (must match metadata)
  ComponentNameMd,         // Component metadata object
  ({                       // Destructured renderer context
    // Core context properties
    node,                  // Component definition with props/children
    extractValue,          // Value extraction with binding support
    renderChild,           // Child rendering function
    layoutCss,             // Pre-computed layout styles
    
    // State management
    state,                 // Current component state
    updateState,           // State update function
    
    // Event system
    lookupEventHandler,    // Event handler factory
    lookupAction,          // Async action lookup
    
    // API registration
    registerComponentApi,  // Component API registration
    
    // Context and utilities
    appContext,           // Application context
    uid,                  // Unique component identifier
    layoutContext,        // Layout context information
  }) => {
    
    // Extract and process props with proper defaults and typing
    const variant = extractValue.asOptionalString(node.props.variant, "primary");
    const enabled = extractValue.asOptionalBoolean(node.props.enabled, true);
    const label = extractValue.asDisplayText(node.props.label);
    const icon = extractValue.asString(node.props.icon);
    
    // Handle complex prop processing
    const processedProps = {
      variant,
      enabled,
      label,
      // Transform XMLUI props to native component props
      disabled: !enabled,
      showIcon: Boolean(icon),
      iconName: icon || undefined,
    };
    
    // Event handler creation with error boundaries
    const eventHandlers = {
      onClick: lookupEventHandler("click"),
      onFocus: lookupEventHandler("gotFocus"),
      onBlur: lookupEventHandler("lostFocus"),
      onValueChange: lookupEventHandler("didChange"),
    };
    
    // Conditional rendering logic
    if (!enabled && node.props.hideWhenDisabled) {
      return null;
    }
    
    // Return rendered component with all integrations
    return (
      <ComponentNameNative
        {...processedProps}
        {...eventHandlers}
        
        // Framework integration
        updateState={updateState}
        registerComponentApi={registerComponentApi}
        
        // Layout and styling
        style={layoutCss}
        className={extractValue.asString(node.props.className)}
        
        // Child content handling
        children={renderChild(node.children)}
        
        // Advanced props
        ref={(instance) => {
          if (instance && registerComponentApi) {
            registerComponentApi(instance);
          }
        }}
      />
    );
  },
);

// Export with consistent naming
export { componentNameComponentRenderer as componentNameRenderer };
```

### Child Rendering Patterns

**Purpose**: Components need different strategies for rendering child content depending on their role as containers, the type of children they accept, and the layout context they provide. This pattern optimizes performance and provides proper component composition.

**Implementation Pattern**:

```typescript
// Pattern 1: Simple pass-through rendering
export const simpleContainerRenderer = createComponentRenderer(
  "SimpleContainer",
  SimpleContainerMd,
  ({ node, renderChild, layoutCss }) => {
    return (
      <div style={layoutCss} className="simple-container">
        {/* Direct child rendering - preserves all children as-is */}
        {renderChild(node.children)}
      </div>
    );
  },
);

// Pattern 2: Layout context rendering with specific arrangements
export const stackContainerRenderer = createComponentRenderer(
  "Stack",
  StackMd,
  ({ node, extractValue, renderChild, layoutCss }) => {
    const orientation = extractValue.asOptionalString(node.props.orientation, "vertical");
    const spacing = extractValue.asOptionalString(node.props.spacing, "medium");
    const alignment = extractValue.asOptionalString(node.props.alignment, "start");
    
    return (
      <div 
        style={layoutCss} 
        className={`stack stack-${orientation} spacing-${spacing} align-${alignment}`}
      >
        {/* Render children with layout context for optimal arrangement */}
        {renderChild(node.children, {
          type: "Stack",
          orientation,
          spacing,
          alignment,
          // Layout hints for child components
          itemAlignment: alignment,
          crossAxisAlignment: extractValue.asOptionalString(node.props.crossAxisAlignment),
        })}
      </div>
    );
  },
);

// Pattern 3: Conditional child rendering based on component state
export const expandableContainerRenderer = createComponentRenderer(
  "ExpandableContainer",
  ExpandableContainerMd,
  ({ node, extractValue, renderChild, state, layoutCss }) => {
    const isExpanded = state.expanded || extractValue.asOptionalBoolean(node.props.defaultExpanded, false);
    const renderMode = extractValue.asOptionalString(node.props.renderMode, "lazy");
    
    return (
      <div style={layoutCss} className="expandable-container">
        <div className="header">
          {extractValue.asDisplayText(node.props.title)}
        </div>
        
        {/* Conditional rendering with performance optimization */}
        {isExpanded && (
          <div className="content">
            {renderMode === "lazy" 
              ? renderChild(node.children) // Render only when expanded
              : null // Children rendered separately with visibility control
            }
          </div>
        )}
        
        {/* Always render but control visibility for "eager" mode */}
        {renderMode === "eager" && (
          <div className={`content ${!isExpanded ? 'hidden' : ''}`}>
            {renderChild(node.children)}
          </div>
        )}
      </div>
    );
  },
);

// Pattern 4: Selective child rendering with filtering
export const tabContainerRenderer = createComponentRenderer(
  "TabContainer",
  TabContainerMd,
  ({ node, extractValue, renderChild, state, layoutCss }) => {
    const activeTabIndex = state.activeTabIndex || extractValue.asOptionalNumber(node.props.defaultActiveTab, 0);
    
    // Filter children to only render tab panels
    const tabPanels = node.children?.filter(child => child.component === "TabPanel") || [];
    const activePanel = tabPanels[activeTabIndex];
    
    return (
      <div style={layoutCss} className="tab-container">
        <div className="tab-headers">
          {tabPanels.map((panel, index) => (
            <button
              key={panel.uid || index}
              className={`tab-header ${index === activeTabIndex ? 'active' : ''}`}
              onClick={() => updateState({ activeTabIndex: index })}
            >
              {extractValue.asDisplayText(panel.props.title)}
            </button>
          ))}
        </div>
        
        <div className="tab-content">
          {/* Render only the active tab panel for performance */}
          {activePanel && renderChild([activePanel])}
        </div>
      </div>
    );
  },
);

// Pattern 5: Hybrid rendering - mix of children and direct props
export const buttonWithContentRenderer = createComponentRenderer(
  "ButtonWithContent",
  ButtonWithContentMd,
  ({ node, extractValue, renderChild, lookupEventHandler, layoutCss }) => {
    const label = extractValue.asDisplayText(node.props.label);
    const hasChildren = node.children && node.children.length > 0;
    
    return (
      <button
        style={layoutCss}
        className="button-with-content"
        onClick={lookupEventHandler("click")}
      >
        {/* Prioritize children over label prop */}
        {hasChildren 
          ? renderChild(node.children, { 
              type: "ButtonContent", 
              inline: true,
              // Pass button context to children
              buttonVariant: extractValue.asOptionalString(node.props.variant),
              buttonSize: extractValue.asOptionalString(node.props.size),
            })
          : label || "Button"
        }
      </button>
    );
  },
);

// Pattern 6: Performance-optimized rendering with memoization
export const dataListRenderer = createComponentRenderer(
  "DataList",
  DataListMd,
  ({ node, extractValue, renderChild, state, layoutCss }) => {
    const data = state.data || extractValue(node.props.data) || [];
    const itemTemplate = node.children?.find(child => child.component === "ItemTemplate");
    const emptyTemplate = node.children?.find(child => child.component === "EmptyTemplate");
    
    // Memoize expensive rendering operations
    const renderedItems = useMemo(() => {
      if (!itemTemplate || data.length === 0) return null;
      
      return data.map((item, index) => {
        // Clone template with item data context
        const itemNode = {
          ...itemTemplate,
          uid: `${itemTemplate.uid}-${index}`,
          // Inject item data into template context
          props: {
            ...itemTemplate.props,
            $item: item,
            $index: index,
          },
        };
        
        return renderChild([itemNode]);
      });
    }, [data, itemTemplate, renderChild]);
    
    return (
      <div style={layoutCss} className="data-list">
        {data.length > 0 
          ? renderedItems
          : emptyTemplate && renderChild([emptyTemplate])
        }
      </div>
    );
  },
);
```

### Conditional Property Passing Pattern

**Purpose**: Components need dynamic behavior based on state, props, or context conditions. This pattern enables responsive component behavior while maintaining performance and preventing unnecessary re-renders.

**Implementation Pattern**:

```typescript
// Pattern 1: State-based conditional props
export const dynamicInputRenderer = createComponentRenderer(
  "DynamicInput",
  DynamicInputMd,
  ({ node, extractValue, state, updateState, lookupEventHandler, layoutCss }) => {
    const inputType = extractValue.asOptionalString(node.props.type, "text");
    const isPassword = inputType === "password";
    const isReadOnly = state.readOnly || extractValue.asOptionalBoolean(node.props.readOnly, false);
    const hasError = Boolean(state.error);
    
    // Build dynamic props object
    const dynamicProps = {
      // Base props always present
      type: inputType,
      value: state.value || extractValue(node.props.value) || "",
      placeholder: extractValue.asString(node.props.placeholder),
      
      // Conditional props based on state and type
      ...(isPassword && {
        autoComplete: "current-password",
        spellCheck: false,
      }),
      
      ...(isReadOnly && {
        readOnly: true,
        tabIndex: -1,
      }),
      
      ...(hasError && {
        "aria-invalid": true,
        "aria-describedby": `${node.uid}-error`,
      }),
      
      // Performance optimization - only add expensive props when needed
      ...(extractValue.asOptionalBoolean(node.props.enableSpellCheck) && {
        spellCheck: true,
      }),
      
      // Conditional event handlers
      onChange: !isReadOnly ? lookupEventHandler("didChange") : undefined,
      onFocus: !isReadOnly ? lookupEventHandler("gotFocus") : undefined,
      onBlur: !isReadOnly ? lookupEventHandler("lostFocus") : undefined,
    };
    
    return (
      <div style={layoutCss} className="dynamic-input-container">
        <input
          {...dynamicProps}
          className={`input ${hasError ? 'error' : ''} ${isReadOnly ? 'readonly' : ''}`}
        />
        
        {/* Conditionally render error message */}
        {hasError && (
          <div id={`${node.uid}-error`} className="error-message">
            {state.error}
          </div>
        )}
        
        {/* Conditionally render password toggle */}
        {isPassword && !isReadOnly && (
          <button
            type="button"
            className="password-toggle"
            onClick={() => updateState({ showPassword: !state.showPassword })}
          >
            {state.showPassword ? "Hide" : "Show"}
          </button>
        )}
      </div>
    );
  },
);

// Pattern 2: Context-aware conditional rendering
export const responsiveCardRenderer = createComponentRenderer(
  "ResponsiveCard",
  ResponsiveCardMd,
  ({ node, extractValue, renderChild, layoutContext, appContext, layoutCss }) => {
    const variant = extractValue.asOptionalString(node.props.variant, "default");
    const size = extractValue.asOptionalString(node.props.size, "medium");
    
    // Determine rendering strategy based on context
    const isMobile = layoutContext?.breakpoint === "mobile" || appContext?.screenWidth < 768;
    const isInGrid = layoutContext?.type === "Grid";
    const isInStack = layoutContext?.type === "Stack";
    
    // Build conditional style and behavior props
    const conditionalProps = {
      // Base styling
      className: `card card-${variant} card-${size}`,
      
      // Context-aware modifications
      ...(isMobile && {
        className: `card card-${variant} card-${size} card-mobile`,
        // Simplified props for mobile
        showSecondaryActions: false,
        compactMode: true,
      }),
      
      ...(isInGrid && {
        // Grid-specific optimizations
        className: `card card-${variant} card-${size} card-in-grid`,
        aspectRatio: extractValue.asOptionalString(node.props.aspectRatio, "auto"),
      }),
      
      ...(isInStack && layoutContext.orientation === "horizontal" && {
        // Horizontal stack optimizations
        className: `card card-${variant} card-${size} card-horizontal`,
        layout: "horizontal",
      }),
    };
    
    // Conditional feature rendering based on capabilities
    const showAdvancedFeatures = !isMobile && appContext?.features?.advancedCardFeatures !== false;
    const showAnimations = appContext?.settings?.enableAnimations !== false;
    
    return (
      <div
        style={layoutCss}
        {...conditionalProps}
        {...(showAnimations && {
          className: `${conditionalProps.className} animated`,
        })}
      >
        {/* Always render main content */}
        <div className="card-content">
          {renderChild(node.children?.filter(child => 
            child.component !== "CardActions" && child.component !== "CardMenu"
          ))}
        </div>
        
        {/* Conditionally render advanced features */}
        {showAdvancedFeatures && (
          <>
            {node.children?.find(child => child.component === "CardActions") && (
              <div className="card-actions">
                {renderChild(node.children.filter(child => child.component === "CardActions"))}
              </div>
            )}
            
            {node.children?.find(child => child.component === "CardMenu") && (
              <div className="card-menu">
                {renderChild(node.children.filter(child => child.component === "CardMenu"))}
              </div>
            )}
          </>
        )}
      </div>
    );
  },
);

// Pattern 3: Performance-optimized conditional props with memoization
export const optimizedDataTableRenderer = createComponentRenderer(
  "OptimizedDataTable",
  OptimizedDataTableMd,
  ({ node, extractValue, state, renderChild, layoutCss }) => {
    const data = state.data || [];
    const columns = extractValue(node.props.columns) || [];
    const enableVirtualization = extractValue.asOptionalBoolean(node.props.enableVirtualization, data.length > 100);
    const enableSorting = extractValue.asOptionalBoolean(node.props.enableSorting, true);
    const enableFiltering = extractValue.asOptionalBoolean(node.props.enableFiltering, false);
    
    // Memoize expensive conditional props
    const tableProps = useMemo(() => ({
      // Base props
      data,
      columns,
      
      // Conditional feature props - only compute when needed
      ...(enableVirtualization && {
        virtualizer: {
          itemHeight: extractValue.asOptionalNumber(node.props.rowHeight, 40),
          overscan: extractValue.asOptionalNumber(node.props.overscan, 5),
        },
      }),
      
      ...(enableSorting && {
        sortConfig: {
          defaultSort: extractValue(node.props.defaultSort),
          multiSort: extractValue.asOptionalBoolean(node.props.multiSort, false),
        },
      }),
      
      ...(enableFiltering && {
        filterConfig: {
          globalFilter: state.globalFilter,
          columnFilters: state.columnFilters || {},
        },
      }),
      
      // Performance props based on data size
      ...(data.length > 1000 && {
        deferredRendering: true,
        batchSize: 50,
      }),
      
    }), [data, columns, enableVirtualization, enableSorting, enableFiltering, state]);
    
    // Conditional className based on features and state
    const tableClassName = [
      "data-table",
      enableVirtualization && "virtualized",
      enableSorting && "sortable",
      enableFiltering && "filterable",
      data.length > 1000 && "large-dataset",
      state.isLoading && "loading",
    ].filter(Boolean).join(" ");
    
    return (
      <div style={layoutCss} className="data-table-container">
        {/* Conditionally render filter UI */}
        {enableFiltering && (
          <div className="table-filters">
            {renderChild(node.children?.filter(child => child.component === "TableFilter"))}
          </div>
        )}
        
        <div className={tableClassName}>
          {/* Render table with conditional props */}
          <DataTableNative
            {...tableProps}
            updateState={updateState}
            registerComponentApi={registerComponentApi}
          />
        </div>
        
        {/* Conditionally render pagination for large datasets */}
        {data.length > 25 && (
          <div className="table-pagination">
            {renderChild(node.children?.filter(child => child.component === "TablePagination"))}
          </div>
        )}
      </div>
    );
  },
);
```

**Key Benefits of Renderer Patterns**:
- **Standard Structure**: Consistent architecture, reduced boilerplate, easier maintenance, debugging support
- **Child Rendering**: Flexible composition, performance optimization, layout context awareness, selective rendering
- **Conditional Properties**: Dynamic behavior, performance optimization, context awareness, responsive design support

## Performance Patterns

**Purpose**: React components need optimization strategies to handle large datasets, complex computations, and frequent updates without degrading user experience. These patterns solve performance bottlenecks through memoization, virtualization, lazy loading, and efficient update strategies.

### Memoization with useMemo and useCallback Pattern

**Purpose**: Components need to prevent expensive recalculations and avoid unnecessary re-renders of child components by memoizing computed values and stable function references.

**Implementation Pattern**:

```typescript
export const OptimizedDataProcessor = ({ 
  data, 
  filters, 
  sortConfig, 
  onDataChange,
  onSelectionChange 
}: Props) => {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  // Memoize expensive data transformations
  const filteredData = useMemo(() => {
    console.log("Computing filtered data..."); // Only logs when dependencies change
    
    return data.filter(item => {
      // Apply multiple filters
      const matchesSearch = searchQuery === "" || 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = !filters.category || 
        item.category === filters.category;
      
      const matchesDateRange = !filters.dateRange || 
        (item.date >= filters.dateRange.start && item.date <= filters.dateRange.end);
      
      return matchesSearch && matchesCategory && matchesDateRange;
    });
  }, [data, searchQuery, filters.category, filters.dateRange]);

  // Memoize expensive sorting operations
  const sortedData = useMemo(() => {
    console.log("Computing sorted data..."); // Only logs when dependencies change
    
    if (!sortConfig.field) return filteredData;
    
    return [...filteredData].sort((a, b) => {
      const aVal = a[sortConfig.field];
      const bVal = b[sortConfig.field];
      
      // Handle different data types
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }
      
      if (aVal instanceof Date && bVal instanceof Date) {
        return sortConfig.direction === 'asc' 
          ? aVal.getTime() - bVal.getTime() 
          : bVal.getTime() - aVal.getTime();
      }
      
      // String comparison
      const result = String(aVal).localeCompare(String(bVal));
      return sortConfig.direction === 'asc' ? result : -result;
    });
  }, [filteredData, sortConfig.field, sortConfig.direction]);

  // Memoize computed statistics
  const statistics = useMemo(() => {
    return {
      total: data.length,
      filtered: filteredData.length,
      selected: selectedItems.size,
      categories: [...new Set(data.map(item => item.category))].length,
      averageValue: data.reduce((sum, item) => sum + (item.value || 0), 0) / data.length,
    };
  }, [data, filteredData.length, selectedItems.size]);

  // Memoize stable callback functions to prevent child re-renders
  const handleItemClick = useCallback((itemId: string) => {
    setSelectedItems(prev => {
      const newSelection = new Set(prev);
      if (newSelection.has(itemId)) {
        newSelection.delete(itemId);
      } else {
        newSelection.add(itemId);
      }
      
      // Notify parent with stable reference
      onSelectionChange?.(Array.from(newSelection));
      return newSelection;
    });
  }, [onSelectionChange]);

  const handleSelectAll = useCallback(() => {
    const allIds = sortedData.map(item => item.id);
    setSelectedItems(new Set(allIds));
    onSelectionChange?.(allIds);
  }, [sortedData, onSelectionChange]);

  const handleClearSelection = useCallback(() => {
    setSelectedItems(new Set());
    onSelectionChange?.([]);
  }, [onSelectionChange]);

  // Memoize search handler with debouncing
  const debouncedSearch = useCallback(
    debounce((query: string) => {
      setSearchQuery(query);
    }, 300),
    []
  );

  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    debouncedSearch(event.target.value);
  }, [debouncedSearch]);

  // Memoize expensive render functions
  const renderStatistics = useCallback(() => (
    <div className="statistics">
      <span>Total: {statistics.total}</span>
      <span>Filtered: {statistics.filtered}</span>
      <span>Selected: {statistics.selected}</span>
      <span>Categories: {statistics.categories}</span>
      <span>Average: {statistics.averageValue.toFixed(2)}</span>
    </div>
  ), [statistics]);

  return (
    <div className="optimized-data-processor">
      {/* Search input - uses memoized handler */}
      <input
        type="text"
        placeholder="Search..."
        onChange={handleSearchChange}
      />
      
      {/* Statistics - memoized component */}
      {renderStatistics()}
      
      {/* Action buttons - use memoized handlers */}
      <div className="actions">
        <button onClick={handleSelectAll}>Select All</button>
        <button onClick={handleClearSelection}>Clear Selection</button>
      </div>
      
      {/* Data list - only re-renders when sortedData changes */}
      <div className="data-list">
        {sortedData.map(item => (
          <MemoizedDataItem
            key={item.id}
            item={item}
            isSelected={selectedItems.has(item.id)}
            onClick={handleItemClick}
          />
        ))}
      </div>
    </div>
  );
};

// Memoized child component to prevent unnecessary re-renders
const MemoizedDataItem = React.memo(({ 
  item, 
  isSelected, 
  onClick 
}: {
  item: DataItem;
  isSelected: boolean;
  onClick: (id: string) => void;
}) => {
  const handleClick = useCallback(() => {
    onClick(item.id);
  }, [item.id, onClick]);

  return (
    <div 
      className={`data-item ${isSelected ? 'selected' : ''}`}
      onClick={handleClick}
    >
      <h3>{item.name}</h3>
      <p>{item.description}</p>
      <span>{item.category}</span>
    </div>
  );
});
```

### Lazy Loading and Code Splitting Pattern

**Purpose**: Components need to load content and code on-demand to reduce initial bundle size and improve perceived performance by deferring non-critical resources.

**Implementation Pattern**:

```typescript
// Dynamic component import with lazy loading
const LazyChart = React.lazy(() => 
  import('./components/Chart').then(module => ({
    default: module.Chart
  }))
);

const LazyDataTable = React.lazy(() => 
  import('./components/DataTable').then(module => ({
    default: module.DataTable
  }))
);

const LazyImageEditor = React.lazy(() => 
  import('./components/ImageEditor').then(module => ({
    default: module.ImageEditor
  }))
);

export const LazyLoadingContainer = ({ 
  activeTab, 
  data, 
  onTabChange 
}: Props) => {
  const [loadedTabs, setLoadedTabs] = useState<Set<string>>(new Set(['overview']));
  const [imageCache, setImageCache] = useState<Map<string, string>>(new Map());
  
  // Track which tabs have been viewed for preloading
  const handleTabChange = useCallback((tabId: string) => {
    setLoadedTabs(prev => new Set([...prev, tabId]));
    onTabChange(tabId);
  }, [onTabChange]);

  // Preload next likely tab based on user behavior
  useEffect(() => {
    const preloadMap = {
      'overview': 'analytics',
      'analytics': 'reports',
      'reports': 'settings',
    };
    
    const nextTab = preloadMap[activeTab as keyof typeof preloadMap];
    if (nextTab && !loadedTabs.has(nextTab)) {
      // Preload after a delay
      const timer = setTimeout(() => {
        setLoadedTabs(prev => new Set([...prev, nextTab]));
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [activeTab, loadedTabs]);

  // Lazy image loading with intersection observer
  const LazyImage = useCallback(({ src, alt, ...props }: ImageProps) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [isInView, setIsInView] = useState(false);
    const imgRef = useRef<HTMLImageElement>(null);

    useEffect(() => {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        },
        { threshold: 0.1 }
      );

      if (imgRef.current) {
        observer.observe(imgRef.current);
      }

      return () => observer.disconnect();
    }, []);

    useEffect(() => {
      if (isInView && !isLoaded) {
        // Check cache first
        if (imageCache.has(src)) {
          setIsLoaded(true);
          return;
        }

        // Preload image
        const img = new Image();
        img.onload = () => {
          setImageCache(prev => new Map([...prev, [src, src]]));
          setIsLoaded(true);
        };
        img.src = src;
      }
    }, [isInView, isLoaded, src, imageCache]);

    return (
      <div ref={imgRef} className="lazy-image-container" {...props}>
        {isLoaded ? (
          <img src={src} alt={alt} className="lazy-image loaded" />
        ) : (
          <div className="lazy-image-placeholder">
            <div className="loading-spinner" />
          </div>
        )}
      </div>
    );
  }, [imageCache]);

  // Lazy content loading based on visibility
  const LazyContent = useCallback(({ 
    children, 
    fallback = <div>Loading...</div>,
    threshold = 0.1 
  }: LazyContentProps) => {
    const [shouldLoad, setShouldLoad] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setShouldLoad(true);
            observer.disconnect();
          }
        },
        { threshold }
      );

      if (containerRef.current) {
        observer.observe(containerRef.current);
      }

      return () => observer.disconnect();
    }, [threshold]);

    return (
      <div ref={containerRef}>
        {shouldLoad ? children : fallback}
      </div>
    );
  }, []);

  return (
    <div className="lazy-loading-container">
      <nav className="tabs">
        {['overview', 'analytics', 'reports', 'settings'].map(tab => (
          <button
            key={tab}
            className={`tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => handleTabChange(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
            {!loadedTabs.has(tab) && <span className="loading-indicator" />}
          </button>
        ))}
      </nav>

      <div className="tab-content">
        {/* Always render overview immediately */}
        {activeTab === 'overview' && (
          <div className="overview-tab">
            <h2>Overview</h2>
            <p>Key metrics and summary information</p>
            
            {/* Lazy load images in overview */}
            <div className="image-gallery">
              {data.images?.map((img, index) => (
                <LazyImage
                  key={index}
                  src={img.src}
                  alt={img.alt}
                  className="gallery-image"
                />
              ))}
            </div>
          </div>
        )}

        {/* Lazy load analytics tab */}
        {activeTab === 'analytics' && (
          <Suspense fallback={<div className="loading">Loading Analytics...</div>}>
            <LazyContent>
              {loadedTabs.has('analytics') && (
                <LazyChart 
                  data={data.analytics}
                  type="line"
                  animated={true}
                />
              )}
            </LazyContent>
          </Suspense>
        )}

        {/* Lazy load reports tab */}
        {activeTab === 'reports' && (
          <Suspense fallback={<div className="loading">Loading Reports...</div>}>
            <LazyContent>
              {loadedTabs.has('reports') && (
                <LazyDataTable 
                  data={data.reports}
                  pagination={true}
                  exportable={true}
                />
              )}
            </LazyContent>
          </Suspense>
        )}

        {/* Lazy load settings tab */}
        {activeTab === 'settings' && (
          <Suspense fallback={<div className="loading">Loading Settings...</div>}>
            <LazyContent>
              {loadedTabs.has('settings') && (
                <LazyImageEditor 
                  features={['crop', 'filter', 'adjust']}
                  onSave={handleImageSave}
                />
              )}
            </LazyContent>
          </Suspense>
        )}
      </div>
    </div>
  );
};
```

### Debouncing for Expensive Operations Pattern

**Purpose**: Components need to optimize user input handling and expensive operations by reducing the frequency of execution through debouncing and throttling techniques.

**Implementation Pattern**:

```typescript
export const OptimizedSearchComponent = ({ 
  onSearch, 
  onFilter, 
  onSort,
  searchDelay = 300,
  filterDelay = 500 
}: Props) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<FilterState>({});
  const [sortConfig, setSortConfig] = useState<SortConfig>({});
  const [isSearching, setIsSearching] = useState(false);

  // Debounced search function
  const debouncedSearch = useMemo(
    () => debounce(async (query: string) => {
      setIsSearching(true);
      try {
        await onSearch(query);
      } finally {
        setIsSearching(false);
      }
    }, searchDelay),
    [onSearch, searchDelay]
  );

  // Debounced filter function with batching
  const debouncedFilter = useMemo(
    () => debounce((filterState: FilterState) => {
      onFilter(filterState);
    }, filterDelay),
    [onFilter, filterDelay]
  );

  // Throttled sort function to prevent rapid sorting
  const throttledSort = useMemo(
    () => throttle((config: SortConfig) => {
      onSort(config);
    }, 200),
    [onSort]
  );

  // Search input handler
  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const query = event.target.value;
    setSearchQuery(query);
    
    // Cancel previous search and start new one
    debouncedSearch.cancel();
    debouncedSearch(query);
  }, [debouncedSearch]);

  // Filter change handler with batching
  const handleFilterChange = useCallback((filterKey: string, value: any) => {
    setFilters(prev => {
      const newFilters = { ...prev, [filterKey]: value };
      
      // Cancel previous filter operation
      debouncedFilter.cancel();
      debouncedFilter(newFilters);
      
      return newFilters;
    });
  }, [debouncedFilter]);

  // Sort change handler
  const handleSortChange = useCallback((field: string, direction: 'asc' | 'desc') => {
    const newConfig = { field, direction };
    setSortConfig(newConfig);
    throttledSort(newConfig);
  }, [throttledSort]);

  // Advanced debouncing with request cancellation
  const advancedDebouncedSearch = useMemo(() => {
    let currentController: AbortController | null = null;
    
    return debounce(async (query: string) => {
      // Cancel previous request
      if (currentController) {
        currentController.abort();
      }
      
      // Create new abort controller
      currentController = new AbortController();
      setIsSearching(true);
      
      try {
        const results = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
          signal: currentController.signal
        });
        
        if (!results.ok) throw new Error('Search failed');
        
        const data = await results.json();
        onSearch(data);
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Search error:', error);
        }
      } finally {
        if (currentController && !currentController.signal.aborted) {
          setIsSearching(false);
        }
        currentController = null;
      }
    }, searchDelay);
  }, [onSearch, searchDelay]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
      debouncedFilter.cancel();
      throttledSort.cancel();
      advancedDebouncedSearch.cancel();
    };
  }, [debouncedSearch, debouncedFilter, throttledSort, advancedDebouncedSearch]);

  // Auto-save with debouncing
  const [formData, setFormData] = useState({});
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  
  const debouncedAutoSave = useMemo(
    () => debounce(async (data: any) => {
      try {
        await fetch('/api/autosave', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        setLastSaved(new Date());
      } catch (error) {
        console.error('Auto-save failed:', error);
      }
    }, 2000),
    []
  );

  const handleFormDataChange = useCallback((field: string, value: any) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value };
      debouncedAutoSave(newData);
      return newData;
    });
  }, [debouncedAutoSave]);

  // Resize handler with throttling
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });

  const throttledResize = useMemo(
    () => throttle(() => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
    }, 100),
    []
  );

  useEffect(() => {
    window.addEventListener('resize', throttledResize);
    return () => {
      window.removeEventListener('resize', throttledResize);
      throttledResize.cancel();
    };
  }, [throttledResize]);

  return (
    <div className="optimized-search-component">
      {/* Search input with debouncing */}
      <div className="search-section">
        <input
          type="text"
          value={searchQuery}
          onChange={handleSearchChange}
          placeholder="Search..."
          className={isSearching ? 'searching' : ''}
        />
        {isSearching && <div className="search-spinner" />}
      </div>

      {/* Filter controls with debounced updates */}
      <div className="filter-section">
        <select 
          onChange={(e) => handleFilterChange('category', e.target.value)}
          value={filters.category || ''}
        >
          <option value="">All Categories</option>
          <option value="electronics">Electronics</option>
          <option value="books">Books</option>
          <option value="clothing">Clothing</option>
        </select>

        <input
          type="range"
          min="0"
          max="1000"
          value={filters.maxPrice || 1000}
          onChange={(e) => handleFilterChange('maxPrice', parseInt(e.target.value))}
        />
      </div>

      {/* Sort controls with throttling */}
      <div className="sort-section">
        <button onClick={() => handleSortChange('name', 'asc')}>
          Sort by Name ↑
        </button>
        <button onClick={() => handleSortChange('name', 'desc')}>
          Sort by Name ↓
        </button>
        <button onClick={() => handleSortChange('price', 'asc')}>
          Sort by Price ↑
        </button>
        <button onClick={() => handleSortChange('price', 'desc')}>
          Sort by Price ↓
        </button>
      </div>

      {/* Auto-save indicator */}
      <div className="auto-save-section">
        {lastSaved && (
          <span>Last saved: {lastSaved.toLocaleTimeString()}</span>
        )}
      </div>

      {/* Window size display (responsive testing) */}
      <div className="window-info">
        {windowSize.width} × {windowSize.height}
      </div>
    </div>
  );
};

// Utility functions
function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): T & { cancel: () => void } {
  let timeoutId: NodeJS.Timeout;
  
  const debounced = (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
  
  debounced.cancel = () => {
    clearTimeout(timeoutId);
  };
  
  return debounced as T & { cancel: () => void };
}

function throttle<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): T & { cancel: () => void } {
  let inThrottle: boolean;
  let timeoutId: NodeJS.Timeout;
  
  const throttled = (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      timeoutId = setTimeout(() => {
        inThrottle = false;
      }, delay);
    }
  };
  
  throttled.cancel = () => {
    clearTimeout(timeoutId);
    inThrottle = false;
  };
  
  return throttled as T & { cancel: () => void };
}
```

**Key Benefits of Performance Patterns**:
- **Memoization**: Prevents expensive recalculations, reduces child re-renders, optimizes function stability, improves large dataset handling
- **Lazy Loading**: Reduces initial bundle size, improves perceived performance, loads content on-demand, supports code splitting
- **Debouncing**: Optimizes user input handling, reduces API calls, prevents excessive operations, includes request cancellation and auto-save features