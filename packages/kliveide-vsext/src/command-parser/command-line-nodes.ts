import { BreakpointType } from "../shared/machines/api-data";

/**
 * Aggregate type for all Klive command nodes
 */
export type CmdNode =
  | SetBreakpointCmd
  | RemoveBreakpointCmd
  | EraseAllBreakpointsCmd
  | ListBreakpointsCmd;

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
  mode?: BreakpointType;
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
  mode?: BreakpointType;
}

/**
 * Erase all breakpoints command
 */
export interface EraseAllBreakpointsCmd extends BaseNode {
  type: "EraseAllBreakpointsCmd";
}

/**
 * List breakpoints command
 */
export interface ListBreakpointsCmd extends BaseNode {
  type: "ListBreakpointsCmd";
}
