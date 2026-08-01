# Dialog Form and Validation Simplification Plan

## Objective

Make renderer dialogs ordinary, predictable forms: one source of truth per field, validators that explain an invalid value, native form submission, and typed dialog results. The result should remove the current callback protocol and duplicated state while preserving the established `DialogProvider`/`Modal` behavior (portal, focus, stacking, dismissal, and accessibility).

This plan applies to user-input dialogs only. It does not redesign command-line validation, emulator-domain validation, or filesystem enforcement in the main process.

## Findings

### The same field has multiple sources of truth

`TextInput` initializes its own `inputValue` from `value` and does not synchronize later prop updates. Parents also store the value, and can return a boolean from `valueChanged` to decide whether `TextInput` may update its internal state. Folder-picker callbacks then update parent state and `TextInput` state independently.

Relevant code:

- `src/renderer/controls/TextInput.tsx`
- `src/renderer/appIde/dialogs/NewProjectDialog.tsx`
- `src/renderer/appEmu/dialogs/CreateDiskDialog.tsx`

### Validation state is duplicated and obscures intent

`NewProjectDialog`, `CreateDiskDialog`, and `ExportCodeDialog` retain `fieldIsValid` state and recalculate it in effects. `NewItemDialog` and `RenameDialog` use a second, separate filename regexp instead of the platform-aware `ValidationService`. Some fields treat empty text as valid because `isValidPath` defaults to `allowEmpty = true`; the required/optional policy is therefore implicit in each dialog.

`SetMemoryDialog` is more fragile: every change starts an asynchronous command, and an older command completion can overwrite validity for a newer value.

### Form submission is manually rebuilt in every dialog

The primary action callback returns `Promise<boolean>`, where `true` means “keep the dialog open.” Each input also contains a bespoke Enter-key handler that calls the same submit routine and then calls `onClose` itself. This duplicates submission paths and makes it easy to double-close, forget `preventDefault`, or let validation differ between clicking and pressing Enter.

### Dialog ownership remains mixed

`DialogProvider` already supports the preferred managed-dialog model, in which it owns `Modal` and a body receives `controls`. Several input dialogs still render `Modal` themselves and use `onClose`/side-effect callbacks. Consequently validation, saving, and closing are spread across the dialog body, opener, and modal action API.

### Existing coverage is incomplete

`CreateDiskDialog` and `SetMemoryDialog` have focused tests. The simpler filename dialogs and the project/export validation rules lack equivalent interaction coverage. `ValidationService` tests only cover one valid path per platform.

## Target Design

### 1. Keep modal infrastructure; remove form policy from `Modal`

`DialogProvider` and `Modal` remain the owners of opening, portal rendering, focus, Escape/outside-click policy, title, and dialog semantics. Do not add another form library or a global form store.

Deprecate the action-specific `Modal` API for new and migrated dialogs:

- `primaryLabel`, `primaryEnabled`, `primaryVisible`, `primaryDanger`
- secondary/cancel equivalents
- `onPrimaryClicked` / `onSecondaryClicked` / `onCancelClicked`

The confusing `Promise<boolean>` close convention disappears with it. Existing non-form dialogs may use it temporarily during migration, but no new usage should be added.

### 2. Add a small `DialogForm` frame

Create a shared presentational component, for example `src/renderer/controls/DialogForm.tsx`, rendered inside a managed dialog body. It should contain a real `<form>` and a consistently styled footer.

Its intentionally small API should be approximately:

```tsx
type DialogFormProps = {
  children: ReactNode;
  submitLabel: string;
  submitDisabled?: boolean;
  submitDanger?: boolean;
  cancelLabel?: string;
  submitting?: boolean;
  onSubmit: () => void | Promise<void>;
  onCancel: () => void;
};
```

The form owns `onSubmit`, prevents browser navigation, disables its actions while `submitting`, and renders cancel/submit controls. Pressing Enter in a text input uses that same path automatically. Inputs or controls that genuinely need Enter for another operation can opt out locally.

