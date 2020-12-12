import { emulatorRequestTypeAction } from "../shared/state/redux-emulator-state";
import {
  RendererMessage,
  DefaultResponse,
  AppConfigResponse,
} from "../shared/messaging/message-types";
import { MainMessage } from "../shared/messaging/message-types";
import { appConfiguration } from "./klive-configuration";
import { mainProcessStore } from "./mainProcessStore";

export let z80MemoryContents: string = "none";

/**
 * Processes messages from the renderer process
 * @param message Message from the renderer
 */
export function processRendererMessage(message: RendererMessage): MainMessage {
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
