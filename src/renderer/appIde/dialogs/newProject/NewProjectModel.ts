import type { MachineFavorite } from "@common/machines/machine-favorites";
import { machineRegistry } from "@common/machines/machine-registry";
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

export type MachineOption = { value: string; label: string; group?: string };

/** The families the type list is grouped into; the view model turns the id into its label */
export type MachineFamilyId = "zxSpectrum" | "spectrumCompatibles" | "otherZ80" | "other";

/**
 * A machine type and its models, as the dialog offers them: the type first, then (when it has more
 * than one) the model. Picking from 41 models in one list was the problem this replaced.
 */
export type MachineType = {
  machineId: string;
  label: string;
  family: MachineFamilyId;
  models: { modelId?: string; label: string }[];
};

/**
 * The families the type list is grouped into, in order. A machine not named here goes into "Other",
 * last, so a new registry entry still shows up.
 */
export const MACHINE_FAMILIES: readonly { id: MachineFamilyId; machineIds: readonly string[] }[] = [
  { id: "zxSpectrum", machineIds: ["sp48", "sp128", "spp3e", "zxnext"] },
  { id: "spectrumCompatibles", machineIds: ["timex", "scorpion"] },
  { id: "otherZ80", machineIds: ["zx81", "zx80", "z88", "ht1080z", "tvc", "ep"] }
];
export const OTHER_FAMILY: MachineFamilyId = "other";

function familyOf(machineId: string): MachineFamilyId {
  return MACHINE_FAMILIES.find((f) => f.machineIds.includes(machineId))?.id ?? OTHER_FAMILY;
}

// --- The machine registry is static data, so the type list is built once, in family order.
export const MACHINE_TYPES: MachineType[] = (() => {
  const types: MachineType[] = machineRegistry.map((machine) => ({
    machineId: machine.machineId,
    label: machine.displayName,
    family: familyOf(machine.machineId),
    models: machine.models?.length
      ? machine.models.map((m) => ({ modelId: m.modelId, label: m.displayName }))
      : [{ label: machine.displayName }]
  }));
  const order = [...MACHINE_FAMILIES.map((f) => f.id), OTHER_FAMILY];
  const rank = (t: MachineType) => {
    const family = MACHINE_FAMILIES.find((f) => f.id === t.family);
    return order.indexOf(t.family) * 100 + (family ? family.machineIds.indexOf(t.machineId) : 0);
  };
  return types.sort((a, b) => rank(a) - rank(b));
})();

export function machineTypeOf(machineId: string): MachineType | undefined {
  return MACHINE_TYPES.find((t) => t.machineId === machineId);
}

/** What the dialog knows about the machine it opens over: what runs, and the favourite models */
export type NewProjectContext = {
  running?: { machineId: string; modelId?: string };
  favorites: readonly MachineFavorite[];
};

// ─── State ───────────────────────────────────────────────────────────────────

export type NewProjectEnvironment = {
  validation: IValidationService;
};

export type NewProjectState = {
  env: NewProjectEnvironment;
  context: NewProjectContext;
  /**
   * The machine types that have project templates; undefined until known. A type with none cannot
   * make a project, so it is not offered.
   */
  availableMachineIds?: string[];
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
  | { type: "machineTypesSettled"; available: string[] }
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

const NO_CONTEXT: NewProjectContext = { favorites: [] };

/**
 * The model a machine type starts on: the running model when that machine runs, else the first of
 * the user's favourite models (the Machine type menu) of that type, else the type's first model.
 */
export function defaultModelOf(machineId: string, context: NewProjectContext): string | undefined {
  const type = machineTypeOf(machineId);
  if (!type) return undefined;
  const has = (modelId?: string) => type.models.some((m) => m.modelId === modelId);
  if (context.running?.machineId === machineId && has(context.running.modelId)) {
    return context.running.modelId;
  }
  const favorite = context.favorites.find((f) => f.machineId === machineId && has(f.modelId));
  if (favorite) return favorite.modelId;
  return type.models[0].modelId;
}

export function initialState(
  env: NewProjectEnvironment,
  context: NewProjectContext = NO_CONTEXT
): NewProjectState {
  // --- The dialog opens on the running machine; on the 48K when nothing (known) runs
  const machineId =
    context.running && machineTypeOf(context.running.machineId)
      ? context.running.machineId
      : INITIAL_MACHINE_ID;
  return {
    env,
    context,
    machineId,
    modelId: defaultModelOf(machineId, context) ?? INITIAL_MODEL_ID,
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

    case "machineTypesSettled": {
      const next = { ...state, availableMachineIds: event.available };
      // --- Opened over a machine with no templates (the C64): move to the first type that has some
      if (event.available.length === 0 || event.available.includes(state.machineId)) return next;
      const first = machineTypeOptionsOf(next)[0]?.value;
      return first ? { ...next, machineId: first, modelId: defaultModelOf(first, state.context) } : next;
    }

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

/**
 * The machine types on offer, grouped by family: those with templates, once that is known. `group`
 * is the family id (`MachineFamilyId`); the view model replaces it with the family's label.
 */
export function machineTypeOptionsOf(
  state: NewProjectState
): (MachineOption & { group: MachineFamilyId })[] {
  const available = state.availableMachineIds;
  return MACHINE_TYPES.filter((t) => !available || available.includes(t.machineId)).map((t) => ({
    value: t.machineId,
    label: t.label,
    group: t.family
  }));
}

/** The models of the selected type; a type with one model has one option (the field is disabled) */
export function modelOptionsOf(state: NewProjectState): MachineOption[] {
  return (machineTypeOf(state.machineId)?.models ?? []).map((m) => ({
    value: m.modelId ?? "",
    label: m.label
  }));
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

/**
 * Rejects if a step takes longer than its budget, with `timeoutMessage` (already formatted by the
 * caller, which owns the wording) as the error's message.
 *
 * The timer is always cleared, including on the winning path: an uncleared
 * 30-second timer keeps the process awake long after the dialog has gone.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}