Do not make `DialogForm` a validation engine. It is only the shared form/frame and action lifecycle.

### 3. Make `TextInput` controlled and accessible

Replace the current callback protocol with normal controlled-input props:

```tsx
type TextInputProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
  autoFocus?: boolean;
  browse?: () => Promise<string | undefined>;
  // retain width, maxLength, numberOnly, and the optional icon/title
};
```

- Remove private `inputValue`, `valueChanged`, the boolean return value, `focusOnInit`, and `buttonClicked(value)`.
- Use the supplied value directly, so programmatic picker updates and reset/default values always render correctly.
- Render `aria-invalid` only when an error exists and connect it to the error text through `aria-describedby`.
- Keep numeric-input filtering only as a convenience. Validators remain authoritative.
- The browse callback returns a selected value; the parent changes state exactly once.

### 4. Standardize field presentation and validation output

Add a small `DialogField` component beside `DialogForm` (or evolve `DialogRow` in place if the API remains equally clear). It accepts `label`, `htmlFor`, `required`, `error`, optional help text, and children.

It renders a real label, concise inline error text, and accessible relationships. It replaces hard-coded `*` suffixes, inline warning styles, and the current generic `DialogRow` use for input fields. Keep `DialogRow` only where it describes non-field layout, or remove it after all consumers migrate.

Use a common validator signature:

```ts
type FieldValidator = (value: string) => string | undefined;
```

`undefined` means valid; an error string gives the user a specific next action. The dialog computes synchronous errors directly during render from its current state—no effect and no duplicated `isValid` state.

### 5. Consolidate dialog validation rules without over-generalizing

Create a small, pure module such as `src/renderer/dialogs/dialogValidators.ts`:

- `requiredFilename(validationService, value)`
- `optionalPath(validationService, value)` / `requiredPath(validationService, value)`
- `newItemName(existingNames, value)`
- `renamedItemName(oldName, value)`
- `decimalAddress(value)`

It should translate the existing platform-aware `ValidationService` decisions into stable, user-facing error messages. Remove the filename regexes in `NewItemDialog` and `RenameDialog` so every filesystem name follows one rule set.

Keep validators pure and local. Do not introduce a schema package, form context, reducer framework, or general async-validation hook.

For the memory expression field, perform the authoritative asynchronous command validation once on submit. Store only a submit error string if it fails. If live feedback proves important, add a request-sequence guard in that dialog alone; do not add a generic abstraction for a single asynchronous field.

### 6. Use typed data in, typed results out

Migrate input dialogs to `DialogProvider`'s managed component form. Dialog bodies receive `controls`, close with a typed value on successful submit, and cancel through `controls.cancel()`.

Openers await the result and perform domain side effects once. This separates collecting valid input from creating a project, writing memory, deleting a file, or persisting export settings.

Target results:

| Dialog | Result |
| --- | --- |
| New item | `{ name: string }` (folder/file remains opener context) |
| Rename | `{ name: string }` |
| Delete | `true` |
| Set memory | existing `SetMemoryDialogResult` |
| Create disk | existing `CreateDiskDialogResult` without `path`; caller adds the created path after success |
| New project | existing `NewProjectDialogResult` |
| Export code | a settings/result object; command execution and persistence move to the opener/service |

`ExcludedProjectItemsDialog` may use the same form frame but does not need field validation. `FirstStartDialog` and simple Z88 confirmation dialogs can migrate later as small action-only bodies.

## Implementation Slices

## Progress

- [Completed] Slice 0 — validation edge-case coverage and filename-dialog interaction coverage.
- [Completed] Slice 1 — controlled `TextInput`, `DialogForm`/`DialogField` primitives, and migration of all six `TextInput` consumers. `DialogField` is available for the validator migration in slice 2.
- [Completed] Slice 2 — pure dialog validators and managed, typed explorer add/rename/delete dialogs.
- [Completed] Slice 3 — render-derived project/disk validation and shared form submission. Project/disk creation side effects remain in their dynamic dialog registry hosts; moving that boundary requires a separate registry/API migration.

