import {
  MachineCreationOptions,
  MachineState,
} from "@abstractions/vm-core-types";
import { ICpuState } from "@modules-core/abstract-cpu";
import { KliveProcess } from "@abstractions/command-definitions";
import { CodeToInject } from "@abstractions/code-runner-service";
import { KliveAction } from "@core/state/state-core";
import {
  AppState,
  DirectoryContent,
  RegisteredMachine,
} from "@core/state/AppState";
import {
  KliveConfiguration,
  KliveSettings,
} from "@abstractions/klive-configuration";
import {
  CompilerOptions,
  CompilerOutput,
} from "@abstractions/z80-compiler-service";
import { AssemblerErrorInfo } from "@abstractions/z80-compiler-service";
import { KliveCompilerOutput } from "@abstractions/compiler-registry";

/**
 * Potential message sources
 */
export type MessageSource = "emu" | "ide" | "main";

export type Channel =
  | "MainStateRequest"
  | "RendererStateResponse"
  | "RendererStateRequest"
  | "MainStateResponse"
  | "MainToEmuRequest"
  | "MainToEmuResponse"
  | "MainToIdeRequest"
  | "MainToIdeResponse"
  | "EmuToMainRequest"
  | "EmuToMainResponse"
  | "IdeToEmuMainRequest"
  | "IdeToEmuMainResponse"
  | "IdeToEmuEmuRequest"
  | "IdeToEmuEmuResponse";

/**
 * The common base for all message types
 */
export interface MessageBase {
  type: AnyMessage["type"];
  correlationId?: number;
  sourceId?: MessageSource;
}

/**
 * The Emu or IDE processes forward state changes to the main process
 */
export interface ForwardActionRequest extends MessageBase {
  type: "ForwardAction";
  action: KliveAction;
}

/**
 * The main process forwards the application configuration to the Emu or IDE
 * processes
 */
export interface ForwardAppConfigRequest extends MessageBase {
  type: "ForwardAppConfig";
  config: KliveConfiguration;
}

/**
 * The main process asks the Emu process to create a virtual machine
 */
export interface CreateMachineRequest extends MessageBase {
  type: "CreateMachine";
  machineId: string;
  options: MachineCreationOptions;
}

/**
 * The main process sends this message to Emu to start the VM
 */
export interface StartVmRequest extends MessageBase {
  type: "StartVm";
}

/**
 * The main process sends this message to Emu to start the VM and
 * run to till it reaches the specified termination point
 */
export interface RunCodeRequest extends MessageBase {
  type: "RunCode";
  codeToInject: CodeToInject;
  debug: boolean;
}

/**
 * The main process sends this message to Emu to pause the VM
 */
export interface PauseVmRequest extends MessageBase {
  type: "PauseVm";
}

/**
 * The main process sends this message to Emu to stop the VM
 */
export interface StopVmRequest extends MessageBase {
  type: "StopVm";
}

/**
 * The main process sends this message to Emu to restart the VM
 */
export interface RestartVmRequest extends MessageBase {
  type: "RestartVm";
}

/**
 * The main process sends this message to Emu to start debugging the VM
 */
export interface DebugVmRequest extends MessageBase {
  type: "DebugVm";
}

/**
 * The main process sends this message to Emu to step-into the VM
 */
export interface StepIntoVmRequest extends MessageBase {
  type: "StepIntoVm";
}

/**
 * The main process sends this message to Emu to step-over the VM
 */
export interface StepOverVmRequest extends MessageBase {
  type: "StepOverVm";
}

/**
 * The main process sends this message to Emu to step-out the VM
 */
export interface StepOutVmRequest extends MessageBase {
  type: "StepOutVm";
}

/**
 * The main process sends this message to Emu to execute a machine-specific command
 */
export interface ExecuteMachineCommandRequest extends MessageBase {
  type: "ExecuteMachineCommand";
  command: string;
  args?: unknown;
}

/**
 * The main process sends this message to Emu to get saved tape data
 */
export interface GetSavedTapeContentsRequest extends MessageBase {
  type: "GetSavedTapeContents";
}

/**
 * The main process sends its entire state to the IDE window
 */
export interface SyncMainStateRequest extends MessageBase {
  type: "SyncMainState";
  mainState: AppState;
}

/**
 * The main process sends a new project request to the IDE window
 */
export interface NewProjectRequest extends MessageBase {
  type: "NewProject";
}

/**
 * The Emu ask the main for a file open dialog
 */
export interface EmuOpenFileDialogRequest extends MessageBase {
  type: "EmuOpenFileDialog";
  title?: string;
  filters?: { name: string; extensions: string[] }[];
}

