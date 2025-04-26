import { AppState } from "@state/AppState";
import { Store } from "@state/redux-light";
import { IProjectService } from "../../abstractions/IProjectService";
import { compareProjectNode, getFileTypeEntry, getNodeFile } from "../project/project-node";
import type { BreakpointInfo } from "@abstractions/BreakpointInfo";
import { MessengerBase } from "@common/messaging/MessengerBase";
import { ProjectDocumentState } from "@renderer/abstractions/ProjectDocumentState";
import { VolatileDocumentInfo } from "@renderer/abstractions/VolatileDocumentInfo";
import { IDocumentHubService } from "@renderer/abstractions/IDocumentHubService";
import { createDocumentHubService } from "./DocumentHubService";
import {
  incDocHubServiceVersionAction,
  incProjectViewStateVersionAction
} from "@common/state/actions";
import { documentPanelRegistry } from "@renderer/registry";
import { DelayedJobs } from "@common/utils/DelayedJobs";
import { ILiteEvent } from "@abstractions/ILiteEvent";
import { ITreeView, ITreeNode } from "@abstractions/ITreeNode";
import { ProjectNode } from "@abstractions/ProjectNode";
import { LiteEvent } from "@emu/utils/lite-event";
import { createMainApi } from "@common/messaging/MainApi";
import { get } from "lodash";

const JOB_KIND_SAVE_FILE = 21;

class ProjectService implements IProjectService {
  private _tree: ITreeView<ProjectNode>;
  private _oldState: AppState;
  private _projectOpened = new LiteEvent<void>();
  private _projectClosed = new LiteEvent<void>();
  private _itemAdded = new LiteEvent<ITreeNode<ProjectNode>>();
  private _itemRenamed = new LiteEvent<{
    oldName: string;
    node: ITreeNode<ProjectNode>;
  }>();
  private _itemDeleted = new LiteEvent<ITreeNode<ProjectNode>>();
  private _fileSaved = new LiteEvent<{
    file: string;
    contents: string | Uint8Array;
  }>();
  private _fileCache = new Map<string, string | Uint8Array>();
  private _projectItemCache = new Map<string, ProjectDocumentState>();

  // --- Document hub related fields
  private _docHubIdSlots: boolean[] = [];
  private _docHubServices: IDocumentHubService[] = [];
  private _docHubActivations: IDocumentHubService[] = [];
  private _activeDocHub: IDocumentHubService | undefined;

  private _delayedJobs = new DelayedJobs();

  constructor(
    private readonly store: Store<AppState>,
    private readonly messenger: MessengerBase
  ) {
    store.subscribe(() => {
      const newState = store.getState();
      const newFolderPath = newState?.project?.folderPath;
      const oldFolderPath = this._oldState?.project?.folderPath;
      this._oldState = newState;
      if (oldFolderPath !== newFolderPath) {
        if (newFolderPath) {
          this._projectOpened.fire();
        } else {
          this._projectClosed.fire();
        }
      }
    });
  }

  setProjectTree(tree: ITreeView<ProjectNode>): void {
    this._tree = tree;
  }

  getProjectTree(): ITreeView<ProjectNode> | undefined {
    return this._tree;
  }

  get projectOpened(): ILiteEvent<void> {
    return this._projectOpened;
  }

  get projectClosed(): ILiteEvent<void> {
    return this._projectClosed;
  }

  signItemAdded(node: ITreeNode<ProjectNode>): void {
    this._itemAdded.fire(node);
  }

  signItemRenamed(oldName: string, node: ITreeNode<ProjectNode>): void {
    this._itemRenamed.fire({ oldName, node });
  }

  signItemDeleted(node: ITreeNode<ProjectNode>): void {
    this._itemDeleted.fire(node);
  }

  signFileSaved(file: string, contents: string | Uint8Array): void {
    this._fileSaved.fire({ file, contents });
  }

  get itemAdded(): ILiteEvent<ITreeNode<ProjectNode>> {
    return this._itemAdded;
  }

  get itemRenamed(): ILiteEvent<{
    oldName: string;
    node: ITreeNode<ProjectNode>;
  }> {
    return this._itemRenamed;
  }

