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
 * This message sings that the rendered process has successfully
 * started its operation
 */
export interface SignRendererStartedMessage extends MessageBase {
  type: "rendererStarted";
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
  | SignRendererStartedMessage
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
  | AppConfigResponse
  | GetMemoryContentsResponse
  | GetMachineStateResponse
  | AddDiagnosticsFrameDataResponse
  | GetMemoryPartitionResponse;

/**
 * All messages between renderer and main
 */
export type AnyMessage = RequestMessage | ResponseMessage;
