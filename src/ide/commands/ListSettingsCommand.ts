import {
  InteractiveCommandBase,
  InteractiveCommandContext,
  InteractiveCommandResult,
  Token,
  TokenType,
  TraceMessage,
  TraceMessageType,
} from "@abstractions/interactive-command-service";
import { SettingLocation } from "@abstractions/settings-service";
import { getSettingsService, getState } from "@core/service-registry";

/**
 * Adds a new application setting to store
 */
export class ListSettingsCommand extends InteractiveCommandBase {
  private _location: SettingLocation;
  private _keyStart: string;
  readonly id = "list-set";
  readonly description = "Lists Klive IDE settings";
  readonly usage = "list-s [-u | -p | -c] [<settings key>]";
  readonly aliases = ["list-s", "ls"];

  /**
   * Validates the input arguments
   * @param args Arguments to validate
   * @returns A list of issues
   */
  async validateArgs(args: Token[]): Promise<TraceMessage | TraceMessage[]> {
    // --- Check argument number
    if (args.length > 2) {
      return {
        type: TraceMessageType.Error,
        message: "Invalid number of arguments.",
      };
    }
    if (args.length > 0) {
      if (args[0].type === TokenType.Option) {
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
              message: "The first argument should be -u, -p, or -c",
            };
        }
      } else {
        if (args.length === 2) {
          return {
            type: TraceMessageType.Error,
            message: "The first argument should be -u, -p, or -c",
          };
        }
        this._location = "current";
        this._keyStart = args[0].text;
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
    const projState = getState().project;
    if (!projState.hasVm && this._location === "project") {
      return {
        success: false,
        finalMessage: "No project is loaded to retrieve the settings from.",
      };
    }
    context.output.color("bright-blue");
    context.output.writeLine("Application settings:");
    context.output.color("bright-magenta");
    var contents = await getSettingsService().getConfiguration(this._location);
    let count = 0;
    for (const item of contents.entries()) {
      if (!this._keyStart || item[0].startsWith(this._keyStart)) {
        context.output.writeLine(`${item[0]}: ${item[1]}`);
        count++;
      }
    }
    context.output.resetColor();
    return {
      success: true,
      finalMessage:
        (count === 0 ? "No" : count.toString()) +
        " setting" +
        (count > 1 ? "s" : "") +
        " found.",
    };
  }
}
