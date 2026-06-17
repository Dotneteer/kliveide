import { createMetadata, wrapComponent } from "xmlui";
import type { ComponentMetadata } from "xmlui";
import { PanelRuntimeReact } from "./PanelRuntimeReact";

const COMP = "PanelRuntime";

export const PanelRuntimeMd: ComponentMetadata = createMetadata({
  status: "experimental",
  description: "Exposes runtime metadata and temporary per-panel state APIs to panel UDCs.",
  props: {
    contributionId: {
      description: "The registered panel contribution identifier.",
      valueType: "string",
      isRequired: true
    },
    instanceId: {
      description: "The concrete panel instance identifier.",
      valueType: "string",
      isRequired: true
    },
    placement: {
      description: "The IDE location where the panel is rendered.",
      valueType: "string",
      availableValues: ["primarySideBar", "secondarySideBar", "document", "toolArea"],
      isRequired: true
    },
    activityId: {
      description: "The activity identifier when the panel belongs to an activity.",
      valueType: "string"
    },
    groupId: {
      description: "The document or tool group identifier, when relevant.",
      valueType: "string"
    },
    chrome: {
      description: "The chrome variant used by the panel host.",
      valueType: "string",
      availableValues: ["sideBar", "document", "tool", "compact"],
      defaultValue: "sideBar"
    },
    readonly: {
      description: "Indicates that the panel should avoid editing commands.",
      valueType: "boolean",
      defaultValue: false
    }
  },
  apis: {
    getState: {
      description: "Reads per-instance panel state.",
      signature: "getState(key: string, defaultValue?: any): any"
    },
    setState: {
      description: "Writes a per-instance panel state value.",
      signature: "setState(key: string, value: any): PanelRuntimeValue"
    },
    patchState: {
      description: "Merges multiple per-instance panel state values.",
      signature: "patchState(patch: Record<string, any>): PanelRuntimeValue"
    },
    getGlobalState: {
      description: "Reads contribution-level panel state.",
      signature: "getGlobalState(key: string, defaultValue?: any): any"
    },
    setGlobalState: {
      description: "Writes a contribution-level panel state value.",
      signature: "setGlobalState(key: string, value: any): PanelRuntimeValue"
    }
  },
  nonVisual: true
});

export const panelRuntimeComponentRenderer = wrapComponent(
  COMP,
  PanelRuntimeReact,
  PanelRuntimeMd,
  {
    exposeRegisterApi: true,
    stateful: true
  }
);
