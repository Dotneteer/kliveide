import * as fs from "fs";
import * as path from "path";

import {
  RendererMessage,
  DefaultResponse,
  GetDefaultTapeSetResponse,
} from "../shared/messaging/message-types";
import { MainMessage } from "../shared/messaging/message-types";

/**
 * Processes messages from the renderer process
 * @param message Message from the renderer
 */
export function processRendererMessage(message: RendererMessage): MainMessage {
  switch (message.type) {
    case "getDefaultTapeSet":
      const fileName = path.join(__dirname, "./tapes/Pac-Man.tzx");
      const contents = fs.readFileSync(fileName);
      return <GetDefaultTapeSetResponse>{
        type: "ackGetDefaultTapeSet",
        bytes: new Uint8Array(contents),
      };
    default:
      return <DefaultResponse>{ type: "ack" };
  }
}
