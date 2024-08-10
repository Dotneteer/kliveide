import { Action } from "@state/Action";
import createAppStore from "@state/store";
import { sendFromMainToEmu } from "@messaging/MainToEmuMessenger";
import { MessageSource } from "@messaging/messages-core";
import { sendFromMainToIde } from "@messaging/MainToIdeMessenger";
import { ForwardActionRequest } from "@messaging/forwarding";

/**
 * This instance represents the state store in the EMU renderer
 */
export const mainStore = createAppStore("main",
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
