import { Setting } from "@abstractions/Setting";
import { SETTING_EMU_FAST_LOAD, SETTING_EMU_SHOW_INSTANT_SCREEN, SETTING_EMU_SHOW_KEYBOARD, SETTING_EMU_SHOW_STATUS_BAR, SETTING_EMU_SHOW_TOOLBAR, SETTING_IDE_SHOW_STATUS_BAR, SETTING_IDE_SHOW_TOOLBAR } from "@common/settings/setting-const";

const settingDefinitions: Setting[] = [
  {
    id: SETTING_EMU_SHOW_TOOLBAR,
    title: "Show the Toolbar",
    description: "Show or hide the toolbar in the Emulator view.",
    type: "boolean",
    defaultValue: true,
    saveWithIde: true,
    saveWithProject: true
  },
  {
    id: SETTING_EMU_SHOW_STATUS_BAR,
    title: "Show the Status Bar",
    description: "Show or hide the status bar in the Emulator view.",
    type: "boolean",
    defaultValue: true,
    saveWithIde: true,
    saveWithProject: true
  },
  {
    id: SETTING_EMU_SHOW_KEYBOARD,
    title: "Show the Virtual Keyboard",
    description: "Show or hide the virtual keyboard in the Emulator view.",
    type: "boolean",
    defaultValue: false,
    saveWithIde: true,
    saveWithProject: true
  },
  {
    id: SETTING_EMU_SHOW_INSTANT_SCREEN,
    title: "Show the Instant Screen",
    description: "Show or hide the instant screen in the Emulator view.",
    type: "boolean",
    defaultValue: false,
    saveWithIde: true,
    saveWithProject: true
  },
  {
    id: SETTING_EMU_FAST_LOAD,
    title: "Fast load",
    description: "Allows the emulator fast tape load mode.",
    type: "boolean",
    defaultValue: true,
    saveWithIde: true,
    saveWithProject: true
  },
  {
    id: SETTING_IDE_SHOW_TOOLBAR,
    title: "Show the Toolbar",
    description: "Show or hide the toolbar in the IDE view.",
    type: "boolean",
    defaultValue: true,
    saveWithIde: true,
    saveWithProject: true
  },
  {
    id: SETTING_IDE_SHOW_STATUS_BAR,
    title: "Show the Status Bar",
    description: "Show or hide the status bar in the IDE view.",
    type: "boolean",
    defaultValue: true,
    saveWithIde: true,
    saveWithProject: true
  },
  {
    id: "ideView.primaryBarOnRight",
    title: "Primary Bar on Right",
    description: "Display the primary bar on the right side of the IDE view.",
    type: "boolean",
    defaultValue: false,
    saveWithIde: true,
    saveWithProject: true
  }
];

export const KliveGlobalSettings: Record<string, Setting> = settingDefinitions.reduce(
  (acc, setting) => {
    acc[setting.id] = setting;
    return acc;
  },
  {}
);
