import { createMetadata, wrapComponent } from "xmlui";
import type { ComponentMetadata } from "xmlui";
import { PanelDropTargetReact } from "./PanelDropTargetReact";

const COMP = "PanelDropTarget";

export const PanelDropTargetMd: ComponentMetadata = createMetadata({
  status: "experimental",
  description: "Marks an IDE panel host as a drag/drop target for panel instances.",
  props: {
    placement: {
      description: "Panel placement to move a dropped instance into.",
      valueType: "string",
      availableValues: ["primarySideBar", "secondarySideBar", "document", "toolArea"],
      isRequired: true
    },
    activity: {
      description: "Activity identifier used when dropping into the primary side bar.",
      valueType: "string"
    },
    groupId: {
      description: "Document group identifier used when dropping into a document host.",
      valueType: "string"
    }
  },
  events: {}
});

export const panelDropTargetComponentRenderer = wrapComponent(
  COMP,
  PanelDropTargetReact,
  PanelDropTargetMd
);
