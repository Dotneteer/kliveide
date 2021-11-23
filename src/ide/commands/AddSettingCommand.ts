import {
  InteractiveCommandBase,
  InteractiveCommandResult,
  Token,
  TraceMessage,
  TraceMessageType,
} from "@abstractions/interactive-command-service";

/**
 * Adds a new application setting to store
 */
export class AddSettingCommand extends InteractiveCommandBase {
  private _key: string | null = null;
  private _value: string | null = null;
  readonly id = "set";
  readonly description = "Adds a new Klive IDE setting";
  readonly usage = "set <setting name> [<setting-value>]";
  readonly aliases = ["s"];

  /**
   * Validates the input arguments
   * @param args Arguments to validate
   * @returns A list of issues
   */
  async validateArgs(args: Token[]): Promise<TraceMessage | TraceMessage[]> {
    // --- Check argument number
    if (args.length !== 1 && args.length !== 2) {
      return {
        type: TraceMessageType.Error,
        message: "Invalid number of arguments.",
      };
    }
    this._key = args[0].text;
    this._value = args[1].text;
    return [];
  }

  /**
   * Executes the command within the specified context
   */
  async doExecute(): Promise<InteractiveCommandResult> {
    return {
      success: true,
      finalMessage: `Setting successfully set.`,
    };
  }
}
