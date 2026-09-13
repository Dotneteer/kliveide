# UI MVC — Session Starter

Read this before adding or migrating a dialog (or any stateful UI part) to the MVC pattern.
Full reference: [`../.docs/dialog-mvc-pattern.md`](../.docs/dialog-mvc-pattern.md).
Reference implementation: `src/renderer/appIde/dialogs/sjasmplus/` + `test/dialogs/sjasmplus/`.

**Read the reference implementation before writing anything.** It is small, complete, and every
decision below is visible in it. `SjasmplusModel.ts` → `SjasmplusViewModel.ts` →
`SjasmplusController.ts` → `SjasmplusIntegrationView.tsx` → `SjasmplusIntegrationDialog.tsx`, then
the five test files, in that order.

## Why

The point is to test UI behavior **by emulating user interactions and data, without rendering**.
Layers 1–2 have no React and no DOM, so they run in the fast `node` vitest project (`*.test.ts`).

```ts
const h = await openSjasmplusDialog({ pickFile: "/tools/sjasmplus/sjasmplus" });
await h.dispatch({ type: "selectExecutableRequested" });
expect(h.vm.apply.validationLabel).toBe("Passed");
await h.dispatch({ type: "applyRequested" });
expect(h.ports.service.apply).toHaveBeenCalledWith({ scope: "user", … });
```

## The four pieces

| Piece | File | Contains |
| --- | --- | --- |
| **Model** | `<F>Model.ts` | `State`, `Event` union, pure `reduce()`, environment reader |
| **View model** | `<F>ViewModel.ts` | `selectViewModel()` + every `format*` helper |
| **Controller** | `<F>Controller.ts` | `Intent` handling, port calls, `LatestRun` guards |
| **View + container** | `<F>View.tsx`, `<F>Dialog.tsx` | dumb view; wiring-only container |

Shared infrastructure lives in `src/renderer/mvc/` (`UiStore`, `UiController`, `LatestRun`,
`useController`, `useViewModel`, and the `FilePickerPort` / `ConfirmPort` / `DialogClosePort`
adapters). Generic test helpers live in `test/mvc/` (`ControllerHarness`, `deferred`).

**Two vocabularies.** `Intent` = what the user did (`testAgainRequested`). `Event` = what changed
state (`validationSettled`). Async handlers emit `…Started`, await a port, emit `…Settled`. This is
what keeps `reduce` pure.

**Ports are the seam.** Everything outside — MainApi, file pickers, confirm dialogs, close — is an
injected interface the tests fake. Redux is *not* a port: the container derives an `Environment`
object and pushes it in as an intent.

## When to use it

Use it for a dialog with **async orchestration plus derived display rules**. Do not use it for a
dialog that asks one question (`DeleteDialog`, `RenameDialog`, `SetMemoryDialog`, `AboutDialog`) —
the Intent/Event split is pure ceremony there. The signal to migrate is a test that mounts React in
order to assert a *decision*.

## Migration recipe

Nothing touches the shipped component until step 4.

1. Extract pure helpers the component accumulated, with node tests.
2. Write Model + ViewModel, translating the rules the current DOM tests assert.
3. Write the Controller over its ports, plus fakes and journey tests.
4. Rewrite the view and container — **keep every `data-testid`**.
5. **Run the old test suite unchanged against the new component.** This is the acceptance gate;
   only the import path may change.
6. Re-partition the old suite; every deleted DOM test must name its replacement.
7. Repoint the registry, delete the old files (no re-export shim), run `electron-vite build`.

## Non-negotiables

- Test a rule at the **lowest layer that owns it**. If `reduce` or `selectViewModel` can express
  it, it must not also have a DOM test.
- Fixtures are **deep-merged builders**: `aState({ busy: "validate" })`. Derive the view-model
  builder from a real state so a new field cannot be missed.
- **No `vi.mock` below the container.** Dependencies arrive through ports.
- The view asserts markup **or** the dispatched intent — never the outcome.
- Return the **same state object** for a no-op transition; that is what stops needless re-renders.

## Five traps (each cost real time)

1. **`dispose()` must be reversible.** The app runs under `React.StrictMode`, which runs every
   effect setup → cleanup → setup. `useController` calls `activate()` on setup and `dispose()` on
   cleanup. Get this wrong and the dialog is *permanently frozen mid-operation* in dev builds, with
   every control disabled. **Test one dialog under `<StrictMode>`** — no provider tree in
   `test/react-test-utils.tsx` adds it, so nothing else catches this.
2. **Discriminated unions need a string tag.** This project compiles with `strictNullChecks: false`,
   under which TypeScript does **not** narrow on a boolean-literal discriminant. Use
   `kind: "available" | "unavailable"`, never `available: true | false`.
3. **Never spread the test harness.** `state`, `vm`, `events` are getters; `{ ...harnessFor(c) }`
   freezes them at construction. Pass extras to `harnessFor(controller, { ports })`.
4. **`getSnapshot` must be reference-stable** or `useSyncExternalStore` loops forever.
   `UiController` memoizes `viewModel` on state identity — keep it that way.
5. **A controller keeps the ports it was built with.** Read container props that feed ports (an
   `onClose` callback) through a ref, or the first render's closure is captured forever.

## Verification

```bash
npm test -- --project node test/mvc test/dialogs/<feature>
```

```bash
npm test -- --project jsdom test/mvc test/dialogs/<feature>
```

```bash
npm run lint:renderer -- --quiet
```

```bash
npx electron-vite build --config build/electron.vite.config.ts
```

⚠️ **`npm run build:check` type-checks nothing.** The root `tsconfig.json` is solution-style
(`"files": []` plus references), so plain `tsc` resolves no inputs and exits 0. Verify with
`npx tsc --noEmit --listFiles | grep -c "src/renderer"` → prints 0. Until it is fixed, type-check
against `build/tsconfig.web.json` explicitly, and never report "type-checked" on the strength of
`build:check`.

A new path alias must be added to **six** files: `tsconfig.json`, `test/tsconfig.json`,
`build/tsconfig.web.json`, `build/tsconfig.node.json`, `build/electron.vite.config.ts`,
`build/vitest.config.ts`.

## What it bought (SJASMPLUS dialog)

1098-line component with 28 jsdom tests → 14 files with **139 tests, 122 of them headless**.
New coverage the DOM suite could not express at all: in-flight busy states, out-of-order async
resolution, port rejections, teardown races, and render-loop guards.

Plan and history: `.plans/DIALOG_MVC_REFACTOR_PLAN.md`.
