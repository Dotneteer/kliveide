/**
 * Everything a user can do in the Boriel BASIC setup dialog, in the user's own vocabulary.
 */
export type BorielSetupIntent =
  | { type: "opened" }
  | { type: "folderEdited"; folder: string }
  | { type: "browseFolderRequested" }
  | { type: "dontAskAgainToggled"; value: boolean }
  | { type: "installRequested" }
  | { type: "useExistingRequested" }
  // --- "Not now" in the offer, "Close" otherwise, and the X / Escape
  | { type: "closeRequested" };
