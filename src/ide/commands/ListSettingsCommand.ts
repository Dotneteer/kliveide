import {
  InteractiveCommandBase,
  InteractiveCommandContext,
  InteractiveCommandResult,
  Token,
  TraceMessage,
  TraceMessageType,
} from "@abstractions/interactive-command-service";
import { SettingLocation } from "@abstractions/settings-service";
import { sendFromIdeToEmu } from "@core/messaging/message-sending";
import { GetAppConfigResponse } from "@core/messaging/message-types";
import { getSettingsService } from "@core/service-registry";

/**
 * Adds a new application setting to store
 */
export class ListSettingsCommand extends InteractiveCommandBase {
  private _location: SettingLocation;
  readonly id = "list-set";
  readonly description = "Lists Klive IDE setting";
  readonly usage = "list-s [-u | -p | -c]";
  readonly aliases = ["list-s", "ls"];

  /**
   * Validates the input arguments
   * @param args Arguments to validate
   * @returns A list of issues
   */
  async validateArgs(args: Token[]): Promise<TraceMessage | TraceMessage[]> {
    // --- Check argument number
    if (args.length !== 0 && args.length !== 1) {
      return {
        type: TraceMessageType.Error,
        message: "Invalid number of arguments.",
      };
    }
    if (args.length === 1) {
      switch (args[0].text) {
        case "-u":
          this._location = "user";
          break;
        case "-p":
          this._location = "project";
          break;
        case "-c":
          this._location = "current";
          break;
        default:
          return {
            type: TraceMessageType.Error,
            message: "The argument should be -u, -p, or -c",
          };
      }
    } else {
      this._location = "current";
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
    var contents = JSON.stringify(
      await getSettingsService().getConfiguration(this._location),
      null,
      2
    ).split("\n");
    for (const line of contents) {
      context.output.writeLine(line);
    }
    return {
      success: true,
      finalMessage: "OK.",
    };
  }
}
