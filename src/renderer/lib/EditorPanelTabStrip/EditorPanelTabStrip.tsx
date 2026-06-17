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
    }
  },
  events: {},
  themeVars: parseScssVar(styles.themeVars),
  defaultThemeVars: {
    [`backgroundColor-${COMP}`]: "$backgroundColor-DocumentTabStrip",
    [`backgroundColor-tab-${COMP}`]: "$backgroundColor-DocumentTab",
    [`backgroundColor-tab-${COMP}--active`]: "$backgroundColor-DocumentTab--active",
    [`backgroundColor-dropIndicator-${COMP}`]: "$borderColor-active-Tabs",
    [`borderColor-${COMP}`]: "$borderColor-DocumentTab",
    [`textColor-tab-${COMP}`]: "$textColor-DocumentTab",
    [`textColor-tab-${COMP}--active`]: "$textColor-DocumentTab--active",
    [`height-dropIndicator-${COMP}`]: "3px",
    [`zIndex-dropIndicator-${COMP}`]: "60"
  }
});

export const editorPanelTabStripComponentRenderer = wrapComponent(
  COMP,
  EditorPanelTabStripReact,
  EditorPanelTabStripMd
);
