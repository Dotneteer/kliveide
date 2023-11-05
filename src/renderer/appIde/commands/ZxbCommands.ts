import { IdeCommandContext } from "../../abstractions/IdeCommandContext";
import { IdeCommandResult } from "../../abstractions/IdeCommandResult";
import {
  IdeCommandBase,
  validationError,
  getNumericTokenValue,
  commandSuccessWith,
  toHexa4
} from "../services/ide-commands";
import { ValidationMessage } from "../../abstractions/ValidationMessage";
import { TokenType } from "../services/command-parser";
import {
  ZXBC_ALL,
  ZXBC_EXECUTABLE_PATH,
  ZXBC_MACHINE_CODE_ORIGIN
} from "@main/zxb-integration/zxb-config";

export class ResetZxbCommand extends IdeCommandBase {
  readonly id = "zxb-reset";
  readonly description =
    "Resets ZXB settings with the provided executable path and machine code origin";
  readonly usage =
    "zxb-reset <Full ZXBC exeutable path> [<start of machine code>]";
  readonly aliases = ["zxbr"];

  private exePath?: string;
  private codeOrigin?: number;

  prepareCommand (): void {
    delete this.exePath;
    delete this.codeOrigin;
  }

  async validateArgs (
    context: IdeCommandContext
  ): Promise<ValidationMessage | ValidationMessage[]> {
    const args = context.argTokens;
    if (args.length > 2) {
      return validationError("This command expects up to two parameters");
    }

    // --- Ger ZX BASIC path
    if (args.length > 0) {
      switch (args[0].type) {
        case TokenType.BinaryLiteral:
        case TokenType.DecimalLiteral:
        case TokenType.HexadecimalLiteral:
          return validationError("The first parameter should be a path string");
        default:
          const response = await context.messenger.sendMessage({
            type: "MainPathExists",
            path: args[0].text,
            isFolder: false
          });
          if (response.type === "ErrorResponse") {
            return validationError(response.message);
          }
          if (response.type !== "FlagResponse") {
            return validationError(`Invalid response type: '${response.type}'`);
          }
          if (!response.flag) {
            return validationError(
              `The path: '${args[0].text}' does not point to a valid file`
            );
          }
          this.exePath = args[0].text;
          break;
      }
    }

    // --- Get the optional code origin
    if (args.length > 1) {
      switch (args[1].type) {
        case TokenType.BinaryLiteral:
        case TokenType.DecimalLiteral:
        case TokenType.HexadecimalLiteral:
          const tokenValue = getNumericTokenValue(args[1]);
          if (tokenValue.messages) {
            return validationError("Invalid address");
          }
          this.codeOrigin = tokenValue.value & 0xffff;
          break;
        default:
          return validationError(
            "The first parameter should be a number (address)"
          );
      }
    }
    return [];
  }

  async doExecute (context: IdeCommandContext): Promise<IdeCommandResult> {
    if (this.exePath) {
      await context.service.ideCommandsService.executeCommand(
        `set ${ZXBC_EXECUTABLE_PATH} "${this.exePath}"`
      );
      let cmdMessage = `ZX BASIC path set to ${this.exePath}`;
      if (this.codeOrigin) {
        await context.service.ideCommandsService.executeCommand(
          `set ${ZXBC_MACHINE_CODE_ORIGIN} "${this.codeOrigin}"`
        );
        cmdMessage += `, code origin to $${toHexa4(this.codeOrigin)}`;
      }
      return commandSuccessWith(cmdMessage);
    } else {
      await context.service.ideCommandsService.executeCommand(
        `set ${ZXBC_ALL}`
      );
      return commandSuccessWith("ZXBC settings removed");
    }
  }
}
