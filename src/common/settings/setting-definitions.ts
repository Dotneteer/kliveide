import {
  SETTING_EMU_FAST_LOAD,
  SETTING_EMU_KEYBOARD_LAYOUT,
  SETTING_EMU_SHOW_INSTANT_SCREEN,
  SETTING_EMU_SHOW_KEYBOARD,
  SETTING_EMU_SHOW_STATUS_BAR,
  SETTING_EMU_SHOW_TOOLBAR,
  SETTING_EMU_STAY_ON_TOP,
  SETTING_IDE_ACTIVE_TOOL,
  SETTING_IDE_CLOSE_EMU,
  SETTING_EDITOR_FONT_SIZE,
  SETTING_IDE_MAXIMIZE_TOOLS,
  SETTING_IDE_OPEN_LAST_PROJECT,
  SETTING_IDE_SHOW_SIDEBAR,
  SETTING_IDE_SHOW_STATUS_BAR,
  SETTING_IDE_SHOW_TOOLBAR,
  SETTING_IDE_SHOW_TOOLS,
  SETTING_IDE_SIDEBAR_TO_RIGHT,
  SETTING_IDE_SIDEBAR_WIDTH,
  SETTING_IDE_SYNC_BREAKPOINTS,
  SETTING_IDE_TOOLPANEL_HEIGHT,
  SETTING_IDE_TOOLS_ON_TOP,
  SETTING_EDITOR_AUTOCOMPLETE,
  SETTING_EDITOR_TABSIZE,
  SETTING_EDITOR_INSERT_SPACES,
  SETTING_EDITOR_RENDER_WHITESPACE,
  SETTING_EDITOR_DETECT_INDENTATION,
  SETTING_EDITOR_SELECTION_HIGHLIGHT,
  SETTING_EDITOR_OCCURRENCES_HIGHLIGHT,
  SETTING_EMU_KEYBOARD_HEIGHT,
  SETTING_EDITOR_QUICK_SUGGESTION_DELAY,
  SETTING_EDITOR_ALLOW_BACKGROUND_COMPILE,
  SETTING_EMU_SOUND_MUTED
} from "./setting-const";
import { SettingDescription } from "../abstractions/SettingDescription";

