import { IdeCommandContext } from "../abstractions/IdeCommandContext";
import { IdeCommandResult } from "../abstractions/IdeCommandResult";
import { commandSuccess } from "../services/interactive-commands";
import { CommandWithNoArgBase } from "./CommandWithNoArgsBase";

export class ClearScreenCommand extends CommandWithNoArgBase {
  readonly id = "cls";
  readonly description = "Clears the interactive command output";
  readonly usage = "cls";

  async doExecute (
    context: IdeCommandContext
  ): Promise<IdeCommandResult> {
    context.output.clear();
    return commandSuccess;
  }
}
