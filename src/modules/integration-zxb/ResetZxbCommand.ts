import {
  InteractiveCommandBase,
  InteractiveCommandResult,
  Token,
  TraceMessage,
  TraceMessageType,
} from "@abstractions/interactive-command-service";
import { getSettingsService } from "@core/service-registry";
import { retrieveTokenValue } from "@ide/settings-service/settings-service";
import { ZXBC_EXECUTABLE_PATH } from "./zxb-config";

/**
 * Clears all breakpoints command
 */
export class ResetZxbCommand extends InteractiveCommandBase {
  private _executablePath: string | null;
  readonly id = "zxb-reset";
  readonly description =
    "Resets ZXB settings with the provided executable path";
  readonly usage = "zxb-reset <Full ZXBC exeutable path>";
  readonly aliases = ["zxbr"];

  /**
   * Validates the input arguments
   * @param args Arguments to validate
   * @returns A list of issues
   */
  async validateArgs(args: Token[]): Promise<TraceMessage | TraceMessage[]> {
    // --- Check argument number
    this._executablePath = null;
    if (args.length !== 1) {
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
    this._executablePath = value;
    return [];
  }

  /**
   * Executes the command within the specified context
   */
  async doExecute(): Promise<InteractiveCommandResult> {
    const settingsService = getSettingsService();
    settingsService.saveSetting(
      ZXBC_EXECUTABLE_PATH,
      this._executablePath,
      "current"
    );
    return {
      success: true,
      finalMessage: "ZXBC executable path successfully set.",
    };
  }
}
