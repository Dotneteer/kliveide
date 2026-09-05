# Dialog MVC Refactor Plan — prototyped on the SJASMPLUS Integration dialog

Status: **complete** — all 10 steps implemented
Scope: renderer dialogs; prototype on `SjasmplusIntegrationDialog`, generalize afterwards
Related docs: `.docs/dialog-pattern.md` (stays valid — this plan layers on top of it, it does not replace it)

## 1. Problem

`src/renderer/appIde/dialogs/SjasmplusIntegrationDialog.tsx` is 1098 lines in which four
different concerns are braided together:

| Concern | Where it lives today |
| --- | --- |
| State (13 `useState` hooks) | inside the component |
| Async orchestration (probe → validate → apply, download, release list) | closures inside the component, each with its own `busy` / `cancelled` bookkeeping |
| Derived presentation rules (`showsReplacement`, `showsRejection`, badge suppression, `formatValidation`, `getNextStepHint`) | free functions + inline JSX expressions |
| Rendering | one 300-line JSX block |

The consequence is visible in `test/controls/SjasmplusIntegrationDialog.test.tsx`: 28 tests,
809 lines, every one of which must mount React, mock `@renderer/core/MainApi` wholesale, drive
the UI through `fireEvent` + `getByText("Test again")`, and then wait on DOM text. The tests
are really testing *decision logic* (does a stale failure keep its badge when a replacement
passes?) but they pay the full cost of jsdom, provider trees, and text-matching to do it.
They also break on any label or markup change that has nothing to do with the rule under test.

What is wanted: a way to **emulate user interactions and data and assert on the outcome without
rendering**, with the DOM-level tests reduced to a thin wiring check.

## 2. Target architecture

A three-layer split, deliberately named MVC even though the React-idiomatic name is MVP/MVVM.
The essential property is that **layers 1 and 2 contain no React and no DOM**, so they are
testable in the fast `node` vitest project (`*.test.ts`), while layer 3 is a pure function of
its props.

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

### Layer 1 — Model (pure, synchronous)

- `State`: one plain object. No promises, no React.
- `Event`: everything that can change state, including the *results* of async work
  (`probeSucceeded`, `validationSettled`, `releaseListFailed`, …).
- `reduce(state, event): State`: pure, total, no I/O.
- `selectViewModel(state): ViewModel`: pure. Produces everything the view renders — text,
  badge kind, enablement flags, option lists, labels. The view then contains no `? :` logic
  about business rules.

### Layer 2 — Controller (async, no React, no DOM)

- Owns a `UiStore<State, Event>` (tiny observable: `getSnapshot` / `subscribe` / `dispatch`).
- Exposes `dispatch(intent)` where `Intent` is the **user vocabulary**:
  `{ type: "testAgainRequested" }`, `{ type: "suggestionPicked", suggestion }`, …
- Handles each intent by calling **ports** (injected interfaces) and dispatching the resulting
  events into the reducer.
- Ports are the only outside world: `mainApi`, the confirm dialog, the file picker, and `close`.

Two vocabularies (Intent in, Event out) is intentional. It is what keeps `reduce` pure and
lets a test assert "user pressed Apply → these port calls happened and the state moved here"
without any mocking of React.

### Layer 3 — View (React, dumb)

- `SjasmplusIntegrationView({ vm, dispatch })`. No `useState`, no `useEffect`, no `useMainApi`,
  no `useSelector`. It maps `vm` fields to markup and DOM events to `dispatch(intent)`.
- The container `SjasmplusIntegrationDialog.tsx` shrinks to ~40 lines: build ports from hooks,
  create/bind the controller, render `<Modal>` + view.

## 3. Folder layout

Common infrastructure is deliberately generic (`mvc`, not `dialog-mvc`) because the request is
to make "particular parts of the Klive UI" testable — panels and tool windows are the next
candidates after dialogs.

```
src/renderer/mvc/                         ← NEW, generic infrastructure
  core/
    UiStore.ts             Observable store: getSnapshot / subscribe / dispatch / event log
    UiController.ts        UiController<TState, TIntent, TEvent, TViewModel> base class
    LatestRun.ts           Generation guard replacing the ad-hoc `cancelled` flags
    errors.ts              messageOf(err) — the `err?.message ?? String(err)` idiom, once
    types.ts               UiReducer, UiSelector, UiDispatch, Unsubscribe
  react/
    useController.ts       Creates + disposes a controller for the component lifetime
    useViewModel.ts        useSyncExternalStore binding to controller.viewModel
  dialogs/
    DialogPorts.ts         Shared port shapes (see §4)
    ConfirmDialog.tsx      Generic confirm body used by the ConfirmPort
    useDialogPorts.ts      Adapter: useMainApi() + useDialogs() → the shared ports
  index.ts                 (barrel for the core types only)

src/renderer/appIde/dialogs/sjasmplus/    ← NEW feature folder (moved out of dialogs/)
  SjasmplusModel.ts             State, Event, initial state, reduce(), readSjasmplusEnvironment()
  SjasmplusIntents.ts           Intent union
  SjasmplusViewModel.ts         ViewModel type + selectViewModel() + all format* helpers
  SjasmplusController.ts        Intent handling over ports
  SjasmplusPorts.ts             SjasmplusPorts interface (the seam the tests fake)
  SjasmplusIntegrationDialog.tsx   Container (ports + hook + Modal)
  SjasmplusIntegrationView.tsx     Pure view
  parts/
    StatusBlock.tsx  SourcePanelLocal.tsx  SourcePanelOnline.tsx
    ApplyBlock.tsx   Row.tsx  PathText.tsx
  SjasmplusIntegrationDialog.module.scss  (moved unchanged)

src/common/utils/path-compare.ts          ← NEW, extracted from the dialog
  normalizeSeparators / removeTrailingSeparators / getPathFolder / isSamePath

test/mvc/                                 ← NEW, generic test infrastructure
  ControllerHarness.ts    Drives any controller: dispatch, settle, read view model, event log
  deferred.ts             Manually-settled promises, for asserting busy/in-flight states
  UiStore.test.ts  LatestRun.test.ts  UiController.test.ts  useViewModel.test.tsx

test/dialogs/sjasmplus/                   ← NEW feature tests
  fakes.ts                       Fake SjasmplusPorts, env + release/asset fixture builders
  SjasmplusModel.test.ts         (node) reducer transitions
  SjasmplusViewModel.test.ts     (node) the presentation rules currently asserted via DOM
  SjasmplusController.test.ts    (node) emulated user journeys over fake ports
  SjasmplusIntegrationView.test.tsx   (jsdom) vm → markup, DOM event → intent
  SjasmplusIntegrationDialog.test.tsx (jsdom) container wiring smoke tests
```

Alias additions (**six** files must agree — four tsconfigs each carry their own copy of the path
map): `@mvc/*` → `src/renderer/mvc/*` in `tsconfig.json`, `test/tsconfig.json`,
`build/tsconfig.web.json`, `build/tsconfig.node.json`, plus
`build/electron.vite.config.ts` and `build/vitest.config.ts`.

