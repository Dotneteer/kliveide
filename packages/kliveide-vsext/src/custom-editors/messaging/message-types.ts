/**
 * Represents all message types
 */
export type AnyMessage = RendererMessage | MainMessage;

/**
 * The messages a renderer process can send to the main process
 */
export type RendererMessage = GetMemoryContents;

/**
 * The messages the main process can send as an acknowledgement
 */
export type MainMessage = DefaultResponse | GetMemoryContentsResponse;

/**
 * Represents the common root type of all messages
 */
export interface MessageBase {
  type: AnyMessage["type"];
  correlationId?: number;
}

/**
 * Gets the memory contents
 */
export interface GetMemoryContents extends MessageBase {
  type: "getMemoryContents";
  from: number;
  to: number
}

/**
 * Response for the GetMemoryContents message
 */
export interface GetMemoryContentsResponse extends MessageBase {
  type: "ackGetMemoryContents";
  bytes: string;
}

/**
 * Default response for actions
 */
export interface DefaultResponse extends MessageBase {
  type: "ack";
}
