/**
 * Represents a watchpoint defined by the user.
 */
export type WatchpointInfo = {
  /**
   * The address of the watchpoint (if any)
   */
  address?: number;
  /**
   * The partition of the watchpoint (if any)
   */
  partition?: number;
  /**
   * The name of the watchpoint
   */
  name: string;
  /**
   * The length of the information to display for the watchpoint
   */
  length?: number;
  /**
   * The type of the watchpoint
   */
  type?: "leNumber" | "beNumber" | "bool" | "string";
}