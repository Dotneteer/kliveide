import type { ExcludedItemsEnvironment } from "./ExcludedItemsModel";

/**
 * Everything a user can do in the Excluded Items dialog.
 */
export type ExcludedItemsIntent =
  // --- The dialog appeared: load the application-wide list.
  | { type: "opened" }
  | { type: "environmentChanged"; env: ExcludedItemsEnvironment }
  // --- Identified by its path, not its row: the list is virtualized and a row
  // --- index means nothing once the list has changed underneath it.
  | { type: "itemRemovalRequested"; id: string }
  | { type: "applyRequested" }
  | { type: "cancelRequested" };
