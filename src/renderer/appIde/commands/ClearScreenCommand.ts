import { t } from "@common/i18n/i18n";
import { IdeCommandContext } from "../../abstractions/IdeCommandContext";
import { IdeCommandResult } from "../../abstractions/IdeCommandResult";
import { commandSuccess, IdeCommandBase } from "../services/ide-commands";

export class ClearScreenCommand extends IdeCommandBase {
  readonly id = "cls";
  get description() {
    return t("commands.cls.description");
  }
  readonly usage = "cls";

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    context.output.clear();
    return commandSuccess;
  }
}
