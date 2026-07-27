# Renderer Dialog Pattern

This document captures the expected pattern for modal dialogs in the React renderer processes. Use it when adding, migrating, or reviewing dialogs.

## Goals

- Open dialogs imperatively from renderer code with `useDialogs().open(...)`.
- Keep modal behavior centralized in `DialogProvider` and `Modal`: portal rendering, stacking, keyboard handling, focus management, cancellation, and cleanup.
- Return dialog outcomes through promises instead of routing transient dialog state through Redux.
- Preserve typed result values so callers can continue after the dialog resolves.

## Provider Setup

Renderer trees that can open dialogs must be wrapped in `DialogProvider`.

The main renderer root installs it in `src/renderer/main.tsx`. Tests that render components using `useDialogs()` must also include `DialogProvider`; otherwise `useDialogs()` intentionally throws.

```tsx
<DialogProvider>
  <App />
</DialogProvider>
```

## Opening Dialogs

Import the hook from the provider:

```ts
import { useDialogs } from "@renderer/controls/overlay/DialogProvider";
```

There is one imperative method: `dialogs.open(...)`. Do not add a second open method for special cases.

### Managed Dialog Body

Use the component form when the provider should create the `Modal` frame:

```tsx
type RenameResult = {
  name: string;
};

type RenameDialogBodyProps = DialogComponentProps<RenameResult> & {
  initialName: string;
};

function RenameDialogBody({ controls, initialName }: RenameDialogBodyProps) {
  return (
    <button onClick={() => controls.close({ name: initialName })}>
      Save
    </button>
  );
}

const result = await dialogs.open(
  RenameDialogBody,
  { initialName: "main.asm" },
  { title: "Rename file" }
);
```

This is the preferred shape for new dialogs. The provider owns the modal shell and passes `controls` to the body.

### Custom Renderer

Use the render-callback form when opening an existing full dialog component that already renders `Modal`, or when the dialog needs a specialized shell while still using the same imperative service:

```tsx
void dialogs.open<void>(
  (controls) => (
    <DeleteDialog
      entry="src/main.asm"
      isFolder={false}
      onDelete={async () => {
        await deleteFile();
        controls.close();
      }}
      onClose={() => controls.cancel()}
    />
  )
);
```

This form is named custom, not legacy. It is still opened through the same `open(...)` method and must settle through `controls`.

## Dialog Controls

Every dialog receives `DialogControls<TResult>`:

- `controls.close(result)` closes the dialog and resolves the returned promise.
- `controls.cancel()` closes the dialog and resolves the returned promise with `undefined`.
- `controls.reject(error)` closes the dialog and rejects the returned promise.
- `controls.id` is the provider-assigned or caller-provided dialog id. Current dialogs do not use it, but it is available for future cases that need to identify a specific open instance.

Prefer explicit result types for dialogs that return data:

```ts
const result = await dialogs.open<SetMemoryDialogResult>((controls) => (
  <SetMemoryDialog onSetMemory={(value) => controls.close(value)} />
));

if (!result) return;
```

## IDs And Stacking

Every opened dialog has an internal id. The id is used by `DialogProvider` to identify the queued dialog entry while it is open. It is passed back to the dialog through `controls.id`, and it is the key used by `dialogs.closeById(id, result)` when code outside the dialog needs to close a specific dialog.

The id is not rendered as user-facing text and it does not choose the dialog component. The caller chooses the component or render callback in `dialogs.open(...)`; the id only names that particular open instance.

In the current implementation, production dialogs do not need explicit ids. They close through their own `controls.close(...)` or `controls.cancel(...)`, and no production code currently calls `dialogs.closeById(...)` or reads `controls.id`. Let the provider generate ids by default.

Only pass a stable `id` when a future feature truly needs targeted external closing, stable diagnostics for stacked dialogs, or a test for id-specific behavior:

```tsx
void dialogs.open<void>(
  (controls) => (
    <DeleteDialog
      entry="src/main.asm"
      isFolder={false}
      onDelete={() => controls.close()}
      onClose={() => controls.cancel()}
    />
  ),
  { id: "future-targeted-dialog" }
);
```

If no id is provided, the provider creates one like `dialog-1`.

Use provider-level helpers only for cross-cutting shell actions:

- `dialogs.cancelTop()` cancels the topmost dialog.
- `dialogs.closeTop(result)` closes the topmost dialog with a result.
- `dialogs.closeById(id, result)` closes a specific dialog.

Most dialog components should call their own `controls` instead.

## Behavior Rules

- Do not store currently open dialog state in Redux.
- Do not render ad hoc dialog roots in feature components.
- Do not introduce `openLegacy` or another compatibility method.
- Do not bypass `Modal` for actual modal UI.
- Prefer project-relative paths in user-facing dialog text when the dialog is scoped to the project explorer.
- Keep long values in dialogs wrap-safe with `min-width: 0` and `overflow-wrap: anywhere`.
- Context menu actions that open dialogs should avoid `mousedown` activation that can leak browser text selection into the modal; activate actions on `click`.

## Testing

Add focused jsdom tests when adding or changing dialog behavior:

- Test `DialogProvider` when changing the dialog service, controls, stacking, or cleanup.
- Test feature-level open paths when a command/menu/keyboard action opens a dialog.
- Test the result path: confirm, cancel, and any meaningful validation state.
- Wrap test render trees in `DialogProvider` whenever code calls `useDialogs()`.

Useful commands:

```sh
npm test -- --project jsdom test/controls/DialogProvider.test.tsx
npm test -- --project jsdom test/controls/ExplorerPanelDialogs.test.tsx
npm run build:check
npm run lint:renderer -- --quiet
```
