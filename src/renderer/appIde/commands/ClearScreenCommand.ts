import { IdeCommandContext } from "../../abstractions/IdeCommandContext";
import { IdeCommandResult } from "../../abstractions/IdeCommandResult";
import { commandSuccess, IdeCommandBaseNew } from "../services/ide-commands";

export class ClearScreenCommand extends IdeCommandBaseNew {
  readonly id = "cls";
  readonly description = "Clears the interactive command output";
  readonly usage = "cls";

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    context.output.clear();
    return commandSuccess;
  }
}
