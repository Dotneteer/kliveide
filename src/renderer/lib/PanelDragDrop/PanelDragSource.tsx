import { createMetadata, wrapComponent } from "xmlui";
import type { ComponentMetadata } from "xmlui";
import { PanelDragSourceReact } from "./PanelDragSourceReact";

const COMP = "PanelDragSource";

export const PanelDragSourceMd: ComponentMetadata = createMetadata({
  status: "experimental",
  description: "Makes a rendered IDE panel instance draggable.",
  props: {
    instanceId: {
      description: "Panel instance identifier to put into the drag payload.",
      valueType: "string",
      isRequired: true
    },
    placement: {
      description: "Current source placement.",
      valueType: "string",
      availableValues: ["primarySideBar", "secondarySideBar", "document", "toolArea"]
    },
    groupId: {
      description: "Current document group identifier, when relevant.",
      valueType: "string"
    },
    closeable: {
      description: "Shows a compact close control that closes the panel instance.",
      valueType: "boolean",
      defaultValue: false
    }
  },
  events: {}
});

export const panelDragSourceComponentRenderer = wrapComponent(
  COMP,
  PanelDragSourceReact,
  PanelDragSourceMd
);
