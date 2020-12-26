import * as vscode from "vscode";
import { BreakpointType, CmdNode } from "../command-parser/command-line-nodes";
import { BreakpointDefinition, breakpointDefinitions } from "./breakpoints";

/**
 * The output channel for the command handler
 */
let commandHandlerOutput: vscode.OutputChannel | null;

/**
 * Sets the output channel of the commannd handler
 * @param channel
 */
export function setCommandHandlerOutput(channel: vscode.OutputChannel): void {
  commandHandlerOutput = channel;
}

/**
 * This function handles the Klive text commands
 * @param cmd Command to handle
 */
export function handleKliveCommand(cmdText: string, cmd: CmdNode): void {
  commandHandlerOutput?.appendLine(`$ ${cmdText}`);
  switch (cmd.type) {
    case "SetBreakpointCmd": {
      const bp = {
        mode: cmd.mode as BreakpointType,
        partition: cmd.partition,
        address: cmd.address,
        hit: cmd.hit,
        value: cmd.value,
      };
      breakpointDefinitions.set(bp);
      displayBreakpoint(bp);
      break;
    }

    case "RemoveBreakpointCmd": {
      breakpointDefinitions.remove(cmd.address, cmd.mode);
      commandHandlerOutput?.appendLine(
        `Breakpoint at ${cmd.address
          .toString(16)
          .padStart(4, "0")} (${cmd.address.toString(10).padStart(5, "0")})${
          cmd.mode ? " {" + cmd.mode + "}" : ""
        } removed`
      );
      break;
    }

    case "EraseAllBreakpointsCmd": {
      breakpointDefinitions.eraseAll();
      commandHandlerOutput?.appendLine("All breakpoints deleted.");
      break;
    }

    case "ListBreakpointsCmd": {
      breakpointDefinitions
        .toSortedArray()
        .forEach((brp) => displayBreakpoint(brp));
      break;
    }
  }
}

/**
 * Displays information about the specified breakpoint
 * @param brp Breakpoint to display
 */
function displayBreakpoint(brp: BreakpointDefinition): void {
  commandHandlerOutput?.appendLine(
    `$${brp.address.toString(16).padStart(4, "0")} (${brp.address
      .toString(10)
      .padStart(5, "0")})${
      brp.partition
        ? " [$" + brp.partition.toString(16).padStart(2, "0") + "]"
        : ""
    }${brp.mode ? " {" + brp.mode + "}" : ""}${
      brp.hit ? " hit:" + brp.hit : ""
    }${brp.value ? " val:" + brp.value : ""}`
  );
}
