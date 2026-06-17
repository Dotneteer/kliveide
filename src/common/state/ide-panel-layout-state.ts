import { idePanelContributions } from "./ide-panel-contributions";

export type PanelPlacement = "primarySideBar" | "secondarySideBar" | "document" | "toolArea";

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
  documentGroups: Record<
    string,
    {
      activeInstanceId?: string;
      instanceIds: string[];
    }
  >;
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

  return {
    instances: Object.fromEntries(instances.map((instance) => [instance.instanceId, instance])),
    primarySideBarByActivity,
    secondarySideBar,
    toolArea,
    documentGroups: {
      group1: {
        activeInstanceId: "memory.group1",
        instanceIds: ["memory.group1"]
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
    },
    viewStateByInstance: {},
    contributionState: {}
  };
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
