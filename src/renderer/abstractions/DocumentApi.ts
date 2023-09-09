/**
 * The API a document should provide for the document area to handle document-related events
 */
export type DocumentApi = {
  /**
   * Tests if the document is ready for disposal (its state has already been saved). 
   * @return True, the document is considered ready for disposal. Otherwise, the engine awaits 
   * the `beforeDocumentDisposal` method.
   */
  readyForDisposal?: () => Promise<boolean>;

  /**
   * This method is invoked before the document is disposed. This is the last opportunity to save its state.
   */
  beforeDocumentDisposal?: () => Promise<void>;

  /**
   * Test of the current document's view can be closed
   * @returns True, if it can be closed; otherwise, false.
   */
  canClose?: () => Promise<boolean>;
};
