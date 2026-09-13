import { split } from "lodash";

import { getAllMachineModels } from "@common/machines/machine-registry";
import type { UiReducer } from "@mvc/core/types";
import type { IValidationService } from "@renderer/core/ValidationService";

import { optionalPath, requiredFilename } from "../dialogValidators";

// ─── Vocabulary ──────────────────────────────────────────────────────────────

export const INITIAL_MACHINE_ID = "sp48";
export const INITIAL_MODEL_ID = "pal";
export const INITIAL_TEMPLATE_ID = "default";

export const NEW_PROJECT_FOLDER_SETTINGS_KEY = "newProjectFolder";

// --- Every step of the creation sequence is given the same budget. The main
// --- process can wedge on any of them, and a dialog that never comes back is
// --- worse than one that reports a timeout.
export const PROJECT_CREATION_TIMEOUT_MS = 30_000;

export const CREATE_ERROR_TITLE = "New Klive Project Error";

export type MachineOption = { value: string; label: string };

// --- The machine registry is static data, so the option list is built once.
export const MACHINE_OPTIONS: MachineOption[] = getAllMachineModels().map((model) => ({
  value: machineOptionValue(model.machineId, model.modelId),
  label: model.displayName
}));

// --- Machine and model travel through the dropdown as one string, because a
// --- dropdown has one value.
export function machineOptionValue(machineId: string, modelId?: string): string {
  return `${machineId}${modelId ? `:${modelId}` : ""}`;
}

export function parseMachineOption(value: string): { machineId: string; modelId?: string } {
  const [machineId, modelId] = split(value, ":");
  return { machineId, modelId };
}

// ─── State ───────────────────────────────────────────────────────────────────

export type NewProjectEnvironment = {
  validation: IValidationService;
};

export type NewProjectState = {
  env: NewProjectEnvironment;
  machineId: string;
  modelId?: string;
  projectFolder: string;
  projectName: string;
  templates: string[];
  templateId: string;
  templatesLoading: boolean;
  busy: boolean;
};

// ─── Events ──────────────────────────────────────────────────────────────────

export type NewProjectEvent =
  | { type: "envReplaced"; env: NewProjectEnvironment }
  | { type: "machineChanged"; machineId: string; modelId?: string }
  | { type: "projectFolderChanged"; folder: string }
  | { type: "projectNameChanged"; name: string }
  | { type: "templateChanged"; templateId: string }
  | { type: "templatesStarted" }
  | { type: "templatesSettled"; templates: string[] }
  // --- The old effect had no failure path at all: a rejected lookup escaped as
  // --- an unhandled rejection and left the dropdown empty with no explanation.
  | { type: "templatesFailed" }
  | { type: "createStarted" }
  | { type: "createSettled" };

// ─── Initial state ───────────────────────────────────────────────────────────

export function initialState(env: NewProjectEnvironment): NewProjectState {
  return {
    env,
    machineId: INITIAL_MACHINE_ID,
    modelId: INITIAL_MODEL_ID,
    projectFolder: "",
    projectName: "",
    templates: [],
    templateId: INITIAL_TEMPLATE_ID,
    templatesLoading: false,
    busy: false
  };
}

// ─── Template selection ──────────────────────────────────────────────────────

/**
 * Which template to have selected once a machine's templates are known.
 *
 * Keeps the user's choice if the new machine also offers it, otherwise prefers
 * the conventional "default", otherwise takes whatever came first. A machine
 * with no templates at all keeps the name rather than clearing the field.
 */
export function resolveTemplateId(templates: string[], current: string): string {
  if (templates.includes(current)) return current;
  if (templates.includes(INITIAL_TEMPLATE_ID)) return INITIAL_TEMPLATE_ID;
  return templates[0] ?? INITIAL_TEMPLATE_ID;
}

// ─── Reducer ─────────────────────────────────────────────────────────────────

export const reduce: UiReducer<NewProjectState, NewProjectEvent> = (state, event) => {
  switch (event.type) {
    case "envReplaced":
      return event.env.validation === state.env.validation ? state : { ...state, env: event.env };

    case "machineChanged":
      return event.machineId === state.machineId && event.modelId === state.modelId
        ? state
        : { ...state, machineId: event.machineId, modelId: event.modelId };

    case "projectFolderChanged":
      return event.folder === state.projectFolder
        ? state
        : { ...state, projectFolder: event.folder };

    case "projectNameChanged":
      return event.name === state.projectName ? state : { ...state, projectName: event.name };

    case "templateChanged":
      return event.templateId === state.templateId
        ? state
        : { ...state, templateId: event.templateId };

    case "templatesStarted":
      return state.templatesLoading ? state : { ...state, templatesLoading: true };

    case "templatesSettled": {
      const templateId = resolveTemplateId(event.templates, state.templateId);
      return {
        ...state,
        templates: event.templates,
        templateId,
        templatesLoading: false
      };
    }

    case "templatesFailed":
      // --- The previous list is kept: a machine whose templates could not be
      // --- read is more usefully shown stale than empty.
      return state.templatesLoading ? { ...state, templatesLoading: false } : state;

    case "createStarted":
      return state.busy ? state : { ...state, busy: true };

    case "createSettled":
      return state.busy ? { ...state, busy: false } : state;

    default:
      return state;
  }
};

// ─── Derived rules ───────────────────────────────────────────────────────────

// --- The folder is used trimmed everywhere: for validation, for the request,
// --- and in the result handed back to the caller.
export function projectFolderPathOf(state: NewProjectState): string {
  return state.projectFolder.trim();
}

export function folderErrorOf(state: NewProjectState): string | undefined {
  return optionalPath(state.env.validation, projectFolderPathOf(state));
}

export function projectNameErrorOf(state: NewProjectState): string | undefined {
  return requiredFilename(state.env.validation, state.projectName);
}

export function isComplete(state: NewProjectState): boolean {
  return !folderErrorOf(state) && !projectNameErrorOf(state);
}

export function machineValueOf(state: NewProjectState): string {
  return machineOptionValue(state.machineId, state.modelId);
}

export type NewProjectRequest = {
  machineId: string;
  modelId?: string;
  templateId: string;
  projectName: string;
  projectFolder: string;
};

export function requestOf(state: NewProjectState): NewProjectRequest {
  return {
    machineId: state.machineId,
    modelId: state.modelId,
    templateId: state.templateId,
    projectName: state.projectName,
    projectFolder: projectFolderPathOf(state)
  };
}

// ─── Timeouts ────────────────────────────────────────────────────────────────

export function timeoutMessage(operation: string, timeoutMs: number): string {
  return `${operation} timed out after ${timeoutMs / 1000} seconds.`;
}

/**
 * Rejects if a step takes longer than its budget.
 *
 * The timer is always cleared, including on the winning path: an uncleared
 * 30-second timer keeps the process awake long after the dialog has gone.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation: string
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(timeoutMessage(operation, timeoutMs)));
    }, timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

export function openFolderErrorMessage(errorMessage: string): string {
  return `Error opening folder: ${errorMessage}`;
}
