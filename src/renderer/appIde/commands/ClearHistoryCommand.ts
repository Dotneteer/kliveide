import { t } from "@common/i18n/i18n";
import { IdeCommandContext } from "../../abstractions/IdeCommandContext";
import { IdeCommandResult } from "../../abstractions/IdeCommandResult";
import { writeSuccessMessage, commandSuccess, IdeCommandBase } from "../services/ide-commands";

export class ClearHistoryCommand extends IdeCommandBase {
  readonly id = "clh";
  get description() {
    return t("commands.clearHistory.description");
  }
  readonly usage = "clh";

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    context.service.ideCommandsService.clearHistory();
    writeSuccessMessage(context.output, t("commands.clearHistory.cleared"));
    return commandSuccess;
  }
}
