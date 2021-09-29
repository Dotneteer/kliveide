/**
 * Represents a Klive command that can be executed from a Klive process.
 */
export interface IKliveCommand {
  /**
   * The ID of the command to register it
   */
  readonly id: string;

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
  execute?: (context: KliveCommandContext) => Promise<void>
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
}
