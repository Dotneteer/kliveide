// ====================================================================================================================
// This file contains the abstractions the app uses with messaging.
//
// |------------------------|   |------------------------|
// |       EMU process      |   |       IDE process      |
// | |--------------------| |   | |--------------------| |
// | | EmuToMainMessenger | |   | | IdeToMainMessenger | |
// |-|--------------------|-|   |-|--------------------|-|
//       ^            ^               ^            ^
//       |            |               |            |
//       v            v               v            v
// | |--------------------|-------|--------------------| |
// | | MainToEmuMessenger |       | MainToIdeMessenger | |
// | |--------------------|       |--------------------| |
// |                     MAIN process                    |
// |-----------------------------------------------------|
// ====================================================================================================================

import { Action } from "@common/state/Action";

/**
 * Potential message sources
 */
export type MessageSource = "emu" | "ide" | "main";

/**
 * Available message channels
 */
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
  targetId?: MessageSource;
}

/**
 * This message type forwards an action from the main process to the emulator or vice versa
 */
export interface ForwardActionRequest extends MessageBase {
  type: "ForwardAction";
  action: Action;
}

export interface ApiMethodRequest extends MessageBase {
  type: "ApiMethodRequest";
  method: string;
  args: any;
}

/**
 * Default response for actions
 */
export interface NotReadyResponse extends MessageBase {
  type: "NotReady";
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
  type: "ErrorResponse";
  message: string;
}

export interface ApiMethodResponse extends MessageBase {
  type: "ApiMethodResponse";
  result: any;
}

/**
 * All request messages
 */
export type RequestMessage =
  | ForwardActionRequest
  | ApiMethodRequest;

/**
 * All Response messages
 */
export type ResponseMessage =
  | ApiMethodResponse
  | NotReadyResponse
  | DefaultResponse
  | ErrorResponse;

/**
 * All messages
 */
export type AnyMessage = RequestMessage | ResponseMessage;

/**
 * Raised when a message cannot be delivered because the destination window no longer exists.
 *
 * This is an expected condition while the application is shutting down (state changes are still
 * dispatched as windows are torn down), so callers that merely mirror state - such as the action
 * forwarders - may ignore it. Callers awaiting a real result should treat it as a failure.
 */
export class TargetWindowUnavailableError extends Error {
  constructor (message: string) {
    super(message);
    this.name = "TargetWindowUnavailableError";
  }
}

/**
 * Creates the default response message (no result)
 */
export function defaultResponse (): DefaultResponse {
  return { type: "Ack" };
}

/**
 * Creates an error response
 * @param message Error message
 */
export function errorResponse (message: string): ErrorResponse {
  return {
    type: "ErrorResponse",
    message
  };
}
