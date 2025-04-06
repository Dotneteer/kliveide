import { Setting } from "@abstractions/Setting";
import { SETTING_EMU_FAST_LOAD, SETTING_EMU_SHOW_INSTANT_SCREEN, SETTING_EMU_SHOW_KEYBOARD, SETTING_EMU_SHOW_STATUS_BAR, SETTING_EMU_SHOW_TOOLBAR, SETTING_EMU_STAY_ON_TOP, SETTING_IDE_MAXIMIZE_TOOLS, SETTING_IDE_SHOW_SIDEBAR, SETTING_IDE_SHOW_STATUS_BAR, SETTING_IDE_SHOW_TOOLBAR, SETTING_IDE_SHOW_TOOLS, SETTING_IDE_SIDEBAR_TO_RIGHT, SETTING_IDE_SIDEBAR_WIDHT as SETTING_IDE_SIDEBAR_WIDTH, SETTING_IDE_SYNC_BREAKPOINTS, SETTING_IDE_TOOLPANEL_HEIGHT, SETTING_IDE_TOOLS_ON_TOP } from "@common/settings/setting-const";

const settingDefinitions: Setting[] = [
  {
    id: SETTING_EMU_SHOW_TOOLBAR,
    title: "Show the Toolbar",
    description: "Show or hide the toolbar in the Emulator view.",
    type: "boolean",
    defaultValue: true,
    saveWithIde: true,
    saveWithProject: true,
    boundTo: "emu"
  },
  {
    id: SETTING_EMU_SHOW_STATUS_BAR,
    title: "Show the Status Bar",
    description: "Show or hide the status bar in the Emulator view.",
    type: "boolean",
    defaultValue: true,
    saveWithIde: true,
    saveWithProject: true,
    boundTo: "emu"
  },
  {
    id: SETTING_EMU_SHOW_KEYBOARD,
    title: "Show the Virtual Keyboard",
    description: "Show or hide the virtual keyboard in the Emulator view.",
    type: "boolean",
    defaultValue: false,
    saveWithIde: true,
    saveWithProject: true,
    boundTo: "emu"
  },
  {
    id: SETTING_EMU_SHOW_INSTANT_SCREEN,
    title: "Show the Instant Screen",
    description: "Show or hide the instant screen in the Emulator view.",
    type: "boolean",
    defaultValue: false,
    saveWithIde: true,
    saveWithProject: true,
    boundTo: "emu"
  },
  {
    id: SETTING_EMU_FAST_LOAD,
    title: "Fast load",
    description: "Allows the emulator fast tape load mode.",
    type: "boolean",
    defaultValue: true,
    saveWithIde: true,
    saveWithProject: true,
    boundTo: "emu"
  },
  {
    id: SETTING_EMU_STAY_ON_TOP,
    title: "Keep Emulator on Top",
    description: "Allows the emulator to stay on top of other windows.",
    type: "boolean",
    defaultValue: true,
    saveWithIde: true,
    saveWithProject: true,
    boundTo: "emu"
  },
  {
    id: SETTING_IDE_SHOW_TOOLBAR,
    title: "Show the Toolbar",
    description: "Show or hide the toolbar in the IDE view.",
    type: "boolean",
    defaultValue: true,
    saveWithIde: true,
    saveWithProject: true,
    boundTo: "ide"
  },
  {
    id: SETTING_IDE_SHOW_STATUS_BAR,
    title: "Show the Status Bar",
    description: "Show or hide the status bar in the IDE view.",
    type: "boolean",
    defaultValue: true,
    saveWithIde: true,
    saveWithProject: true,
    boundTo: "ide"
  },
  {
    id: SETTING_IDE_SHOW_SIDEBAR,
    title: "Show the Sidebar",
    description: "Show or hide the sidebar in the IDE view.",
    type: "boolean",
    defaultValue: true,
    saveWithIde: true,
    saveWithProject: true,
    boundTo: "ide"
  },
  {
    id: SETTING_IDE_SIDEBAR_TO_RIGHT,
    title: "Move the Sidebar to the Right",
    description: "Moves the sidebar to the right side of the IDE view.",
    type: "boolean",
    defaultValue: false,
    saveWithIde: true,
    saveWithProject: true,
    boundTo: "ide"
  },
  {
    id: SETTING_IDE_SHOW_TOOLS,
    title: "Show Command and Output",
    description: "Displays the command and output panels in the IDE view.",
    type: "boolean",
    defaultValue: true,
    saveWithIde: true,
    saveWithProject: true,
    boundTo: "ide"
  },
  {
    id: SETTING_IDE_TOOLS_ON_TOP,
    title: "Move Commands and Output to the top",
    description: "Moves the command and output panels to the top of the IDE view.",
    type: "boolean",
    defaultValue: false,
    saveWithIde: true,
    saveWithProject: true,
    boundTo: "ide"
  },
  {
    id: SETTING_IDE_MAXIMIZE_TOOLS,
    title: "Maximize Commands and Output",
    description: "Maximizes the command and output panels in the IDE view.",
    type: "boolean",
    defaultValue: false,
    saveWithIde: true,
    saveWithProject: true,
    boundTo: "ide"
  },
  {
    id: SETTING_IDE_SYNC_BREAKPOINTS,
    title: "Sync the Source with the Current Breakpoint",
    description: "Sync the source with the current breakpoint in the IDE view.",
    type: "boolean",
    defaultValue: false,
    saveWithIde: true,
    saveWithProject: true,
    boundTo: "ide"
  },
  {
    id: SETTING_IDE_SIDEBAR_WIDTH,
    title: "(Sidebar width)",
    type: "string",
    defaultValue: "25%",
    saveWithIde: true,
    saveWithProject: true,
    volatile: true,
  },
  {
    id: SETTING_IDE_TOOLPANEL_HEIGHT,
    title: "(Toolpanel height)",
    type: "string",
    defaultValue: "33%",
    saveWithIde: true,
    saveWithProject: true,
    volatile: true,
  },
];

export const KliveGlobalSettings: Record<string, Setting> = settingDefinitions.reduce(
  (acc, setting) => {
    acc[setting.id] = setting;
    return acc;
  },
  {}
);
