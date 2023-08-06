import { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import { ValidationMessage } from "../../abstractions/ValidationMessage";
import { ValidationMessageType } from "../../abstractions/ValidationMessageType";
import { Token } from "../services/command-parser";
import { IdeCommandBase } from "../services/ide-commands";

/**
 * Common base class for commands with no args
 */
export abstract class CommandWithNoArgBase extends IdeCommandBase {
  async validateArgs (
    context: IdeCommandContext
  ): Promise<ValidationMessage | ValidationMessage[]> {
    return context.argTokens.length !== 0 ? expectNoArgs() : [];
  }
}

/**
 * Creates a message indicating that the command expects no arguments.
 */
function expectNoArgs (): ValidationMessage[] {
  return [
    {
      type: ValidationMessageType.Error,
      message: "This command does not expects any arguments"
    }
  ];
}
