import * as vscode from "vscode";
import { CmdNode } from "../command-parser/command-line-nodes";
import { breakpointDefinitions } from "./breakpoints";
import {
  BreakpointDefinition,
  BreakpointType,
} from "../shared/machines/api-data";
import { communicatorInstance } from "./communicator";

/**
 * The output channel for the command handler
 */
let commandHandlerOutput: vscode.OutputChannel | null;
let commandExecuted: vscode.EventEmitter<CmdNode> = new vscode.EventEmitter<CmdNode>();

/**
 * Sets the output channel of the commannd handler
 * @param channel
 */
export function setCommandHandlerOutput(channel: vscode.OutputChannel): void {
  commandHandlerOutput = channel;
}

/**
 * Fires when a Klive command has been executed
 */
export const onCommandExecuted: vscode.Event<CmdNode> = commandExecuted.event;

/**
 * This function handles the Klive text commands
 * @param cmd Command to handle
 */
export async function handleKliveCommand(
  cmdText: string,
  cmd: CmdNode
): Promise<void> {
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
      await communicatorInstance.setBreakpoints(
        breakpointDefinitions.toArray()
      );
      displayBreakpoint(bp);
      break;
    }

    case "RemoveBreakpointCmd": {
      breakpointDefinitions.remove(cmd.address, cmd.mode);
      await communicatorInstance.setBreakpoints(
        breakpointDefinitions.toArray()
      );
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
      await communicatorInstance.setBreakpoints(
        breakpointDefinitions.toArray()
      );
      commandHandlerOutput?.appendLine("All breakpoints deleted.");
      break;
    }

    case "ListBreakpointsCmd": {
      breakpointDefinitions
        .toSortedArray()
        .forEach((brp) => displayBreakpoint(brp));
      break;
    }

    case "DisplayMemoryCmd":
      const contents = await communicatorInstance.getMemoryPartition(
        cmd.address >>> 16
      );
      const bytes = new Uint8Array(Buffer.from(contents, "base64"));
      const from = cmd.address & 0x3fff;
      const to = Math.min(from + 1024, 0x3fff);
      for (let i = from; i < to; i += 16) {
        let memLine = i.toString(16).padStart(4, "0") + ": ";
        for (let j = 0; j < 16; j++) {
          if (i + j > to) {
            break;
          }
          memLine += bytes[i + j].toString(16).padStart(2, "0") + " ";
        }
        commandHandlerOutput?.appendLine(memLine);
      }
      break;
  }

  // --- Notify subscribers about command execution
  commandExecuted.fire(cmd);
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
