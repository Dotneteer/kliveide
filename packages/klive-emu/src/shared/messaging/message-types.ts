import { AppState } from "../state/AppState";
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
 * All requests
 */
export type RequestMessage = ForwardActionMessage;

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
