import { t } from "@common/i18n/i18n";
import { CommandArgumentInfo } from "@renderer/abstractions/IdeCommandInfo";
import { IdeCommandContext } from "../../abstractions/IdeCommandContext";
import { IdeCommandResult } from "../../abstractions/IdeCommandResult";
import { writeSuccessMessage, commandSuccess, IdeCommandBase, toBin16 } from "../services/ide-commands";

type NumCommandArgs = {
  num: number;
};

export class NumCommand extends IdeCommandBase<NumCommandArgs> {
  protected minValue = -(2 ** 32);
  protected maxValue = 2 ** 32;
  readonly id = "num";
  get description() {
    return t("commands.num.description");
  }
  readonly usage = "num <number>";
  readonly aliases = [];
  readonly argumentInfo: CommandArgumentInfo = {
    mandatory: [{ name: "num", type: "number" }]
  };

  async execute(context: IdeCommandContext, args: NumCommandArgs): Promise<IdeCommandResult> {
    writeSuccessMessage(
      context.output,
      t("commands.num.result", {
        decimal: String(args.num),
        hex: args.num.toString(16).toUpperCase(),
        binary: toBin16(args.num)
      })
    );
    return commandSuccess;
  }
}
