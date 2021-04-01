import { KliveAction } from "../state/state-core";

/**
 * The common base for all message types
 */
export interface MessageBase {
  type: AnyMessage["type"];
  correlationId?: number;
  sourceId?: string;
}

export interface ForwardActionMessage extends MessageBase {
  type: "ForwardAction";
  action: KliveAction;
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
 * All requests
 */
export type RequestMessage =
  | ForwardActionMessage
  | StartVmMessage
  | PauseVmMessage
  | StopVmMessage
  | RestartVmMessage
  | DebugVmMessage
  | StepIntoVmMessage
  | StepOverVmMessage
  | StepOutVmMessage;

/**
 * Default response for actions
 */
export interface DefaultResponse extends MessageBase {
  type: "ack";
}

export type ResponseMessage = DefaultResponse;

/**
 * All messages
 */
export type AnyMessage = RequestMessage | ResponseMessage;
