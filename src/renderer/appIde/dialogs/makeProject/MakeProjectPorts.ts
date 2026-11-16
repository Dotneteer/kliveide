import type {
  ProjectConversionOptions,
  ProjectConversionResult,
  TemplateConflict
} from "@common/structs/project-conversion";

import type { MakeProjectChoice } from "./MakeProjectModel";

/** What the dialog did, for whoever opened it */
export type MakeProjectDialogResult = {
  choice: MakeProjectChoice;
  folder: string;
};

/**
 * Everything outside the dialog that keeping or converting the folder touches.
 */
export type MakeProjectServicePort = {
  /** The folder's files that can be a build root, relative, forward slashes */
  getBuildRootCandidates(folder: string): Promise<string[]>;
  getTemplateDirectories(machineId: string): Promise<string[]>;
  getConflicts(folder: string, machineId: string, templateId: string): Promise<TemplateConflict[]>;
  convert(request: ProjectConversionOptions): Promise<ProjectConversionResult>;
  rememberPlainFolder(folder: string): Promise<void>;
  // --- Resolves to a message when the folder could not be opened, rather than rejecting
  openFolder(folder: string): Promise<string | undefined>;
  ensureProjectLoaded(folder: string): Promise<void>;
  ensureWorkspaceLoaded(folder: string): Promise<void>;
  loadBuildRoots(): Promise<string[]>;
  navigateTo(path: string): void;
  notify(type: "info" | "error", title: string, message: string): Promise<void>;
};

export type MakeProjectClosePort = {
  done(result: MakeProjectDialogResult): Promise<void> | void;
  cancelled(): void;
};

export type MakeProjectPorts = {
  close: MakeProjectClosePort;
  service: MakeProjectServicePort;
};
