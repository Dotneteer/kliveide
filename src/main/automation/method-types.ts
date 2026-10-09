import type {
  AutomationEvent,
  AutomationLevel,
  WaitResult,
  WaitUntil
} from "@common/automation/protocol";
import type { AutomationHost } from "./host";
import { invalidParams } from "./errors";

/*
 * The shapes the method table and its handlers share (`.plans/COMMAND_LINE_AUTOMATION_PLAN.md` D7,
 * D8, D14).
 */

/** One client connection, as a handler sees it */
export type ConnectionState = {
  id: number;
  /** The name the client gave in `session.hello` */
  client: string;
  level: AutomationLevel;
  /** The notifications this connection asked for (D11) */
  subscriptions: Set<AutomationEvent>;
};

/** What a handler is given besides its parameters */
export type MethodContext = {
  host: AutomationHost;
  connection: ConnectionState;
  /** This request's server-side timeout */
  timeoutMs: number;
  /** Resolves when the machine reaches a state (`machine.wait`, built on the store subscription) */
  waitForMachine(until: WaitUntil[], timeoutMs: number | undefined): Promise<WaitResult>;
  /** Sends a notification to every subscribed connection */
  publish(event: AutomationEvent, params: Record<string, unknown>): void;
};

export type MethodDefinition = {
  /** The level a connection needs; "none" only for `session.hello` (D7) */
  level: AutomationLevel | "none";
  /**
   * Run in the one global queue, in arrival order (D14). Waits and the session's own methods are
   * not, so they can never be stuck behind a long build.
   */
  queued: boolean;
  /** Held until both windows are up and the machine is set up (T2) */
  needsReady: boolean;
  /** No server-side timeout: the method bounds itself (`machine.wait`'s own `timeoutMs`; D14) */
  unbounded?: boolean;
  handler(params: Record<string, unknown>, ctx: MethodContext): Promise<unknown>;
};

export type MethodTable = Record<string, MethodDefinition>;

// ================================================================================================
// Parameter readers: each throws an `invalid-params` error naming the parameter

export function optionalString(params: Record<string, unknown>, name: string): string | undefined {
  const value = params[name];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") throw invalidParams(`'${name}' must be a string.`);
  return value;
}

export function requireString(params: Record<string, unknown>, name: string): string {
  const value = optionalString(params, name);
  if (value === undefined || !value.trim()) throw invalidParams(`'${name}' is required.`);
  return value;
}

/** A string that is one line: a command or a breakpoint spec can never smuggle a second one */
export function requireSingleLine(params: Record<string, unknown>, name: string): string {
  const value = requireString(params, name);
  if (/[\r\n\u2028\u2029]/.test(value)) throw invalidParams(`'${name}' must be a single line.`);
  return value.trim();
}

/**
 * A number, or a string in the IDE's notations: `$8000`, `0x8000`, `%1010`, `#8000` or decimal.
 */
export function parseNumberText(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "string") return undefined;
  const text = value.trim().replace(/_/g, "");
  let match: RegExpMatchArray | null;
  if ((match = text.match(/^(?:\$|0x|#)([0-9a-f]+)$/i))) return parseInt(match[1], 16);
  if ((match = text.match(/^%([01]+)$/))) return parseInt(match[1], 2);
  if ((match = text.match(/^([0-9a-f]+)h$/i))) return parseInt(match[1], 16);
  if (/^-?[0-9]+$/.test(text)) return parseInt(text, 10);
  return undefined;
}

export function optionalInt(
  params: Record<string, unknown>,
  name: string,
  min: number,
  max: number
): number | undefined {
  const raw = params[name];
  if (raw === undefined || raw === null) return undefined;
  const value = parseNumberText(raw);
  if (value === undefined || !Number.isInteger(value)) {
    throw invalidParams(`'${name}' must be an integer.`);
  }
  if (value < min || value > max) {
    throw invalidParams(`'${name}' must be between ${min} and ${max}.`);
  }
  return value;
}

export function requireInt(params: Record<string, unknown>, name: string, min: number, max: number): number {
  const value = optionalInt(params, name, min, max);
  if (value === undefined) throw invalidParams(`'${name}' is required.`);
  return value;
}

export function optionalBoolean(params: Record<string, unknown>, name: string): boolean | undefined {
  const value = params[name];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "boolean") throw invalidParams(`'${name}' must be true or false.`);
  return value;
}
