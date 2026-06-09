# XMLUI Notes

These notes summarize XMLUI lessons learned while wiring the Klive IDE Electron shell.

## Mental Model

- XMLUI is a declarative-reactive framework backed by React.
- `.xmlui` markup is parsed into a component tree; XMLUI composes state, evaluates expressions, and produces React elements.
- In Vite mode, `vite-xmlui-plugin` compiles `.xmlui` files to JavaScript modules at build time. Expressions and event handlers still execute at runtime.
- XMLUI expressions are spreadsheet-like: when relevant state changes, dependent expressions re-evaluate.

## XMLUI Event Handlers

- XMLUI event handlers are smart and async-aware.
- Do not add explicit `async` or `await` in XMLUI markup unless XMLUI syntax specifically requires it.
- XMLUI converts event-handler statements to a function body automatically.
- Prefer simple handler code such as:

```xmlui
<Button onClick="shared.dispatchSetTheme('light')" />
```

- For custom component events that pass arguments, prefer an explicit arrow parameter when it improves clarity:

```xmlui
<SharedAppState onDidChange="arg => currentTheme = arg.theme" />
```

- This avoids ambiguity around event argument names and makes it clear which value the handler reads.
- Event handlers are parsed by XMLUI's own scripting engine, not by `eval`.
- Binding expressions in props are synchronous. Do not call async functions in bindings; use events or data/action components instead.
- Event handlers are async and Promise-aware. State writes are processed statement by statement, so later statements can see earlier state changes.
- Mouse events are fire-and-forget at the DOM boundary. Return values are ignored.
- Form handlers are an important exception: form lifecycle handlers such as `onWillSubmit`, `onSubmit`, and `onSuccess` are awaited and their return values can affect submission flow.
- XMLUI access is optional by default: `obj.child.value` returns `undefined` if any segment is missing instead of throwing like normal JavaScript.
- Prefer XMLUI/App-provided helpers such as `delay`, `Log`, `App.fetch`, `Clipboard`, and `navigate` over direct browser globals. XMLUI has sandboxing/diagnostic rules around raw DOM and browser APIs.
- Avoid the `new` operator in XMLUI markup. XMLUI supports only a restricted constructor allow-list, and relying on constructors in markup can break across framework versions or sandbox settings.
- For query-string checks in XMLUI markup, prefer simple string operations or move parsing into TypeScript/React code. For example, use `window.location.search.indexOf('window=emulator') >= 0` instead of `new URLSearchParams(...)`.

## Component Scope

- Components declared in `Main.xmlui` are not visible inside separately declared component files.
- If a component file needs an XMLUI component instance, declare it in that component file.
- For example, both `EmuApp.xmlui` and `IdeApp.xmlui` declare their own `SharedAppState` instance:

```xmlui
<SharedAppState id="shared" />
```

## State Vs API Messaging

- Keep API communication separate from shared state.
- API communication demonstrates direct process commands, such as calling an emulator or IDE API through IPC.
- Shared state is reducer-driven and should be demonstrated with reducer actions, not API calls.

## Reactive Component State

- To expose reactive values from a custom React-backed XMLUI component, use XMLUI's `updateState` mechanism.
- A component that calls `updateState({ value })` should be wrapped as stateful:

```ts
wrapComponent("SharedAppState", SharedAppStateReact, SharedAppStateMd, {
  exposeRegisterApi: true,
  stateful: true
});
```

- This lets XMLUI expressions such as `{shared.value.theme}` update reactively.
- For non-visual state holder components, mark metadata with `nonVisual: true`.
- Calling `updateState` updates XMLUI component reducer state. This is the path expressions observe.
- An `id` does not create a container by itself. It registers component APIs with the nearest enclosing container when the component calls `registerComponentApi`.
- `id` APIs and `updateState` values are merged into XMLUI state differently. Be careful not to register an API property that shadows a reactive state property.

## Registered APIs And Reactive Values

- Do not expose `value` through `registerComponentApi` when the component also publishes `value` through `updateState`.
- XMLUI merges registered component APIs into component state, and API properties can override reactive component state properties.
- Keep `shared.value` as XMLUI component state only.
- Expose commands as API methods, for example:

```ts
registerComponentApi({
  dispatch,
  dispatchSetTheme,
  dispatchSetGlobalSetting
});
```

