import { Action } from "../state/Action";

/**
 * Potential message sources
 */
 export type MessageSource = "emu" | "ide" | "main";

 export type Channel =
    | "MainToEmu"
    | "MainToEmuResponse"
    | "EmuToMain"
    | "EmuToMainResponse"
    
/**
 * The common base for all message types
 */
 export interface MessageBase {
    type: AnyMessage["type"];
    correlationId?: number;
    sourceId?: MessageSource;
    targetid?: MessageSource;
  }

// ================================================================================================
// Common request types

/**
 * This message type forwards an action from the main process to the emulator or vice versa
 */
export interface ForwardActionRequest extends MessageBase {
  type: "ForwardAction",
  action: Action
}

// ================================================================================================
// Main to emulator requests

/**
 * The main process signs that the emulator should change to a new emulated machine type
 */
export interface EmuSetMachineTypeRequest extends MessageBase {
  type: "EmuSetMachineType",
  machineId: string;
}



/**
 * Default response for actions
 */
export interface DefaultResponse extends MessageBase {
    type: "Ack";
}


/**
 * All request messages
 */
export type RequestMessage = 
  | ForwardActionRequest
  | EmuSetMachineTypeRequest;

/**
 * All Response messages
 */
export type ResponseMessage = DefaultResponse;

/**
 * All messages
 */
export type AnyMessage = RequestMessage | ResponseMessage;

// ----------------------------------------------------------------------------
// Message creators

export function defaultResponse(): DefaultResponse {
  return { type: "Ack" };
}

