import {
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
      const location = getLocationFromToken(args[0]);
      if (location == null || location == "error") {
        return {
          type: TraceMessageType.Error,
          message: "The first argument must be -u, -p, or -c",
        };
      }
      this._location = location;
      this._key = args[1].text;
      this._value = args[2];
    } else if (args.length == 2) {
      const location = getLocationFromToken(args[0]);
      if (location == "error") {
        return {
          type: TraceMessageType.Error,
          message: "The first argument must be -u, -p, or -c",
        };
      }
      if (location !== null) {
        this._location = location;
        this._key = args[1].text;
      } else {
        this._key = args[0].text;
        this._value = args[1];
      }
    } else {
      if (args[0].type === TokenType.Option) {
        return {
          type: TraceMessageType.Error,
          message: `Invalid key: ${args[0].text}`,
        };
      }
      this._key = args[0].text;
    }
    return [];

    function getLocationFromToken(token: Token): SettingLocation | "error" | null {
      if (token.type !== TokenType.Option) {
        return null;
      }
      if (
        token.text !== "-u" &&
        token.text !== "-p" &&
        token.text !== "-c")
      {
        return "error";
      }
      switch (args[0].text) {
        case "-u":
          return "user";
        case "-p":
          return "project";
        default:
          return "current";
      }
    }
  }

  /**
   * Executes the command within the specified context
   */
  async doExecute(): Promise<InteractiveCommandResult> {
    const value = this._value ? retrieveTokenValue(this._value) : undefined;
    const verb = value === undefined ? "removed" : "set";
    await getSettingsService().saveSetting(this._key, value, this._location);
    return {
      success: true,
      finalMessage: `Setting successfully ${verb}.`,
    };
  }
}