  get itemDeleted(): ILiteEvent<ITreeNode<ProjectNode>> {
    return this._itemDeleted;
  }

  get fileSaved(): ILiteEvent<{
    file: string;
    contents: string | Uint8Array;
  }> {
    return this._fileSaved;
  }

  getNodeForFile(file: string): ITreeNode<ProjectNode> {
    return this._tree ? findFileNode(this._tree.rootNode, file) : undefined;

    function findFileNode(
      node: ITreeNode<ProjectNode>,
      name: string
    ): ITreeNode<ProjectNode> | undefined {
      if (node.data.fullPath === file || node.data.projectPath === file) return node;
      if (node.childCount > 0) {
        for (const child of node.children) {
          const found = findFileNode(child, name);
          if (found) return found;
        }
      }
      return undefined;
    }
  }

  getBreakpointAddressInfo(addr: string | number): BreakpointInfo | undefined {
    if (typeof addr === "number") {
      return {
        address: addr & 0xffff
      };
    }

    addr = addr.trim();
    if (!addr.startsWith("[")) return null;

    const parts = addr.split(":");
    if (parts.length < 2) return null;

    let resource = "";
    let line = 0;

    const last = parts[parts.length - 1];
    if (!/^\d+$/.test(last)) return null;
    line = parseInt(last, 10);

    if (!parts[parts.length - 2].endsWith("]")) return null;
    resource = parts.slice(0, -1).join(":").slice(1, -1);
    // --- File name must be in the project
    const node = this.getNodeForFile(resource);
    return node
      ? {
          resource,
          line
        }
      : undefined;
  }

  /**
   * Gets the available document service instances
   */
  getDocumentHubServiceInstances(): IDocumentHubService[] {
    return this._docHubServices.slice(0);
  }

  /**
   * Instantiates a new document service and registers it with the hub. The new document service
   * will be the active one.
   */
  createDocumentHubService(): IDocumentHubService {
    const newDocHubService = createDocumentHubService(
      this.getNextDocumentHubId(),
      this.store,
      this
    );
    this._docHubServices.push(newDocHubService);
    this.setActiveDocumentHubService(newDocHubService);
    this.signDocServiceVersionChanged(newDocHubService.hubId);
    return newDocHubService;
  }

  /**
   * Gets the active document service. Many project document related events are executed with the
   * active document service.
   */
  getActiveDocumentHubService(): IDocumentHubService | undefined {
    return this._activeDocHub;
  }

  /**
   * Sets the specified document service as the active one.
   * @param instance The document service instance to activate
   */
  setActiveDocumentHubService(instance: IDocumentHubService): void {
    if (this._activeDocHub === instance) return;
    if (this._docHubServices.indexOf(instance) < 0) {
      throw new Error("Cannot find document service instance");
    }
    this._activeDocHub = instance;
    this._docHubActivations = this._docHubActivations.filter((d) => d !== instance);
    this._docHubActivations.push(instance);
    this.signDocServiceVersionChanged(instance.hubId);
  }

  /**
   * Closes (and removes) the specified document service instance
   * @param instance
   */
  closeDocumentHubService(instance: IDocumentHubService): void {
    if (this._docHubServices.indexOf(instance) < 0) {
      throw new Error("Cannot find document service instance");
    }

    // --- Keep the last instance alive
    if (this._docHubServices.length <= 1) return;

    // --- Remove the document hub service gracefully
    delete this._docHubIdSlots[instance.hubId];
    instance.dispose();
    this._docHubServices = this._docHubServices.filter((d) => d !== instance);
    this._docHubActivations = this._docHubActivations.filter((d) => d !== instance);
    if (this._docHubActivations.length === 0) {
      this._activeDocHub = null;
      this.signDocServiceVersionChanged(instance.hubId);
    } else {
      this.setActiveDocumentHubService(this._docHubActivations.pop());
    }
  }

