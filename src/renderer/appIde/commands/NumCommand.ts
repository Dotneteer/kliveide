import { CommandArgumentInfo } from "@renderer/abstractions/IdeCommandInfo";
import { IdeCommandContext } from "../../abstractions/IdeCommandContext";
import { IdeCommandResult } from "../../abstractions/IdeCommandResult";
import { writeSuccessMessage, commandSuccess, IdeCommandBaseNew } from "../services/ide-commands";

type NumCommandArgs = {
  num: number;
};

export class NumCommand extends IdeCommandBaseNew<NumCommandArgs> {
  protected minValue = -(2 ** 32);
  protected maxValue = 2 ** 32;
  readonly id = "num";
  readonly description = "Converts the specified number to binary, decimal, and hexadecimal";
  readonly usage = "num <number>";
  readonly aliases = [];
  readonly argumentInfo: CommandArgumentInfo = {
    mandatory: [{ name: "num", type: "number" }]
  };

  async execute(context: IdeCommandContext, args: NumCommandArgs): Promise<IdeCommandResult> {
    writeSuccessMessage(
      context.output,
      `Number: ${args.num}, $${args.num.toString(16).toUpperCase()}, %${args.num.toString(2)}`
    );
    return commandSuccess;
  }
}
