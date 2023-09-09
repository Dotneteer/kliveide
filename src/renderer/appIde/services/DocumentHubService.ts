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

/**
 * This class provides the default implementation of the document service
 */
class DocumentHubService implements IDocumentHubService {
  private _documentViewState = new Map<string, any>();
  private _documentApi = new Map<string, DocumentApi>();

  private _openDocs: ProjectDocumentState[] = [];
  private _activeDocIndex = -1;

  onProjectClosed = () => {
    this._documentViewState.clear();
  }

  /**
   * Initializes the service instance to use the specified store
   * @param store Store instance to use
   */
  constructor (
    public readonly hubId: number,
    private readonly store: Store<AppState>,
    private readonly projectService: IProjectService
  ) {
    projectService.projectClosed.on(this.onProjectClosed);
  }

  /**
   * Gets the list of open documents
   */
  getOpenDocuments (): ProjectDocumentState[] {
    return this._openDocs;
  }

  /**
   * Gets the document with the specified ID
   * @param id Document ID
   */
  getDocument (id: string): ProjectDocumentState | undefined {
    return this._openDocs.find(d => d.id === id);
  }

  /**
   * Gets the active document instance
   */
  getActiveDocument (): ProjectDocumentState | undefined {
    return this._openDocs[this._activeDocIndex];
  }

  /**
   * Gets the index of the active document
   */
  getActiveDocumentIndex (): number {
    return this._activeDocIndex;
  }

  /**
   * Opens the specified document
   * @param document Document to open
   * @param viewState Optional viewstate assigned to the document
   * @param temporary Open it as temporary documents? (Default: true)
   */
  async openDocument (
    document: ProjectDocumentState,
    viewState?: any,
    temporary = true
  ): Promise<void> {
    const docIndex = this._openDocs.findIndex(d => d.id === document.id);
    if (docIndex >= 0) {
      // --- A similar document exists with the same ID
      const existingDoc = this._openDocs[docIndex];
      if (existingDoc !== document) {
        throw new Error(`Duplicated document with ID '${document.id}'`);
      }
    } else {
      if (temporary) {
        // --- Check for temporary documents
        const tempIndex = this._openDocs.findIndex(d => d.isTemporary);
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
  }

  /**
   * Tests if the specified document is open
   * @param id Document ID to check
   */
  isOpen (id: string): boolean {
    return !!this.getDocument(id);
  }

  /**
   * Wait while the document gets open in the IDE
   * @param id Document ID
   * @param timeout Timeout of waiting for the open state
   */
  async waitOpen (
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
  getOpenProjectFileDocument (): ProjectDocumentState | undefined {
    const state = this.store.getState();
    var projectInfo = state?.project;
    return projectInfo?.isKliveProject
      ? this._openDocs.find(
          d => d.path === `${projectInfo.folderPath}/${PROJECT_FILE}`
        )
      : undefined;
  }

  /**
   * Sets the specified document as the active one
   * @param id The ID of the active document
   */
  async setActiveDocument (id: string): Promise<void> {
    const docIndex = this._openDocs.findIndex(d => d.id === id);
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
  async renameDocument (
    oldId: string,
    newId: string,
  ): Promise<void> {
    const docIndex = this._openDocs.findIndex(d => d.id === oldId);
    if (docIndex < 0) return;

    const document = this._openDocs[docIndex];

    // --- Rename the document instance
    document.id = newId,
    document.name = getNodeFile(newId),
    document.iconName = getFileTypeEntry(newId)?.icon;

    // TODO: move file into new doc ID

    // --- Re-index the document API
    const oldApi = this._documentApi.get(oldId);
    if (oldApi) {
      this._documentApi.delete(oldId);
      this._documentApi.set(newId, oldApi)
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
  closeDocument (id: string): Promise<void> {
    return this.closeDocuments(id);
  }

  private async closeDocuments(...ids: string[]) {
    const indices = ids
      .map(id => this._openDocs.findIndex(doc => doc.id === id))
      .filter(i => i >= 0);

    if (indices.length <= 0) return;

    const closedDocs = indices.map(i => this._openDocs[i]);
    await this.ensureDocumentSaved(...closedDocs.map(doc => doc.id));

    // --- This is needed when evaluating active document below.
    const activeDoc = this._openDocs[this._activeDocIndex];

    this._openDocs = this._openDocs.filter(doc => !closedDocs.includes(doc));
    for (const doc of closedDocs) {
      // --- If volatile, sign its closed
      if (!doc.path) {
        this.store.dispatch(setVolatileDocStateAction(doc.id, false), "ide");
      }

      // --- Release the document API
      this._documentApi.delete(doc.id);

      // --- Release the document view data
      this._documentViewState.delete(doc.id);

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
  async closeAllDocuments (...exceptIds: string[]): Promise<void> {
    // --- Close the documents
    await this.closeDocuments(
      ...this._openDocs
          .filter(d => exceptIds?.includes(d.id) !== true)
          .map(d => d.id)
    );
  }

  /**
   * Closes all open explorer documents
   */
  async closeAllExplorerDocuments (): Promise<void> {
    // --- Close the documents
    await this.closeDocuments(
      ...this._openDocs
          .filter(d => d.node)
          .map(d => d.id)
    );
  }

  /**
   * Moves the active tab to left
   */
  moveActiveToLeft (): void {
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
  moveActiveToRight (): void {
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
  getDocumentViewState (id: string): any {
    return this._documentViewState.get(id);
  }

  /**
   * Saves the specified document state
   * @param id Document ID
   * @param vieState State to save
   */
  setDocumentViewState (id: string, viewState: any): void {
    this._documentViewState.set(id, viewState);
  }

  /**
   * Saves the state of the active document
   * @param viewState State to save
   */
  saveActiveDocumentState (viewState: any): void {
    this.setDocumentViewState(this.getActiveDocument()?.id, viewState);
  }

  /**
   * Gets the associated API of the specified document
   * @param id Document ID
   */
  getDocumentApi (id: string): any {
    return this._documentApi.get(id);
  }

  /**
   * Sets the API of the specified document
   * @param id Document ID
   * @param api API instance
   */
  setDocumentApi (id: string, api: DocumentApi): void {
    const doc = this._openDocs.find(d => d.id === id);
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
  dispose (): void {
    this.onDispose();
  }

  // --- Helper methods

  // --- This method ensures the document is saved before deactivating and disposing it
  private async ensureDocumentSaved (...ids: string[]): Promise<void> {
    // --- Use the API to save the document
    await Promise.all(
      ids.map(id => this.getDocumentApi(id))
        .filter(api => !!api.beforeDocumentDisposal)
        .map(api => api.beforeDocumentDisposal(false))
    )
  }

  // --- Increment the document hub service version number to sign a state change
  private signHubStateChanged (): void {
    this.store.dispatch(incDocHubServiceVersionAction(this.hubId), "ide");
  }

  // --- Removes event handlers attached to the project service
  private onDispose (): void {
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
export function createDocumentHubService (
  id: number,
  store: Store<AppState>,
  projectService: IProjectService
) {
  return new DocumentHubService(id, store, projectService);
}
