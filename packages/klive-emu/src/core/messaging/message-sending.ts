import { RequestMessage, ResponseMessage } from "./message-types";
import { MessengerBase } from "./MessengerBase";

// --- Messenger instances
let mainToEmu: MessengerBase | null = null;
let mainToIde: MessengerBase | null = null;
let emuToMain: MessengerBase | null = null;
let ideToMain: MessengerBase | null = null;
let ideToEmu: MessengerBase | null = null;

/**
 * Registers the object that can send messages from the Main process to Emu
 * @param messenger Messenger to register
 */
export function registerMainToEmuMessenger(messenger: MessengerBase): void {
  mainToEmu = messenger;
}

/**
 * Registers the object that can send messages from the Main process to Ide
 * @param messenger Messenger to register
 */
export function registerMainToIdeMessenger(messenger: MessengerBase): void {
  mainToIde = messenger;
}

/**
 * Registers the object that can send messages from the Emu process to Main
 * @param messenger Messenger to register
 */
export function registerEmuToMainMessenger(messenger: MessengerBase): void {
  emuToMain = messenger;
}

/**
 * Registers the object that can send messages from the Ide process to Main
 * @param messenger Messenger to register
 */
export function registerIdeToMainMessenger(messenger: MessengerBase): void {
  ideToMain = messenger;
}

/**
 * Registers the object that can send messages from the Ide process to Emu
 * @param messenger Messenger to register
 */
export function registerIdeToEmuMessenger(messenger: MessengerBase): void {
  ideToEmu = messenger;
}

/**
 * Checks if there is a messenger from the Main process to Emu registered
 */
export function hasMainToEmuMessenger(): boolean {
  return !!mainToEmu;
}

/**
 * Gets the messenger object to send messages from the Main process to Emu
 */
export function getMainToEmuMessenger(): MessengerBase {
  if (!mainToEmu) {
    throw new Error("No messenger object from Main to Emu has been registered");
  }
  return mainToEmu;
}

/**
 * Checks if there is a messenger from the Main process to Ide registered
 */
export function hasMainToIdeMessenger(): boolean {
  return !!mainToIde;
}

/**
 * Gets the messenger object to send messages from the Main process to Emu
 */
export function getMainToIdeMessenger(): MessengerBase {
  if (!mainToEmu) {
    throw new Error("No messenger object from Main to Ide has been registered");
  }
  return mainToIde;
}

/**
 * Checks if there is a messenger from the Emu process to Main registered
 */
export function hasEmuToMainMessenger(): boolean {
  return !!emuToMain;
}

/**
 * Gets the messenger object to send messages from the Emu process to Main
 */
export function getEmuToMainMessenger(): MessengerBase {
  if (!emuToMain) {
    throw new Error("No messenger object from Emu to Main has been registered");
  }
  return emuToMain;
}

/**
 * Checks if there is a messenger from the Ide process to Main registered
 */
export function hasIdeToMainMessenger(): boolean {
  return !!ideToMain;
}

/**
 * Gets the messenger object to send messages from the Ide process to Main
 */
export function getIdeToMainMessenger(): MessengerBase {
  if (!ideToMain) {
    throw new Error("No messenger object from Ide to Main has been registered");
  }
  return ideToMain;
}

/**
 * Checks if there is a messenger from the Ide process to Emu registered
 */
export function hasIdeToEmuMessenger(): boolean {
  return !!ideToEmu;
}

/**
 * Gets the messenger object to send messages from the Ide process to Emu
 */
export function getIdeToEmuMessenger(): MessengerBase {
  if (!ideToEmu) {
    throw new Error("No messenger object from Ide to Emu has been registered");
  }
  return ideToEmu;
}

/**
 * Sends the specified message from the Main process to Emu
 * @param message Message to send
 * @returns Response
 */
export async function sendFromMainToEmu<TResp extends ResponseMessage>(
  message: RequestMessage
): Promise<TResp> {
  return await getMainToEmuMessenger().sendMessage(message);
}

/**
 * Sends the specified message from the Main process to Ide
 * @param message Message to send
 * @returns Response
 */
export async function sendFromMainToIde<TResp extends ResponseMessage>(
  message: RequestMessage
): Promise<TResp> {
  return await getMainToIdeMessenger().sendMessage(message);
}

/**
 * Sends the specified message from the Emu process to Main
 * @param message Message to send
 * @returns Response
 */
export async function sendFromEmuToMain<TResp extends ResponseMessage>(
  message: RequestMessage
): Promise<TResp> {
  return await getEmuToMainMessenger().sendMessage(message);
}

/**
 * Sends the specified message from the Ide process to Emu
 * @param message Message to send
 * @returns Response
 */
export async function sendFromIdeToEmu<TResp extends ResponseMessage>(
  message: RequestMessage
): Promise<TResp> {
  return await getIdeToEmuMessenger().sendMessage(message);
}
