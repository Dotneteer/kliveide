import { IdeCommandContext } from "../../abstractions/IdeCommandContext";
import { IdeCommandResult } from "../../abstractions/IdeCommandResult";
import { writeSuccessMessage, commandSuccess, IdeCommandBaseNew } from "../services/ide-commands";

export class ClearHistoryCommand extends IdeCommandBaseNew {
  readonly id = "clh";
  readonly description = "Clears the command prompt history";
  readonly usage = "clh";

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    context.service.ideCommandsService.clearHistory();
    writeSuccessMessage(context.output, "Interactive command prompt history cleared.");
    return commandSuccess;
  }
}
