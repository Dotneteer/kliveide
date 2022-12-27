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
  type: "ForwardAction";
  action: Action
}

// ================================================================================================
// Main to emulator requests

/**
 * The main process signs that the emulator should change to a new emulated machine type
 */
export interface EmuSetMachineTypeRequest extends MessageBase {
  type: "EmuSetMachineType";
  machineId: string;
}

export type MachineCommand = 
  | "start" 
  | "pause" 
  | "stop" 
  | "restart" 
  | "debug" 
  | "stepInto" 
  | "stepOver" 
  | "stepOut";

/**
 * The main process sends a machine command to the emulator
 */
export interface EmuMachineCommandRequest extends MessageBase {
  type: "EmuMachineCommand";
  command: MachineCommand;
}

/**
 * The main process sends a tape file to the emulator
 */
export interface EmuSetTapeFileRequest extends MessageBase {
  type: "EmuSetTapeFile";
  contents: Uint8Array;
}

// ================================================================================================
// IDE or Emu to main requests

/**
 * The client sends a text file read request
 */
export interface MainReadTextFileRequest extends MessageBase {
  type: "MainReadTextFile";
  path: string;
  encoding?: string;
}

/**
 * The client sends a binary file read request
 */
export interface MainReadBinaryFileRequest extends MessageBase {
  type: "MainReadBinaryFile";
  path: string;
}

/**
 * Default response for actions
 */
export interface DefaultResponse extends MessageBase {
    type: "Ack";
}

export interface ErrorResponse extends MessageBase {
  type: "Error";
  message: string;
}

/**
 * Response for text file read action
 */
export interface TextContentsResponse extends MessageBase {
  type: "TextContents";
  contents: string
}

/**
 * Response for binary file read action
 */
export interface BinaryContentsResponse extends MessageBase {
  type: "BinaryContents";
  contents: Uint8Array;
}

/**
 * All request messages
 */
export type RequestMessage = 
  | ForwardActionRequest
  | EmuSetMachineTypeRequest
  | EmuMachineCommandRequest
  | EmuSetTapeFileRequest
  | MainReadTextFileRequest
  | MainReadBinaryFileRequest;

/**
 * All Response messages
 */
export type ResponseMessage = 
  | DefaultResponse
  | ErrorResponse
  | TextContentsResponse
  | BinaryContentsResponse;

/**
 * All messages
 */
export type AnyMessage = RequestMessage | ResponseMessage;

// ------------------------------------------------------------------------------------------------
// Message creators

export function createMachineCommand(command: MachineCommand): EmuMachineCommandRequest {
  return {
    type: "EmuMachineCommand",
    command
  }
}

export function defaultResponse(): DefaultResponse {
  return { type: "Ack" };
}

export function errorResponse(message: string): ErrorResponse {
  return {
    type: "Error",
    message
  }
}

export function textContentsResponse(contents: string): TextContentsResponse {
  return {
    type: "TextContents",
    contents
  }
}

export function binaryContentsResponse(contents: Uint8Array): BinaryContentsResponse {
  return {
    type: "BinaryContents",
    contents
  }
}
