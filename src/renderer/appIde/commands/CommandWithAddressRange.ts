import { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import { ValidationMessage } from "../../abstractions/ValidationMessage";
import {
  IdeCommandBase,
  validationError,
  getNumericTokenValue
} from "../services/ide-commands";

/**
 * Common base class for commands with an address range
 */
export abstract class CommandWithAddressRangeBase extends IdeCommandBase {
  /**
   * The start address argument
   */
  startAddress: number;

  /**
   * The end address argument
   */
  endAddress: number;

  /**
   * Number of extra arguments
   */
  protected abstract readonly extraArgCount?: number;

  async validateArgs (
    context: IdeCommandContext
  ): Promise<ValidationMessage | ValidationMessage[]> {
    const args = context.argTokens;
    if (this.extraArgCount === undefined) {
      if (args.length < 2) {
        return validationError(
          "This command expects at least two 16-bit address arguments"
        );
      }
    }
    if (args.length < 2 + this.extraArgCount) {
      return validationError(
        `This command expects two 16-bit address arguments and ${
          this.extraArgCount
        } other argument${this.extraArgCount > 1 ? "s" : ""}`
      );
    }

    // --- Obtain start address
    const { value: startValue, messages: startMessages } = getNumericTokenValue(
      args[0]
    );
    if (startValue === null) {
      return startMessages;
    }
    this.startAddress = startValue;
    if (this.startAddress < 0 || this.startAddress > 0x1_0000) {
      return validationError(
        `Start address value must be between ${0} and ${0x1_0000}`
      );
    }

    // --- Obtain start address
    const { value: endValue, messages: endMessages } = getNumericTokenValue(
      args[1]
    );
    if (endValue === null) {
      return endMessages;
    }
    this.endAddress = endValue;
    if (this.endAddress < 0 || this.endAddress > 0x1_0000) {
      return validationError(
        `End address value must be between ${0} and ${0x1_0000}`
      );
    }
    return [];
  }
}
