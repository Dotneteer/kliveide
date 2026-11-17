import type { NextSdCardFailure, NextSdDownloadDialogData } from "@common/zxnext/nextSdDownload";
import type { UiReducer } from "@mvc/core/types";

/*
 * The ZX Spectrum Next SD card download dialog (`dev/plans/NEXT_SD_CARDS_PLAN.md`, phase 4): state,
 * events and the pure reducer. It opens when a Next model's card is not on this machine and offers to
 * download it, or to import a card downloaded elsewhere.
 */

/** "offer": nothing started yet; "failed": the last download or import failed, the user may retry */
export type NextSdDownloadPhase = "offer" | "downloading" | "importing" | "failed";

export type NextSdDownloadState = {
  data: NextSdDownloadDialogData;
  phase: NextSdDownloadPhase;
  received: number;
  error?: { during: "download" | "import"; failure: NextSdCardFailure };
  /** The URL was copied to the clipboard */
  urlCopied: boolean;
};

export type NextSdDownloadEvent =
  | { type: "downloadStarted" }
  | { type: "progressed"; received: number }
  | { type: "downloadFailed"; failure: NextSdCardFailure }
  | { type: "importStarted" }
  | { type: "importCancelled" }
  | { type: "importFailed"; failure: NextSdCardFailure }
  | { type: "urlCopied" };

export function initialState(data: NextSdDownloadDialogData): NextSdDownloadState {
  return { data, phase: "offer", received: 0, urlCopied: false };
}

export const reduce: UiReducer<NextSdDownloadState, NextSdDownloadEvent> = (state, event) => {
  switch (event.type) {
    case "downloadStarted":
      return { ...state, phase: "downloading", received: 0, error: undefined };
    case "progressed":
      return state.phase !== "downloading" || state.received === event.received
        ? state
        : { ...state, received: event.received };
    case "downloadFailed":
      return { ...state, phase: "failed", error: { during: "download", failure: event.failure } };
    case "importStarted":
      return { ...state, phase: "importing" };
    case "importCancelled":
      // --- Back to where the user was: the offer, or the failure they were looking at
      return { ...state, phase: state.error ? "failed" : "offer" };
    case "importFailed":
      return { ...state, phase: "failed", error: { during: "import", failure: event.failure } };
    case "urlCopied":
      return state.urlCopied ? state : { ...state, urlCopied: true };
  }
};
