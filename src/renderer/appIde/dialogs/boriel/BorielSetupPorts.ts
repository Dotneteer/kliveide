import type {
  BorielInstallResult,
  BorielSetupDecision,
  BorielSetupStatus
} from "@common/messaging/BorielIntegration";
import type { DialogClosePort, FilePickerPort } from "@mvc/dialogs/DialogPorts";

export type BorielSetupDialogResult = "close";

/** The Boriel BASIC half of the main process API, narrowed to what this dialog uses. */
export type BorielServicePort = {
  getStatus(): Promise<BorielSetupStatus>;
  install(folder: string): Promise<BorielInstallResult>;
  useExisting(itemPath: string): Promise<BorielInstallResult>;
  recordDecision(decision: BorielSetupDecision): Promise<void>;
};

/** Everything outside the dialog its controller may touch: the seam the tests fake. */
export type BorielSetupPorts = {
  files: FilePickerPort;
  close: DialogClosePort<BorielSetupDialogResult>;
  service: BorielServicePort;
};

export const BORIEL_INSTALL_FOLDER_SETTINGS_KEY = "borielInstallFolder";
export const BORIEL_EXISTING_FOLDER_SETTINGS_KEY = "borielExistingFolder";
