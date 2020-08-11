import * as vscode from "vscode";
import {
  communicatorInstance,
  FrameInfo,
  ExecutionState,
} from "./communicator";

// --- Communicator internal state
let started = false;
let cancelled = false;
let connected = true;

// --- The last frame information received
let lastFrameInfo: FrameInfo;

// --- The last set of breakpoints received
let lastBreakpoints: number[] = [];

let frameInfoChanged: vscode.EventEmitter<FrameInfo> = new vscode.EventEmitter<
  FrameInfo
>();
let executionStateChanged: vscode.EventEmitter<ExecutionState> = new vscode.EventEmitter<
  ExecutionState
>();
let connectionStateChanged: vscode.EventEmitter<boolean> = new vscode.EventEmitter<
  boolean
>();

let breakpointsChanged: vscode.EventEmitter<number[]> = new vscode.EventEmitter<
  number[]
>();

/**
 * Fires when frame information has been changed
 */
export const onFrameInfoChanged: vscode.Event<FrameInfo> =
  frameInfoChanged.event;

/**
 * Fires when execution state has been changed
 */
export const onExecutionStateChanged: vscode.Event<ExecutionState> =
  executionStateChanged.event;

/**
 * Fires when connection state has been changed
 */
export const onConnectionStateChanged: vscode.Event<boolean> =
  connectionStateChanged.event;

/**
 * Fires when breakpoints has been changed
 */
export const onBreakpointsChanged: vscode.Event<number[]> =
  breakpointsChanged.event;

/**
 * Starts the notification watcher task
 */
export async function startNotifier(): Promise<void> {
  if (started) {
    return;
  }
  vscode.commands.executeCommand(
    "setContext",
    "kliveEmuConnected",
    true
  );

  cancelled = false;
  onConnectionStateChanged((state) => {
    if (!state) {
      resetLastFrameInfo();
    }
    vscode.commands.executeCommand(
      "setContext",
      "kliveEmuConnected",
      state
    );
});

  while (!cancelled) {
    try {
      if (!connected) {
        // --- Restore lost connection
        connected = await communicatorInstance.hello();
        if (connected) {
          connectionStateChanged.fire(connected);
        }
      }

      // --- Obtain frame information to detect changes
      const frameInfo = await communicatorInstance.frameInfo();

      // --- Handle changes in frame ID
      if (
        frameInfo.frameCount !== lastFrameInfo.frameCount ||
        frameInfo.startCount !== lastFrameInfo.startCount ||
        frameInfo.pc !== lastFrameInfo.pc
      ) {
        frameInfoChanged.fire(frameInfo);
      }

      // --- Handle changes in execution state
      if (
        frameInfo.executionState !== lastFrameInfo.executionState ||
        frameInfo.startCount !== lastFrameInfo.startCount
      ) {
        executionStateChanged.fire({
          state: getExecutionStateName(frameInfo.executionState),
          pc: frameInfo.pc,
        });
      }

      // --- Remember the last frame information
      lastFrameInfo = frameInfo;

      // --- Handle changes in breakpoint state
      if (!frameInfo.breakpoints) {
        frameInfo.breakpoints = [];
      }
      if (lastBreakpoints !== frameInfo.breakpoints) {
        // --- Compare breakpoints
        let differs = lastBreakpoints.length !== frameInfo.breakpoints.length;
        if (
          differs ||
          frameInfo.breakpoints.some((item) => !lastBreakpoints.includes(item))
        ) {
          // --- Breakpoints changed
          breakpointsChanged.fire(frameInfo.breakpoints);
        }
        lastBreakpoints = frameInfo.breakpoints;
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
    await new Promise((r) => setTimeout(r, 100));
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
 * Gets the last connection state
 */
export function getLastConnectedState(): boolean {
  return connected;
}

/**
 * Gets the last connection state
 */
export function getLastExecutionState(): ExecutionState {
  return {
    state: getExecutionStateName(lastFrameInfo?.executionState),
    pc: lastFrameInfo.pc,
  };
}

/**
 * Gets the latest set of breakpoints
 */
export function getLastBreakpoints(): number[] {
  return lastBreakpoints;
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

/**
 * Gets the name of the execution state
 * @param id Execution state ID
 */
function getExecutionStateName(id?: number): string {
  let execState = "none";
  switch (id) {
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
  return execState;
}

resetLastFrameInfo();
