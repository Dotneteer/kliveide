/**
 * Aggregate type for all Klive command nodes
 */
export type CmdNode =
  | SetBreakpointCmd
  | RemoveBreakpointCmd
  | EraseAllBreakpointsCmd;
  
/**
 * This class represents the root class of all syntax nodes
 */
export interface BaseNode {
  /**
   * Node type discriminator
   */
  type: CmdNode["type"];
}

/**
 * Set breakpoint command
 */
export interface SetBreakpointCmd extends BaseNode {
  type: "SetBreakpointCmd";
  mode?: string;
  partition?: number;
  address: number;
  hit?: number;
  value?: number;
}

/**
 * Remove breakpoint command
 */
export interface RemoveBreakpointCmd extends BaseNode {
  type: "RemoveBreakpointCmd";
  address: number;
}

/**
 * Erase all breakpoints command
 */
export interface EraseAllBreakpointsCmd extends BaseNode {
  type: "EraseAllBreakpointsCmd";
}
