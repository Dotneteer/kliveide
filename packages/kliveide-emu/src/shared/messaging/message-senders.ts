import {
  GetDefaultTapeSetResponse,
  SetZ80Memory,
  DefaultResponse,
} from "./message-types";
import { sendMessageToMain } from "./messaging-core";

/**
 * Gets the default tape set
 */
export function getDefaultTapeSet(): Promise<GetDefaultTapeSetResponse> {
  return sendMessageToMain<GetDefaultTapeSetResponse>({
    type: "getDefaultTapeSet",
  });
}

export function setZ80Memory(contents: string): Promise<DefaultResponse> {
  return sendMessageToMain<DefaultResponse>({
    type: "setZ80Memory",
    contents,
  });
}
