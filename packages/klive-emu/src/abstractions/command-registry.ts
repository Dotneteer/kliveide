// ============================================================================
// Commands are objects that can be accessed and executed by their IDs. To
// manage them, Klive uses a command registry that stores these commands by
// their IDs.
// ============================================================================

import {
  ExecutionState,
  IKliveCommand,
  KliveCommandContext,
} from "../extensibility/abstractions/command-def";
import { getSite } from "./process-site";
import { getState } from "./service-helpers";

// ----------------------------------------------------------------------------
// Command registry methods

let commandRegistry: Record<string, IKliveCommand> = {};

/**
 * Registers the specified command
 * @param command Command object
 */
export function registerCommand(command: IKliveCommand): void {
  if (commandRegistry[command.id]) {
    throw new Error(`Command ${command.id} has already been registered`);
  }
  commandRegistry[command.id] = command;
}

/**
 * Unregisters the specified command
 * @param command Command instance, or command ID
 */
export function unregisterCommand(command: IKliveCommand | string): void {
  if (typeof command === "string") {
    delete commandRegistry[command];
  } else {
    delete commandRegistry[command.id];
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
export async function executeCommand(id: string): Promise<void> {
  const command = getCommand(id);
  if (!command) {
    throw new Error(
      `Command with ID '${id}' cannot be found in the registry of '${getSite()}'`
    );
  }

  // --- Prepare the context
  const state = getState();
  let executionState: ExecutionState;
  switch (state.emulatorPanel?.executionState) {
    case 1:
      executionState = "running";
      break;
    case 2:
    case 3:
      executionState = "paused";
    case 4:
    case 5:
      executionState = "stopped";
    default:
      executionState = "none";
      break;
  }
  const context: KliveCommandContext = {
    process: getSite(),
    executionState,
    machineType: state.machineType,
    resource: state.project?.contextResourceId ?? null,
    resourceActive: state.project?.contextResourceActive ?? false,
  };

  // --- Refresh the state of the command
  command.queryState?.(context);

  // --- Execute only enabled commands
  if ((command?.enabled ?? true) && command.execute) {
    await command.execute(context);
  }
}
