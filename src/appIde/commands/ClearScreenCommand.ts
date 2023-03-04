import { InteractiveCommandContext } from "../abstractions/InteractiveCommandContext";
import { InteractiveCommandResult } from "../abstractions/InteractiveCommandResult";
import { commandSuccess } from "../services/interactive-commands";
import { CommandWithNoArgBase } from "./CommandWithNoArgsBase";

export class ClearScreenCommand extends CommandWithNoArgBase {
  readonly id = "cls";
  readonly description = "Clears the interactive command output";
  readonly usage = "cls";

  async doExecute (
    context: InteractiveCommandContext
  ): Promise<InteractiveCommandResult> {
    context.output.clear();
    return commandSuccess;
  }
}
