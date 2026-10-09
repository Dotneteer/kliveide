/*
 * The Klive automation protocol, version 1 (`.plans/COMMAND_LINE_AUTOMATION_PLAN.md` D2, D8, §4.2).
 *
 * JSON-RPC 2.0 over a local stream socket (a Unix domain socket, or a named pipe on Windows), one
 * JSON message per line, UTF-8. This module is the contract the server in the main process
 * (`src/main/automation/`) and the `klive ide` client (`src/cli/`) share. It imports nothing, so a
 * Node-only client can use it as it is.
 *
 * **Method and event names are stable API** (D8): renaming one, or changing what it means, needs a
 * protocol version bump. Adding a method or an optional field does not.
 */

/** The protocol version this build speaks */
export const AUTOMATION_PROTOCOL_VERSION = 1;

/** The name of the connection file inside `<klive-home>/run/` (D5) */
export const AUTOMATION_CONNECTION_FILE = "automation.json";

/** The user settings that control the server (D4, D7). Read from user settings only, never a project. */
export const AUTOMATION_ENABLED_SETTING = "automation.enabled";
export const AUTOMATION_LEVEL_SETTING = "automation.level";

/** The command-line switch that turns the server on for one run (D4, Q4) */
export const AUTOMATION_SWITCH = "--automation";

/** The longest request line the server reads (a 64 KB `memory.write` is about 88 KB of base64) */
export const AUTOMATION_MAX_LINE_BYTES = 4 * 1024 * 1024;

/** The most bytes one `memory.read` or `memory.write` moves (D8) */
export const AUTOMATION_MAX_MEMORY_BYTES = 0x10000;

/** The default server-side timeout of a request (D14) */
export const AUTOMATION_DEFAULT_TIMEOUT_MS = 60_000;

// ================================================================================================
// Permission levels (D7)

/** The permission levels, weakest first */
export const AUTOMATION_LEVELS = ["read", "control", "full"] as const;
export type AutomationLevel = (typeof AUTOMATION_LEVELS)[number];

/** The level a connection gets when automation is on and no level is set (D7, Q3) */
export const DEFAULT_AUTOMATION_LEVEL: AutomationLevel = "control";

/** Is `granted` at least `required`? */
export function levelAllows(granted: AutomationLevel, required: AutomationLevel): boolean {
  return AUTOMATION_LEVELS.indexOf(granted) >= AUTOMATION_LEVELS.indexOf(required);
}

/** A setting's value as a level; anything unknown is the default */
export function parseAutomationLevel(value: unknown): AutomationLevel {
  const text = String(value ?? "").trim().toLowerCase();
  return (AUTOMATION_LEVELS as readonly string[]).includes(text)
    ? (text as AutomationLevel)
    : DEFAULT_AUTOMATION_LEVEL;
}

/** A user setting's value as a switch, read the way `set -u` stores it ("1", "true", 1, true) */
export function parseAutomationSwitch(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  return ["1", "true", "yes", "on"].includes(String(value ?? "").trim().toLowerCase());
}

// ================================================================================================
// Methods (D8, §4.2)

/** Every method of protocol 1 */
export const AUTOMATION_METHODS = [
  "session.hello",
  "session.info",
  "session.capabilities",
  "machine.state",
  "machine.start",
  "machine.pause",
  "machine.stop",
  "machine.reset",
  "machine.restart",
  "machine.debug",
  "machine.step",
  "machine.wait",
  "cpu.get",
  "cpu.set",
  "memory.read",
  "memory.write",
  "breakpoints.list",
  "breakpoints.set",
  "breakpoints.remove",
  "breakpoints.clear",
  "project.info",
  "project.build",
  "project.run",
  "project.debug",
  "project.inject",
  "project.export",
  "project.open",
  "screen.capture",
  "ide.command",
  "events.subscribe",
  "events.unsubscribe"
] as const;
export type AutomationMethod = (typeof AUTOMATION_METHODS)[number];

/** Every notification of protocol 1 (D11) */
export const AUTOMATION_EVENTS = [
  "machine.stateChanged",
  "machine.breakpointHit",
  "project.built",
  "ide.output"
] as const;
export type AutomationEvent = (typeof AUTOMATION_EVENTS)[number];

// ================================================================================================
// Errors (§4.2)

