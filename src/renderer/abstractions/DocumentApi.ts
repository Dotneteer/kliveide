/**
 * The API a document should provide for the document area to handle document-related events
 */
export type DocumentApi = {
  /**
   * This method is invoked before the document is disposed. This is the last opportunity to save its state.
   * Return false to cancel the disposal.
   */
  beforeDocumentDisposal?: () => Promise<void | boolean>;

  /**
   * Reloads the document content from the provided content
   * @param contents The new content to load
   */
  reloadContent?: (contents: string | Uint8Array) => void;

  /**
   * Brings an address into view in a document that is already open.
   *
   * View state is read once, when a document mounts, so re-pointing an open document by writing to
   * it does nothing. The NEX debugger needs exactly that: as the program counter moves within a bank
   * whose document is already showing, each pause has to scroll the listing to the new address.
   *
   * See `.plans/CSPECT_DIFFERENTIAL_DEBUGGING_PLAN.md` §15.18.
   */
  revealAddress?: (address: number) => void;
};
