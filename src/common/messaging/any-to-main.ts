import { ProjectNodeWithChildren } from "@appIde/project/project-node";
import { MessageBase } from "./messages-core";
import { KliveCompilerOutput } from "../../main/compiler-integration/compiler-registry";
import { CompilerOptions } from "@abstractions/IZ80CompilerService";
import { SectorChanges } from "@emu/abstractions/IFloppyDiskDrive";

/**
 * The client sends a text file read request
 */
export interface MainReadTextFileRequest extends MessageBase {
  type: "MainReadTextFile";
  path: string;
  encoding?: string;
  resolveIn?: string;
}

/**
 * The client sends a binary file read request
 */
export interface MainReadBinaryFileRequest extends MessageBase {
  type: "MainReadBinaryFile";
  path: string;
  resolveIn?: string;
}

/**
 * The client sends an error message to display
 */
export interface MainDisplayMessageBoxRequest extends MessageBase {
  type: "MainDisplayMessageBox";
  messageType?: "none" | "info" | "error" | "question" | "warning";
  title?: string;
  message?: string;
}

/**
 * The client wants to get the contents of a directory
 */
export interface MainGetDirectoryContentRequest extends MessageBase {
  type: "MainGetDirectoryContent";
  directory: string;
}

/**
 * The client wants to open a particular folder
 */
export interface MainOpenFolderRequest extends MessageBase {
  type: "MainOpenFolder";
  folder?: string;
}

/**
 * The client wants to create a new Klive project
 */
export interface MainCreateKliveProjectRequest extends MessageBase {
  type: "MainCreateKliveProject";
  machineId: string;
  modelId?: string;
  templateId: string;
  projectName: string;
  projectFolder?: string;
}

/**
 * The client wants to get the list of globally excluded project items (those, specified inside *.settings file)
 */
export interface MainGloballyExcludedProjectItemsRequest extends MessageBase {
  type: "MainGloballyExcludedProjectItems";
}

/**
 * The client wants to add items to the list of globally excluded project items
 */
export interface MainAddGloballyExcludedProjectItemsRequest
  extends MessageBase {
  type: "MainAddGloballyExcludedProjectItems";
  files: string[];
}

/**
 * The client wants to set (override) the list of globally excluded project items
 */
export interface MainSetGloballyExcludedProjectItemsRequest
  extends MessageBase {
  type: "MainSetGloballyExcludedProjectItems";
  files: string[];
}

/**
 * The client wants to delete a file entry
 */
export interface MainDeleteFileEntryRequest extends MessageBase {
  type: "MainDeleteFileEntry";
  isFolder: boolean;
  name: string;
}

/**
 * The client wants to delete a file entry
 */
export interface MainAddNewFileEntryRequest extends MessageBase {
  type: "MainAddNewFileEntry";
  isFolder?: boolean;
  folder?: string;
  name: string;
}

/**
 * The client wants to delete a file entry
 */
export interface MainRenameFileEntryRequest extends MessageBase {
  type: "MainRenameFileEntry";
  oldName: string;
  newName: string;
}

/**
 * The client wants to display the open folder dialog
 */
export interface MainShowOpenFolderDialogRequest extends MessageBase {
  type: "MainShowOpenFolderDialog";
  title?: string;
  settingsId?: string;
}

/**
 * The client wants to get the app folder
 */
export interface MainShowOpenFileDialogRequest extends MessageBase {
  type: "MainShowOpenFileDialog";
  title?: string;
  filters?: { name: string; extensions: string[] }[];
  settingsId?: string;
}

/**
 * The client wants to save a text file
 */
export interface MainSaveTextFileRequest extends MessageBase {
  type: "MainSaveTextFile";
  path: string;
  data: string;
  resolveIn?: string;
}

/**
 * The client wants to save a text file
 */
export interface MainSaveBinaryFileRequest extends MessageBase {
  type: "MainSaveBinaryFile";
  path: string;
  data: Uint8Array;
  resolveIn?: string;
}

/**
 * The client wants to save the current project
 */
export interface MainSaveProjectRequest extends MessageBase {
  type: "MainSaveProject";
}

/**
 * The client wants to save the global app settings
 */
export interface MainSaveSettingsRequest extends MessageBase {
  type: "MainSaveSettings";
}

/**
 * The client wants to get the current user settings
 */
export interface MainGetUserSettingsRequest extends MessageBase {
  type: "MainGetUserSettings";
}

/**
 * The client wants to get the current project settings
 */
export interface MainGetProjectSettingsRequest extends MessageBase {
  type: "MainGetProjectSettings";
}

/**
 * The client wants to apply and save a user setting
 */
export interface MainApplyUserSettingsRequest extends MessageBase {
  type: "MainApplyUserSettings";
  key: string;
  value?: any;
}

/**
 * The client wants to apply and save a project setting
 */
export interface MainApplyProjectSettingsRequest extends MessageBase {
  type: "MainApplyProjectSettings";
  key: string;
  value?: any;
}

