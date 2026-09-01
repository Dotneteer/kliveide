import { Action } from "@state/Action";
import createAppStore from "@state/store";
import { sendFromMainToEmu } from "@messaging/MainToEmuMessenger";
import { MessageSource } from "@messaging/messages-core";
import { sendFromMainToIde } from "@messaging/MainToIdeMessenger";
import { ForwardActionRequest } from "@messaging/messages-core";

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

      case "main": {
        // --- Deliver to both renderers independently: if one window is unreachable (e.g. it is
        // --- being torn down during shutdown), that must not stop the action from reaching the
        // --- other one. `allSettled` also means a single failure surfaces as one rejection below
        // --- rather than silently cancelling the second send.
        const results = await Promise.allSettled([
          sendFromMainToEmu(forwardingMessage),
          sendFromMainToIde(forwardingMessage)
        ]);
        const failure = results.find((r) => r.status === "rejected") as
          | PromiseRejectedResult
          | undefined;
        if (failure) {
          throw failure.reason;
        }
        break;
      }
    }
  }
);
