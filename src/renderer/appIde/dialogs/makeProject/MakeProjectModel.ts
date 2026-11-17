import type { UiReducer } from "@mvc/core/types";
import type {
  ProjectConversionOptions,
  TemplateConflict
} from "@common/structs/project-conversion";

import {
  INITIAL_MACHINE_ID,
  INITIAL_MODEL_ID,
  INITIAL_TEMPLATE_ID,
  defaultModelOf,
  machineTypeOf,
  machineTypeOptionsOf,
  type NewProjectContext
} from "../newProject/NewProjectModel";

/**
 * The Make Klive Project dialog (`dev/plans/PLAIN_FOLDER_TO_PROJECT_PLAN.md` §3.3): keep the open
 * plain folder as it is, or make it a Klive project with a machine, a model, a template and a build
 * root. A template is required (decision Q7): its `build.ksx` is what Compile, Run and Debug run.
 */

// ─── Vocabulary ──────────────────────────────────────────────────────────────

/** No template selected yet: the machine's list is not known, or it is empty */
export const NO_TEMPLATE = "";

/** The template preselected for a folder with BASIC sources (decision Q5) */
export const BASIC_TEMPLATE_ID = "zx-basic";

/**
 * The build root list's first entry: the template's own build root. Not an empty string: Radix
 * `Select` (the `Dropdown`) refuses an item with an empty value. `<` and `>` cannot start a file
 * name on Windows.
 */
export const DEFAULT_BUILD_ROOT = "<default>";

/** The extensions that make a folder a BASIC folder, for the template preselection */
export const BASIC_EXTENSIONS = [".bas", ".zxbas"];

// --- Every step of the sequence gets this budget; a dialog that never comes back is worse than one
// --- that reports a timeout
export const MAKE_PROJECT_TIMEOUT_MS = 30_000;

/** What the user does with the folder; a string tag, not a boolean (MVC guide, trap 2) */
export type MakeProjectChoice = "make" | "keep";

// ─── State ───────────────────────────────────────────────────────────────────

export type MakeProjectState = {
  /** The open plain folder */
  folder: string;
  /** Opened by the offer after Open Folder, rather than by Make Klive Project... */
  offer: boolean;
  context: NewProjectContext;
  choice: MakeProjectChoice;
  /**
   * The machine types that have project templates; undefined until known. A type with none cannot
   * make a project (Q7), so it is not offered.
   */
  availableMachineIds?: string[];
  machineId: string;
  modelId?: string;
  templates: string[];
  /** A template folder's name, or `NO_TEMPLATE` until the machine's list is known */
  templateId: string;
  /** The user picked a template: the BASIC preselection no longer moves it */
  templateChosen: boolean;
  templatesLoading: boolean;
  /** The folder's files that can be a build root, relative, forward slashes; undefined until known */
  candidates?: string[];
  /** `DEFAULT_BUILD_ROOT` or one of the candidates */
  buildRoot: string;
  /** The template files that land on existing items */
  conflicts: TemplateConflict[];
  conflictsLoading: boolean;
  /** The conflicting files the user allows the template to replace */
  overwrite: string[];
  busy: boolean;
};

// ─── Events ──────────────────────────────────────────────────────────────────

export type MakeProjectEvent =
  | { type: "choiceChanged"; choice: MakeProjectChoice }
  | { type: "machineChanged"; machineId: string; modelId?: string }
  | { type: "machineTypesSettled"; available: string[] }
  | { type: "templateChanged"; templateId: string }
  | { type: "templatesStarted" }
  | { type: "templatesSettled"; templates: string[] }
  | { type: "templatesFailed" }
  | { type: "candidatesSettled"; candidates: string[] }
  | { type: "buildRootChanged"; buildRoot: string }
  | { type: "conflictsStarted" }
  | { type: "conflictsSettled"; conflicts: TemplateConflict[] }
  | { type: "conflictsFailed" }
  | { type: "overwriteChanged"; path: string; overwrite: boolean }
  | { type: "submitStarted" }
  | { type: "submitSettled" };

// ─── Initial state ───────────────────────────────────────────────────────────

const NO_CONTEXT: NewProjectContext = { favorites: [] };

export function initialState(
  folder: string,
  offer: boolean,
  context: NewProjectContext = NO_CONTEXT
): MakeProjectState {
  // --- The running machine, like New Project; the 48K when nothing (known) runs
  const machineId =
    context.running && machineTypeOf(context.running.machineId)
      ? context.running.machineId
      : INITIAL_MACHINE_ID;
  return {
    folder,
    offer,
    context,
    choice: "make",
    machineId,
    modelId: defaultModelOf(machineId, context) ?? INITIAL_MODEL_ID,
    templates: [],
    templateId: NO_TEMPLATE,
    templateChosen: false,
    templatesLoading: false,
    candidates: undefined,
    buildRoot: DEFAULT_BUILD_ROOT,
    conflicts: [],
    conflictsLoading: false,
    overwrite: [],
    busy: false
  };
}

// ─── Rules ───────────────────────────────────────────────────────────────────

/** Does the folder hold BASIC sources? */
export function hasBasicSources(candidates: readonly string[] | undefined): boolean {
  return (candidates ?? []).some((c) =>
    BASIC_EXTENSIONS.some((ext) => c.toLowerCase().endsWith(ext))
  );
}