> **`npm run build:check` does not type-check anything.** The root `tsconfig.json` is a
> solution-style config (`"files": []` plus project references), so plain `tsc` resolves no input
> files and exits 0 regardless. The configs that really cover `src/` are
> `build/tsconfig.web.json` and `build/tsconfig.node.json`, reachable with `tsc -b`. Fixing the
> script is out of scope for this plan — it would surface a backlog of pre-existing errors — but
> nothing here should be reported as "type-checked" on the strength of `build:check` alone.

**Naming caution.** `@state/redux-light` already exports `Store`, `Reducer`, `Dispatch` and
`Unsubscribe`. The MVC core deliberately prefixes its own (`UiStore`, `UiReducer`, `UiDispatch`)
so a file can import both without aliasing.

## 4. The ports (the testing seam)

```ts
// src/renderer/mvc/dialogs/DialogPorts.ts — reusable across dialogs
export type FilePickerPort = {
  pickFile(filters: FileFilter[], settingsKey: string): Promise<string | undefined>;
  pickFolder(settingsKey: string): Promise<string | undefined>;
};
export type ConfirmRequest = {
  title: string;
  lines: string[];
  code?: string;            // a path or value shown verbatim, monospaced
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean;
};
export type ConfirmPort = { confirm(request: ConfirmRequest): Promise<boolean> };
export type DialogClosePort<TResult> = { close(result: TResult): void };
```

```ts
// src/renderer/appIde/dialogs/sjasmplus/SjasmplusPorts.ts
export type SjasmplusPorts = {
  files: FilePickerPort;
  confirm: ConfirmPort;
  close: DialogClosePort<SjasmplusIntegrationDialogResult>;
  service: {
    probePath(path: string): Promise<SjasmplusProbeResult>;
    getPathSuggestions(): Promise<SjasmplusProbeResult[]>;
    listReleases(req: SjasmplusReleaseListRequest): Promise<SjasmplusReleaseListResult>;
    downloadRelease(req: SjasmplusReleaseDownloadRequest): Promise<SjasmplusReleaseDownloadResult>;
    validateExecutable(path: string): Promise<SjasmplusProbeResult>;
    apply(req: SjasmplusIntegrationApplyRequest): Promise<void>;
  };
};
```

The environment (`isWindows`, `isKliveProject`, the configured install read out of user/project
settings) is **not** a port. It is data: the container derives it with `useSelector` and pushes
it in as `{ type: "environmentChanged", env }`. Tests construct it as a literal, which removes
the `createMockStore()` + `saveUserSettingAction` ceremony from 12 of the current 28 tests.

`getSjasmplusStatus` / `readStatus` move to `SjasmplusModel.ts` as an exported pure function
`readSjasmplusEnvironment(userSettings, projectSettings, isWindows, isKliveProject)`, which the
container calls inside `useSelector` and the tests call directly when they want settings-shaped
input.

## 5. What the state machine looks like

```ts
type SjasmplusState = {
  env: SjasmplusEnvironment;              // isWindows, isKliveProject, configured
  setupMode: "local" | "online";
  scope: SjasmplusIntegrationScope;
  initialScope: SjasmplusIntegrationScope;
  candidate?: SjasmplusProbeResult;
  validation?: SjasmplusProbeResult;
  pathSuggestions: SjasmplusProbeResult[];
  releases: {
    list?: SjasmplusReleaseListResult;
    busy: boolean; error: string;
    includePrereleases: boolean;
    selectedTag: string; selectedAssetName: string;
  };
  downloadFolder: string;
  busy?: "probe" | "download" | "validate" | "apply";
  message: string;
  statusCheck: "none" | "checking" | "passed" | "failed";
  statusError: string;
};
```

Intents (the emulated-user vocabulary — one per thing a user can do):

`opened`, `environmentChanged`, `setupModeSelected`, `scopeSelected`,
`selectExecutableRequested`, `suggestionPicked`, `prereleasesToggled`, `releaseSelected`,
`assetSelected`, `refreshReleasesRequested`, `selectDownloadFolderRequested`,
`downloadRequested`, `testAgainRequested`, `applyRequested`, `closeRequested`.

Events (reducer vocabulary): `envReplaced`, `setupModeChanged`, `scopeChanged`,
`suggestionsLoaded`, `probeStarted/Settled`, `validationStarted/Settled`,
`downloadStarted/Settled`, `applyStarted/Settled`, `releaseListStarted/Settled/Failed`,
`releaseSelectionChanged`, `downloadFolderChanged`, `messageSet`.

`recordValidation` — the subtlest rule in the file (a verdict on the *configured* executable is
a verdict on the integration, matched by normalized path) — becomes a branch inside
`reduce(state, { type: "validationSettled", requestedPath, result })`. That is a three-line
pure test instead of the current "clears the failure when a re-test passes on a differently
spelled path" DOM test.

### View model

`selectViewModel(state)` returns exactly what the view paints:

```ts
type SjasmplusViewModel = {
  status: {
    kind: "none" | "configured";
    badge: "none" | "passed" | "failed";   // absorbs showsReplacement / showsRejection
    executablePath?: string; scopeLabel: string;
    headline: string;                       // "Configured" | "Not working"
    detail: { kind: "note" | "error" | "version"; text: string };
    title?: string;
  };
  source: { mode: SetupMode; canSwitch: boolean; local: {...}; online: {...} };
  apply: { candidatePath?: string; validationLabel: string; message: string; tone: "ok"|"fail"|"neutral" };
  buttons: { applyEnabled: boolean; testEnabled: boolean; busy: boolean };
  scopeChoice: { value: SjasmplusIntegrationScope; projectEnabled: boolean; note?: string };
};
```

All `format*` / `describeAsset*` / `getNextStepHint` helpers move here unchanged and become
directly unit-testable.

## 6. Test strategy overview

| Level | Project | Count (est.) | What it proves |
| --- | --- | --- | --- |
| `test/mvc/*.test.ts(x)` | node + jsdom | ~14 (**actual 39**) | the generic machinery itself |
| `SjasmplusModel.test.ts` | node | ~12 (**actual 35**) | reducer transitions, latest-wins, path-identity rule |
| `SjasmplusViewModel.test.ts` | node | ~10 (**actual 46**) | badge suppression, notes, enablement, labels |
| `SjasmplusController.test.ts` | node | ~12 (**actual 39**) | full user journeys over fake ports |
| `SjasmplusIntegrationView.test.tsx` | jsdom | ~6 (**actual 17**) | vm renders; clicks dispatch the right intents |
| `SjasmplusIntegrationDialog.test.tsx` | jsdom | ~4 | container wires Redux + MainApi + Modal + confirm |

Three rules that hold across all of them:

1. **A rule is tested at the lowest layer that owns it.** If a rule can be expressed as
   `reduce` or `selectViewModel` input/output, it must not also have a DOM test.
2. **Fixtures are builders with defaults**, never inline literals — `aState({ busy: "validate" })`,
   `aViewModel({ status: { badge: "failed" } })`, `anEnv({ isWindows: true })`. Deep-merged, so a
   test names only the field under test.
3. **No `vi.mock` of a module in the new tests.** Dependencies arrive through ports. The only
   surviving `vi.mock("@renderer/core/MainApi")` is in the container wiring test, where the
   module boundary *is* the thing under test.

## 7. Migration steps

Each step ends green; nothing is left half-migrated across a commit. For each step: the pattern
it introduces, and how that step is verified.

---

