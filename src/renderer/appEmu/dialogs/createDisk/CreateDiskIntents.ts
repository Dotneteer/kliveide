import type { CreateDiskEnvironment } from "./CreateDiskModel";

/**
 * Everything a user can do in the Create Disk dialog, in the user's own
 * vocabulary. A test drives the dialog by dispatching these; nothing here
 * mentions React, the DOM or a service call.
 */
export type CreateDiskIntent =
  // --- The validation rules behind the dialog changed while it was open.
  | { type: "environmentChanged"; env: CreateDiskEnvironment }
  | { type: "diskTypeSelected"; diskType: string }
  | { type: "folderEdited"; folder: string }
  | { type: "filenameEdited"; filename: string }
  | { type: "selectFolderRequested" }
  | { type: "createRequested" }
  | { type: "cancelRequested" };
