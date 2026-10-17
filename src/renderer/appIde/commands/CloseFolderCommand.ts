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
import { t } from "@common/i18n/i18n";

export class CloseFolderCommand extends IdeCommandBase {
  readonly id = "close";
  get description() {
    return t("commands.close.description");
  }
  readonly usage = "close";

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    const projectPath = context.store.getState()?.project?.folderPath;
    if (!projectPath) {
      return commandError(t("commands.close.noFolder"));
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
      return commandError(t("commands.close.cancelled"));
    }
    context.store.dispatch(closeFolderAction(), context.messageSource);
    context.emuApi.eraseAllBreakpoints();
    writeSuccessMessage(context.output, t("commands.close.closed", { path: projectPath }));
    return commandSuccess;
  }
}
