# Messaging And Shared State Notes

Concise implementation notes for AI assistants. Read this before changing IPC, shared state, settings propagation, or XMLUI state binding.

## Process Topology

- Processes:
  - Main: Electron host, owns windows, settings persistence, app menu, file access.
  - EMU renderer: XMLUI renderer with `window=emulator`.
  - IDE renderer: XMLUI renderer with `window=ide`.
- Renderer code must not import Electron or Node directly. Renderer-to-main access goes through preload and IPC abstractions.
- Static resources for the main process are under `src/public`, copied to `out/public` during build.

## Messaging Files

- Message shapes/channels: `src/common/messaging/messages-core.ts`
- Request/response correlation: `src/common/messaging/MessengerBase.ts`
- API proxy builder: `src/common/messaging/MessageProxy.ts`
- API contracts:
  - `src/common/messaging/MainApi.ts`
  - `src/common/messaging/EmuApi.ts`
  - `src/common/messaging/IdeApi.ts`
- Renderer-to-main processors:
  - Renderer entry wiring: `src/renderer/messaging.ts`
  - Main processor: `src/main/RendererToMainProcessor.ts`
- Main-to-renderer messengers:
  - `src/common/messaging/MainToEmuMessenger.ts`
  - `src/common/messaging/MainToIdeMessenger.ts`
- Renderer-to-main messengers:
  - `src/common/messaging/EmuToMainMessenger.ts`
  - `src/common/messaging/IdeToMainMessenger.ts`

## API Messaging Pattern

- API messaging is command/request-response oriented and separate from reducer-driven shared state.
- `buildMessagingProxy()` wraps API contract classes. Calling a method sends:

```ts
{
  type: "ApiMethodRequest",
  method: propName,
  targetId,
  args
}
```

- `MessengerBase` assigns `correlationId` and resolves responses received on the paired response channel.
- Renderer calls main API through:

```ts
const mainApi = createMainApi(messenger);
setMainApi(mainApi);
```

- Main handles target routing in `processRendererToMainMessages()`:
  - `targetId === "emu"`: forward to EMU window.
  - `targetId === "ide"`: forward to IDE window.
  - otherwise: execute `MainMessageProcessor` methods.
- Main process APIs currently include:
  - `readTextFile(path, encoding?, resolveIn?)`
  - `getSettingValue(id)`
  - `setSettingValue(id, value)`
  - `getAllSettingValues()`
- To add a new API command:
  - Add method shape to the relevant `*Api.ts`.
  - Implement processing method in the receiving process processor.
  - If main-owned, add to `MainMessageProcessor`.
  - If renderer-owned, add to `EmuMessageProcessor` or `IdeMessageProcessor` in `src/renderer/messaging.ts`.

## Shared State Files

- App state shape/defaults: `src/common/state/AppState.ts`
- Action creators: `src/common/state/actions.ts`
- Store/reducer composition: `src/common/state/store.ts`
- Lightweight store implementation: `src/common/state/redux-light.ts`
- Reducers:
  - `src/common/state/app-state-flags-reducer.ts`
  - `src/common/state/global-settings-reducer.ts`
- Main store and forwarding: `src/main/main-store.ts`
- Renderer store/hooks: `src/renderer/shared-store.ts`
- XMLUI bridge component:
  - `src/renderer/lib/SharedAppState/SharedAppState.tsx`
  - `src/renderer/lib/SharedAppState/SharedAppStateReact.tsx`

## Shared State Forwarding

- Shared state is reducer-driven. Never update shared state by mutating objects directly.
- `mainStore` forwards reducer actions:
  - source `emu`: forward to IDE only.
  - source `ide`: forward to EMU only.
  - source `main`: forward to both EMU and IDE.
- Renderer `sharedStore` forwards only actions whose source equals the current renderer window kind:

```ts
if (source !== windowKind || !rendererActionForwarder) return;
```

- This prevents forwarded actions from bouncing back to main and creating loops.
- Renderer receives `ForwardAction` in `src/renderer/messaging.ts` and dispatches it locally with original `sourceId`.
- Main receives renderer `ForwardAction` in `RendererToMainProcessor` and dispatches to `mainStore`, which forwards to the other renderer.

## Startup State Sync

- Main loads settings before creating windows:
  - `loadAppSettings()`
  - `applyPersistedSettingsToStore()`
  - `startSettingsPersistence()`
