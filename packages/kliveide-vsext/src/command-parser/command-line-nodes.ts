/**
 * Aggregate type for all Klive command nodes
 */
export type CmdNode =
  | SetBreakpointCmd
  | RemoveBreakpointCmd
  | EraseAllBreakpointCmd;
  
/**
 * This class represents the root class of all syntax nodes
 */
export interface BaseNode {
  /**
   * Node type discriminator
   */
  type: CmdNode["type"];
  position: number;
}

/**
 * Set breakpoint command
 */
export interface SetBreakpointCmd extends BaseNode {
  type: "SetBreakpointCmd";
  partition?: number;
  address: number;
}

/**
 * Remove breakpoint command
 */
export interface RemoveBreakpointCmd extends BaseNode {
  type: "RemoveBreakpointCmd";
  partition?: number;
  address: number;
}

/**
 * Erase all breakpoints command
 */
export interface EraseAllBreakpointCmd extends BaseNode {
  type: "EraseAllBreakpointCmd";
}
