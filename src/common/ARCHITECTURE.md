# Klive IDE - State Management & Inter-Process Communication Architecture

## Overview

Klive IDE is an Electron application with **three processes** that communicate and synchronize state:
- **Main Process** - Node.js process managing app lifecycle and native OS features
- **Emu Renderer** - Browser window running the emulator UI
- **IDE Renderer** - Browser window running the IDE UI

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                          MAIN PROCESS                            │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Store (AppState)                                         │   │
│  │ - emuLoaded, ideLoaded, emuFocused, ideFocused, etc.     │   │
│  └──────────────────────────────────────────────────────────┘   │
│           ▲                ▲                ▲                    │
│           │                │                │                    │
│  ┌────────┴──────┐  ┌──────┴───────┐  ┌────┴────────────────┐  │
│  │ MainToEmu     │  │ MainToIde    │  │ IPC Listeners       │  │
│  │ Messenger     │  │ Messenger    │  │ (EmuToMain/         │  │
│  │               │  │              │  │  IdeToMain)          │  │
│  └───────┬───────┘  └──────┬───────┘  └──────▲──────────▲───┘  │
└──────────┼──────────────────┼─────────────────┼──────────┼──────┘
           │                  │                 │          │
     IPC:  │MainToEmu         │MainToIde        │          │
           ▼                  ▼                 │          │
┌──────────────────────┐  ┌───────────────────────────────┐│
│   EMU RENDERER       │  │   IDE RENDERER         │      ││
│  ┌────────────────┐  │  │  ┌────────────────┐    │      ││
│  │ Store          │  │  │  │ Store          │    │      ││
│  │ (AppState)     │  │  │  │ (AppState)     │    │      ││
│  └────────────────┘  │  │  └────────────────┘    │      ││
│  ┌────────────────┐  │  │  ┌────────────────┐    │      ││
│  │ EmuApi         │  │  │  │ IdeApi         │    │      ││
│  │ (implemented)  │  │  │  │ (implemented)  │    │      ││
│  └────────────────┘  │  │  └────────────────┘    │      ││
│  ┌────────────────┐  │  │  ┌────────────────┐    │      ││
│  │ EmuToMain      │  │  │  │ IdeToMain      │    │      ││
│  │ Messenger      │  │  │  │ Messenger      │    │      ││
│  └───────┬────────┘  │  │  └───────┬────────┘    │      ││
└──────────┼───────────┘  └──────────┼─────────────┘      ││
           │                         │                     ││
           │EmuToMain                │IdeToMain            ││
           └─────────────────────────┴─────────────────────┘│
```

## 1. State Management (Redux-Light)

### Store Structure

Each process maintains its own **AppState** store using a lightweight Redux implementation:

```typescript
// src/common/state/AppState.ts
type AppState = {
  appPath?: string;
  emuLoaded?: boolean;
  emuStateSynched?: boolean;
  ideLoaded?: boolean;
  ideStateSynched?: boolean;
  isWindows?: boolean;
  emuFocused?: boolean;
  ideFocused?: boolean;
}
```

### Actions

Actions are the **only way** to modify state. Each action has:
- `type`: String key from `ActionTypes` interface
- `payload?`: Optional data from `Payload` type

```typescript
// Example action
const action = {
  type: "EMU_FOCUSED",
  payload: { flag: true }
}
```

### Reducers

Reducers are pure functions that take current state + action → new state:

```typescript
function appReducer(state: AppState, action: Action): AppState {
  state = appStateFlagsReducer(state, action);
  // ... other reducers
  return state;
}
```

### Store Creation

Create a store with optional **action forwarder** for IPC:

```typescript
const store = createAppStore("main", actionForwarder);
```

The `actionForwarder` is crucial: it automatically forwards dispatched actions to other processes.

## 2. Inter-Process Communication (IPC)

### Message Types

All messages extend `MessageBase` and flow through typed channels:

```typescript
type RequestMessage = 
  | ForwardActionRequest    // Forward Redux action between processes
  | ApiMethodRequest        // Call API method on another process

type ResponseMessage = 
  | ApiMethodResponse       // Return value from API call
  | DefaultResponse         // Simple acknowledgment
  | ErrorResponse           // Error occurred
  | NotReadyResponse        // Process not ready
