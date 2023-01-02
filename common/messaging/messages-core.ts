import {
  MainReadTextFileRequest,
  MainReadBinaryFileRequest,
  MainDisplayMessageBoxRequest,
  BinaryContentsResponse,
  TextContentsResponse
} from "./any-to-main";
import { ForwardActionRequest } from "./forwarding";
import {
  EmuSetMachineTypeRequest,
  EmuMachineCommandRequest,
  EmuSetTapeFileRequest
} from "./main-to-emu";

/**
 * Potential message sources
 */
export type MessageSource = "emu" | "ide" | "main";

export type Channel =
  | "MainToEmu"
  | "MainToEmuResponse"
  | "EmuToMain"
  | "EmuToMainResponse"
  | "MainToIde"
  | "MainToIdeResponse"
  | "IdeToMain"
  | "IdeToMainResponse";

/**
 * The common base for all message types
 */
export interface MessageBase {
  type: AnyMessage["type"];
  correlationId?: number;
  sourceId?: MessageSource;
}

/**
 * Default response for actions
 */
export interface DefaultResponse extends MessageBase {
  type: "Ack";
}

/**
 * Send back error messages
 */
export interface ErrorResponse extends MessageBase {
  type: "Error";
  message: string;
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
  | MainReadBinaryFileRequest
  | MainDisplayMessageBoxRequest;

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

export function defaultResponse (): DefaultResponse {
  return { type: "Ack" };
}

export function errorResponse (message: string): ErrorResponse {
  return {
    type: "Error",
    message
  };
}