## SharedAppState Pattern

- XMLUI markup should not reach into `window.sharedAppState`.
- Prefer XMLUI-friendly APIs on `SharedAppState`:

```xmlui
<Button onClick="shared.dispatchSetTheme('dark')" />
<Button onClick="shared.dispatchSetGlobalSetting('ideNote', 'IDE updated this')" />
```

- Use `id="state"` for the app-level `SharedAppState` instance in this project.
- `SharedAppState` exposes `didChange` as `onDidChange`; the event receives the new `AppState` as its first argument and the previous `AppState` as its second argument.
- `SharedAppState` can fire `didChange` when it publishes its initial value. The `fireDidChangeOnInit` property controls this behavior and defaults to `true`.
- Fire initial custom events from a post-mount effect, not from the same layout effect that first calls `updateState`. XMLUI may not have supplied the event handler during the earliest state publication.
- A top-level theme synchronization example:

```xmlui
<App var.currentTheme="dark" defaultTone="{currentTheme}">
  <SharedAppState
    id="state"
    onDidChange="arg => currentTheme = (arg.theme === 'light' || arg.theme === 'dark') ? arg.theme : currentTheme" />
</App>
```

- `App.defaultTone` accepts only `"light"` or `"dark"`. Do not initialize a bound tone variable to `""`, and guard shared-state event assignments so partial or malformed event payloads cannot pass an invalid tone into `App`.
- In React-backed XMLUI components, keep event handlers such as `onDidChange` and XMLUI callbacks such as `updateState` in refs if they are used by stable effects. Otherwise, handler identity changes can accidentally retrigger state publication and create React maximum-update-depth loops.
- React components should access shared state through hooks in `src/renderer/shared-store.ts`, such as:
  - `useStore`
  - `useSharedState`
  - `useDispatch`
  - `useDispatchSetTheme`
  - `useDispatchSetGlobalSetting`

## State Containers And Variables

- XMLUI creates an internal container when a node has `var.*`, loaders, functions, `uses`, context variables, or script/code-behind.
- Implicit containers inherit all parent state. Explicit containers created with `uses` inherit only the listed keys.
- `uses="[]"` creates a full state boundary.
- XMLUI state is composed in layers: parent state, component reducer state, registered component APIs, context variables, local variables, and global variables.
- Higher layers can shadow lower layers. This matters when choosing names for variables and component APIs.
- `var.foo="{expr}"` is a reactive declaration, not merely an initializer. It re-evaluates on render until an event handler assigns to `foo`.
- Once an event handler assigns to a `var.*` name, that runtime reducer value shadows the declaration value.
- Event-handler mutations are tracked with proxies, so statements like `count++` and `user.name = 'Alice'` dispatch XMLUI state changes.

## Custom React-Backed Components

- Prefer the standard XMLUI split:
  - `ComponentName.tsx` for metadata and XMLUI renderer/registration.
  - `ComponentName.defaults.ts` for static defaults.
  - `ComponentNameReact.tsx` for React implementation and hooks.
- The XMLUI renderer function is not a React component. Do not use React hooks in renderer functions or `wrapComponent` `customRender`.
- Put React hooks only in the React implementation file.
- Metadata is the public contract for docs, tooling, type contracts, events, APIs, context variables, and theme variables.
- Use `valueType`, not `type`, in metadata. `wrapComponent` reads `valueType`.
- `wrapComponent` is the preferred integration path for ordinary React-backed components.
- `createComponentRenderer` is for unusual renderer infrastructure or cases that need fully manual extraction.
- `wrapComponent` auto-extracts basic `boolean`, `number`, `string`, `ComponentDef`, and resource URL props. Specialized extractors such as size, color, icon, length, display text, or layout prop handling require explicit config or `customRender`.
- Set `exposeRegisterApi: true` only when the React component calls `registerComponentApi`.
- Set `stateful: true` when a custom component needs `value`, `initialValue`, and `updateState` but metadata does not make that obvious.
- Use `passUpdateState: false` if a component declares `didChange` but should not receive `updateState`.

## User-Defined Components

- XMLUI user-defined components use `<Component name="Name">`.
- Component names should be PascalCase. In standalone mode, the component name must match the filename.
- UDCs access parent-provided properties through `$props`.
- UDCs can expose slots with `<Slot />`; named slots must end with `Template`.
- UDCs can emit events with `emitEvent('eventName', data)`.
- UDCs are compound components. Built-in behaviors such as tooltip/label/variant are skipped on the compound wrapper; apply them to built-in components inside the UDC template when needed.

