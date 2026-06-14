import { createMetadata, wrapComponent } from "xmlui";
import type { ComponentMetadata } from "xmlui";
import { SideBarPanelStackReact } from "./SideBarPanelStackReact";

const COMP = "SideBarPanelStack";

export const SideBarPanelStackMd: ComponentMetadata = createMetadata({
  status: "experimental",
  description: "Arranges IDE side bar panels with VS Code-like expansion and vertical resizing.",
  props: {
    minPanelSize: {
      description: "Minimum height of an expanded panel while resizing.",
      valueType: "number",
      defaultValue: 120
    }
  },
  events: {}
});

export const sideBarPanelStackComponentRenderer = wrapComponent(
  COMP,
  SideBarPanelStackReact,
  SideBarPanelStackMd
);
