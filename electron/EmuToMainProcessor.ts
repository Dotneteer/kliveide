import { defaultResponse, RequestMessage, ResponseMessage } from "@messaging/message-types";

/**
 * Process the messages coming from the emulator to the main process
 * @param message Emulator message
 * @returns Message response
 */
export async function processEmuToMainMessages(
    message: RequestMessage
): Promise<ResponseMessage> {
    return defaultResponse();
}