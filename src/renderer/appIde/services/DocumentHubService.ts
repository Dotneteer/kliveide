import { incDocHubServiceVersionAction } from "@state/actions";
import { AppState } from "@state/AppState";
import { Store } from "@state/redux-light";
import { PROJECT_FILE } from "@common/structs/project-const";
import { delay } from "@renderer/utils/timing";
import { DocumentApi } from "@renderer/abstractions/DocumentApi";
import { IProjectService } from "@renderer/abstractions/IProjectService";
import { IDocumentHubService } from "@renderer/abstractions/IDocumentHubService";
import { ProjectDocumentState } from "@renderer/abstractions/ProjectDocumentState";

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

    // --- Make sure to save the state of the active document gracefully
    await this.ensureActiveSaved();

    this._activeDocIndex = docIndex;
    this.signHubStateChanged();
  }

  /**
   * Closes the specified document
   * @param id Document to close
   */
  async closeDocument (id: string): Promise<void> {
    const docIndex = this._openDocs.findIndex(d => d.id === id);
    if (docIndex < 0) return;

    // --- Remove the document
    this._openDocs.splice(docIndex, 1);

    // --- Release the document API
    if (this._documentApi.has(id)) {
      this._documentApi.delete(id);
    }

    // --- Release the document view data
    if (this._documentViewState.has(id)) {
      const data = this._documentViewState.get(id);
      this._documentViewState.delete(id);
    }

    // --- Notify the project service about closing the document
    this.projectService.closeInDocumentHub(id, this);

    // --- Activate another document
    if (docIndex > 0) {
      await this.setActiveDocument(this._openDocs[docIndex - 1].id);
    } else if (docIndex < this._openDocs.length) {
      await this.setActiveDocument(this._openDocs[docIndex].id);
    } else {
      this._activeDocIndex = -1;
    }
    this.signHubStateChanged();
  }

  /**
   * Closes all open documents
   */
  async closeAllDocuments (): Promise<void> {
    // --- Close the documents one-by-one
    for (const doc of this._openDocs.slice(0)) {
      await this.closeDocument(doc.id);
    }

    // --- Close the document hub service
    this.projectService.closeDocumentHubService(this);
  }

  /**
   * Closes all open explorer documents
   */
  closeAllExplorerDocuments (): void {
    // --- Close the documents one-by-one
    this._openDocs
      .slice(0)
      .filter(d => d.node)
      .forEach(d => {
        this.closeDocument(d.id);
      });

    // --- Close the document hub service
    if (this._openDocs.length === 0) {
      this.projectService.closeDocumentHubService(this);
    }
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

  // --- Increment the document hub service version number to sign a state change
  private signHubStateChanged (): void {
    this.store.dispatch(incDocHubServiceVersionAction(this.hubId), "ide");
  }

  // --- Ensure the active document is saved before navigating away
  private async ensureActiveSaved (): Promise<void> {
    const activeDocId = this._openDocs?.[this._activeDocIndex]?.id;
    if (!activeDocId) return;

    // --- Use the API to save the document
    const docApi = this.getDocumentApi(activeDocId);
    let ready = false;
    if (docApi?.readyForDisposal) {
      ready = await docApi.readyForDisposal();
    }
    if (!ready && docApi?.beforeDocumentDisposal) {
      await docApi.beforeDocumentDisposal();
    }
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
