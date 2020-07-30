import { GetDefaultTapeSetResponse, SetZ80Memory, DefaultResponse } from "./message-types";
import { sendMessageToMain } from "./messaging-core";

/**
 * Get the screen size
 */
export function getDefaultTapeSet(): Promise<GetDefaultTapeSetResponse> {
  return sendMessageToMain<GetDefaultTapeSetResponse>({
    type: "getDefaultTapeSet",
  });
}

export function setZ80Memory(contents: string): Promise<DefaultResponse> {
  return sendMessageToMain<DefaultResponse>({
    type: "setZ80Memory",
    contents
  });
}
