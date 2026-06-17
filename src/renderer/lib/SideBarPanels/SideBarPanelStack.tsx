import { createMetadata, parseScssVar, wrapComponent } from "xmlui";
import type { ComponentMetadata } from "xmlui";
import { SideBarPanelStackReact } from "./SideBarPanelStackReact";
import styles from "./SideBarPanels.module.scss";

const COMP = "SideBarPanelStack";

export const SideBarPanelStackMd: ComponentMetadata = createMetadata({
  status: "experimental",
  description: "Arranges IDE side bar panels with VS Code-like expansion and vertical resizing.",
  props: {
    minPanelSize: {
      description: "Minimum height of an expanded panel while resizing.",
      valueType: "number",
      defaultValue: 120
    },
    placement: {
      description: "Panel placement used as a drag/drop target.",
      valueType: "string",
      availableValues: ["primarySideBar", "secondarySideBar", "document", "toolArea"]
    },
    activity: {
      description: "Activity identifier used when dropping into the primary side bar.",
      valueType: "string"
    }
  },
  events: {},
  themeVars: parseScssVar(styles.themeVars),
  defaultThemeVars: {
    [`backgroundColor-dropIndicator-${COMP}`]: "$borderColor-active-Tabs",
    [`boxShadow-dropIndicator-${COMP}`]: "0 0 0 1px $borderColor-active-Tabs",
    [`height-dropIndicator-${COMP}`]: "3px",
    [`zIndex-dropIndicator-${COMP}`]: "50"
  }
});

export const sideBarPanelStackComponentRenderer = wrapComponent(
  COMP,
  SideBarPanelStackReact,
  SideBarPanelStackMd
);