### Slice 0 — Establish behavioral tests and validation semantics

1. Expand `ValidationService` tests for empty required/optional values, invalid filename characters, reserved Windows names, path segment length, and the macOS colon/hidden-name rules.
2. Add focused tests for `NewItemDialog`, `RenameDialog`, `NewProjectDialog`, and `ExportCodeDialog` before structural changes.
3. Write down the required/optional policy for each existing field in test names. In particular, decide whether project and disk folders may intentionally be empty; do not preserve that behavior accidentally.

### Slice 1 — Controlled input and field primitives

1. Add `DialogForm` and `DialogField`, with tests for label association, help/error text, action disabling, cancel, and native Enter submission.
2. Refactor `TextInput` to the controlled API and test externally changed values, browse-result updates, invalid ARIA state, and focus behavior.
3. Migrate the six current `TextInput` consumers together: New Item, Rename, Set Memory, New Project, Export Code, and Create Disk.
4. Delete `valueChanged`, `keyPressed`, `focusOnInit`, and the private `TextInput` value state after the last consumer moves.

### Slice 2 — Pure synchronous validators and small explorer forms

1. Add `dialogValidators.ts` with unit tests.
2. Migrate New Item and Rename to render-derived errors and managed dialog results.
3. Change `ExplorerPanel` to await their results and call add/rename services once.
4. Migrate Delete to the same managed-result pattern, setting `closeOnOutsideClick: false` for the destructive confirmation.

### Slice 3 — Project and disk creation forms

1. Migrate New Project and Create Disk from effect-held validity booleans to render-derived validator errors.
2. Keep the template/dropdown loading in the form body, but make creation happen after the caller receives a valid result.
3. Represent submit failures as an inline form-level error where retrying is useful; retain native message boxes only for outcomes that need application-wide acknowledgement.
4. Remove duplicated Enter handlers and local `onClose` plumbing.

### Slice 4 — Memory and export forms

1. Migrate Set Memory to `DialogForm`; validate the expression on submit and display the returned error under the field without closing.
2. Extract Export Code's settings serialization and command construction into pure helpers with unit tests.
3. Render export errors from pure validators, then let the opener/service persist settings and execute the export once the form resolves.
4. Preserve current export command text and persistence timing until explicit behavior tests establish an intended replacement.

### Slice 5 — Finish migration and remove legacy paths

1. Migrate Excluded Items, First Start, and Z88 dialogs where the shared form/action frame reduces code; do not force a field abstraction into non-form content.
2. Remove deprecated action props and boolean-close handling from `Modal` after no callers remain.
3. Delete `DialogRow` if it has no meaningful non-field use; otherwise rename/document it as a layout primitive only.
4. Update `.docs/dialog-pattern.md` with the managed dialog, `DialogForm`, `DialogField`, validator, and result conventions.

## Verification

For every migrated dialog, test:

- initial values and externally changed/picker values;
- displayed error and disabled-submit behavior for synchronous invalid input;
- Enter and click invoking the same submit operation exactly once;
- asynchronous submit failures remaining open with an error;
- cancel/outside-click policy and typed result;
- no domain action before a valid form result is submitted.

Run focused tests per slice, then:

```sh
npm test -- --project jsdom test/controls
npm run lint:renderer
npm run build:check
```

## Completion Criteria

- No renderer input dialog uses `TextInput.valueChanged`, a duplicate `fieldIsValid` effect, or an input-local Enter submit handler.
- No new dialog uses `Modal.onPrimaryClicked` or the boolean “keep open” convention.
- Filesystem validation is shared across filename dialogs and shows actionable field errors.
- Each migrated dialog has one submit path, one owner of its form state, and a typed result boundary before its domain side effect.
- Existing modal accessibility, portal, stacking, and dismissal guarantees remain covered by the current modal/provider tests.
