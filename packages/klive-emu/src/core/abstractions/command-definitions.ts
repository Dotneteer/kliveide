import { AppState } from "@state/AppState";

/**
 * Represents the execution context of a command
 */
export type CommandExecutionContext = {};

/**
 * Represents a command
 */
export type Command = {
  readonly id: string;
  readonly text: string;
  readonly visible?: boolean;
  readonly enabled?: boolean;
  readonly iconName?: string;
  readonly checked?: boolean;
  readonly execute?: (context?: CommandExecutionContext) => void;
};

/**
 * Represents a command group
 */
export type CommandGroup = {
  readonly id: string;
  readonly text: string;
  readonly visible?: boolean;
  readonly enabled?: boolean;
  readonly iconName?: string;
  readonly items: MenuItem[];
};

/**
 * Represents an item in a menu
 */
export type MenuItem = Command | CommandGroup | "separator" | IKliveCommand;

/**
 * Type guard for a CommandGroup
 * @param item Item to check
 * @returns Is a CommandGroup instance?
 */
export function isCommandGroup(item: MenuItem): item is CommandGroup {
  return (item as CommandGroup).items !== undefined;
}

/**
 * Type guard for an IKliveCommand
 * @param item Item to check
 * @returns Is an IKliveCommand instance?
 */
export function isKliveCommand(item: MenuItem): item is IKliveCommand {
  return (item as IKliveCommand).commandId !== undefined;
}

/**
 * Represents a Klive command that can be executed from a Klive process.
 */
export interface IKliveCommand {
  /**
   * The ID of the command to register it
   */
  readonly commandId: string;

  /**
   * Optional title of the command
   */
  readonly title?: string;

  /**
   * Optional icon of the command
   */
  readonly icon?: string;

  /**
   * Indicates if the command is enabled (default: true)
   */
  enabled?: boolean;

  /**
   * Indicates if the command is visible (default: true)
   */
  visible?: boolean;

  /**
   * Indicates if the command is checked (default: false)
   */
  checked?: boolean;

  /**
   * Optional function to query the state of the command
   */
  queryState?: (context: KliveCommandContext) => Promise<void>;

  /**
   * Executes the command in the specified context
   */
  execute?: (context: KliveCommandContext) => Promise<void>;
}

/**
 * The process the command is executed in
 */
export type KliveProcess = "main" | "emu" | "ide";

/**
 * The execution state of the virtual machine
 */
export type ExecutionState = "none" | "running" | "paused" | "stopped";

/**
 * Declares the context the specified klive command is executed in
 */
export type KliveCommandContext = {
  /**
   * The command used within the context
   */
  commandInfo: IKliveCommand;

  /**
   * Process executing the command
   */
  process: KliveProcess;

  /**
   * The type of the virtual machine currently using the command
   */
  machineType: string | null;

  /**
   * The execution state of the virtual machine
   */
  executionState: ExecutionState;

  /**
   * The document resource this command is executed on
   */
  resource: string | null;

  /**
   * Indicates if the resource document is active
   */
  resourceActive: boolean;

  /**
   * The full application state
   */
  appState: AppState;
};
