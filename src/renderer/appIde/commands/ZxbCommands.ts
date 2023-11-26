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
  ZXBC_MACHINE_CODE_ORIGIN,
  ZXBC_PYTHON_PATH
} from "@main/zxb-integration/zxb-config";

export class ResetZxbCommand extends IdeCommandBase {
  readonly id = "zxb-reset";
  readonly description =
    "Resets ZXB settings with the provided executable path and machine code origin";
  readonly usage =
    "zxb-reset <Full ZXBC executable path> [<python3 path>] [<start of machine code>]";
  readonly aliases = ["zxbr"];

  private exePath?: string;
  private pythonPath?: string;
  private codeOrigin?: number;

  prepareCommand (): void {
    delete this.exePath;
    delete this.pythonPath;
    delete this.codeOrigin;
  }

  async validateArgs (
    context: IdeCommandContext
  ): Promise<ValidationMessage | ValidationMessage[]> {
    const args = context.argTokens;
    if (args.length > 3) {
      return validationError("This command expects up to three parameters");
    }

    for (let i = 0; i < args.length; i++) {
      switch (args[i].type) {
        case TokenType.BinaryLiteral:
        case TokenType.DecimalLiteral:
        case TokenType.HexadecimalLiteral:
          if (this.codeOrigin !== undefined) {
            return validationError("Code origin already specified");
          }
          const tokenValue = getNumericTokenValue(args[i]);
          if (tokenValue.messages) {
            return validationError("Invalid address");
          }
          this.codeOrigin = tokenValue.value & 0xffff;
          this.codeOrigin = getNumericTokenValue(args[i]).value & 0xffff;
          break;
        default:
          if (this.exePath === undefined) {
            this.exePath = args[i].text;
          } else if (this.pythonPath === undefined) { 
            this.pythonPath = args[i].text;
          } else {
            return validationError("Code origin must be a number");
          }
          break;
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
      if (this.pythonPath) {
        await context.service.ideCommandsService.executeCommand(
          `set ${ZXBC_PYTHON_PATH} "${this.pythonPath}"`
        );
        cmdMessage += `, python path to $${this.pythonPath}`;
      }
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
