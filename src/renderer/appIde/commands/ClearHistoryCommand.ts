import { IdeCommandContext } from "../../abstractions/IdeCommandContext";
import { IdeCommandResult } from "../../abstractions/IdeCommandResult";
import {
  writeSuccessMessage,
  commandSuccess
} from "../services/ide-commands";
import { CommandWithNoArgBase } from "./CommandWithNoArgsBase";

export class ClearHistoryCommand extends CommandWithNoArgBase {
  readonly id = "clh";
  readonly description = "Clears the command prompt history";
  readonly usage = "clh";

  async doExecute (
    context: IdeCommandContext
  ): Promise<IdeCommandResult> {
    context.service.ideCommandsService.clearHistory();
    writeSuccessMessage(
      context.output,
      "Interactive command prompt history cleared."
    );
    return commandSuccess;
  }
}
