# Klive IDE - XMLUI Framework Integration

## Overview

Klive IDE uses **XMLUI** as its declarative UI framework. XMLUI is a React-based framework that allows building user interfaces using XML-like markup that compiles to React components. This document explains how XMLUI integrates with Klive IDE and provides guidelines for extending the component library and managing state across multiple Electron processes.

## Table of Contents

1. [XMLUI Framework Characteristics](#xmlui-framework-characteristics)
2. [File Structure](#file-structure)
3. [Application Bootstrap](#application-bootstrap)
4. [Creating Custom XMLUI Components](#creating-custom-xmlui-components)
5. [Cross-Process State Management](#cross-process-state-management)
6. [Adding New Dispatch Actions](#adding-new-dispatch-actions)
7. [XMLUI AppState Component](#xmlui-appstate-component)
8. [Best Practices](#best-practices)
9. [References](#references)

## XMLUI Framework Characteristics

### Key Features
- **Declarative XML Syntax**: UI is defined in `.xmlui` files with component-based markup
- **React Foundation**: All XMLUI components render to React components under the hood
- **Type Safety**: Full TypeScript support with type definitions for `.xmlui` files
- **Component Metadata**: Rich metadata system for documentation, validation, and tooling
- **Hot Module Replacement**: Development mode supports HMR for instant UI updates
- **Binding Expressions**: Dynamic data binding using `{expression}` syntax
- **Extensible**: Easy to add custom React components to the XMLUI component library

### Architecture in Klive IDE

```
┌─────────────────────────────────────────────────────────────┐
│                      Klive IDE Application                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Main.xmlui (Entry Point)                                   │
│  ├── Uses conditional rendering based on URL params         │
│  ├── Routes to EmuApp or IdeApp                             │
│  └── Binds to window.location for routing logic             │
│                                                              │
│  ┌──────────────────┐          ┌──────────────────┐         │
│  │   EmuApp.xmlui   │          │   IdeApp.xmlui   │         │
│  │  (Emulator UI)   │          │    (IDE UI)      │         │
│  └──────────────────┘          └──────────────────┘         │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                    XMLUI Component Library                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Built-in XMLUI Components                          │   │
│  │  - App, Fragment, H1, Button, etc.                  │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Custom Klive Components (src/renderer/src/lib/)    │   │
│  │  - StyledText (example)                             │   │
│  │  - Future custom components                         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                    React Runtime Layer                       │
│  - Renders XMLUI components as React elements               │
│  - Handles state management and updates                     │
│  - Provides component lifecycle and hooks                   │
└─────────────────────────────────────────────────────────────┘
```

## File Structure

### XMLUI Application Files

```
src/renderer/
├── index.html                  # HTML entry point
├── index.ts                    # App initialization with XMLUI runtime
├── src/
│   ├── Main.xmlui              # Root XMLUI component (routing)
│   ├── config.ts               # Configuration
│   ├── components/
│   │   ├── emu/
│   │   │   └── EmuApp.xmlui    # Emulator window UI
│   │   └── ide/
│   │       └── IdeApp.xmlui    # IDE window UI
│   └── lib/                    # Custom React components
│       ├── index.tsx           # Component library registration
│       ├── xmlui-types.d.ts    # TypeScript declarations
│       └── ComponentName/
│           ├── ComponentName.tsx        # Component definition & renderer
│           ├── ComponentNameNative.tsx  # React implementation
│           └── ComponentName.module.scss # Scoped styles
```

### Type Definitions

The `xmlui-types.d.ts` file provides TypeScript support for `.xmlui` files:

```typescript
declare module "*.xmlui" {
  const content: string;
  export default content;
}

declare module "*.xmlui.xs" {
  const content: string;
  export default content;
}
```

This allows TypeScript to recognize `.xmlui` files as valid module imports.

## Application Bootstrap

### Entry Point (index.ts)

```typescript
import { startApp } from "xmlui";
import customComponents from "./src/lib";

// Import all runtime files (components, XMLUI files, etc.)
export const runtime = import.meta.glob(`/src/**/*`, { eager: true });

// Start XMLUI app with runtime and custom component library
startApp(runtime, [customComponents]);

// Hot Module Replacement support
if (import.meta.hot) {
    import.meta.hot.accept((newModule) => {
        startApp(newModule?.runtime, [customComponents]);
    });
}
```

**Key Points:**
- `startApp()` initializes the XMLUI runtime with all app files
- `import.meta.glob()` loads all components and XMLUI files dynamically
- Custom component library is passed as second argument
- HMR automatically restarts the app when files change

### Routing Pattern (Main.xmlui)

```xmlui
<Fragment var.isEmu="{window.location.search.startsWith('?emu')}">
  <EmuApp when="{isEmu}" />
  <IdeApp when="{!isEmu}" />
</Fragment>
```

**Key Points:**
- Uses `var.isEmu` to define a local variable from binding expression
- `when` attribute provides conditional rendering
- Routing based on URL query parameter (`?emu` or `?ide`)
- Both windows load the same HTML but show different UIs

## Creating Custom XMLUI Components

### Component Library Registration (lib/index.tsx)

```typescript
import { styledTextComponentRenderer } from "./StyledText/StyledText";

export default {
  namespace: "XMLUIExtensions",
  components: [styledTextComponentRenderer],
};
```

**Structure:**
- Export an object with `namespace` and `components` array
- Each component renderer is imported and added to the array
- This object is passed to `startApp()` in the bootstrap code

### Component Structure (Dual-File Pattern)

#### 1. Component Definition & Renderer (StyledText.tsx)

```typescript
import { createComponentRenderer, createMetadata, d } from "xmlui";
import { StyledText } from "./StyledTextNative";

const COMP = "StyledText";

// Metadata defines the component's API
export const StyledTextMd = createMetadata({
  status: "stable",
  description: "A simple text component with customizable styling",
  props: {
    text: {
      type: "string",
      description: "The text content to display",
      isRequired: false,
    },
    size: {
      type: "string",
      description: "The text size",
      isRequired: false,
      defaultValue: "medium",
      availableValues: [
        { value: "small", description: "Small text (0.875rem)" },
        { value: "medium", description: "Medium text (1rem)" },
        { value: "large", description: "Large text (1.25rem)" },
        { value: "xlarge", description: "Extra large text (1.5rem)" },
      ],
    },
    color: {
      type: "string",
      description: "The text color (any valid CSS color value)",
      isRequired: false,
      defaultValue: "inherit",
    },
  },
  themeVars: {},
  defaultThemeVars: {},
});

// Renderer maps XMLUI markup to React component
export const styledTextComponentRenderer = createComponentRenderer(
  COMP,
  StyledTextMd,
  ({ node, renderChild, extractValue, className }) => {
    const props = (node.props as typeof StyledTextMd.props)!;

    return (
      <StyledText
        text={extractValue(props.text)}
        size={extractValue(props.size)}
        color={extractValue(props.color)}
        className={extractValue(className)}
      >
        {renderChild(node.children)}
      </StyledText>
    );
  },
);
```

**Key Concepts:**
- `createMetadata()`: Defines component props, events, and documentation
- `createComponentRenderer()`: Creates the renderer function
- `extractValue()`: Evaluates XMLUI property values (handles bindings)
- `renderChild()`: Renders child components
- Metadata includes available values for validation and tooling

#### 2. Native React Component (StyledTextNative.tsx)

```typescript
import { forwardRef, ReactNode } from "react";
import styles from "./StyledText.module.scss";
import classnames from "classnames";

type Props = {
  children?: ReactNode;
  text?: string;
  size?: "small" | "medium" | "large" | "xlarge";
  color?: string;
  className?: string;
};

export const defaultProps: Pick<Props, "size" | "color"> = {
  size: "medium",
  color: "inherit",
};

export const StyledText = forwardRef<HTMLSpanElement, Props>(
  ({ children, text, size = "medium", color = "inherit", className }, ref) => {
    const content = text || children;

    return (
      <span
        ref={ref}
        className={classnames(
          styles.styledText,
          styles[`size-${size}`],
          className
        )}
        style={{ color }}
      >
        {content}
      </span>
    );
  }
);

StyledText.displayName = "StyledText";
```

**Key Patterns:**
- Use `forwardRef` for ref forwarding (XMLUI requirement)
- Export `defaultProps` for documentation
- Use CSS modules for scoped styling
- Use `classnames` for conditional CSS classes
- TypeScript props interface matches metadata
- Set `displayName` for better debugging

#### 3. Styles (StyledText.module.scss)

```scss
.styledText {
  display: inline-block;
  transition: all 0.2s ease;

  // Size variants using BEM-like naming
  &.size-small {
    font-size: 0.875rem;
    line-height: 1.4;
  }

  &.size-medium {
    font-size: 1rem;
    line-height: 1.5;
  }

  &.size-large {
    font-size: 1.25rem;
    line-height: 1.6;
  }

  &.size-xlarge {
    font-size: 1.5rem;
    line-height: 1.7;
  }
}
```

**Key Points:**
- Always use `.module.scss` extension for scoped styles
- Use nested selectors for variants
- Follow BEM-like naming conventions

### Using Custom Components in XMLUI

```xmlui
<Component name="EmuApp">
  <App name="Klive Emulator">
    <H1>Klive Emulator</H1>
    <StyledText
      size="large"
      color="blue"
      text="This is styled text from a React component library." />
  </App>
</Component>
```

**Key Points:**
- Custom components are used just like built-in XMLUI components
- Props are specified as XML attributes
- Both self-closing and container patterns are supported
- Binding expressions work with custom components

## XMLUI vs React Comparison

| Aspect | XMLUI | React |
|--------|-------|-------|
| **Syntax** | XML-like markup in `.xmlui` files | JSX in `.tsx` files |
| **Component Definition** | Metadata + Renderer function | Function or Class component |
| **Data Binding** | `{expression}` syntax | `{expression}` in JSX |
| **Props** | Declared in metadata | TypeScript interface |
| **Styling** | CSS Modules + Theme system | CSS Modules, styled-components, etc. |
| **State** | Container-based + React hooks | React hooks (useState, etc.) |
| **Refs** | forwardRef required | forwardRef optional |
| **Documentation** | Auto-generated from metadata | Manual (JSDoc, Storybook, etc.) |

## Guidelines for Klive IDE Components

### When to Create Custom Components

Create custom XMLUI components in `src/renderer/src/lib/` when:
- ✅ Building reusable UI elements specific to Klive IDE
- ✅ Wrapping third-party React libraries for XMLUI use
- ✅ Creating domain-specific components (emulator controls, IDE panels, etc.)
- ✅ Need components with complex styling or behavior

Use built-in XMLUI components when:
- ✅ Standard UI elements are sufficient (buttons, inputs, layouts)
- ✅ Rapid prototyping without custom styling
- ✅ Simple container or layout requirements

### Component Development Workflow

1. **Plan the component API** - Define props, events, and behavior
2. **Create metadata** - Use `createMetadata()` to define the component interface
3. **Create renderer** - Map XMLUI props to React component props
4. **Implement native component** - Build the React component following patterns
5. **Add styles** - Create `.module.scss` file for component styles
6. **Register component** - Add to `lib/index.tsx` exports
7. **Test in XMLUI** - Use the component in `.xmlui` files
8. **Document** - Metadata serves as documentation (optional: add examples)

### Naming Conventions

- **Component files**: `ComponentName.tsx`, `ComponentNameNative.tsx`
- **Style files**: `ComponentName.module.scss`
- **Metadata constant**: `ComponentNameMd`
- **Renderer function**: `componentNameComponentRenderer`
- **Default props**: `defaultProps` (exported from Native file)
- **Component constant**: `COMP = "ComponentName"`

### Integration with Klive Architecture

Custom XMLUI components in Klive IDE can:
- ✅ Access the AppState via context (see ARCHITECTURE.md)
- ✅ Dispatch Redux actions through event handlers
- ✅ Call inter-process APIs (MainApi, EmuApi, IdeApi)
- ✅ Use the messaging system for IPC
- ✅ Integrate with Electron features through the preload API

## Best Practices

### Component Design
- ✅ Keep components focused on single responsibility
- ✅ Use composition over complex props
- ✅ Provide sensible defaults for all optional props
- ✅ Follow the dual-file pattern for consistency
- ✅ Always use `forwardRef` in native components
- ✅ Export `defaultProps` for documentation

### Metadata
- ✅ Provide clear, descriptive metadata
- ✅ Include `availableValues` for enumerated props
- ✅ Specify `defaultValue` for optional props
- ✅ Mark required props with `isRequired: true`
- ✅ Add descriptions for all props and events

### Styling
- ✅ Always use CSS Modules (`.module.scss`)
- ✅ Use semantic class names
- ✅ Avoid inline styles except for dynamic values
- ✅ Use theme variables when available
- ✅ Follow BEM-like naming for variants

### Performance
- ✅ Use `React.memo()` for expensive components
- ✅ Avoid unnecessary re-renders with proper key props
- ✅ Use `useCallback` and `useMemo` when appropriate
- ✅ Lazy load heavy components if needed

## Cross-Process State Management

### Overview

Klive IDE runs as a multi-process Electron application with **three separate Redux stores**:
- **Main Process Store** - The source of truth for application state
- **EMU Renderer Store** - State for the emulator window
- **IDE Renderer Store** - State for the IDE window

To synchronize state across these processes, Klive uses a **three-store architecture** with IPC-based action forwarding.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Main Process                            │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Main Store (Source of Truth)            │  │
│  │  - Receives actions from both renderers             │  │
│  │  - Forwards actions based on source:                │  │
│  │    * EMU → forwards to IDE                          │  │
│  │    * IDE → forwards to EMU                          │  │
│  │    * MAIN → forwards to both                        │  │
│  └──────────────────────────────────────────────────────┘  │
│                        ↑  ↓                                  │
│                   IPC (ForwardAction)                        │
└─────────────────────────────────────────────────────────────┘
              ↑                              ↑
              │                              │
    ┌─────────────────┐          ┌─────────────────┐
    │  EMU Renderer   │          │  IDE Renderer   │
    │                 │          │                 │
    │  EMU Store      │          │  IDE Store      │
    │  - Local state  │          │  - Local state  │
    │  - Forwards to  │          │  - Forwards to  │
    │    main via IPC │          │    main via IPC │
    └─────────────────┘          └─────────────────┘
```

### Key Concepts

#### 1. Source Tracking

Every Redux action carries a **source** parameter to identify where it originated:
- `"main"` - Action originated locally in a renderer or main process
- `"emu"` - Action came from the emulator renderer
- `"ide"` - Action came from the IDE renderer

This prevents infinite loops: renderers only forward actions with source `"main"`, ignoring actions from other processes.

#### 2. Action Forwarding Flow

**Example: User clicks button in EMU window**

1. EMU: User action → `dispatch(action)` with default source=`"main"`
2. EMU: ActionForwarder sees source=`"main"` → forwards via IPC with `sourceProcess: "emu"`
3. Main: Receives action → `mainStore.dispatch(action, "emu")`
4. Main: Forwarder sees source=`"emu"` → forwards only to IDE with source=`"emu"`
5. IDE: Receives action → `ideStore.dispatch(action, "emu")`
6. IDE: ActionForwarder sees source=`"emu"` (not `"main"`) → skips forwarding ✅ (no loop!)

#### 3. SharedAppState Component

The `SharedAppState` XMLUI component bridges Redux stores with XMLUI's reactive system, allowing `.xmlui` files to access and update cross-process state.

**File Structure:**
```
src/renderer/src/lib/SharedAppState/
├── SharedAppState.tsx          # Component definition & metadata
└── SharedAppStateNative.tsx    # React implementation with hooks
```

**Usage in XMLUI:**
```xmlui
<Component name="EmuApp">
  <SharedAppState id="appState" />
  <App name="Klive Emulator" onReady="() => { delay(0); appState.emuLoaded(); }">
    <Text>Emulator loaded: {appState.value.emuLoaded ? 'Yes' : 'No'}</Text>
    <Text>IDE loaded: {appState.value.ideLoaded ? 'Yes' : 'No'}</Text>
    <Text>EMU focused: {appState.value.emuFocused ? 'YES' : 'NO'}</Text>
  </App>
</Component>
```

**Key Features:**
- Exposes API methods to dispatch actions (e.g., `appState.emuLoaded()`)
- Provides reactive `appState.value` object for reading state
- Automatically syncs state across all windows
- Uses `useLayoutEffect` to register before first render

### Implementation Details

#### Store Creation (src/common/state/store.ts)

Each store is created from a cloned `initialAppState` to ensure independence:

```typescript
export default function createAppStore(id: string, forwarder?: ActionForwarder) {
  const clonedInitialState: AppState = { ...initialAppState };
  return createStore(id, appReducer, clonedInitialState, forwarder);
}
```

#### Main Store Forwarder (src/main/mainStore.ts)

```typescript
mainStore = createAppStore("main", async (action: Action, source) => {
  if (source === "emu") {
    sendToIde(action, source);  // Forward to IDE with source preserved
  } else if (source === "ide") {
    sendToEmu(action, source);  // Forward to EMU with source preserved
  } else if (source === "main") {
    sendToEmu(action, source);  // Broadcast to both
    sendToIde(action, source);
  }
});
```

**Critical:** Source parameter is passed through to preserve origin information.

#### Renderer Store Forwarder (src/renderer/src/lib/store/actionForwarder.ts)

```typescript
export function createIpcActionForwarder(processId: string): ActionForwarder {
  return async (action: Action, source: MessageSource) => {
    // Only forward locally-originated actions
    if (source !== "main") {
      return;  // Skip actions from other processes to prevent loops
    }

    await window.electron.ipcRenderer.invoke("ForwardAction", {
      action,
      sourceProcess: processId  // "emu" or "ide"
    });
  };
}
```

#### IPC Listener in Renderer (src/renderer/src/lib/store/rendererStore.ts)

```typescript
window.electron.ipcRenderer.on("ForwardActionToRenderer", (_event, data) => {
  const { action, sourceProcess } = data;
  
  // Dispatch with source set to the originating process
  rendererStore!.dispatch(action, sourceProcess);
});
```

**Critical:** Preserve `sourceProcess` when dispatching to avoid re-forwarding.

#### Window Focus Tracking Example

The main process can dispatch actions based on Electron events:

```typescript
// In src/main/index.ts
const emuWindow = createEmulatorWindow(handleWindowClose);
const ideWindow = createIdeWindow(handleWindowClose);

emuWindow.on('focus', () => {
  mainStore.dispatch(emuFocusedAction(true), 'main');
});

emuWindow.on('blur', () => {
  mainStore.dispatch(emuFocusedAction(false), 'main');
});

ideWindow.on('focus', () => {
  mainStore.dispatch(ideFocusedAction(true), 'main');
});

ideWindow.on('blur', () => {
  mainStore.dispatch(ideFocusedAction(false), 'main');
});
```

Both renderer windows automatically display the updated focus state.

### Infrastructure Setup

#### Window Creation Timing

**Critical:** IPC infrastructure must be ready before loading window content:

```typescript
// Create windows first (but don't load content yet)
const emuWindow = createEmulatorWindow(handleWindowClose);
const ideWindow = createIdeWindow(handleWindowClose);

// Set up focus handlers and IPC
// ... (setup code)

// Now load window contents
loadEmulatorContent();
loadIdeContent();
```

This ensures that when components mount and try to dispatch actions, the IPC system is ready.

#### Dispatching Actions from Main Process

When the main process needs to dispatch actions with values (e.g., OS detection, app path), it must wait until renderer stores are initialized. Use the **store subscription pattern**:

```typescript
// In src/main/index.ts
const mainStore = getMainStore(sendActionToEmu, sendActionToIde);

// Track if we've already set the values (only set once)
let osAndPathSet = false;

// Subscribe to store changes to detect when both windows are loaded
mainStore.subscribe(() => {
  const state = mainStore.getState();
  
  // Once both windows are loaded and we haven't set OS/path yet
  if (state.emuLoaded && state.ideLoaded && !osAndPathSet) {
    osAndPathSet = true;
    
    // Now it's safe to dispatch - renderer stores are initialized
    mainStore.dispatch(setOsAction(process.platform), 'main');
    mainStore.dispatch(setAppPathAction(app.getAppPath()), 'main');
  }
});
```

**Why this works:**
- Renderer windows signal they're ready via `appState.emuLoaded()` / `appState.ideLoaded()`
- The main store subscription detects when both are `true`
- At this point, both renderer stores exist and can receive forwarded actions
- The flag ensures actions are only dispatched once

**⚠️ Don't dispatch from main before renderers are ready:**
- Dispatching before `loadEmulatorContent()` / `loadIdeContent()` won't work (stores don't exist)
- Using `setTimeout()` is unreliable and creates race conditions
- Always wait for renderer readiness signals

### Debugging Tips

When debugging cross-process state issues:

1. **Add source tracking logs** - Temporarily log source at each step
2. **Check for infinite loops** - Look for repeated action dispatches
3. **Verify source propagation** - Ensure source parameter is passed through all forwarding functions
4. **Confirm IPC timing** - Make sure IPC is set up before content loads
5. **Check renderer readiness** - Ensure renderers are loaded before main dispatches actions

## Adding New Dispatch Actions

Follow these steps to add new Redux actions that sync across all processes:

### Step 1: Define the Action (src/common/state/actions.ts)

```typescript
export const newFeatureAction: ActionCreator = (value: string) => ({
  type: "NEW_FEATURE",
  payload: { value }
});
```

### Step 2: Add State Property (src/common/state/AppState.ts)

```typescript
export interface AppState {
  // ... existing properties
  newFeature?: string;
}

export const initialAppState: AppState = {
  // ... existing properties
  newFeature: "",
};
```

### Step 3: Add Reducer Case (src/common/state/app-state-flags-reducer.ts)

```typescript
export function appStateFlagsReducer(
  state: AppState,
  action: Action
): AppState {
  const { type, payload } = action;
  switch (type) {
    // ... existing cases
    case "NEW_FEATURE":
      return { ...state, newFeature: payload?.value };
    default:
      return state;
  }
}
```

### Step 4: Add Method to SharedAppState (src/renderer/src/lib/SharedAppState/SharedAppStateNative.tsx)

```typescript
useLayoutEffect(() => {
  if (registerComponentApiRef.current) {
    registerComponentApiRef.current({
      // ... existing methods
      newFeature: (value: string) => {
        store.dispatch(newFeatureAction(value));
        updateStateRef.current({ value: store.getState() });
      },
    });
  }
  // ... rest of effect
}, []);
```

### Step 5: Update Type Definitions (src/renderer/src/lib/SharedAppState/SharedAppState.tsx)

Update the metadata to include the new API method:

```typescript
export const SharedAppStateMd = createMetadata({
  // ... existing config
  api: {
    newFeature: {
      parameters: [
        {
          name: "value",
          type: "string",
          description: "The value to set"
        }
      ],
      description: "Sets the new feature value"
    }
  }
});
```

### Step 6: Use in XMLUI Files

```xmlui
<Component name="MyComponent">
  <SharedAppState id="appState" />
  <Button onClick="() => appState.newFeature('test value')">
    Set Feature
  </Button>
  <Text>Feature value: {appState.value.newFeature}</Text>
</Component>
```

### Complete Checklist

- [ ] Define action creator in `actions.ts`
- [ ] Add state property to `AppState` interface
- [ ] Add initial value to `initialAppState`
- [ ] Add reducer case in `app-state-flags-reducer.ts`
- [ ] Add API method in `SharedAppStateNative.tsx`
- [ ] Update metadata in `SharedAppState.tsx`
- [ ] Test in both EMU and IDE windows
- [ ] Verify state syncs across windows

## XMLUI AppState Component

### Overview

`AppState` is a built-in XMLUI component that provides **global state management** across your entire application. It solves the "prop drilling" problem by allowing any component to access and update shared state without explicitly passing props through component hierarchies.

**Key Features:**
- ✅ **Non-visual component** - Renders nothing, only manages state
- ✅ **Global accessibility** - Any component can access state via shared bucket IDs
- ✅ **Automatic reactivity** - UI updates automatically when state changes
- ✅ **No prop drilling** - No need to pass state through multiple component levels
- ✅ **Multi-bucket support** - Create separate state buckets for different concerns
- ✅ **List operations** - Built-in methods for managing arrays in state

### When to Use AppState vs Variables

| Feature | Local Variables | AppState |
|---------|----------------|----------|
| **Scope** | Component file only | Global across entire app |
| **Access** | Must be passed via props | Accessed via bucket ID |
| **Nested Components** | Requires prop drilling | Automatic access |
| **Updates** | Direct assignment | `.update()` method |
| **Use Case** | Simple local state | Shared state across components |

### Basic Usage Pattern

#### 1. Define AppState in Main Component

```xmlui
<App>
  <AppState id="appState" initialValue="{{ enhancedMode: false }}" />
  <VStack gap="$space-4" padding="$space-4">
    <Checkbox
      label="Enhanced mode"
      initialValue="{appState.value.enhancedMode}"
      onDidChange="v => appState.update({ enhancedMode: v })" />
    <Component1 />
    <Component2 />
  </VStack>
</App>
```

**Key Points:**
- Assign an `id` to access the AppState instance
- Use `initialValue` to set initial state (must be an object)
- Access state via `{appState.value.propertyName}`
- Update state via `appState.update({ key: value })`

#### 2. Access AppState in Child Components

```xmlui
<Component name="Component1">
  <AppState id="state" />
  <H3 when="{state.value.enhancedMode}">I am in enhanced mode!</H3>
  <Text when="{!state.value.enhancedMode}">Enhanced mode turned off.</Text>
</Component>
```

**Key Points:**
- No need to specify `initialValue` or `bucket` if using defaults
- State is automatically synchronized across all components
- Changes in one component immediately reflect in all others

### State Buckets

Buckets allow you to create **separate, independent state containers** for different purposes:

```xmlui
<!-- Main App with multiple buckets -->
<App>
  <!-- User preferences bucket -->
  <AppState id="prefs" bucket="userPreferences" initialValue="{{
    theme: 'light',
    language: 'en'
  }}" />
  
  <!-- Application data bucket -->
  <AppState id="data" bucket="appData" initialValue="{{
    selectedItems: [],
    currentView: 'grid'
  }}" />
  
  <!-- UI state bucket -->
  <AppState id="ui" bucket="uiState" initialValue="{{
    sidebarOpen: true,
    modalVisible: false
  }}" />
</App>

<!-- Component accessing specific bucket -->
<Component name="ThemeSelector">
  <AppState id="preferences" bucket="userPreferences" />
  <Button onClick="() => preferences.update({ theme: 'dark' })">
    Switch to Dark Theme
  </Button>
</Component>
```

**Bucket Best Practices:**
- Use descriptive bucket names: `"userSettings"`, `"appData"`, `"uiState"`
- Default bucket is `"default"` if not specified
- All AppState instances with same bucket share the same state
- Different buckets are completely independent

### Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `id` | string | *required* | Identifier to access this AppState instance |
| `bucket` | string | `"default"` | Bucket identifier for state isolation |
| `initialValue` | object | `undefined` | Initial state object (merged on mount) |

**⚠️ Important:** Only set `initialValue` in one AppState instance per bucket to avoid unexpected merging behavior.

### Events

| Event | Parameters | Description |
|-------|-----------|-------------|
| `didUpdate` | `{ bucket, value, previousValue }` | Fired when state is updated |

```xmlui
<AppState 
  id="settings" 
  bucket="userSettings"
  initialValue="{{ notifications: true }}"
  onDidUpdate="(e) => console.log('Updated:', e.value)" />
```

### Exposed Methods

All AppState instances expose these methods for programmatic state management:

#### `update(newState)`

Updates the state by merging `newState` with existing state:

```xmlui
<!-- In event handlers -->
<Button onClick="() => appState.update({ count: 5, enabled: true })">
  Update State
</Button>
```

**Behavior:** Shallow merge - only top-level properties are merged:

```javascript
// Before: { enhancedMode: false, showHeader: true, theme: "light" }
appState.update({ enhancedMode: true, theme: "dark" });
// After: { enhancedMode: true, showHeader: true, theme: "dark" }
```

#### `appendToList(key, item)`

Adds an item to an array in the state (if not already present):

```xmlui
<Button onClick="() => selections.appendToList('selectedIds', 42)">
  Select Item
</Button>
```

**Use Case:** Managing selected items, favorites, or any list of IDs.

#### `removeFromList(key, item)`

Removes an item from an array in the state:

```xmlui
<Button onClick="() => selections.removeFromList('selectedIds', 42)">
  Deselect Item
</Button>
```

#### `listIncludes(key, item)`

Checks if an array contains a specific item:

```xmlui
<Checkbox 
  initialValue="{selections.listIncludes('selectedIds', itemId)}"
  onDidChange="checked => checked 
    ? selections.appendToList('selectedIds', itemId)
    : selections.removeFromList('selectedIds', itemId)" />
```

### Practical Patterns

#### Pattern 1: Form State Management

```xmlui
<App>
  <AppState id="form" bucket="formData" initialValue="{{
    username: '',
    email: '',
    age: 0,
    errors: {}
  }}" />
  
  <VStack>
    <TextBox 
      label="Username"
      value="{form.value.username}"
      onDidChange="v => form.update({ username: v })"
      error="{form.value.errors.username}" />
    
    <TextBox 
      label="Email"
      value="{form.value.email}"
      onDidChange="v => form.update({ email: v })"
      error="{form.value.errors.email}" />
    
    <Button onClick="() => validateAndSubmit(form)">
      Submit
    </Button>
  </VStack>
</App>
```

#### Pattern 2: Multi-Selection State

```xmlui
<App>
  <AppState id="selections" bucket="itemSelections" initialValue="{{
    selectedIds: []
  }}" />
  
  <ForEach items="{items}" var.item>
    <Checkbox
      label="{item.name}"
      initialValue="{selections.listIncludes('selectedIds', item.id)}"
      onDidChange="checked => checked
        ? selections.appendToList('selectedIds', item.id)
        : selections.removeFromList('selectedIds', item.id)" />
  </ForEach>
  
  <Text>Selected: {selections.value.selectedIds.length} items</Text>
