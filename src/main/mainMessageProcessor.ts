import * as fs from "fs";
import * as path from "path";

import {
  RendererMessage,
  DefaultResponse,
  GetDefaultTapeSetResponse,
} from "../shared/messaging/message-types";
import { MainMessage } from "../shared/messaging/message-types";

export let z80MemoryContents: string = "none";

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
    case "setZ80Memory":
      z80MemoryContents = message.contents;
      return <DefaultResponse>{
        type: "ack"
      }
    default:
      return <DefaultResponse>{ type: "ack" };
  }
}
