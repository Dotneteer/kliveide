import { Action } from "@state/Action";
import createAppStore from "@state/store";
import { emuToMainMessenger } from "./EmuToMainMessenger";

/**
 * This instance represents the state store in the EMU renderer
 */
export const emuStore = createAppStore(async (action: Action) => {
    await emuToMainMessenger.sendMessage({
        type: "ForwardAction",
        action
    });
});