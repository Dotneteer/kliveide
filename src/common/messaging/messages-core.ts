// ====================================================================================================================
// This file contains the abstractions the app uses with messaging.
//
// |------------------------|   |------------------------|
// |       EMU process      |   |       IDE process      |
// | |--------------------| |   | |--------------------| |
// | | EmuToMainMessenger | |   | | IdeToMainMessenger | |
// |-|--------------------|-|   |-|--------------------|-|
//       ^            ^               ^            ^
//       |            |               |            |
//       v            v               v            v
// | |--------------------|-------|--------------------| |
// | | MainToEmuMessenger |       | MainToIdeMessenger | |
// | |--------------------|       |--------------------| |
// |                     MAIN process                    |
// |-----------------------------------------------------|
//
// Floating document windows (`dev/plans/FLOATING_DOCUMENT_WINDOWS_PLAN.md`) are IDE renderers in
// "satellite" mode: each is a further renderer with its own source (`float1`..`float8`) and its own
// `FloatToMainMessenger` / `MainToFloatMessenger` pair.
// ====================================================================================================================

import { Action } from "@common/state/Action";

/**
 * The most floating document windows that may be open at a time. Each is a renderer process with its
 * own Monaco and services: about 310 MB of working set measured (FLOATING_DOCUMENT_WINDOWS_PLAN §7),
 * so the project author lowered the plan's 8 to 4.
 */
export const MAX_FLOATING_WINDOWS = 4;

/**
 * The slot number of a floating document window (1..MAX_FLOATING_WINDOWS)
 */
export type FloatSlot = 1 | 2 | 3 | 4;

/**
 * The message source of a floating document window
 */
export type FloatSource = `float${FloatSlot}`;

/**
 * Potential message sources
 */
export type MessageSource = "emu" | "ide" | "main" | FloatSource;

/**
 * Tests whether the specified message source is a floating document window
 */
export function isFloatSource(source: unknown): source is FloatSource {
  return typeof source === "string" && floatSlotOf(source) !== undefined;
}

/**
 * Gets the slot of a floating window source; undefined when the source is not a floating window's
 */
export function floatSlotOf(source: string | undefined): FloatSlot | undefined {
  const match = /^float([1-9]\d*)$/.exec(source ?? "");
  if (!match) return undefined;
  const slot = Number(match[1]);
  return isFloatSlot(slot) ? slot : undefined;
}

/**
 * Tests whether a number is a valid floating window slot
 */
export function isFloatSlot(slot: unknown): slot is FloatSlot {
  return Number.isInteger(slot) && (slot as number) >= 1 && (slot as number) <= MAX_FLOATING_WINDOWS;
}

/**
 * The message source of the floating window in the specified slot
 */
export function floatSourceOf(slot: FloatSlot): FloatSource {
  return `float${slot}` as FloatSource;
}

/**
 * Available message channels
 */
export type Channel =
  | "MainToEmu"
  | "MainToEmuResponse"
  | "EmuToMain"
  | "EmuToMainResponse"
  | "MainToIde"
  | "MainToIdeResponse"
  | "IdeToMain"
  | "IdeToMainResponse"
  | "MainToFloat"
  | "MainToFloatResponse"
  | "FloatToMain"
  | "FloatToMainResponse";

/**
 * The common base for all message types
 */
export interface MessageBase {
  type: AnyMessage["type"];
  correlationId?: number;
  sourceId?: MessageSource;
  targetId?: MessageSource;
}

/**
 * This message type forwards an action from the main process to the emulator or vice versa
 */
export interface ForwardActionRequest extends MessageBase {
  type: "ForwardAction";
  action: Action;
}

export interface ApiMethodRequest extends MessageBase {
  type: "ApiMethodRequest";
  method: string;
  args: any;
}

/**
 * Default response for actions
 */
export interface NotReadyResponse extends MessageBase {
  type: "NotReady";
}

/**
 * Default response for actions
 */
export interface DefaultResponse extends MessageBase {
  type: "Ack";
}

/**
 * Send back error messages
 */
export interface ErrorResponse extends MessageBase {
  type: "ErrorResponse";
  message: string;
}

export interface ApiMethodResponse extends MessageBase {
  type: "ApiMethodResponse";
  result: any;
}

/**
 * All request messages
 */
export type RequestMessage =
  | ForwardActionRequest
  | ApiMethodRequest;

/**
 * All Response messages
 */
export type ResponseMessage =
  | ApiMethodResponse
  | NotReadyResponse
  | DefaultResponse
  | ErrorResponse;

/**
 * All messages
 */
export type AnyMessage = RequestMessage | ResponseMessage;

/**
 * Raised when a message cannot be delivered because the destination window no longer exists.
 *
 * This is an expected condition while the application is shutting down (state changes are still
 * dispatched as windows are torn down), so callers that merely mirror state - such as the action
 * forwarders - may ignore it. Callers awaiting a real result should treat it as a failure.
 */
export class TargetWindowUnavailableError extends Error {
  constructor (message: string) {
    super(message);
    this.name = "TargetWindowUnavailableError";
  }
}

/**
 * Creates the default response message (no result)
 */
export function defaultResponse (): DefaultResponse {
  return { type: "Ack" };
}

/**
 * Creates an error response
 * @param message Error message
 */
export function errorResponse (message: string): ErrorResponse {
  return {
    type: "ErrorResponse",
    message
  };
}
