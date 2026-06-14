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
  const instances = [
    panel("explorerProject", "explorerProject", "explorerProject", "primarySideBar", 0, {
      activityId: "explorer",
      expanded: true,
      size: 1000
    }),
    panel("z80Cpu", "z80Cpu", "z80Cpu", "primarySideBar", 0, {
      activityId: "debug",
      expanded: true,
      size: 260
    }),
    panel("callStack", "callStack", "callStack", "primarySideBar", 1, {
      activityId: "debug",
      expanded: false,
      size: 500
    }),
    panel("ulaIo", "ulaIo", "ulaIo", "primarySideBar", 2, {
      activityId: "debug",
      expanded: false,
      size: 500
    }),
    panel("watch", "watch", "watch", "primarySideBar", 3, {
      activityId: "debug",
      expanded: true,
      size: 500
    }),
    panel("breakpoints", "breakpoints", "breakpoints", "primarySideBar", 4, {
      activityId: "debug",
      expanded: true,
      size: 500
    }),
    panel("systemVariables", "systemVariables", "machineStatus", "primarySideBar", 0, {
      activityId: "machine",
      expanded: false,
      size: 260
    }),
    panel("psg", "psg", "psg", "primarySideBar", 1, {
      activityId: "machine",
      expanded: false,
      size: 500
    }),
    panel("scriptingHistory", "scriptingHistory", "scriptingHistory", "primarySideBar", 0, {
      activityId: "scripting",
      expanded: true,
      size: 500
    }),
    panel("testingTests", "testingTests", "testingTests", "primarySideBar", 0, {
      activityId: "testing",
      expanded: true,
      size: 1000
    }),
    panel("outline", "outline", "outline", "secondarySideBar", 0, {
      expanded: true,
      size: 520
    }),
    panel("memory", "memory", "memory", "secondarySideBar", 1, {
      expanded: true,
      size: 520
    }),
    panel("memory.group1", "memory", "memory", "document", 1, {
      groupId: "group1",
      expanded: true
    }),
    panel("memory.group2", "memory", "memory", "document", 1, {
      groupId: "group2",
      expanded: true
    }),
    panel("commands", "commands", "commands", "toolArea", 0, {
      expanded: true
    }),
    panel("output", "output", "output", "toolArea", 1, {
      expanded: true
    })
  ];

  return {
    instances: Object.fromEntries(instances.map((instance) => [instance.instanceId, instance])),
    primarySideBarByActivity: {
      explorer: ["explorerProject"],
      debug: ["z80Cpu", "callStack", "ulaIo", "watch", "breakpoints"],
      machine: ["systemVariables", "psg"],
      scripting: ["scriptingHistory"],
      testing: ["testingTests"]
    },
    secondarySideBar: ["outline", "memory"],
    toolArea: ["commands", "output"],
    documentGroups: {
      group1: {
        activeInstanceId: "memory.group1",
        instanceIds: ["memory.group1"]
      },
      group2: {
        activeInstanceId: "memory.group2",
        instanceIds: ["memory.group2"]
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
