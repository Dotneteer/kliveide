import { sendFromMainToEmu } from "../common/messaging/MainToEmuMessenger";
import { sendFromMainToIde } from "../common/messaging/MainToIdeMessenger";
import type { ForwardActionRequest, MessageSource } from "../common/messaging/messages-core";
import type { Action } from "../common/state/Action";
import createAppStore from "../common/state/store";

export const mainStore = createAppStore("main", async (action: Action, sourceId: MessageSource) => {
  const forwardingMessage: ForwardActionRequest = {
    type: "ForwardAction",
    action,
    sourceId
  };

  switch (sourceId) {
    case "emu":
      await sendFromMainToIde(forwardingMessage);
      break;

    case "ide":
      await sendFromMainToEmu(forwardingMessage);
      break;

    case "main":
      await sendFromMainToEmu(forwardingMessage);
      await sendFromMainToIde(forwardingMessage);
      break;
  }
});