```

### Messengers

**Messengers** handle bidirectional communication between processes:

| Messenger Class | Direction | Channels Used |
|----------------|-----------|---------------|
| `EmuToMainMessenger` | Emu → Main | `EmuToMain` / `EmuToMainResponse` |
| `IdeToMainMessenger` | Ide → Main | `IdeToMain` / `IdeToMainResponse` |
| `MainToEmuMessenger` | Main → Emu | `MainToEmu` / `MainToEmuResponse` |
| `MainToIdeMessenger` | Main → Ide | `MainToIde` / `MainToIdeResponse` |

**Key Features:**
- Auto-correlation of requests/responses via `correlationId`
- Promise-based async/await API
- Fire-and-forget via `postMessage()`
- Request-response via `sendMessage()`

### How Messengers Work

1. **Renderer sends request:**
   ```typescript
   const messenger = new EmuToMainMessenger();
   const response = await messenger.sendMessage({
     type: "ApiMethodRequest",
     method: "readTextFile",
     args: ["/path/to/file"]
   });
   ```

2. **Messenger assigns correlationId and sends via IPC**

3. **Main process receives, processes, sends response**

4. **Messenger matches correlationId and resolves promise**

## 3. Cross-Process APIs

### API Definition Pattern

Each process exposes an API that other processes can call:

```typescript
// src/common/messaging/MainApi.ts
class MainApiImpl {
  async readTextFile(path: string, encoding?: string): Promise<string> {
    return Promise.reject(new Error("Method should be implemented by a proxy."));
  }
}
```

The actual implementation is a **JavaScript Proxy** that:
1. Intercepts method calls
2. Sends `ApiMethodRequest` via messenger
3. Returns the result

### API Registration

APIs are created with `buildMessagingProxy()`:

```typescript
export function createMainApi(messenger: MessengerBase): MainApiImpl {
  return buildMessagingProxy(new MainApiImpl(), messenger, "main");
}
```

This proxy:
- Converts method calls into IPC messages
- Handles errors by throwing exceptions
- Provides type-safe API surface

### Available APIs

| API | Defined In | Callable From | Purpose |
|-----|-----------|---------------|---------|
| `MainApi` | MainApi.ts | Emu, IDE | Access main process features (file I/O, etc.) |
| `EmuApi` | EmuApi.ts | Main, IDE | Control emulator (set machine type, etc.) |
| `IdeApi` | IdeApi.ts | Main, Emu | IDE operations (script output, etc.) |

## 4. How to Extend the System

### Adding a New Action Type

1. **Define the action type:**
   ```typescript
   // src/common/state/ActionTypes.ts
   export interface ActionTypes {
     MY_NEW_ACTION: null;
   }
   ```

2. **Create action creator:**
   ```typescript
   // src/common/state/actions.ts
   export const myNewAction: ActionCreator = (value: string) => ({
     type: "MY_NEW_ACTION",
     payload: { text: value }
   });
   ```

3. **Add payload property (if needed):**
   ```typescript
   // src/common/state/Action.ts
   export type Payload = {
     text?: string;  // Add new property
     // ... existing properties
   }
   ```

4. **Handle in reducer:**
   ```typescript
   // src/common/state/app-state-flags-reducer.ts
   export function appStateFlagsReducer(state: AppState, { type, payload }: Action): AppState {
     switch (type) {
       case "MY_NEW_ACTION":
         return { ...state, myProperty: payload?.text };
       // ... other cases
     }
   }
   ```

5. **Dispatch from any process:**
   ```typescript
   store.dispatch(myNewAction("hello"));
   ```

The action will automatically forward to other processes if a forwarder is configured!

### Adding a New API Method

1. **Add method signature to API class:**
   ```typescript
   // src/common/messaging/MainApi.ts
   class MainApiImpl {
     async myNewMethod(param: string): Promise<number> {
       return Promise.reject(new Error(NO_PROXY_ERROR));
     }
   }
   ```

2. **Implement handler in target process:**
   ```typescript
   // In main process setup
   ipcMain.on("EmuToMain", async (event, request: RequestMessage) => {
     if (request.type === "ApiMethodRequest") {
       if (request.method === "myNewMethod") {
         const result = await actualImplementation(request.args[0]);
         event.reply("EmuToMainResponse", {
           type: "ApiMethodResponse",
           correlationId: request.correlationId,
           result
         });
       }
     }
   });
   ```

3. **Call from another process:**
   ```typescript
   const mainApi = createMainApi(emuToMainMessenger);
   const result = await mainApi.myNewMethod("test");
   ```

### Adding State Properties

1. **Update AppState type:**
   ```typescript
   // src/common/state/AppState.ts
   export type AppState = {
     myNewProperty?: string;
     // ... existing properties
   }
   ```

2. **Update initial state:**
   ```typescript
   export const initialAppState: AppState = {
     myNewProperty: undefined,
     // ... existing initial values
   };
   ```

3. **Create actions and reducers** (see "Adding a New Action Type" above)

## 5. State Synchronization Pattern

When a process loads, it follows this pattern:

1. **Process reports ready:**
   ```typescript
   store.dispatch(emuLoadedAction());
   ```

2. **Main process detects via state change**

3. **Main sends current state:**
   ```typescript
   messenger.sendMessage({
     type: "ForwardAction",
     action: { type: "SYNC_STATE", payload: { state: currentState } }
   });
   ```

4. **Renderer applies and confirms:**
   ```typescript
   store.dispatch(emuSynchedAction());
   ```

This ensures all processes have consistent state on startup.

## 6. Key Architectural Patterns

### Request-Response Correlation
Every message gets a unique `correlationId`. Responses include this ID so the messenger can match them to pending promises.

### Proxy-Based APIs
APIs use JavaScript Proxies to transparently convert method calls into IPC messages, maintaining type safety.

### Action Forwarding
When a store has an `ActionForwarder`, it automatically sends dispatched actions to other processes, keeping state synchronized.

### Reducer Composition
The main `appReducer` invokes specialized reducers for different state subtrees, keeping code organized.

## 7. Best Practices

✅ **DO:**
- Always dispatch actions to modify state (never mutate directly)
- Use action creators for consistency
- Keep reducers pure (no side effects)
- Forward actions when state needs to sync across processes
- Use async/await for API calls

❌ **DON'T:**
- Mutate state directly
- Put logic in action creators (keep them simple)
- Make API calls from reducers
- Forget to handle errors in API implementations
- Create circular dependencies between processes

## 8. Troubleshooting

**Actions not synchronizing?**
- Check if store was created with `actionForwarder`
- Verify messenger is registered before dispatch
- Check IPC channel listeners are set up

**API calls timing out?**
- Ensure target process has loaded
- Check IPC listener is handling the method
- Verify correlationId is being returned in response

**State getting out of sync?**
- Verify all processes use same initial state
- Check reducer logic is identical across processes
- Ensure actions are properly forwarded

---

*This architecture provides type-safe, reliable communication between Electron processes while maintaining clean separation of concerns.*
