import { InteractiveCommandContext } from "../abstractions/InteractiveCommandContext";
import { InteractiveCommandResult } from "../abstractions/InteractiveCommandResult";
import {
  writeSuccessMessage,
  commandSuccess
} from "../services/interactive-commands";
import { CommandWithSingleIntegerBase } from "./CommandWithSingleIntegerBase";

export class NumCommand extends CommandWithSingleIntegerBase {
  protected minValue = -(2 ** 32);
  protected maxValue = 2 ** 32;
  readonly id = "num";
  readonly description =
    "Converts the specified number to binary, decimal, and hexadecimal";
  readonly usage = "num <number>";
  readonly aliases = [];

  protected extraArgCount = 0;

  async doExecute (
    context: InteractiveCommandContext
  ): Promise<InteractiveCommandResult> {
    writeSuccessMessage(
      context.output,
      `Number: ${this.arg}, $${this.arg
        .toString(16)
        .toUpperCase()}, %${this.arg.toString(2)}`
    );
    return commandSuccess;
  }
}
