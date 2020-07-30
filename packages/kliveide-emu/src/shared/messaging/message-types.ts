export interface MessageBase {
  type: AnyMessage["type"];
  correlationId?: number;
}

/**
 * Gets the default tape set
 */
export interface GetDefaultTapeSet extends MessageBase {
  type: "getDefaultTapeSet"
}

export interface SetZ80Memory extends MessageBase {
  type: "setZ80Memory",
  contents: string
}

/**
 * The messages a renderer process can send to the main process
 */
export type RendererMessage = GetDefaultTapeSet | SetZ80Memory;

export interface DefaultResponse extends MessageBase {
  type: "ack";
}

export interface GetDefaultTapeSetResponse extends MessageBase {
  type: "ackGetDefaultTapeSet",
  bytes: Uint8Array
}

/**
 * The messages the main process can send as an ackonledgement
 */
export type MainMessage = DefaultResponse | GetDefaultTapeSetResponse;

export type AnyMessage = RendererMessage | MainMessage;
