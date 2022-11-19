import { Action } from "@state/Action";
import createAppStore from "@state/store";
import { sendFromEmuToMain } from "./EmuToMainMessenger";

/**
 * This instance represents the state store in the EMU renderer
 */
export const emuStore = createAppStore(async (action: Action) => {
    await sendFromEmuToMain({
        type: "ForwardAction",
        action
    });
});