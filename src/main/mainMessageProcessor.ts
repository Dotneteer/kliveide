import { RendererMessage, DefaultResponse, ScreenSizeResponse } from "../shared/messaging/message-types";
import { MainMessage } from "../shared/messaging/message-types";

/**
 * Processes messages from the renderer process
 * @param message Message from the renderer
 */
export function processRendererMessage(message: RendererMessage): MainMessage {
  switch (message.type) {
    case "getScreenSize":
      return <ScreenSizeResponse>{
          type: "ackGetScreenSize",
          width: 256,
          height: 192
      }
    default:
      return <DefaultResponse>{ type: "ack" };
  }
}
