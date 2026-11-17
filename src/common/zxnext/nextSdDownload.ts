import type { NextRomSetId } from "./romSets";

/*
 * What the main process and the emulator window share about downloading a ZX Spectrum Next SD base
 * card (`dev/plans/NEXT_SD_CARDS_PLAN.md`, phase 4): the download dialog's data and result, and the
 * status the dialog polls while the main process downloads.
 */

/** Why a download or an import failed; the dialog words each kind its own way */
export type NextSdCardErrorKind =
  | "network"
  | "http"
  | "redirected"
  | "encoded"
  | "tooLarge"
  | "wrongCard"
  | "noSpace"
  | "cancelled"
  | "unreadable";

export type NextSdCardFailure = {
  kind: NextSdCardErrorKind;
  /** The technical detail (English), shown under the dialog's own sentence */
  message: string;
  /** The HTTP status (`http`, `redirected`), the bytes needed (`noSpace`) */
  detail?: number;
};

/** What the download dialog (`NEXT_SD_DOWNLOAD_DIALOG`) is opened with */
export type NextSdDownloadDialogData = {
  /** The model that needs the card, and its display name */
  modelId: string;
  modelName: string;
  /** The card's ROM set: one download makes every model of the set ready (D-1) */
  setId: NextRomSetId;
  /** The download's size and the working copy's size, in bytes */
  gzSize: number;
  size: number;
  /** Where the card is, for a user who downloads it elsewhere */
  url: string;
};

/** "ready": the card is on this machine now; "declined": the user closed the dialog without it */
export type NextSdDownloadDialogResult = "ready" | "declined";

/** A download the main process runs for the dialog */
export type NextSdDownloadStatus =
  | { state: "idle" }
  | { state: "running"; received: number; total: number }
  | { state: "done" }
  | { state: "failed"; error: NextSdCardFailure }
  | { state: "cancelled" };

/** What importing a card the user picked did */
export type NextSdImportResult =
  | { kind: "imported" }
  | { kind: "cancelled" }
  | { kind: "failed"; error: NextSdCardFailure };
