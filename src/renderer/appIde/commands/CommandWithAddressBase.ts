import { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import { ValidationMessage } from "../../abstractions/ValidationMessage";
import { Token } from "../services/command-parser";
import {
  IdeCommandBase,
  validationError,
  getNumericTokenValue
} from "../services/ide-commands";

/**
 * Common base class for commands with a single address
 */
export abstract class CommandWithAddressBase extends IdeCommandBase {
  /**
   * The integer argument
   */
  address: number;

  /**
   * Number of extra arguments
   */
  protected abstract readonly extraArgCount?: number;

  async validateArgs (
    context: IdeCommandContext
  ): Promise<ValidationMessage | ValidationMessage[]> {
    const args = context.argTokens;
    if (this.extraArgCount === undefined) {
      if (args.length < 1) {
        return validationError(
          "This command expects at least a 16-bit address argument"
        );
      }
    } else {
      if (args.length < 1 + this.extraArgCount) {
        return validationError(
          `This command expects a 16-bit address argument and ${
            this.extraArgCount
          } other argument${this.extraArgCount > 1 ? "s" : ""}`
        );
      }
    }

    const { value, messages } = getNumericTokenValue(args[0]);
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
