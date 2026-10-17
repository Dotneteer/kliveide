import { CommandArgumentInfo } from "@renderer/abstractions/IdeCommandInfo";
import { IdeCommandContext } from "../../abstractions/IdeCommandContext";
import { IdeCommandResult } from "../../abstractions/IdeCommandResult";
import { writeSuccessMessage, commandSuccess, IdeCommandBase } from "../services/ide-commands";
import { delay } from "@renderer/utils/timing";
import { t } from "@common/i18n/i18n";

type OpenFolderArgs = {
  folder: string;
};

export class OpenFolderCommand extends IdeCommandBase<OpenFolderArgs> {
  readonly id = "open";
  get description() {
    return t("commands.open.description");
  }
  readonly usage = "open <project folder>";
  readonly aliases = ["op"];

  readonly argumentInfo: CommandArgumentInfo = {
    optional: [{ name: "folder" }]
  };

  async execute(context: IdeCommandContext, args: OpenFolderArgs): Promise<IdeCommandResult> {
    if (context.store.getState()?.project?.folderPath) {
      await delay(100);
      if (context.store.getState()?.project?.folderPath) {
        context.service.ideCommandsService.executeCommand("close", context.output);

        // --- Wait while the folder is closed
        let count = 0;
        while (count < 100) {
          if (!context.store.getState()?.project?.folderPath) break;
          count++;
          await delay(100);
        }
        if (count >= 100) {
          return {
            success: false,
            finalMessage: t("commands.open.closeTimeout")
          };
        }
      }
    }
    const errorMessage = await context.mainApi.openFolder(args.folder);
    if (errorMessage) {
      return {
        success: false,
        finalMessage: t("commands.common.openFolderError", { message: errorMessage })
      };
    } else {
      writeSuccessMessage(context.output, t("commands.open.opened", { path: args.folder }));
      return commandSuccess;
    }
  }
}
