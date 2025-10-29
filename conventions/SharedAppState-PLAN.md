# SharedAppState Component - Implementation Plan

## Overview

`SharedAppState` is a custom XMLUI component that bridges XMLUI markup with Klive IDE's cross-process Redux store. It provides reactive access to the shared application state and exposes action creators as methods, enabling XMLUI components to read and update state that synchronizes across all three processes (Main, Emu, IDE).

## Component Characteristics

- **Non-visual component** - Renders nothing, similar to `AppState` and `ChangeListener`
- **State synchronization** - Connects to the Redux store in the current process
- **Cross-process updates** - Changes propagate automatically via the action forwarding mechanism
- **Reactive updates** - UI updates automatically when state changes in any process
- **Action exposure** - Exposes Redux action creators as callable methods

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     XMLUI Component Tree                      │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ <SharedAppState id="appState" />                       │  │
│  │   - Subscribes to Redux store                          │  │
│  │   - Exposes state via .value property                  │  │
│  │   - Exposes actions as methods                         │  │
│  │   - Fires didChange event on state updates             │  │
│  └────────────────┬───────────────────────────────────────┘  │
│                   │                                           │
│                   │ store.subscribe()                         │
│                   ▼                                           │
│  ┌────────────────────────────────────────────────────────┐  │
│  │         Redux Store (in current process)               │  │
│  │  - AppState: { emuLoaded, ideLoaded, focused, ... }   │  │
│  │  - Reducers: appReducer, appStateFlagsReducer         │  │
│  │  - Action forwarder: sends to other processes          │  │
│  └────────────────┬───────────────────────────────────────┘  │
└────────────────────┼──────────────────────────────────────────┘
                     │
                     │ ForwardActionRequest
                     ▼
           ┌─────────────────────┐
           │   IPC Messaging     │
           │  (Main/Emu/IDE)     │
           └─────────────────────┘
```

## Component API Design

### Properties

| Property | Type | Default | Required | Description |
|----------|------|---------|----------|-------------|
| `id` | string | - | Yes | Identifier to access this SharedAppState instance |
| `throttleWaitInMs` | number | 0 | No | Throttle time for didChange event to prevent excessive firing |

### Events

| Event | Parameters | Description |
|-------|-----------|-------------|
| `didChange` | `{ prevValue: AppState, newValue: AppState }` | Fired when the Redux store state changes |

### Exposed State

- **`value`**: Current `AppState` object from Redux store
  - `appPath?: string`
  - `emuLoaded?: boolean`
  - `emuStateSynched?: boolean`
  - `ideLoaded?: boolean`
  - `ideStateSynched?: boolean`
  - `isWindows?: boolean`
  - `emuFocused?: boolean`
  - `ideFocused?: boolean`

### Exposed Methods (Action Creators)

The component exposes all action creators as methods:

| Method | Signature | Description |
|--------|-----------|-------------|
| `emuLoaded()` | `() => void` | Signals that the emulator has loaded |
| `emuSynched()` | `() => void` | Signals that the emulator state is synched |
| `ideLoaded()` | `() => void` | Signals that the IDE has loaded |
| `isWindows(flag)` | `(flag: boolean) => void` | Sets whether running on Windows |
| `emuFocused(flag)` | `(flag: boolean) => void` | Sets emulator focus state |
| `ideFocused(flag)` | `(flag: boolean) => void` | Sets IDE focus state |
| `setTheme(id)` | `(id: string) => void` | Sets the current theme |

## Usage Examples

### Example 1: Basic State Access

Display information from the shared app state:

```xmlui
<Component name="StatusBar">
  <SharedAppState id="appState" />
  
  <HStack gap="$space-4" padding="$space-2">
    <Text when="{appState.value.emuLoaded}">
      ✓ Emulator Ready
    </Text>
    <Text when="{appState.value.ideLoaded}">
      ✓ IDE Ready
    </Text>
    <Text when="{appState.value.isWindows}">
      Running on Windows
    </Text>
    <Text>
      Theme: {appState.value.theme || 'default'}
    </Text>
  </HStack>
