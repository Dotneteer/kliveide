import { Action } from "../common/state/Action";
import createAppStore from "../common/state/store";
import { sendFromMainToEmu } from "../common/messaging/MainToEmuMessenger";
import { MessageSource } from "../common/messaging/messages-core";
import { sendFromMainToIde } from "../common/messaging/MainToIdeMessenger";

/**
 * This instance represents the state store in the EMU renderer
 */
export const mainStore = createAppStore(async (action: Action, sourceId: MessageSource) => {
    console.log("Main forwarder", action, sourceId);
    if (sourceId === "emu") {
        await sendFromMainToIde({
            type: "ForwardAction",
            action,
            sourceId
        });
    } else if (sourceId === "ide") {
        await sendFromMainToEmu({
            type: "ForwardAction",
            action,
            sourceId
        });
    }
});