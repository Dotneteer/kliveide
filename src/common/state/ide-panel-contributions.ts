import type { PanelPlacement } from "./ide-panel-layout-state";

export type PanelContribution = {
  id: string;
  title: string;
  icon: string;
  rendererId: string;
  defaultPlacement?: PanelPlacement;
  defaultActivityId?: string;
  allowSideBar?: boolean;
  allowDocument?: boolean;
  allowToolArea?: boolean;
  allowMultipleDocumentInstances?: boolean;
  defaultSize?: number;
  initiallyExpanded?: boolean;
};

export const idePanelContributions = [
  {
    id: "explorerProject",
    title: "Klive Project",
    icon: "files",
    rendererId: "explorerProject",
    defaultPlacement: "primarySideBar",
    defaultActivityId: "explorer",
    allowSideBar: true,
    defaultSize: 1000,
    initiallyExpanded: true
  },
  {
    id: "z80Cpu",
    title: "Z80 CPU",
    icon: "debug-alt",
    rendererId: "z80Cpu",
    defaultPlacement: "primarySideBar",
    defaultActivityId: "debug",
    allowSideBar: true,
    allowDocument: true,
    allowToolArea: true,
    defaultSize: 260,
    initiallyExpanded: true
  },
  {
    id: "callStack",
    title: "Call Stack",
    icon: "debug-current",
    rendererId: "callStack",
    defaultPlacement: "primarySideBar",
    defaultActivityId: "debug",
    allowSideBar: true,
    defaultSize: 500,
    initiallyExpanded: false
  },
  {
    id: "ulaIo",
    title: "ULA & I/O",
    icon: "chip",
    rendererId: "ulaIo",
    defaultPlacement: "primarySideBar",
    defaultActivityId: "debug",
    allowSideBar: true,
    defaultSize: 500,
    initiallyExpanded: false
  },
  {
    id: "watch",
    title: "Watch",
    icon: "eyeglass",
    rendererId: "watch",
    defaultPlacement: "primarySideBar",
    defaultActivityId: "debug",
    allowSideBar: true,
    allowDocument: true,
    allowToolArea: true,
    defaultSize: 500,
    initiallyExpanded: true
  },
  {
    id: "breakpoints",
    title: "Breakpoints",
    icon: "bp-exec",
    rendererId: "breakpoints",
    defaultPlacement: "primarySideBar",
    defaultActivityId: "debug",
    allowSideBar: true,
    allowDocument: true,
    allowToolArea: true,
    defaultSize: 500,
    initiallyExpanded: true
  },
  {
    id: "systemVariables",
    title: "System Variables",
    icon: "symbol-field",
    rendererId: "machineStatus",
    defaultPlacement: "primarySideBar",
    defaultActivityId: "machine",
    allowSideBar: true,
    defaultSize: 260,
    initiallyExpanded: false
  },
  {
    id: "psg",
    title: "PSG (AY-3-8912)",
    icon: "chip",
    rendererId: "psg",
    defaultPlacement: "primarySideBar",
    defaultActivityId: "machine",
    allowSideBar: true,
    defaultSize: 500,
    initiallyExpanded: false
  },
  {
    id: "scriptingHistory",
    title: "Scripting History",
    icon: "tools",
    rendererId: "scriptingHistory",
    defaultPlacement: "primarySideBar",
    defaultActivityId: "scripting",
    allowSideBar: true,
    allowDocument: true,
    allowToolArea: true,
    defaultSize: 500,
    initiallyExpanded: true
  },
  {
    id: "testingTests",
    title: "Tests",
    icon: "beaker",
    rendererId: "testingTests",
    defaultPlacement: "primarySideBar",
    defaultActivityId: "testing",
    allowSideBar: true,
    defaultSize: 1000,
    initiallyExpanded: true
  },
  {
    id: "outline",
    title: "Outline",
    icon: "layers",
    rendererId: "outline",
    defaultPlacement: "secondarySideBar",
    allowSideBar: true,
    defaultSize: 520,
    initiallyExpanded: true
  },
  {
    id: "memory",
    title: "Memory",
    icon: "memory-icon",
    rendererId: "memory",
    defaultPlacement: "secondarySideBar",
    allowSideBar: true,
    allowDocument: true,
    allowToolArea: true,
    allowMultipleDocumentInstances: true,
    defaultSize: 520,
    initiallyExpanded: true
  },
  {
    id: "commands",
    title: "Commands",
    icon: "play",
    rendererId: "commands",
    defaultPlacement: "toolArea",
    allowSideBar: true,
    allowDocument: true,
    allowToolArea: true,
    defaultSize: 500,
    initiallyExpanded: true
  },
  {
    id: "output",
    title: "Output",
    icon: "output",
    rendererId: "output",
    defaultPlacement: "toolArea",
    allowSideBar: true,
    allowDocument: true,
    allowToolArea: true,
    defaultSize: 500,
    initiallyExpanded: true
  }
] satisfies PanelContribution[];

const contributionsById = new Map(idePanelContributions.map((panel) => [panel.id, panel]));
const contributionsByRendererId = new Map(
  idePanelContributions.map((panel) => [panel.rendererId, panel])
);

export function getIdePanelContribution(id: string): PanelContribution | undefined {
  return contributionsById.get(id);
}

export function getIdePanelContributionByRendererId(
  rendererId: string
): PanelContribution | undefined {
  return contributionsByRendererId.get(rendererId);
}

export function canPlacePanelContribution(
  contributionId: string,
  placement: PanelPlacement
): boolean {
  const contribution = getIdePanelContribution(contributionId);
  if (!contribution) {
    return false;
  }

  switch (placement) {
    case "primarySideBar":
    case "secondarySideBar":
      return contribution.allowSideBar === true;
    case "document":
      return contribution.allowDocument === true;
    case "toolArea":
      return contribution.allowToolArea === true;
  }
}
