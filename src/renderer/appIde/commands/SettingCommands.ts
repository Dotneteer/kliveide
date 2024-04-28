import { IdeCommandContext } from "../../abstractions/IdeCommandContext";
import { IdeCommandResult } from "../../abstractions/IdeCommandResult";
import {
  writeSuccessMessage,
  commandSuccess,
  IdeCommandBase,
  validationError,
  commandError,
  getNumericTokenValue,
  writeMessage
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
      });
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
      });
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

export class ListSettingsCommand extends IdeCommandBase {
  readonly id = "setl";
  readonly description = "Lists the values of the specified settings";
  readonly usage = "setl [-u] [-p] [<setting>]";
  readonly aliases = [];

  private settingKey?: string;
  private projectOption?: boolean;
  private userOption?: boolean;

  prepareCommand (): void {
    delete this.settingKey;
    delete this.projectOption;
    delete this.userOption;
  }

  async validateArgs (
    context: IdeCommandContext
  ): Promise<ValidationMessage | ValidationMessage[]> {
    const args = context.argTokens;
    if (args.length > 2) {
      return validationError("This command expects up to two argument");
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
          if (this.settingKey === undefined) {
            this.settingKey = arg.text;
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
    return [];
  }

  async doExecute (context: IdeCommandContext): Promise<IdeCommandResult> {
    const state = context.store.getState();
    const kliveProject = state.project?.isKliveProject;
    let settings: Record<string, any> = {};

    // --- Use the appropriate settings store
    if (this.userOption) {
      settings = await readUserSettings();
      writeMessage(context.output, "User settings:", "bright-magenta");
    } else if (this.projectOption) {
      if (!kliveProject) {
        return commandError("There is no Klove project open");
      } else {
        settings = await readProjectSettings();
        writeMessage(context.output, "Project settings:", "bright-magenta");
      }
    } else {
      settings = {
        ...(await readUserSettings()),
        ...(await readProjectSettings())
      };
      writeMessage(context.output, "Merged settings:", "bright-magenta");
    }

    // --- Filter settings
    let filteredSetting: Record<string, any>;
    if (this.settingKey) {
      filteredSetting = {};
      Object.keys(settings).forEach(key => {
        if (key.startsWith(this.settingKey)) {
          filteredSetting[key] = settings[key];
        }
      });
    } else {
      filteredSetting = settings;
    }

    // --- Display the settings
    const lines = JSON.stringify(filteredSetting, null, 2).split("\n");
    lines.forEach(l => writeMessage(context.output, l, "bright-cyan"));
    writeSuccessMessage(context.output, `Command successfully executed`);
    return commandSuccess;

    async function readUserSettings () {
      const response = await context.messenger.sendMessage({
        type: "MainGetUserSettings"
      });
      if (response.type === "ErrorResponse") {
        throw new Error(response.message);
      }
      if (response.type !== "MainGetSettingsResponse") {
        throw new Error(`Invalid response type: '${response.type}'`);
      }
      return response.settings;
    }

    async function readProjectSettings () {
      const response = await context.messenger.sendMessage({
        type: "MainGetProjectSettings"
      });
      if (response.type === "ErrorResponse") {
        throw new Error(response.message);
      }
      if (response.type !== "MainGetSettingsResponse") {
        throw new Error(`Invalid response type: '${response.type}'`);
      }
      return response.settings;
    }
  }
}

export class MoveSettingsCommand extends IdeCommandBase {
  readonly id = "setm";
  readonly description =
    "Moves user/project settings. " +
    "Options: '-pull': user --> project; '-push': project --> user; '-c': copy (not merge)";
  readonly usage = "setm [-pull] [-push] [-c]";
  readonly aliases = [];

  private pullOption?: boolean;
  private pushOption?: boolean;
  private copyOption?: boolean;

  prepareCommand (): void {
    delete this.pullOption;
    delete this.pushOption;
    delete this.copyOption;
  }

  async validateArgs (
    context: IdeCommandContext
  ): Promise<ValidationMessage | ValidationMessage[]> {
    const args = context.argTokens;
    const isKliveProject =
      context.store.getState()?.project?.isKliveProject ?? false;
    if (args.length > 2) {
      return validationError("This command expects up to 2 arguments");
    }

    for (const arg of args) {
      switch (arg.text) {
        case "-pull":
          this.pullOption = true;
          break;
        case "-push":
          this.pushOption = true;
          break;
        case "-c":
          this.copyOption = true;
          break;
        default:
          return validationError(`Unknown command argument: ${arg.text}`);
      }
    }

    if (!this.pullOption && !this.pushOption) {
      return validationError("You must use one of '-pull' or '-push'");
    }

    if (this.pullOption && this.pushOption) {
      return validationError("Use only one of '-pull' or '-push'");
    }

    if (!isKliveProject) {
      return validationError(
        "You can use this command only with an open Klive project."
      );
    }

    return [];
  }

  async doExecute (context: IdeCommandContext): Promise<IdeCommandResult> {
    const response = await context.messenger.sendMessage({
      type: "MainMoveSettings",
      pull: !!this.pullOption,
      copy: !!this.copyOption
    });
    if (response.type === "ErrorResponse") {
      throw new Error(response.message);
    }
    if (response.type !== "Ack") {
      throw new Error(`Invalid response type: '${response.type}'`);
    }
    writeSuccessMessage(context.output, `Command successfully executed`);
    return commandSuccess;
  }
}
