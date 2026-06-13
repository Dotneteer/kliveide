import { createMetadata, parseScssVar, wrapComponent } from "xmlui";
import type { ComponentMetadata } from "xmlui";
import { EmuKeyboardReact } from "./EmuKeyboardReact";
import styles from "./EmuKeyboard.module.scss";

const COMP = "EmuKeyboard";
const SHELL_FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, Helvetica, Neue-Light, Ubuntu, Droid Sans, sans-serif";

export const EmuKeyboardMd: ComponentMetadata = createMetadata({
  status: "experimental",
  description: "Displays the selected emulator virtual keyboard.",
  props: {
    machineType: {
      description: "The machine type whose keyboard should be displayed.",
      valueType: "string",
      defaultValue: "sp48"
    }
  },
  events: {},
  themeVars: parseScssVar(styles.themeVars),
  defaultThemeVars: {
    [`backgroundColor-${COMP}`]: "#181818",
    [`backgroundColor-key-${COMP}`]: "#707070",
    [`backgroundColor-highlightedKey-${COMP}`]: "#0B486B",
    [`color-mainKey-${COMP}`]: "#e0e0e0",
    [`color-symbolKey-${COMP}`]: "#c00000",
    [`color-aboveKey-${COMP}`]: "#00a000",
    [`color-belowKey-${COMP}`]: "#d02000",
    [`color-highlightKey-${COMP}`]: "#0048c0",
    [`fontFamily-${COMP}`]: SHELL_FONT_FAMILY,
    [`fontSize-mainKey-${COMP}`]: "36px",
    [`fontSize-keywordKey-${COMP}`]: "22px",
    [`fontSize-symbolKey-${COMP}`]: "28px",
    [`fontSize-topSymbolKey-${COMP}`]: "24px",
    [`fontSize-symbolWordKey-${COMP}`]: "18px",
    [`fontSize-aboveKey-${COMP}`]: "20px",
    [`fontSize-belowKey-${COMP}`]: "20px",
    [`fontSize-centerKey-${COMP}`]: "28px",
    [`fontSize-shiftKey-${COMP}`]: "20px",
    [`fontSize-topNumberKey-${COMP}`]: "20px",
    [`padding-${COMP}`]: "$space-4"
  }
});

export const emuKeyboardComponentRenderer = wrapComponent(
  COMP,
  EmuKeyboardReact,
  EmuKeyboardMd
);
