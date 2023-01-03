import { InteractiveCommandContext, InteractiveCommandResult } from "../abstractions";
import { commandSuccess } from "../services/interactive-commands";
import { CommandWithNoArgBase } from "./CommandWithNoArgsBase";

export class ClearScreenCommand extends CommandWithNoArgBase {
  readonly id = "cls";
  readonly description = "Clears the interactive command output";
  readonly usage = "cls";

  async execute(
    context: InteractiveCommandContext
  ): Promise<InteractiveCommandResult> {
    context.output.clear();
    return commandSuccess;
  }
}
