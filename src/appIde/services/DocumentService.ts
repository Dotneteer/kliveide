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
import { DocumentInfo } from "../../../common/abstractions/DocumentInfo";
import { DocumentState } from "../../../common/abstractions/DocumentState";

/**
 * This interface defines the functions managing documents within the IDE
 */
export interface IDocumentService {
  /**
   * Opens the specified document
   * @param document Document to open
   * @param data Arbitrary data assigned to the document
   * @param temporary Open it as temporary documents? (Default: true)
   */
  openDocument(document: DocumentInfo, data?: any, temporary?: boolean): void;

  /**
   * Tests if the specified document is open
   * @param document
   */
  isOpen(id: string): boolean;

  /**
   * Sets the specified document as the active one
   * @param id The ID of the active document
   */
  setActiveDocument(id: string): void;

  /**
   * Gets the ID of the active document
   */
  getActiveDocumentId(): string;

  /**
   * Gets the document with the specified ID
   * @param id Document ID
   * @returns The document with the specified ID, if exists; othwerwise, null
   */
  getDocument(id: string): DocumentInfo;

  /**
   * Sets the specified document permanent
   * @param id The ID of the document to set permanent
   */
  setPermanent(id: string): void;

  /**
   * Closes the specified document
   * @param id
   */
  closeDocument(id: string): void;

  /**
   * Closes all open documents
   */
  closeAllDocuments(): void;

  /**
   * Moves the active tab to left
   */
  moveActiveToLeft(): void;

  /**
   * Moves the active tab to right
   */
  moveActiveToRight(): void;

  /**
   * Gets the state of the specified document
   * @param id Document ID
   */
  getDocumentState(id: string): any;

  /**
   * Saves the specified document state
   * @param id Document ID
   * @param state State to save
   */
  saveDocumentState(id: string, state: any): void;

  /**
   * Gets the state of the active document
   */
  getActiveDocumentState(): any;

  /**
   * Saves the state of the active document
   * @param state State to save
   */
  saveActiveDocumentState(state: any): void;

  /**
   * Gets the data of the document associated with the specified ID
   * @param id
   */
  getDocumentData(id: string): any;
}

/**
 * This class provides the default implementation of the document service
 */
class DocumentService implements IDocumentService {
  private documentData = new Map<string, any>();

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
   * @param data Arbitrary data assigned to the document
   * @param temporary Open it as temporary documents? (Default: true)
   */
  openDocument (document: DocumentInfo, data?: any, temporary?: boolean): void {
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

      // --- Save the document data
      if (data) {
        this.documentData.set(document.id, data);
      }

      // --- Now, open the document
      dispatch(activateDocumentAction(document.id), "ide");
      return;
    }

    // --- Check for temporary documents
    if (temporary) {
      const existingTempIndex = docs.findIndex(d => d.isTemporary);
      if (existingTempIndex >= 0) {
        // --- Save the document data
        if (data) {
          this.documentData.set(document.id, data);
        }
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

    // --- Save the document data
    if (data) {
      this.documentData.set(document.id, data);
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
   * Tests if the specified document is open
   * @param document
   */
  isOpen (id: string): boolean {
    const state = this.store.getState();
    const docs = state?.ideView?.openDocuments ?? [];
    return !!docs.find(doc => doc.id === id);
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
    if (this.documentData.has(id)) {
      const data = this.documentData.get(id);
      if (data?.dispose) {
        data.dispose();
      }
      this.documentData.delete(id);
    }
  }

  /**
   * Closes all open documents
   */
  closeAllDocuments (): void {
    this.store.dispatch(closeAllDocumentsAction(), "ide");
    for (const doc of this.documentData) {
      if (doc[1]?.dispose) {
        doc[1].dispose();
      }
    }
    this.documentData.clear();
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

  /**
   * Gets the data of the document associated with the specified ID
   * @param id
   */
  getDocumentData (id: string): any {
    return this.documentData.get(id);
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
