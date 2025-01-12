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

import type {
  MainGeneralRequest,
  MainGeneralResponse
} from "./any-to-main";
import type { ForwardActionRequest } from "./forwarding";

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
  __ERROR_RESPONSE__: true;
  message: string;
}

/**
 * Send back flagged messages
 */
export interface FlagResponse extends MessageBase {
  type: "FlagResponse";
  flag: boolean;
}

/**
 * Send back single values
 */
export interface ValueResponse extends MessageBase {
  type: "ValueResponse";
  value: any;
}

/**
 * All request messages
 */
export type RequestMessage =
  | ForwardActionRequest
  | MainGeneralRequest;

/**
 * All Response messages
 */
export type ResponseMessage =
  | MainGeneralResponse
  | NotReadyResponse
  | DefaultResponse
  | ErrorResponse
  | FlagResponse
  | ValueResponse;

/**
 * All messages
 */
export type AnyMessage = RequestMessage | ResponseMessage;

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
    __ERROR_RESPONSE__: true,
    type: "ErrorResponse",
    message
  };
}

/**
 * Creates an error response
 * @param message Error message
 */
export function flagResponse (flag: boolean): FlagResponse {
  return {
    type: "FlagResponse",
    flag
  };
}