</App>
```

#### Pattern 3: UI State (Sidebar, Modals, etc.)

```xmlui
<App>
  <AppState id="ui" bucket="uiState" initialValue="{{
    sidebarOpen: true,
    activeModal: null,
    currentTheme: 'light'
  }}" />
  
  <Layout>
    <Sidebar visible="{ui.value.sidebarOpen}" />
    <Button onClick="() => ui.update({ sidebarOpen: !ui.value.sidebarOpen })">
      Toggle Sidebar
    </Button>
    
    <Modal 
      visible="{ui.value.activeModal === 'settings'}"
      onClose="() => ui.update({ activeModal: null })">
      <SettingsPanel />
    </Modal>
  </Layout>
</App>
```

#### Pattern 4: Cross-Window State Sync (Klive-Specific)

For Klive IDE with multiple Electron windows, you'll need to sync AppState across processes. This requires integration with the Klive IPC system:

```xmlui
<!-- In Main.xmlui -->
<App>
  <AppState 
    id="globalState" 
    bucket="crossWindow"
    initialValue="{{ machineType: 'zx48', isRunning: false }}"
    onDidUpdate="(e) => syncStateToOtherWindows(e.value)" />
</App>
```

You would implement `syncStateToOtherWindows` as an action that uses the messaging system documented in `ARCHITECTURE.md` to forward state changes across processes.

### Integration with Klive Architecture

AppState can be integrated with Klive's existing state management:

1. **AppState for UI State** - Use for UI-specific state (selections, modals, forms)
2. **Redux Store for App Logic** - Use for emulator state, IDE state, cross-process state
3. **Bridge Pattern** - Listen to Redux actions and update AppState for UI reactivity

```xmlui
<!-- Example: Bridge Redux to AppState -->
<App>
  <AppState id="uiState" bucket="ui" initialValue="{{ 
    emuFocused: false,
    ideFocused: false 
  }}" />
  
  <!-- Listen to Redux store and update AppState -->
  <Script>
    store.subscribe(() => {
      const state = store.getState();
      uiState.update({
        emuFocused: state.emuFocused,
        ideFocused: state.ideFocused
      });
    });
  </Script>
