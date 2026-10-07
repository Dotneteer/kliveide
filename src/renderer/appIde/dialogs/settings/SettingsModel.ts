/*
 * The Settings dialog's state and its pure reducer (`.plans/MENU_REDESIGN_PLAN.md` §4).
 *
 * The values themselves are not here: they live in the app state (settings, theme, recording
 * preferences), which the container pushes in as the environment. The dialog's own state is only
 * the page, the search and the outcome of the last write.
 */
import type { AppState } from "@state/AppState";
import { SETTINGS_PAGES, type SettingsPageId, type SettingsPlatform } from "@common/settings/settings-pages";

export type SettingsEnvironment = {
  appState: AppState | undefined;
  platform: SettingsPlatform;
};

export type SettingsState = {
  page: SettingsPageId;
  query: string;
  env: SettingsEnvironment;
  /** The row a write is running for */
  busyRowId?: string;
  /** The last write's problem, shown under the page */
  error?: string;
};

export type SettingsEvent =
  | { type: "pageSelected"; page: SettingsPageId }
  | { type: "queryChanged"; query: string }
  | { type: "environmentChanged"; env: SettingsEnvironment }
  | { type: "writeStarted"; rowId: string }
  | { type: "writeSettled"; rowId: string; error?: string };

export function isSettingsPageId(page: unknown): page is SettingsPageId {
  return SETTINGS_PAGES.some((p) => p.id === page);
}

export function createInitialState(page: unknown, env: SettingsEnvironment): SettingsState {
  return { page: isSettingsPageId(page) ? page : SETTINGS_PAGES[0].id, query: "", env };
}

export function reduce(state: SettingsState, event: SettingsEvent): SettingsState {
  switch (event.type) {
    case "pageSelected":
      // --- Picking a page leaves the search: the page is what the user asked for
      return state.page === event.page && !state.query
        ? state
        : { ...state, page: event.page, query: "", error: undefined };
    case "queryChanged":
      return state.query === event.query ? state : { ...state, query: event.query };
    case "environmentChanged":
      return state.env === event.env ? state : { ...state, env: event.env };
    case "writeStarted":
      return { ...state, busyRowId: event.rowId, error: undefined };
    case "writeSettled":
      return {
        ...state,
        busyRowId: state.busyRowId === event.rowId ? undefined : state.busyRowId,
        error: event.error
      };
    default:
      return state;
  }
}
