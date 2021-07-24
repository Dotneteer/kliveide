/**
 * This interface represents a project node for transferring data
 * between the main and renderer processes
 */
export interface ProjectNode {
  /**
   * Indicates if the node is a folder
   */
  isFolder: boolean;

  /**
   * The name of the node
   */
  name: string;

  /**
   * Gets the full path of this node
   */
  fullPath?: string;

  /**
   * The type of the project node
   */
  type?: ProjectNodeType;

  /**
   * Optional children nodes (for folders)
   */
  children?: ProjectNode[];
}

/**
 * This enumeration describes project node types
 */
export enum ProjectNodeType {
  Unknown = -1,
  None = 0,
}
