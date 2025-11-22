# State Management Architecture

## Overview

Klive IDE uses a **three-store Redux architecture** with synchronized state across one Main process and two Renderer processes (Emulator and IDE windows). Actions dispatched in any process propagate to all others automatically.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      MAIN PROCESS                            │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Redux Store (mainStore)                               │ │
│  │  - Single source of truth                              │ │
│  │  - Forwards actions to both renderers                  │ │
│  │  - Source tracking prevents loops                      │ │
│  └──────────────┬──────────────────┬──────────────────────┘ │
│                 │                  │                         │
│         IPC: ForwardActionToRenderer                         │
│                 │                  │                         │
└─────────────────┼──────────────────┼─────────────────────────┘
                  ▼                  ▼
     ┌────────────────────┐  ┌────────────────────┐
     │   EMU RENDERER     │  │   IDE RENDERER     │
     │                    │  │                    │
     │  Redux Store       │  │  Redux Store       │
     │  - id: "emu"       │  │  - id: "ide"       │
     │  - Local state     │  │  - Local state     │
     │  - Forwards to main│  │  - Forwards to main│
     └────────────────────┘  └────────────────────┘
```

## Core Components

### 1. Redux Store (`redux-light.ts`)

Lightweight Redux implementation with:
- **`Store`**: Holds state tree, supports dispatch/subscribe
- **`Reducer`**: Pure function: `(state, action) => newState`
- **`ActionForwarder`**: Optional callback to forward actions cross-process

```typescript
type ActionForwarder = (action: Action, source: MessageSource) => Promise<void>;
type Store = {
  id: string;
  dispatch: (action: Action, source?: MessageSource) => Action;
  getState: () => AppState;
  subscribe: (listener: () => void) => Unsubscribe;
};
```

### 2. AppState (`AppState.ts`)

Single state tree structure shared across all processes:

```typescript
type AppState = {
  // Process status
  emuLoaded?: boolean;
  ideLoaded?: boolean;
  emuFocused?: boolean;
  ideFocused?: boolean;
  
  // Global settings
  globalSettings?: Record<string, any>;
  theme?: string;
  
  // Emulator state
  emulatorState?: EmulatorState;
  
  // IDE state
  ideView?: IdeView;
  project?: IdeProject;
  compilation?: CompilationState;
  
  // Media state
  media?: MediaState;
};
```

### 3. Store Creation

**Main Process** (`mainStore.ts`):
```typescript
const store = createAppStore("main", async (action, source) => {
  // Forward based on source to avoid loops
  if (source === "emu") sendToIde(action, source);
  else if (source === "ide") sendToEmu(action, source);
  else if (source === "main") {
    sendToEmu(action, source);
    sendToIde(action, source);
  }
});
```

**Renderer Process** (`rendererStore.ts`):
```typescript
const storeId = url.searchParams.has("emu") ? "emu" : "ide";
const store = createAppStore(storeId, async (action, source) => {
  // Only forward locally-originated actions
  if (source === "main") return;
  
  await ipcRenderer.invoke("ForwardAction", {
    action,
    sourceProcess: storeId
  });
});

// Listen for actions from main
ipcRenderer.on("ForwardActionToRenderer", (_event, { action, sourceProcess }) => {
  store.dispatch(action, sourceProcess); // Prevents re-forwarding
});
```

## Action Flow

### Example: Setting Theme from IDE

1. **IDE**: `store.dispatch(setThemeAction("dark"), "main")`
2. **IDE Forwarder**: Sends IPC `ForwardAction` → Main with `sourceProcess: "ide"`
3. **Main**: Receives action, dispatches with `source: "ide"`
4. **Main Reducer**: Updates main state
5. **Main Forwarder**: Forwards to EMU only (since source was IDE)
6. **EMU**: Receives IPC `ForwardActionToRenderer`, dispatches with `source: "ide"`
7. **EMU Reducer**: Updates EMU state
8. **Result**: All three stores synchronized, no loops

### Source Tracking

- **`source: "main"`**: Action originated locally, should be forwarded
- **`source: "emu"` or `"ide"`**: Action came via IPC, do NOT forward (prevent loops)

## Adding New State

### 1. Define Action (`actions.ts`)

```typescript
export const myFeatureAction: ActionCreator = (value: string) => ({
  type: "MY_FEATURE",
  payload: { value }
});
```

### 2. Add State Property (`AppState.ts`)

```typescript
export type AppState = {
  // ...existing
  myFeature?: string;
};

export const initialAppState: AppState = {
  // ...existing
  myFeature: ""
};
```

### 3. Handle in Reducer (`app-state-flags-reducer.ts`)

```typescript
export function appStateFlagsReducer(state: AppState, { type, payload }: Action): AppState {
  switch (type) {
    case "MY_FEATURE":
      return { ...state, myFeature: payload?.value };
    // ...existing cases
  }
}
```

### 4. Dispatch from Any Process

```typescript
// From renderer
store.dispatch(myFeatureAction("value"), "main");

// From main
mainStore.dispatch(myFeatureAction("value"), "main");
```

## Best Practices

1. **Always pass source**: `dispatch(action, "main")` for local actions
2. **Immutable updates**: Return new state objects, never mutate
3. **Check source in forwarders**: Prevent infinite loops
4. **Subscribe for UI updates**: Use `store.subscribe()` for reactive updates
5. **Centralize in AppState**: Keep all shared state in the main tree
6. **Use sub-reducers**: Split complex state into subtrees (emulatorState, ideView, etc.)

## IPC Channels

- **`ForwardAction`**: Renderer → Main (handle)
- **`ForwardActionToRenderer`**: Main → Renderer (send)
- **`MainToEmu`**: Main → Emu messaging
- **`EmuToMain`**: Emu → Main messaging
- **`MainToIde`**: Main → IDE messaging
- **`IdeToMain`**: IDE → Main messaging

## Integration with XMLUI

Use `SharedAppState` component to access store in XMLUI:

```xmlui
<SharedAppState id="appState" />
<Text>{appState.value.theme}</Text>
<Button onClick={() => appState.setTheme("dark")} />
```

The component:
- Subscribes to store changes
- Exposes state via `.value`
- Exposes action creators as methods
- Fires `didChange` events on updates
