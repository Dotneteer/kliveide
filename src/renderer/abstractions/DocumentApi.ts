/**
 * The API a document should provide for the document area to handle document-related events
 */
export type DocumentApi = {
  /**
   * Signs that the document is doing some internal processing that should not be
   * interrupted with tab changes.
   */
  isBusy?: () => boolean;

  /**
   * The document should save its state
   * @returns The state information to save into the document service cache
   */
  saveDocumentState?: () => Promise<any>;

  /**
   * Allows the component to prepare for getting closed
   */
  prepareForCompletion?: () => Promise<void>;

  /**
   * Test of the current document's view can be closed
   * @returns True, if it can be closed; otherwise, false.
   */
  canClose?: () => Promise<boolean>;
};
