import { emulatorRequestTypeAction } from "../shared/state/redux-emulator-state";
import {
  RequestMessage,
  DefaultResponse,
  AppConfigResponse,
} from "../shared/messaging/message-types";
import { ResponseMessage } from "../shared/messaging/message-types";
import { appConfiguration } from "./klive-configuration";
import { mainProcessStore } from "./mainProcessStore";

/**
 * Processes messages from the renderer process
 * @param message Message from the renderer
 */
export function processMessageFromRenderer(message: RequestMessage): ResponseMessage {
  switch (message.type) {
    case "rendererStarted":
      const startupType = appConfiguration?.machineType ?? "48";
      mainProcessStore.dispatch(emulatorRequestTypeAction(startupType)());
      return <AppConfigResponse>{
        type: "appConfigResponse",
        config: appConfiguration,
      };
    default:
      return <DefaultResponse>{ type: "ack" };
  }
}