/**
 * The Emu asks the main for Manage Z88 Cards command
 */
export interface ManageZ88CardsRequest extends MessageBase {
  type: "ManageZ88Cards";
}

/**
 * The Ide asks Emu for the contents of the Z80 registers
 */
export interface GetCpuStateRequest extends MessageBase {
  type: "GetCpuState";
}

/**
 * The Ide asks Emu for the state of the virtual machine
 */
export interface GetMachineStateRequest extends MessageBase {
  type: "GetMachineState";
}

/**
 * The Ide asks Emu for the memory contents of the virtual machine
 */
export interface GetMemoryContentsRequest extends MessageBase {
  type: "GetMemoryContents";
}

/**
 * The Ide asks Emu to inject the specified code
 */
export interface InjectCodeRequest extends MessageBase {
  type: "InjectCode";
  codeToInject: CodeToInject;
}

/**
 * The Ide asks the main process for the contents of a folder
 */
export interface GetRegisteredMachinesRequest extends MessageBase {
  type: "GetRegisteredMachines";
}

/**
 * The Ide asks the main process to create a Klive project
 */
export interface CreateKliveProjectRequest extends MessageBase {
  type: "CreateKliveProject";
  machineType: string;
  rootFolder: string | null;
  projectFolder: string;
}

/**
 * The Ide asks the main process to open a folder
 */
export interface OpenProjectFolderRequest extends MessageBase {
  type: "OpenProjectFolder";
}

/**
 * The Ide ask the main for a file open dialog
 */
export interface GetFolderDialogRequest extends MessageBase {
  type: "GetFolderDialog";
  title?: string;
  root?: string;
}

/**
 * The Ide ask the main for checking the existence of a file
 */
export interface FileExistsRequest extends MessageBase {
  type: "FileExists";
  name: string;
}

/**
 * The Ide ask the main for obtaining the contents of a folder
 */
export interface GetFolderContentsRequest extends MessageBase {
  type: "GetFolderContents";
  name: string;
}

/**
 * The Ide ask the main for creating a folder
 */
export interface CreateFolderRequest extends MessageBase {
  type: "CreateFolder";
  name: string;
}

/**
 * The Ide ask the main for creating a file
 */
export interface CreateFileRequest extends MessageBase {
  type: "CreateFile";
  name: string;
}

/**
 * The Ide ask the main for displaying a confirm dialog
 */
export interface ConfirmDialogRequest extends MessageBase {
  type: "ConfirmDialog";
  title?: string;
  question: string;
  defaultYes?: boolean;
}

/**
 * The Ide ask the main for deleting a folder
 */
export interface DeleteFolderRequest extends MessageBase {
  type: "DeleteFolder";
  name: string;
}

/**
 * The Ide ask the main for deleting a file
 */
export interface DeleteFileRequest extends MessageBase {
  type: "DeleteFile";
  name: string;
}

/**
 * The Ide ask the main for renaming a file
 */
export interface RenameFileRequest extends MessageBase {
  type: "RenameFile";
  oldName: string;
  newName: string;
}

/**
 * The Ide ask the main for getting the contents of a file
 */
export interface GetFileContentsRequest extends MessageBase {
  type: "GetFileContents";
  name: string;
  asBuffer?: boolean;
}

/**
 * The Ide ask the main for getting the contents of a file
 */
export interface SaveFileContentsRequest extends MessageBase {
  type: "SaveFileContents";
  name: string;
  contents: string;
}

/**
 * The Ide ask the main for compiling a Z80 assembly file
 */
export interface CompileFileRequest extends MessageBase {
  type: "CompileFile";
  filename: string;
  language: string;
  options?: CompilerOptions;
}

/**
 * The Ide asks the main process to send the application configuration
 */
export interface GetAppConfigRequest extends MessageBase {
  type: "GetAppConfig";
  fromUser?: boolean;
}

/**
 * The Ide asks the main process to save the application settings
 */
export interface SaveIdeConfigRequest extends MessageBase {
  type: "SaveIdeConfig";
  config: Record<string, any>;
  toUser?: boolean;
}

/**
 * The Ide ask the main to show a message box
 */
export interface ShowMessageBoxRequest extends MessageBase {
  type: "ShowMessageBox";
  process: KliveProcess;
  message: string;
  title?: string;
  asError?: boolean;
}

/**
 * All requests
 */
export type RequestMessage =
  | ForwardingMessage
  | MainToEmuRequests
  | MainToIdeRequests
  | EmuToMainRequests
  | IdeToEmuRequests
  | IdeToMainRequests;

