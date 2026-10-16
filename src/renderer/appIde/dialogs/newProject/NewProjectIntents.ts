import type { NewProjectEnvironment } from "./NewProjectModel";

/**
 * Everything a user can do in the New Project dialog, in the user's own
 * vocabulary.
 */
export type NewProjectIntent =
  // --- The dialog appeared: find the machine types that have templates, and
  // --- load the templates of the machine it opened on.
  | { type: "opened" }
  | { type: "environmentChanged"; env: NewProjectEnvironment }
  // --- The type first; its model then starts on the default rule's choice.
  | { type: "machineTypeSelected"; machineId: string }
  // --- An empty id stands for a machine without models.
  | { type: "modelSelected"; modelId: string }
  | { type: "templateSelected"; templateId: string }
  | { type: "projectFolderEdited"; folder: string }
  | { type: "projectNameEdited"; name: string }
  | { type: "selectFolderRequested" }
  | { type: "createRequested" }
  | { type: "cancelRequested" };
