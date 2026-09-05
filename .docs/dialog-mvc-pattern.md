# Dialog MVC Pattern

How to build a renderer dialog whose behavior can be tested without rendering it.

This layers on top of [`dialog-pattern.md`](./dialog-pattern.md), which stays the baseline: MVC
dialogs are still opened with `useDialogs().open(...)`, still settle through `controls`, and still
render inside `Modal`. What changes is what lives *inside* the dialog component.

Reference implementation: `src/renderer/appIde/dialogs/sjasmplus/`.
Shared infrastructure: `src/renderer/mvc/`.

## When to use it

Use it when a dialog has **async orchestration plus derived display rules** — several service
calls that can interleave or fail, a busy state, and text or enablement that depends on more than
one piece of state at once.

Do **not** use it for a dialog that asks one question and returns an answer. `DeleteDialog`,
`RenameDialog`, `SetMemoryDialog` and `AboutDialog` have no orchestration to isolate; the
Intent/Event split would be pure ceremony there. Leave them on the plain pattern.

The signal to migrate is a test file that mounts React in order to assert a *decision*.

## The three layers

Layers 1 and 2 contain no React and no DOM, so they run in the fast `node` vitest project
(`*.test.ts`). Layer 3 is a pure function of its props.

```
                  intents (user actions)
   ┌────────────┐  ───────────────────►  ┌──────────────┐  ports  ┌───────────┐
   │    View    │                        │  Controller  │ ──────► │  MainApi  │
   │  (React,   │  ◄───────────────────  │  (async      │ ◄────── │  Redux    │
   │   dumb)    │      view model        │  orchestr.)  │ events  │  Dialogs  │
   └────────────┘                        └──────┬───────┘         └───────────┘
                                                │ events
                                         ┌──────▼───────┐
                                         │    Model     │  pure reducer + selectors
                                         │ (state, pure)│
                                         └──────────────┘
```

**Model** — `State`, an `Event` union, a pure total `reduce(state, event)`, and
`selectViewModel(state)`. Async *results* are events (`validationSettled`), so success and failure
take the same path in.

**Controller** — extends `UiController`. Takes `Intent`s in the user's vocabulary
(`testAgainRequested`), calls **ports**, emits events. Owns a `LatestRun` per independent async
stream.

**View** — `({ vm, dispatch })`. No `useState`, no `useEffect`, no `useMainApi`, no `useSelector`,
and no business conditionals: every branch reads a view-model field.

**Container** — Redux in, ports built from hooks, `Modal` around the view. Should be ~100 lines of
wiring with no decisions in it.

### Two vocabularies, on purpose

`Intent` (what the user did) and `Event` (what changed state) are separate unions. That separation
is what keeps `reduce` pure and lets a test assert "user pressed Apply → these port calls happened
and the state moved here" without mocking React. Sync intents usually map 1:1 to an event; async
ones emit a `…Started` event, await a port, and emit a `…Settled` event.

## Ports

A port is an interface the controller calls and a test fakes. `src/renderer/mvc/dialogs/` provides
the shared ones — `FilePickerPort`, `ConfirmPort`, `DialogClosePort` — plus `useDialogPorts.ts`,
the only module that knows a port is answered by `useMainApi()` or `useDialogs()`.

Give each dialog a `<Feature>Ports` type bundling the shared ports with a narrowed service port:

```ts
export type SjasmplusPorts = {
  files: FilePickerPort;
  confirm: ConfirmPort;
  close: DialogClosePort<SjasmplusIntegrationDialogResult>;
  service: SjasmplusServicePort;   // only the MainApi methods this dialog uses
};
```

Narrow the service port deliberately: a fake has to implement all of it.

**Redux state is not a port.** It is data. The container derives an `Environment` object and pushes
it in as an intent, so no layer below the container knows Redux exists — and tests construct it as
a literal instead of dispatching actions into a store.

## Testing

| Layer | File | Project | Asserts |
| --- | --- | --- | --- |
| Model | `<Feature>Model.test.ts` | node | reducer transitions, identity rules |
| View model | `<Feature>ViewModel.test.ts` | node | badges, notes, enablement, labels |
| Controller | `<Feature>Controller.test.ts` | node | user journeys over fake ports |
| View | `<Feature>View.test.tsx` | jsdom | vm → markup, DOM event → intent |
| Container | `<Feature>Dialog.test.tsx` | jsdom | Redux/MainApi/Modal wiring only |

Three rules:

1. **A rule is tested at the lowest layer that owns it.** If it can be expressed as `reduce` or
   `selectViewModel` input/output, it must not also have a DOM test.
2. **Fixtures are builders with defaults**, deep-merged, so a test names only the field it is
   about: `aState({ busy: "validate" })`, `aViewModel({ status: { badge: "failed" } })`. Derive the
   view-model builder from a real state (`deepMerge(selectViewModel(state), over)`) so a new field
   cannot be missed.
3. **No `vi.mock` of a module below the container.** Dependencies arrive through ports.

### The harness

`test/mvc/ControllerHarness.ts` drives any controller:

