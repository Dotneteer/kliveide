import type { ScriptRunInfo } from "@abstractions/ScriptRunInfo";
import type { CompilerOptions } from "@abstractions/CompilerInfo";
import type { MessageBase } from "./messages-core";
import type { KliveCompilerOutput } from "@main/compiler-integration/compiler-registry";
import type { SectorChanges } from "@emu/abstractions/IFloppyDiskDrive";

export interface MainGeneralRequest extends MessageBase {
  type: "MainGeneralRequest";
  method: string;
  args: any;
}

export interface MainGeneralResponse extends MessageBase {
  type: "MainGeneralResponse";
  result: any;
}

export type MessageBoxType = "none" | "info" | "error" | "question" | "warning";

// --- Display an Electron message box
export interface MainDisplayMessageBoxRequest extends MessageBase {
  type: "MainDisplayMessageBox";
  messageType?: MessageBoxType;
  title?: string;
  message?: string;
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

// --- Show the Klive IDE website
export interface MainShowWebsiteRequest extends MessageBase {
  type: "MainShowWebsite";
}

// --- Save the changes of a virtual floppy disk (.DSK)
export interface MainSaveDiskChangesRequest extends MessageBase {
  type: "MainSaveDiskChanges";
  diskIndex: number;
  changes: SectorChanges;
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

// --- Resmove the scripts that have completed
export interface MainRemoveCompletedScriptsRequest extends MessageBase {
  type: "MainRemoveCompletedScripts";
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

// --- Get the names of available build functions
export interface MainCheckBuildRootRequest extends MessageBase {
  type: "MainCheckBuildRoot";
  filename: string;
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

// --- The response with the create virtual disk result
export interface MainCreateDiskFileResponse extends MessageBase {
  type: "MainCreateDiskFileResponse";
  path?: string;
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
export function genericResponse (result: any): MainGeneralResponse {
  return {
    type: "MainGeneralResponse",
    result
  };
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
