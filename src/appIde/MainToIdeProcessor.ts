import {
  defaultResponse,
  RequestMessage,
  ResponseMessage
} from "@messaging/messages-core";
import { AppServices } from "../ide/abstractions";
import { MessengerBase } from "@messaging/MessengerBase";
import { AppState } from "@state/AppState";
import { Store } from "@state/redux-light";

/**
 * Process the messages coming from the emulator to the main process
 * @param message Emulator message
 * @returns Message response
 */
export async function processMainToIdeMessages (
  message: RequestMessage,
  store: Store<AppState>,
  ideToMain: MessengerBase,
  { machineService }: AppServices
): Promise<ResponseMessage> {
  switch (message.type) {
    case "ForwardAction":
      // --- The emu sent a state change action. Replay it in the main store without formarding it
      store.dispatch(message.action, message.sourceId);
      break;
  }
  return defaultResponse();
}