### Step 1 — Extract path comparison helpers — **DONE**

Landed: `src/common/utils/path-compare.ts`, `test/common/path-compare.test.ts` (25 cases), the
four local helpers deleted from `SjasmplusIntegrationDialog.tsx`. The legacy 28-test suite
passed unchanged.

**Pattern introduced:** nothing architectural — a pure module extraction that removes the first
piece of testable logic from the component.

```ts
// src/common/utils/path-compare.ts
export function normalizeSeparators(path: string): string;
export function removeTrailingSeparators(path: string): string;
export function getPathFolder(path: string): string;
// --- Two paths name the same executable when only their separators (or, on
// --- Windows, their casing) differ.
export function isSamePath(left: string | undefined, right: string | undefined, isWindows: boolean): boolean;
```

**Testing approach:** `test/common/path-compare.test.ts` (node), table-driven.

```ts
describe("isSamePath", () => {
  it.each([
    ["C:\\tools\\sjasmplus.exe", "C:/tools/sjasmplus.exe", true,  true],
    ["C:/Tools/SjasmPlus.exe",   "c:/tools/sjasmplus.exe", true,  true],
    ["/tools/sjasmplus",         "/Tools/SjasmPlus",       false, false],
    ["/tools/sjasmplus/",        "/tools/sjasmplus",       false, true],
    [undefined,                  "/tools/sjasmplus",       false, false]
  ])("%s vs %s (windows=%s) → %s", (left, right, isWindows, expected) => {
    expect(isSamePath(left, right, isWindows)).toBe(expected);
  });
});
```

This is the case-sensitivity rule that today is only reachable through the DOM test
"clears the failure when a re-test passes on a differently spelled path".

---

### Step 2 — Build `src/renderer/mvc/core` and `mvc/react` — **DONE**

Landed: `UiStore`, `UiController`, `LatestRun`, `messageOf`, `types.ts`, `useController`,
`useViewModel`, the `@mvc` alias in all four config files, and `test/mvc/` with 32 tests
(`deferred.ts` and `testController.ts` as shared fixtures). `ControllerHarness.ts` is deferred
to step 5, where it has a real controller to drive.

Two things the implementation added beyond the sketch below: `UiController.dispatch` also traps
a handler that throws *synchronously* (a view dispatches from a DOM event handler, where a
throw escapes into React rather than into the caller), and both `dispatch` and `emit` become
no-ops after `dispose()`, so a port result arriving after unmount cannot touch a dead tree.

**Pattern A — the observable store, with an event log for tests.**

```ts
// src/renderer/mvc/core/UiStore.ts
export class UiStore<TState, TEvent> {
  private state: TState;
  private readonly listeners = new Set<() => void>();
  private readonly log: TEvent[] = [];

  constructor(initial: TState, private readonly reduce: UiReducer<TState, TEvent>) {
    this.state = initial;
  }

  getSnapshot = (): TState => this.state;

  subscribe = (listener: () => void): Unsubscribe => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  dispatch = (event: TEvent): TState => {
    const next = this.reduce(this.state, event);
    this.log.push(event);
    // --- Reference equality is the signal. A reducer that returns the same
    // --- object notifies nobody, which is what keeps useSyncExternalStore quiet.
    if (next !== this.state) {
      this.state = next;
      for (const listener of [...this.listeners]) listener();
    }
    return next;
  };

  get events(): readonly TEvent[] { return this.log; }
}
```

The event log is a testing affordance, not production state: it lets a test assert *what
happened* (`["validationStarted", "validationSettled"]`) rather than only where things ended up.

**Pattern B — the generation guard that replaces three hand-rolled `cancelled` flags.**

```ts
// src/renderer/mvc/core/LatestRun.ts
export class LatestRun {
  private generation = 0;
  begin(): RunToken {
    const mine = ++this.generation;
    return { isCurrent: () => mine === this.generation };
  }
  cancelAll(): void { this.generation++; }
}
```

**Pattern C — the controller base, with an awaitable `settle()`.**

```ts
// src/renderer/mvc/core/UiController.ts
export abstract class UiController<TState, TIntent, TEvent, TViewModel> {
  protected readonly store: UiStore<TState, TEvent>;
  private readonly pending = new Set<Promise<unknown>>();
  private vmState?: TState;
  private vmCache?: TViewModel;

  constructor(initial: TState, reduce: UiReducer<TState, TEvent>,
              private readonly select: (state: TState) => TViewModel) {
    this.store = new UiStore(initial, reduce);
  }

  get state(): TState { return this.store.getSnapshot(); }

  // --- Memoized on state identity. useSyncExternalStore compares snapshots by
  // --- reference, so recomputing the view model per call would loop forever.
  get viewModel(): TViewModel {
    const state = this.state;
    if (this.vmState !== state) {
      this.vmState = state;
      this.vmCache = this.select(state);
    }
    return this.vmCache!;
  }

  subscribe = (listener: () => void) => this.store.subscribe(listener);

  dispatch(intent: TIntent): Promise<void> {
    const work = Promise.resolve(this.handle(intent)).catch((err) => this.onUnhandled(err));
    this.pending.add(work);
    void work.finally(() => this.pending.delete(work));
    return work;
  }

  // --- Drains transitively: an intent whose handler starts follow-up work is
  // --- fully awaited, so tests never sprinkle `await Promise.resolve()`.
  async settle(): Promise<void> {
    while (this.pending.size > 0) await Promise.all([...this.pending]);
  }

  protected emit(event: TEvent): void { this.store.dispatch(event); }
  protected abstract handle(intent: TIntent): void | Promise<void>;
  protected onUnhandled(err: unknown): void { /* overridable; default logs */ }
  dispose(): void { /* subclasses cancel their LatestRuns */ }
}
```

**Pattern D — the React binding, the *only* React in layers 1–2.**

```ts
// src/renderer/mvc/react/useController.ts
export function useController<T extends { dispose(): void }>(factory: () => T): T {
  const ref = useRef<T>();
  if (!ref.current) ref.current = factory();
  useEffect(() => () => ref.current?.dispose(), []);
  return ref.current;
}

// src/renderer/mvc/react/useViewModel.ts
export function useViewModel<TViewModel>(
  controller: { subscribe: (l: () => void) => Unsubscribe; viewModel: TViewModel }
): TViewModel {
  return useSyncExternalStore(controller.subscribe, () => controller.viewModel);
}
```

**Testing approach:** four files under `test/mvc/`. This machinery is small and load-bearing, so
it gets real tests rather than being trusted.

`UiStore.test.ts` (node):

```ts
it("notifies subscribers only when the reducer returns a new state", () => {
  const store = new UiStore({ n: 0 }, (s, e: { type: "inc" | "noop" }) =>
    e.type === "inc" ? { n: s.n + 1 } : s);
  const listener = vi.fn();
  store.subscribe(listener);

  store.dispatch({ type: "noop" });
  expect(listener).not.toHaveBeenCalled();

  store.dispatch({ type: "inc" });
  expect(listener).toHaveBeenCalledTimes(1);
  expect(store.getSnapshot()).toEqual({ n: 1 });
  // --- ...and the log records both, including the one that changed nothing
  expect(store.events).toHaveLength(2);
});

it("keeps unsubscribing safe during a notification", () => { /* listener that unsubscribes itself */ });
```

