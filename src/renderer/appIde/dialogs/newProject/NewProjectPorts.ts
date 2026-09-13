import type { FilePickerPort } from "@mvc/dialogs/DialogPorts";

import type { NewProjectRequest } from "./NewProjectModel";

export type NewProjectDialogResult = NewProjectRequest;

/**
 * Everything outside the dialog that creating a project touches, narrowed to
 * the six steps the sequence actually performs.
 *
 * `loadBuildRoots` folds "wait for the main process to forward them" and "read
 * them" into one call: the dialog only ever wants the answer, and splitting it
 * would put a store read in the controller.
 */
export type NewProjectServicePort = {
  getTemplateDirectories(machineId: string): Promise<string[]>;
  createProject(request: NewProjectRequest): Promise<string>;
  // --- Resolves to a message when the folder could not be opened, rather than
  // --- rejecting; that is the shape the main process reports in.
  openFolder(path: string): Promise<string | undefined>;
  ensureProjectLoaded(): Promise<void>;
  ensureWorkspaceLoaded(): Promise<void>;
  loadBuildRoots(): Promise<string[]>;
  navigateTo(path: string): void;
  notify(type: "info" | "error", title: string, message: string): Promise<void>;
};

export type NewProjectClosePort = {
  // --- Awaited: the caller may need to finish opening the project before the
  // --- dialog goes away.
  created(result: NewProjectDialogResult): Promise<void> | void;
  cancelled(): void;
};

export type NewProjectPorts = {
  files: FilePickerPort;
  close: NewProjectClosePort;
  service: NewProjectServicePort;
};
