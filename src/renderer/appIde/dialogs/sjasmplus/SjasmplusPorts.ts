import type {
  SjasmplusIntegrationApplyRequest,
  SjasmplusProbeResult,
  SjasmplusReleaseDownloadRequest,
  SjasmplusReleaseDownloadResult,
  SjasmplusReleaseListRequest,
  SjasmplusReleaseListResult
} from "@common/messaging/SjasmplusIntegration";
import type { ConfirmPort, DialogClosePort, FilePickerPort } from "@mvc/dialogs/DialogPorts";

export type SjasmplusIntegrationDialogResult = "close";

// --- The SJASMPLUS half of the main process API, narrowed to what this dialog
// --- uses. Narrow because a fake has to implement all of it.
export type SjasmplusServicePort = {
  probePath(path: string): Promise<SjasmplusProbeResult>;
  getPathSuggestions(): Promise<SjasmplusProbeResult[]>;
  listReleases(request: SjasmplusReleaseListRequest): Promise<SjasmplusReleaseListResult>;
  downloadRelease(
    request: SjasmplusReleaseDownloadRequest
  ): Promise<SjasmplusReleaseDownloadResult>;
  validateExecutable(executablePath: string): Promise<SjasmplusProbeResult>;
  apply(request: SjasmplusIntegrationApplyRequest): Promise<void>;
};

/**
 * Everything outside the SJASMPLUS dialog that its controller may touch. This
 * is the seam the tests fake: with it, the whole dialog runs headless.
 */
export type SjasmplusPorts = {
  files: FilePickerPort;
  confirm: ConfirmPort;
  close: DialogClosePort<SjasmplusIntegrationDialogResult>;
  service: SjasmplusServicePort;
};

export const SJASMPLUS_EXECUTABLE_FILTERS = [
  { name: "SJASMPLUS executable", extensions: ["exe", "*"] }
];

export const SJASMPLUS_EXECUTABLE_SETTINGS_KEY = "sjasmplusExecutable";
export const SJASMPLUS_DOWNLOAD_FOLDER_SETTINGS_KEY = "sjasmplusDownloadFolder";
