import type { Action } from "./Action";
import {
  canPlacePanelContribution,
  getIdePanelContribution
} from "./ide-panel-contributions";
import {
  createDefaultIdePanelLayoutState,
  normalizeIdePanelLayoutState,
  type EditorGroupState,
  type EditorLayoutAxis,
  type EditorLayoutNode,
  type IdePanelLayoutState,
  type PanelInstance,
  type PanelPlacement
} from "./ide-panel-layout-state";

export function idePanelLayoutReducer(
  state: IdePanelLayoutState,
  { type, payload }: Action
): IdePanelLayoutState {
  switch (type) {
    case "INIT_IDE_PANEL_LAYOUT":
      return normalizeIdePanelLayoutState(payload?.value, state) ?? state;

    case "RESET_PANEL_LAYOUT":
      return createDefaultIdePanelLayoutState();

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
        (payload?.value as { groupId?: string; orderIndex?: number } | undefined)?.groupId,
        (payload?.value as { groupId?: string; orderIndex?: number } | undefined)?.orderIndex
      );

    case "CREATE_PANEL_INSTANCE":
      return createPanelInstance(
        state,
        payload?.id,
        payload?.text,
        payload?.nextId,
        (
          payload?.value as
            | { placement?: PanelPlacement; activityId?: string; groupId?: string; orderIndex?: number }
            | undefined
        )?.placement,
        (
          payload?.value as
            | { placement?: PanelPlacement; activityId?: string; groupId?: string; orderIndex?: number }
            | undefined
        )?.activityId,
        (
          payload?.value as
            | { placement?: PanelPlacement; activityId?: string; groupId?: string; orderIndex?: number }
            | undefined
        )?.groupId,
        (
          payload?.value as
            | { placement?: PanelPlacement; activityId?: string; groupId?: string; orderIndex?: number }
            | undefined
        )?.orderIndex
      );

    case "CLOSE_PANEL_INSTANCE":
      return closePanelInstance(state, payload?.id);

    case "SET_ACTIVE_EDITOR_GROUP":
      return setActiveEditorGroup(state, payload?.id);

    case "SPLIT_EDITOR_GROUP":
      return splitEditorGroup(
        state,
        payload?.text as "left" | "right" | "up" | "down" | undefined
      );

    case "SET_EDITOR_SPLIT_SIZE":
      return setEditorSplitSize(
        state,
        (payload?.value as { path?: string; size?: number } | undefined)?.path,
        (payload?.value as { path?: string; size?: number } | undefined)?.size
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

function setActiveEditorGroup(
  state: IdePanelLayoutState,
  groupId: string | undefined
): IdePanelLayoutState {
  if (!groupId || !state.documentGroups[groupId] || !editorLayoutContainsGroup(state.documentLayout.root, groupId)) {
    return state;
  }

  return {
    ...state,
    documentLayout: {
      ...state.documentLayout,
      activeGroupId: groupId
    }
  };
}

function splitEditorGroup(
  state: IdePanelLayoutState,
  direction: "left" | "right" | "up" | "down" | undefined
): IdePanelLayoutState {
  if (direction !== "left" && direction !== "right" && direction !== "up" && direction !== "down") {
    return state;
  }

  const sourceGroupId = state.documentLayout.activeGroupId;
  const sourceGroup = state.documentGroups[sourceGroupId];
  if (!sourceGroup || !editorLayoutContainsGroup(state.documentLayout.root, sourceGroupId)) {
    return state;
  }

  const newGroupId = createNextEditorGroupId(state);
  const cloned = cloneActiveDocumentInstance(state, sourceGroup, sourceGroupId, newGroupId);
  const newGroup: EditorGroupState = {
    activeInstanceId: cloned?.instanceId,
    instanceIds: cloned ? [cloned.instanceId] : []
  };
  const axis: EditorLayoutAxis =
    direction === "left" || direction === "right" ? "horizontal" : "vertical";
  const position = direction === "left" || direction === "up" ? "before" : "after";
  const root = insertEditorGroup(
    state.documentLayout.root,
    sourceGroupId,
    newGroupId,
    axis,
    position
  );
  if (!root) {
    return state;
  }

  return {
    ...state,
    instances: cloned
      ? {
          ...state.instances,
          [cloned.instanceId]: cloned
        }
      : state.instances,
    documentGroups: {
      ...state.documentGroups,
      [newGroupId]: newGroup
    },
    documentLayout: {
      ...state.documentLayout,
      root,
      activeGroupId: newGroupId,
      nextGroupOrdinal: getNextEditorGroupOrdinal(newGroupId) + 1,
      maximizedGroupId: undefined
    }
  };
}

function setEditorSplitSize(
  state: IdePanelLayoutState,
  path: string | undefined,
  size: number | undefined
): IdePanelLayoutState {
  if (path === undefined || typeof size !== "number" || !Number.isFinite(size) || size < 0) {
    return state;
  }

  const root = updateEditorSplitSizeAtPath(state.documentLayout.root, path, size);
  if (root === state.documentLayout.root) {
    return state;
  }

  return {
    ...state,
    documentLayout: {
      ...state.documentLayout,
      root
    }
  };
}

function cloneActiveDocumentInstance(
  state: IdePanelLayoutState,
  sourceGroup: EditorGroupState,
  sourceGroupId: string,
  newGroupId: string
): PanelInstance | undefined {
  const activeInstanceId = sourceGroup.activeInstanceId ?? sourceGroup.instanceIds[0];
  if (!activeInstanceId) {
    return undefined;
  }

  const sourceInstance = state.instances[activeInstanceId];
  if (!sourceInstance || sourceInstance.placement !== "document") {
    return undefined;
  }

  const contribution = getIdePanelContribution(sourceInstance.contributionId);
  if (!contribution?.allowDocument || !contribution.allowMultipleDocumentInstances) {
    return undefined;
  }

  const instanceId = createDocumentInstanceId(state, sourceInstance.contributionId, newGroupId);
  return {
    ...sourceInstance,
    instanceId,
    groupId: newGroupId,
    order: 0,
    context: sourceInstance.context ? { ...sourceInstance.context } : undefined
  };
}

function createDocumentInstanceId(
  state: IdePanelLayoutState,
  contributionId: string,
  groupId: string
): string {
  const baseId = `${contributionId}.${groupId}`;
  if (!state.instances[baseId]) {
    return baseId;
  }

  let ordinal = 2;
  while (state.instances[`${baseId}.${ordinal}`]) {
    ordinal++;
  }
  return `${baseId}.${ordinal}`;
}

function createNextEditorGroupId(state: IdePanelLayoutState): string {
  let ordinal = Math.max(2, state.documentLayout.nextGroupOrdinal);
  while (state.documentGroups[`group${ordinal}`] || editorLayoutContainsGroup(state.documentLayout.root, `group${ordinal}`)) {
    ordinal++;
  }
  return `group${ordinal}`;
}

function getNextEditorGroupOrdinal(groupId: string): number {
  const match = /^group(\d+)$/.exec(groupId);
  return match ? Number(match[1]) : 1;
}

function insertEditorGroup(
  node: EditorLayoutNode,
  sourceGroupId: string,
  newGroupId: string,
  axis: EditorLayoutAxis,
  position: "before" | "after"
): EditorLayoutNode | undefined {
  if (node.type === "group") {
    if (node.groupId !== sourceGroupId) {
      return undefined;
    }
    const sourceNode = node;
    const newNode: EditorLayoutNode = { type: "group", groupId: newGroupId };
    return {
      type: "split",
      axis,
      children: position === "before" ? [newNode, sourceNode] : [sourceNode, newNode]
    };
  }

  const directIndex = node.children.findIndex(
    (child) => child.type === "group" && child.groupId === sourceGroupId
  );
  if (directIndex >= 0) {
    const sourceNode = node.children[directIndex];
    const newNode: EditorLayoutNode = { type: "group", groupId: newGroupId };
    return {
      ...node,
      children: node.children.map((child, index) =>
        index === directIndex
          ? {
              type: "split",
              axis,
              children: position === "before" ? [newNode, sourceNode] : [sourceNode, newNode]
            }
          : child
      ),
      sizes: undefined
    };
  }

  let changed = false;
  const children = node.children.map((child) => {
    const nextChild = insertEditorGroup(child, sourceGroupId, newGroupId, axis, position);
    if (!nextChild) {
      return child;
    }
    changed = true;
    return nextChild;
  });

  return changed ? { ...node, children, sizes: undefined } : undefined;
}

function updateEditorSplitSizeAtPath(
  node: EditorLayoutNode,
  path: string,
  size: number
): EditorLayoutNode {
  const pathParts = path
    .split(".")
    .filter(Boolean)
    .map((part) => Number(part));
  if (pathParts.some((part) => !Number.isInteger(part) || part < 0)) {
    return node;
  }
  return updateEditorSplitSizeAtPathParts(node, pathParts, Math.round(size));
}

function updateEditorSplitSizeAtPathParts(
  node: EditorLayoutNode,
  pathParts: number[],
  size: number
): EditorLayoutNode {
  if (!pathParts.length) {
    return node.type === "split" ? { ...node, sizes: [size] } : node;
  }
  if (node.type !== "split") {
    return node;
  }

  const [index, ...rest] = pathParts;
  if (index >= node.children.length) {
    return node;
  }

  const child = node.children[index];
  const nextChild = updateEditorSplitSizeAtPathParts(child, rest, size);
  if (nextChild === child) {
    return node;
  }

  return {
    ...node,
    children: node.children.map((current, childIndex) =>
      childIndex === index ? nextChild : current
    )
  };
}

function editorLayoutContainsGroup(node: EditorLayoutNode, groupId: string): boolean {
  if (node.type === "group") {
    return node.groupId === groupId;
  }
  return node.children.some((child) => editorLayoutContainsGroup(child, groupId));
}

function createPanelInstance(
  state: IdePanelLayoutState,
  instanceId: string | undefined,
  contributionId: string | undefined,
  rendererId: string | undefined,
  placement: PanelPlacement | undefined,
  activityId?: string,
  groupId?: string,
  orderIndex?: number
): IdePanelLayoutState {
  if (!instanceId || !contributionId || !rendererId || !placement || state.instances[instanceId]) {
    return state;
  }
  if (!canPlacePanelContribution(contributionId, placement)) {
    return state;
  }
  if (!canCreatePanelInstance(state, contributionId, placement, groupId)) {
    return state;
  }

  const order = getPlacementOrder(state, placement, activityId, groupId);
  const instance: PanelInstance = {
    instanceId,
    contributionId,
    rendererId,
    placement,
    activityId: placement === "primarySideBar" ? (activityId ?? "explorer") : undefined,
    groupId: placement === "document" ? (groupId ?? "group1") : undefined,
    expanded: true,
    order
  };

  const nextState: IdePanelLayoutState = {
    ...state,
    instances: {
      ...state.instances,
      [instanceId]: instance
    }
  };

  return addPanelInstanceToPlacement(nextState, instance, orderIndex);
}

function movePanelInstance(
  state: IdePanelLayoutState,
  instanceId: string | undefined,
  placement: PanelPlacement | undefined,
  activityId?: string,
  groupId?: string,
  orderIndex?: number
): IdePanelLayoutState {
  if (!instanceId || !placement || !state.instances[instanceId]) {
    return state;
  }
  if (!canPlacePanelContribution(state.instances[instanceId].contributionId, placement)) {
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

  return addPanelInstanceToPlacement(nextState, movedInstance, orderIndex);
}

function addPanelInstanceToPlacement(
  state: IdePanelLayoutState,
  instance: PanelInstance,
  orderIndex?: number
): IdePanelLayoutState {
  switch (instance.placement) {
    case "primarySideBar": {
      const targetActivity = instance.activityId ?? "explorer";
      const instanceIds = insertPanelInstanceId(
        state.primarySideBarByActivity[targetActivity] ?? [],
        instance.instanceId,
        orderIndex
      );
      const orderedState = normalizePanelOrder(
        state,
        instance.placement,
        targetActivity,
        undefined,
        instanceIds
      );
      return {
        ...orderedState,
        instances: {
          ...orderedState.instances,
          [instance.instanceId]: {
            ...instance,
            activityId: targetActivity,
            order: instanceIds.indexOf(instance.instanceId)
          }
        },
        primarySideBarByActivity: {
          ...state.primarySideBarByActivity,
          [targetActivity]: instanceIds
        }
      };
    }

    case "secondarySideBar": {
      const instanceIds = insertPanelInstanceId(
        state.secondarySideBar,
        instance.instanceId,
        orderIndex
      );
      const orderedState = normalizePanelOrder(
        state,
        instance.placement,
        undefined,
        undefined,
        instanceIds
      );
      return {
        ...orderedState,
        instances: {
          ...orderedState.instances,
          [instance.instanceId]: {
            ...instance,
            order: instanceIds.indexOf(instance.instanceId)
          }
        },
        secondarySideBar: instanceIds
      };
    }

    case "toolArea": {
      const instanceIds = insertPanelInstanceId(state.toolArea, instance.instanceId, orderIndex);
      const orderedState = normalizePanelOrder(
        state,
        instance.placement,
        undefined,
        undefined,
        instanceIds
      );
      return {
        ...orderedState,
        instances: {
          ...orderedState.instances,
          [instance.instanceId]: {
            ...instance,
            order: instanceIds.indexOf(instance.instanceId)
          }
        },
        toolArea: instanceIds
      };
    }

    case "document": {
      const targetGroupId = instance.groupId ?? "group1";
      const group = state.documentGroups[targetGroupId] ?? { instanceIds: [] };
      const instanceIds = insertPanelInstanceId(group.instanceIds, instance.instanceId, orderIndex);
      const orderedState = normalizePanelOrder(
        state,
        instance.placement,
        undefined,
        targetGroupId,
        instanceIds
      );
      return {
        ...orderedState,
        instances: {
          ...orderedState.instances,
          [instance.instanceId]: {
            ...instance,
            groupId: targetGroupId,
            order: instanceIds.indexOf(instance.instanceId)
          }
        },
        documentGroups: {
          ...state.documentGroups,
          [targetGroupId]: {
            ...group,
            activeInstanceId: instance.instanceId,
            instanceIds
          }
        }
      };
    }
  }
}

function closePanelInstance(
  state: IdePanelLayoutState,
  instanceId: string | undefined
): IdePanelLayoutState {
  if (!instanceId || !state.instances[instanceId]) {
    return state;
  }

  const cleaned = removePanelInstanceFromPlacements(state, instanceId);
  const { [instanceId]: _closedInstance, ...instances } = cleaned.instances;
  const { [instanceId]: _closedViewState, ...viewStateByInstance } = cleaned.viewStateByInstance;

  return {
    ...cleaned,
    instances,
    viewStateByInstance
  };
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
      removePanelInstanceFromDocumentGroup(group, instanceId)
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

function canCreatePanelInstance(
  state: IdePanelLayoutState,
  contributionId: string,
  placement: PanelPlacement,
  groupId?: string
): boolean {
  const contribution = getIdePanelContribution(contributionId);
  if (!contribution) {
    return false;
  }

  if (placement !== "document" || contribution.allowMultipleDocumentInstances) {
    return true;
  }

  const targetGroupId = groupId ?? "group1";
  return !Object.values(state.instances).some(
    (instance) =>
      instance.contributionId === contributionId &&
      instance.placement === "document" &&
      instance.groupId === targetGroupId
  );
}

function insertPanelInstanceId(
  instanceIds: string[],
  instanceId: string,
  orderIndex?: number
): string[] {
  const cleaned = instanceIds.filter((id) => id !== instanceId);
  const insertionIndex =
    orderIndex === undefined
      ? cleaned.length
      : Math.max(0, Math.min(orderIndex, cleaned.length));
  return [
    ...cleaned.slice(0, insertionIndex),
    instanceId,
    ...cleaned.slice(insertionIndex)
  ];
}

function normalizePanelOrder(
  state: IdePanelLayoutState,
  placement: PanelPlacement,
  activityId: string | undefined,
  groupId: string | undefined,
  instanceIds: string[]
): IdePanelLayoutState {
  const instances = { ...state.instances };
  instanceIds.forEach((instanceId, order) => {
    const instance = instances[instanceId];
    if (!instance) {
      return;
    }
    instances[instanceId] = {
      ...instance,
      placement,
      activityId: placement === "primarySideBar" ? activityId : undefined,
      groupId: placement === "document" ? groupId : undefined,
      order
    };
  });
  return {
    ...state,
    instances
  };
}

function removePanelInstanceFromDocumentGroup(
  group: { activeInstanceId?: string; instanceIds: string[] },
  instanceId: string
): { activeInstanceId?: string; instanceIds: string[] } {
  const instanceIds = group.instanceIds.filter((id) => id !== instanceId);
  const activeInstanceId =
    group.activeInstanceId === instanceId ? instanceIds[0] : group.activeInstanceId;
  return {
    ...group,
    activeInstanceId,
    instanceIds
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
