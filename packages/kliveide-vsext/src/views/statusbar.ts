import * as vscode from "vscode";
import {
  onExecutionStateChanged,
  onConnectionStateChanged,
} from "../emulator/notifier";

// --- Store the statusbar item here
let vmStateItem: vscode.StatusBarItem;

/**
 * Create the statusbar item for the machine state
 */
export function createVmStateStatusBarItem(): vscode.StatusBarItem {
  vmStateItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  vmStateItem.text = getStateMessage("none");
  vmStateItem.tooltip = "Click to start the Klive Emulator";
  vmStateItem.show();

  onExecutionStateChanged((execState) => {
    vmStateItem.text = getStateMessage(execState.state);
    vmStateItem.tooltip = getStateTooltip(execState.state);
  });

  onConnectionStateChanged((state) => {
    const execState = state ? "none" : "disconnected";
    vmStateItem.text = getStateMessage(execState);
    vmStateItem.tooltip = getStateTooltip(execState);
  });
  return vmStateItem;

  function getStateMessage(state: string): string {
    let statusIcon = "debug-disconnect";
    switch (state) {
      case "running":
        statusIcon = "play";
        break;
      case "pausing":
      case "paused":
        statusIcon = "debug-pause";
        break;
      case "none":
      case "stopping":
      case "stopped":
        statusIcon = "debug-stop";
        break;
    }
    return `Klive $(${statusIcon})`;
  }

  function getStateTooltip(state: string): string {
    let tooltip = "Click to start the Klive Emulator";
    switch (state) {
      case "running":
        tooltip = "The virtual machine is running.";
        break;
      case "pausing":
      case "paused":
        tooltip = "The virtual machine is paused.";
        break;
      case "none":
      case "stopping":
      case "stopped":
        tooltip = "The virtual machine is stopped.";
        break;
    }
    return tooltip;
  }
}
