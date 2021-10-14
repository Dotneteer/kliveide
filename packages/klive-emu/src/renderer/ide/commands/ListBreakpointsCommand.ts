import { compareBreakpoints } from "@abstractions/debug-helpers";
import {
  InteractiveCommandBase,
  InteractiveCommandContext,
  InteractiveCommandResult,
  Token,
  TraceMessage,
  TraceMessageType,
} from "@abstractions/interactive-command-service";
import { getState } from "@core/service-registry";

/**
 * Lists all breakpoints command
 */
export class ListBreakpointsCommand extends InteractiveCommandBase {
  readonly id = "list-bp";
  readonly description = "Lists all breakpoints";
  readonly usage = "list-bp";
  readonly aliases = ["lb", "lbp"];

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
  async doExecute(
    context: InteractiveCommandContext
  ): Promise<InteractiveCommandResult> {
    const breakpoints = getState().debugger?.breakpoints ?? [];
    if (breakpoints.length > 0) {
      context.output.color("bright-blue");
      context.output.writeLine("Breakpoints:");
      let count = 0;
      breakpoints
        .sort((a, b) => compareBreakpoints(a, b))
        .forEach((bp) => {
          context.output.color("bright-magenta");
          context.output.bold(true);
          if (bp.type === "binary") {
            context.output.writeLine(
              `  $${bp.location.toString(16).padStart(4, "0").toUpperCase()} (${bp.location})`
            );
          } else {
            context.output.writeLine(`  $${bp.resource}:${bp.line}`);
          }
          count++;
        });
      context.output.color("bright-blue");
      context.output.bold(false);
      context.output.writeLine(
        `${count} breakpoint${count > 1 ? "s" : ""} displayed.`
      );
    } else {
      return {
        success: true,
        finalMessage: "No breakpoints are defined.",
      };
    }
  }
}