  /**
   * Reads the contents of the specified file from the file system and puts the content into the cache
   * @param file File to read
   * @param isBinary Read it as a binary file? (Use the default according to the file's type)
   */
  async readFileContent(file: string, isBinary?: boolean): Promise<string | Uint8Array> {
    const fileTypeEntry = getFileTypeEntry(file, this.store);
    let contents: string | Uint8Array;
    if (isBinary ?? fileTypeEntry?.isBinary) {
      // --- Read a binary file file
      contents = await createMainApi(this.messenger).readBinaryFile(file);
    } else {
      // --- Read a text file
      contents = await createMainApi(this.messenger).readTextFile(file);
    }

    // --- Done
    this._fileCache.set(file, contents);
    return contents;
  }

  /**
   * Reads the contents of the specified file from the file system and puts the content into the cache
   * @param file File to read
   * @param isBinary Read it as a binary file? (Use the default according to the file's type)
   */
  async getFileContent(file: string, isBinary?: boolean): Promise<string | Uint8Array> {
    const contents = this._fileCache.get(file);
    return contents ?? (await this.readFileContent(file, isBinary));
  }

  /**
   * Saves the specified contents of the file to the file system, and then to the cache
   * @param file File name
   * @param contents File contents to save
   */
  saveFileContent(file: string, contents: string | Uint8Array): Promise<void> {
    this._delayedJobs.cancel(file);
    return this.saveFileContentInner(file, contents);
  }

  saveFileContentAsYouType(file: string, contents: string | Uint8Array): Promise<void> {
    const TYPING_DELAY = 1000;
    return this._delayedJobs.schedule(
      TYPING_DELAY,
      JOB_KIND_SAVE_FILE,
      file,
      this.saveFileContentInner.bind(this, file, contents)
    );
  }

  private async saveFileContentInner(file: string, contents: string | Uint8Array): Promise<void> {
    if (typeof contents === "string") {
      await createMainApi(this.messenger).saveTextFile(file, contents);
    } else {
      await createMainApi(this.messenger).saveBinaryFile(file, contents);
    }

    // --- Done.
    this._fileCache.set(file, contents);
    this.signFileSaved(file, contents);
  }

  performAllDelayedSavesNow(): Promise<void> {
    return this._delayedJobs.instantlyRunAllOf(JOB_KIND_SAVE_FILE);
  }

  /**
   * Removes the specified file from the cache
   * @param file File to remove from the cache
   */
  forgetFile(file: string): void {
    this._fileCache.delete(file);
  }

  /**
   * Tests if the document with the specified ID is open
   * @param id Document ID
   */
  isDocumentOpen(id: string): boolean {
    return this._projectItemCache.has(id);
  }

  /**
   * Gets the document for the specified project node
   * @param node Project node to get
   */
  async getDocumentForProjectNode(node: ProjectNode): Promise<ProjectDocumentState> {
    // --- Check the document cache
    const documentState = this._projectItemCache.get(node.fullPath);
    if (documentState) return documentState;

    // --- Load the document's contents
    const contents = await this.getFileContent(node.fullPath, node.isBinary);

    // --- Get renderer information to extract icon properties
    const docRenderer = documentPanelRegistry.find((dp) => dp.id === node.editor);

    // --- Create the document's initial state
    const projectDoc: ProjectDocumentState = {
      id: node.fullPath,
      name: node.name,
      path: node.fullPath,
      type: node.editor,
      contents,
      language: node.subType,
      iconName: node.icon ?? docRenderer?.icon,
      iconFill: docRenderer?.iconFill,
      isReadOnly: node.isReadOnly,
      isTemporary: true,
      node,
      editVersionCount: 1,
      savedVersionCount: 1
    };
    this._projectItemCache.set(node.fullPath, projectDoc);
    return projectDoc;
  }

  /**
   * Gets a volatile document according to the specified info
   * @param docInfo
   */
  async getVolatileDocument(docInfo: VolatileDocumentInfo): Promise<ProjectDocumentState> {
    // --- Check the document cache
    const documentState = this._projectItemCache.get(docInfo.id);
    if (documentState) return documentState;

    // --- Create the document's initial state
    const projectDoc: ProjectDocumentState = {
      id: docInfo.id,
      name: docInfo.name,
      type: docInfo.type,
      iconName: docInfo.iconName,
      iconFill: docInfo.iconFill,
      isTemporary: false,
      editVersionCount: 1,
      savedVersionCount: 1
    };
    this._projectItemCache.set(docInfo.id, projectDoc);
    return projectDoc;
  }

