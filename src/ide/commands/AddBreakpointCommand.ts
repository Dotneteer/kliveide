import { BinaryBreakpoint } from "@abstractions/code-runner-service";
import {
  getNumericTokenValue,
  InteractiveCommandBase,
  InteractiveCommandResult,
  Token,
  TraceMessage,
  TraceMessageType,
} from "@abstractions/interactive-command-service";
import { dispatch } from "@core/service-registry";
import { addBreakpointAction } from "@core/state/debugger-reducer";

/**
 * Adds a new binary breakpoint
 */
export class AddBreakpointCommand extends InteractiveCommandBase {
  private _address: number | null = null;
  private _addressStr: string | null;
  readonly id = "add-bp";
  readonly description = "Adds a new binary breakpoint";
  readonly usage = "add-bp <address>";
  readonly aliases = ["add-b", "bp"];

  /**
   * Validates the input arguments
   * @param args Arguments to validate
   * @returns A list of issues
   */
  async validateArgs(args: Token[]): Promise<TraceMessage | TraceMessage[]> {
    // --- Check argument number
    if (args.length !== 1) {
      return {
        type: TraceMessageType.Error,
        message: "Invalid number of arguments.",
      };
    }
    this._addressStr = args[0].text;
    this._address = getNumericTokenValue(args[0]);
    if (this._address === null) {
      return {
        type: TraceMessageType.Error,
        message: `'${args[0].text}' is not a valid address.`,
      };
    }
    if (this._address < 0 || this._address > 0x10000) {
      return {
        type: TraceMessageType.Error,
        message: `Address must be within a 16-bit value range. '${args[0].text}' is out of that range.`,
      };
    }
    return [];
  }

  /**
   * Executes the command within the specified context
   */
  async doExecute(): Promise<InteractiveCommandResult> {
    dispatch(
      addBreakpointAction(<BinaryBreakpoint>{
        type: "binary",
        location: this._address,
      })
    );
    return {
      success: true,
      finalMessage: `Breakpoint added to address ${this._addressStr}.`,
    };
  }
}
