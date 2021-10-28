import {
  InteractiveCommandBase,
  InteractiveCommandResult,
  Token,
  TraceMessage,
  TraceMessageType,
} from "@abstractions/interactive-command-service";
import { dispatch } from "@core/service-registry";
import { clearBreakpointsAction } from "@core/state/debugger-reducer";

/**
 * Clears all breakpoints command
 */
export class ClearBreakpointsCommand extends InteractiveCommandBase {
  readonly id = "erase-bps";
  readonly description = "Clears all breakpoints";
  readonly usage = "erase-bps";
  readonly aliases = ["erase-bp", "clear-bp", "eab"];

  /**
   * Validates the input arguments
   * @param args Arguments to validate
   * @returns A list of issues
   */
  async validateArgs(args: Token[]): Promise<TraceMessage | TraceMessage[]> {
    // --- Check argument number
    if (args.length !== 0) {
      return {
        type: TraceMessageType.Error,
        message: "Invalid number of arguments.",
      };
    }
    return [];
  }

  /**
   * Executes the command within the specified context
   */
  async doExecute(): Promise<InteractiveCommandResult> {
    dispatch(clearBreakpointsAction());
    return {
      success: true,
      finalMessage: "All breakpoints are removed.",
    };
  }
}
