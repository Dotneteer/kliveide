import { createMetadata, parseScssVar, wrapComponent } from "xmlui";
import type { ComponentMetadata } from "xmlui";
import { EmulatorPanelReact } from "./EmulatorPanelReact";
import styles from "./EmulatorPanel.module.scss";

const COMP = "EmulatorPanel";

export const EmulatorPanelMd: ComponentMetadata = createMetadata({
  status: "experimental",
  description: "Displays the current emulator machine panel.",
  props: {},
  events: {},
  themeVars: parseScssVar(styles.themeVars),
  defaultThemeVars: {
    [`backgroundColor-${COMP}`]: "$color-surface-500",
    [`backgroundColor-display-${COMP}`]: "$color-surface-500",
    [`color-error-${COMP}`]: "#ffb4a8"
  }
});

export const emulatorPanelComponentRenderer = wrapComponent(
  COMP,
  EmulatorPanelReact,
  EmulatorPanelMd
);
