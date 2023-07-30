import { ProjectNode } from "@appIde/project/project-node";
import { ITreeNode } from "@renderer/core/tree-node";

/**
 * This type describes a document that can have a designer (code editor) associated with it
 */
export type DocumentInfo = {
  /**
   * Unique ID of the document
   */
  id: string;

  /**
   * The document name to display
   */
  name: string;

  /**
   * Optional path of the document, provided it is associated with a project explorer file
   */
  path?: string;

  /**
   * Type of the document (determines the designer or code editor to handle it)
   */
  type: string;

  /**
   * Optional programming language of the document
   */
  language?: string;

  /**
   * Is the document read-only?
   */
  isReadOnly?: boolean;

  /**
   * Optional document icon
   */
  iconName?: string;

  /**
   * Optional document fill color
   */
  iconFill?: string;

  /**
   * The optional tree node in the explorer
   */
  node?: ITreeNode<ProjectNode>

  /**
   * The optional view version of the document
   */
  viewVersion: number;

  /**
   * Signs if the document is opened as temporary (the same slot can be used for another document)
   */
  isTemporary?: boolean;

  /**
   * Document state depending on the document type
   */
  stateValue?: any;
};
