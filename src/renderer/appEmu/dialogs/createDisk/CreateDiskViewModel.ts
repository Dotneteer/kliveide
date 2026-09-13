import {
  DISK_TYPES,
  filenameErrorOf,
  folderErrorOf,
  isComplete,
  type CreateDiskState,
  type DiskTypeOption
} from "./CreateDiskModel";

// ─── View model shape ────────────────────────────────────────────────────────

export type TextFieldViewModel = {
  value: string;
  error?: string;
};

export type CreateDiskViewModel = {
  diskType: {
    options: DiskTypeOption[];
    value: string;
  };
  folder: TextFieldViewModel;
  filename: TextFieldViewModel;
  submitLabel: string;
  submitEnabled: boolean;
  // --- Drives the form's "Working…" label and disables both footer buttons.
  submitting: boolean;
};

// ─── Selector ────────────────────────────────────────────────────────────────

/**
 * Everything the view renders, derived from state alone.
 *
 * Pure and reference-compared: `UiController` memoizes it on state identity, so
 * it must not build anything the caller could tell apart between two calls on
 * the same state.
 */
export function selectViewModel(state: CreateDiskState): CreateDiskViewModel {
  return {
    diskType: {
      options: DISK_TYPES,
      value: state.diskType
    },
    folder: {
      value: state.folder,
      error: folderErrorOf(state)
    },
    filename: {
      value: state.filename,
      error: filenameErrorOf(state)
    },
    submitLabel: "Create",
    // --- Two independent refusals: an incomplete form, and a write already in
    // --- flight. The form disables the button while submitting on its own, but
    // --- the view model states it so a headless test can assert it.
    submitEnabled: isComplete(state) && !state.busy,
    submitting: state.busy
  };
}
