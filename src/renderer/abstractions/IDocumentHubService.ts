import type { DocumentApi } from "./DocumentApi";
import type { ProjectDocumentState } from "./ProjectDocumentState";

/**
 * Represents a service managing a collection of document views
 */
export interface IDocumentHubService {
  /**
   * The ID of the particular document hub service
   */
  readonly hubId: number;

  /**
   * Sign that the document hub chanded and should be refreshed
   */
  signHubStateChanged (): void;

  /**
   * Gets the list of open documents
   */
  getOpenDocuments(): ProjectDocumentState[];

  /**
   * Gets the document with the specified ID
   * @param id Document ID
   */
  getDocument(id: string): ProjectDocumentState | undefined;

  /**
   * Gets the active document instance
   */
  getActiveDocument(): ProjectDocumentState | undefined;

  /**
   * Gets the index of the active document
   */
  getActiveDocumentIndex(): number;

  /**
   * Opens the specified document
   * @param document Document to open
   * @param data Arbitrary data assigned to the document
   * @param temporary Open it as temporary documents? (Default: true)
   */
  openDocument(
    document: ProjectDocumentState,
    data?: any,
    temporary?: boolean
  ): Promise<void>;

  /**
   * Sets the specified document as permanent
   * @param id 
   */  
  setPermanent(id: string): void;

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
  ): Promise<ProjectDocumentState | null>;

  /**
   * Tests if the project file is open
   */
  getOpenProjectFileDocument(): Promise<ProjectDocumentState | undefined>;

  /**
   * Sets the specified document as the active one
   * @param id The ID of the active document
   */
  setActiveDocument(id: string): Promise<void>;

  /**
   * Renames the document and optionally changes its ID
   * @param oldId Old document ID
   * @param newId New document ID
   */
  renameDocument(
    oldId: string,
    newId: string,
  ): void;

  /**
   * Closes the specified document
   * @param id Document to close
   */
  closeDocument(id: string): Promise<void>;

  /**
   * Closes all open documents
   */
  closeAllDocuments(...exceptIds: string[]): Promise<void>;

  /**
   * Closes all open explorer documents
   */
  closeAllExplorerDocuments(): Promise<void>;

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
  getDocumentViewState(id: string): any;

  /**
   * Saves the specified document state
   * @param id Document ID
   * @param state State to save
   */
  setDocumentViewState(id: string, state: any): void;

  /**
   * Saves the state of the active document
   * @param state State to save
   */
  saveActiveDocumentState(state: any): void;

  /**
   * Saves the state of the active document
   * @param state State to save
   */
  saveActiveDocumentPosition(line: number, column: number): void;

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

  /**
   * Disposes the resources held by the instance
   */
  dispose(): void;
}