import {
  getNumericTokenValue,
  InteractiveCommandBase,
  InteractiveCommandResult,
  Token,
  TraceMessage,
  TraceMessageType,
} from "@abstractions/interactive-command-service";
import { getSettingsService } from "@core/service-registry";
import { retrieveTokenValue } from "@ide/settings-service/settings-service";
import { ZXBASM_EXECUTABLE_PATH } from "./zxbasm-config";

/**
 * Clears all breakpoints command
 */
export class ResetZxbasmCommand extends InteractiveCommandBase {
  private _executablePath: string | null;
  private _orgValue: number | null;
  readonly id = "zxbasm-reset";
  readonly description =
    "Resets ZXBASM settings with the provided executable path";
  readonly usage =
    "zxbasm-reset <Full ZXBASM exeutable path>";
  readonly aliases = ["zxbasmr"];

  /**
   * Validates the input arguments
   * @param args Arguments to validate
   * @returns A list of issues
   */
  async validateArgs(args: Token[]): Promise<TraceMessage | TraceMessage[]> {
    // --- Check argument number
    this._executablePath = null;
    if (args.length !== 1 && args.length !== 2) {
      return {
        type: TraceMessageType.Error,
        message: "Invalid number of arguments.",
      };
    }
    const value = retrieveTokenValue(args[0]);
    if (typeof value !== "string") {
      return {
        type: TraceMessageType.Error,
        message: "The argument must be an executable path string.",
      };
    }
    this._orgValue = 0x8000;
    if (args.length === 2) {
      const org = getNumericTokenValue(args[1]);
      if (org === null) {
        return {
          type: TraceMessageType.Error,
          message: `'${args[1].text}' is not a valid address.`,
        };
      }
      this._orgValue = org;
    }
    this._executablePath = value;
    return [];
  }

  /**
   * Executes the command within the specified context
   */
  async doExecute(): Promise<InteractiveCommandResult> {
    const settingsService = getSettingsService();
    await settingsService.saveSetting(
      ZXBASM_EXECUTABLE_PATH,
      this._executablePath,
      "current"
    );
    return {
      success: true,
      finalMessage: "ZXBASM executable path successfully set.",
    };
  }
}
