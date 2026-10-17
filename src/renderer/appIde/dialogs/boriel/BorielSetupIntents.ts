/**
 * Everything a user can do in the Boriel BASIC setup dialog, in the user's own vocabulary.
 */
export type BorielSetupIntent =
  | { type: "opened" }
  | { type: "folderEdited"; folder: string }
  | { type: "browseFolderRequested" }
  | { type: "dontAskAgainToggled"; value: boolean }
  // --- "Use Boriel BASIC to build BASIC programs": the zxbasic.compiler user setting
  | { type: "useBorielToggled"; value: boolean }
  | { type: "installRequested" }
  | { type: "useExistingRequested" }
  // --- "Not now" in the offer, "Close" otherwise, and the X / Escape
  | { type: "closeRequested" };
