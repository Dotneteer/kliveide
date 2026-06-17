import { idePanelContributions } from "./ide-panel-contributions";

export type PanelPlacement = "primarySideBar" | "secondarySideBar" | "document" | "toolArea";

export type EditorLayoutAxis = "horizontal" | "vertical";

export type EditorLayoutNode =
  | {
      type: "group";
      groupId: string;
    }
  | {
      type: "split";
      axis: EditorLayoutAxis;
      children: EditorLayoutNode[];
      sizes?: number[];
    };

export type EditorGroupState = {
  activeInstanceId?: string;
  instanceIds: string[];
  activeDocument?: EditorDocumentState;
  locked?: boolean;
};

export type EditorDocumentState = {
  id: string;
  name: string;
  icon?: string;
  kind?: string;
};

export type EditorLayoutState = {
  root: EditorLayoutNode;
  activeGroupId: string;
  nextGroupOrdinal: number;
  maximizedGroupId?: string;
};

export type PanelInstance = {
  instanceId: string;
  contributionId: string;
  rendererId: string;
  placement: PanelPlacement;
  activityId?: string;
  groupId?: string;
  expanded?: boolean;
  size?: number;
  order: number;
  context?: Record<string, unknown>;
};

export type IdePanelLayoutState = {
  instances: Record<string, PanelInstance>;
  primarySideBarByActivity: Record<string, string[]>;
  secondarySideBar: string[];
  toolArea: string[];
  documentGroups: Record<string, EditorGroupState>;
  documentLayout: EditorLayoutState;
  viewStateByInstance: Record<string, Record<string, unknown>>;
  contributionState: Record<string, Record<string, unknown>>;
};

export function createDefaultIdePanelLayoutState(): IdePanelLayoutState {
  const primarySideBarByActivity: Record<string, string[]> = {};
  const secondarySideBar: string[] = [];
  const toolArea: string[] = [];
  const contributionInstances: PanelInstance[] = [];

  for (const contribution of idePanelContributions) {
    const defaultPlacement = contribution.defaultPlacement;
    if (!defaultPlacement) {
      continue;
    }

    const order =
      defaultPlacement === "primarySideBar"
        ? primarySideBarByActivity[contribution.defaultActivityId ?? "explorer"]?.length ?? 0
        : defaultPlacement === "secondarySideBar"
          ? secondarySideBar.length
          : defaultPlacement === "toolArea"
            ? toolArea.length
            : 0;

    contributionInstances.push(
      panel(
        contribution.id,
        contribution.id,
        contribution.rendererId,
        defaultPlacement,
        order,
        {
          activityId:
            defaultPlacement === "primarySideBar"
              ? (contribution.defaultActivityId ?? "explorer")
              : undefined,
          expanded: contribution.initiallyExpanded ?? true,
          size: contribution.defaultSize
        }
      )
    );

    if (defaultPlacement === "primarySideBar") {
      const activityId = contribution.defaultActivityId ?? "explorer";
      primarySideBarByActivity[activityId] = [
        ...(primarySideBarByActivity[activityId] ?? []),
        contribution.id
      ];
    } else if (defaultPlacement === "secondarySideBar") {
      secondarySideBar.push(contribution.id);
    } else if (defaultPlacement === "toolArea") {
      toolArea.push(contribution.id);
    }
  }

  const instances = [
    ...contributionInstances,
    panel("memory.group1", "memory", "memory", "document", 1, {
      groupId: "group1",
      expanded: true
    }),
    panel("memory.group2", "memory", "memory", "document", 1, {
      groupId: "group2",
      expanded: true
    }),
    panel("memory.group3", "memory", "memory", "document", 1, {
      groupId: "group3",
      expanded: true
    }),
    panel("memory.group4", "memory", "memory", "document", 1, {
      groupId: "group4",
      expanded: true
    })
  ];

  const documentGroups: Record<string, EditorGroupState> = {
    group1: {
      activeInstanceId: "memory.group1",
      instanceIds: ["memory.group1"],
      activeDocument: {
        id: "src-main",
        name: "main.asm",
        icon: "file-code",
        kind: "code"
      }
    },
    group2: {
      activeInstanceId: "memory.group2",
      instanceIds: ["memory.group2"]
    },
    group3: {
      activeInstanceId: "memory.group3",
      instanceIds: ["memory.group3"]
    },
    group4: {
      activeInstanceId: "memory.group4",
      instanceIds: ["memory.group4"]
    }
  };

  return {
    instances: Object.fromEntries(instances.map((instance) => [instance.instanceId, instance])),
    primarySideBarByActivity,
    secondarySideBar,
    toolArea,
    documentGroups,
    documentLayout: createDefaultEditorLayoutState(documentGroups),
    viewStateByInstance: {},
    contributionState: {}
  };
}

export function createDefaultEditorLayoutState(
  documentGroups: Record<string, EditorGroupState> = { group1: { instanceIds: [] } }
): EditorLayoutState {
  const groupId = documentGroups.group1 ? "group1" : (Object.keys(documentGroups)[0] ?? "group1");
  return {
    root: { type: "group", groupId },
    activeGroupId: groupId,
    nextGroupOrdinal: getNextGroupOrdinal(documentGroups)
  };
}

