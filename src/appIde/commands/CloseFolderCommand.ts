import { closeFolderAction } from "@common/state/actions";
import { IdeCommandContext } from "../abstractions/IdeCommandContext";
import { IdeCommandResult } from "../abstractions/IdeCommandResult";
import {
  commandError,
  writeSuccessMessage,
  commandSuccess
} from "../services/interactive-commands";
import { CommandWithNoArgBase } from "./CommandWithNoArgsBase";

export class CloseFolderCommand extends CommandWithNoArgBase {
  readonly id = "close";
  readonly description = "Closes the open IDE folder";
  readonly usage = "close";

  async doExecute (
    context: IdeCommandContext
  ): Promise<IdeCommandResult> {
    const projectPath = context.store.getState()?.project?.folderPath;
    if (!projectPath) {
      return commandError("No folder is open in the IDE.");
    }
    context.store.dispatch(closeFolderAction());
    writeSuccessMessage(context.output, `Folder ${projectPath} closed.`);
    return commandSuccess;
  }
}
