import {
  InteractiveCommandBase,
  InteractiveCommandContext,
  InteractiveCommandResult,
  Token,
  TraceMessage,
  TraceMessageType,
} from "@abstractions/interactive-command-service";
import { sendFromIdeToEmu } from "@core/messaging/message-sending";
import { GetAppConfigResponse } from "@core/messaging/message-types";

/**
 * Adds a new application setting to store
 */
export class ListSettingsCommand extends InteractiveCommandBase {
  readonly id = "list-set";
  readonly description = "Lists Klive IDE setting";
  readonly usage = "list-s";
  readonly aliases = ["list-s", "ls"];

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
    context.output.color("bright-blue");
    context.output.writeLine("Application settings:");
    const response = await sendFromIdeToEmu<GetAppConfigResponse>({
      type: "GetAppConfig",
    });
    var contents = JSON.stringify(response.config, null, 2).split("\n");
    for (const line of contents) {
        context.output.writeLine(line);
    }
    return {
      success: true,
      finalMessage: "OK.",
    };
  }
}
