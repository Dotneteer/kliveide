import type { CliIo } from "../../io";
import type { AutomationClient } from "../../rpc/client";

/*
 * What every `klive ide` verb gets (`.plans/COMMAND_LINE_AUTOMATION_PLAN.md` D12).
 */
export type IdeVerbContext = {
  client: AutomationClient;
  io: CliIo;
  /** Machine-readable output (`--json`) */
  json: boolean;
  /** `--timeout` in milliseconds, when given */
  timeoutMs?: number;
  /** The connection file the client used */
  connectionFile: string;
  /** The verb's own arguments */
  args: string[];
  /**
   * Calls a method. `--timeout` becomes the request's server-side timeout, and the client waits a
   * little longer than the server so the server's own timeout error arrives first.
   */
  call<T = any>(method: string, params?: Record<string, unknown>): Promise<T>;
  /** Prints a value as JSON (`--json`) */
  printJson(value: unknown): void;
};

/** A verb: runs and returns the exit code */
export type IdeVerb = (ctx: IdeVerbContext) => Promise<number>;
