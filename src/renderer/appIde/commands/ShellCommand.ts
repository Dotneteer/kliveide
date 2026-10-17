import { CommandArgumentInfo } from "@renderer/abstractions/IdeCommandInfo";
import { IdeCommandContext } from "../../abstractions/IdeCommandContext";
import { IdeCommandResult } from "../../abstractions/IdeCommandResult";
import {
  writeSuccessMessage,
  commandSuccess,
  IdeCommandBase,
  commandError
} from "../services/ide-commands";
import { t } from "@common/i18n/i18n";

type ShellCommandArgs = {
  filename: string;
};

export class ShellCommand extends IdeCommandBase<ShellCommandArgs> {
  readonly id = "sh";
  get description() {
    return t("commands.sh.description");
  }
  readonly usage = "sh <filename>";
  readonly aliases = [];
  readonly argumentInfo: CommandArgumentInfo = {
    mandatory: [{ name: "filename", type: "string" }]
  };

  async execute(context: IdeCommandContext, args: ShellCommandArgs): Promise<IdeCommandResult> {
    try {
      const result = await context.mainApi.openWithShell(args.filename);
      if (result.error) {
        return commandError(result.error);
      }
      writeSuccessMessage(context.output, t("commands.sh.executing", { path: result.path }));
      return commandSuccess;
    } catch (err) {
      return commandError(err.message);
    }
  }
}
