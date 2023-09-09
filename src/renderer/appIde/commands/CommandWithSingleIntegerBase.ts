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
export abstract class CommandWithSingleIntegerBase extends IdeCommandBase {
  /**
   * The integer argument
   */
  arg: number;

  /**
   * The minimum value of the argument (inclusive)
   */
  protected abstract readonly minValue: number;

  /**
   * The maximum value of the argument (inclusive)
   */
  protected abstract readonly maxValue: number;

  async validateArgs (
    context: IdeCommandContext
  ): Promise<ValidationMessage | ValidationMessage[]> {
    if (context.argTokens.length !== 1) {
      return expectArgs(1);
    }
    const { value, messages } = getNumericTokenValue(context.argTokens[0]);
    if (value === null) {
      return messages;
    }
    this.arg = value;
    if (this.arg < this.minValue || this.arg > this.maxValue) {
      return validationError(
        `Argument value must be between ${this.minValue} and ${this.maxValue}`
      );
    }
    return [];
  }
}
