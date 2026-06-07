import type { ThemeDefinition } from "xmlui";

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
    "backgroundColor-resizer-Splitter": "#007acc",
    "backgroundColor-KeyboardArea": "$color-surface-0",

    "backgroundColor-ActivityBar": "$color-surface-200",
    "backgroundColor-SideBar": "$color-surface-100",
    "backgroundColor-DocumentsPanel": "$color-surface-50",
    "backgroundColor-ToolsArea": "$color-surface-0",
  },
  resources: {},
};

export default KliveTheme;
