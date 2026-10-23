import type { FileContentKind } from "@common/ht1080z/basContent";

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

  /**
   * What the file holds when its extension does not say (a tokenised HT-1080Z `.bas`), sniffed by
   * the main process when it lists the folder (`.plans/HT1080Z_TAPE_VIEWERS_PLAN.md` D2)
   */
  contentKind?: FileContentKind;
};

/**
 * A set of hierarchical project nodes
 */
export type ProjectNodeWithChildren = ProjectNode & {
  children: ProjectNodeWithChildren[];
};
