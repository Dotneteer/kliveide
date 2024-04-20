import { ProjectNodeWithChildren } from "@appIde/project/project-node";
import { MessageBase } from "./messages-core";
import { KliveCompilerOutput } from "../../main/compiler-integration/compiler-registry";
import { CompilerOptions } from "@abstractions/IZ80CompilerService";
import { SectorChanges } from "@emu/abstractions/IFloppyDiskDrive";
import { ScriptRunInfo } from "@abstractions/ScriptRunInfo";

// --- Read the contents of a text file
export interface MainReadTextFileRequest extends MessageBase {
  type: "MainReadTextFile";
  path: string;
  encoding?: string;
  resolveIn?: string;
}

// --- Read the contents of a binary file
export interface MainReadBinaryFileRequest extends MessageBase {
  type: "MainReadBinaryFile";
  path: string;
  resolveIn?: string;
}

// --- Display an Electron message box
export interface MainDisplayMessageBoxRequest extends MessageBase {
  type: "MainDisplayMessageBox";
  messageType?: "none" | "info" | "error" | "question" | "warning";
  title?: string;
  message?: string;
}

// --- Get the contents of a particular directory
export interface MainGetDirectoryContentRequest extends MessageBase {
  type: "MainGetDirectoryContent";
  directory: string;
}

// --- Open a folder
export interface MainOpenFolderRequest extends MessageBase {
  type: "MainOpenFolder";
  folder?: string;
}

// --- Create a new Klive project
export interface MainCreateKliveProjectRequest extends MessageBase {
  type: "MainCreateKliveProject";
  machineId: string;
  modelId?: string;
  templateId: string;
  projectName: string;
  projectFolder?: string;
}

// --- Get the list of globally excluded project items
export interface MainGloballyExcludedProjectItemsRequest extends MessageBase {
  type: "MainGloballyExcludedProjectItems";
}

// --- Add project items to the list of globally excluded items
export interface MainAddGloballyExcludedProjectItemsRequest
  extends MessageBase {
  type: "MainAddGloballyExcludedProjectItems";
  files: string[];
}

// --- Set the list of globally excluded project items
export interface MainSetGloballyExcludedProjectItemsRequest
  extends MessageBase {
  type: "MainSetGloballyExcludedProjectItems";
  files: string[];
}

// --- Delete a particluar file or folder from the file system
export interface MainDeleteFileEntryRequest extends MessageBase {
  type: "MainDeleteFileEntry";
  isFolder: boolean;
  name: string;
}

// --- Add a new empty file entry
export interface MainAddNewFileEntryRequest extends MessageBase {
  type: "MainAddNewFileEntry";
  isFolder?: boolean;
  folder?: string;
  name: string;
}

// --- Rename a file entry
export interface MainRenameFileEntryRequest extends MessageBase {
  type: "MainRenameFileEntry";
  oldName: string;
  newName: string;
}

// --- Show the open folder dialog
export interface MainShowOpenFolderDialogRequest extends MessageBase {
  type: "MainShowOpenFolderDialog";
  title?: string;
  settingsId?: string;
}

// --- Show the Electron open file dialog
export interface MainShowOpenFileDialogRequest extends MessageBase {
  type: "MainShowOpenFileDialog";
  title?: string;
  filters?: { name: string; extensions: string[] }[];
  settingsId?: string;
}

// --- Save a text file
export interface MainSaveTextFileRequest extends MessageBase {
  type: "MainSaveTextFile";
  path: string;
  data: string;
  resolveIn?: string;
}

// --- Save a binary file
export interface MainSaveBinaryFileRequest extends MessageBase {
  type: "MainSaveBinaryFile";
  path: string;
  data: Uint8Array;
  resolveIn?: string;
}

// --- Save the project file
export interface MainSaveProjectRequest extends MessageBase {
  type: "MainSaveProject";
}

// --- Save the settings file
export interface MainSaveSettingsRequest extends MessageBase {
  type: "MainSaveSettings";
}

// --- Get the current user-level settings
export interface MainGetUserSettingsRequest extends MessageBase {
  type: "MainGetUserSettings";
}

// --- Get the current project-level settings
export interface MainGetProjectSettingsRequest extends MessageBase {
  type: "MainGetProjectSettings";
}

// --- Apply and save a user-level setting
export interface MainApplyUserSettingsRequest extends MessageBase {
  type: "MainApplyUserSettings";
  key: string;
  value?: any;
}

// --- Apply and save a project-level setting
export interface MainApplyProjectSettingsRequest extends MessageBase {
  type: "MainApplyProjectSettings";
  key: string;
  value?: any;
}

// --- Move a particular setting from user to project settings
export interface MainMoveSettingsRequest extends MessageBase {
  type: "MainMoveSettings";
  pull: boolean;
  copy: boolean;
}

// --- Compile the main file of the project
export interface MainCompileFileRequest extends MessageBase {
  type: "MainCompileFile";
  filename: string;
  language: string;
  options?: CompilerOptions;
  params?: any;
}

// --- Open the OS file manager to show a particular file
export interface MainShowItemInFolderRequest extends MessageBase {
  type: "MainShowItemInFolder";
  itemPath: string;
}

