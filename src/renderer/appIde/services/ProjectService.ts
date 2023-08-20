import { ITreeNode, ITreeView } from "@renderer/core/tree-node";
import { LiteEvent, ILiteEvent } from "@emu/utils/lite-event";
import { AppState } from "@state/AppState";
import { Store } from "@state/redux-light";
import { IProjectService } from "../../abstractions/IProjectService";
import { ProjectNode, getFileTypeEntry } from "../project/project-node";
import { BreakpointAddressInfo } from "@abstractions/BreakpointInfo";
import { MessengerBase } from "@common/messaging/MessengerBase";
import {
  reportMessagingError,
  reportUnexpectedMessageType
} from "@renderer/reportError";

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
  private _fileCache = new Map<string, string | Uint8Array>();

  constructor (
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

  setProjectTree (tree: ITreeView<ProjectNode>): void {
    this._tree = tree;
  }

  getProjectTree (): ITreeView<ProjectNode> | undefined {
    return this._tree;
  }

  get projectOpened (): ILiteEvent<void> {
    return this._projectOpened;
  }

  get projectClosed (): ILiteEvent<void> {
    return this._projectClosed;
  }

  signItemAdded (node: ITreeNode<ProjectNode>): void {
    this._itemAdded.fire(node);
  }

  signItemRenamed (oldName: string, node: ITreeNode<ProjectNode>): void {
    this._itemRenamed.fire({ oldName, node });
  }

  signItemDeleted (node: ITreeNode<ProjectNode>): void {
    this._itemDeleted.fire(node);
  }

  get itemAdded (): ILiteEvent<ITreeNode<ProjectNode>> {
    return this._itemAdded;
  }

  get itemRenamed (): ILiteEvent<{
    oldName: string;
    node: ITreeNode<ProjectNode>;
  }> {
    return this._itemRenamed;
  }

  get itemDeleted (): ILiteEvent<ITreeNode<ProjectNode>> {
    return this._itemDeleted;
  }

  getNodeForFile (file: string): ITreeNode<ProjectNode> {
    return this._tree ? findFileNode(this._tree.rootNode, file) : undefined;

    function findFileNode (
      node: ITreeNode<ProjectNode>,
      name: string
    ): ITreeNode<ProjectNode> | undefined {
      if (node.data.fullPath === file || node.data.projectPath === file)
        return node;
      if (node.childCount > 0) {
        for (const child of node.children) {
          const found = findFileNode(child, name);
          if (found) return found;
        }
      }
      return undefined;
    }
  }

  getBreakpointAddressInfo (
    addr: string | number
  ): BreakpointAddressInfo | undefined {
    if (typeof addr === "number") {
      return {
        address: addr & 0xffff
      };
    }

    addr = addr.trim();
    if (!addr.startsWith("[")) return;

    const parts = addr.split(":");
    if (parts.length < 2) return;

    let resource = "";
    let line = 0;

    const last = parts[parts.length - 1];
    if (!/^\d+$/.test(last)) return;
    line = parseInt(last, 10);

    if (!parts[parts.length - 2].endsWith("]")) return;
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
   * Reads the contents of the specified file from the file system and puts the content into the cache
   * @param file File to read
   * @param isBinary Read it as a binary file? (Use the default according to the file's type)
   */
  async readFileContent (
    file: string,
    isBinary?: boolean
  ): Promise<string | Uint8Array> {
    const fileTypeEntry = getFileTypeEntry(file);
    let contents: string | Uint8Array;
    if (isBinary ?? fileTypeEntry?.isBinary) {
      // --- Read a binary file file
      const response = await this.messenger.sendMessage({
        type: "MainReadBinaryFile",
        path: file
      });
      if (response.type === "ErrorResponse") {
        throw new Error(response.message);
      } else if (response.type !== "BinaryContents") {
        throw new Error(`Unexpected response type: ${response.type}`);
      } else {
        contents = response.contents;
      }
    } else {
      // --- Read a text file
      const response = await this.messenger.sendMessage({
        type: "MainReadTextFile",
        path: file
      });
      if (response.type === "ErrorResponse") {
        throw new Error(response.message);
      } else if (response.type !== "TextContents") {
        throw new Error(`Unexpected response type: ${response.type}`);
      } else {
        contents = response.contents;
      }
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
  async getFileContent (
    file: string,
    isBinary?: boolean
  ): Promise<string | Uint8Array> {
    const contents = this._fileCache.get(file);
    return contents ?? (await this.readFileContent(file, isBinary));
  }

  /**
   * Saves the specified contents of the file to the file system, and then to the cache
   * @param file File name
   * @param contents File contents to save
   */
  async saveFileContent (
    file: string,
    contents: string | Uint8Array
  ): Promise<void> {
    if (typeof contents === "string") {
      const response = await this.messenger.sendMessage({
        type: "MainSaveTextFile",
        path: file,
        data: contents
      });
      if (response.type === "ErrorResponse") {
        throw new Error(response.message);
      }
    } else {
      const response = await this.messenger.sendMessage({
        type: "MainSaveBinaryFile",
        path: file,
        data: contents
      });
      if (response.type === "ErrorResponse") {
        throw new Error(response.message);
      }
    }

    // --- Done.
    this._fileCache.set(file, contents);
  }

  /**
   * Removes the specified file from the cache
   * @param file File to remove from the cache
   */
  forgetFile (file: string): void {
    this._fileCache.delete(file);
  }
}

export const createProjectService = (
  store: Store<AppState>,
  messenger: MessengerBase
) => new ProjectService(store, messenger);
