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
import { DocumentInfo } from "@abstractions/DocumentInfo";
import { DocumentState } from "@abstractions/DocumentState";
import * as monacoEditor from "monaco-editor/esm/vs/editor/editor.api";
import { PROJECT_FILE } from "@common/structs/project-const";
import { delay } from "@/renderer/utils/timing";

/**
 * Represents the view state of a code document
 */
export type CodeDocumentState = {
  value: string;
  viewState?: monacoEditor.editor.ICodeEditorViewState;
}

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
   * Wait while the document gets open in the IDE
   * @param id Document ID
   * @param timeout Timeout of waiting for the open state
   */
  waitOpen(id: string, waitForApi?: boolean, timeout?: number): Promise<DocumentState | null>;

  /**
   * Tests if the project file is open
   */
  getOpenProjectFileDocument(): DocumentState;

  /**
   * Increment the view version of the specified document
   */
  incrementViewVersion(id: string): void;

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
  getDocument(id: string): DocumentState;

  /**
   * Sets the specified document permanent
   * @param id The ID of the document to set permanent
   */
  setPermanent(id: string): void;

  /**
   * Renames the document and optionally changes its ID
   * @param oldId Old document ID
   * @param newId New document ID
   * @param newName New document name
   */
  renameDocument(
    oldId: string,
    newId: string,
    newName: string,
    newIcon?: string
  ): void;

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
   * Closes all open explorer documents
   */
  closeAllExplorerDocuments(): void;

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
   * Sets the document data
   * @param id Document ID
   * @param data New data to set
   */
  setDocumentData(id: string, data: any): void;

  /**
   * Gets the data of the document associated with the specified ID
   * @param id
   */
  getDocumentData(id: string): any;

  /**
   * Gets the associated API of the specified document
   * @param id Document ID
   */
  getDocumentApi(id: string): any;

  /**
   * Sets the API of the specified document
   * @param id Document ID
   * @param api API instance
   */
  setDocumentApi(id: string, api: any): void;
}

/**
 * This class provides the default implementation of the document service
 */
class DocumentService implements IDocumentService {
  private documentData = new Map<string, any>();
  private documentApi = new Map<string, any>();

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
   * Renames the document and optionally changes its ID
   * @param oldId Old document ID
   * @param newId New document ID
   * @param newName New document name
   */
  renameDocument (
    oldId: string,
    newId: string,
    newName: string,
    newIcon?: string
  ): void {
    const state = this.store.getState();
    const dispatch = this.store.dispatch;
    const docs = state?.ideView?.openDocuments ?? [];
    const existingIndex = docs.findIndex(d => d.id === oldId);
    if (existingIndex < 0) return;

    // --- Ok, document exists, change it
    const oldActive = this.getActiveDocumentId();
    const existingDoc = docs[existingIndex];
    dispatch(
      changeDocumentAction(
        {
          ...existingDoc,
          id: newId ?? oldId,
          name: newName,
          iconName: newIcon
        } as DocumentState,
        existingIndex
      ),
      "ide"
    );
    if (oldActive === oldId && newId) {
      this.setActiveDocument(newId);
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
   * Wait while the document gets open in the IDE
   * @param id Document ID
   * @param timeout Timeout of waiting for the open state
   */
  async waitOpen(id: string, waitForApi = false, timeout = 5000): Promise<DocumentState | null> {
    let waitTime = 0;
    while (waitTime < timeout) {
      if (this.isOpen(id)) {
        const doc = this.getDocument(id);
        const api = this.getDocumentApi(id);
        if (!waitForApi || api) return doc;
      }
      await delay(50);
      waitTime += 50;
    }
    return null;
  }

  /**
   * Gets the project file is open
   */
  getOpenProjectFileDocument(): DocumentState | undefined {
    const state = this.store.getState();
    const docs = state?.ideView?.openDocuments ?? [];
    var projectInfo = state?.project;
    return projectInfo?.isKliveProject
      ? docs.find(d => d.path === `${projectInfo.folderPath}/${PROJECT_FILE}`)
      : undefined;
  }

  /**
   * Increment the view version of the specified document
   */
  incrementViewVersion(id: string): void {
    const document = this.getDocument(id);
    if (!document) return;

    this.store.dispatch(
      changeDocumentAction(
        {
          ...document,
          viewVersion: (document.viewVersion ?? 0) + 1
        } as DocumentState,
      ),
      "ide"
    );
  }

  /**
   * Gets the document with the specified ID
   * @param id Document ID
   * @returns The document with the specified ID, if exists; othwerwise, null
   */
  getDocument (id: string): DocumentState {
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
   * Closes all open explorer documents
   */
  closeAllExplorerDocuments (): void {
    const state = this.store.getState();
    const docs = state?.ideView?.openDocuments ?? [];
    for (const doc of docs) {
      if (doc.node) {
        // --- This is an explorer document, close it
        this.closeDocument(doc.id);
      }
    }
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
   * Sets the document data
   * @param id Document ID
   * @param data New data to set
   */
  setDocumentData (id: string, data: any): void {
    this.documentData.set(id, data);
  }

  /**
   * Gets the data of the document associated with the specified ID
   * @param id
   */
  getDocumentData (id: string): any {
    return this.documentData.get(id);
  }

  /**
   * Gets the associated API of the specified document
   * @param id Document ID
   */
  getDocumentApi(id: string): any {
    return this.documentApi.get(id);
  }


  /**
   * Sets the API of the specified document
   * @param id Document ID
   * @param api API instance
   */
  setDocumentApi(id: string, api: any): void {
    const doc = this.getDocument(id);
    if (doc) {
      if (api) {
        this.documentApi.set(id, api);
      } else {
        this.documentApi.delete(id);
      }
    }
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
