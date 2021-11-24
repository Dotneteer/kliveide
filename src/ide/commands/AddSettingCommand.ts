import {
  getNumericTokenValue,
  InteractiveCommandBase,
  InteractiveCommandResult,
  Token,
  TokenType,
  TraceMessage,
  TraceMessageType,
} from "@abstractions/interactive-command-service";
import { SettingLocation } from "@abstractions/settings-service";
import { getSettingsService } from "@core/service-registry";
import { retrieveTokenValue } from "@ide/settings-service/settings-service";

/**
 * Adds a new application setting to store
 */
export class AddSettingCommand extends InteractiveCommandBase {
  private _key: string | null;
  private _value: Token | null;
  private _location: SettingLocation | null;
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
    // --- Reset arguments
    this._key = null;
    this._value = null;
    this._location = null;
    
    // --- Check argument number
    if (args.length < 1 || args.length > 3) {
      return {
        type: TraceMessageType.Error,
        message: "Invalid number of arguments.",
      };
    }
    if (args.length === 3) {
      if (
        args[0].type !== TokenType.Option ||
        (args[0].text !== "-u" &&
          args[0].text !== "-p" &&
          args[0].text !== "-c")
      ) {
        return {
          type: TraceMessageType.Error,
          message: "The first argument must be -u, -p, or -c",
        };
      }
      switch (args[0].text) {
        case "-u":
          this._location = "user";
          break;
        case "-p":
          this._location = "project";
          break;
        default:
          this._location = "current";
          break;
      }
      this._key = args[1].text;
      this._value = args[2];
    } else if (args.length == 2) {
      this._key = args[0].text;
      this._value = args[1];
    } else {
      this._key = args[0].text;
    }
    return [];
  }

  /**
   * Executes the command within the specified context
   */
  async doExecute(): Promise<InteractiveCommandResult> {
    const value = this._value ? retrieveTokenValue(this._value) : undefined;
    await getSettingsService().saveSetting(this._key, value, this._location);
    return {
      success: true,
      finalMessage: `Setting successfully set.`,
    };
  }
}
