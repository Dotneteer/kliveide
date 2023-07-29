/**
 * Represents the information about a tool
 */
export type ToolInfo = {
  /**
   * Unique Tool ID
   */
  id: string;

  /**
   * Name to display
   */
  name: string;

  /**
   * Is the tool visible?
   */
  visible?: boolean;

  /**
   * Other tool state
   */
  stateValue?: any;
};
