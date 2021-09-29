import { emulatorRequestTypeAction } from "@state/redux-emulator-state";
import {
  RequestMessage,
  DefaultResponse,
  AppConfigResponse,
  GetMachineRomsResponse,
} from "@shared/messaging/message-types";
import { ResponseMessage } from "@shared/messaging/message-types";
import { appConfiguration, appSettings } from "./klive-configuration";
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
      const startupType =
        appSettings?.machineType ?? appConfiguration?.machineType ?? "48";
      mainProcessStore.dispatch(emulatorRequestTypeAction(startupType)());
      await new Promise((r) => setTimeout(r, 600));
      AppWindow.instance.applyStoredSettings(startupType);
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
