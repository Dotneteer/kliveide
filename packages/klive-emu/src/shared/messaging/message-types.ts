import { MachineCreationOptions } from "../../renderer/machines/vm-core-types";
import { KliveAction } from "../state/state-core";

/**
 * The common base for all message types
 */
export interface MessageBase {
  type: AnyMessage["type"];
  correlationId?: number;
  sourceId?: string;
}

export interface ForwardActionRequest extends MessageBase {
  type: "ForwardAction";
  action: KliveAction;
}

export interface CreateMachineRequest extends MessageBase {
  type: "CreateMachine";
  machineId: string;
  options: MachineCreationOptions;
}

/**
 * The main process sends this message to start the VM
 */
export interface StartVmRequest extends MessageBase {
  type: "startVm";
}

/**
 * The main process sends this message to pause the VM
 */
export interface PauseVmRequest extends MessageBase {
  type: "pauseVm";
}

/**
 * The main process sends this message to stop the VM
 */
export interface StopVmRequest extends MessageBase {
  type: "stopVm";
}

/**
 * The main process sends this message to restart the VM
 */
export interface RestartVmRequest extends MessageBase {
  type: "restartVm";
}

/**
 * The main process sends this message to start debugging the VM
 */
export interface DebugVmRequest extends MessageBase {
  type: "debugVm";
}

/**
 * The main process sends this message to step-into the VM
 */
export interface StepIntoVmRequest extends MessageBase {
  type: "stepIntoVm";
}

/**
 * The main process sends this message to step-over the VM
 */
export interface StepOverVmRequest extends MessageBase {
  type: "stepOverVm";
}

/**
 * The main process sends this message to step-out the VM
 */
export interface StepOutVmRequest extends MessageBase {
  type: "stepOutVm";
}

/**
 * The main process sends this message to step-out the VM
 */
export interface ExecuteMachineCommandRequest extends MessageBase {
  type: "executeMachineCommand";
  command: string;
}

/**
 * All requests
 */
export type RequestMessage =
  | CreateMachineRequest
  | ForwardActionRequest
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
 * Default response for actions
 */
export interface DefaultResponse extends MessageBase {
  type: "ack";
}

/**
 * Response for CreateMachineRequest
 */
export interface CreateMachineResponse extends MessageBase {
  type: "CreateMachineResponse";
  error: string | null;
}

export type ResponseMessage = DefaultResponse | CreateMachineResponse;

/**
 * All messages
 */
export type AnyMessage = RequestMessage | ResponseMessage;
