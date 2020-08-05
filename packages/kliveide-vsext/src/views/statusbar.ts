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
  vmStateItem.show();

  onExecutionStateChanged((state) => {
    vmStateItem.text = getStateMessage(state);
  });

  onConnectionStateChanged((state) => {
    vmStateItem.text = getStateMessage(state ? "none" : "disconnected");
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
}