</Component>
```

### Example 2: Conditional Rendering Based on State

Show different UI based on which window is focused:

```xmlui
<Component name="ContextualToolbar">
  <SharedAppState id="appState" />
  
  <VStack>
    <Panel when="{appState.value.emuFocused}">
      <H3>Emulator Controls</H3>
      <Button>Start</Button>
      <Button>Stop</Button>
      <Button>Reset</Button>
    </Panel>
    
    <Panel when="{appState.value.ideFocused}">
      <H3>IDE Tools</H3>
      <Button>Compile</Button>
      <Button>Debug</Button>
      <Button>Run</Button>
    </Panel>
  </VStack>
</Component>
```

### Example 3: Dispatching Actions via Methods

Update the shared state from UI interactions:

```xmlui
<Component name="ThemeSelector">
  <SharedAppState id="appState" />
  
  <VStack gap="$space-2">
    <H3>Select Theme</H3>
    
    <Button onClick="() => appState.setTheme('light')">
      Light Theme
    </Button>
    
    <Button onClick="() => appState.setTheme('dark')">
      Dark Theme
    </Button>
    
    <Button onClick="() => appState.setTheme('high-contrast')">
      High Contrast
    </Button>
    
    <Text>Current: {appState.value.theme}</Text>
  </VStack>
</Component>
```

### Example 4: Reacting to State Changes

Use the `didChange` event to trigger side effects:

```xmlui
<Component name="FocusTracker" var.focusHistory="{[]}">
  <SharedAppState 
    id="appState"
    onDidChange="(e) => {
      if (e.newValue.emuFocused !== e.prevValue.emuFocused) {
        focusHistory.push({ window: 'emu', focused: e.newValue.emuFocused, time: Date.now() });
      }
      if (e.newValue.ideFocused !== e.prevValue.ideFocused) {
        focusHistory.push({ window: 'ide', focused: e.newValue.ideFocused, time: Date.now() });
      }
    }" />
  
  <VStack>
    <H3>Focus History</H3>
    <ForEach items="{focusHistory}" var.item>
      <Text>
        {item.window} {item.focused ? 'gained' : 'lost'} focus at {new Date(item.time).toLocaleTimeString()}
      </Text>
    </ForEach>
  </VStack>
</Component>
```

### Example 5: Throttled State Monitoring

Monitor state changes with throttling to avoid excessive updates:

```xmlui
<Component name="StateMonitor" var.updateCount="{0}">
  <SharedAppState 
    id="appState"
    throttleWaitInMs="1000"
    onDidChange="() => updateCount++" />
  
  <VStack>
    <Text>State updated {updateCount} times (throttled to 1 per second)</Text>
    <Text>Emulator: {appState.value.emuLoaded ? 'Loaded' : 'Not loaded'}</Text>
    <Text>IDE: {appState.value.ideLoaded ? 'Loaded' : 'Not loaded'}</Text>
  </VStack>
</Component>
```

### Example 6: Cross-Window Coordination

Coordinate behavior across Emu and IDE windows:

```xmlui
<!-- In EmuApp.xmlui -->
<Component name="EmuApp">
  <App name="Klive Emulator">
    <SharedAppState id="appState" />
    
    <VStack>
      <H1>Klive Emulator</H1>
      
      <!-- Show warning if IDE is not loaded -->
      <Alert 
        variant="warning" 
        when="{!appState.value.ideLoaded}">
        IDE window is not loaded. Some features may be unavailable.
      </Alert>
      
      <!-- Notify when IDE gains focus -->
      <Toast 
        visible="{appState.value.ideFocused}"
        message="IDE window is now active" />
    </VStack>
  </App>
</Component>

<!-- In IdeApp.xmlui -->
<Component name="IdeApp">
  <App name="Klive IDE">
    <SharedAppState id="appState" />
    
    <VStack>
      <H1>Klive IDE</H1>
      
      <!-- Show emulator status -->
      <StatusBar>
        <Text when="{appState.value.emuLoaded}">
          Emulator: Connected
        </Text>
        <Text when="{!appState.value.emuLoaded}">
          Emulator: Disconnected
        </Text>
      </StatusBar>
    </VStack>
  </App>
