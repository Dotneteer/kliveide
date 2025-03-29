import { CommandArgumentInfo } from "@renderer/abstractions/IdeCommandInfo";
import { IdeCommandContext } from "../../abstractions/IdeCommandContext";
import { IdeCommandResult } from "../../abstractions/IdeCommandResult";
import { writeSuccessMessage, commandSuccess, IdeCommandBase } from "../services/ide-commands";
import { delay } from "@renderer/utils/timing";

type OpenFolderArgs = {
  folder: string;
};

export class OpenFolderCommand extends IdeCommandBase<OpenFolderArgs> {
  readonly id = "open";
  readonly description = "Opens a folder in the IDE";
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
            finalMessage: "Timeout while closing the last project"
          };
        }
      }
    }
    const errorMessage = await context.mainApi.openFolder(args.folder);
    if (errorMessage) {
      return {
        success: false,
        finalMessage: `Error opening folder: ${errorMessage}`
      };
    } else {
      writeSuccessMessage(context.output, `Project in folder ${args.folder} opened.`);
      return commandSuccess;
    }
  }
}
