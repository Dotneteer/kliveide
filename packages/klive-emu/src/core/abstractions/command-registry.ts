// ============================================================================
// Commands are objects that can be accessed and executed by their IDs. To
// manage them, Klive uses a command registry that stores these commands by
// their IDs.
// ============================================================================

import { getState } from "@core/service-registry";
import { ILiteEvent, LiteEvent } from "@core/utils/lite-event";
import {
  ExecutionState,
  IKliveCommand,
  KliveCommandContext,
} from "@core/abstractions/command-def";
import { getSite } from "./process-site";

// ----------------------------------------------------------------------------
// Command registry methods

let commandRegistry: Record<string, IKliveCommand> = {};
let statusWatchRunning = false;

/**
 * This event is raised whenever the status of a command changes
 */
export const commandStatusChanged: ILiteEvent<string> = new LiteEvent<string>();

/**
 * Registers the specified command
 * @param command Command object
 */
export function registerCommand(command: IKliveCommand): void {
  if (commandRegistry[command.commandId]) {
    throw new Error(`Command ${command.commandId} has already been registered`);
  }
  commandRegistry[command.commandId] = command;
}

/**
 * Unregisters the specified command
 * @param command Command instance, or command ID
 */
export function unregisterCommand(command: IKliveCommand | string): void {
  if (typeof command === "string") {
    delete commandRegistry[command];
  } else {
    delete commandRegistry[command.commandId];
  }
}

/**
 * Gets the command from the registry
 * @param id Command ID
 * @returns Command instance, if found; otherwise, null
 */
export function getCommand(id: string): IKliveCommand | null {
  return commandRegistry[id] ?? null;
}

/**
 * Gets all command IDs from the registry
 * @returns List of registered command IDs
 */
export function getRegisteredCommandIDs(): string[] {
  const result: string[] = [];
  for (const key in commandRegistry) {
    result.push(key);
  }
  return result;
}

/**
 * Gets all commands from the registry
 * @returns List of registered commands
 */
export function getRegisteredCommands(): IKliveCommand[] {
  const result: IKliveCommand[] = [];
  for (const key in commandRegistry) {
    result.push(commandRegistry[key]);
  }
  return result;
}

/**
 * Executes the specified command
 * @param id Command ID
 */
export async function executeCommand(
  id: string,
  additionalContext?: any
): Promise<void> {
  const command = getCommand(id);
  if (!command) {
    throw new Error(
      `Command with ID '${id}' cannot be found in the registry of '${getSite()}'`
    );
  }

  const context = { ...createCommandContext(command), ...additionalContext };

  // --- Refresh the state of the command
  command.queryState?.(context);

  // --- Execute only enabled commands
  if ((command?.enabled ?? true) && command.execute) {
    await command.execute(context);
  }
}

/**
 * Create the command context into which a status query or a command
 * can run
 */
function createCommandContext(command: IKliveCommand): KliveCommandContext {
  const state = getState();
  let executionState: ExecutionState;
  switch (state.emulatorPanel?.executionState) {
    case 1:
      executionState = "running";
      break;
    case 2:
    case 3:
      executionState = "paused";
      break;
    case 4:
    case 5:
      executionState = "stopped";
      break;
    default:
      executionState = "none";
      break;
  }
  return {
    commandInfo: command,
    process: getSite(),
    executionState,
    machineType: state.machineType,
    resource: null,
    resourceActive: false,
    appState: state,
  };
}

/**
 * Updates the status of the specified command
 * @param id ID of the command to update
 */
export async function updateCommandStatus(id: string): Promise<void> {
  const command = getCommand(id);
  if (!command) {
    return;
  }
  const context = createCommandContext(command);
  const oldEnabled = command.enabled;
  const oldVisible = command.visible;
  const oldChecked = command.checked;
  await command.queryState?.(context);
  if (
    command.enabled !== oldEnabled ||
    command.visible !== oldVisible ||
    command.checked !== oldChecked
  ) {
    (commandStatusChanged as LiteEvent<string>).fire(command.commandId);
  }
}

/**
 * Updates the state of all registered commands
 */
export async function updateAllCommandState(): Promise<void> {
  getRegisteredCommandIDs().forEach((cmdId) => {
    try {
      updateCommandStatus(cmdId);
    } catch {
      // --- Ths error is intentionally ignored
    }
  });
}

/**
 * Starts watching for command status
 * @returns
 */
export function startCommandStatusQuery(): void {
  if (statusWatchRunning) {
    return;
  }
  statusWatchRunning = true;
  (async () => {
    while (statusWatchRunning) {
      await new Promise((r) => setTimeout(r, 200));
      await updateAllCommandState();
    }
  })();
}

/**
 * Stops watching for command status
 */
export function stopCommandStatusQuery(): void {
  statusWatchRunning = false;
}
