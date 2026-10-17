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
import { SETTINGS_PAGES } from "@common/settings/settings-pages";
import { t } from "@common/i18n/i18n";

type SettingsArgs = {
  "-p"?: boolean;
  "-u"?: boolean;
  key: string;
  value?: string;
};

export class SettingCommand extends IdeCommandBase<SettingsArgs> {
  readonly id = "set";
  get description() {
    return t("commands.set.description");
  }
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
          finalMessage: t("commands.set.projectOptionNeedsProject")
        };
      }
    }

    if (args["-u"] || (!args["-p"] && !kliveProject)) {
      await context.mainApi.applyUserSettings(args.key, args.value);
    } else {
      await context.mainApi.applyProjectSettings(args.key, args.value);
    }
    writeSuccessMessage(context.output, t("commands.common.success"));
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
  get description() {
    return t("commands.setl.description");
  }
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
      writeMessage(context.output, t("commands.setl.userSettings"), "bright-magenta");
    } else if (args["-p"]) {
      if (!kliveProject) {
        return commandError(t("commands.setl.noProject"));
      } else {
        settings = await readProjectSettings();
        writeMessage(context.output, t("commands.setl.projectSettings"), "bright-magenta");
      }
    } else {
      settings = {
        ...(await readUserSettings()),
        ...(await readProjectSettings())
      };
      writeMessage(context.output, t("commands.setl.mergedSettings"), "bright-magenta");
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
    writeSuccessMessage(context.output, t("commands.common.success"));
    return commandSuccess;

    async function readUserSettings() {
      return await context.mainApi.getUserSettings();
    }

    async function readProjectSettings() {
      return await context.mainApi.getProjectSettings();
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
  get description() {
    return t("commands.setm.description");
  }
  readonly usage = "setm [-pull] [-push] [-c]";
  readonly aliases = [];
  readonly argumentInfo: CommandArgumentInfo = {
    commandOptions: ["-pull", "-push", "-c"]
  };
  readonly requiresProject = true;

  async validateCommandArgs(_: IdeCommandContext, args: any): Promise<ValidationMessage[]> {
    if (!args["-pull"] && !args["-push"]) {
      return [validationError(t("commands.setm.pullOrPushRequired"))];
    }

    if (args["-pull"] && args["-push"]) {
      return [validationError(t("commands.setm.pullAndPush"))];
    }

    return [];
  }

  async execute(context: IdeCommandContext, args: MoveSettingsArgs): Promise<IdeCommandResult> {
    await context.mainApi.moveSettings(!!args["-pull"], !!args["-c"]);
    writeSuccessMessage(context.output, t("commands.common.success"));
    return commandSuccess;
  }
}

type SettingsDialogArgs = {
  page?: string;
};

/**
 * Opens the Settings dialog (`.plans/MENU_REDESIGN_PLAN.md` §4), optionally on one page.
 */
export class SettingsDialogCommand extends IdeCommandBase<SettingsDialogArgs> {
  readonly id = "settings";
  // --- Opens the Settings dialog: never through automation (`.plans/COMMAND_LINE_AUTOMATION_PLAN.md` T5)
  readonly automation = "deny" as const;
  get description() {
    return t("commands.settings.description", { pages: SETTINGS_PAGES.map((p) => p.id).join(", ") });
  }
  readonly usage = "settings [<page>]";
  readonly aliases = [];
  readonly argumentInfo: CommandArgumentInfo = {
    optional: [{ name: "page" }]
  };

  async validateCommandArgs(
    _context: IdeCommandContext,
    args: SettingsDialogArgs
  ): Promise<ValidationMessage[]> {
    if (args.page !== undefined && !SETTINGS_PAGES.some((p) => p.id === args.page)) {
      return [
        validationError(
          t("commands.settings.unknownPage", {
            page: args.page,
            pages: SETTINGS_PAGES.map((p) => p.id).join(", ")
          })
        )
      ];
    }
    return [];
  }

  async execute(context: IdeCommandContext, args: SettingsDialogArgs): Promise<IdeCommandResult> {
    const problem = await context.mainApi.runUiAction("open-settings", args.page);
    return problem ? commandError(problem) : commandSuccess;
  }
}
