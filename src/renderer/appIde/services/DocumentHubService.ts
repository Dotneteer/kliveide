import { incDocHubServiceVersionAction, setVolatileDocStateAction } from "@state/actions";
import { AppState } from "@state/AppState";
import { Store } from "@state/redux-light";
import { PROJECT_FILE } from "@common/structs/project-const";
import { delay } from "@renderer/utils/timing";
import { DocumentApi } from "@renderer/abstractions/DocumentApi";
import { IProjectService } from "@renderer/abstractions/IProjectService";
import { IDocumentHubService } from "@renderer/abstractions/IDocumentHubService";
import { ProjectDocumentState } from "@renderer/abstractions/ProjectDocumentState";
import { getFileTypeEntry, getNodeFile } from "../project/project-node";
import { FileReloadService } from "./FileReloadService";
import { getGlobalSetting } from "@renderer/core/RendererProvider";
import { SETTING_EDITOR_LIVE_RELOAD } from "@common/settings/setting-const";

/**
 * This class provides the default implementation of the document service
 */
class DocumentHubService implements IDocumentHubService {
  private _documentViewState = new Map<string, any>();
  private _documentApi = new Map<string, DocumentApi>();

  private _openDocs: ProjectDocumentState[] = [];
  private _activeDocIndex = -1;
  private _fileReloadService: FileReloadService | null = null;

  onProjectClosed = () => {
    this._documentViewState.clear();
    if (this._fileReloadService) {
      this._fileReloadService.unwatchAllFiles();
    }
  };

  /**
   * Initializes the service instance to use the specified store
   * @param store Store instance to use
   */
  constructor(
    public readonly hubId: number,
    private readonly store: Store<AppState>,
    private readonly projectService: IProjectService
  ) {
    projectService.projectClosed.on(this.onProjectClosed);
    
    // Initialize file reload service
    this._fileReloadService = new FileReloadService(
      projectService,
      (filePath, document) => {
        this.handleFileChangedExternally(filePath, document);
      }
    );
  }

  /**
   * Handles when a file is changed externally
   */
  private async handleFileChangedExternally(
    filePath: string,
    document: ProjectDocumentState
  ): Promise<void> {
    // Check if live reload is enabled
    const liveReloadEnabled = getGlobalSetting(this.store, SETTING_EDITOR_LIVE_RELOAD) ?? false;
    if (!liveReloadEnabled) {
      return;
    }

    // Check if document has unsaved changes
    const hasUnsavedChanges =
      document.editVersionCount !== undefined &&
      document.savedVersionCount !== undefined &&
      document.editVersionCount !== document.savedVersionCount;

    // Auto-reload if there are no unsaved changes
    if (!hasUnsavedChanges) {
      await this.reloadDocument(document.id);
    } else {
      // File changed but has unsaved changes - log for now
      console.log(`File ${filePath} changed externally but has unsaved changes`);
    }
  }

  /**
   * Reloads a document from disk
   */
  private async reloadDocument(documentId: string): Promise<void> {
    const document = this.getDocument(documentId);
    if (!document || !document.path) return;

    try {
      // Read the file content
      const contents = await this.projectService.readFileContent(document.path);
      
      // Update the document content
      document.contents = contents;
      
      // Notify the document API to reload
      const api = this._documentApi.get(documentId);
      if (api && api.reloadContent) {
        api.reloadContent(contents);
      }
      
      // Sign that the hub changed
      this.signHubStateChanged();
    } catch (err) {
      console.error(`Error reloading document ${documentId}:`, err);
    }
  }

  /**
   * Gets the list of open documents
   */
  getOpenDocuments(): ProjectDocumentState[] {
    return this._openDocs;
  }

  /**
   * Gets the document with the specified ID
   * @param id Document ID
   */
  getDocument(id: string): ProjectDocumentState | undefined {
    return this._openDocs.find((d) => d.id === id);
  }

  /**
   * Gets the active document instance
   */
  getActiveDocument(): ProjectDocumentState | undefined {
    return this._openDocs[this._activeDocIndex];
  }

  /**
   * Gets the index of the active document
   */
  getActiveDocumentIndex(): number {
    return this._activeDocIndex;
  }

