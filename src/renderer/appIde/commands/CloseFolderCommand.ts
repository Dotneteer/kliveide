import { closeFolderAction } from "@state/actions";
import { IdeCommandContext } from "../../abstractions/IdeCommandContext";
import { IdeCommandResult } from "../../abstractions/IdeCommandResult";
import {
  commandError,
  writeSuccessMessage,
  commandSuccess,
  IdeCommandBase
} from "../services/ide-commands";
import { saveAllBeforeQuit } from "../MainToIdeProcessor";

export class CloseFolderCommand extends IdeCommandBase {
  readonly id = "close";
  readonly description = "Closes the open IDE folder";
  readonly usage = "close";

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    const projectPath = context.store.getState()?.project?.folderPath;
    if (!projectPath) {
      return commandError("No folder is open in the IDE.");
    }
    await saveAllBeforeQuit(context.store, context.service.projectService, {
      checkDocumentDisposal: false
    });
    const closed = await Promise.all(
      context.service.projectService
        .getDocumentHubServiceInstances()
        .map((hub) => hub.closeAllDocuments())
    );
    if (closed.some((result) => result === false)) {
      return commandError("Folder close cancelled.");
    }
    context.store.dispatch(closeFolderAction(), context.messageSource);
    context.emuApi.eraseAllBreakpoints();
    writeSuccessMessage(context.output, `Folder ${projectPath} closed.`);
    return commandSuccess;
  }
}