## Visibility And Lifecycle

- `when` usually unmounts a component when false, so local component state can be lost.
- Responsive visibility uses `when-*` rules with mobile-first breakpoint selection.
- `onMount`, `onUnmount`, and `onError` are universal lifecycle events. Legacy `onInit` and `onCleanup` are aliases.
- Prefer `onMount` and `onUnmount` over legacy aliases.
- `onUnmount` must be synchronous. Use `onBeforeDispose` for async cleanup with a timeout budget.
- Use the non-visual `<Lifecycle>` component when setup/cleanup must re-arm as a value changes.

## Splitter Notes

- `Splitter`/`VSplitter` `initialPrimarySize`, `minPrimarySize`, and `maxPrimarySize` expect CSS size strings such as `520px`, `60%`, or `-100px`.
- Although the Splitter docs describe the `resize` event primary value as pixels, the XMLUI 0.12.29 implementation emits pixels during initialization and percentages during actual drag movement. When persisting a dragged splitter position, save values `<= 100` as percentages and larger values as pixels.
- Do not persist splitter resize values back into shared state on every `onResize` event. Persisting continuously can feed reactive setting changes back into `initialPrimarySize` and disturb live dragging. Prefer local XMLUI state while dragging, then persist after release.
- XMLUI event handlers can be asynchronous. If a DOM-level `pointerup`/`mouseup` helper reads a value updated by an XMLUI resize handler, defer the read with `setTimeout(..., 0)` so the last XMLUI assignment can land first.

## Theming And Styling

- XMLUI themes compile to CSS custom properties with the `--xmlui-*` prefix.
- Theme variables can reference other variables with `$name`, which resolves to `var(--xmlui-name)`.
- Component metadata can declare `themeVars` from SCSS with `parseScssVar` and provide `defaultThemeVars`.
- Theme variable names follow `property[-partOrScreen][-Component][-variant][--state]`.
- Use `useComponentThemeClass(metadata)` in React implementations when the component consumes metadata-defined theme variables.
- For non-visual components, skip SCSS/theme variables and set `nonVisual: true`.

## Type Contracts And Tooling

- Metadata drives docs, language server completions, Vite validation, and runtime diagnostics.
- Static type-contract checks run after parsing and before rendering. They can catch unknown props, missing required props, invalid enum literals, unknown events, unknown API methods, and deprecated props.
- Expression-valued props are checked at runtime after `ComponentAdapter` evaluates them.
- Accurate metadata is not decoration; it affects build/editor diagnostics and `wrapComponent` behavior.

## Immutability

- XMLUI may freeze objects that flow through its reactive state machinery.
- Reducers must not mutate existing state objects.
- Avoid using mutating helpers such as `lodash.set` directly on current state.
- Clone state first or use immutable update helpers.

## Useful Source Documents

- `/Users/dotneteer/source/xmlui/xmlui/dev-docs/guide/01-mental-model.md`
- `/Users/dotneteer/source/xmlui/xmlui/dev-docs/guide/02-rendering-pipeline.md`
- `/Users/dotneteer/source/xmlui/xmlui/dev-docs/guide/03-container-state.md`
- `/Users/dotneteer/source/xmlui/xmlui/dev-docs/guide/04-component-architecture.md`
- `/Users/dotneteer/source/xmlui/xmlui/dev-docs/guide/05-wrapcomponent.md`
- `/Users/dotneteer/source/xmlui/xmlui/dev-docs/guide/06-expression-eval.md`
- `/Users/dotneteer/source/xmlui/xmlui/dev-docs/guide/10-action-execution.md`
- `/Users/dotneteer/source/xmlui/xmlui/dev-docs/guide/11-user-defined-components.md`
- `/Users/dotneteer/source/xmlui/xmlui/dev-docs/guide/27-type-contracts.md`
- `/Users/dotneteer/source/xmlui/xmlui/dev-docs/guide/28-lifecycle.md`
- `/Users/dotneteer/source/xmlui/xmlui/dev-docs/guide/07-theming-styling.md`
- `/Users/dotneteer/source/xmlui/xmlui/src/components/_conventions.md`
