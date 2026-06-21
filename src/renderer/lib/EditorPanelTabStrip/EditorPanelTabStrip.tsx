import { createMetadata, parseScssVar, wrapComponent } from "xmlui";
import type { ComponentMetadata } from "xmlui";
import styles from "./EditorPanelTabStrip.module.scss";
import { EditorPanelTabStripReact } from "./EditorPanelTabStripReact";

const COMP = "EditorPanelTabStrip";

export const EditorPanelTabStripMd: ComponentMetadata = createMetadata({
  status: "experimental",
  description: "Renders draggable document-area panel tabs for an editor group.",
  props: {
    groupId: {
      description: "Document group identifier.",
      valueType: "string",
      isRequired: true
    },
    menuRequest: {
      description: "Latest document tab context menu request.",
      valueType: "any"
    }
  },
  events: {},
  themeVars: parseScssVar(styles.themeVars),
  defaultThemeVars: {
    [`backgroundColor-${COMP}`]: "$backgroundColor-DocumentTabStrip",
    [`backgroundColor-tab-${COMP}`]: "$backgroundColor-DocumentTab",
    [`backgroundColor-tab-${COMP}--active`]: "$backgroundColor-DocumentTab--active",
    [`backgroundColor-dropIndicator-${COMP}`]: "$borderColor-active-Tabs",
    [`backgroundColor-menu-${COMP}`]: "$color-surface-0",
    [`backgroundColor-menuItem-${COMP}--hover`]: "$color-surface-100",
    [`borderColor-${COMP}`]: "$borderColor-DocumentTab",
    [`boxShadow-menu-${COMP}`]: "0 8px 24px rgba(0, 0, 0, 0.28)",
    [`textColor-tab-${COMP}`]: "$textColor-DocumentTab",
    [`textColor-tab-${COMP}--active`]: "$textColor-DocumentTab--active",
    [`textColor-menuItem-${COMP}`]: "$color-surface-950",
    [`textColor-menuItem-${COMP}--disabled`]: "$color-surface-600",
    [`height-dropIndicator-${COMP}`]: "3px",
    [`zIndex-dropIndicator-${COMP}`]: "60",
    [`zIndex-menu-${COMP}`]: "300"
  }
});

export const editorPanelTabStripComponentRenderer = wrapComponent(
  COMP,
  EditorPanelTabStripReact,
  EditorPanelTabStripMd
);
