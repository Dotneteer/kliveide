import { CommandArgumentInfo } from "@renderer/abstractions/IdeCommandInfo";
import { IdeCommandContext } from "../../abstractions/IdeCommandContext";
import { IdeCommandResult } from "../../abstractions/IdeCommandResult";
import { writeSuccessMessage, commandSuccess, IdeCommandBase } from "../services/ide-commands";

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