/**
 * Requests that forward information among the main, Emu, and IDE processes
 */
type ForwardingMessage = ForwardActionRequest | ForwardAppConfigRequest;

/**
 * Requests send by the main process to Emu
 */
type MainToEmuRequests =
  | CreateMachineRequest
  | StartVmRequest
  | PauseVmRequest
  | StopVmRequest
  | RestartVmRequest
  | DebugVmRequest
  | StepIntoVmRequest
  | StepOverVmRequest
  | StepOutVmRequest
  | RunCodeRequest
  | ExecuteMachineCommandRequest
  | GetSavedTapeContentsRequest;

/**
 * Requests from Emu to Main
 */
type EmuToMainRequests = EmuOpenFileDialogRequest | ManageZ88CardsRequest;

/**
 * Requests for IDE to Emu
 */
type IdeToEmuRequests =
  | GetCpuStateRequest
  | GetMachineStateRequest
  | GetMemoryContentsRequest
  | InjectCodeRequest;

/**
 * Requests for IDE to Main
 */
type IdeToMainRequests =
  | GetRegisteredMachinesRequest
  | CreateKliveProjectRequest
  | OpenProjectFolderRequest
  | GetFolderDialogRequest
  | FileExistsRequest
  | GetFolderContentsRequest
  | CreateFolderRequest
  | CreateFileRequest
  | ConfirmDialogRequest
  | DeleteFolderRequest
  | DeleteFileRequest
  | RenameFileRequest
  | GetFileContentsRequest
  | SaveFileContentsRequest
  | CompileFileRequest
  | ShowMessageBoxRequest
  | GetAppConfigRequest
  | SaveIdeConfigRequest;

/**
 * Requests send by the main process to Ide
 */
type MainToIdeRequests = SyncMainStateRequest | NewProjectRequest;

/**
 * Default response for actions
 */
export interface DefaultResponse extends MessageBase {
  type: "Ack";
}

/**
 * Response for CreateMachineRequest
 */
export interface CreateMachineResponse extends MessageBase {
  type: "CreateMachineResponse";
  error: string | null;
}

/**
 * The emulator process ask for a file open dialog
 */
export interface ExecuteMachineCommandResponse extends MessageBase {
  type: "ExecuteMachineCommandResponse";
  result: unknown;
}

/**
 * Response for GetSavedTapeContentsRequest
 */
export interface GetSavedTapeContentsResponse extends MessageBase {
  type: "GetSavedTapeContentsResponse";
  data?: Uint8Array;
}

/**
 * The emulator process ask for a file open dialog
 */
export interface EmuOpenFileDialogResponse extends MessageBase {
  type: "EmuOpenFileDialogResponse";
  filename?: string;
}

/**
 * The Ide asks Emu for the contents of the Z80 registers
 */
export interface GetCpuStateResponse extends MessageBase {
  type: "GetCpuStateResponse";
  state: ICpuState;
}

/**
 * The Ide asks Emu for the state of the virtual machine
 */
export interface GetMachineStateResponse extends MessageBase {
  type: "GetMachineStateResponse";
  state: MachineState;
}

/**
 * The Ide asks Emu for the memory contents of the virtual machine
 */
export interface GetMemoryContentsResponse extends MessageBase {
  type: "GetMemoryContentsResponse";
  contents: Uint8Array;
}

/**
 * The Ide asks the main process for the contents of a folder
 */
export interface GetRegisteredMachinesResponse extends MessageBase {
  type: "GetRegisteredMachinesResponse";
  machines: RegisteredMachine[];
}

/**
 * The Ide asks the main process to create a Klive project
 */
export interface CreateKliveProjectResponse extends MessageBase {
  type: "CreateKliveProjectResponse";
  error?: string;
  targetFolder: string;
}

/**
 * The main process sends a new project request to the IDE window
 */
export interface NewProjectResponse extends MessageBase {
  type: "NewProjectResponse";
  project?: NewProjectData;
}

/**
 * The emulator process ask for a file open dialog
 */
export interface GetFolderDialogResponse extends MessageBase {
  type: "GetFolderDialogResponse";
  filename?: string;
}

/**
 * The Emu ask the main for checking the existence of a file
 */
export interface FileExistsResponse extends MessageBase {
  type: "FileExistsResponse";
  exists: boolean;
}

/**
 * The Emu ask the main for obtaining the contents of a folder
 */
export interface GetFolderContentsResponse extends MessageBase {
  type: "GetFolderContentsResponse";
  contents: DirectoryContent;
}

/**
 * The Emu ask the main for creating a folder
 */
export interface FileOperationResponse extends MessageBase {
  type: "FileOperationResponse";
  error?: string;
}

