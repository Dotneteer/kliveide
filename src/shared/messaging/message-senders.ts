import { ScreenSizeResponse } from "./message-types";
import { sendMessageToMain } from "./messaging-core";

/**
 * Get the screen size
 */
export function queryScreenSize(): Promise<ScreenSizeResponse> {
  return sendMessageToMain<ScreenSizeResponse>({
    type: "getScreenSize",
  });
}