</App>
```

### Best Practices

✅ **DO:**
- Use AppState for UI-specific state (forms, selections, modal visibility)
- Create separate buckets for different concerns
- Only set `initialValue` once per bucket (typically in main app)
- Use descriptive bucket names
- Leverage list methods for array management

❌ **DON'T:**
- Don't use AppState for cross-process state (use Redux + IPC instead)
- Don't set `initialValue` in multiple places for same bucket
- Don't store large data sets (use databases or file system)
- Don't use for computed values (use binding expressions instead)
- Don't mutate state directly (always use `.update()`)

### Comparison with Klive Redux Store

| Feature | AppState | Redux Store |
|---------|----------|-------------|
| **Scope** | XMLUI components only | Entire app (all processes) |
| **Persistence** | In-memory only | Can persist to disk |
| **Cross-Process** | No (single window) | Yes (via IPC) |
| **Dev Tools** | Limited | Redux DevTools |
| **Type Safety** | Runtime only | TypeScript definitions |
| **Use Case** | UI state, forms, selections | App logic, emulator state, IPC |

**Recommendation:** Use AppState for UI concerns within XMLUI components, and Redux for application logic and cross-process state management.

---

## Quick Reference Summary

### State Management Decision Tree

```
Need state management?
├─ Single window, UI-only (forms, modals, selections)
│  └─ Use: AppState (built-in XMLUI component)
│
└─ Cross-window sync (EMU ↔ IDE ↔ Main)
   └─ Use: SharedAppState (custom Klive component with Redux)
