import type { ExportCodeEnvironment, ExportCodeSettings } from "./ExportCodeModel";

/**
 * Everything a user can do in the Export Code dialog.
 *
 * The eleven form fields share one intent rather than earning eleven of their
 * own: this dialog is a settings sheet, and "the user edited a setting" is the
 * honest user-level description of every one of them. The actions that are
 * genuinely different — browsing, exporting, cancelling — are named.
 */
export type ExportCodeIntent =
  // --- The dialog appeared; the old component persisted on mount too.
  | { type: "opened" }
  | { type: "environmentChanged"; env: ExportCodeEnvironment }
  | { type: "settingEdited"; patch: Partial<ExportCodeSettings> }
  | { type: "selectExportFolderRequested" }
  | { type: "selectScreenFileRequested" }
  | { type: "exportRequested" }
  | { type: "cancelRequested" };
