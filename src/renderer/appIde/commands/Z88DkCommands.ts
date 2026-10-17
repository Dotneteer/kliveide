import { CommandArgumentInfo } from "@renderer/abstractions/IdeCommandInfo";
import { IdeCommandContext } from "../../abstractions/IdeCommandContext";
import { IdeCommandResult } from "../../abstractions/IdeCommandResult";
import { commandSuccessWith, IdeCommandBase } from "../services/ide-commands";
import { Z88DK_ALL, Z88DK_INSTALL_FOLDER } from "@main/z88dk-integration/z88dk-config";
import { t } from "@common/i18n/i18n";

type ResetZ88DkCommandArgs = {
  z88dkPath: string;
};

export class ResetZ88DkCommand extends IdeCommandBase<ResetZ88DkCommandArgs> {
  readonly id = "z88dk-reset";
  get description() {
    return t("commands.z88dk.resetDescription");
  }
  readonly usage = "z88dk-reset <Full ZXBC executable path>";
  readonly aliases = ["z88dkr"];

  readonly argumentInfo: CommandArgumentInfo = {
    optional: [{ name: "z88dkPath" }]
  };

  async execute(
    context: IdeCommandContext,
    args: ResetZ88DkCommandArgs
  ): Promise<IdeCommandResult> {
    if (args.z88dkPath) {
      await context.service.ideCommandsService.executeCommand(
        `set ${Z88DK_INSTALL_FOLDER} "${args.z88dkPath}"`
      );
      return commandSuccessWith(t("commands.z88dk.folderSet", { path: args.z88dkPath }));
    } else {
      await context.service.ideCommandsService.executeCommand(`set ${Z88DK_ALL}`);
      return commandSuccessWith(t("commands.z88dk.removed"));
    }
  }
}
