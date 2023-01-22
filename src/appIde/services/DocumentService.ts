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
    this.store.dispatch(activateDocumentAction(id), "ide");
  }

  /**
   * Gets the ID of the active document
   */
  getActiveDocumentId (): string {
    const state = this.store.getState();
    const docs = state?.ideView?.openDocuments ?? [];
    return docs?.[state?.ideView?.activeDocumentIndex]?.id;
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
        ),
        "ide"
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

      dispatch(activateDocumentAction(document.id), "ide");
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
          ),
          "ide"
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
      ),
      "ide"
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
    this.store.dispatch(closeDocumentAction(id), "ide");
  }

  /**
   * Closes all open documents
   */
  closeAllDocuments (): void {
    this.store.dispatch(closeAllDocumentsAction(), "ide");
  }

  /**
   * Moves the active tab to left
   */
  moveActiveToLeft (): void {
    this.store.dispatch(moveDocumentLeftAction(), "ide");
  }

  /**
   * Moves the active tab to right
   */
  moveActiveToRight (): void {
    this.store.dispatch(moveDocumentRightAction(), "ide");
  }

  /**
   * Gets the state of the specified document
   * @param id Document ID
   */
  getDocumentState (id: string): any {
    const state = this.store.getState();
    const docs = state?.ideView?.openDocuments ?? [];
    const existingIndex = docs.findIndex(d => d.id === id);
    return existingIndex !== undefined
      ? docs[existingIndex]?.stateValue
      : undefined;
  }

  /**
   * Saves the specified document state
   * @param id Document ID
   * @param vieState State to save
   */
  saveDocumentState (id: string, viewState: any): void {
    const state = this.store.getState();
    const docs = state?.ideView?.openDocuments ?? [];
    const existingIndex = docs.findIndex(d => d.id === id);
    if (existingIndex) {
      const doc = { ...docs[existingIndex], stateValue: viewState };
      this.store.dispatch(changeDocumentAction(doc, existingIndex));
    }
  } 

  /**
   * Gets the state of the active document
   */
  getActiveDocumentState (): any {
    return this.getDocumentState(this.getActiveDocumentId());
  }

  /**
   * Saves the state of the active document
   * @param viewState State to save
   */
  saveActiveDocumentState (viewState: any): void {
    this.saveDocumentState(this.getActiveDocumentId(), viewState);
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
