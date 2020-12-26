import * as vscode from "vscode";
import {
  communicatorInstance,
  ExecutionState,
  MemoryPageInfo,
} from "./communicator";
import { machineConfigurationInstance } from "./machine-config";
import { DiagViewFrame } from "../shared/machines/diag-info";
import { createMachineViewProvider, MachineViewProvider } from "./machines";
import { last } from "lodash";

// ============================================================================
// Module local variables

// --- The current view provider
let machineViewProvider : MachineViewProvider | null;

// --- Communicator internal state
let started = false;
let cancelled = false;
let connected = false;

// --- The last frame information received
let lastFrameInfo: DiagViewFrame;

// --- The last set of breakpoints received
let lastBreakpoints: number[] = [];

// --- The last machine type
let lastMachineType: string | undefined = "";

// --- Event holder variables
let frameInfoChanged: vscode.EventEmitter<DiagViewFrame> = new vscode.EventEmitter<DiagViewFrame>();
let executionStateChanged: vscode.EventEmitter<ExecutionState> = new vscode.EventEmitter<ExecutionState>();
let connectionStateChanged: vscode.EventEmitter<boolean> = new vscode.EventEmitter<boolean>();
let breakpointsChanged: vscode.EventEmitter<number[]> = new vscode.EventEmitter<
  number[]
>();
let machineTypeChanged: vscode.EventEmitter<string> = new vscode.EventEmitter<string>();
let memoryPagingChanged: vscode.EventEmitter<MemoryPageInfo> = new vscode.EventEmitter<MemoryPageInfo>();

// ============================================================================
// Module initialization

resetLastFrameInfo();

// ============================================================================
// Module interface

/**
 * Gets the current machine view provider
 */
export function getMachineViewProvider() : MachineViewProvider | null {
  return machineViewProvider;
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
 * Gets the latest machine type
 */
export function getLastMachineType(): string | undefined {
  return lastMachineType;
}

/**
 * Fires when frame information has been changed
 */
export const onFrameInfoChanged: vscode.Event<DiagViewFrame> =
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
 * Fires when machine type has been changed
 */
export const onMachineTypeChanged: vscode.Event<string> =
  machineTypeChanged.event;

/**
 * Fires when memory paging has been changed
 */
export const onMemoryPagingChanged: vscode.Event<MemoryPageInfo> =
  memoryPagingChanged.event;

/**
 * Starts the notification watcher task
 */
export async function startNotifier(): Promise<void> {
  if (started) {
    return;
  }
  vscode.commands.executeCommand("setContext", "kliveEmuConnected", false);

  cancelled = false;
  onConnectionStateChanged((state) => {
    if (!state) {
      resetLastFrameInfo();
    }
    vscode.commands.executeCommand("setContext", "kliveEmuConnected", state);
  });

  while (!cancelled) {
    await requestEmulatorInfo();
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

// ============================================================================
// Module helpers

/**
 * Tries to query information from the emulator
 */
async function requestEmulatorInfo(): Promise<void> {
  try {
    if (!connected) {
      // --- Restore lost connection
      connected = await communicatorInstance.hello();
      if (connected) {
        connectionStateChanged.fire(connected);
        await communicatorInstance.signConfigurationChange();
        await communicatorInstance.setMachineType(
          machineConfigurationInstance.configuration.type
        );
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
      frameInfo.runsInDebug !== lastFrameInfo.runsInDebug ||
      frameInfo.startCount !== lastFrameInfo.startCount
    ) {
      executionStateChanged.fire({
        state: getExecutionStateName(frameInfo.executionState),
        pc: frameInfo.pc,
        runsInDebug: frameInfo.runsInDebug,
      });
    }

    // --- Remember the last frame information
    lastFrameInfo = frameInfo;

    // --- Handle changes in breakpoint state
    if (!frameInfo.breakpoints) {
      frameInfo.breakpoints = [];
    }
    // --- Compare breakpoints
    if (
      lastBreakpoints.length !== frameInfo.breakpoints.length ||
      frameInfo.breakpoints.some((item) => !lastBreakpoints.includes(item))
    ) {
      // --- Breakpoints changed
      breakpointsChanged.fire(frameInfo.breakpoints);
    }
    lastBreakpoints = frameInfo.breakpoints;

    // --- Handle changes in machine type
    if (frameInfo.machineType !== lastMachineType) {
      lastMachineType = frameInfo.machineType ?? "";
      machineViewProvider = createMachineViewProvider(lastMachineType);
      machineTypeChanged.fire(lastMachineType);
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
    pc: -1,
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
