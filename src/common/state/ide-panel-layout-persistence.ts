import { cloneDeep, get, set } from "lodash";
import type { AppState } from "./AppState";
import type { IdePanelLayoutState } from "./ide-panel-layout-state";

export const IDE_PANEL_LAYOUT_SETTING_PATH = "ideViewOptions.panelLayout";

export function selectPersistedIdePanelLayout(
  globalSettings: Record<string, unknown> | undefined,
  workspaceSettings: Record<string, unknown> | undefined,
  fallback: IdePanelLayoutState | undefined
): IdePanelLayoutState | undefined {
  const workspaceLayout = get(workspaceSettings, IDE_PANEL_LAYOUT_SETTING_PATH);
  if (isIdePanelLayoutState(workspaceLayout)) {
    return workspaceLayout;
  }

  const globalLayout = get(globalSettings, IDE_PANEL_LAYOUT_SETTING_PATH);
  return isIdePanelLayoutState(globalLayout) ? globalLayout : fallback;
}

export function persistIdePanelLayoutToSettings(
  state: AppState,
  layout: IdePanelLayoutState
): AppState {
  if (state.workspaceSettings !== undefined) {
    return {
      ...state,
      workspaceSettings: set(
        cloneDeep(state.workspaceSettings ?? {}),
        IDE_PANEL_LAYOUT_SETTING_PATH,
        layout
      )
    };
  }

  return {
    ...state,
    globalSettings: set(cloneDeep(state.globalSettings ?? {}), IDE_PANEL_LAYOUT_SETTING_PATH, layout)
  };
}

function isIdePanelLayoutState(value: unknown): value is IdePanelLayoutState {
  return (
    !!value &&
    typeof value === "object" &&
    "instances" in value &&
    "primarySideBarByActivity" in value &&
    "secondarySideBar" in value &&
    "toolArea" in value &&
    "documentGroups" in value
  );
}
