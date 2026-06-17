import { createMetadata, parseScssVar, wrapComponent } from "xmlui";
import type { ComponentMetadata } from "xmlui";
import styles from "./PersistedSizeSplitter.module.scss";
import { PersistedSizeSplitterReact } from "./PersistedSizeSplitterReact";

const COMP = "PersistedSizeSplitter";

export const PersistedSizeSplitterMd: ComponentMetadata = createMetadata({
  status: "experimental",
  description: "Splits two panes while persisting the size of the first child.",
  props: {
    settingId: {
      description: "The persisted setting identifier.",
      valueType: "string",
      isRequired: true
    },
    initialSize: {
      description: "Initial size of the first child.",
      valueType: "string",
      defaultValue: "240px"
    },
    axis: {
      description: "Splitter axis.",
      valueType: "string",
      availableValues: ["horizontal", "vertical"],
      defaultValue: "horizontal"
    },
    sizedPanePosition: {
      description: "Whether the first child is displayed before or after the main pane.",
      valueType: "string",
      availableValues: ["start", "end"],
      defaultValue: "end"
    },
    minSizedPaneSize: {
      description: "Minimum size of the first child in pixels.",
      valueType: "number",
      defaultValue: 160
    },
    minMainPaneSize: {
      description: "Minimum size of the second child in pixels.",
      valueType: "number",
      defaultValue: 360
    }
  },
  events: {},
  themeVars: parseScssVar(styles.themeVars),
  defaultThemeVars: {
    [`backgroundColor-resizer-${COMP}`]: "transparent",
    [`backgroundColor-resizer-${COMP}--active`]: "$borderColor-active-Tabs",
    [`cursor-horizontal-resizer-${COMP}`]: "ew-resize",
    [`cursor-vertical-resizer-${COMP}`]: "ns-resize",
    [`thickness-resizer-${COMP}`]: "5px"
  }
});

export const persistedSizeSplitterComponentRenderer = wrapComponent(
  COMP,
  PersistedSizeSplitterReact,
  PersistedSizeSplitterMd
);
