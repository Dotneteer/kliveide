import { Action } from "../../common/state/Action";
import createAppStore from "../../common/state/store";
import { sendFromMainToEmu } from "../../common/messaging/MainToEmuMessenger";
import { MessageSource } from "../../common/messaging/messages-core";
import { sendFromMainToIde } from "../../common/messaging/MainToIdeMessenger";
import { ForwardActionRequest } from "@messaging/forwarding";

/**
 * This instance represents the state store in the EMU renderer
 */
export const mainStore = createAppStore(
  async (action: Action, sourceId: MessageSource) => {
    const forwardingMessage: ForwardActionRequest = {
      type: "ForwardAction",
      action,
      sourceId
    };
    switch (sourceId) {
      case "emu":
        // --- Send Emu message to Ide
        await sendFromMainToIde(forwardingMessage);
        break;

      case "ide":
        // --- Send Ide message to Emu
        await sendFromMainToEmu(forwardingMessage);
        break;

      case "main":
        await sendFromMainToEmu(forwardingMessage);
        await sendFromMainToIde(forwardingMessage);
        break;
    }
  }
);
