import * as vscode from "vscode";
import { communicatorInstance, FrameInfo } from "./communicator";

// --- Communicator internal state
let started = false;
let cancelled = false;
let connected = true;

// --- The last frame information received
let lastFrameInfo: FrameInfo;

let frameInfoChanged: vscode.EventEmitter<FrameInfo> = new vscode.EventEmitter<
  FrameInfo
>();
let executionStateChanged: vscode.EventEmitter<string> = new vscode.EventEmitter<
  string
>();
let connectionStateChanged: vscode.EventEmitter<boolean> = new vscode.EventEmitter<
  boolean
>();

/**
 * Fires when frame information has been changed
 */
export const onFrameInfoChanged: vscode.Event<FrameInfo> =
  frameInfoChanged.event;

/**
 * Fires when execution state has been changed
 */
export const onExecutionStateChanged: vscode.Event<string> =
  executionStateChanged.event;

/**
 * Fires when connection state has been changed
 */
export const onConnectionStateChanged: vscode.Event<boolean> =
  connectionStateChanged.event;

/**
 * Starts the notification watcher task
 */
export async function startNotifier(): Promise<void> {
  if (started) {
    return;
  }
  cancelled = false;
  onConnectionStateChanged((state) => {
    if (!state) {
      resetLastFrameInfo();
    }
  });

  while (!cancelled) {
    try {
      const frameInfo = await communicatorInstance.frameInfo();

      // --- Sense connection restore
      if (!connected) {
        connected = true;
        connectionStateChanged.fire(connected);
      }

      // --- Handle changes in frame ID
      if (
        frameInfo.frameCount !== lastFrameInfo.frameCount ||
        frameInfo.startCount !== lastFrameInfo.startCount
      ) {
        lastFrameInfo.startCount = frameInfo.startCount;
        lastFrameInfo.frameCount = frameInfo.frameCount;
        frameInfoChanged.fire(lastFrameInfo);
      }

      // --- Handle changes in execution state
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
      // --- Handle changes in connection state
      if (
        (err as Error).toString().indexOf("network timeout") >= 0 &&
        connected
      ) {
        connected = false;
        connectionStateChanged.fire(connected);
      }
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

/**
 * Resets last frame information to fire events after
 * reconnection
 */
function resetLastFrameInfo(): void {
  lastFrameInfo = {
    startCount: -1,
    frameCount: -1,
    executionState: 0,
  };
}

resetLastFrameInfo();