/**
 * The template to have selected once a machine's templates (or the folder's files) are known. A
 * template the user picked stays while the machine offers it. Otherwise `zx-basic` for a folder
 * with BASIC sources when the machine has it (Q5), else the machine's `default`, else its first
 * template. There is no "no template" (Q7): `NO_TEMPLATE` only while the list is not known.
 */
export function resolveTemplateId(state: MakeProjectState, templates: string[]): string {
  if (state.templateChosen && templates.includes(state.templateId)) return state.templateId;
  if (hasBasicSources(state.candidates) && templates.includes(BASIC_TEMPLATE_ID)) {
    return BASIC_TEMPLATE_ID;
  }
  if (templates.includes(INITIAL_TEMPLATE_ID)) return INITIAL_TEMPLATE_ID;
  return templates[0] ?? NO_TEMPLATE;
}

/**
 * The folder's build-root candidates in the order offered: files in the folder's root first, then
 * the rest, each group by path. The first is the default build root: the folder's own program,
 * not the template's sample.
 */
export function sortCandidates(candidates: readonly string[]): string[] {
  const depth = (c: string) => (c.includes("/") ? 1 : 0);
  return [...candidates].sort((a, b) => depth(a) - depth(b) || a.localeCompare(b));
}

/** The conflicts the user may tick (a folder in the way is never replaced) */
export function overwritableConflictsOf(state: MakeProjectState): TemplateConflict[] {
  return state.conflicts.filter((c) => c.canOverwrite);
}

/** Everything the dialog has to know before OK means something */
export function isReady(state: MakeProjectState): boolean {
  if (state.busy) return false;
  if (state.choice === "keep") return true;
  return (
    !state.templatesLoading &&
    !state.conflictsLoading &&
    state.candidates !== undefined &&
    state.templates.includes(state.templateId)
  );
}

/** What the main process is asked to do */
export function requestOf(state: MakeProjectState): ProjectConversionOptions {
  const overwritable = new Set(overwritableConflictsOf(state).map((c) => c.path));
  return {
    folder: state.folder,
    machineId: state.machineId,
    modelId: state.modelId,
    templateId: state.templateId,
    overwrite: state.overwrite.filter((p) => overwritable.has(p)),
    buildRoot: state.buildRoot === DEFAULT_BUILD_ROOT ? undefined : state.buildRoot
  };
}

// ─── Reducer ─────────────────────────────────────────────────────────────────

export const reduce: UiReducer<MakeProjectState, MakeProjectEvent> = (state, event) => {
  switch (event.type) {
    case "choiceChanged":
      return event.choice === state.choice ? state : { ...state, choice: event.choice };

    case "machineChanged":
      return event.machineId === state.machineId && event.modelId === state.modelId
        ? state
        : { ...state, machineId: event.machineId, modelId: event.modelId };

    case "machineTypesSettled": {
      const next = { ...state, availableMachineIds: event.available };
      // --- Opened over a machine with no templates (the C64): move to the first type that has some
      if (event.available.length === 0 || event.available.includes(state.machineId)) return next;
      const first = machineTypeOptionsOf(next)[0]?.value;
      return first ? { ...next, machineId: first, modelId: defaultModelOf(first, state.context) } : next;
    }

    case "templateChanged":
      return event.templateId === state.templateId && state.templateChosen
        ? state
        : { ...state, templateId: event.templateId, templateChosen: true };

    case "templatesStarted":
      return state.templatesLoading ? state : { ...state, templatesLoading: true };

    case "templatesSettled":
      return {
        ...state,
        templates: event.templates,
        templateId: resolveTemplateId(state, event.templates),
        templatesLoading: false
      };

    case "templatesFailed":
      // --- No template list, no project: OK stays disabled (Q7)
      return { ...state, templates: [], templateId: NO_TEMPLATE, templatesLoading: false };

    case "candidatesSettled": {
      const candidates = sortCandidates(event.candidates);
      const next = { ...state, candidates };
      return {
        ...next,
        buildRoot: candidates[0] ?? DEFAULT_BUILD_ROOT,
        templateId: resolveTemplateId(next, state.templates)
      };
    }

    case "buildRootChanged":
      return event.buildRoot === state.buildRoot ? state : { ...state, buildRoot: event.buildRoot };

    case "conflictsStarted":
      return state.conflictsLoading ? state : { ...state, conflictsLoading: true };

    case "conflictsSettled": {
      // --- A ticked file stays ticked while it still conflicts
      const paths = new Set(event.conflicts.map((c) => c.path));
      return {
        ...state,
        conflicts: event.conflicts,
        overwrite: state.overwrite.filter((p) => paths.has(p)),
        conflictsLoading: false
      };
    }

    case "conflictsFailed":
      // --- Safe to go on: the template never replaces a file that is not ticked, so an unknown
      // --- list only means nothing can be ticked
      return { ...state, conflicts: [], overwrite: [], conflictsLoading: false };

    case "overwriteChanged": {
      const has = state.overwrite.includes(event.path);
      if (has === event.overwrite) return state;
      return {
        ...state,
        overwrite: event.overwrite
          ? [...state.overwrite, event.path]
          : state.overwrite.filter((p) => p !== event.path)
      };
    }

    case "submitStarted":
      return state.busy ? state : { ...state, busy: true };

    case "submitSettled":
      return state.busy ? { ...state, busy: false } : state;

    default:
      return state;
  }
};
