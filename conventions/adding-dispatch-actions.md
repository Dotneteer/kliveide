# Adding New Dispatch Actions to Klive IDE

## Overview

This guide provides step-by-step instructions for adding new Redux actions that synchronize across all Electron processes (Main, EMU Renderer, IDE Renderer) using Klive's three-store architecture.

## Prerequisites

- Understanding of Redux actions and reducers
- Familiarity with TypeScript
- Knowledge of Klive's three-store architecture (see `xmlui-integration.md`)

## Step-by-Step Guide

### Step 1: Define the Action

**File:** `src/common/state/actions.ts`

Add a new action creator function:

```typescript
export const myNewAction: ActionCreator = (value: string) => ({
  type: "MY_NEW_ACTION",
  payload: { value }
});
```

**Action naming conventions:**
- Use SCREAMING_SNAKE_CASE for action types
- Use camelCase for action creator functions
- Action types should be descriptive and unique

**Examples:**
```typescript
// Boolean flag action
export const featureEnabledAction: ActionCreator = (flag: boolean) => ({
  type: "FEATURE_ENABLED",
  payload: { flag }
});

// String value action
export const setMachineTypeAction: ActionCreator = (machineType: string) => ({
  type: "SET_MACHINE_TYPE",
  payload: { machineType }
});

// Complex object action
export const updateSettingsAction: ActionCreator = (settings: Partial<Settings>) => ({
  type: "UPDATE_SETTINGS",
  payload: { settings }
});
```

---

### Step 2: Add State Property

**File:** `src/common/state/AppState.ts`

#### 2a. Add to interface

```typescript
export interface AppState {
  // ... existing properties
  myNewFeature?: string;  // Add your new property
}
```

#### 2b. Add initial value

```typescript
export const initialAppState: AppState = {
  // ... existing properties
  myNewFeature: "",  // Provide sensible default
};
```

**Type recommendations:**
- Use optional properties (`?`) for nullable values
- Provide type-safe defaults in `initialAppState`
- Use TypeScript types for complex structures

---

### Step 3: Add Reducer Case

**File:** `src/common/state/app-state-flags-reducer.ts`

Add a new case to handle your action:

```typescript
export function appStateFlagsReducer(
  state: AppState,
  action: Action
): AppState {
  const { type, payload } = action;
  switch (type) {
    // ... existing cases
    
    case "MY_NEW_ACTION":
      return { ...state, myNewFeature: payload?.value };
    
    default:
      return state;
  }
}
```

**Reducer best practices:**
- Always return a new state object (immutability)
- Use spread operator for shallow copies: `{ ...state, prop: newValue }`
- Access payload safely with optional chaining: `payload?.value`
- Keep reducers pure (no side effects)

**Examples:**
```typescript
// Boolean flag
case "FEATURE_ENABLED":
  return { ...state, featureEnabled: payload?.flag };

// Nested object update
case "UPDATE_SETTINGS":
  return { ...state, settings: { ...state.settings, ...payload?.settings } };

// Array manipulation
case "ADD_ITEM":
  return { ...state, items: [...state.items, payload?.item] };
```

---

### Step 4: Add API Method to SharedAppState

**File:** `src/renderer/src/lib/SharedAppState/SharedAppStateNative.tsx`

Add a new method inside the `useLayoutEffect` hook:

```typescript
useLayoutEffect(() => {
  if (registerComponentApiRef.current) {
    registerComponentApiRef.current({
      // ... existing methods (emuLoaded, ideLoaded, etc.)
      
      myNewFeature: (value: string) => {
        store.dispatch(myNewAction(value));
        updateStateRef.current({ value: store.getState() });
      },
    });
  }
  
  // ... rest of effect (store subscription)
}, []);
```

**Key points:**
- Method name should be descriptive and match usage intent
- Always call `store.dispatch()` with the appropriate action
- Always call `updateStateRef.current()` to trigger UI update
- Import the action creator at the top of the file

**Parameter patterns:**
```typescript
// Single parameter
myFeature: (value: string) => {
  store.dispatch(myFeatureAction(value));
  updateStateRef.current({ value: store.getState() });
},

// Multiple parameters
updateConfig: (key: string, value: any) => {
  store.dispatch(updateConfigAction(key, value));
  updateStateRef.current({ value: store.getState() });
},

// No parameters (toggle/trigger)
resetState: () => {
  store.dispatch(resetStateAction());
  updateStateRef.current({ value: store.getState() });
},
```

---

### Step 5: Update Type Definitions

**File:** `src/renderer/src/lib/SharedAppState/SharedAppState.tsx`

Update the metadata to include your new API method for documentation and type checking:

