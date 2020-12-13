import { CodeToInject } from "../machines/api-data";
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
 * The messages that are send as requests to a processing entity
 */
export type RequestMessage =
  | SignRendererStartedMessage
  | InjectCodeMessage
  | RunCodeMessage
  | GetMemoryContentsMessage;

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
 * The messages that are sent as responses
 */
export type ResponseMessage =
  | DefaultResponse
  | AppConfigResponse
  | GetMemoryContentsResponse;

/**
 * All messages between renderer and main
 */
export type AnyMessage = RequestMessage | ResponseMessage;
