import type {
  Z88dkDownloadProgress,
  Z88dkIntegrationApplyRequest,
  Z88dkProbeResult,
  Z88dkReleaseDownloadRequest,
  Z88dkReleaseDownloadResult,
  Z88dkReleaseListResult
} from "@common/messaging/Z88dkIntegration";
import type { ConfirmPort, DialogClosePort, FilePickerPort } from "@mvc/dialogs/DialogPorts";

export type Z88dkIntegrationDialogResult = "close";

/** The z88dk half of the main process API, narrowed to what this dialog uses. */
export type Z88dkServicePort = {
  probePath(path: string): Promise<Z88dkProbeResult>;
  getPathSuggestions(): Promise<Z88dkProbeResult[]>;
  listReleases(request: { refresh?: boolean }): Promise<Z88dkReleaseListResult>;
  downloadRelease(request: Z88dkReleaseDownloadRequest): Promise<Z88dkReleaseDownloadResult>;
  getDownloadProgress(): Promise<Z88dkDownloadProgress>;
  cancelDownload(): Promise<void>;
  getDefaultDownloadFolder(): Promise<string>;
  validateInstall(root: string): Promise<Z88dkProbeResult>;
  apply(request: Z88dkIntegrationApplyRequest): Promise<void>;
};

/** Repeats a callback until stopped: the download's progress poll. A test ticks it by hand. */
export type TickerPort = {
  start(intervalMs: number, tick: () => void): () => void;
};

/** Everything outside the dialog its controller may touch: the seam the tests fake. */
export type Z88dkPorts = {
  files: FilePickerPort;
  confirm: ConfirmPort;
  close: DialogClosePort<Z88dkIntegrationDialogResult>;
  service: Z88dkServicePort;
  ticker: TickerPort;
};

export const Z88DK_FOLDER_SETTINGS_KEY = "z88dkInstallFolder";
export const Z88DK_DOWNLOAD_FOLDER_SETTINGS_KEY = "z88dkDownloadFolder";
/** How often the dialog asks the main process how far the download is. */
export const DOWNLOAD_POLL_MS = 250;