```typescript
export const SharedAppStateMd = createMetadata({
  // ... existing configuration
  
  api: {
    // ... existing methods
    
    myNewFeature: {
      parameters: [
        {
          name: "value",
          type: "string",
          description: "The value to set for the new feature"
        }
      ],
      description: "Sets the new feature value and syncs across all windows"
    },
  }
});
```

**Metadata best practices:**
- Provide clear, concise descriptions
- Document all parameters with types
- Include expected behavior in description
- Mention cross-window synchronization if applicable

---

### Step 6: Use in XMLUI Files

Now you can use your new action in any `.xmlui` file:

```xmlui
<Component name="MyComponent">
  <SharedAppState id="appState" />
  <App name="My App">
    <!-- Call the method -->
    <Button onClick="() => appState.myNewFeature('test value')">
      Set Feature
    </Button>
    
    <!-- Read the state -->
    <Text>Feature value: {appState.value.myNewFeature}</Text>
    
    <!-- Conditional rendering based on state -->
    <Text when="{appState.value.myNewFeature === 'test value'}">
      Feature is set to test value!
    </Text>
  </App>
</Component>
```

**Usage patterns:**
```xmlui
<!-- Button click -->
<Button onClick="() => appState.myFeature('value')">Click Me</Button>

<!-- Checkbox toggle -->
<Checkbox 
  initialValue="{appState.value.enabled}"
  onDidChange="v => appState.setEnabled(v)" />

<!-- Text input -->
<TextBox 
  value="{appState.value.username}"
  onDidChange="v => appState.setUsername(v)" />

<!-- Conditional rendering -->
<VStack when="{appState.value.isVisible}">
  <Text>This is visible!</Text>
</VStack>
```

---

### Step 7: Test Cross-Window Synchronization

Test that your action syncs correctly across all windows:

#### Testing Checklist

- [ ] **EMU Window**: Dispatch action from EMU, verify state updates locally
- [ ] **IDE Window**: Verify EMU's action appears in IDE window
- [ ] **IDE Window**: Dispatch action from IDE, verify state updates locally
- [ ] **EMU Window**: Verify IDE's action appears in EMU window
- [ ] **Main Process**: Dispatch action from main (if applicable), verify both windows update
- [ ] **No Infinite Loops**: Verify toggling values doesn't cause infinite loop
- [ ] **State Persistence**: Verify state survives window focus changes
- [ ] **Type Safety**: Verify TypeScript compilation with no errors

#### Testing Example

1. Open EMU window, open DevTools console
2. Open IDE window, open DevTools console
3. In EMU window: Click button that calls `appState.myFeature('from EMU')`
4. Verify EMU console shows action dispatched
5. Verify IDE window displays: `Feature value: from EMU`
6. In IDE window: Click button that calls `appState.myFeature('from IDE')`
7. Verify IDE console shows action dispatched
8. Verify EMU window displays: `Feature value: from IDE`

---

## Complete Checklist

Use this checklist when adding a new action:

- [ ] Define action creator in `src/common/state/actions.ts`
- [ ] Import `ActionCreator` type
- [ ] Export action creator function
- [ ] Add state property to `AppState` interface in `src/common/state/AppState.ts`
- [ ] Add initial value to `initialAppState`
- [ ] Add reducer case in `src/common/state/app-state-flags-reducer.ts`
- [ ] Handle payload safely with optional chaining
- [ ] Return new state object (immutability)
- [ ] Add API method in `src/renderer/src/lib/SharedAppState/SharedAppStateNative.tsx`
- [ ] Import action creator
- [ ] Dispatch action and update state ref
- [ ] Update metadata in `src/renderer/src/lib/SharedAppState/SharedAppState.tsx`
- [ ] Add to `api` object with parameters and description
- [ ] Use in XMLUI files (EMU and/or IDE)
- [ ] Test in both EMU window
- [ ] Test in IDE window
- [ ] Verify cross-window synchronization
- [ ] Verify no infinite loops
- [ ] Verify TypeScript compilation

---

## Common Patterns

### Pattern 1: Boolean Flag

```typescript
// 1. actions.ts
export const setDarkModeAction: ActionCreator = (enabled: boolean) => ({
  type: "SET_DARK_MODE",
  payload: { enabled }
});

// 2. AppState.ts
export interface AppState {
  darkMode?: boolean;
}
export const initialAppState: AppState = {
  darkMode: false,
};

// 3. reducer.ts
case "SET_DARK_MODE":
  return { ...state, darkMode: payload?.enabled };

// 4. SharedAppStateNative.tsx
setDarkMode: (enabled: boolean) => {
  store.dispatch(setDarkModeAction(enabled));
  updateStateRef.current({ value: store.getState() });
},

// 5. XMLUI usage
<Checkbox 
  initialValue="{appState.value.darkMode}"
  onDidChange="v => appState.setDarkMode(v)" />
```

### Pattern 2: String Value

