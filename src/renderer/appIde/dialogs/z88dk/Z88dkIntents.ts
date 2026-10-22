import type { Z88dkIntegrationScope } from "@common/messaging/Z88dkIntegration";

import type { SetupMode, Z88dkEnvironment } from "./Z88dkModel";

/**
 * Everything a user can do in the Z88DK integration dialog, in the user's own vocabulary. A test
 * drives the dialog by dispatching these; nothing here mentions React, the DOM or a service call.
 */
export type Z88dkIntent =
  | { type: "opened" }
  | { type: "environmentChanged"; env: Z88dkEnvironment }
  | { type: "setupModeSelected"; mode: SetupMode }
  | { type: "scopeSelected"; scope: Z88dkIntegrationScope }
  | { type: "chooseFolderRequested" }
  // --- Identified by the folder the user clicked; only a listed one can be picked
  | { type: "suggestionPicked"; root: string }
  | { type: "showOlderToggled"; value: boolean }
  | { type: "releaseSelected"; tagName: string }
  | { type: "assetSelected"; name: string }
  | { type: "refreshReleasesRequested" }
  | { type: "selectDownloadFolderRequested" }
  | { type: "downloadRequested" }
  | { type: "cancelDownloadRequested" }
  | { type: "testAgainRequested" }
  | { type: "applyRequested" }
  | { type: "closeRequested" };
