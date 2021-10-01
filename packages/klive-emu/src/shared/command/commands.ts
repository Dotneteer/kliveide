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
  readonly execute?: ((context?: CommandExecutionContext) => void) | string;
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
export type MenuItem = Command | CommandGroup | "separator";

/**
 * Type guard for a CommandGroup
 * @param item Item to check
 * @returns Is a CommandGroup instance?
 */
export function isCommandGroup(item: MenuItem): item is CommandGroup {
  return (item as CommandGroup).items !== undefined;
}
