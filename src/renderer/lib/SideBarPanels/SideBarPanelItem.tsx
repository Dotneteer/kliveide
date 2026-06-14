import { createMetadata, wrapComponent } from "xmlui";
import type { ComponentMetadata } from "xmlui";
import { SideBarPanelItemReact } from "./SideBarPanelItemReact";

const COMP = "SideBarPanelItem";

export const SideBarPanelItemMd: ComponentMetadata = createMetadata({
  status: "experimental",
  description: "Carries one IDE side bar panel header and body.",
  props: {
    panelId: {
      description: "Stable panel identifier used for remembered side bar sizing.",
      valueType: "string",
      isRequired: true
    },
    title: {
      description: "Panel title displayed in the header.",
      valueType: "string",
      isRequired: true
    },
    expanded: {
      description: "Indicates whether the panel body is visible.",
      valueType: "boolean",
      defaultValue: false
    },
    initialSize: {
      description: "Initial relative size for expanded panels.",
      valueType: "number",
      defaultValue: 1000
    }
  },
  events: {
    toggle: {
      description: "Fires when the panel header is clicked.",
      signature: "toggle(): void"
    }
  }
});

export const sideBarPanelItemComponentRenderer = wrapComponent(
  COMP,
  SideBarPanelItemReact,
  SideBarPanelItemMd,
  {
    events: { toggle: "onToggle" }
  }
);
