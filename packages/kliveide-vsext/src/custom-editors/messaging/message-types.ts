/**
 * Represents all message types
 */
export type AnyMessage = RendererMessage | MainMessage;

/**
 * The messages a renderer process can send to the main process
 */
export type RendererMessage = GetMemoryContents | GetExecutionState;

/**
 * The messages the main process can send as an acknowledgement
 */
export type MainMessage =
  | DefaultResponse
  | GetMemoryContentsResponse
  | GetExecutionStateResponse;

/**
 * Represents the common root type of all messages
 */
export interface MessageBase {
  type: AnyMessage["type"];
  correlationId?: number;
}

/**
 * Gets the memory contents request
 */
export interface GetMemoryContents extends MessageBase {
  type: "getMemoryContents";
  from: number;
  to: number;
}

/**
 * Response for the GetMemoryContents message
 */
export interface GetMemoryContentsResponse extends MessageBase {
  type: "ackGetMemoryContents";
  bytes: string;
}

/**
 * Gets the memory contents request
 */
export interface GetExecutionState extends MessageBase {
  type: "getExecutionState";
}

/**
 * Gets the memory contents request
 */
export interface GetExecutionStateResponse extends MessageBase {
  type: "ackGetExecutionState";
  state: string;
}

/**
 * Default response for actions
 */
export interface DefaultResponse extends MessageBase {
  type: "ack";
}