</Component>
```

### Example 7: Initialization Pattern

Signal when components are ready:

```xmlui
<Component name="EmuApp">
  <App name="Klive Emulator">
    <SharedAppState id="appState" />
    
    <!-- Signal that emulator has loaded -->
    <Script onMounted="() => appState.emuLoaded()" />
    
    <VStack>
      <H1>Klive Emulator</H1>
      <EmulatorScreen />
    </VStack>
  </App>
</Component>
```

### Example 8: Combining with Local AppState

Use both SharedAppState (cross-process) and AppState (local UI):

```xmlui
<Component name="Settings">
  <!-- Cross-process state -->
  <SharedAppState id="globalState" />
  
  <!-- Local UI state -->
  <AppState id="localUI" bucket="settingsUI" initialValue="{{
    selectedTab: 'general',
    unsavedChanges: false
  }}" />
  
  <VStack>
    <TabPanel selected="{localUI.value.selectedTab}">
      <Tab id="general" label="General">
        <!-- Can modify global state -->
        <Button onClick="() => globalState.setTheme('dark')">
          Set Dark Theme (affects all windows)
        </Button>
      </Tab>
      
      <Tab id="local" label="Local">
        <!-- Modify local UI state only -->
        <Button onClick="() => localUI.update({ selectedTab: 'general' })">
          Switch Tab (local only)
        </Button>
      </Tab>
    </TabPanel>
    
    <!-- Show global theme -->
    <Text>Current theme: {globalState.value.theme}</Text>
  </VStack>
</Component>
```

## Implementation Steps

### Phase 1: Component Structure
1. Create `SharedAppState/` folder in `src/renderer/src/lib/`
2. Create `SharedAppState.tsx` (component definition & renderer)
3. Create `SharedAppStateNative.tsx` (React implementation)
4. No styles needed (non-visual component)

### Phase 2: Store Integration
1. Access the Redux store from renderer process
2. Subscribe to store changes
3. Map store state to component state
4. Handle cleanup on unmount

### Phase 3: Action Exposure
1. Import all action creators from `src/common/state/actions.ts`
2. Wrap actions with store.dispatch
3. Register actions as component API methods
4. Ensure actions trigger across all processes via forwarder

### Phase 4: Event System
1. Implement didChange event with prev/new value comparison
2. Add throttling support using lodash.throttle
3. Fire events on state updates

### Phase 5: Registration
1. Add component to `src/renderer/src/lib/index.tsx`
2. Test in both EmuApp.xmlui and IdeApp.xmlui
3. Verify cross-process synchronization

## Technical Considerations

### Store Access
The Redux store needs to be accessible from the XMLUI renderer. Options:
1. **Global export**: Export store from a module that can be imported
2. **Context**: Provide store via React context
3. **Window object**: Attach store to window for easy access (development only)

**Recommendation**: Use a module export pattern for clean dependency management.

### State Comparison
Use `lodash.isEqual` for deep comparison to detect actual changes and prevent unnecessary events.

### Memory Management
- Unsubscribe from store on component unmount
- Clean up throttled functions properly
- Avoid memory leaks from event handlers

### Type Safety
- Define TypeScript interfaces for all props
- Use proper types for AppState
- Type-safe action creator methods

### Testing Strategy
1. Unit tests for native component (store subscription, event firing)
2. Integration tests for cross-process synchronization
3. Manual testing in both Emu and IDE windows
4. Verify throttling behavior

## Future Enhancements

- **Selectors**: Add support for state selectors to only listen to specific parts of state
- **Action batching**: Batch multiple actions to reduce IPC overhead
- **State history**: Track state changes for debugging
- **DevTools integration**: Connect to Redux DevTools for state inspection

## Related Documentation

- See `ARCHITECTURE.md` for state management and IPC details
- See `xmlui-integration.md` for XMLUI component patterns
- See `create-xmlui-components.md` for component creation conventions

---

*This plan provides the blueprint for implementing SharedAppState, a bridge between XMLUI and Klive's Redux architecture.*
