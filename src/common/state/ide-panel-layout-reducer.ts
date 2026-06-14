import type { Action } from "./Action";
import type { IdePanelLayoutState, PanelInstance } from "./ide-panel-layout-state";

export function idePanelLayoutReducer(
  state: IdePanelLayoutState,
  { type, payload }: Action
): IdePanelLayoutState {
  switch (type) {
    case "INIT_IDE_PANEL_LAYOUT":
      return payload?.value ?? state;

    case "SET_PANEL_EXPANDED":
      return updatePanelInstance(state, payload?.id, (instance) => ({
        ...instance,
        expanded: payload?.flag
      }));

    case "SET_PANEL_SIZE":
      return updatePanelInstance(state, payload?.id, (instance) => ({
        ...instance,
        size: payload?.numValue
      }));

    case "PATCH_PANEL_VIEW_STATE": {
      const instanceId = payload?.id;
      if (!instanceId) {
        return state;
      }
      return {
        ...state,
        viewStateByInstance: {
          ...state.viewStateByInstance,
          [instanceId]: {
            ...(state.viewStateByInstance[instanceId] ?? {}),
            ...(payload?.value ?? {})
          }
        }
      };
    }

    case "SET_PANEL_INSTANCE_STATE": {
      const instanceId = payload?.id;
      const key = payload?.text;
      if (!instanceId || !key) {
        return state;
      }
      return {
        ...state,
        viewStateByInstance: {
          ...state.viewStateByInstance,
          [instanceId]: {
            ...(state.viewStateByInstance[instanceId] ?? {}),
            [key]: payload?.value
          }
        }
      };
    }

    case "SET_PANEL_CONTRIBUTION_STATE": {
      const contributionId = payload?.id;
      const key = payload?.text;
      if (!contributionId || !key) {
        return state;
      }
      return {
        ...state,
        contributionState: {
          ...state.contributionState,
          [contributionId]: {
            ...(state.contributionState[contributionId] ?? {}),
            [key]: payload?.value
          }
        }
      };
    }

    default:
      return state;
  }
}

function updatePanelInstance(
  state: IdePanelLayoutState,
  instanceId: string | undefined,
  update: (instance: PanelInstance) => PanelInstance
): IdePanelLayoutState {
  if (!instanceId || !state.instances[instanceId]) {
    return state;
  }

  return {
    ...state,
    instances: {
      ...state.instances,
      [instanceId]: update(state.instances[instanceId])
    }
  };
}
