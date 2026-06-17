import { createMetadata, wrapComponent } from "xmlui";
import type { ComponentMetadata } from "xmlui";
import { Z80CpuPanelReact } from "./Z80CpuPanelReact";

const COMP = "Z80CpuPanelView";

export const Z80CpuPanelMd: ComponentMetadata = createMetadata({
  status: "experimental",
  description: "Displays a Z80 CPU register and flag snapshot.",
  props: {
    contributionId: {
      description: "The registered panel contribution identifier.",
      valueType: "string",
      defaultValue: "z80Cpu"
    },
    instanceId: {
      description: "The concrete panel instance identifier.",
      valueType: "string",
      defaultValue: "z80Cpu"
    },
    placement: {
      description: "The IDE location where the panel is rendered.",
      valueType: "string",
      availableValues: ["primarySideBar", "secondarySideBar", "document", "toolArea"],
      defaultValue: "primarySideBar"
    },
    chrome: {
      description: "The chrome variant used by the panel host.",
      valueType: "string",
      availableValues: ["sideBar", "document", "tool", "compact"],
      defaultValue: "compact"
    }
  },
  events: {}
});

export const z80CpuPanelComponentRenderer = wrapComponent(
  COMP,
  Z80CpuPanelReact,
  Z80CpuPanelMd
);
