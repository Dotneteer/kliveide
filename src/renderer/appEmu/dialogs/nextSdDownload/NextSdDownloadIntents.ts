/** Everything a user can do in the Next SD card download dialog */
export type NextSdDownloadIntent =
  // --- Download, and Retry after a failure
  | { type: "downloadRequested" }
  | { type: "importRequested" }
  | { type: "copyUrlRequested" }
  // --- Cancel, the X and Escape: stops a running download
  | { type: "closeRequested" };
