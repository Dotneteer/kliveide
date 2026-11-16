import type { MakeProjectChoice } from "./MakeProjectModel";

/**
 * Everything a user can do in the Make Klive Project dialog, in the user's own vocabulary.
 */
export type MakeProjectIntent =
  // --- The dialog appeared: find the machine types that have templates, read the folder's
  // --- build-root candidates and the machine's templates
  | { type: "opened" }
  | { type: "choiceSelected"; choice: MakeProjectChoice }
  | { type: "machineTypeSelected"; machineId: string }
  // --- An empty id stands for a machine without models
  | { type: "modelSelected"; modelId: string }
  | { type: "templateSelected"; templateId: string }
  // --- `DEFAULT_BUILD_ROOT` for the template's own
  | { type: "buildRootSelected"; buildRoot: string }
  | { type: "overwriteToggled"; path: string; overwrite: boolean }
  | { type: "submitRequested" }
  | { type: "cancelRequested" };
