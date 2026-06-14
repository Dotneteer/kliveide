import type { Action } from "./Action";
import type { IdePanelLayoutState, PanelInstance, PanelPlacement } from "./ide-panel-layout-state";

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

    case "MOVE_PANEL_INSTANCE":
      return movePanelInstance(
        state,
        payload?.id,
        payload?.text as PanelPlacement | undefined,
        payload?.nextId,
        (payload?.value as { groupId?: string } | undefined)?.groupId
      );

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

function movePanelInstance(
  state: IdePanelLayoutState,
  instanceId: string | undefined,
  placement: PanelPlacement | undefined,
  activityId?: string,
  groupId?: string
): IdePanelLayoutState {
  if (!instanceId || !placement || !state.instances[instanceId]) {
    return state;
  }

  const cleaned = removePanelInstanceFromPlacements(state, instanceId);
  const instance = cleaned.instances[instanceId];
  const order = getPlacementOrder(cleaned, placement, activityId, groupId);
  const movedInstance: PanelInstance = {
    ...instance,
    placement,
    activityId: placement === "primarySideBar" ? activityId : undefined,
    groupId: placement === "document" ? groupId : undefined,
    order
  };

  const nextState: IdePanelLayoutState = {
    ...cleaned,
    instances: {
      ...cleaned.instances,
      [instanceId]: movedInstance
    }
  };

  switch (placement) {
    case "primarySideBar": {
      const targetActivity = activityId ?? instance.activityId ?? "explorer";
      return {
        ...nextState,
        instances: {
          ...nextState.instances,
          [instanceId]: {
            ...movedInstance,
            activityId: targetActivity
          }
        },
        primarySideBarByActivity: {
          ...nextState.primarySideBarByActivity,
          [targetActivity]: [...(nextState.primarySideBarByActivity[targetActivity] ?? []), instanceId]
        }
      };
    }

    case "secondarySideBar":
      return {
        ...nextState,
        secondarySideBar: [...nextState.secondarySideBar, instanceId]
      };

    case "toolArea":
      return {
        ...nextState,
        toolArea: [...nextState.toolArea, instanceId]
      };

    case "document": {
      const targetGroupId = groupId ?? "group1";
      const group = nextState.documentGroups[targetGroupId] ?? { instanceIds: [] };
      return {
        ...nextState,
        instances: {
          ...nextState.instances,
          [instanceId]: {
            ...movedInstance,
            groupId: targetGroupId
          }
        },
        documentGroups: {
          ...nextState.documentGroups,
          [targetGroupId]: {
            ...group,
            activeInstanceId: instanceId,
            instanceIds: [...group.instanceIds, instanceId]
          }
        }
      };
    }
  }
}

function removePanelInstanceFromPlacements(
  state: IdePanelLayoutState,
  instanceId: string
): IdePanelLayoutState {
  const primarySideBarByActivity = Object.fromEntries(
    Object.entries(state.primarySideBarByActivity).map(([activityId, instanceIds]) => [
      activityId,
      instanceIds.filter((id) => id !== instanceId)
    ])
  );
  const documentGroups = Object.fromEntries(
    Object.entries(state.documentGroups).map(([groupId, group]) => [
      groupId,
      {
        ...group,
        activeInstanceId: group.activeInstanceId === instanceId ? undefined : group.activeInstanceId,
        instanceIds: group.instanceIds.filter((id) => id !== instanceId)
      }
    ])
  );

  return {
    ...state,
    primarySideBarByActivity,
    secondarySideBar: state.secondarySideBar.filter((id) => id !== instanceId),
    toolArea: state.toolArea.filter((id) => id !== instanceId),
    documentGroups
  };
}

function getPlacementOrder(
  state: IdePanelLayoutState,
  placement: PanelPlacement,
  activityId?: string,
  groupId?: string
): number {
  switch (placement) {
    case "primarySideBar":
      return (state.primarySideBarByActivity[activityId ?? "explorer"] ?? []).length;
    case "secondarySideBar":
      return state.secondarySideBar.length;
    case "toolArea":
      return state.toolArea.length;
    case "document":
      return state.documentGroups[groupId ?? "group1"]?.instanceIds.length ?? 0;
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
