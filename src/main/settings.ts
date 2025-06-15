import { IdeProject } from "@common/state/AppState";
import { KliveGlobalSettings } from "@common/settings/setting-definitions";
import { WindowState } from "@abstractions/WindowState";

export const KLIVE_HOME_FOLDER = "Klive";
export const SETTINGS_FILE_NAME = "klive.settings";

export type ExportDialogSettings = {
  formatId?: string;
  exportName?: string;
  exportFolder?: string;
  programName?: string;
  border?: number;
  screenFilename?: string;
  startBlock?: boolean;
  addClear?: boolean;
  addPause?: boolean;
  singleBlock?: boolean;
  startAddress?: number;
}

export type IdeSettings = {
  disableAutoComplete?: boolean;
}

export type AppSettings = {
  windowStates?: {
    emuWindow?: WindowState;
    ideWindow?: WindowState;
    showIdeOnStartup?: boolean;
    emuZoomFactor?: number;
    ideZoomFactor?: number;
  };
  globalSettings?: typeof KliveGlobalSettings;
  ideSettings?: IdeSettings;
  startScreenDisplayed?: boolean;
  theme?: string;
  machineId?: string;
  modelId?: string;
  config?: Record<string, any>;
  machineSpecific?: Record<string, any>;
  clockMultiplier?: number;
  soundLevel?: number;
  media?: Record<string, any>;
  folders?: Record<string, string>;
  excludedProjectItems?: string[];
  keyMappingFile?: string;
  userSettings?: Record<string, any>;
  project?: IdeProject;
  recentProjects?: string[];
};