  /**
   * Opens the specified document
   * @param document Document to open
   * @param viewState Optional viewstate assigned to the document
   * @param temporary Open it as temporary documents? (Default: true)
   */
  async openDocument(
    document: ProjectDocumentState,
    viewState?: any,
    temporary = true
  ): Promise<void> {
    const docIndex = this._openDocs.findIndex((d) => d.id === document.id);
    if (docIndex >= 0) {
      // --- A similar document exists with the same ID
      const existingDoc = this._openDocs[docIndex];
      if (existingDoc !== document) {
        throw new Error(`Duplicated document with ID '${document.id}'`);
      }
    } else {
      if (temporary) {
        // --- Check for temporary documents
        document.isTemporary = true;
        const tempIndex = this._openDocs.findIndex((d) => d.isTemporary);
        if (tempIndex >= 0) {
          // --- Change the former temp document to this one
          this._openDocs[tempIndex] = document;
          this.signHubStateChanged();
        } else {
          // --- Add as the last document
          this._openDocs.push(document);
        }
      } else {
        // --- Add as the last document
        document.isTemporary = false;
        this._openDocs.push(document);
      }
    }

    // --- Save (or remove) the document data
    if (viewState) {
      this._documentViewState.set(document.id, viewState);
    } else {
      this._documentViewState.delete(document.id);
    }

    // --- Now, activate the newly opened document
    this.projectService.openInDocumentHub(document.id, this);
    await this.setActiveDocument(document.id);

    // --- Start watching the file if it has a path
    if (document.path && this._fileReloadService) {
      this._fileReloadService.watchFile(document.path);
    }
  }

  /**
   * Sets the specified document as permanent
   * @param id
   */
  setPermanent(id: string): void {
    const docIndex = this._openDocs.findIndex((d) => d.id === id);
    if (docIndex < 0) return;

    const document = this._openDocs[docIndex];
    document.isTemporary = false;
    this.signHubStateChanged();
  }

  /**
   * Tests if the specified document is open
   * @param id Document ID to check
   */
  isOpen(id: string): boolean {
    return !!this.getDocument(id);
  }

