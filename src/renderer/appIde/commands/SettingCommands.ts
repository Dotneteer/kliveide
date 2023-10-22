import { IdeCommandContext } from "../../abstractions/IdeCommandContext";
import { IdeCommandResult } from "../../abstractions/IdeCommandResult";
import {
  writeSuccessMessage,
  commandSuccess,
  IdeCommandBase,
  validationError,
  commandError,
  getNumericTokenValue
} from "../services/ide-commands";
import { ValidationMessage } from "../../abstractions/ValidationMessage";
import { TokenType } from "../services/command-parser";

export class SettingCommand extends IdeCommandBase {
  readonly id = "set";
  readonly description =
    "Specifies the value of a particular Klive setting" +
    "Options: '-u': user setting; '-p': project setting";
  readonly usage = "set [-p] [-u] <key> [<value>]";
  readonly aliases = [];

  private key?: string;
  private value?: string | number;
  private projectOption?: boolean;
  private userOption?: boolean;

  prepareCommand (): void {
    delete this.key;
    delete this.value;
    delete this.projectOption;
    delete this.userOption;
  }

  async validateArgs (
    context: IdeCommandContext
  ): Promise<ValidationMessage | ValidationMessage[]> {
    const args = context.argTokens;
    if (args.length < 1) {
      return validationError(
        "This command expects at least one parameter, as the setting key"
      );
    }
    for (const arg of args) {
      switch (arg.text) {
        case "-p":
          this.projectOption = true;
          break;
        case "-u":
          this.userOption = true;
          break;
        default:
          if (this.key === undefined) {
            this.key = arg.text;
          } else if (this.value === undefined) {
            switch (arg.type) {
              case TokenType.BinaryLiteral:
              case TokenType.DecimalLiteral:
              case TokenType.HexadecimalLiteral:
                this.value = getNumericTokenValue(arg).value;
                break;
              default:
                this.value = arg.text;
                break;
            }
          } else {
            return validationError(
              `This command contains an extra argument: ${arg.text}`
            );
          }
          break;
      }
    }
    if (this.userOption && this.projectOption) {
      return validationError("Use only one of the -p and -u options");
    }
    if (this.key === undefined) {
      return validationError("Specify a setting key");
    }
    return [];
  }

  async doExecute (context: IdeCommandContext): Promise<IdeCommandResult> {
    const state = context.store.getState();
    const kliveProject = state.project?.isKliveProject;
    if (this.projectOption) {
      if (!kliveProject) {
        return {
          success: false,
          finalMessage:
            "The -p option can be used only with an open Klive project"
        };
      }
    } 

    if (this.userOption || (!this.projectOption && !kliveProject)) {
      const response = await context.messenger.sendMessage({
        type: "MainApplyUserSettings",
        key: this.key,
        value: this.value
      })
      if (response.type === "ErrorResponse") {
        return commandError(response.message);
      }
      if (response.type !== "Ack") {
        return commandError(`Invalid response type: '${response.type}'`);
      }
    } else {
      const response = await context.messenger.sendMessage({
        type: "MainApplyProjectSettings",
        key: this.key,
        value: this.value
      })
      if (response.type === "ErrorResponse") {
        return commandError(response.message);
      }
      if (response.type !== "Ack") {
        return commandError(`Invalid response type: '${response.type}'`);
      }
    }
    writeSuccessMessage(context.output, `Command successfully executed`);
    return commandSuccess;
  }
}
