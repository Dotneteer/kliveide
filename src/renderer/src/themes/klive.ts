import type { ThemeDefinition } from "xmlui";

const kliveShellFontFamily =
  "-apple-system, BlinkMacSystemFont, Helvetica, Neue-Light, Ubuntu, Droid Sans, sans-serif";

const sp48KeyboardFontThemeVars = {
  "fontFamily-EmuKeyboard": kliveShellFontFamily,
  "fontSize-mainKey-EmuKeyboard": "36px",
  "fontSize-keywordKey-EmuKeyboard": "22px",
  "fontSize-symbolKey-EmuKeyboard": "28px",
  "fontSize-topSymbolKey-EmuKeyboard": "24px",
  "fontSize-symbolWordKey-EmuKeyboard": "18px",
  "fontSize-aboveKey-EmuKeyboard": "20px",
  "fontSize-belowKey-EmuKeyboard": "20px",
  "fontSize-centerKey-EmuKeyboard": "28px",
  "fontSize-shiftKey-EmuKeyboard": "20px",
  "fontSize-topNumberKey-EmuKeyboard": "20px",
};

export const KliveTheme: ThemeDefinition = {
  id: "klive-theme",
  name: "Klive IDE Theme",
  extends: "xmlui",
  color: "$color-primary-500",
  themeVars: {
    // --- Surface colors
    "const-color-surface-50": "hsl(0, 0%, 98%)",
    "const-color-surface-100": "hsl(0, 0%, 95%)",
    "const-color-surface-200": "hsl(0, 0%, 83%)",
    "const-color-surface-300": "hsl(0, 0%, 75%)",
    "const-color-surface-400": "hsl(0, 0%, 63%)",
    "const-color-surface-500": "hsl(0, 0%, 70%)", // #B2B2B2
    "const-color-surface-600": "hsl(0, 0%, 60%)",
    "const-color-surface-700": "hsl(0, 0%, 50%)",
    "const-color-surface-800": "hsl(0, 0%, 40%)",
    "const-color-surface-900": "hsl(0, 0%, 30%)",
    "const-color-surface-950": "hsl(0, 0%, 20%)",
    "const-color-surface": "$const-color-surface-500",

    "backgroundColor-Toolbar": "$color-surface-50",
    "backgroundColor-EmuStatusBar": "#007acc",
    "backgroundColor-IdeStatusBar": "#007acc",
    "textColor-EmuStatusBar": "#ffffff",
    "textColor-IdeStatusBar": "#ffffff",
    "backgroundColor-resizer-Splitter": "#007acc",
    "backgroundColor-KeyboardArea": "$color-surface-0",
    "backgroundColor-EmulatorPanel": "$color-surface-100",
    "backgroundColor-display-EmulatorPanel": "$color-surface-50",
    "color-error-EmulatorPanel": "#ffb4a8",
    "padding-EmuKeyboard": "$space-3",
    "backgroundColor-EmuKeyboard": "#181818",
    "backgroundColor-key-EmuKeyboard": "#707070",
    "backgroundColor-highlightedKey-EmuKeyboard": "#0B486B",
    "color-mainKey-EmuKeyboard": "#e0e0e0",
    "color-symbolKey-EmuKeyboard": "#c00000",
    "color-aboveKey-EmuKeyboard": "#00a000",
    "color-belowKey-EmuKeyboard": "#d02000",
    "color-highlightKey-EmuKeyboard": "#0048c0",
    ...sp48KeyboardFontThemeVars,

    "backgroundColor-ActivityBar": "$color-surface-200",
    "backgroundColor-SideBar": "$color-surface-100",
    "backgroundColor-DocumentsPanel": "$color-surface-50",
    "backgroundColor-ToolsArea": "$color-surface-0",
  },
  resources: {},
};

export default KliveTheme;