  /**
   * Wait while the document gets open in the IDE
   * @param id Document ID
   * @param timeout Timeout of waiting for the open state
   */
  async waitOpen(
    id: string,
    waitForApi = false,
    timeout = 5000
  ): Promise<ProjectDocumentState | null> {
    let waitTime = 0;
    while (waitTime < timeout) {
      if (this.isOpen(id)) {
        const doc = this.projectService.getDocumentById(id);
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
  async getOpenProjectFileDocument(): Promise<ProjectDocumentState | undefined> {
    const state = this.store.getState();
    var projectInfo = state?.project;
    if (projectInfo?.isKliveProject) {
      const projectDoc = this._openDocs.find(
        (d) => d.path === `${projectInfo.folderPath}/${PROJECT_FILE}`
      );
      if (projectDoc) {
        projectDoc.contents = await this.projectService.readFileContent(projectDoc.id);
      }
      return projectDoc;
    }
    return null;
  }

  /**
   * Sets the specified document as the active one
   * @param id The ID of the active document
   */
  async setActiveDocument(id: string): Promise<void> {
    const docIndex = this._openDocs.findIndex((d) => d.id === id);
    if (docIndex < 0) {
      throw new Error(`Unknown document: ${id}`);
    }
    if (this._activeDocIndex === docIndex) {
      // --- No change
      return;
    }

    this._activeDocIndex = docIndex;
    this.signHubStateChanged();
  }

  /**
   * Renames the document and optionally changes its ID
   * @param oldId Old document ID
   * @param newId New document ID
   * @param newName New document name
   * @param newIcon New document icon
   */
  renameDocument(oldId: string, newId: string): void {
    const docIndex = this._openDocs.findIndex((d) => d.id === oldId);
    if (docIndex < 0) return;

    const document = this._openDocs[docIndex];

    // --- Rename the document instance
    (document.id = newId),
      (document.name = getNodeFile(newId)),
      (document.iconName = getFileTypeEntry(newId, this.store)?.icon);

    // TODO: move file into new doc ID

    // --- Re-index the document API
    const oldApi = this._documentApi.get(oldId);
    if (oldApi) {
      this._documentApi.delete(oldId);
      this._documentApi.set(newId, oldApi);
    }

    // --- Re-index the document viewstate
    const oldVs = this._documentViewState.get(oldId);
    if (oldVs) {
      this._documentViewState.delete(oldId);
      this._documentViewState.set(newId, oldVs);
    }

    // --- Done, refresh the UI
    this.signHubStateChanged();
  }
  /**
   * Closes the specified document
   * @param id Document to close
   */
  closeDocument(id: string): Promise<void> {
    return this.closeDocuments(id);
  }

  private async closeDocuments(...ids: string[]) {
    const indices = ids
      .map((id) => this._openDocs.findIndex((doc) => doc.id === id))
      .filter((i) => i >= 0);

    if (indices.length <= 0) return;

    const closedDocs = indices.map((i) => this._openDocs[i]);
    await this.ensureDocumentSaved(...closedDocs.map((doc) => doc.id));

    // --- This is needed when evaluating active document below.
    const activeDoc = this._openDocs[this._activeDocIndex];

    this._openDocs = this._openDocs.filter((doc) => !closedDocs.includes(doc));
    for (const doc of closedDocs) {
      // --- If volatile, sign its closed
      if (!doc.path) {
        this.store.dispatch(setVolatileDocStateAction(doc.id, false), "ide");
      }

      // --- Release the document API
      this._documentApi.delete(doc.id);

      // --- Release the document view data
      this._documentViewState.delete(doc.id);

      // --- Stop watching the file
      if (doc.path && this._fileReloadService) {
        this._fileReloadService.unwatchFile(doc.path);
      }

      // --- Notify the project service about closing the document
      this.projectService.closeInDocumentHub(doc.id, this);
    }

    // --- Activate another document
    this._activeDocIndex = this._openDocs.indexOf(activeDoc);
    if (this._activeDocIndex < 0 && this._openDocs.length > 0) {
      const docIndex = indices.sort()[0];
      this._activeDocIndex = docIndex > 0 ? docIndex - 1 : docIndex;
    }

    this.signHubStateChanged();

    // --- Close the document hub service
    if (this._openDocs.length <= 0) {
      this.projectService.closeDocumentHubService(this);
    }
  }

  /**
   * Closes all open documents
   */
  async closeAllDocuments(...exceptIds: string[]): Promise<void> {
    // --- Close the documents
    await this.closeDocuments(
      ...this._openDocs.filter((d) => exceptIds?.includes(d.id) !== true).map((d) => d.id)
    );

    // --- Wait while all documents are closed
    let count = 0;
    while (count < 100) {
      await delay(100);
      if (this._openDocs.length <= 0) break;
      count++;
    }
  }

  /**
   * Closes all open explorer documents
   */
  async closeAllExplorerDocuments(): Promise<void> {
    // --- Close the documents
    await this.closeDocuments(...this._openDocs.filter((d) => d.node).map((d) => d.id));
  }

  /**
   * Moves the active tab to left
   */
  moveActiveToLeft(): void {
    const index = this._activeDocIndex;
    if (index === 0) return;
    const tmp = this._openDocs[index - 1];
    this._openDocs[index - 1] = this._openDocs[index];
    this._openDocs[index] = tmp;
    this._activeDocIndex--;
    this.signHubStateChanged();
  }

  /**
   * Moves the active tab to right
   */
  moveActiveToRight(): void {
    const index = this._activeDocIndex;
    if (index >= this._openDocs.length) return;
    const tmp = this._openDocs[index + 1];
    this._openDocs[index + 1] = this._openDocs[index];
    this._openDocs[index] = tmp;
    this._activeDocIndex++;
    this.signHubStateChanged();
  }

  /**
   * Gets the state of the specified document
   * @param id Document ID
   */
  getDocumentViewState(id: string): any {
    return this._documentViewState.get(id);
  }

  /**
   * Saves the specified document state
   * @param id Document ID
   * @param vieState State to save
   */
  setDocumentViewState(id: string, viewState: any): void {
    this._documentViewState.set(id, viewState);
  }

  /**
   * Saves the state of the active document
   * @param viewState State to save
   */
  saveActiveDocumentState(viewState: any): void {
    this.setDocumentViewState(this.getActiveDocument()?.id, viewState);
  }

  /**
   * Saves the state of the active document
   * @param state State to save
   */
  saveActiveDocumentPosition(line: number, column: number): void {
    const doc = this.getActiveDocument();
    if (!doc) return;
    doc.editPosition = { line, column };
  }

  /**
   * Gets the associated API of the specified document
   * @param id Document ID
   */
  getDocumentApi(id: string): any {
    return this._documentApi.get(id);
  }

  /**
   * Sets the API of the specified document
   * @param id Document ID
   * @param api API instance
   */
  setDocumentApi(id: string, api: DocumentApi): void {
    const doc = this._openDocs.find((d) => d.id === id);
    if (!doc) return;
    if (api) {
      this._documentApi.set(id, api);
    } else {
      this._documentApi.delete(id);
    }
  }

  /**
   * Disposes the resources held by the instance
   */
  dispose(): void {
    this.onDispose();
  }

  // --- Helper methods

  // --- This method ensures the document is saved before deactivating and disposing it
  private async ensureDocumentSaved(...ids: string[]): Promise<void> {
    // --- Use the API to save the document
    await Promise.all(
      ids
        .map((id) => this.getDocumentApi(id))
        .filter((api) => !!api?.beforeDocumentDisposal)
        .map((api) => api?.beforeDocumentDisposal(false))
    );
  }

  // --- Increment the document hub service version number to sign a state change
  signHubStateChanged(): void {
    this.store.dispatch(incDocHubServiceVersionAction(this.hubId), "ide");
  }

  // --- Removes event handlers attached to the project service
  private onDispose(): void {
    this.projectService.projectClosed.off(this.onProjectClosed);
  }
}

/**
 * Creates a document hub service instance
 * @param id: Document hub service instance ID
 * @param store Store instance
 * @param projectService Project service instance
 * @returns Document service instance
 */
export function createDocumentHubService(
  id: number,
  store: Store<AppState>,
  projectService: IProjectService
) {
  return new DocumentHubService(id, store, projectService);
}
