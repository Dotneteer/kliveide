import { ValidationMessage } from "../abstractions/ValidationMessage";
import { Token } from "../services/command-parser";
import {
  InteractiveCommandBase,
  validationError,
  getNumericTokenValue
} from "../services/interactive-commands";

/**
 * Common base class for commands with a single address
 */
export abstract class CommandWithAddressBase extends InteractiveCommandBase {
  /**
   * The integer argument
   */
  address: number;

  /**
   * Number of extra arguments
   */
  protected abstract readonly extraArgCount?: number;

  async validateArgs (
    _args: Token[]
  ): Promise<ValidationMessage | ValidationMessage[]> {
    if (this.extraArgCount === undefined) {
      if (_args.length < 1) {
        return validationError(
          "This command expects at least a 16-bit address argument"
        );
      }
    } else {
      if (_args.length < 1 + this.extraArgCount) {
        return validationError(
          `This command expects a 16-bit address argument and ${
            this.extraArgCount
          } other argument${this.extraArgCount > 1 ? "s" : ""}`
        );
      }
    }

    const { value, messages } = getNumericTokenValue(_args[0]);
    if (value === null) {
      return messages;
    }
    this.address = value;
    if (this.address < 0 || this.address > 0x1_0000) {
      return validationError(
        `Argument value must be between ${0} and ${0x1_0000}`
      );
    }
    return [];
  }
}