`LatestRun.test.ts` (node) — the out-of-order case the current code has never been tested for:

```ts
it("marks an earlier run stale once a later one begins", () => {
  const runs = new LatestRun();
  const first = runs.begin();
  const second = runs.begin();
  expect(first.isCurrent()).toBe(false);
  expect(second.isCurrent()).toBe(true);
});
```

`UiController.test.ts` (node) — using a 20-line counter controller as the subject:

```ts
it("settle() waits for work started by the handler", async () => {
  const c = new TestController();          // "loadRequested" → await gate → emit("loaded")
  const done = c.dispatch({ type: "loadRequested" });
  expect(c.state.busy).toBe(true);         // --- busy is observable before the port resolves
  gate.resolve("data");
  await done;
  expect(c.state.busy).toBe(false);
});

it("memoizes the view model on state identity", () => {
  const c = new TestController();
  expect(c.viewModel).toBe(c.viewModel);   // --- the useSyncExternalStore contract
});

it("routes a rejected handler to onUnhandled instead of an unhandled rejection", async () => { ... });
```

`useViewModel.test.tsx` (jsdom) — one test that the binding actually re-renders:

```ts
it("re-renders when the controller emits a state change", async () => {
  const controller = new TestController();
  const Probe = () => <span data-testid="n">{useViewModel(controller).label}</span>;
  render(<Probe />);
  await act(() => controller.dispatch({ type: "inc" }));
  expect(screen.getByTestId("n")).toHaveTextContent("1");
});
```

Also in this step: add `@mvc` to all three config files at once, and a throwaway import in the
core test to prove the alias resolves under vitest.

---

### Step 3 — Dialog ports and the `useDialogPorts` adapter — **DONE**

Landed: `DialogPorts.ts`, `ConfirmDialog.tsx` (+ its own `.module.scss`), `useDialogPorts.ts`
with `useFilePickerPort` / `useConfirmPort` / `useClosePort`, and `test/mvc/dialogPorts.test.tsx`
(7 tests).

Three deviations from the sketch below, all forced by the real dialog:

