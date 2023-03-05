import { DocumentInfo } from "./DocumentInfo";

export type DocumentState = DocumentInfo & {
  /**
   * Signs if the document is opened as temporary (the same slot can be used for another document)
   */
  isTemporary?: boolean;

  /**
   * Document state depending on the document type
   */
  stateValue?: any;
};
