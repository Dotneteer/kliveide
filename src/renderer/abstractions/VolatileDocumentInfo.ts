/**
 * This type describes the state information of a particular project document.
 */
export type VolatileDocumentInfo = {
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
   * Type of the document (determines the designer or code editor to handle it)
   */
  type: string;

  /**
   * Optional document icon
   */
  iconName?: string;

  /**
   * Optional document fill color
   */
  iconFill?: string;
};
