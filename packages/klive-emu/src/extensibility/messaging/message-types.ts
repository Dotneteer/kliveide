import {
  MachineCreationOptions,
  MachineState,
} from "../../renderer/machines/core/vm-core-types";
import { KliveAction } from "../../shared/state/state-core";
import { KliveConfiguration } from "../../main/main-state/klive-configuration";
import {
  AppState,
  DirectoryContent,
  RegisteredMachine,
} from "../../shared/state/AppState";
import { ICpuState } from "../../shared/machines/AbstractCpu";
import { NewProjectData } from "./dto";

/**
 * The common base for all message types
 */
export interface MessageBase {
  type: AnyMessage["type"];
  correlationId?: number;
  sourceId?: string;
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
  type: "NewProjectRequest";
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
 * The Emu ask the main for a file open dialog
 */
export interface GetFolderDialogRequest extends MessageBase {
  type: "GetFolderDialog";
  title?: string;
  root?: string;
}

/**
 * The Emu ask the main for checking the existence of a file
 */
export interface FileExistsRequest extends MessageBase {
  type: "FileExists";
  name: string;
}

/**
 * The Emu ask the main for obtaining the contents of a folder
 */
export interface GetFolderContentsRequest extends MessageBase {
  type: "GetFolderContents";
  name: string;
}

/**
 * The Emu ask the main for creating a folder
 */
export interface CreateFolderRequest extends MessageBase {
  type: "CreateFolder";
  name: string;
}

/**
 * The Emu ask the main for creating a file
 */
export interface CreateFileRequest extends MessageBase {
  type: "CreateFile";
  name: string;
}

/**
 * The Emu ask the main for displaying a confirm dialog
 */
export interface ConfirmDialogRequest extends MessageBase {
  type: "ConfirmDialog";
  title?: string;
  question: string;
  defaultYes?: boolean;
}

/**
 * The Emu ask the main for deleting a folder
 */
export interface DeleteFolderRequest extends MessageBase {
  type: "DeleteFolder";
  name: string;
}

/**
 * The Emu ask the main for deleting a file
 */
export interface DeleteFileRequest extends MessageBase {
  type: "DeleteFile";
  name: string;
}

/**
 * The Emu ask the main for renaming a file
 */
export interface RenameFileRequest extends MessageBase {
  type: "RenameFile";
  oldName: string;
  newName: string;
}

/**
 * The Emu ask the main for getting the contents of a file
 */
 export interface GetFileContentsRequest extends MessageBase {
  type: "GetFileContents";
  name: string;
  asBuffer?: boolean;
}

/**
 * The Emu ask the main for getting the contents of a file
 */
export interface SaveFileContentsRequest extends MessageBase {
  type: "SaveFileContents";
  name: string;
  contents: string;
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
  | ExecuteMachineCommandRequest;

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
  | GetMemoryContentsRequest;

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
  | SaveFileContentsRequest;

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


export type ResponseMessage =
  | DefaultResponse
  | CreateMachineResponse
  | ExecuteMachineCommandResponse
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
  | GetFileContentsResponse;

/**
 * All messages
 */
export type AnyMessage = RequestMessage | ResponseMessage;
