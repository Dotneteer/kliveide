/*
 * The Select Machine dialog's state and its pure reducer (`.plans/MACHINE_SELECT_DIALOG_PLAN.md` §4).
 *
 * Model + ViewModel without a Controller: the dialog has rich derived rules but no async work and
 * no ports - main applies the result - so per `.ai/ui-mvc-guide.md` the Controller would be ceremony.
 * Every user action is an `Event` here, so the tests drive the dialog without rendering it.
 */
import type { MachineInfo } from "@common/machines/info-types";
import {
  DEFAULT_MACHINE_FAVORITES,
  MachineFavorite,
  favoriteKey,
  normalizeMachineFavorites,
  resolveMachineModel
} from "@common/machines/machine-favorites";
import type {
  MachineSelectDialogData,
  MachineSelectDialogResult
} from "@common/messaging/machine-select-dialog";

/** The accordion section holding the favourites */
export const FAVORITES_SECTION = "favorites";

export type MachineSelectState = {
  /** The favourites being edited, in menu order */
  favorites: MachineFavorite[];
  /** The favourites the dialog opened with */
  initialFavorites: MachineFavorite[];
  /** Key (`favoriteKey`) of the running model */
  runningKey?: string;
  /** Key of the model whose hardware sheet is shown */
  selectedKey?: string;
  /** IDs of the open accordion sections (machine IDs and `FAVORITES_SECTION`) */
  openSections: string[];
  filter: string;
};

export type MachineSelectEvent =
  | { type: "modelSelected"; key: string }
  | { type: "sectionToggled"; sectionId: string; open?: boolean }
  | { type: "filterChanged"; text: string }
  | { type: "favoriteToggled"; key: string }
  | { type: "favoriteMoved"; key: string; delta: number }
  | { type: "favoriteDropped"; key: string; beforeKey: string }
  | { type: "separatorToggled"; key: string }
  | { type: "favoriteRemoved"; key: string }
  | { type: "defaultsRestored" };

/**
 * The dialog's opening state: the running model selected and its section open, the favourites open.
 */
export function createInitialState(
  data: MachineSelectDialogData | undefined,
  registry: readonly MachineInfo[]
): MachineSelectState {
  const favorites = normalizeMachineFavorites(data?.favorites, registry);
  const running = data?.current
    ? resolveMachineModel(registry, data.current.machineId, runningModelId(registry, data.current))
    : undefined;
  const runningKey = running ? favoriteKey(running) : undefined;
  return {
    favorites,
    initialFavorites: favorites.map((f) => ({ ...f })),
    runningKey,
    selectedKey: runningKey,
    openSections: running ? [FAVORITES_SECTION, running.machineId] : [FAVORITES_SECTION],
    filter: ""
  };
}

/** A machine without models ignores whatever model ID the running state carries */
function runningModelId(
  registry: readonly MachineInfo[],
  current: { machineId: string; modelId?: string }
): string | undefined {
  const machine = registry.find((m) => m.machineId === current.machineId);
  return machine?.models?.length ? current.modelId : undefined;
}

/** Splits a model key back into its machine and model IDs */
export function parseKey(key: string): { machineId: string; modelId?: string } {
  const slash = key.indexOf("/");
  return slash < 0 ? { machineId: key } : { machineId: key.slice(0, slash), modelId: key.slice(slash + 1) };
}

/** The last favourite never carries a separator */
function tidy(favorites: MachineFavorite[]): MachineFavorite[] {
  if (!favorites.length) return favorites;
  const last = favorites[favorites.length - 1];
  if (!last.separatorAfter) return favorites;
  const { separatorAfter: _, ...rest } = last;
  return [...favorites.slice(0, -1), rest];
}

export function reduce(state: MachineSelectState, event: MachineSelectEvent): MachineSelectState {
  switch (event.type) {
    case "modelSelected":
      return { ...state, selectedKey: event.key };

    case "sectionToggled": {
      const isOpen = state.openSections.includes(event.sectionId);
      const open = event.open ?? !isOpen;
      if (open === isOpen) return state;
      return {
        ...state,
        openSections: open
          ? [...state.openSections, event.sectionId]
          : state.openSections.filter((s) => s !== event.sectionId)
      };
    }

    case "filterChanged":
      return { ...state, filter: event.text };

    case "favoriteToggled": {
      const index = state.favorites.findIndex((f) => favoriteKey(f) === event.key);
      if (index >= 0) {
        return { ...state, favorites: tidy(state.favorites.filter((_, i) => i !== index)) };
      }
      return { ...state, favorites: [...state.favorites, parseKey(event.key)] };
    }

    case "favoriteMoved": {
      const from = state.favorites.findIndex((f) => favoriteKey(f) === event.key);
      const to = from + event.delta;
      if (from < 0 || to < 0 || to >= state.favorites.length) return state;
      const favorites = [...state.favorites];
      const [item] = favorites.splice(from, 1);
      favorites.splice(to, 0, item);
      return { ...state, favorites: tidy(favorites) };
    }

    case "favoriteDropped": {
      if (event.key === event.beforeKey) return state;
      const from = state.favorites.findIndex((f) => favoriteKey(f) === event.key);
      if (from < 0) return state;
      const favorites = [...state.favorites];
      const [item] = favorites.splice(from, 1);
      const to = favorites.findIndex((f) => favoriteKey(f) === event.beforeKey);
      if (to < 0) return state;
      favorites.splice(to, 0, item);
      return { ...state, favorites: tidy(favorites) };
    }

    case "separatorToggled": {
      const index = state.favorites.findIndex((f) => favoriteKey(f) === event.key);
      if (index < 0 || index === state.favorites.length - 1) return state;
      const favorites = state.favorites.map((f, i) => {
        if (i !== index) return f;
        if (f.separatorAfter) {
          const { separatorAfter: _, ...rest } = f;
          return rest;
        }
        return { ...f, separatorAfter: true };
      });
      return { ...state, favorites };
    }

    case "favoriteRemoved":
      return {
        ...state,
        favorites: tidy(state.favorites.filter((f) => favoriteKey(f) !== event.key))
      };

    case "defaultsRestored":
      return { ...state, favorites: DEFAULT_MACHINE_FAVORITES.map((f) => ({ ...f })) };
  }
}

/** Whether the favourites differ from the ones the dialog opened with */
export function isDirty(state: MachineSelectState): boolean {
  return JSON.stringify(state.favorites) !== JSON.stringify(state.initialFavorites);
}

/** The result of Save */
export function saveResult(state: MachineSelectState): MachineSelectDialogResult {
  return { favorites: state.favorites.map((f) => ({ ...f })) };
}

/** The result of Switch: changed favourites (if any) and the selected model */
export function switchResult(state: MachineSelectState): MachineSelectDialogResult | undefined {
  if (!state.selectedKey || state.selectedKey === state.runningKey) return undefined;
  return {
    ...(isDirty(state) ? { favorites: state.favorites.map((f) => ({ ...f })) } : {}),
    switchTo: parseKey(state.selectedKey)
  };
}