const settingDefinitions: SettingDescription[] = [
  {
    id: SETTING_EMU_SHOW_TOOLBAR,
    title: "Show the Toolbar",
    description: "Show or hide the toolbar in the Emulator view.",
    type: "boolean",
    defaultValue: true,
    saveWithIde: true,
    boundTo: "emu"
  },
  {
    id: SETTING_EMU_SHOW_STATUS_BAR,
    title: "Show the Status Bar",
    description: "Show or hide the status bar in the Emulator view.",
    type: "boolean",
    defaultValue: true,
    saveWithIde: true,
    boundTo: "emu"
  },
  {
    id: SETTING_EMU_SHOW_KEYBOARD,
    title: "Show the Virtual Keyboard",
    description: "Show or hide the virtual keyboard in the Emulator view.",
    type: "boolean",
    defaultValue: false,
    saveWithIde: true,
    boundTo: "emu"
  },
  {
    id: SETTING_EMU_SHOW_INSTANT_SCREEN,
    title: "Show the Instant Screen",
    description: "Show or hide the instant screen in the Emulator view.",
    type: "boolean",
    defaultValue: false,
    saveWithIde: true,
    boundTo: "emu"
  },
  {
    id: SETTING_EMU_FAST_LOAD,
    title: "Fast load",
    description: "Allows the emulator fast tape load mode.",
    type: "boolean",
    defaultValue: true,
    saveWithIde: true,
    boundTo: "emu"
  },
  {
    id: SETTING_EMU_SOUND_MUTED,
    title: "Mute/Unmute Sound",
    description: "Allows the emulator sound to be muted or unmuted.",
    type: "boolean",
    defaultValue: true,
    saveWithIde: true,
    boundTo: "emu"
  },
  {
    id: SETTING_EMU_STAY_ON_TOP,
    title: "Keep Emulator on Top",
    description: "Allows the emulator to stay on top of other windows.",
    type: "boolean",
    defaultValue: true,
    saveWithIde: true,
    boundTo: "emu"
  },
  {
    id: SETTING_EMU_KEYBOARD_LAYOUT,
    title: "Keyboard Layout",
    description: "Keyboard layout for the emulator.",
    type: "string",
    defaultValue: "uk",
    saveWithIde: true,
    boundTo: "emu"
  },
  {
    id: SETTING_EMU_KEYBOARD_HEIGHT,
    title: "(keyboard height)",
    type: "string",
    defaultValue: "33%",
    saveWithIde: true,
    volatile: true
  },
  {
    id: SETTING_IDE_SHOW_TOOLBAR,
    title: "Show the Toolbar",
    description: "Show or hide the toolbar in the IDE view.",
    type: "boolean",
    defaultValue: true,
    saveWithIde: true,
    boundTo: "ide"
  },
  {
    id: SETTING_IDE_SHOW_STATUS_BAR,
    title: "Show the Status Bar",
    description: "Show or hide the status bar in the IDE view.",
    type: "boolean",
    defaultValue: true,
    saveWithIde: true,
    boundTo: "ide"
  },
  {
    id: SETTING_IDE_SHOW_SIDEBAR,
    title: "Show the Sidebar",
    description: "Show or hide the sidebar in the IDE view.",
    type: "boolean",
    defaultValue: true,
    saveWithIde: true,
    boundTo: "ide"
  },
  {
    id: SETTING_IDE_SIDEBAR_TO_RIGHT,
    title: "Move the Sidebar to the Right",
    description: "Moves the sidebar to the right side of the IDE view.",
    type: "boolean",
    defaultValue: false,
    saveWithIde: true,
    boundTo: "ide"
  },
  {
    id: SETTING_IDE_SHOW_TOOLS,
    title: "Show Command and Output",
    description: "Displays the command and output panels in the IDE view.",
    type: "boolean",
    defaultValue: true,
    saveWithIde: true,
    boundTo: "ide"
  },
  {
    id: SETTING_IDE_TOOLS_ON_TOP,
    title: "Move Commands and Output to the top",
    description: "Moves the command and output panels to the top of the IDE view.",
    type: "boolean",
    defaultValue: false,
    saveWithIde: true,
    boundTo: "ide"
  },
  {
    id: SETTING_IDE_MAXIMIZE_TOOLS,
    title: "Maximize Commands and Output",
    description: "Maximizes the command and output panels in the IDE view.",
    type: "boolean",
    defaultValue: false,
    saveWithIde: true,
    boundTo: "ide"
  },
  {
    id: SETTING_IDE_SYNC_BREAKPOINTS,
    title: "Sync the Source with the Current Breakpoint",
    description: "Sync the source with the current breakpoint in the IDE view.",
    type: "boolean",
    defaultValue: false,
    saveWithIde: true,
    boundTo: "ide"
  },
  {
    id: SETTING_IDE_SIDEBAR_WIDTH,
    title: "(Sidebar width)",
    type: "string",
    defaultValue: "25%",
    saveWithIde: true,
    volatile: true
  },
  {
    id: SETTING_IDE_TOOLPANEL_HEIGHT,
    title: "(Toolpanel height)",
    type: "string",
    defaultValue: "33%",
    saveWithIde: true,
    volatile: true
  },
  {
    id: SETTING_IDE_ACTIVE_TOOL,
    title: "(active tool)",
    type: "string",
    defaultValue: "commands",
    saveWithIde: true,
    volatile: true
  },
  {
    id: SETTING_IDE_OPEN_LAST_PROJECT,
    title: "Open the last project at startup",
    type: "boolean",
    defaultValue: true,
    saveWithIde: true,
    boundTo: "ide"
  },
  {
    id: SETTING_IDE_CLOSE_EMU,
    title: "Close Emulator when IDE is closed",
    type: "boolean",
    defaultValue: true,
    saveWithIde: true,
    boundTo: "ide"
  },
  {
    id: SETTING_EDITOR_FONT_SIZE,
    title: "Font Size",
    description: "Font size for the editor.",
    type: "number",
    defaultValue: 16,
    saveWithIde: true,
  },
  {
    id: SETTING_EDITOR_AUTOCOMPLETE,
    title: "Enable AutoComplete",
    description: "Enable or disable the auto-complete feature in the editor.",
    type: "boolean",
    defaultValue: false,
    saveWithIde: true,
  },
  {
    id: SETTING_EDITOR_TABSIZE,
    title: "Tab size",
    description: "Number of spaces per tab in the editor.",
    type: "number",
    defaultValue: 4,
    saveWithIde: true,
  },
  {
    id: SETTING_EDITOR_INSERT_SPACES,
    title: "Insert Spaces Instead of Tabs",
    description: "Use spaces instead of tabs for indentation.",
    type: "boolean",
    defaultValue: true,
    saveWithIde: true,
  },
  {
    id: SETTING_EDITOR_RENDER_WHITESPACE,
    title: "Render whitespace characters",
    description: "Render whitespace characters in the editor.",
    type: "string",
    defaultValue: "none",
    saveWithIde: true,
  },
  {
    id: SETTING_EDITOR_DETECT_INDENTATION,
    title: "Detect Indentation",
    description: "Automatically detect indentation settings.",
    type: "boolean",
    defaultValue: true,
    saveWithIde: true,
  },
  {
    id: SETTING_EDITOR_SELECTION_HIGHLIGHT,
    title: "Enable Selection Highlight",
    description: "Enable or disable the selection highlight feature in the editor.",
    type: "boolean",
    defaultValue: true,
    saveWithIde: true,
  },
  {
    id: SETTING_EDITOR_OCCURRENCES_HIGHLIGHT,
    title: "Enable Occurrences Highlight",
    description: "Enable or disable the occurrences highlight feature in the editor.",
    type: "boolean",
    defaultValue: true,
    saveWithIde: true,
  },
  {
    id: SETTING_EDITOR_QUICK_SUGGESTION_DELAY,
    title: "Quick Suggestion Delay",
    description: "Delay in milliseconds for quick suggestions.",
    type: "number",
    defaultValue: 100,
    saveWithIde: true,
  },
  {
    id: SETTING_EDITOR_ALLOW_BACKGROUND_COMPILE,
    title: "Allow Background Compile",
    description: "Enable or disable background compilation in the editor.",
    type: "boolean",
    defaultValue: false,
    saveWithIde: true,
  }
];

export const KliveGlobalSettings: Record<string, SettingDescription> = settingDefinitions.reduce(
  (acc, setting) => {
    acc[setting.id] = setting;
    return acc;
  },
  {}
);
