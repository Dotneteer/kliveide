import {
  activateDocumentAction,
  changeDocumentAction,
  closeAllDocumentsAction,
  closeDocumentAction,
  createDocumentAction,
  moveDocumentLeftAction,
  moveDocumentRightAction
} from "@state/actions";
import { AppState } from "@state/AppState";
import { Store } from "@state/redux-light";
import { DocumentInfo, DocumentState, IDocumentService } from "../abstractions";

/**
 * This class provides the default implementation of the document service
 */
class DocumentService implements IDocumentService {
  /**
   * Initializes the service instance to use the specified store
   * @param store Store instance to use
   */
  constructor (private readonly store: Store<AppState>) {}

  /**
   * Sets the specified document as the active one
   * @param id The ID of the active document
   */
  setActiveDocument (id: string): void {
    this.store.dispatch(activateDocumentAction(id));
  }

  /**
   * Sets the specified document permanent
   * @param id The ID of the document to set permanent
   */
  setPermanent (id: string): void {
    const state = this.store.getState();
    const dispatch = this.store.dispatch;
    const docs = state?.ideView?.openDocuments ?? [];
    const existingIndex = docs.findIndex(d => d.id === id);
    if (existingIndex >= 0) {
      const existingDoc = docs[existingIndex];
      dispatch(
        changeDocumentAction(
          {
            ...existingDoc,
            isTemporary: false
          } as DocumentState,
          existingIndex
        )
      );
    }
  }

  /**
   * Opens the specified document
   * @param document Document to open
   * @param temporary Open it as temporary documents? (Default: true)
   */
  openDocument (document: DocumentInfo, temporary?: boolean): void {
    temporary ??= true;
    const state = this.store.getState();
    const dispatch = this.store.dispatch;
    const docs = state?.ideView?.openDocuments ?? [];
    const existingIndex = docs.findIndex(d => d.id === document.id);
    if (existingIndex >= 0) {
      // --- A similar document exists with the same ID
      const existingDoc = docs[existingIndex];
      if (existingDoc !== document) {
        throw new Error(`Duplicated document with ID '${document.id}'`);
      }

      dispatch(activateDocumentAction(document.id));
      return;
    }

    // --- Check for temporary documents
    if (temporary) {
      const existingTempIndex = docs.findIndex(d => d.isTemporary);
      if (existingTempIndex >= 0) {
        dispatch(
          changeDocumentAction(
            {
              ...document,
              isTemporary: true
            } as DocumentState,
            existingTempIndex
          )
        );
        return;
      }
    }

    dispatch(
      createDocumentAction(
        {
          ...document,
          isTemporary: temporary
        } as DocumentState,
        docs.length
      )
    );
  }

  /**
   * Gets the document with the specified ID
   * @param id Document ID
   * @returns The document with the specified ID, if exists; othwerwise, null
   */
  getDocument (id: string): DocumentInfo {
    const state = this.store.getState();
    const docs = state?.ideView?.openDocuments ?? [];
    return docs.find(d => d.id === id);
  }

  /**
   * Closes the specified document
   * @param id
   */
  closeDocument (id: string): void {
    this.store.dispatch(closeDocumentAction(id));
  }

  /**
   * Closes all open documents
   */
  closeAllDocuments (): void {
    this.store.dispatch(closeAllDocumentsAction());
  }

  /**
   * Moves the active tab to left
   */
  moveActiveToLeft (): void {
    this.store.dispatch(moveDocumentLeftAction());
  }

  /**
   * Moves the active tab to right
   */
  moveActiveToRight (): void {
    this.store.dispatch(moveDocumentRightAction());
  }
}

/**
 * Creates a document service instance
 * @param dispatch Dispatch function to use
 * @returns Document service instance
 */
export function createDocumentService (store: Store<AppState>) {
  return new DocumentService(store);
}