  /**
   * Signs that a document hub has opened the specified document
   * @param id Document ID
   * @param hub Hub opening the document
   */
  openInDocumentHub(id: string, hub: IDocumentHubService): void {
    const doc = this.getDocumentById(id);
    if (!doc) return;
    doc.usedIn ??= [];
    if (doc.usedIn.includes(hub)) return;
    doc.usedIn.push(hub);
  }

  /**
   * Signs that a document hub has closed the specified document
   * @param id Document ID
   * @param hub Hub opening the document
   */
  closeInDocumentHub(id: string, hub: IDocumentHubService): void {
    const doc = this.getDocumentById(id);
    if (!doc?.usedIn) return;
    const docIndex = doc.usedIn.indexOf(hub);
    if (docIndex < 0) return;
    doc.usedIn.splice(docIndex, 1);

    if (!doc.usedIn.length) {
      // --- We deleted the last view of the document instance, close in the project service
      this._projectItemCache.delete(id);
    }
  }

  /**
   * Gets the project document by its ID
   * @param id Project document id
   */
  getDocumentById(id: string): ProjectDocumentState | undefined {
    return this._projectItemCache.get(id);
  }

  /**
   * Sets the specified document permanent
   * @param id The ID of the document to set permanent
   */
  setPermanent(id: string): void {
    const doc = this.getDocumentById(id);
    if (!doc) {
      throw new Error(`Cannot find document ${id}`);
    }
    if (!doc.isTemporary) return;
    doc.isTemporary = false;
    this.signProjectViewstateVersionChanged();
  }

  /**
   * Renames the document and optionally changes its ID
   * @param oldId Old document ID
   * @param newId New document ID
   */
  renameDocument(oldId: string, newId: string): void {
    const renamedNode = this.getNodeForFile(oldId);
    if (!renamedNode) {
      throw new Error(`Cannot find file node for ${oldId}`);
    }

    const fileTypeEntry = getFileTypeEntry(newId, this.store);
    renamedNode.data.icon = fileTypeEntry?.icon;

    // --- Change the properties of the renamed node
    renamedNode.data.fullPath = newId;
    renamedNode.data.name = getNodeFile(newId);
    renamedNode.data.subType = fileTypeEntry?.subType;
    renamedNode.parentNode.sortChildren((a, b) => compareProjectNode(a.data, b.data));

    // --- Re-index the file cache
    const oldContent = this._fileCache.get(oldId);
    if (oldContent !== undefined) {
      this._fileCache.delete(oldId);
      this._fileCache.set(newId, oldContent);
    }

    // --- Re-index the project item cache
    const oldItem = this._projectItemCache.get(oldId);
    if (oldItem) {
      this._projectItemCache.delete(oldId);
      oldItem.path = newId;
      oldItem.name = getNodeFile(newId);
      oldItem.language = fileTypeEntry?.subType;
      this._projectItemCache.set(newId, oldItem);
    }

    // --- Sign the change
    this.signProjectViewstateVersionChanged();
    this.signItemRenamed(oldId, renamedNode);
  }

  // --- Helper methods

  /**
   * Gets the next available document hub ID
   */
  private getNextDocumentHubId(): number {
    let nextId = 1;
    while (nextId < this._docHubIdSlots.length && !this._docHubIdSlots[nextId]) {
      nextId++;
    }
    this._docHubIdSlots[nextId] = true;
    return nextId;
  }

  private signProjectViewstateVersionChanged(): void {
    this.store.dispatch(incProjectViewStateVersionAction(), "ide");
  }

  private signDocServiceVersionChanged(hubId: number): void {
    this.store.dispatch(incDocHubServiceVersionAction(hubId), "ide");
  }
}

export const createProjectService = (store: Store<AppState>, messenger: MessengerBase) =>
  new ProjectService(store, messenger);
