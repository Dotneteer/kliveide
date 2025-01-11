import { MainGeneralResponse } from "./any-to-main";
import { ErrorResponse } from "./messages-core";
import { MessengerBase } from "./MessengerBase";

/**
 * Builds a messaging proxy for the given target object
 * @param proxyTarget Object to build the proxy for
 * @param messenger Messenger to use for communication
 * @returns The resulting proxy object
 */
export function buildMessagingProxy(proxyTarget: any, messenger: MessengerBase): any {
  // --- Sends a message to the main process, turns error responses into exceptions
  const sendMessage = async (propName: string, ...args: any[]) => {
    const response = (await messenger.sendMessage({
      type: "MainGeneralRequest",
      method: propName,
      args
    })) as MainGeneralResponse | ErrorResponse;
    if (response.type === "ErrorResponse") {
      throw new Error(response.message);
    }
    return response.result;
  };

  return new Proxy(proxyTarget, {
    // --- Return a proxy function that sends a message to the main process
    get: function (target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value === "function") {
        return function (...args: any[]) {
          return sendMessage(prop.toString(), ...args);
        };
      }
      return value;
    },

    set: function () {
      throw new Error("Setting properties on the messaging proxy is not allowed.");
    }
  });
}
