import { KliveConfiguration } from "./emu-configurations";

export interface MessageBase {
  type: AnyMessage["type"];
  correlationId?: number;
}

/**
 * This message sings that the renderer has started
 */
export interface SignRendererStartedMessage extends MessageBase {
  type: "rendererStarted";
}

/**
 * The messages a renderer process can send to the main process
 */
export type RendererMessage = SignRendererStartedMessage;

/**
 * Default response for actions
 */
export interface DefaultResponse extends MessageBase {
  type: "ack";
}

export interface AppConfigResponse extends MessageBase {
  type: "appConfigResponse";
  config: KliveConfiguration | null;
}

/**
 * The messages the main process can send as an acknowledgement
 */
export type MainMessage = DefaultResponse | AppConfigResponse;

/**
 * All messages between renderer and main
 */
export type AnyMessage = RendererMessage | MainMessage;
