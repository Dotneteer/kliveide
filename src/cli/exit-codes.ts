import type { AutomationErrorKind, JsonRpcError } from "@common/automation/protocol";
import { JSONRPC_INVALID_PARAMS, JSONRPC_METHOD_NOT_FOUND } from "@common/automation/protocol";

/*
 * The CLI's exit codes (`.plans/UNIT_TESTS_CLI_PLAN.md` D3, `.plans/COMMAND_LINE_AUTOMATION_PLAN.md`
 * D12, D15).
 */
export const EXIT_OK = 0;
/** The command ran but reported failure (`cmd` with `success: false`) */
export const EXIT_FAILED = 1;
/** A build with errors */
export const EXIT_BUILD_ERRORS = 2;
/** Usage, no running Klive, automation off, or a permission level too low */
export const EXIT_USAGE = 3;
/** An internal or protocol error */
export const EXIT_INTERNAL = 4;
/** `wait` (or a headless run) ran out of time */
export const EXIT_TIMEOUT = 5;

/** An error that ends the CLI with a given exit code and message */
export class CliError extends Error {
  constructor(
    message: string,
    public readonly exitCode: number
  ) {
    super(message);
  }
}

export function usageError(message: string): CliError {
  return new CliError(message, EXIT_USAGE);
}

/** The exit code of an error the server answered with */
export function exitCodeOfRpcError(error: JsonRpcError, method?: string): number {
  if (error.code === JSONRPC_METHOD_NOT_FOUND || error.code === JSONRPC_INVALID_PARAMS) return EXIT_USAGE;
  const kind = error.data?.kind as AutomationErrorKind | undefined;
  switch (kind) {
    case "unauthorized":
    case "level-too-low":
    case "no-project":
    case "no-machine":
    case "feature-disabled":
    case "command-denied":
    case "invalid-params":
      return EXIT_USAGE;
    case "command-failed":
      return EXIT_FAILED;
    case "timeout":
      return method === "machine.wait" ? EXIT_TIMEOUT : EXIT_INTERNAL;
    default:
      return EXIT_INTERNAL;
  }
}
