import { Action } from "@state/Action";

/**
 * Potential message sources
 */
 export type MessageSource = "emu" | "ide" | "main";

 export type Channel =
    | "MainToEmu"
    | "MainToIde"
    | "EmuToMain"
    | "IdeToMain";

/**
 * The common base for all message types
 */
 export interface MessageBase {
    type: AnyMessage["type"];
    correlationId?: number;
    sourceId?: MessageSource;
    targetid?: MessageSource;
  }

/**
 * Default response for actions
 */
export interface DefaultResponse extends MessageBase {
    type: "Ack";
}

export interface ForwardActionRequest extends MessageBase {
    type: "ForwardAction",
    action: Action
}

/**
 * All request messages
 */
export type RequestMessage = ForwardActionRequest;

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

