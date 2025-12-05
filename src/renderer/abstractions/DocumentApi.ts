/**
 * The API a document should provide for the document area to handle document-related events
 */
export type DocumentApi = {
  /**
   * This method is invoked before the document is disposed. This is the last opportunity to save its state.
   */
  beforeDocumentDisposal?: () => Promise<void>;

  /**
   * Reloads the document content from the provided content
   * @param contents The new content to load
   */
  reloadContent?: (contents: string | Uint8Array) => void;
};
