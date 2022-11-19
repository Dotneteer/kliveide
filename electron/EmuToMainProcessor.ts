import { defaultResponse, RequestMessage, ResponseMessage } from "../common/messaging/message-types";
import { mainStore } from "./main-store";

/**
 * Process the messages coming from the emulator to the main process
 * @param message Emulator message
 * @returns Message response
 */
export async function processEmuToMainMessages(
    message: RequestMessage
): Promise<ResponseMessage> {
    switch (message.type) {
        case "ForwardAction":
            // --- The emu sent a state change action. Replay it in the main store without formarding it
            mainStore.dispatch(message.action, false);
            return defaultResponse();
    }
    return defaultResponse();
}