import type { UiReducer } from "@mvc/core/types";

import type { ExcludedItemInfo } from "../../utils/excluded-items-utils";

// ─── Vocabulary ──────────────────────────────────────────────────────────────

export const UNNAMED_PROJECT = "Unnamed";

export type { ExcludedItemInfo };

// ─── State ───────────────────────────────────────────────────────────────────

/**
 * What the dialog reads from Redux while it is open.
 *
 * Only the project's name: the excluded items themselves are a snapshot taken
 * when the dialog opens, because the user is editing them and a live feed would
 * fight the edit.
 */
export type ExcludedItemsEnvironment = {
  projectName: string;
};

export type ExcludedItemsState = {
  env: ExcludedItemsEnvironment;
  // --- The project's own list, as the user is editing it.
  projectItems: ExcludedItemInfo[];
  // --- The application-wide list, which is read-only here.
  globalItems: ExcludedItemInfo[];
  globalsLoading: boolean;
  busy: boolean;
};

// ─── Events ──────────────────────────────────────────────────────────────────

export type ExcludedItemsEvent =
  | { type: "envReplaced"; env: ExcludedItemsEnvironment }
  | { type: "globalsStarted" }
  | { type: "globalsSettled"; items: ExcludedItemInfo[] }
  // --- The old effect had no failure path: a rejected lookup escaped as an
  // --- unhandled rejection and left the list permanently empty.
  | { type: "globalsFailed" }
  | { type: "itemRemoved"; id: string }
  | { type: "applyStarted" }
  | { type: "applySettled" };

// ─── Initial state ───────────────────────────────────────────────────────────

export function initialState(
  env: ExcludedItemsEnvironment,
  projectItems: ExcludedItemInfo[] = []
): ExcludedItemsState {
  return {
    env,
    projectItems,
    globalItems: [],
    globalsLoading: false,
    busy: false
  };
}

// ─── Reducer ─────────────────────────────────────────────────────────────────

export const reduce: UiReducer<ExcludedItemsState, ExcludedItemsEvent> = (state, event) => {
  switch (event.type) {
    case "envReplaced":
      return event.env.projectName === state.env.projectName
        ? state
        : { ...state, env: event.env };

    case "globalsStarted":
      return state.globalsLoading ? state : { ...state, globalsLoading: true };

    case "globalsSettled":
      return { ...state, globalItems: event.items, globalsLoading: false };

    case "globalsFailed":
      return state.globalsLoading ? { ...state, globalsLoading: false } : state;

    case "itemRemoved": {
      const projectItems = state.projectItems.filter((item) => item.id !== event.id);
      // --- Removing something that is not there changes nothing.
      return projectItems.length === state.projectItems.length
        ? state
        : { ...state, projectItems };
    }

    case "applyStarted":
      return state.busy ? state : { ...state, busy: true };

    case "applySettled":
      return state.busy ? { ...state, busy: false } : state;

    default:
      return state;
  }
};

// ─── Derived rules ───────────────────────────────────────────────────────────

// --- What Apply writes back: the ids, in the order the list holds them.
export function excludedIdsOf(state: ExcludedItemsState): string[] {
  return state.projectItems.map((item) => item.id);
}

export function projectListLabelOf(state: ExcludedItemsState): string {
  return `${state.env.projectName} Excludes:`;
}
