import type { NewProjectEnvironment } from "./NewProjectModel";

/**
 * Everything a user can do in the New Project dialog, in the user's own
 * vocabulary.
 */
export type NewProjectIntent =
  // --- The dialog appeared: load the templates of the machine it opened on.
  | { type: "opened" }
  | { type: "environmentChanged"; env: NewProjectEnvironment }
  // --- Machine and model arrive as the one string the dropdown carries.
  | { type: "machineSelected"; value: string }
  | { type: "templateSelected"; templateId: string }
  | { type: "projectFolderEdited"; folder: string }
  | { type: "projectNameEdited"; name: string }
  | { type: "selectFolderRequested" }
  | { type: "createRequested" }
  | { type: "cancelRequested" };
