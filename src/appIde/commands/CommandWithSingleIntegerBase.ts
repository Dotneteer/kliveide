import { ValidationMessage } from "../abstractions";
import { Token } from "../services/command-parser";
import {
  expectArgs,
  getNumericTokenValue,
  InteractiveCommandBase,
  validationError
} from "../services/interactive-commands";

/**
 * Common base class for commands with a single address
 */
export abstract class CommandWithSingleIntegerBase extends InteractiveCommandBase {
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
    _args: Token[]
  ): Promise<ValidationMessage | ValidationMessage[]> {
    if (_args.length !== 1) {
      return expectArgs(1);
    }
    const { value, messages } = getNumericTokenValue(_args[0]);
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
