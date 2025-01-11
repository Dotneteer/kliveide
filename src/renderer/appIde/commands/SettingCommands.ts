import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import { CommandArgumentInfo } from "@renderer/abstractions/IdeCommandInfo";
import type { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";
import type { ValidationMessage } from "@renderer/abstractions/ValidationMessage";
import {
  writeSuccessMessage,
  commandSuccess,
  validationError,
  commandError,
  writeMessage,
  IdeCommandBase
} from "@renderer/appIde/services/ide-commands";

type SettingsArgs = {
  "-p"?: boolean;
  "-u"?: boolean;
  key: string;
  value?: string;
};

export class SettingCommand extends IdeCommandBase<SettingsArgs> {
  readonly id = "set";
  readonly description =
    "Specifies the value of a particular Klive setting" +
    "Options: '-u': user setting; '-p': project setting";
  readonly usage = "set [-p] [-u] <key> [<value>]";
  readonly aliases = [];
  readonly argumentInfo: CommandArgumentInfo = {
    commandOptions: ["-p", "-u"],
    mandatory: [{ name: "key" }],
    optional: [{ name: "value" }]
  };

  async execute(context: IdeCommandContext, args: SettingsArgs): Promise<IdeCommandResult> {
    const state = context.store.getState();
    const kliveProject = state.project?.isKliveProject;
    if (args["-p"]) {
      if (!kliveProject) {
        return {
          success: false,
          finalMessage: "The -p option can be used only with an open Klive project"
        };
      }
    }

    if (args["-u"] || (!args["-p"] && !kliveProject)) {
      await context.mainApi.applyUserSettings(args.key, args.value);
    } else {
      await context.mainApi.applyProjectSettings(args.key, args.value);
    }
    writeSuccessMessage(context.output, `Command successfully executed`);
    return commandSuccess;
  }
}

type ListSettingsArgs = {
  "-u"?: boolean;
  "-p"?: boolean;
  setting?: string;
};

export class ListSettingsCommand extends IdeCommandBase<ListSettingsArgs> {
  readonly id = "setl";
  readonly description = "Lists the values of the specified settings";
  readonly usage = "setl [-u] [-p] [<setting>]";
  readonly aliases = [];

  readonly argumentInfo: CommandArgumentInfo = {
    commandOptions: ["-u", "-p"],
    optional: [{ name: "setting" }]
  };

  async execute(context: IdeCommandContext, args: ListSettingsArgs): Promise<IdeCommandResult> {
    const state = context.store.getState();
    const kliveProject = state.project?.isKliveProject;
    let settings: Record<string, any> = {};

    // --- Use the appropriate settings store
    if (args["-u"]) {
      settings = await readUserSettings();
      writeMessage(context.output, "User settings:", "bright-magenta");
    } else if (args["-p"]) {
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
    if (args.setting) {
      filteredSetting = {};
      Object.keys(settings).forEach((key) => {
        if (key.startsWith(args.setting)) {
          filteredSetting[key] = settings[key];
        }
      });
    } else {
      filteredSetting = settings;
    }

    // --- Display the settings
    const lines = JSON.stringify(filteredSetting, null, 2).split("\n");
    lines.forEach((l) => writeMessage(context.output, l, "bright-cyan"));
    writeSuccessMessage(context.output, `Command successfully executed`);
    return commandSuccess;

    async function readUserSettings() {
      return await context.mainApiAlt.getUserSettings();
    }

    async function readProjectSettings() {
      return await context.mainApiAlt.getProjectSettings();
    }
  }
}

type MoveSettingsArgs = {
  "-pull"?: boolean;
  "-push"?: boolean;
  "-c"?: boolean;
};

export class MoveSettingsCommand extends IdeCommandBase<MoveSettingsArgs> {
  readonly id = "setm";
  readonly description =
    "Moves user/project settings. " +
    "Options: '-pull': user --> project; '-push': project --> user; '-c': copy (not merge)";
  readonly usage = "setm [-pull] [-push] [-c]";
  readonly aliases = [];
  readonly argumentInfo: CommandArgumentInfo = {
    commandOptions: ["-pull", "-push", "-c"]
  };
  readonly requiresProject = true;

  async validateCommandArgs(_: IdeCommandContext, args: any): Promise<ValidationMessage[]> {
    if (!args["-pull"] && !args["-push"]) {
      return [validationError("You must use one of '-pull' or '-push'")];
    }

    if (args["-pull"] && args["-push"]) {
      return [validationError("Use only one of '-pull' or '-push'")];
    }

    return [];
  }

  async execute(context: IdeCommandContext, args: MoveSettingsArgs): Promise<IdeCommandResult> {
    await context.mainApi.moveSettings(!!args["-pull"], !!args["-c"]);
    writeSuccessMessage(context.output, `Command successfully executed`);
    return commandSuccess;
  }
}