- `ConfirmRequest` needed `linesAfterCode`. The discard prompt puts text on *both* sides of the
  path ("This setup has not been applied yet:" / path / "Closing now leaves SJASMPLUS
  unchanged."), which a single `lines` array cannot express.
- `pickFile` / `pickFolder` normalize the main process's empty-string "cancelled" answer into
  `undefined`, so every controller stops repeating `if (selected)` against a falsy string.
- `useClosePort` was added: wrapping the `onClose` prop in a memoized port keeps the controller's
  dependency list uniform — everything it touches is a port.

**Pattern introduced — the adapter hook.** The port interfaces are declarations; this is the one
place that knows about `useMainApi()` and `useDialogs()`.

```ts
// src/renderer/mvc/dialogs/useDialogPorts.ts
export function useFilePickerPort(): FilePickerPort {
  const mainApi = useMainApi();
  return useMemo(() => ({
    pickFile: (filters, key) => mainApi.showOpenFileDialog(filters, key),
    pickFolder: (key) => mainApi.showOpenFolderDialog(key)
  }), [mainApi]);
}

export function useConfirmPort(): ConfirmPort {
  const dialogs = useDialogs();
  return useMemo(() => ({
    // --- Still goes through DialogProvider, per .docs/dialog-pattern.md; the
    // --- port only hides *which* service answers the question.
    confirm: async (request) =>
      (await dialogs.open<boolean, ConfirmRequest>(ConfirmDialogBody, request, {
        title: request.title, width: 460,
        dialogRole: "alertdialog", closeOnOutsideClick: false
      })) === true
  }), [dialogs]);
}
```

`ConfirmDialogBody` is the current `ConfirmDiscardDialog` markup generalized over
`ConfirmRequest` — so this step also turns a private dialog body into a reusable control.

**Testing approach:** `test/mvc/dialogPorts.test.tsx` (jsdom, ~3 tests). This layer is thin glue,
so it gets glue tests only — that the port opens a real dialog and maps its outcome:

```ts
it("resolves true when the user confirms and false when the user cancels", async () => {
  const Probe = () => {
    const confirm = useConfirmPort();
    return <button onClick={async () => setResult(await confirm.confirm(aConfirmRequest()))}>go</button>;
  };
  renderWithProviders(<Probe />);           // --- includes DialogProvider
  fireEvent.click(screen.getByText("go"));
  fireEvent.click(await screen.findByText("Discard"));
  await waitFor(() => expect(result).toBe(true));
});

it("resolves false when the dialog is dismissed without an answer", async () => { ... });
```

Note what is *not* tested here: no assertion on `mainApi.showOpenFileDialog` argument shapes
beyond one pass-through test — those are covered where they matter, in the controller.

---

### Step 4 — Extract the Model and the ViewModel — **DONE**

Landed: `SjasmplusModel.ts` (state, 21-case event union, `reduce`, `readSjasmplusEnvironment`),
`SjasmplusViewModel.ts` (view model, `selectViewModel`, every `format*` helper,
`discardConfirmRequest`), `test/dialogs/sjasmplus/fakes.ts`, and **81 node tests** (35 model +
46 view model) against an estimate of ~22. The shipped dialog is still untouched and green.

Five decisions worth recording, each one preserving a behavior that is easy to lose in a rewrite:

- **`ValidationOrigin`.** `validationStarted` / `validationSettled` carry
  `"configuredCheck" | "candidate"`. Both share the merge and the path-identity rule, but the
  configured re-check must not restate its failure in the message line — the status block is
  already showing it — so only the wording differs by origin.
- **`validationStarted` does not clear `validation`.** Only `probeStarted`, `suggestionPicked`,
  `downloadStarted` and `downloadFolderChanged` do. This is deliberate: clearing on every test
  would make a suppressed badge flash back on for the duration of a re-test.
- **`probeSettled` / `downloadSettled` keep `busy` at `"validate"`** when the result is usable,
  so the busy label never blinks back to idle between two synchronous emits.
- **`operationFailed`** covers a port rejection that produced no verdict (a probe that never
  ran). The configured check is the exception — there a rejection *is* a failed verdict, so the
  controller normalizes it into `validationSettled` instead.
- **Badge and tone collapsed into one field.** `statusNoteOf(state)` is computed once and drives
  both; the original's `showsReplacement` / `showsRejection` / `integrated` / `failed` were four
  flags encoding two states.

`SjasmplusIntents.ts` is deferred to step 5, where the controller gives it a consumer.

**Pattern A — the reducer as a total function over an event union.** Async results are events,
so failure and success take the same path in:

```ts
// SjasmplusModel.ts
export function reduce(state: SjasmplusState, event: SjasmplusEvent): SjasmplusState {
  switch (event.type) {
    case "validationStarted":
      return { ...state, busy: "validate", message: "", validation: undefined };

    case "validationSettled": {
      // --- A probe that cannot resolve the path (deleted folder) returns no path
      // --- of its own, so the requested one is carried over.
      const merged: SjasmplusProbeResult = {
        ok: false, ...event.result,
        executablePath: event.result.executablePath ?? event.requestedPath,
        installFolder: event.result.installFolder ?? getPathFolder(event.requestedPath)
      };
      const configured = isSamePath(merged.executablePath, state.env.configured.executablePath,
                                    state.env.isWindows);
      return {
        ...state, busy: undefined, validation: merged, candidate: merged,
        // --- A verdict on the configured executable is a verdict on the integration.
        statusCheck: configured ? (merged.ok ? "passed" : "failed") : state.statusCheck,
        statusError: configured && !merged.ok ? (merged.error ?? CONFIGURED_FAILED_MESSAGE) : "",
        message: merged.ok ? VALIDATION_PASSED_HINT : (merged.error ?? VALIDATION_FAILED_HINT)
      };
    }
    ...
  }
}
```

**Pattern B — the view model absorbs every conditional the JSX used to carry.** The three
interacting flags become one enum:

```ts
// SjasmplusViewModel.ts
function selectStatusBadge(state: SjasmplusState): "none" | "passed" | "failed" {
  const testedAnother = !!state.validation && !!state.candidate?.executablePath &&
    !isSamePath(state.candidate.executablePath, state.env.configured.executablePath, state.env.isWindows);
  // --- A working executable is one Apply away, so the old failure is no longer
  // --- what the user has to act on; and a success badge next to a contradicting
  // --- failure reads as a verdict on that failure.
  if (state.statusCheck === "failed" && testedAnother && state.validation!.ok) return "none";
  if (state.statusCheck === "passed" && testedAnother && !state.validation!.ok) return "none";
  return state.statusCheck === "passed" ? "passed"
       : state.statusCheck === "failed" ? "failed" : "none";
}
```

**Pattern C — fixture builders**, introduced here and reused by every later step:

```ts
// test/dialogs/sjasmplus/fakes.ts
export const anEnv = (over?: DeepPartial<SjasmplusEnvironment>) => deepMerge(DEFAULT_ENV, over);
export const aState = (over?: DeepPartial<SjasmplusState>) => deepMerge(initialState(anEnv()), over);
export const okProbe = (path: string, version?: string): SjasmplusProbeResult => ({ ... });
export const failProbe = (path: string, error: string): SjasmplusProbeResult => ({ ... });
```

**Testing approach:** two node files, written *before* the component is touched.

`SjasmplusModel.test.ts` — transitions, one assertion per rule:

```ts
it("carries the requested path into a verdict that resolved nothing", () => {
  const next = reduce(aState(), {
    type: "validationSettled",
    requestedPath: "/moved/away/sjasmplus",
    result: { ok: false, error: "Path does not exist: /moved/away/sjasmplus" }
  });
  expect(next.validation).toMatchObject({
    ok: false, executablePath: "/moved/away/sjasmplus", installFolder: "/moved/away"
  });
});

it("clears the configured failure when the same executable passes, spelled differently", () => {
  const state = aState({
    env: { isWindows: true, configured: { executablePath: "C:\\tools\\sjasmplus\\sjasmplus.exe" } },
    statusCheck: "failed", statusError: "SJASMPLUS exited with code 1"
  });
  const next = reduce(state, {
    type: "validationSettled",
    requestedPath: "C:/Tools/SjasmPlus/sjasmplus.exe",
    result: okProbe("C:/Tools/SjasmPlus/sjasmplus.exe", "v1.24.0")
  });
  expect(next.statusCheck).toBe("passed");
  expect(next.statusError).toBe("");
});

it("leaves the configured verdict alone when a different executable is tested", () => { ... });
```

Plus `readSjasmplusEnvironment` tests taking settings-shaped objects directly — these replace six
current DOM tests (project-over-user precedence, `.exe` suffix on Windows, explicit
`executablePath` beating `root`, the `SJASMP_*` key constants).

`SjasmplusViewModel.test.ts` — the presentation rules, as pure input/output:

```ts
it.each([
  // statusCheck   candidate vs configured   validation   → badge   note
  ["failed",  "other", { ok: true  }, "none",   REPLACEMENT_READY_MESSAGE],
  ["passed",  "other", { ok: false }, "none",   CANDIDATE_REJECTED_MESSAGE],
  ["passed",  "same",  { ok: true  }, "passed", ""],
  ["failed",  "same",  { ok: false }, "failed", ""]
])("statusCheck=%s tested=%s → badge %s", (statusCheck, tested, validation, badge, note) => {
  const vm = selectViewModel(aState({ statusCheck, ...withTested(tested, validation) }));
  expect(vm.status.badge).toBe(badge);
  expect(vm.status.detail.text).toContain(note);
});
```

The four-row table *is* current DOM tests 8, 11, 12 and 13 — four `render` + `waitFor` cycles
collapsed into one parameterized pure test.

---

### Step 5 — The controller — **DONE**

Landed: `SjasmplusIntents.ts`, `SjasmplusPorts.ts`, `SjasmplusController.ts`,
`test/mvc/ControllerHarness.ts`, the fake ports and openers in
`test/dialogs/sjasmplus/fakes.ts`, and **39 controller tests** — all in the `node` project, none
of them mounting React.

Three things the implementation changed:

- **`suggestionPicked` carries a path, not a probe result.** The view only ever holds strings, so
  the controller resolves the click against the suggestions it loaded — which also means only a
  listed suggestion can be picked.
- **`harnessFor(controller, extras)` takes its extras as an argument.** The first version returned
  a plain object and callers wrote `{ ...harnessFor(c), ports }`; spreading evaluates the `state`
  / `vm` / `events` **getters once** and freezes the snapshot at construction. Every configured
  test failed identically until this was found. The parameter exists so no caller is tempted to
  spread again.
- **One legacy quirk is now pinned by a test rather than silently reproduced.** When the
  configured executable changes while the dialog is open, the re-check records its verdict against
  the *candidate*, so it replaces an unapplied selection. The pre-MVC dialog does this too, so it
  is preserved and named — see "lets a newly configured executable take over the candidate".

**Pattern A — intent handler: a switch that calls ports and emits events.** Sync intents map
1:1 to an event; async intents own a `LatestRun`.

```ts
// SjasmplusController.ts
export class SjasmplusController
  extends UiController<SjasmplusState, SjasmplusIntent, SjasmplusEvent, SjasmplusViewModel> {

  private readonly validateRun = new LatestRun();
  private readonly releaseRun = new LatestRun();

  constructor(private readonly ports: SjasmplusPorts, env: SjasmplusEnvironment) {
    super(initialState(env), reduce, selectViewModel);
  }

  protected async handle(intent: SjasmplusIntent): Promise<void> {
    switch (intent.type) {
      case "opened":
        // --- Settings survive whatever happens to the disk, so the configured
        // --- executable is re-tested on every open.
        await Promise.all([this.loadSuggestions(), this.recheckConfigured()]);
        return;

      case "selectExecutableRequested": {
        const path = await this.ports.files.pickFile(EXECUTABLE_FILTERS, "sjasmplusExecutable");
        if (path) await this.probeAndValidate(path);
        return;
      }

      case "testAgainRequested":
        return this.validate(this.state.candidate?.executablePath);

      case "applyRequested":  return this.apply();
      case "closeRequested":  return this.requestClose();

      default:
        this.emit(syncEventFor(intent));   // --- setupModeSelected, scopeSelected, ...
    }
  }

  private async validate(path: string | undefined): Promise<void> {
    if (!path) return;
    const run = this.validateRun.begin();
    this.emit({ type: "validationStarted", requestedPath: path });
    const result = await this.ports.service.validateExecutable(path)
      .catch((err) => ({ ok: false, error: messageOf(err) }));
    if (!run.isCurrent()) return;          // --- a newer test already answered
    this.emit({ type: "validationSettled", requestedPath: path, result });
  }

  private async requestClose(): Promise<void> {
    if (!selectViewModel(this.state).hasPendingChanges) return this.ports.close.close("close");
    if (await this.ports.confirm.confirm(discardRequest(this.state.candidate?.executablePath))) {
      this.ports.close.close("close");
    }
  }
}
```

**Pattern B — the generic harness** (`test/mvc/ControllerHarness.ts`), the thing that makes
"emulate user interactions" a one-liner:

```ts
export type ControllerHarness<TState, TIntent, TEvent, TViewModel> = {
  readonly state: TState;
  readonly vm: TViewModel;
  readonly events: readonly TEvent[];
  dispatch(intent: TIntent): Promise<void>;   // dispatch + settle
  send(intent: TIntent): Promise<void>;       // dispatch WITHOUT settling, for busy assertions
  settle(): Promise<void>;
  dispose(): void;
};
```

**Pattern C — the feature opener**, so a test names only what it cares about:

```ts
// test/dialogs/sjasmplus/fakes.ts
export function openSjasmplusDialog(over?: {
  env?: DeepPartial<SjasmplusEnvironment>;
  service?: Partial<SjasmplusPorts["service"]>;
  pickFile?: string; pickFolder?: string; confirm?: boolean;
}): SjasmplusHarness;   // --- returns the harness plus `ports` (all vi.fn())
```

**Testing approach:** `SjasmplusController.test.ts` (node). The whole point of the exercise:

```ts
it("selects, validates, and applies an executable to user settings", async () => {
  const h = openSjasmplusDialog({
    pickFile: "/tools/sjasmplus/sjasmplus",
    service: {
      probePath: async () => okProbe("/tools/sjasmplus/sjasmplus"),
      validateExecutable: async () => okProbe("/tools/sjasmplus/sjasmplus", "sjasmplus v1.23.0")
    }
  });

  await h.dispatch({ type: "selectExecutableRequested" });
  expect(h.vm.apply.validationLabel).toBe("Passed");
  expect(h.vm.buttons.applyEnabled).toBe(true);

  await h.dispatch({ type: "applyRequested" });
  expect(h.ports.service.apply).toHaveBeenCalledWith({
    scope: "user", installFolder: "/tools/sjasmplus",
    executablePath: "/tools/sjasmplus/sjasmplus", version: "sjasmplus v1.23.0"
  });
  expect(h.ports.close.close).toHaveBeenCalledWith("close");
});
```

Three kinds of test this layer unlocks that the DOM suite could not express:

```ts
// --- 1. In-flight state, held open on a deferred port
it("disables Apply and says what it is doing while the smoke test runs", async () => {
  const gate = deferred<SjasmplusProbeResult>();
  const h = openSjasmplusDialog({ service: { validateExecutable: () => gate.promise } });
  await h.dispatch({ type: "suggestionPicked", suggestion: okProbe("/usr/local/bin/sjasmplus") });

  void h.send({ type: "testAgainRequested" });
  expect(h.vm.apply.validationLabel).toBe("Running smoke test...");
  expect(h.vm.buttons.applyEnabled).toBe(false);

  gate.resolve(okProbe("/usr/local/bin/sjasmplus"));
  await h.settle();
  expect(h.vm.apply.validationLabel).toBe("Passed");
});

// --- 2. Out-of-order resolution, untestable today
it("ignores a slow verdict that lands after a newer one", async () => {
  const slow = deferred<SjasmplusProbeResult>(), fast = deferred<SjasmplusProbeResult>();
  ...
  fast.resolve(okProbe("/b/sjasmplus"));  await h.settle();
  slow.resolve(failProbe("/a/sjasmplus", "boom")); await h.settle();
  expect(h.vm.apply.validationLabel).toBe("Passed");
});

// --- 3. The confirm branch, with no nested modal to render
it("closes without asking when nothing was changed", async () => {
  const h = openSjasmplusDialog();
  await h.dispatch({ type: "closeRequested" });
  expect(h.ports.confirm.confirm).not.toHaveBeenCalled();
  expect(h.ports.close.close).toHaveBeenCalledWith("close");
});

it("keeps the dialog open when the discard prompt is declined", async () => {
  const h = openSjasmplusDialog({ pickFile: "/tools/sjasmplus/sjasmplus", confirm: false, ... });
  await h.dispatch({ type: "selectExecutableRequested" });
  await h.dispatch({ type: "closeRequested" });
  expect(h.ports.close.close).not.toHaveBeenCalled();
});
```

Also here: the release/download journey (`prereleasesToggled` re-queries with
`{ includePrereleases: true }`; `downloadRequested` passes the suggested asset and destination;
`opened` on a non-Windows env never calls `listReleases`).

---

### Step 6 — Rewrite the view — **DONE** (and step 7 with it)

Landed: `SjasmplusIntegrationView.tsx`, five components under `parts/`, a ~110-line container,
the stylesheet moved (minus the confirm-dialog rules, which now live with the shared
`ConfirmDialog`), and 17 jsdom view tests.

**Step 7's gate passed on the first run**: all 28 legacy tests pass against the rewritten
component with a single line changed — the import path. Because there was no point keeping two
copies of the dialog alive, this step also took the parts of step 9 that go with it: the registry
import was repointed and the old `SjasmplusIntegrationDialog.tsx` deleted, with no re-export
shim. `npx electron-vite build` passes, which also closes step 2's open caveat that the `@mvc`
alias was unproven at build time.

Two implementation notes:

- **The container selects primitives, then memoizes the environment.** `useSelector` compares with
  a shallow equality check, so returning a freshly built `env` object would report a change on
  every render. The primitives are selected, `useMemo` builds the environment, and
  `reduce`'s `envReplaced` returns the *same state object* when nothing meaningful changed — three
  layers of defense against a render loop, because only the last one is visible in a test.
- **`OnlineViewModel` discriminates on a string, not a boolean.** This project compiles with
  `strictNullChecks: false`, under which TypeScript does **not** narrow a union on a
  boolean-literal discriminant (verified in isolation: `kind: "yes" | "no"` narrows, `available:
  true | false` does not). Any discriminated union added to this codebase must use a string tag.

The view tests render inside `renderWithProviders` rather than a bare `render`, because `Icon`
reads the theme. Nothing in them touches the store, a port or a promise.

**Pattern introduced — a view whose every branch reads a view-model field.** No business
conditionals, no `busy &&` chains built from raw state:

```tsx
// SjasmplusIntegrationView.tsx
type Props = { vm: SjasmplusViewModel; dispatch: (intent: SjasmplusIntent) => void };

export const SjasmplusIntegrationView = ({ vm, dispatch }: Props) => (
  <div className={styles.body}>
    <StatusBlock status={vm.status} />
    <div className={styles.divider} />
    <SourceChoice
      source={vm.source}
      onSelect={(mode) => dispatch({ type: "setupModeSelected", mode })}
    />
    <ScopeChoice
      choice={vm.scopeChoice}
      onSelect={(scope) => dispatch({ type: "scopeSelected", scope })}
    />
    ...
  </div>
);
```

and a container that is only wiring:

```tsx
export const SjasmplusIntegrationDialog = ({ onClose }: Props) => {
  const env = useSelector((s) => readSjasmplusEnvironment(s.userSettings, s.projectSettings,
                                                          s.isWindows ?? false,
                                                          s.project?.isKliveProject ?? false));
  const ports = useSjasmplusPorts(onClose);
  const controller = useController(() => new SjasmplusController(ports, env));
  const vm = useViewModel(controller);

  useEffect(() => { void controller.dispatch({ type: "opened" }); }, [controller]);
  useEffect(() => { void controller.dispatch({ type: "environmentChanged", env }); }, [controller, env]);

  return (
    <Modal title="SJASMPLUS Integration" width={640} isOpen
           primaryLabel="Apply" primaryEnabled={vm.buttons.applyEnabled}
           secondaryLabel="Test again" secondaryVisible secondaryEnabled={vm.buttons.testEnabled}
           cancelLabel="Close" closeOnOutsideClick={false} initialFocus="primary"
           onClose={() => void controller.dispatch({ type: "closeRequested" })}
           onCancelClicked={async () => { void controller.dispatch({ type: "closeRequested" }); return true; }}
           onSecondaryClicked={async () => { await controller.dispatch({ type: "testAgainRequested" }); return true; }}
           onPrimaryClicked={async () => { await controller.dispatch({ type: "applyRequested" }); return true; }}>
      <SjasmplusIntegrationView vm={vm} dispatch={(i) => void controller.dispatch(i)} />
    </Modal>
  );
};
```

Every existing `data-testid` is preserved verbatim in this step — that is what lets the legacy
suite act as the regression net in step 7.

**Testing approach:** `SjasmplusIntegrationView.test.tsx` (jsdom), ~6 tests, no ports, no store,
no `waitFor` — the view is synchronous:

```ts
const renderView = (vm?: DeepPartial<SjasmplusViewModel>) => {
  const dispatch = vi.fn();
  render(<SjasmplusIntegrationView vm={aViewModel(vm)} dispatch={dispatch} />);
  return dispatch;
};

it("renders the failed badge and its explanation from the view model", () => {
  renderView({ status: { badge: "failed", headline: "Not working",
                         detail: { kind: "error", text: "Path does not exist: /moved/away" } } });
  expect(screen.getByTestId("sjasmplus-broken-badge")).toBeInTheDocument();
  expect(screen.getByTestId("sjasmplus-status-error")).toHaveTextContent("Path does not exist");
});

it("dispatches selectExecutableRequested when the picker button is pressed", () => {
  const dispatch = renderView();
  fireEvent.click(screen.getByText("Select executable..."));
  expect(dispatch).toHaveBeenCalledWith({ type: "selectExecutableRequested" });
});

it("hides the PATH row when the view model offers no suggestions", () => {
  renderView({ source: { local: { suggestions: [] } } });
  expect(screen.queryByText("On PATH")).not.toBeInTheDocument();
});
```

Note the shape: **assert markup, or assert the dispatched intent — never both plus an outcome.**
The outcome of that intent is the controller test's business.

---

### Step 7 — Run the legacy suite unchanged (acceptance gate) — **DONE, passed first run**

Ran as part of step 6. 28/28 with only the import line changed.

**Pattern introduced:** none. This is the gate.

**Testing approach:** `test/controls/SjasmplusIntegrationDialog.test.tsx` runs untouched against
the new component, with its `vi.mock("@renderer/core/MainApi")` still in place — which works
precisely because the port adapter is built on `useMainApi()`. All 28 tests must pass with zero
edits. Any needed edit is a behavior change and must be justified in the commit message, not
absorbed silently.

```bash
npm test -- --project jsdom test/controls/SjasmplusIntegrationDialog.test.tsx
```

---

### Step 8 — Re-partition the legacy suite — **DONE**

`test/controls/SjasmplusIntegrationDialog.test.tsx` (809 lines, 28 jsdom tests) is deleted. Before
deleting it, every row of the table below was checked against its replacement, and the two rows
that were only *partly* covered got a test each: "keeps the success badge when the configured
executable is re-tested" (Controller) and a strengthened release/asset assertion on "queries GitHub
when the online source is chosen".

What replaced it, across five files:

| File | Project | Tests |
| --- | --- | --- |
| `SjasmplusModel.test.ts` | node | 35 |
| `SjasmplusViewModel.test.ts` | node | 46 |
| `SjasmplusController.test.ts` | node | 41 |
| `SjasmplusIntegrationView.test.tsx` | jsdom | 17 |
| `SjasmplusIntegrationDialog.test.tsx` | jsdom | 5 |

139 tests where there were 28, and the jsdom share dropped from 100% to 16%.

**Pattern introduced:** the migration bookkeeping — every deleted DOM test names its replacement.

| # | Legacy test | New home |
| --- | --- | --- |
| 1 | shows an empty configuration when no setting exists | ViewModel |
| 2 | shows the user-level install folder | Model (`readSjasmplusEnvironment`) |
| 3 | marks a working integration with the success badge | ViewModel |
| 4 | prefers the explicit executable path | Model |
| 5 | project settings effective when both scopes define it | Model |
| 6 | resolves the Windows executable name | Model |
| 7 | re-tests the configured executable on open | Controller |
| 8 | does not report a failed configured executable as working | Controller + ViewModel |
| 9 | clears the failure when a restored executable passes | Controller |
| 10 | clears the failure on a differently spelled path | `path-compare` + Model |
| 11 | drops the success badge while a tested executable fails | ViewModel (table row) |
| 12 | keeps the badge when the configured executable is re-tested | ViewModel (table row) |
| 13 | stops flagging the old setup once a replacement passes | ViewModel (table row) |
| 14 | uses the exported setting keys | Model |
| 15 | selects, validates, applies to user settings | Controller |
| 16 | hides the PATH row; shows the chosen path once | View |
| 17 | saves to project settings with a Klive project | Controller |
| 18 | closes without asking when nothing was set | Controller |
| 19 | asks for confirmation before dropping a selection | Controller (+ Dialog: Escape route) |
| 20 | does not ask when the setup is untouched | Controller |
| 21 | keeps project scope disabled without a project | ViewModel |
| 22 | shows PATH suggestions and validates the picked one | Controller |
| 23 | shows the suggested stable release and asset | Controller |
| 24 | instructions + repo link instead of downloads off Windows | View + Controller |
| 25 | lists only usable Windows assets | ViewModel |
| 26 | reloads releases when prereleases are enabled | Controller |
| 27 | limits the selector to the newest 20 releases | ViewModel |
| 28 | downloads, validates, then applies | Controller |

**Testing approach:** what survives in jsdom is a new, small
`test/dialogs/sjasmplus/SjasmplusIntegrationDialog.test.tsx` (~4 tests) covering only what the
container owns — the seams no lower layer can see:

```ts
it("reads the configured install out of Redux and re-tests it on open", async () => { ... });
it("routes Escape through the discard confirmation, not straight to onClose", async () => { ... });
it("calls onClose('close') when the controller closes the dialog", async () => { ... });
it("opens the real confirm dialog through DialogProvider", async () => { ... });
```

The old file is then deleted. Line count moves roughly 809 → ~330 across five files, and the
jsdom share of it drops from 100% to about a third.

---

### Step 9 — Swap the registry and delete the old files — **DONE**

The registry swap, the file deletion and the import-analysis build happened in step 6; the final
sweep ran after step 8. No stale references to the old paths remain in `src`, `test`, `docs` or
`.github`, and `npx electron-vite build` is clean.

**Pattern introduced:** none — the AGENTS.md move discipline (direct imports, no re-export shim).

`ideDialogRegistry.tsx` imports from `./sjasmplus/SjasmplusIntegrationDialog`; the old
`SjasmplusIntegrationDialog.tsx` and its `.module.scss` are deleted, not re-exported.

**Testing approach:** the import-analysis sweep AGENTS.md requires after moving files, since
neither `tsc` nor vitest catches a stale Vite-resolved import:

```bash
grep -rn "dialogs/SjasmplusIntegrationDialog" src test | grep -v "dialogs/sjasmplus/"
```

```bash
npx electron-vite build --config build/electron.vite.config.ts
```

---

### Step 10 — Write the pattern doc — **DONE**

`.docs/dialog-mvc-pattern.md`, cross-linked from `.docs/dialog-pattern.md`. It carries the
layering, the port convention, the harness API, the fixture-builder convention, the migration
recipe, when *not* to use the pattern — and a Gotchas section holding every trap this refactor
actually hit (string discriminants, the getter-spread, `getSnapshot` stability, the three-level
environment guard, the six alias files, and the broken `build:check`).

`.docs/dialog-mvc-pattern.md`: the layering, the port convention, the harness API, the fixture
builder convention, and — most importantly — **when not to use it**. Cross-link from
`.docs/dialog-pattern.md`, which stays the baseline for simple dialogs.

**Testing approach:** not testable; reviewed by applying it. The doc is only merged once a
second reader can follow it to migrate `ExportCodeDialog` without asking questions.

## 8. Verification commands

Per step, fast loop:

```bash
npm test -- --project node test/mvc test/dialogs/sjasmplus test/common/path-compare.test.ts
```

Per step, DOM loop:

```bash
npm test -- --project jsdom test/mvc test/dialogs/sjasmplus test/controls/SjasmplusIntegrationDialog.test.tsx
```

Before every commit:

```bash
npm run build:check && npm run lint:renderer -- --quiet
```

After step 9 only:

```bash
npx electron-vite build --config build/electron.vite.config.ts
```

## 9. Risks and mitigations

- **Over-abstraction.** Mitigated by building the generic layer *only* from what this dialog
  actually needs (store, controller base, latest-run guard, three ports) and deferring anything
  speculative until a second dialog asks for it.
- **Two vocabularies (Intent vs Event) feel like ceremony.** They pay for themselves in exactly
  the dialogs worth migrating — ones with async work and derived rules. Simple confirm dialogs
  should stay on the plain `.docs/dialog-pattern.md` shape; the new doc must say so explicitly.
- **Behavior drift during the rewrite.** Mitigated by step 7: the untouched legacy suite is the
  gate, and the `data-testid` set is frozen until it passes.
- **`useSyncExternalStore` infinite loop.** A `getSnapshot` that builds a fresh view model per
  call re-renders forever. The `viewModel` memo in `UiController` prevents it and
  `UiController.test.ts` asserts the identity contract directly.
- **Async ordering.** The current code hand-rolls `cancelled` flags in three effects.
  `LatestRun` centralizes it, and the out-of-order case gets an explicit controller test —
  today it has none.
- **Alias drift.** `@mvc` must be added to `tsconfig.json`, `build/electron.vite.config.ts` and
  `build/vitest.config.ts`; a missing one fails only at build or only at test time. Step 2 adds
  all three together and proves it with an aliased import in the core test.

## 10. Follow-up candidates (after the prototype lands)

`NewProjectDialog`, `ExportCodeDialog`, `ExcludedProjectItemsDialog`, `FirstStartDialog` — all
carry async work and validation rules. `DeleteDialog`, `RenameDialog`, `SetMemoryDialog` and
`AboutDialog` should stay as they are; they have no orchestration to isolate.


## 11. Outcome

| | Before | After |
| --- | --- | --- |
| Dialog implementation | 1 file, 1098 lines | 14 files, ~1400 lines (incl. 180 lines of reusable `mvc/` infrastructure) |
| Tests for it | 28, all jsdom, 809 lines | 139 across 5 files; 122 run headless in `node` |
| Time to run them | ~1.2s (jsdom) | ~0.2s (node) + ~0.8s (jsdom) |
| Testable without rendering | nothing | state transitions, display rules, every user journey |

New coverage the DOM suite could not express at all: in-flight busy states, out-of-order
resolution of concurrent smoke tests, port rejections (as distinct from failed verdicts), teardown
races, no-op state transitions, and the environment-change guard against a render loop.

One legacy quirk was found and pinned rather than silently reproduced: when the configured
executable changes while the dialog is open, the re-check records its verdict against the
*candidate* and so replaces an unapplied selection. See "lets a newly configured executable take
over the candidate" in the controller tests — worth revisiting now that the legacy suite is no
longer the gate.

## 12. Follow-ups

- **`npm run build:check` type-checks nothing** (see the note in §3). AGENTS.md presents it as the
  project's type gate, so this is worth fixing on its own; doing so surfaces a backlog of
  pre-existing errors that needs triage.
- Migrate the next dialog — `ExportCodeDialog` is the smallest of the four candidates in §10 and
  the best test of whether `.docs/dialog-mvc-pattern.md` is followable by someone who did not write
  it.


## 13. Post-landing fix: StrictMode

**Symptom.** A configured, working install opened the dialog stuck on "Running smoke test...",
with no badge and every control disabled.

**Cause.** `src/renderer/main.tsx` wraps the app in `React.StrictMode`, which in development runs
every effect as setup → cleanup → setup. `useController`'s cleanup called `controller.dispose()`,
and `dispose()` set a flag that nothing cleared, so:

1. render creates the controller (`statusCheck: "checking"`),
2. the effect dispatches `opened`, which emits `validationStarted` — busy, everything disabled,
3. StrictMode's cleanup disposes the controller,
4. the re-run effect's `opened` is dropped (`dispatch` returns early when disposed), and the
   in-flight verdict is dropped too (`emit` no-ops), so `busy` never clears.

**Fix.** `dispose()` and a new `activate()` are now a symmetric pair, and `useController` calls
`activate()` on effect setup — which is what React's contract actually asks for.

**Why no test caught it.** Neither `renderWithProviders` nor the legacy suite ever wrapped a tree in
`StrictMode`, so no test in this repository has ever exercised the double-effect cycle. Two
regression tests now do — `test/mvc/useViewModel.test.tsx` ("survives the mount / unmount / remount
cycle") and `test/dialogs/sjasmplus/SjasmplusIntegrationDialog.test.tsx` ("finishes the opening
smoke test in a development build"). Both were confirmed to fail against the broken `activate()`
before being kept.

Fixed alongside it: the container now reads `onClose` through a ref. The controller holds its ports
for its lifetime, and the dialog registry passes a fresh arrow on every render, so the captured one
would eventually go stale.
