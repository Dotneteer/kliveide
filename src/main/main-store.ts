import { Action } from "@state/Action";
import createAppStore from "@state/store";
import { sendFromMainToEmu } from "@messaging/MainToEmuMessenger";
import { MessageSource, floatSourceOf } from "@messaging/messages-core";
import { sendFromMainToIde } from "@messaging/MainToIdeMessenger";
import { getFloatSlots, sendFromMainToFloat } from "@messaging/MainToFloatMessenger";
import { ForwardActionRequest } from "@messaging/messages-core";
import { deliverForwardedAction, type RendererTarget } from "./renderer-routing";

/**
 * The renderers that can receive state: the emulator, the IDE and every open floating window
 */
export function getLiveRendererTargets(): RendererTarget[] {
  return [
    { id: "emu", send: (message) => sendFromMainToEmu(message) },
    { id: "ide", send: (message) => sendFromMainToIde(message) },
    ...getFloatSlots().map((slot) => ({
      id: floatSourceOf(slot),
      send: (message) => sendFromMainToFloat(slot, message)
    }))
  ];
}

/**
 * This instance represents the state store in the main process. An action is delivered to every
 * live renderer except the one it came from (`dev/plans/FLOATING_DOCUMENT_WINDOWS_PLAN.md` §3.2).
 */
export const mainStore = createAppStore("main",
  async (action: Action, sourceId: MessageSource) => {
    const forwardingMessage: ForwardActionRequest = {
      type: "ForwardAction",
      action,
      sourceId
    };
    await deliverForwardedAction(forwardingMessage, getLiveRendererTargets());
  }
);
