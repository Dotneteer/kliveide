import { CommandArgumentInfo } from "@renderer/abstractions/IdeCommandInfo";
import { IdeCommandContext } from "../../abstractions/IdeCommandContext";
import { IdeCommandResult } from "../../abstractions/IdeCommandResult";
import { commandError, commandSuccessWith, IdeCommandBase } from "../services/ide-commands";
import { SJASMP_ALL, SJASMP_INSTALL_FOLDER } from "@main/sjasmp-integration/sjasmp-config";
import { t } from "@common/i18n/i18n";

type ResetSjasmPlusCommandArgs = {
  sjasmpPath: string;
  "-p"?: boolean;
};

export class ResetSjasmPlusCommand extends IdeCommandBase<ResetSjasmPlusCommandArgs> {
  readonly id = "sjasmp-reset";
  get description() {
    return t("commands.sjasmp.resetDescription");
  }
  readonly usage = "sjasmp-reset <Full path of the SjasmPlus installation folder> [-p]";
  readonly aliases = ["sjasmpr"];

  readonly argumentInfo: CommandArgumentInfo = {
    optional: [{ name: "sjasmpPath" }],
    commandOptions: ["-p"],
  };

  async execute(
    context: IdeCommandContext,
    args: ResetSjasmPlusCommandArgs
  ): Promise<IdeCommandResult> {
    const option = args["-p"] ? "-p" : "-u";
    if (args["-p"]) {
      const state = context.store.getState();
      if (!state.project?.isKliveProject) {
        return commandError(t("commands.common.projectOptionNeedsProject"));
      }
    }
    if (args.sjasmpPath) {
      await context.service.ideCommandsService.executeCommand(
        `set ${option} ${SJASMP_INSTALL_FOLDER} "${args.sjasmpPath}"`
      );
      return commandSuccessWith(t("commands.sjasmp.folderSet", { path: args.sjasmpPath }));
    } else {
      await context.service.ideCommandsService.executeCommand(`set ${SJASMP_ALL}`);
      return commandSuccessWith(t("commands.sjasmp.removed"));
    }
  }
}
