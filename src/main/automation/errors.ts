import {
  type AutomationErrorData,
  type AutomationErrorKind,
  type JsonRpcError,
  JSONRPC_INTERNAL_ERROR,
  JSONRPC_INVALID_PARAMS,
  KLIVE_SERVER_ERROR
} from "@common/automation/protocol";
import { MACHINE_NOT_AVAILABLE_MESSAGE } from "@common/messaging/EmuApi";

/**
 * An error a method reports to its caller as a JSON-RPC error with `data.kind`
 * (`.plans/COMMAND_LINE_AUTOMATION_PLAN.md` §4.2).
 */
export class AutomationError extends Error {
  constructor(
    message: string,
    public readonly data: AutomationErrorData,
    public readonly code: number = data.kind === "invalid-params" ? JSONRPC_INVALID_PARAMS : KLIVE_SERVER_ERROR
  ) {
    super(message);
  }

  toJsonRpc(): JsonRpcError {
    return { code: this.code, message: this.message, data: this.data };
  }
}

/** Creates an `AutomationError` */
export function automationError(
  kind: AutomationErrorKind,
  message: string,
  extra?: Omit<AutomationErrorData, "kind">
): AutomationError {
  return new AutomationError(message, { kind, ...extra });
}

/** A parameter problem */
export function invalidParams(message: string): AutomationError {
  return automationError("invalid-params", message);
}

/**
 * Any thrown value as a JSON-RPC error. "No machine" from the emulator (a machine is being rebuilt)
 * gets its own kind, so a script can retry it.
 */
export function toJsonRpcError(err: unknown): JsonRpcError {
  if (err instanceof AutomationError) return err.toJsonRpc();
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes(MACHINE_NOT_AVAILABLE_MESSAGE)) {
    return { code: KLIVE_SERVER_ERROR, message, data: { kind: "no-machine" } };
  }
  return { code: JSONRPC_INTERNAL_ERROR, message };
}