```ts
const h = await openSjasmplusDialog({ pickFile: "/tools/sjasmplus/sjasmplus" });

await h.dispatch({ type: "selectExecutableRequested" });   // runs to completion
expect(h.vm.apply.validationLabel).toBe("Passed");

await h.dispatch({ type: "applyRequested" });
expect(h.ports.service.apply).toHaveBeenCalledWith({ scope: "user", … });
expect(h.ports.close.close).toHaveBeenCalledWith("close");
```

`dispatch` runs an intent to completion; **`send` deliberately leaves it in flight** so the busy
view model can be asserted. Paired with `test/mvc/deferred.ts`, that is how you test states a
DOM-level test cannot reach at all:

```ts
const gate = deferred<SjasmplusProbeResult>();
h.ports.service.validateExecutable.mockReturnValue(gate.promise);

void h.send({ type: "testAgainRequested" });
expect(h.vm.apply.validationLabel).toBe("Running smoke test...");
expect(h.vm.buttons.applyEnabled).toBe(false);

gate.resolve(okProbe(path));
await h.settle();
```

Two deferreds resolved out of order test the `LatestRun` guard — the case hand-rolled `cancelled`
flags never cover.

The view test asserts markup **or** the dispatched intent, never both plus an outcome:

```ts
fireEvent.click(screen.getByText("Select executable..."));
expect(dispatch).toHaveBeenCalledWith({ type: "selectExecutableRequested" });
```

## Gotchas

These each cost real debugging time; none is obvious from the code.

- **Discriminated unions must use a string tag.** This project compiles with
  `strictNullChecks: false`, under which TypeScript does **not** narrow a union on a
  boolean-literal discriminant. `{ kind: "available" } | { kind: "unavailable" }` narrows;
  `{ available: true } | { available: false }` does not, and fails at the *use* site with a
  confusing "property does not exist".
- **`dispose()` must be reversible.** React's effect contract is setup → cleanup → setup, and
  `StrictMode` (which this app enables in `src/renderer/main.tsx`) runs that cycle for every effect
  in development. `useController` therefore calls `controller.activate()` on setup as well as
  `dispose()` on cleanup. A controller that could only be disposed is permanently dead after the
  first StrictMode cycle: its view freezes on whatever it was doing, with every control disabled.
  **Test one dialog under `<StrictMode>`** — the provider trees in `test/react-test-utils.tsx` do
  not add it, so nothing else will catch this.
- **A controller keeps the ports it was built with.** Anything the container receives as a prop and
  passes into a port — an `onClose` callback, for instance — must be read through a ref, or the
  controller holds the first render's closure forever.
- **Never spread the harness.** `state`, `vm` and `events` are getters; `{ ...harnessFor(c), ports }`
  evaluates them once and freezes the snapshot at construction. Pass extras to
  `harnessFor(controller, { ports })` instead.
- **`getSnapshot` must be reference-stable.** `useSyncExternalStore` re-renders whenever the
  snapshot differs by reference, so a selector rebuilt per call loops forever. `UiController`
  memoizes `viewModel` on state identity; keep it that way.
- **Guard the environment on three levels.** `useSelector` compares shallowly, so select
  *primitives* and build the environment with `useMemo`; then have `reduce` return the **same state
  object** when the new environment is equivalent. Only the last of those is visible in a test —
  `test/dialogs/sjasmplus/SjasmplusIntegrationDialog.test.tsx` has one asserting an unrelated
  settings write causes no re-test.
- **Return the same state object for a no-op transition.** It is what stops the store from waking
  subscribers, and it is worth a test per no-op event.
- **A new path alias needs six files.** `tsconfig.json`, `test/tsconfig.json`,
  `build/tsconfig.web.json`, `build/tsconfig.node.json`, `build/electron.vite.config.ts`,
  `build/vitest.config.ts`. A missing one fails only at build time, or only at test time.
- **`npm run build:check` currently type-checks nothing.** The root `tsconfig.json` is
  solution-style (`"files": []` plus references), so plain `tsc` resolves no inputs and exits 0.
  Verify with `npx tsc --noEmit --listFiles | grep -c "src/renderer"` — it prints 0. Until that is
  fixed, type-check against `build/tsconfig.web.json` explicitly.

## Migrating a dialog

Order matters: nothing below touches the shipped component until step 4.

1. Extract the pure helpers the component has accumulated, with their own node tests.
2. Write the Model and the ViewModel, translating the rules the current DOM tests assert. The
   dialog is untouched and still green.
3. Write the Controller over its ports, plus fakes and the journey tests. Still untouched.
4. Rewrite the view and container — **keeping every `data-testid`**.
5. **Run the old suite unchanged against the new component.** This is the acceptance gate. Only the
   import path may change. Any other edit is a behavior change and belongs in the commit message.
6. Re-partition the old suite into the five files above, deleting each DOM test whose rule is now
   covered purely. Record the mapping; a deleted test must be able to name its replacement.
7. Repoint the registry, delete the old files (no re-export shim), and run
   `npx electron-vite build --config build/electron.vite.config.ts` to catch stale imports.

## Commands

```sh
npm test -- --project node test/mvc test/dialogs/<feature>
```

```sh
npm test -- --project jsdom test/mvc test/dialogs/<feature>
```

```sh
npm run lint:renderer -- --quiet
```

```sh
npx electron-vite build --config build/electron.vite.config.ts
```
