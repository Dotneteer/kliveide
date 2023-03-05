import { InteractiveCommandContext } from "../abstractions/InteractiveCommandContext";
import { InteractiveCommandResult } from "../abstractions/InteractiveCommandResult";
import {
  writeSuccessMessage,
  commandSuccess
} from "../services/interactive-commands";
import { CommandWithNoArgBase } from "./CommandWithNoArgsBase";

export class ClearHistoryCommand extends CommandWithNoArgBase {
  readonly id = "clh";
  readonly description = "Clears the command prompt history";
  readonly usage = "clh";

  async doExecute (
    context: InteractiveCommandContext
  ): Promise<InteractiveCommandResult> {
    context.service.interactiveCommandsService.clearHistory();
    writeSuccessMessage(
      context.output,
      "Interactive command prompt history cleared."
    );
    return commandSuccess;
  }
}
