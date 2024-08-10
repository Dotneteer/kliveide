/**
 * This interface represents a project node for transferring data
 * between the main and renderer processes
 */
export type ProjectNode = {
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
   * Gets the project root relative path of this node
   */
  projectPath?: string;

  /**
   * The optional icon for the project node
   */
  icon?: string;

  /**
   * The optional icon fill color
   */
  iconFill?: string;

  /**
   * Node editor
   */
  editor?: string;

  /**
   * Node subtype
   */
  subType?: string;

  /**
   * Is the project node read-only?
   */
  isReadOnly?: boolean;

  /**
   * Is the node's file a binary file?
   */
  isBinary?: boolean;

  /**
   * Indicates if this node can be a build root
   */
  canBeBuildRoot?: boolean;

  /**
   * Optional properties
   */
  props?: Record<string, any>;

  /**
   * This project node should be open as permanent
   */
  openPermanent?: boolean;
};

/**
 * A set of hierarchical project nodes
 */
export type ProjectNodeWithChildren = ProjectNode & {
  children: ProjectNodeWithChildren[];
};