/**
 * The Emu ask the main for displaying a confirm dialog
 */
export interface ConfirmDialogResponse extends MessageBase {
  type: "ConfirmDialogResponse";
  confirmed?: boolean;
}

/**
 * The Emu ask the main for getting the contents of a file
 */
export interface GetFileContentsResponse extends MessageBase {
  type: "GetFileContentsResponse";
  contents?: string | Buffer;
}

/**
 * The Ide ask the main for getting compiler information for a particular file
 */
export interface GetCompilerInfoResponse extends MessageBase {
  type: "GetCompilerInfoResponse";
  compiler?: string;
  supportsKlive?: boolean;
}

/**
 * The Ide ask the main for getting the contents of a file
 */
export interface CompileFileResponse extends MessageBase {
  type: "CompileFileResponse";
  result: KliveCompilerOutput;
  failed?: string;
}

/**
 * The Ide asks the main process to send the application configuration
 */
export interface GetAppConfigResponse extends MessageBase {
  type: "GetAppConfigResponse";
  config: KliveSettings;
}

export type ResponseMessage =
  | DefaultResponse
  | CreateMachineResponse
  | ExecuteMachineCommandResponse
  | GetSavedTapeContentsResponse
  | EmuOpenFileDialogResponse
  | GetCpuStateResponse
  | GetMachineStateResponse
  | GetMemoryContentsResponse
  | GetRegisteredMachinesResponse
  | CreateKliveProjectResponse
  | NewProjectResponse
  | GetFolderDialogResponse
  | FileExistsResponse
  | GetFolderContentsResponse
  | FileOperationResponse
  | ConfirmDialogResponse
  | GetFileContentsResponse
  | CompileFileResponse
  | GetCompilerInfoResponse
  | GetAppConfigResponse;

/**
 * All messages
 */
export type AnyMessage = RequestMessage | ResponseMessage;

// ----------------------------------------------------------------------------
// Message DTOs

/**
 * Represents the contents of the new project data
 */
export type NewProjectData = {
  machineType: string;
  projectPath: string;
  projectName: string;
  open: boolean;
};

// ----------------------------------------------------------------------------
// Message creators

export function defaultResponse(): DefaultResponse {
  return { type: "Ack" };
}

export function emuOpenFileDialogResponse(
  filename?: string
): EmuOpenFileDialogResponse {
  return {
    type: "EmuOpenFileDialogResponse",
    filename,
  };
}

export function getRegisteredMachinesResponse(
  machines: RegisteredMachine[]
): GetRegisteredMachinesResponse {
  return {
    type: "GetRegisteredMachinesResponse",
    machines,
  };
}

export function createKliveProjectResponse(
  targetFolder: string,
  error?: string
): CreateKliveProjectResponse {
  return { type: "CreateKliveProjectResponse", error, targetFolder };
}

export function getFolderDialogResponse(
  filename?: string
): GetFolderDialogResponse {
  return {
    type: "GetFolderDialogResponse",
    filename,
  };
}

export function fileExistsResponse(exists: boolean): FileExistsResponse {
  return {
    type: "FileExistsResponse",
    exists,
  };
}

export function getFolderContentsResponse(
  contents: DirectoryContent
): GetFolderContentsResponse {
  return {
    type: "GetFolderContentsResponse",
    contents,
  };
}

export function fileOperationResponse(error?: string): FileOperationResponse {
  return {
    type: "FileOperationResponse",
    error,
  };
}

export function confirmDialogResponse(
  confirmed?: boolean
): ConfirmDialogResponse {
  return {
    type: "ConfirmDialogResponse",
    confirmed,
  };
}

export function getFileContentsResponse(
  contents?: string | Buffer
): GetFileContentsResponse {
  return {
    type: "GetFileContentsResponse",
    contents,
  };
}

export function getCompilerInfoResponse(
  compiler?: string,
  supportsKlive?: boolean
): GetCompilerInfoResponse {
  return {
    type: "GetCompilerInfoResponse",
    compiler,
    supportsKlive,
  };
}

export function compileFileResponse(
  result: KliveCompilerOutput,
  failed?: string
): CompileFileResponse {
  return {
    type: "CompileFileResponse",
    result,
    failed,
  };
}

export function executeMachineCommand(
  command: string,
  args?: unknown
): ExecuteMachineCommandRequest {
  return {
    type: "ExecuteMachineCommand",
    command,
    args,
  };
}

export function getAppSettingsResponse(
  config: KliveSettings
): GetAppConfigResponse {
  return {
    type: "GetAppConfigResponse",
    config,
  };
}
