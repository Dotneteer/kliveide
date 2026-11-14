import { createIdeApi, IdeApi } from "./IdeApi";
import type { Channel, FloatSlot, RequestMessage, ResponseMessage } from "./messages-core";
import { floatSlotOf, floatSourceOf, TargetWindowUnavailableError } from "./messages-core";
import { MessengerBase } from "./MessengerBase";

import { ipcMain, IpcMainEvent } from "electron";

/**
 * The part of a `BrowserWindow` the messenger needs (a fake one in tests)
 */
export type FloatMessageTarget = {
  isDestroyed(): boolean;
  webContents: { send(channel: string, message: unknown): void };
};

/**
 * Implements a messenger that sends messages from the main process to one floating document
 * window (`dev/plans/FLOATING_DOCUMENT_WINDOWS_PLAN.md` §3.2). There is one instance per open
 * window, created with the window and dropped when it closes.
 */
export class MainToFloatMessenger extends MessengerBase {
  constructor(
    public readonly slot: FloatSlot,
    public readonly window: FloatMessageTarget
  ) {
    super();
  }

  /**
   * Hands a response that arrived on the shared response channel to this messenger
   */
  acceptResponse(response: ResponseMessage): void {
    this.processResponse(response);
  }

  /**
   * Sends out the message
   * @param message Message to send
   */
  protected send(message: RequestMessage): void {
    if (this.window?.isDestroyed() === false) {
      this.window.webContents.send(this.requestChannel, message);
      return;
    }
    throw new TargetWindowUnavailableError(
      `Cannot send '${message.type}' to floating window ${this.slot}: the window no longer exists.`
    );
  }

  get requestChannel(): Channel {
    return "MainToFloat";
  }

  get responseChannel(): Channel {
    return "MainToFloatResponse";
  }
}

type FloatMessengerEntry = {
  messenger: MainToFloatMessenger;
  api: IdeApi;
};

/**
 * The messengers of the open floating windows, by slot
 */
const floatMessengers = new Map<FloatSlot, FloatMessengerEntry>();
let responseListenerRegistered = false;

/**
 * Routes a response arriving on the shared `MainToFloatResponse` channel to the messenger of the
 * window that sent it. The response carries its window's source (`float<slot>`).
 */
export function routeFloatResponse(response: ResponseMessage): boolean {
  const slot = floatSlotOf(response?.sourceId);
  const entry = slot ? floatMessengers.get(slot) : undefined;
  if (!entry) return false;
  entry.messenger.acceptResponse(response);
  return true;
}

function ensureResponseListener(): void {
  if (responseListenerRegistered) return;
  responseListenerRegistered = true;
  ipcMain?.on("MainToFloatResponse", (_ev: IpcMainEvent, response: ResponseMessage) => {
    routeFloatResponse(response);
  });
}

/**
 * Registers the messenger of a newly created floating window
 * @param slot The window's slot
 * @param window The window
 */
export function registerMainToFloatMessenger(
  slot: FloatSlot,
  window: FloatMessageTarget
): MainToFloatMessenger {
  ensureResponseListener();
  const messenger = new MainToFloatMessenger(slot, window);
  floatMessengers.set(slot, {
    messenger,
    api: createIdeApi(messenger, floatSourceOf(slot))
  });
  return messenger;
}

/**
 * Drops the messenger of a closed floating window
 */
export function unregisterMainToFloatMessenger(slot: FloatSlot): void {
  floatMessengers.delete(slot);
}

/**
 * The slots of the floating windows that have a messenger
 */
export function getFloatSlots(): FloatSlot[] {
  return [...floatMessengers.keys()].sort((a, b) => a - b);
}

/**
 * Sends a message to the floating window in the specified slot; null when it has no messenger
 */
export function sendFromMainToFloat<TResp extends ResponseMessage>(
  slot: FloatSlot,
  message: RequestMessage
): Promise<TResp> | null {
  const entry = floatMessengers.get(slot);
  return entry ? entry.messenger.sendMessage(message) : null;
}

/**
 * The IDE API of the floating window in the specified slot
 */
export function getFloatApi(slot: FloatSlot): IdeApi | undefined {
  return floatMessengers.get(slot)?.api;
}

/**
 * The IDE APIs of every open floating window, by slot
 */
export function getFloatApis(): { slot: FloatSlot; api: IdeApi }[] {
  return getFloatSlots().map((slot) => ({ slot, api: floatMessengers.get(slot)!.api }));
}
