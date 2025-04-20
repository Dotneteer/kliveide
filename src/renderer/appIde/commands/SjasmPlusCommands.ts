import { CommandArgumentInfo } from "@renderer/abstractions/IdeCommandInfo";
import { IdeCommandContext } from "../../abstractions/IdeCommandContext";
import { IdeCommandResult } from "../../abstractions/IdeCommandResult";
import { commandSuccessWith, IdeCommandBase } from "../services/ide-commands";
import { SJASMP_ALL, SJASMP_INSTALL_FOLDER } from "@main/sjasmp-integration/sjasmp-config";

type ResetSjasmPlusCommandArgs = {
  sjasmpPath: string;
};

export class ResetSjasmPlusCommand extends IdeCommandBase<ResetSjasmPlusCommandArgs> {
  readonly id = "sjasmp-reset";
  readonly description = "Resets SjasmPlus settings with the provided installation folder";
  readonly usage = "sjasmp-reset <Full SjasmPlus executable path>";
  readonly aliases = ["sjasmpr"];

  readonly argumentInfo: CommandArgumentInfo = {
    optional: [{ name: "sjasmpPath" }]
  };

  async execute(
    context: IdeCommandContext,
    args: ResetSjasmPlusCommandArgs
  ): Promise<IdeCommandResult> {
    if (args.sjasmpPath) {
      await context.service.ideCommandsService.executeCommand(
        `set ${SJASMP_INSTALL_FOLDER} "${args.sjasmpPath}"`
      );
      let cmdMessage = `SjasmPlus install folder set to ${args.sjasmpPath}`;
      return commandSuccessWith(cmdMessage);
    } else {
      await context.service.ideCommandsService.executeCommand(`set ${SJASMP_ALL}`);
      return commandSuccessWith("SjasmPlus settings removed");
    }
  }
}