/**
 * The client wants to move settings
 */
export interface MainMoveSettingsRequest extends MessageBase {
  type: "MainMoveSettings";
  pull: boolean;
  copy: boolean;
}

/**
 * The client wants to compile a particular file
 */
export interface MainCompileFileRequest extends MessageBase {
  type: "MainCompileFile";
  filename: string;
  language: string;
  options?: CompilerOptions;
  params?: any;
}

export interface MainShowItemInFolderRequest extends MessageBase {
  type: "MainShowItemInFolder";

  itemPath: string;
}

/**
 * The client wants to quit the app
 */
export interface MainExitAppRequest extends MessageBase {
  type: "MainExitApp";
}

/**
 * The client wants to check the existence of a particular file
 */
export interface MainPathExistsRequest extends MessageBase {
  type: "MainPathExists";
  path: string;
  isFolder?: boolean;
}

/**
 * The client wants to open the project's web site
 */
export interface MainShowWebsiteRequest extends MessageBase {
  type: "MainShowWebsite";
}

/**
 * The client wants to check if a Z88 card file is valid
 */
export interface MainCheckZ88CardRequest extends MessageBase {
  type: "MainCheckZ88Card";
  path: string;
  expectedSize?: number;
}

/**
 * The client wants to save the current disk changes
 */
export interface MainSaveDiskChangesRequest extends MessageBase {
  type: "MainSaveDiskChanges";
  diskIndex: number;
  changes: SectorChanges;
}

/**
 * The client wants to create a disk file
 */
export interface MainCreateDiskFileRequest extends MessageBase {
  type: "MainCreateDiskFile";
  diskFolder: string;
  filename: string;
  diskType: string;
}

/**
 * The client wants to create a disk file
 */
export interface MainGetTemplateDirsRequest extends MessageBase {
  type: "MainGetTemplateDirs";
  machineId: string;
}

/**
 * The client wants to start a script
 */
export interface MainStartScriptRequest extends MessageBase {
  type: "MainStartScript";
  filename: string;
}

/**
 * The client wants to start a script
 */
export interface MainStopScriptRequest extends MessageBase {
  type: "MainStopScript";
  idOrFilename: number | string;
}

/**
 * Response for text file read action
 */
export interface TextContentsResponse extends MessageBase {
  type: "TextContents";
  contents: string;
}

/**
 * Response for binary file read action
 */
export interface BinaryContentsResponse extends MessageBase {
  type: "BinaryContents";
  contents: Uint8Array;
}

/**
 * The client wants to get the contents of a directory
 */
export interface MainGetDirectoryContentResponse extends MessageBase {
  type: "MainGetDirectoryContentResponse";
  contents: ProjectNodeWithChildren;
}

/**
 * The client wants to create a new Klive project
 */
export interface MainCreateKliveProjectResponse extends MessageBase {
  type: "MainCreateKliveProjectResponse";
  path?: string;
  errorMessage?: string;
}

/**
 * The client wants to display the open folder dialog
 */
export interface MainShowOpenFolderDialogResponse extends MessageBase {
  type: "MainShowOpenFolderDialogResponse";
  folder?: string;
}

/**
 * The client wants to display the open folder dialog
 */
export interface MainShowOpenFileDialogResponse extends MessageBase {
  type: "MainShowOpenFileDialogResponse";
  file?: string;
}

export interface MainCompileResponse extends MessageBase {
  type: "MainCompileFileResponse";
  result: KliveCompilerOutput;
  failed?: string;
}

/**
 * The client wants to save a text file
 */
export interface MainSaveFileResponse extends MessageBase {
  type: "MainSaveFileResponse";
  path: string;
}

/**
 * The client wants to get settings
 */
export interface MainGetSettingsResponse extends MessageBase {
  type: "MainGetSettingsResponse";
  settings: Record<string, any>;
}

/**
 * The client wants check if a Z88 card file is valid
 */
export interface MainCheckZ88CardResponse extends MessageBase {
  type: "MainCheckZ88CardResponse";
  message?: string;
  content?: Uint8Array;
}

/**
 * The client wants to create a disk file
 */
export interface MainCreateDiskFileResponse extends MessageBase {
  type: "MainCreateDiskFileResponse";
  path?: string;
  errorMessage?: string;
}

/**
 * The client wants to create a disk file
 */
export interface MainGetTemplateDirsResponse extends MessageBase {
  type: "MainGetTemplateDirsResponse";
  dirs: string[];
}

/**
 * The client wants to start a script
 */
export interface MainRunScriptResponse extends MessageBase {
  type: "MainRunScriptResponse";
  id?: number;
}

export function textContentsResponse (contents: string): TextContentsResponse {
  return {
    type: "TextContents",
    contents
  };
}

export function binaryContentsResponse (
  contents: Uint8Array
): BinaryContentsResponse {
  return {
    type: "BinaryContents",
    contents
  };
}