/** JSON-RPC 2.0's own error codes, plus the one server-error code every Klive error uses */
export const JSONRPC_PARSE_ERROR = -32700;
export const JSONRPC_INVALID_REQUEST = -32600;
export const JSONRPC_METHOD_NOT_FOUND = -32601;
export const JSONRPC_INVALID_PARAMS = -32602;
export const JSONRPC_INTERNAL_ERROR = -32603;
export const KLIVE_SERVER_ERROR = -32000;

/** What went wrong, in `error.data.kind` */
export const AUTOMATION_ERROR_KINDS = [
  "unauthorized",
  "not-ready",
  "level-too-low",
  "no-project",
  "no-machine",
  "timeout",
  "feature-disabled",
  "command-denied",
  "command-failed",
  "invalid-params"
] as const;
export type AutomationErrorKind = (typeof AUTOMATION_ERROR_KINDS)[number];

export type AutomationErrorData = {
  kind: AutomationErrorKind;
  /** For `level-too-low`: the level the method needs */
  required?: AutomationLevel;
  /** For `level-too-low`: the level this connection has */
  granted?: AutomationLevel;
  /** For `command-failed`: the command's result value, when it had one (a build's errors) */
  value?: unknown;
  /** For `command-failed`: the command's output lines */
  output?: string[];
};

export type JsonRpcError = {
  code: number;
  message: string;
  data?: AutomationErrorData;
};

export type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: number | string | null;
  method: string;
  params?: Record<string, unknown>;
};

export type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: number | string | null;
  result?: unknown;
  error?: JsonRpcError;
};

export type JsonRpcNotification = {
  jsonrpc: "2.0";
  method: string;
  params?: Record<string, unknown>;
};

// ================================================================================================
// The connection file (D5)

/** `<klive-home>/run/automation.json`: where the server listens, and the token it expects */
export type AutomationConnectionInfo = {
  protocol: number;
  /** The socket path (POSIX) or pipe name (Windows) */
  socket: string;
  /** 32 random bytes, hex; changes on every start */
  token: string;
  /** The Klive process; a file whose process is gone is stale */
  pid: number;
  /** Klive's version */
  version: string;
  /** ISO time the server started */
  startedAt: string;
};

// ================================================================================================
// Shapes of results and notifications

/** A machine's execution state as the protocol names it */
export type AutomationMachineState =
  | "none"
  | "running"
  | "pausing"
  | "paused"
  | "stopping"
  | "stopped";

/** `MachineControllerState`'s numeric values (`@abstractions/MachineControllerState`) by name */
export const MACHINE_STATE_NAMES: readonly AutomationMachineState[] = [
  "none",
  "running",
  "pausing",
  "paused",
  "stopping",
  "stopped"
];

/** The protocol name of a `MachineControllerState` value */
export function machineStateName(state: number | undefined): AutomationMachineState {
  return MACHINE_STATE_NAMES[state ?? 0] ?? "none";
}

export type HelloParams = { token: string; client?: string };
export type HelloResult = {
  protocol: number;
  version: string;
  /** Both windows exist and the machine is set up (T2); every other method waits until it is */
  ready: boolean;
  level: AutomationLevel;
  machine: { id: string; model?: string } | null;
};

export type MachineStateResult = { state: AutomationMachineState; pc?: number };

/** What `machine.wait` waits for (T9: "paused" also resolves on "stopped") */
export type WaitUntil = "paused" | "stopped" | "running";

export type BreakpointHit = {
  address: number;
  partition?: number;
  /** "exec", "read", "write", "in", "out", "nextreg", "copper", "sprite" or "annotation" */
  kind: string;
};

export type WaitResult = MachineStateResult & { breakpoint?: BreakpointHit };

/** One diagnostic of a build (D10) */
export type BuildDiagnostic = {
  file: string;
  line: number;
  column?: number;
  code?: string;
  message: string;
  warning?: boolean;
};

export type CommandRunResult = {
  success: boolean;
  message?: string;
  value?: unknown;
  /** The command's output, as plain text lines (D9) */
  output: string[];
};

export type BuildResult = CommandRunResult & { errors: BuildDiagnostic[] };

export type MemoryReadResult = {
  address?: number;
  partition?: string;
  offset?: number;
  length: number;
  /** base64 */
  data: string;
};

export type ScreenCaptureResult = {
  format: "png";
  width: number;
  height: number;
  /** base64 */
  data: string;
};

/** What the `machine.stateChanged` notification carries */
export type StateChangedEvent = MachineStateResult;
export type BuiltEvent = { success: boolean; errorCount: number };
export type OutputEvent = { pane: string; text: string };