- After each renderer window loads, `dispatchMainOwnedState()` forwards main-owned state:
  - `appPath`
  - `isWindows`
  - `theme`
  - `globalSettings`
  - `dimMenu`
  - focus flags
- Important: theme must be forwarded on window load. The menu reads main state, but XMLUI renderers need the forwarded `SET_THEME` action to update `currentTheme`.
- The renderer also initializes `appPath` from URL query in `src/renderer/shared-store.ts`.

## Settings Persistence And Shared State

- Settings file: `~/Klive/klive2.settings`.
- Settings implementation: `src/main/settings.ts`.
- Setting definitions/constants:
  - `src/common/settings/setting-const.ts`
  - `src/common/settings/setting-definitions.ts`
- Persisted global settings are stored under `AppState.globalSettings`.
- `setSettingValue(id, value)` validates and dispatches `SET_GLOBAL_SETTING` from source `"main"`.
- `startSettingsPersistence()` subscribes to `mainStore`; persisted, non-volatile global settings save immediately when changed.
- Tape media is persisted separately from `globalSettings` under `AppSettings.media`. The selected tape file path and parsed metadata are saved, while transient playback state is restored as rewound. Main dispatches persisted media through `SET_TAPE_MEDIA` during startup state sync, then `restorePersistedTapeFile()` reads file bytes and sends `EmuApi.setTapeFile(...)` so the EMU renderer can parse and upload to Wasm. Renderer-side tape upload is queued in `sp48-session.ts` if the active `Sp48MachineController` is not registered yet.
- XMLUI should update persisted settings through:

```xmlui
state.setSettingValue('some.setting.id', value)
```

- XMLUI can read current shared-state settings through:

```xmlui
state.globalSettings('showToolbar', true)
state.globalSettings('ideViewOptions.showToolbar', true)
```

## SharedAppState XMLUI Bridge

- Use `SharedAppState` for XMLUI access to shared reducer state and settings APIs.
- In this project, prefer `id="state"` in XMLUI markup.
- `SharedAppState` is non-visual and stateful.
- Reactive value is published with `updateState({ value: appState })`; do not register an API property named `value`.
- Exposed XMLUI APIs:
  - `dispatch(action)`
  - `dispatchSetTheme(themeId)`
  - `dispatchSetGlobalSetting(key, value)`
  - `globalSettings(key, defaultValue?)`
  - `getSettingValue(key)`
  - `getAllSettingValues()`
  - `setSettingValue(key, value)`
  - `update(key, value)` alias for global setting dispatch
- Event:
  - `onDidChange="arg => ..."`
  - First arg is new `AppState`; second arg is previous `AppState`.
  - `fireDidChangeOnInit` defaults to `true` and fires after mount so XMLUI event handlers are available.
- Top-level theme binding pattern:

```xmlui
<App var.currentTheme="" defaultTone="{currentTheme}">
  <SharedAppState
    id="state"
    onDidChange="arg => currentTheme = arg.theme" />
</App>
```

- Avoid `$param` ambiguity for custom component events; explicit arrow args are clearer.
- Keep `onDidChange` and `updateState` in refs in the React implementation to avoid maximum-update-depth loops when XMLUI handler identity changes.

## App Menu And State

- Menu implementation: `src/main/app-menu.ts`.
- Menus differ by focused window context (`emu` vs `ide`).
- Menu setting toggles call main settings APIs (`setSettingValue`), which dispatch reducer actions and persist.
- Theme menu dispatches `SET_THEME` from main and saves app settings.
- Unsupported menu commands currently show “Not implemented”.

## Common Pitfalls

- Do not mix API command messaging with shared-state reducer forwarding.
- When the emulator renderer receives a main-to-emulator API command that changes emulator-owned state, dispatch the resulting reducer action with source `"emu"`. Dispatching it as `"main"` updates the emulator renderer locally but the renderer forwarder will intentionally not send it back to the main store, leaving menu state stale.
- Do not directly mutate `AppState` or `globalSettings`; XMLUI can freeze objects and reducers must be immutable.
- Do not import Electron/Node modules from renderer code.
- Do not forward received renderer actions back to main from renderer; only forward locally-originated actions.
- Do not expose `value` through `registerComponentApi` in `SharedAppState`.
- For startup-visible XMLUI state, ensure main forwards the corresponding state after renderer load.
- A `SharedAppState` declared in a parent XMLUI component is not visible inside a separate component file. Add a local `SharedAppState id="state"` in component files that bind `state.value` or call `state.*` APIs.
