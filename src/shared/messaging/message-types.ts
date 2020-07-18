export interface MessageBase {
  type: AnyMessage["type"];
  correlationId?: number;
}

export interface QueryScreenSize extends MessageBase {
  type: "getScreenSize";
}

/**
 * The messages a renderer process can send to the main process
 */
export type RendererMessage = QueryScreenSize;

export interface DefaultResponse extends MessageBase {
  type: "ack";
}

export interface ScreenSizeResponse extends MessageBase {
  type: "ackGetScreenSize";
  width: number;
  height: number;
}

/**
 * The messages the main process can send as an ackonledgement
 */
export type MainMessage = DefaultResponse | ScreenSizeResponse;

export type AnyMessage = RendererMessage | MainMessage;
