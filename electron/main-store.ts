import { Action } from "../common/state/Action";
import createAppStore from "../common/state/store";
import { sendFromMainToEmu } from "../common/messaging/MainToEmuMessenger";

/**
 * This instance represents the state store in the EMU renderer
 */
export const mainStore = createAppStore(async (action: Action) => {
    await sendFromMainToEmu({
        type: "ForwardAction",
        action
    });
});