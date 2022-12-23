import { defaultResponse, RequestMessage, ResponseMessage } from "@messaging/message-types";
import { emuStore } from "./emu/emu-store";
import { IdeServices } from "./ide/abstractions";

/**
 * Process the messages coming from the emulator to the main process
 * @param message Emulator message
 * @returns Message response
 */
 export async function processMainToEmuMessages(
    message: RequestMessage,
    {
        machineService
    }: IdeServices
): Promise<ResponseMessage> {
    switch (message.type) {
        case "ForwardAction":
            // --- The emu sent a state change action. Replay it in the main store without formarding it
            emuStore.dispatch(message.action, false);
            return defaultResponse();
        
        case "EmuSetMachineType":
            // --- Change the current machine type to a new one
            await machineService.setMachineType(message.machineId);
            return defaultResponse();
    }
    return defaultResponse();
}