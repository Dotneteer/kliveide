import { DocumentInfo } from "@abstractions/DocumentInfo";
import { DocumentApi } from "./DocumentApi";

/**
 * Represents a service managing a collection of document views
 */
export interface IDocumentHubService {
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
  waitOpen(
    id: string,
    waitForApi?: boolean,
    timeout?: number
  ): Promise<DocumentInfo | null>;

  /**
   * Tests if the project file is open
   */
  getOpenProjectFileDocument(): DocumentInfo;

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
  getDocument(id: string): DocumentInfo;

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
  getDocumentApi(id: string): DocumentApi;

  /**
   * Sets the API of the specified document
   * @param id Document ID
   * @param api API instance
   */
  setDocumentApi(id: string, api: DocumentApi): void;
}