import { closeFolderAction } from "@state/actions";
import { IdeCommandContext } from "../../abstractions/IdeCommandContext";
import { IdeCommandResult } from "../../abstractions/IdeCommandResult";
import {
  commandError,
  writeSuccessMessage,
  commandSuccess
} from "../services/ide-commands";
import { CommandWithNoArgBase } from "./CommandWithNoArgsBase";
import { saveAllBeforeQuit } from "../MainToIdeProcessor";

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
    await saveAllBeforeQuit(context.store, context.service.projectService);
    context.store.dispatch(closeFolderAction(), context.messageSource);
    writeSuccessMessage(context.output, `Folder ${projectPath} closed.`);
    return commandSuccess;
  }
}
