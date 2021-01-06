import { emulatorRequestTypeAction } from "../shared/state/redux-emulator-state";
import {
  RequestMessage,
  DefaultResponse,
  AppConfigResponse,
  GetMachineRomsResponse,
} from "../shared/messaging/message-types";
import { ResponseMessage } from "../shared/messaging/message-types";
import { appConfiguration } from "./klive-configuration";
import { mainProcessStore } from "./mainProcessStore";
import { AppWindow } from "./AppWindow";

/**
 * Processes messages from the renderer process
 * @param message Message from the renderer
 */
export async function processMessageFromRenderer(
  message: RequestMessage
): Promise<ResponseMessage> {
  switch (message.type) {
    case "rendererStarted":
      const startupType = appConfiguration?.machineType ?? "48";
      mainProcessStore.dispatch(emulatorRequestTypeAction(startupType)());
      return <AppConfigResponse>{
        type: "appConfigResponse",
        config: appConfiguration,
      };

    case "getMachineRoms":
      const provider = AppWindow.getContextProvider();
      return <GetMachineRomsResponse>{
        type: "getMachineRomsResponse",
        roms: provider ? provider.getStartupRoms() : [],
      };

    case "setToDefaultMachine": 
      AppWindow.instance.requestMachineType("48");
      return <DefaultResponse>{ type: "ack" };

    default:
      return <DefaultResponse>{ type: "ack" };
  }
}