```

### Adding New Cross-Process Actions - Quick Steps

1. **Define action** in `src/common/state/actions.ts`
2. **Add state property** to `AppState` interface and `initialAppState`
3. **Add reducer case** in `app-state-flags-reducer.ts`
4. **Add API method** to `SharedAppStateNative.tsx`
5. **Update metadata** in `SharedAppState.tsx`
6. **Use in XMLUI** via `appState.methodName()`
7. **Test** in both EMU and IDE windows

### Key Architecture Patterns

**Three-Store Architecture:**
- Main Store (source of truth) + EMU Store + IDE Store
- All stores created from cloned `initialAppState`
- Actions forwarded via IPC with source tracking

**Source Tracking:**
- `"main"` = locally originated action
- `"emu"` = from emulator renderer
- `"ide"` = from IDE renderer
- Prevents infinite loops: only forward if source === `"main"`

**IPC Timing:**
- Create windows → Setup IPC/focus handlers → Load content
- Ensures IPC infrastructure is ready before components mount

---

## References

- **Adding Dispatch Actions**: See `adding-dispatch-actions.md` for step-by-step guide
- **Component Conventions**: See `create-xmlui-components.md` for detailed patterns
- **App Architecture**: See `ARCHITECTURE.md` for state management and IPC
- **Testing**: See `testing-conventions.md` for component testing patterns
- **XMLUI Documentation**: [Official XMLUI docs](https://docs.xmlui.org)
- **AppState Documentation**: [XMLUI AppState Component](https://docs.xmlui.org/components/AppState)

---

*This document provides the foundation for building and integrating custom React components into Klive IDE's XMLUI-based user interface.*
