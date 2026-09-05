import type { IValidationService } from "@renderer/core/ValidationService";
import type { UiReducer } from "@mvc/core/types";
import { requiredFilename, requiredPath } from "@renderer/appIde/dialogs/dialogValidators";

// ─── Vocabulary ──────────────────────────────────────────────────────────────

export type DiskTypeOption = { value: string; label: string };

// --- The disk geometries the main process knows how to write. Data, not a
// --- decision, so it lives with the model and the view merely renders it.
export const DISK_TYPES: DiskTypeOption[] = [
  { value: "ss", label: "Single-sided CPC (180K)" },
  { value: "ds", label: "Double-sided CPC (360K)" },
  { value: "sse", label: "Single-sided ECPC (180K)" },
  { value: "dse", label: "Double-sided ECPC (360K)" }
];

export const DEFAULT_DISK_TYPE = "ss";

// --- Where the folder picker remembers its last location.
export const NEW_DISK_FOLDER_SETTINGS_KEY = "newDiskFolder";

// ─── State ───────────────────────────────────────────────────────────────────

/**
 * Everything the dialog reads from outside itself.
 *
 * `validation` is a pair of pure predicates, not a service call: the view model
 * has to derive the field errors synchronously, so it cannot be a port. A test
 * hands in a literal.
 */
export type CreateDiskEnvironment = {
  validation: IValidationService;
};

export type CreateDiskState = {
  env: CreateDiskEnvironment;
  diskType: string;
  folder: string;
  filename: string;
  // --- True from the moment Create is pressed until the attempt settles. The
  // --- old component had no such flag, so a second click started a second
  // --- write of the same file.
  busy: boolean;
};

// ─── Events ──────────────────────────────────────────────────────────────────

export type CreateDiskEvent =
  | { type: "envReplaced"; env: CreateDiskEnvironment }
  | { type: "diskTypeChanged"; diskType: string }
  | { type: "folderChanged"; folder: string }
  | { type: "filenameChanged"; filename: string }
  | { type: "createStarted" }
  // --- Success and failure both land here: the difference is which port the
  // --- controller calls next, not what the state becomes.
  | { type: "createSettled" };

// ─── Initial state ───────────────────────────────────────────────────────────

export function initialState(env: CreateDiskEnvironment): CreateDiskState {
  return {
    env,
    diskType: DEFAULT_DISK_TYPE,
    folder: "",
    filename: "",
    busy: false
  };
}

// ─── Reducer ─────────────────────────────────────────────────────────────────

export const reduce: UiReducer<CreateDiskState, CreateDiskEvent> = (state, event) => {
  switch (event.type) {
    case "envReplaced":
      // --- The container rebuilds the environment on every settings write; only
      // --- a different rule set is worth waking a subscriber for.
      return event.env.validation === state.env.validation ? state : { ...state, env: event.env };

    case "diskTypeChanged":
      return event.diskType === state.diskType ? state : { ...state, diskType: event.diskType };

    case "folderChanged":
      return event.folder === state.folder ? state : { ...state, folder: event.folder };

    case "filenameChanged":
      return event.filename === state.filename ? state : { ...state, filename: event.filename };

    case "createStarted":
      return state.busy ? state : { ...state, busy: true };

    case "createSettled":
      return state.busy ? { ...state, busy: false } : state;

    default:
      return state;
  }
};

// ─── Derived rules ───────────────────────────────────────────────────────────

export function folderErrorOf(state: CreateDiskState): string | undefined {
  return requiredPath(state.env.validation, state.folder);
}

export function filenameErrorOf(state: CreateDiskState): string | undefined {
  return requiredFilename(state.env.validation, state.filename);
}

/**
 * Whether the form describes a disk that could be written.
 *
 * Deliberately ignores `busy`: "the input is complete" and "we are already
 * writing" are separate reasons to refuse, and the controller checks both.
 */
export function isComplete(state: CreateDiskState): boolean {
  return !folderErrorOf(state) && !filenameErrorOf(state);
}