// --- Exit the application
export interface MainExitAppRequest extends MessageBase {
  type: "MainExitApp";
}

// --- Check if a path exists
export interface MainPathExistsRequest extends MessageBase {
  type: "MainPathExists";
  path: string;
  isFolder?: boolean;
}

// --- Show the Klive IDE website
export interface MainShowWebsiteRequest extends MessageBase {
  type: "MainShowWebsite";
}

// --- Check if a Z88 card file is valid
export interface MainCheckZ88CardRequest extends MessageBase {
  type: "MainCheckZ88Card";
  path: string;
  expectedSize?: number;
}

// --- Save the changes of a virtual floppy disk (.DSK)
export interface MainSaveDiskChangesRequest extends MessageBase {
  type: "MainSaveDiskChanges";
  diskIndex: number;
  changes: SectorChanges;
}

// --- Create a new virtual disk file
export interface MainCreateDiskFileRequest extends MessageBase {
  type: "MainCreateDiskFile";
  diskFolder: string;
  filename: string;
  diskType: string;
}

// --- Get the list of template directories for a particluar machine type
export interface MainGetTemplateDirsRequest extends MessageBase {
  type: "MainGetTemplateDirs";
  machineId: string;
}

// --- Start running a script
export interface MainStartScriptRequest extends MessageBase {
  type: "MainStartScript";
  filename: string;
  scriptFunction?: string;
  scriptText?: string;
  speciality?: string;
}

// --- Stop running a script
export interface MainStopScriptRequest extends MessageBase {
  type: "MainStopScript";
  idOrFilename: number | string;
}

// --- Sign that a script's execution has completed
export interface MainCloseScriptRequest extends MessageBase {
  type: "MainCloseScript";
  script: ScriptRunInfo;
}

// --- Resolve a module to its contents
export interface MainResolveModuleRequest extends MessageBase {
  type: "MainResolveModule";
  mainFile: string;
  moduleName: string;
}

// --- Get the names of available build functions
export interface MainGetBuildFunctionsRequest extends MessageBase {
  type: "MainGetBuildFunctions";
}

// --- The response with a text file's contents
export interface TextContentsResponse extends MessageBase {
  type: "TextContents";
  contents: string;
}

// --- The response with a binary file's contents
export interface BinaryContentsResponse extends MessageBase {
  type: "BinaryContents";
  contents: Uint8Array;
}

// --- The response with the contents of a directory
export interface MainGetDirectoryContentResponse extends MessageBase {
  type: "MainGetDirectoryContentResponse";
  contents: ProjectNodeWithChildren;
}

// --- The response with the result of creating a new Klive project
export interface MainCreateKliveProjectResponse extends MessageBase {
  type: "MainCreateKliveProjectResponse";
  path?: string;
  errorMessage?: string;
}

// --- The response with the Electron oped folder dialog result
export interface MainShowOpenFolderDialogResponse extends MessageBase {
  type: "MainShowOpenFolderDialogResponse";
  folder?: string;
}

// --- The response with the Electron open file dialog result
export interface MainShowOpenFileDialogResponse extends MessageBase {
  type: "MainShowOpenFileDialogResponse";
  file?: string;
}

// --- The response with the compile main file result
export interface MainCompileResponse extends MessageBase {
  type: "MainCompileFileResponse";
  result: KliveCompilerOutput;
  failed?: string;
}

// --- The response with save file request result
export interface MainSaveFileResponse extends MessageBase {
  type: "MainSaveFileResponse";
  path: string;
}

// --- The response with the settings query result
export interface MainGetSettingsResponse extends MessageBase {
  type: "MainGetSettingsResponse";
  settings: Record<string, any>;
}

// --- The response with the Z88 card check result
export interface MainCheckZ88CardResponse extends MessageBase {
  type: "MainCheckZ88CardResponse";
  message?: string;
  content?: Uint8Array;
}

// --- The response with the create virtual disk result
export interface MainCreateDiskFileResponse extends MessageBase {
  type: "MainCreateDiskFileResponse";
  path?: string;
  errorMessage?: string;
}

// --- The response with the list of template directories
export interface MainGetTemplateDirsResponse extends MessageBase {
  type: "MainGetTemplateDirsResponse";
  dirs: string[];
}

// --- The response with the result of starting a script
export interface MainRunScriptResponse extends MessageBase {
  type: "MainRunScriptResponse";
  target?: string;
  contents?: string;
  id?: number;
  hasParseError?: boolean;
}

// --- The response with the result of module resolution
export interface MainResolveModuleResponse extends MessageBase {
  type: "MainResolveModuleResponse";
  contents: string;
}

// --- The response with the list of available build functions
export interface MainGetBuildFunctionsResponse extends MessageBase {
  type: "MainGetBuildFunctionsResponse";
  functions: string[];
}

// --- Creates a TextContentsResponse message wih the specified contents
export function textContentsResponse (contents: string): TextContentsResponse {
  return {
    type: "TextContents",
    contents
  };
}

// --- Creates a BinaryContentsResponse message wih the specified contents
export function binaryContentsResponse (
  contents: Uint8Array
): BinaryContentsResponse {
  return {
    type: "BinaryContents",
    contents
  };
}
