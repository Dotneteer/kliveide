import { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import { ValidationMessage } from "../../abstractions/ValidationMessage";
import {
  IdeCommandBase,
  expectArgs,
  getNumericTokenValue,
  validationError
} from "../services/ide-commands";

/**
 * Common base class for commands with a single address
 */
export abstract class CommandWithSingleStringBase extends IdeCommandBase {
  /**
   * The integer argument
   */
  arg: string;

  async validateArgs (
    context: IdeCommandContext
  ): Promise<ValidationMessage | ValidationMessage[]> {
    if (context.argTokens.length !== 1) {
      return expectArgs(1);
    }
    this.arg = context.argTokens[0].text;
    return [];
  }
}
