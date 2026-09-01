import { ApiMethodResponse, ErrorResponse, MessageSource, NotReadyResponse } from "./messages-core";
import { MessengerBase } from "./MessengerBase";

/**
 * Options that tune how the generated proxy sends its requests.
 */
export type MessagingProxyOptions = {
  /**
   * Names of methods whose duration is genuinely unbounded, and which must therefore never be
   * subject to the default request timeout - typically dialogs that block until the user responds,
   * or operations that run until explicitly stopped. Every other method gets the default timeout,
   * so a lost response surfaces as an error instead of hanging forever.
   */
  unboundedMethods?: readonly string[];
};

/**
 * Builds a messaging proxy for the given target object
 * @param proxyTarget Object to build the proxy for
 * @param messenger Messenger to use for communication
 * @param targetId Target process ID
 * @param options Optional proxy settings
 * @returns The resulting proxy object
 */
export function buildMessagingProxy(
  proxyTarget: any,
  messenger: MessengerBase,
  targetId: MessageSource,
  options?: MessagingProxyOptions
): any {
  const unboundedMethods = new Set(options?.unboundedMethods ?? []);

  // --- Sends a message to the main process, turns error responses into exceptions
  const sendMessage = async (propName: string, ...args: any[]) => {
    const response = (await messenger.sendMessage(
      {
        type: "ApiMethodRequest",
        method: propName,
        targetId,
        args
      },
      unboundedMethods.has(propName) ? { timeoutMs: null } : undefined
    )) as ApiMethodResponse | ErrorResponse | NotReadyResponse;
    if (response.type === "ErrorResponse") {
      throw new Error(response.message);
    }
    if (response.type === "NotReady") {
      // --- The target process received the request but was not initialized enough to handle it.
      // --- This must not be reported as a successful call returning `undefined`, which would let
      // --- the caller silently proceed on missing data.
      throw new Error(
        `The '${targetId}' process was not ready to handle '${propName}'. ` +
          `The request arrived before that process finished initializing.`
      );
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
