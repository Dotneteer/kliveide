import * as vscode from "vscode";
import { communicatorInstance, FrameInfo } from "./communicator";

// --- Communicator internal state
let started = false;
let cancelled = false;

// --- The last frame information received
let lastFrameInfo: FrameInfo = {
  startCount: -1,
  frameCount: -1,
};

let frameInfoChanged: vscode.EventEmitter<FrameInfo> = new vscode.EventEmitter<
  FrameInfo
>();
let executionStateChanged: vscode.EventEmitter<string> = new vscode.EventEmitter<
  string
>();

/**
 * Fires when frame information has been changed
 */
export const onFrameInfoChanged: vscode.Event<FrameInfo> =
  frameInfoChanged.event;

/**
 * Fires when execution state has been changed
 */
export const onexecutionChanged: vscode.Event<string> =
  executionStateChanged.event;

/**
 * Starts the notification watcher task
 */
export async function startNotifier(): Promise<void> {
  if (started) {
    return;
  }
  cancelled = false;

  console.log("Notifier started");
  while (!cancelled) {
    try {
      const frameInfo = await communicatorInstance.frameInfo();
      if (
        frameInfo.frameCount !== lastFrameInfo.frameCount ||
        frameInfo.startCount !== lastFrameInfo.startCount
      ) {
        lastFrameInfo.startCount = frameInfo.startCount;
        lastFrameInfo.frameCount = frameInfo.frameCount;
        frameInfoChanged.fire(lastFrameInfo);
      }

      if (frameInfo.executionState !== lastFrameInfo.executionState) {
        lastFrameInfo.executionState = frameInfo.executionState;
        let execState = "none";
        switch (frameInfo.executionState) {
          case 1:
            execState = "running";
            break;
          case 2:
            execState = "pausing";
            break;
          case 3:
            execState = "paused";
            break;
          case 4:
            execState = "stopping";
            break;
          case 5:
            execState = "stopped";
            break;
        }
        executionStateChanged.fire(execState);
      }
    } catch (err) {
      // --- This exception is intentionally ignored
    }
    await new Promise((r) => setTimeout(r, 400));
  }
}

/**
 * Stops the notification watcher task
 */
export function stopNotifier(): void {
  cancelled = true;
  started = false;
}
