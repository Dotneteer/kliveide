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
            break;
        
        case "EmuSetMachineType":
            // --- Change the current machine type to a new one
            await machineService.setMachineType(message.machineId);
            break;
        
        case "EmuMachineCommand":
            // --- Execute the specified machine command
            const controller = machineService.getMachineController();
            if (controller) {
                switch (message.command) {
                    case "start":
                        await controller.start();
                        break;
                     case "pause":
                        await controller.pause();
                        break;
                    case "stop":
                        await controller.stop();
                        break;
                    case "restart":
                        await controller.restart();
                        break;
                    case "debug":
                        await controller.startDebug();
                        break;
                    case "stepInto":
                        await controller.stepInto();
                        break;
                    case "stepOver":
                        await controller.stepOver();
                        break;
                    case "stepOut":
                        await controller.stepOut();
                        break;
                }
            }
            break;
    }
    return defaultResponse();
}