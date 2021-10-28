import { BinaryBreakpoint } from "@abstractions/code-runner-service";
import {
  getNumericTokenValue,
  InteractiveCommandBase,
  InteractiveCommandResult,
  Token,
  TraceMessage,
  TraceMessageType,
} from "@abstractions/interactive-command-service";
import { dispatch, getState } from "@core/service-registry";
import { removeBreakpointAction } from "@core/state/debugger-reducer";

/**
 * Removes a binary breakpoint
 */
export class RemoveBreakpointCommand extends InteractiveCommandBase {
  private _address: number | null = null;
  private _addressStr: string | null;
  readonly id = "remove-bp";
  readonly description = "Removes a binary breakpoint";
  readonly usage = "remove-bp <address>";
  readonly aliases = ["rem-b", "del-bp", "dbp"];

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
    const bpCount = getState().debugger?.breakpoints?.length ?? 0;
    dispatch(
      removeBreakpointAction(<BinaryBreakpoint>{
        type: "binary",
        location: this._address,
      })
    );
    const bpCountAfter = getState().debugger?.breakpoints?.length ?? 0;
    return {
      success: true,
      finalMessage: bpCountAfter < bpCount 
        ? `Breakpoint removed address ${this._addressStr}.`
        : "No breakpoint removed.",
    };
  }
}
