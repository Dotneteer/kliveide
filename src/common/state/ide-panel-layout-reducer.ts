import type { Action } from "./Action";
import {
  canPlacePanelContribution,
  getIdePanelContribution
} from "./ide-panel-contributions";
import {
  createDefaultIdePanelLayoutState,
  normalizeIdePanelLayoutState,
  type EditorGroupState,
  type EditorDocumentState,
  type EditorLayoutAxis,
  type EditorLayoutNode,
  type EditorSplitInGroupState,
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

    case "SET_ACTIVE_DOCUMENT_PANEL_INSTANCE":
      return setActiveDocumentPanelInstance(state, payload?.id, payload?.nextId);

    case "OPEN_DOCUMENT_IN_ACTIVE_GROUP":
      return openDocumentInActiveGroup(state, payload?.value);

    case "OPEN_DOCUMENT_TO_SIDE":
      return openDocumentToSide(state, payload?.value);

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

    case "MOVE_ACTIVE_EDITOR_TO_GROUP":
      return moveActiveEditorToGroup(
        state,
        payload?.text as EditorDirection | undefined
      );

    case "MOVE_ACTIVE_EDITOR_GROUP":
      return moveActiveEditorGroup(
        state,
        payload?.text as EditorDirection | undefined
      );

    case "FOCUS_EDITOR_GROUP":
      return focusEditorGroup(
        state,
        payload?.text as EditorDirection | undefined
      );

    case "CLOSE_EDITORS_IN_ACTIVE_GROUP":
      return closeEditorsInActiveGroup(state);

    case "CLOSE_ACTIVE_EDITOR_GROUP":
      return closeActiveEditorGroup(state);

    case "TOGGLE_EDITOR_GROUP_LAYOUT":
      return toggleEditorGroupLayout(state);

    case "TOGGLE_MAXIMIZE_EDITOR_GROUP":
      return toggleMaximizeEditorGroup(state);

    case "SET_EDITOR_GROUP_LOCKED":
      return setEditorGroupLocked(state, payload?.id, payload?.flag);

    case "TOGGLE_SPLIT_IN_GROUP":
      return toggleSplitInGroup(
        state,
        payload?.text as EditorLayoutAxis | undefined
      );

    case "JOIN_SPLIT_IN_GROUP":
      return joinSplitInGroup(state);

    case "TOGGLE_SPLIT_IN_GROUP_LAYOUT":
      return toggleSplitInGroupLayout(state);

    case "FOCUS_SPLIT_IN_GROUP_PANE":
      return focusSplitInGroupPane(state, payload?.value);

    case "SET_EDITOR_GROUP_LAYOUT_PRESET":
      return setEditorGroupLayoutPreset(
        state,
        payload?.text as EditorLayoutPreset | undefined
      );

    case "MOVE_PANEL_INSTANCE_TO_EDITOR_EDGE":
      return movePanelInstanceToEditorEdge(
        state,
        payload?.id,
        payload?.nextId,
        payload?.text as EditorDirection | undefined
      );

    case "COPY_PANEL_INSTANCE_TO_DOCUMENT_GROUP":
      return copyPanelInstanceToDocumentGroup(
        state,
        payload?.id,
        payload?.nextId,
        payload?.numValue
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

type EditorDirection = "left" | "right" | "up" | "down";
type EditorLayoutPreset =
  | "single"
  | "twoColumns"
  | "threeColumns"
  | "twoRows"
  | "threeRows"
  | "grid";

type LayoutRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type GroupLayoutRect = LayoutRect & {
  groupId: string;
};

function openDocumentInActiveGroup(
  state: IdePanelLayoutState,
  value: unknown
): IdePanelLayoutState {
  const document = normalizeEditorDocument(value);
  if (!document) {
    return state;
  }

  const activeGroupId = state.documentLayout.activeGroupId;
  const targetGroupId = state.documentGroups[activeGroupId]?.locked
    ? findNearestUnlockedEditorGroup(state, activeGroupId)
    : activeGroupId;
  if (!targetGroupId || !state.documentGroups[targetGroupId] || !editorLayoutContainsGroup(state.documentLayout.root, targetGroupId)) {
    return state;
  }

  return setGroupActiveDocument(state, targetGroupId, document);
}

function openDocumentToSide(state: IdePanelLayoutState, value: unknown): IdePanelLayoutState {
  const document = normalizeEditorDocument(value);
  if (!document) {
    return state;
  }

  const splitState = splitEditorGroup(state, "right", { cloneActiveDocument: false });
  if (splitState === state) {
    return state;
  }

  return setGroupActiveDocument(splitState, splitState.documentLayout.activeGroupId, document);
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

function setActiveDocumentPanelInstance(
  state: IdePanelLayoutState,
  groupId: string | undefined,
  instanceId: string | undefined
): IdePanelLayoutState {
  const group = groupId ? state.documentGroups[groupId] : undefined;
  if (!groupId || !instanceId || !group || !group.instanceIds.includes(instanceId)) {
    return state;
  }

  return {
    ...state,
    documentGroups: {
      ...state.documentGroups,
      [groupId]: {
        ...group,
        activeInstanceId: instanceId
      }
    },
    documentLayout: {
      ...state.documentLayout,
      activeGroupId: groupId
    }
  };
}

function splitEditorGroup(
  state: IdePanelLayoutState,
  direction: "left" | "right" | "up" | "down" | undefined,
  options: { cloneActiveDocument?: boolean } = {}
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
  const cloned =
    options.cloneActiveDocument === false
      ? undefined
      : cloneActiveDocumentInstance(state, sourceGroup, sourceGroupId, newGroupId);
  const newGroup: EditorGroupState = {
    activeInstanceId: cloned?.instanceId,
    instanceIds: cloned ? [cloned.instanceId] : [],
    activeDocument: sourceGroup.activeDocument ? { ...sourceGroup.activeDocument } : undefined
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

function setGroupActiveDocument(
  state: IdePanelLayoutState,
  groupId: string,
  document: EditorDocumentState
): IdePanelLayoutState {
  const group = state.documentGroups[groupId];
  if (!group) {
    return state;
  }

  return {
    ...state,
    documentGroups: {
      ...state.documentGroups,
      [groupId]: {
        ...group,
        activeDocument: document
      }
    },
    documentLayout: {
      ...state.documentLayout,
      activeGroupId: groupId
    }
  };
}

function normalizeEditorDocument(value: unknown): EditorDocumentState | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || typeof record.name !== "string") {
    return undefined;
  }

  return {
    id: record.id,
    name: record.name,
    icon: typeof record.icon === "string" ? record.icon : "file-code",
    kind: typeof record.kind === "string" ? record.kind : "unknown"
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

function moveActiveEditorToGroup(
  state: IdePanelLayoutState,
  direction: EditorDirection | undefined
): IdePanelLayoutState {
  if (!isEditorDirection(direction)) {
    return state;
  }

  const sourceGroupId = state.documentLayout.activeGroupId;
  const targetGroupId = findNearestEditorGroup(state.documentLayout.root, sourceGroupId, direction);
  if (!targetGroupId) {
    return state;
  }

  const sourceGroup = state.documentGroups[sourceGroupId];
  const targetGroup = state.documentGroups[targetGroupId];
  const activeDocument = sourceGroup?.activeDocument;
  if (!sourceGroup || !targetGroup || !activeDocument) {
    return state;
  }

  return {
    ...state,
    documentGroups: {
      ...state.documentGroups,
      [sourceGroupId]: {
        ...sourceGroup,
        activeDocument: undefined
      },
      [targetGroupId]: {
        ...targetGroup,
        activeDocument: { ...activeDocument }
      }
    },
    documentLayout: {
      ...state.documentLayout,
      activeGroupId: targetGroupId
    }
  };
}

function moveActiveEditorGroup(
  state: IdePanelLayoutState,
  direction: EditorDirection | undefined
): IdePanelLayoutState {
  if (!isEditorDirection(direction)) {
    return state;
  }

  const sourceGroupId = state.documentLayout.activeGroupId;
  const targetGroupId = findNearestEditorGroup(state.documentLayout.root, sourceGroupId, direction);
  if (!targetGroupId) {
    return state;
  }

  return {
    ...state,
    documentLayout: {
      ...state.documentLayout,
      root: swapEditorGroupLeaves(state.documentLayout.root, sourceGroupId, targetGroupId),
      activeGroupId: sourceGroupId
    }
  };
}

function focusEditorGroup(
  state: IdePanelLayoutState,
  direction: EditorDirection | undefined
): IdePanelLayoutState {
  if (!isEditorDirection(direction)) {
    return state;
  }

  const targetGroupId = findNearestEditorGroup(
    state.documentLayout.root,
    state.documentLayout.activeGroupId,
    direction
  );
  return targetGroupId ? setActiveEditorGroup(state, targetGroupId) : state;
}

function closeEditorsInActiveGroup(state: IdePanelLayoutState): IdePanelLayoutState {
  const groupId = state.documentLayout.activeGroupId;
  const group = state.documentGroups[groupId];
  if (!group) {
    return state;
  }

  const instanceIds = new Set(group.instanceIds);
  const instances = Object.fromEntries(
    Object.entries(state.instances).filter(
      ([instanceId, instance]) => !instanceIds.has(instanceId) && instance.groupId !== groupId
    )
  );
  const viewStateByInstance = Object.fromEntries(
    Object.entries(state.viewStateByInstance).filter(([instanceId]) => !instanceIds.has(instanceId))
  );

  return {
    ...state,
    instances,
    viewStateByInstance,
    documentGroups: {
      ...state.documentGroups,
      [groupId]: {
        ...group,
        activeInstanceId: undefined,
        instanceIds: [],
        activeDocument: undefined
      }
    }
  };
}

function closeActiveEditorGroup(state: IdePanelLayoutState): IdePanelLayoutState {
  const groupId = state.documentLayout.activeGroupId;
  const visibleGroupIds = collectEditorGroupIdsFromLayout(state.documentLayout.root);
  if (!visibleGroupIds.includes(groupId)) {
    return state;
  }

  if (visibleGroupIds.length <= 1) {
    return closeEditorsInActiveGroup(state);
  }

  const fallbackGroupId =
    findNearestEditorGroup(state.documentLayout.root, groupId, "right") ??
    findNearestEditorGroup(state.documentLayout.root, groupId, "left") ??
    findNearestEditorGroup(state.documentLayout.root, groupId, "down") ??
    findNearestEditorGroup(state.documentLayout.root, groupId, "up") ??
    visibleGroupIds.find((id) => id !== groupId);
  const root = removeEditorGroupFromLayout(state.documentLayout.root, groupId);
  if (!root || !fallbackGroupId) {
    return state;
  }

  const group = state.documentGroups[groupId];
  const instanceIds = new Set(group?.instanceIds ?? []);
  const instances = Object.fromEntries(
    Object.entries(state.instances).filter(
      ([instanceId, instance]) => !instanceIds.has(instanceId) && instance.groupId !== groupId
    )
  );
  const viewStateByInstance = Object.fromEntries(
    Object.entries(state.viewStateByInstance).filter(([instanceId]) => !instanceIds.has(instanceId))
  );
  const { [groupId]: _closedGroup, ...documentGroups } = state.documentGroups;

  return {
    ...state,
    instances,
    viewStateByInstance,
    documentGroups,
    documentLayout: {
      ...state.documentLayout,
      root,
      activeGroupId: fallbackGroupId,
      maximizedGroupId:
        state.documentLayout.maximizedGroupId === groupId
          ? undefined
          : state.documentLayout.maximizedGroupId
    }
  };
}

function toggleEditorGroupLayout(state: IdePanelLayoutState): IdePanelLayoutState {
  const root = state.documentLayout.root;
  if (root.type !== "split") {
    return state;
  }

  return {
    ...state,
    documentLayout: {
      ...state.documentLayout,
      root: {
        ...root,
        axis: root.axis === "horizontal" ? "vertical" : "horizontal",
        sizes: undefined
      }
    }
  };
}

function toggleMaximizeEditorGroup(state: IdePanelLayoutState): IdePanelLayoutState {
  const activeGroupId = state.documentLayout.activeGroupId;
  if (!editorLayoutContainsGroup(state.documentLayout.root, activeGroupId)) {
    return state;
  }

  return {
    ...state,
    documentLayout: {
      ...state.documentLayout,
      maximizedGroupId:
        state.documentLayout.maximizedGroupId === activeGroupId ? undefined : activeGroupId
    }
  };
}

function setEditorGroupLocked(
  state: IdePanelLayoutState,
  groupId: string | undefined,
  locked: boolean | undefined
): IdePanelLayoutState {
  const group = groupId ? state.documentGroups[groupId] : undefined;
  if (!groupId || !group || typeof locked !== "boolean") {
    return state;
  }

  return {
    ...state,
    documentGroups: {
      ...state.documentGroups,
      [groupId]: {
        ...group,
        locked
      }
    }
  };
}

function toggleSplitInGroup(
  state: IdePanelLayoutState,
  axis: EditorLayoutAxis | undefined
): IdePanelLayoutState {
  if (axis !== "horizontal" && axis !== "vertical") {
    return state;
  }
  const context = getActiveSplitInGroupContext(state);
  if (!context) {
    return state;
  }
  if (context.split) {
    return joinSplitInGroup(state);
  }

  return setActiveSplitInGroupState(state, {
    axis,
    activePane: 0
  });
}

function joinSplitInGroup(state: IdePanelLayoutState): IdePanelLayoutState {
  const context = getActiveSplitInGroupContext(state);
  if (!context?.split) {
    return state;
  }

  const { [context.documentId]: _removed, ...splitInGroupByDocument } =
    context.group.splitInGroupByDocument ?? {};
  return {
    ...state,
    documentGroups: {
      ...state.documentGroups,
      [context.groupId]: {
        ...context.group,
        splitInGroupByDocument
      }
    }
  };
}

function toggleSplitInGroupLayout(state: IdePanelLayoutState): IdePanelLayoutState {
  const context = getActiveSplitInGroupContext(state);
  if (!context?.split) {
    return state;
  }

  return setActiveSplitInGroupState(state, {
    ...context.split,
    axis: context.split.axis === "horizontal" ? "vertical" : "horizontal"
  });
}

function focusSplitInGroupPane(
  state: IdePanelLayoutState,
  pane: unknown
): IdePanelLayoutState {
  const context = getActiveSplitInGroupContext(state);
  if (!context?.split) {
    return state;
  }

  const activePane =
    pane === "other"
      ? (context.split.activePane === 0 ? 1 : 0)
      : pane === 1
        ? 1
        : pane === 0
          ? 0
          : undefined;
  if (activePane === undefined) {
    return state;
  }

  return setActiveSplitInGroupState(state, {
    ...context.split,
    activePane
  });
}

function setEditorGroupLayoutPreset(
  state: IdePanelLayoutState,
  preset: EditorLayoutPreset | undefined
): IdePanelLayoutState {
  if (!isEditorLayoutPreset(preset)) {
    return state;
  }

  if (preset === "single") {
    return mergeEditorGroupsIntoActiveGroup(state);
  }

  const minimumGroups =
    preset === "twoColumns" || preset === "twoRows"
      ? 2
      : preset === "threeColumns" || preset === "threeRows"
        ? 3
        : 4;
  const { documentGroups, groupIds } = ensureVisibleEditorGroups(state, minimumGroups);
  const root =
    preset === "twoColumns"
      ? buildEditorGridLayout(groupIds, 2)
      : preset === "threeColumns"
        ? buildEditorGridLayout(groupIds, 3)
        : preset === "twoRows"
          ? buildEditorRowsLayout(groupIds, 2)
          : preset === "threeRows"
            ? buildEditorRowsLayout(groupIds, 3)
            : buildEditorGridLayout(groupIds, 2);

  return {
    ...state,
    documentGroups,
    documentLayout: {
      ...state.documentLayout,
      root,
      activeGroupId: groupIds.includes(state.documentLayout.activeGroupId)
        ? state.documentLayout.activeGroupId
        : groupIds[0],
      nextGroupOrdinal: Math.max(
        state.documentLayout.nextGroupOrdinal,
        ...groupIds.map((groupId) => getNextEditorGroupOrdinal(groupId) + 1)
      ),
      maximizedGroupId: undefined
    }
  };
}

function movePanelInstanceToEditorEdge(
  state: IdePanelLayoutState,
  instanceId: string | undefined,
  groupId: string | undefined,
  direction: EditorDirection | undefined
): IdePanelLayoutState {
  if (!instanceId || !groupId || !isEditorDirection(direction)) {
    return state;
  }
  if (!state.instances[instanceId] || !state.documentGroups[groupId]) {
    return state;
  }

  const focusedState = setActiveEditorGroup(state, groupId);
  const splitState = splitEditorGroup(focusedState, direction, { cloneActiveDocument: false });
  if (splitState === focusedState) {
    return state;
  }

  return movePanelInstance(
    splitState,
    instanceId,
    "document",
    undefined,
    splitState.documentLayout.activeGroupId,
    0
  );
}

function copyPanelInstanceToDocumentGroup(
  state: IdePanelLayoutState,
  instanceId: string | undefined,
  groupId: string | undefined,
  orderIndex?: number
): IdePanelLayoutState {
  if (!instanceId || !groupId || !state.documentGroups[groupId]) {
    return state;
  }

  const sourceInstance = state.instances[instanceId];
  if (!sourceInstance || !canPlacePanelContribution(sourceInstance.contributionId, "document")) {
    return state;
  }

  const contribution = getIdePanelContribution(sourceInstance.contributionId);
  if (!contribution?.allowMultipleDocumentInstances) {
    return state;
  }

  const newInstanceId = createDocumentInstanceId(state, sourceInstance.contributionId, groupId);
  const copiedInstance: PanelInstance = {
    ...sourceInstance,
    instanceId: newInstanceId,
    placement: "document",
    activityId: undefined,
    groupId,
    order: 0,
    context: sourceInstance.context ? { ...sourceInstance.context } : undefined
  };
  const nextState: IdePanelLayoutState = {
    ...state,
    instances: {
      ...state.instances,
      [newInstanceId]: copiedInstance
    }
  };

  return addPanelInstanceToPlacement(nextState, copiedInstance, orderIndex);
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

function findNearestEditorGroup(
  root: EditorLayoutNode,
  sourceGroupId: string,
  direction: EditorDirection
): string | undefined {
  const rects = collectEditorGroupRects(root, { x: 0, y: 0, width: 1, height: 1 });
  const source = rects.find((rect) => rect.groupId === sourceGroupId);
  if (!source) {
    return undefined;
  }

  const sourceCenterX = source.x + source.width / 2;
  const sourceCenterY = source.y + source.height / 2;
  const candidates = rects
    .filter((rect) => rect.groupId !== sourceGroupId)
    .map((rect) => {
      const centerX = rect.x + rect.width / 2;
      const centerY = rect.y + rect.height / 2;
      const horizontalOverlap = Math.min(source.x + source.width, rect.x + rect.width) - Math.max(source.x, rect.x);
      const verticalOverlap = Math.min(source.y + source.height, rect.y + rect.height) - Math.max(source.y, rect.y);
      const primaryDistance =
        direction === "left"
          ? sourceCenterX - centerX
          : direction === "right"
            ? centerX - sourceCenterX
            : direction === "up"
              ? sourceCenterY - centerY
              : centerY - sourceCenterY;
      const perpendicularDistance =
        direction === "left" || direction === "right"
          ? Math.abs(centerY - sourceCenterY)
          : Math.abs(centerX - sourceCenterX);
      const overlapBonus =
        direction === "left" || direction === "right"
          ? verticalOverlap > 0 ? 0 : 1
          : horizontalOverlap > 0 ? 0 : 1;

      return {
        rect,
        primaryDistance,
        score: primaryDistance + perpendicularDistance + overlapBonus
      };
    })
    .filter((candidate) => candidate.primaryDistance > 0)
    .sort((a, b) => a.score - b.score);

  return candidates[0]?.rect.groupId;
}

function findNearestUnlockedEditorGroup(
  state: IdePanelLayoutState,
  sourceGroupId: string
): string | undefined {
  const directions: EditorDirection[] = ["right", "left", "down", "up"];
  for (const direction of directions) {
    const groupId = findNearestEditorGroup(state.documentLayout.root, sourceGroupId, direction);
    if (groupId && !state.documentGroups[groupId]?.locked) {
      return groupId;
    }
  }
  return collectEditorGroupIdsFromLayout(state.documentLayout.root).find(
    (groupId) => groupId !== sourceGroupId && !state.documentGroups[groupId]?.locked
  );
}

function collectEditorGroupRects(
  node: EditorLayoutNode,
  rect: LayoutRect
): GroupLayoutRect[] {
  if (node.type === "group") {
    return [{ ...rect, groupId: node.groupId }];
  }

  const childCount = Math.max(node.children.length, 1);
  if (node.axis === "horizontal") {
    return node.children.flatMap((child, index) =>
      collectEditorGroupRects(child, {
        x: rect.x + (rect.width * index) / childCount,
        y: rect.y,
        width: rect.width / childCount,
        height: rect.height
      })
    );
  }

  return node.children.flatMap((child, index) =>
    collectEditorGroupRects(child, {
      x: rect.x,
      y: rect.y + (rect.height * index) / childCount,
      width: rect.width,
      height: rect.height / childCount
    })
  );
}

function swapEditorGroupLeaves(
  node: EditorLayoutNode,
  sourceGroupId: string,
  targetGroupId: string
): EditorLayoutNode {
  if (node.type === "group") {
    if (node.groupId === sourceGroupId) {
      return { ...node, groupId: targetGroupId };
    }
    if (node.groupId === targetGroupId) {
      return { ...node, groupId: sourceGroupId };
    }
    return node;
  }

  return {
    ...node,
    children: node.children.map((child) =>
      swapEditorGroupLeaves(child, sourceGroupId, targetGroupId)
    )
  };
}

function isEditorDirection(value: unknown): value is EditorDirection {
  return value === "left" || value === "right" || value === "up" || value === "down";
}

function isEditorLayoutPreset(value: unknown): value is EditorLayoutPreset {
  return (
    value === "single" ||
    value === "twoColumns" ||
    value === "threeColumns" ||
    value === "twoRows" ||
    value === "threeRows" ||
    value === "grid"
  );
}

function getActiveSplitInGroupContext(state: IdePanelLayoutState):
  | {
      groupId: string;
      group: EditorGroupState;
      documentId: string;
      split?: EditorSplitInGroupState;
    }
  | undefined {
  const groupId = state.documentLayout.activeGroupId;
  const group = state.documentGroups[groupId];
  const documentId = group?.activeDocument?.id ?? group?.activeInstanceId;
  if (!group || !documentId) {
    return undefined;
  }

  return {
    groupId,
    group,
    documentId,
    split: group.splitInGroupByDocument?.[documentId]
  };
}

function setActiveSplitInGroupState(
  state: IdePanelLayoutState,
  split: EditorSplitInGroupState
): IdePanelLayoutState {
  const context = getActiveSplitInGroupContext(state);
  if (!context) {
    return state;
  }

  return {
    ...state,
    documentGroups: {
      ...state.documentGroups,
      [context.groupId]: {
        ...context.group,
        splitInGroupByDocument: {
          ...(context.group.splitInGroupByDocument ?? {}),
          [context.documentId]: split
        }
      }
    }
  };
}

function collectEditorGroupIdsFromLayout(node: EditorLayoutNode): string[] {
  if (node.type === "group") {
    return [node.groupId];
  }
  return node.children.flatMap(collectEditorGroupIdsFromLayout);
}

function removeEditorGroupFromLayout(
  node: EditorLayoutNode,
  groupId: string
): EditorLayoutNode | undefined {
  if (node.type === "group") {
    return node.groupId === groupId ? undefined : node;
  }

  const children = node.children
    .map((child) => removeEditorGroupFromLayout(child, groupId))
    .filter((child): child is EditorLayoutNode => !!child);
  if (children.length === 0) {
    return undefined;
  }
  if (children.length === 1) {
    return children[0];
  }
  return {
    type: "split",
    axis: node.axis,
    children
  };
}

function ensureVisibleEditorGroups(
  state: IdePanelLayoutState,
  count: number
): { documentGroups: Record<string, EditorGroupState>; groupIds: string[] } {
  const activeGroupId = state.documentLayout.activeGroupId;
  const visibleGroupIds = collectEditorGroupIdsFromLayout(state.documentLayout.root);
  const existingGroupIds = Object.keys(state.documentGroups);
  const groupIds = [
    activeGroupId,
    ...visibleGroupIds.filter((groupId) => groupId !== activeGroupId),
    ...existingGroupIds.filter(
      (groupId) => groupId !== activeGroupId && !visibleGroupIds.includes(groupId)
    )
  ].filter(
    (groupId, index, all) => state.documentGroups[groupId] && all.indexOf(groupId) === index
  );

  const documentGroups = { ...state.documentGroups };
  while (groupIds.length < count) {
    const groupId = createNextEditorGroupId({
      ...state,
      documentGroups,
      documentLayout: {
        ...state.documentLayout,
        root: { type: "group", groupId: groupIds[0] ?? "group1" }
      }
    });
    documentGroups[groupId] = { instanceIds: [] };
    groupIds.push(groupId);
  }

  return {
    documentGroups,
    groupIds
  };
}

function mergeEditorGroupsIntoActiveGroup(state: IdePanelLayoutState): IdePanelLayoutState {
  const activeGroupId = state.documentLayout.activeGroupId;
  const visibleGroupIds = collectEditorGroupIdsFromLayout(state.documentLayout.root);
  const targetGroupId = visibleGroupIds.includes(activeGroupId)
    ? activeGroupId
    : (visibleGroupIds[0] ?? activeGroupId);
  const targetGroup = state.documentGroups[targetGroupId];
  if (!targetGroup) {
    return state;
  }

  const mergedInstanceIds = visibleGroupIds.flatMap(
    (groupId) => state.documentGroups[groupId]?.instanceIds ?? []
  );
  const uniqueInstanceIds = [...new Set(mergedInstanceIds)];
  const instances = { ...state.instances };
  uniqueInstanceIds.forEach((instanceId, order) => {
    const instance = instances[instanceId];
    if (instance?.placement === "document") {
      instances[instanceId] = {
        ...instance,
        groupId: targetGroupId,
        order
      };
    }
  });

  const documentGroups = { ...state.documentGroups };
  visibleGroupIds.forEach((groupId) => {
    if (groupId !== targetGroupId) {
      delete documentGroups[groupId];
    }
  });
  documentGroups[targetGroupId] = {
    ...targetGroup,
    instanceIds: uniqueInstanceIds,
    activeInstanceId: targetGroup.activeInstanceId ?? uniqueInstanceIds[0]
  };

  return {
    ...state,
    instances,
    documentGroups,
    documentLayout: {
      ...state.documentLayout,
      root: { type: "group", groupId: targetGroupId },
      activeGroupId: targetGroupId,
      maximizedGroupId: undefined
    }
  };
}

function buildEditorGridLayout(groupIds: string[], columnCount: number): EditorLayoutNode {
  const rows = chunkGroupIds(groupIds, columnCount).map((row) =>
    buildEditorSplitTree(
      "horizontal",
      row.map((groupId) => ({ type: "group", groupId }))
    )
  );
  return buildEditorSplitTree("vertical", rows);
}

function buildEditorRowsLayout(groupIds: string[], rowCount: number): EditorLayoutNode {
  const columnSize = Math.ceil(groupIds.length / rowCount);
  const rows = chunkGroupIds(groupIds, columnSize).map((row) =>
    buildEditorSplitTree(
      "horizontal",
      row.map((groupId) => ({ type: "group", groupId }))
    )
  );
  return buildEditorSplitTree("vertical", rows);
}

function buildEditorSplitTree(
  axis: EditorLayoutAxis,
  nodes: EditorLayoutNode[]
): EditorLayoutNode {
  if (nodes.length <= 1) {
    return nodes[0] ?? { type: "group", groupId: "group1" };
  }
  const [first, ...rest] = nodes;
  return {
    type: "split",
    axis,
    children: [first, buildEditorSplitTree(axis, rest)]
  };
}

function chunkGroupIds(groupIds: string[], chunkSize: number): string[][] {
  const chunks: string[][] = [];
  for (let index = 0; index < groupIds.length; index += chunkSize) {
    chunks.push(groupIds.slice(index, index + chunkSize));
  }
  return chunks;
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
