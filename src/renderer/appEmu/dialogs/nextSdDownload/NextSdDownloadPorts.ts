import type {
  NextSdDownloadDialogResult,
  NextSdDownloadStatus,
  NextSdImportResult
} from "@common/zxnext/nextSdDownload";
import type { DialogClosePort } from "@mvc/dialogs/DialogPorts";

/** The SD card half of the main process API, narrowed to what this dialog uses */
export type NextSdCardServicePort = {
  start(setId: string): Promise<void>;
  status(setId: string): Promise<NextSdDownloadStatus>;
  cancel(setId: string): Promise<void>;
  importFile(setId: string): Promise<NextSdImportResult>;
};

/** Everything outside the dialog its controller may touch: the seam the tests fake */
export type NextSdDownloadPorts = {
  service: NextSdCardServicePort;
  clipboard: { writeText(text: string): Promise<void> };
  /** Waits between two polls of the download's status */
  wait(ms: number): Promise<void>;
  close: DialogClosePort<NextSdDownloadDialogResult>;
};

/** How often the dialog asks the main process how far the download is */
export const POLL_MS = 200;
