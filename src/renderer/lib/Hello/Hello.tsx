import styles from "./Hello.module.scss";

import { wrapComponent, createMetadata, parseScssVar } from "xmlui";
import type { ComponentMetadata } from "xmlui";
import { HelloReact } from "./HelloReact";

const COMP = "Hello";

export const HelloMd: ComponentMetadata = createMetadata({
  status: "experimental",
  description: "A Hello Text",
  props: {
  },
  events: {
  },
  themeVars: parseScssVar(styles.themeVars),
  defaultThemeVars: {
    [`textColor-${COMP}`]: "$color-primary-500",
  },
});

export const helloComponentRenderer = wrapComponent(COMP, HelloReact, HelloMd);
