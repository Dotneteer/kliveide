/*
 * What every menu builder reads (`.plans/MENU_REDESIGN_PLAN.md` §7 Phase 1). `setupMenu` creates
 * one per rebuild; the builders read nothing else from the environment, which is what lets the tests
 * build each menu from a hand-made context.
 */
import type { BrowserWindow } from "electron";
import type { AppState } from "@state/AppState";
import type { MachineInfo, MachineMenuInfo, MachineModel } from "@common/machines/info-types";
import type { SettingsPageId } from "@common/settings/settings-pages";
import type { ReverseShortcuts } from "@common/settings/reverse-shortcuts";

export type MenuShortcuts = ReverseShortcuts & {
  fullScreen: string;
  stepInto: string;
  stepOver: string;
  stepOut: string;
  stepOverLine: string;
  navBack: string;
  navForward: string;
  recordIdeEmu: string;
};

export type MenuContext = {
  appState: AppState;
  emuWindow: BrowserWindow;
  ideWindow: BrowserWindow;
  isMac: boolean;
  /** The IDE window has the focus, as the store knows it */
  ideFocus: boolean;
  /** The emulator window has the focus */
  emuWindowFocused: boolean;
  /** The IDE window is shown */
  ideWindowVisible: boolean;
  allowDevTools: boolean;
  currentMachine?: MachineInfo;
  currentModel?: MachineModel;
  machineMenus?: MachineMenuInfo;
  shortcuts: MenuShortcuts;
  /** The window a menu-started dialog belongs to */
  focusedWindow: () => BrowserWindow;
  /** Shows the IDE window (and remembers to show it at the next start) */
  ensureIdeWindow: () => void;
  /** Opens the Settings dialog in the focused window, optionally on one page */
  openSettings: (page?: SettingsPageId) => Promise<void>;
  /** Opens the Select Machine dialog in the focused window */
  openMachineSelector: () => Promise<void>;
  /** Switches the emulator to a machine type */
  selectMachineType: (machineId: string, modelId?: string) => Promise<void>;
};

/** The `windowInfo` argument the machine-specific renderers take */
export function windowInfoOf(context: MenuContext): { emuWindow: BrowserWindow; ideWindow: BrowserWindow } {
  return { emuWindow: context.emuWindow, ideWindow: context.ideWindow };
}
