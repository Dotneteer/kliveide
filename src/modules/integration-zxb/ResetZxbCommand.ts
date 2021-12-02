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
import { ZXBC_EXECUTABLE_PATH, ZXBC_MACHINE_CODE_ORIGIN } from "./zxb-config";

/**
 * Clears all breakpoints command
 */
export class ResetZxbCommand extends InteractiveCommandBase {
  private _executablePath: string | null;
  private _orgValue: number | null;
  readonly id = "zxb-reset";
  readonly description =
    "Resets ZXB settings with the provided executable path";
  readonly usage =
    "zxb-reset <Full ZXBC exeutable path> [<start of machine code>]";
  readonly aliases = ["zxbr"];

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
      ZXBC_EXECUTABLE_PATH,
      this._executablePath,
      "current"
    );
    await settingsService.saveSetting(
      ZXBC_MACHINE_CODE_ORIGIN,
      this._orgValue,
      "current"
    );
    return {
      success: true,
      finalMessage: "ZXBC executable path successfully set.",
    };
  }
}
