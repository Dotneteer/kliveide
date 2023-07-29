import { ToolInfo } from "./ToolInfo";

/**
 * Represents the state of a particular tool
 */
export type ToolState = ToolInfo & {
  /**
   * Other tool state
   */
  stateValue?: any;
};
