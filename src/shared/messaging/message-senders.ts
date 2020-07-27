import { GetDefaultTapeSetResponse } from "./message-types";
import { sendMessageToMain } from "./messaging-core";

/**
 * Get the screen size
 */
export function getDefaultTapeSet(): Promise<GetDefaultTapeSetResponse> {
  return sendMessageToMain<GetDefaultTapeSetResponse>({
    type: "getDefaultTapeSet",
  });
}
