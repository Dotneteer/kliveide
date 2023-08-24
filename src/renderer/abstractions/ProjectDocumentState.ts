import { ProjectNode } from "@renderer/appIde/project/project-node";
import { ITreeNode } from "@renderer/core/tree-node";
import { IDocumentService } from "./IDocumentService";

/**
 * This type describes the state information of a particular project document.
 */
export type ProjectDocumentState = {
  /**
   * The unique identifier of the project document. Use the project path of a particular
   * project node as an ID.
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
  node?: ITreeNode<ProjectNode>;

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

  /**
   * A continuously changing version count that increments at every document edit.
   */
  editVersionCount: number;

  /**
   * A version count that is set to the corresponding editVersionCount. When a document is saved,
   * this value takes the editVersionCount of the document at the point of saving.
   */
  savedVersionCount: number;

  /**
   * References to document services that use the particular project documents
   */
  usedIn?: IDocumentService[]
};
