import type { SjasmplusIntegrationScope } from "@common/messaging/SjasmplusIntegration";

import type { SetupMode, SjasmplusEnvironment } from "./SjasmplusModel";

/**
 * Everything a user can do in the SJASMPLUS dialog, in the user's own
 * vocabulary. A test drives the dialog by dispatching these; nothing here
 * mentions React, the DOM or a service call.
 */
export type SjasmplusIntent =
  // --- The dialog appeared: load what it needs and re-test what is configured.
  | { type: "opened" }
  // --- The settings behind the dialog changed while it was open.
  | { type: "environmentChanged"; env: SjasmplusEnvironment }
  | { type: "setupModeSelected"; mode: SetupMode }
  | { type: "scopeSelected"; scope: SjasmplusIntegrationScope }
  | { type: "selectExecutableRequested" }
  // --- Identified by the path the user clicked; the controller resolves it
  // --- against the suggestions it loaded, so only a listed one can be picked.
  | { type: "suggestionPicked"; executablePath: string }
  | { type: "prereleasesToggled"; value: boolean }
  | { type: "releaseSelected"; tagName: string }
  | { type: "assetSelected"; name: string }
  | { type: "refreshReleasesRequested" }
  | { type: "selectDownloadFolderRequested" }
  | { type: "downloadRequested" }
  | { type: "testAgainRequested" }
  | { type: "applyRequested" }
  | { type: "closeRequested" };
