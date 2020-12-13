/**
 * Represents all message types
 */
export type AnyMessage = RendererMessage | MainMessage;

/**
 * The messages a renderer process can send to the main process
 */
export type RendererMessage =
  | GetMemoryContents
  | GetExecutionState
  | GetRomPage
  | GetBankPage;

/**
 * The messages the main process can send as an acknowledgement
 */
export type MainMessage =
  | DefaultResponse
  | ErrorResponse
  | GetMemoryContentsResponse
  | GetRomPageResponse
  | GetBankPageResponse
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
}

/**
 * Response for the GetMemoryContents message
 */
export interface GetMemoryContentsResponse extends MessageBase {
  type: "ackGetMemoryContents";
  bytes: string;
}

/**
 * Get the ROM page request
 */
export interface GetRomPage extends MessageBase {
  type: "getRomPage";
  page: number;
}

/**
 * Get the ROM page response
 */
export interface GetRomPageResponse extends MessageBase {
  type: "ackGetRomPage";
  bytes: string;
}

/**
 * Get the BANK page request
 */
export interface GetBankPage extends MessageBase {
  type: "getBankPage";
  page: number;
}

/**
 * Get the BANK page response
 */
export interface GetBankPageResponse extends MessageBase {
  type: "ackGetBankPage";
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

/**
 * Error response for actions
 */
export interface ErrorResponse extends MessageBase {
  type: "error";
  errorMessage: string;
}