```typescript
// 1. actions.ts
export const setThemeAction: ActionCreator = (themeId: string) => ({
  type: "SET_THEME",
  payload: { id: themeId }
});

// 2. AppState.ts
export interface AppState {
  themeId?: string;
}
export const initialAppState: AppState = {
  themeId: "default",
};

// 3. reducer.ts
case "SET_THEME":
  return { ...state, themeId: payload?.id };

// 4. SharedAppStateNative.tsx
setTheme: (id: string) => {
  store.dispatch(setThemeAction(id));
  updateStateRef.current({ value: store.getState() });
},

// 5. XMLUI usage
<Button onClick="() => appState.setTheme('dark')">Dark Theme</Button>
```

### Pattern 3: Complex Object

```typescript
// 1. actions.ts
export const updateUserPrefsAction: ActionCreator = (prefs: Partial<UserPreferences>) => ({
  type: "UPDATE_USER_PREFS",
  payload: { prefs }
});

// 2. AppState.ts
export interface UserPreferences {
  fontSize: number;
  lineHeight: number;
  tabSize: number;
}
export interface AppState {
  userPreferences?: UserPreferences;
}
export const initialAppState: AppState = {
  userPreferences: {
    fontSize: 14,
    lineHeight: 1.5,
    tabSize: 2
  },
};

// 3. reducer.ts
case "UPDATE_USER_PREFS":
  return { 
    ...state, 
    userPreferences: { 
      ...state.userPreferences, 
      ...payload?.prefs 
    } 
  };

// 4. SharedAppStateNative.tsx
updateUserPrefs: (prefs: Partial<UserPreferences>) => {
  store.dispatch(updateUserPrefsAction(prefs));
  updateStateRef.current({ value: store.getState() });
},

// 5. XMLUI usage
<Button onClick="() => appState.updateUserPrefs({ fontSize: 16 })">
  Increase Font
</Button>
```

---

## Troubleshooting

### Issue: State not syncing across windows

**Symptoms:** Action works in one window but doesn't appear in the other

**Possible causes:**
1. Forgot to add forwarder middleware
2. Source tracking incorrect
3. IPC not set up before content load

**Solution:**
- Verify main store forwarder is configured correctly
- Check that `sourceProcess` is passed through all IPC calls
- Ensure window creation happens before content loading

### Issue: Infinite loop

**Symptoms:** State toggles repeatedly without user interaction

**Possible causes:**
1. ActionForwarder forwarding received actions
2. Source parameter not preserved

**Solution:**
- Verify `actionForwarder.ts` checks `if (source !== "main") return;`
- Ensure `sourceProcess` is passed in IPC handlers
- Check that forwarder passes source parameter through

### Issue: TypeScript errors

**Symptoms:** Compilation errors or missing types

**Possible causes:**
1. Missing property in AppState interface
2. Missing initial value
3. Metadata not updated

**Solution:**
- Add property to `AppState` interface
- Add initial value to `initialAppState`
- Update metadata in `SharedAppState.tsx`

### Issue: State values are empty/undefined in renderer windows

**Symptoms:** Actions dispatched from main process show empty values in renderer windows

**Possible causes:**
1. Actions dispatched before renderer stores are initialized
2. Actions dispatched before window content is loaded

**Solution:**
This happens when the main process dispatches actions too early, before the renderer processes have initialized their stores. Use the **store subscription pattern** to wait for both windows to be ready:

```typescript
// In src/main/index.ts
const mainStore = getMainStore(sendActionToEmu, sendActionToIde);

// Track if we've already set the values (only set once)
let valuesSet = false;

// Subscribe to store changes to detect when both windows are loaded
mainStore.subscribe(() => {
  const state = mainStore.getState();
  
  // Once both windows are loaded and we haven't set values yet
  if (state.emuLoaded && state.ideLoaded && !valuesSet) {
    valuesSet = true;
    
    // Now dispatch your actions - renderer stores are ready
    mainStore.dispatch(myAction(value), 'main');
  }
});
```

**Why this works:**
- Renderer windows call `appState.emuLoaded()` and `appState.ideLoaded()` in their `onReady` handlers
- These actions update the main store
- The subscription detects when both are true
- By this time, both renderer stores are initialized and can receive forwarded actions
- The flag ensures values are only set once

**⚠️ Don't use:**
- `setTimeout()` - Unreliable and creates race conditions
- Dispatching before `loadEmulatorContent()` / `loadIdeContent()` - Renderer stores don't exist yet

---

## Related Documentation

- **XMLUI Integration**: `xmlui-integration.md` - Full framework documentation
- **Architecture**: `ARCHITECTURE.md` - System architecture and IPC patterns
- **Component Creation**: `create-xmlui-components.md` - Custom component patterns

---

*This guide focuses specifically on adding new dispatch actions to Klive IDE's cross-process state management system.*
