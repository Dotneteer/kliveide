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

/**
 * Fires when frame information has been changed
 */
export const onFrameInfoChanged: vscode.Event<FrameInfo> =
  frameInfoChanged.event;

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
    } catch (err) {
      // --- This exception is intentionally ignored
    }
    await new Promise((r) => setTimeout(r, 200));
  }
}

/**
 * Stops the notification watcher task
 */
export function stopNotifier(): void {
  cancelled = true;
  started = false;
}