export function normalizeIdePanelLayoutState(
  value: unknown,
  fallback?: IdePanelLayoutState
): IdePanelLayoutState | undefined {
  if (!isRecord(value)) {
    return fallback;
  }

  const fallbackState = fallback ?? createDefaultIdePanelLayoutState();
  const candidate = value as Partial<IdePanelLayoutState>;
  const documentGroups = normalizeDocumentGroups(candidate.documentGroups, fallbackState.documentGroups);
  const documentLayout = normalizeEditorLayoutState(candidate.documentLayout, documentGroups);

  return {
    ...fallbackState,
    ...candidate,
    documentGroups,
    documentLayout
  };
}

function normalizeEditorLayoutState(
  value: unknown,
  documentGroups: Record<string, EditorGroupState>
): EditorLayoutState {
  const fallback = createDefaultEditorLayoutState(documentGroups);
  if (!isRecord(value)) {
    return fallback;
  }

  const root = normalizeEditorLayoutNode(value.root, documentGroups);
  if (!root) {
    return fallback;
  }

  const groupIds = collectEditorGroupIds(root);
  if (!groupIds.length) {
    return fallback;
  }

  const activeGroupId =
    typeof value.activeGroupId === "string" && groupIds.includes(value.activeGroupId)
      ? value.activeGroupId
      : groupIds[0];
  const maximizedGroupId =
    typeof value.maximizedGroupId === "string" && groupIds.includes(value.maximizedGroupId)
      ? value.maximizedGroupId
      : undefined;
  const requestedNextGroupOrdinal =
    typeof value.nextGroupOrdinal === "number" && Number.isFinite(value.nextGroupOrdinal)
      ? Math.floor(value.nextGroupOrdinal)
      : 0;

  return {
    root,
    activeGroupId,
    nextGroupOrdinal: Math.max(requestedNextGroupOrdinal, getNextGroupOrdinal(documentGroups)),
    maximizedGroupId
  };
}

function normalizeEditorLayoutNode(
  value: unknown,
  documentGroups: Record<string, EditorGroupState>
): EditorLayoutNode | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  if (value.type === "group") {
    return typeof value.groupId === "string" && documentGroups[value.groupId]
      ? { type: "group", groupId: value.groupId }
      : undefined;
  }

  if (value.type !== "split" || (value.axis !== "horizontal" && value.axis !== "vertical")) {
    return undefined;
  }

  const children = Array.isArray(value.children)
    ? value.children
        .map((child) => normalizeEditorLayoutNode(child, documentGroups))
        .filter((child): child is EditorLayoutNode => !!child)
    : [];

  if (children.length === 0) {
    return undefined;
  }

  if (children.length === 1) {
    return children[0];
  }

  const sizes =
    Array.isArray(value.sizes) &&
    value.sizes.length === children.length &&
    value.sizes.every((size) => typeof size === "number" && Number.isFinite(size) && size >= 0)
      ? [...value.sizes]
      : undefined;

  return {
    type: "split",
    axis: value.axis,
    children,
    ...(sizes ? { sizes } : {})
  };
}

function normalizeDocumentGroups(
  value: unknown,
  fallback: Record<string, EditorGroupState>
): Record<string, EditorGroupState> {
  if (!isRecord(value)) {
    return fallback;
  }

  const groups = Object.fromEntries(
    Object.entries(value)
      .filter(([groupId, group]) => typeof groupId === "string" && isRecord(group))
      .map(([groupId, group]) => {
        const instanceIds = Array.isArray(group.instanceIds)
          ? group.instanceIds.filter((id: unknown): id is string => typeof id === "string")
          : [];
        const activeInstanceId =
          typeof group.activeInstanceId === "string" && instanceIds.includes(group.activeInstanceId)
            ? group.activeInstanceId
            : instanceIds[0];
        return [
          groupId,
          {
            activeInstanceId,
            instanceIds,
            ...(isEditorDocumentState(group.activeDocument)
              ? { activeDocument: group.activeDocument }
              : {}),
            ...(typeof group.locked === "boolean" ? { locked: group.locked } : {})
          }
        ];
      })
  );

  return Object.keys(groups).length ? groups : fallback;
}

function collectEditorGroupIds(node: EditorLayoutNode): string[] {
  if (node.type === "group") {
    return [node.groupId];
  }
  return node.children.flatMap(collectEditorGroupIds);
}

function getNextGroupOrdinal(documentGroups: Record<string, EditorGroupState>): number {
  return Math.max(
    2,
    ...Object.keys(documentGroups).map((groupId) => {
      const match = /^group(\d+)$/.exec(groupId);
      return match ? Number(match[1]) + 1 : 0;
    })
  );
}

function isRecord(value: unknown): value is Record<string, any> {
  return !!value && typeof value === "object";
}

function isEditorDocumentState(value: unknown): value is EditorDocumentState {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    (value.icon === undefined || typeof value.icon === "string") &&
    (value.kind === undefined || typeof value.kind === "string")
  );
}

function panel(
  instanceId: string,
  contributionId: string,
  rendererId: string,
  placement: PanelPlacement,
  order: number,
  options: {
    activityId?: string;
    expanded?: boolean;
    size?: number;
    groupId?: string;
    context?: Record<string, unknown>;
  } = {}
): PanelInstance {
  return {
    instanceId,
    contributionId,
    rendererId,
    placement,
    order,
    ...options
  };
}
