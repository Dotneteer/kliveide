import { BreakpointDefinition, CodeToInject } from "../machines/api-data";
import { DiagViewFrame } from "../machines/diag-info";
import { MachineState } from "../machines/machine-state";
import { KliveConfiguration } from "./emu-configurations";

/**
 * The common base for all message types
 */
export interface MessageBase {
  type: AnyMessage["type"];
  correlationId?: number;
}

/**
 * The main process sends this message to start the VM
 */
export interface StartVmMessage extends MessageBase {
  type: "startVm";
}

/**
 * The main process sends this message to pause the VM
 */
export interface PauseVmMessage extends MessageBase {
  type: "pauseVm";
}

/**
 * The main process sends this message to stop the VM
 */
export interface StopVmMessage extends MessageBase {
  type: "stopVm";
}

/**
 * The main process sends this message to restart the VM
 */
export interface RestartVmMessage extends MessageBase {
  type: "restartVm";
}

/**
 * The main process sends this message to start debugging the VM
 */
export interface DebugVmMessage extends MessageBase {
  type: "debugVm";
}

/**
 * The main process sends this message to step-into the VM
 */
export interface StepIntoVmMessage extends MessageBase {
  type: "stepIntoVm";
}

/**
 * The main process sends this message to step-over the VM
 */
export interface StepOverVmMessage extends MessageBase {
  type: "stepOverVm";
}


/**
 * The main process sends this message to step-out the VM
 */
export interface StepOutVmMessage extends MessageBase {
  type: "stepOutVm";
}


/**
 * This message signs that the rendered process has successfully
 * started its operation
 */
export interface SignRendererStartedMessage extends MessageBase {
  type: "rendererStarted";
}

/**
 * The renderer wants to read the ROM files of the current machine
 */
export interface GetMachineRomsMessage extends MessageBase {
  type: "getMachineRoms";
}

/**
 * This message signs the machine type the renderer uses
 */
export interface SetToDefaultMachineMessage extends MessageBase {
  type: "setToDefaultMachine";
}

/**
 * This message initiating injecting code into the VM and running it
 */
export interface InjectCodeMessage extends MessageBase {
  type: "injectCode";
  codeToInject: CodeToInject;
}

/**
 * This message initiating injecting code into the VM and running it
 */
export interface RunCodeMessage extends MessageBase {
  type: "runCode";
  codeToInject: CodeToInject;
  debug?: boolean;
}

/**
 * Request the full 64K memory contents from the VM
 */
export interface GetMemoryContentsMessage extends MessageBase {
  type: "getMemoryContents";
}

/**
 * Request the diagnostics state of the machine
 */
export interface GetMachineStateMessage extends MessageBase {
  type: "getMachineState";
}

/**
 * Request additional diagnostics frame data
 */
export interface AddDiagnosticsFrameDataMessage extends MessageBase {
  type: "addDiagnosticsFrameData";
  frame: DiagViewFrame;
}

/**
 * Set breakpoints message
 */
export interface SetBreakpointsMessage extends MessageBase {
  type: "setBreakpoints";
  breakpoints: BreakpointDefinition[];
}

/**
 * Gets the specified memory partition
 */
export interface GetMemoryPartitionMessage extends MessageBase {
  type: "getMemoryPartition";
  partition: number;
}

/**
 * The messages that are send as requests to a processing entity
 */
export type RequestMessage =
  | StartVmMessage
  | PauseVmMessage
  | StopVmMessage
  | RestartVmMessage
  | DebugVmMessage
  | StepIntoVmMessage
  | StepOverVmMessage
  | StepOutVmMessage
  | SignRendererStartedMessage
  | GetMachineRomsMessage
  | SetToDefaultMachineMessage
  | InjectCodeMessage
  | RunCodeMessage
  | GetMemoryContentsMessage
  | GetMachineStateMessage
  | AddDiagnosticsFrameDataMessage
  | SetBreakpointsMessage
  | GetMemoryPartitionMessage;

/**
 * Default response for actions
 */
export interface DefaultResponse extends MessageBase {
  type: "ack";
}

/**
 * Response for GetMachineRomsMessage
 */
export interface GetMachineRomsResponse extends MessageBase {
  type: "getMachineRomsResponse";
  roms: Uint8Array[] | string;
}

/**
 * Response for SignRendererStartedMessage
 */
export interface AppConfigResponse extends MessageBase {
  type: "appConfigResponse";
  config: KliveConfiguration | null;
}

/**
 * Response for GetMemoryContentsMessage
 */
export interface GetMemoryContentsResponse extends MessageBase {
  type: "getMemoryContentsResponse";
  contents: Uint8Array;
}

/**
 * Response for GetMachineStateMessage
 */
export interface GetMachineStateResponse extends MessageBase {
  type: "getMachineStateResponse";
  state: MachineState;
}

/**
 * Response for AddDiagnosticsFrameDataMessage
 */
export interface AddDiagnosticsFrameDataResponse extends MessageBase {
  type: "addDiagnosticsFrameDataResponse";
  frame: DiagViewFrame;
}

/**
 * Response for GetMemoryContentsMessage
 */
export interface GetMemoryPartitionResponse extends MessageBase {
  type: "getMemoryPartitionResponse";
  contents: Uint8Array;
}

/**
 * The messages that are sent as responses
 */
export type ResponseMessage =
  | DefaultResponse
  | GetMachineRomsResponse
  | AppConfigResponse
  | GetMemoryContentsResponse
  | GetMachineStateResponse
  | AddDiagnosticsFrameDataResponse
  | GetMemoryPartitionResponse;

/**
 * All messages between renderer and main
 */
export type AnyMessage = RequestMessage | ResponseMessage;
