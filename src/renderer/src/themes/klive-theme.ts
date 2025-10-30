import type { ThemeDefinition } from 'xmlui'

export const theme: ThemeDefinition = {
  name: 'Klive Theme',
  id: 'klive-theme',
  themeVars: {
    // --- Desktop page setup:
    'paddingHorizontal-Pages': '0',
    'paddingVertical-Pages': '0',

    // --- Surface colors:
    'const-color-surface-50': 'hsl(0, 0%, 95%)',
    'const-color-surface-100': 'hsl(0, 0%, 90%)',
    'const-color-surface-200': 'hsl(0, 0%, 80%)',
    'const-color-surface-300': 'hsl(0, 0%, 70%)',
    'const-color-surface-400': 'hsl(0, 0%, 60%)',
    'const-color-surface-500': 'hsl(0, 0%, 50%)',
    'const-color-surface-600': 'hsl(0, 0%, 40%)',
    'const-color-surface-700': 'hsl(0, 0%, 30%)',
    'const-color-surface-800': 'hsl(0, 0%, 20%)',
    'const-color-surface-900': 'hsl(0, 0%, 10%)',
    'const-color-surface-950': 'hsl(0, 0%, 5%)',
    'const-color-surface': '$const-color-surface-500',

    // --- Toolbar:
    'backgroundColor-Toolbar': '$color-surface-200',
    'backgroundColor-Button-toolbarButton--hover': '$color-surface-300',
    'textColor-Button-toolbarButton': '$color-surface-800',
    'textColor-Button-toolbarButton--hover': '$color-surface-1',
    'textColor-Button-toolbarButton--disabled': '$color-surface-600',
    'paddingLeft-Button-toolbarButton': '$space-2',
    'paddingRight-Button-toolbarButton': '$space-2',
    'color-ToolbarSeparator': '$color-surface-400',
    'color-ToolbarButton-green': 'lightgreen',
    'color-ToolbarButton-blue': 'cyan',
    'color-ToolbarButton-orange': 'orange',
    'color-ToolbarButton-red': 'red',


    // --- Tooltip:
    'backgroundColor-Tooltip': '$color-surface-700',
    'textColor-Tooltip': '$color-surface-50',
    'padding-Tooltip': '$space-1',
  }
}

export default theme
