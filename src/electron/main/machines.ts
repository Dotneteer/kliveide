import { sendFromMainToEmu } from "../../common/messaging/MainToEmuMessenger";

/**
 * This function set the machine type to the specified one
 * @param machineId 
 */
export async function setMachineType(machineId: string): Promise<void> {
    await sendFromMainToEmu({
        type: "EmuSetMachineType",
        machineId
    });
}