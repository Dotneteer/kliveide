import { getDocumentService, getStore } from "@core/service-registry";
import {
  getNodeExtension,
  ITreeNode,
  ITreeView,
  ProjectNode,
} from "@abstractions/project-node";
import { TreeNode } from "@components/TreeNode";
import { TreeView } from "@components/TreeView";
import { DirectoryContent } from "@state/AppState";
import { ILiteEvent, LiteEvent } from "@core/utils/lite-event";
import { FileOperationResponse } from "@core/messaging/message-types";
import { sendFromIdeToEmu } from "@core/messaging/message-sending";
import { FileChange, IProjectService } from "@abstractions/project-service";

/**
 * This class implements the project services
 */
export class ProjectService implements IProjectService {
  private _projectTree: ITreeView<ProjectNode> | null = null;
  private _folderCreated = new LiteEvent<string>();
  private _fileCreated = new LiteEvent<string>();
  private _folderRenamed = new LiteEvent<FileChange>();
  private _fileRenamed = new LiteEvent<FileChange>();
  private _folderDeleted = new LiteEvent<string>();
  private _fileDeleted = new LiteEvent<string>();

  constructor() {
    // --- Close the project tree whenever the project is closed
    getStore().projectChanged.on((ps) => {
      if (!ps.path || !ps.hasVm) {
        this.closeProjectTree();
      }
    });
  }

  /**
   * Gets the current project tree
   * @returns Project tree, if set; otherwise, null
   */
  getProjectTree(): ITreeView<ProjectNode> | null {
    return this._projectTree;
  }

  /**
   * Close the current project tree
   */
  closeProjectTree(): void {
    this._projectTree = null;
  }

  /**
   * Sets the project folder to the specified one
   * @param name
   */
  async setProjectContents(contents?: DirectoryContent): Promise<void> {
    const documentService = getDocumentService();
    if (contents) {
      this._projectTree = new TreeView(this.createTreeFrom(contents));
      console.log("Resolving icons");
      await resolveIconAndFlags(this._projectTree.rootNode);
    } else {
      this._projectTree = null;
    }

    // --- Get the icon for the specified node
    async function resolveIconAndFlags(
      node: ITreeNode<ProjectNode>
    ): Promise<void> {
      console.log(node.nodeData.fullPath);
      if (!node.nodeData.isFolder) {
        // #1: Do we know the language?
        const language = await documentService.getCodeEditorLanguage(
          node.nodeData.fullPath
        );
        if (language) {
          const languageInfo = documentService.getCustomLanguage(language);
          if (languageInfo?.icon) {
            node.nodeData.icon = languageInfo.icon;
            return;
          }
        }

        // #2: do we have a registered extension?
        const extension = getNodeExtension(node.nodeData);
        const codeEditorInfo = documentService.getEditorExtension(extension);
        if (codeEditorInfo) {
          node.nodeData.isReadOnly = codeEditorInfo.isReadOnly;
          node.nodeData.icon = codeEditorInfo.icon;
        }
        return;
      }

      // --- Traverse child nodes
      for (const child of node.getChildren()) {
        await resolveIconAndFlags(child);
      }
    }
  }

  /**
   * Creates a tree view from the specified contents
   */
  createTreeFrom(
    contents: DirectoryContent,
    rootPath: string = null
  ): TreeNode<ProjectNode> {
    const root = new TreeNode<ProjectNode>({
      name: contents.name.replace(/\\/g, "/"),
      isFolder: true,
      fullPath: (rootPath
        ? `${rootPath}/${contents.name}`
        : contents.name
      ).replace(/\\/g, "/"),
    });
    contents.folders
      .sort((a, b) => {
        return a.name > b.name ? 1 : a.name < b.name ? 1 : 0;
      })
      .forEach((f) => {
        const folderNode = this.createTreeFrom(f, root.nodeData.fullPath);
        folderNode.isExpanded = false;
        root.appendChild(folderNode);
      });
    contents.files.sort().forEach((f) => {
      root.appendChild(
        new TreeNode<ProjectNode>({
          name: f,
          isFolder: false,
          fullPath: `${root.nodeData.fullPath}/${f}`,
        })
      );
    });
    return root;
  }

  /**
   * Rename a project node and its children
   * @param item Item to rename
   * @param oldName Original item name
   * @param newName New item name
   * @param folderMatch Is the root item a folder?
   */
  renameProjectNode(
    item: ITreeNode<ProjectNode>,
    oldName: string,
    newName: string,
    folderMatch: boolean
  ): void {
    // --- Rename the node
    item.nodeData.fullPath = folderMatch
      ? `${newName}${item.nodeData.fullPath.substr(oldName.length)}`
      : newName;
    const segments = item.nodeData.fullPath.split("/");
    item.nodeData.name = segments[segments.length - 1];

    // --- Recursively rename children
    for (const childNode of item.getChildren()) {
      this.renameProjectNode(childNode, oldName, newName, folderMatch);
    }
  }

  /**
   * Creates a new file
   * @param name File to create
   * @returns Null, if successful; otherwise, error message
   */
  async createFile(name: string): Promise<string | null> {
    const result = await sendFromIdeToEmu<FileOperationResponse>({
      type: "CreateFile",
      name,
    });
    if (result.error) {
      return result.error;
    }
    this._fileCreated.fire(name);
    return null;
  }

  /**
   * Creates a new folder
   * @param name Folder to create
   * @returns Null, if successful; otherwise, error message
   */
  async createFolder(name: string): Promise<string | null> {
    const result = await sendFromIdeToEmu<FileOperationResponse>({
      type: "CreateFolder",
      name,
    });
    if (result.error) {
      return result.error;
    }
    this._folderCreated.fire(name);
    return null;
  }

  /**
   * Deletes a project file
   * @param name File to delete
   * @returns Null, if successful; otherwise, error message
   */
  async deleteFile(name: string): Promise<string | null> {
    const result = await sendFromIdeToEmu<FileOperationResponse>({
      type: "DeleteFile",
      name,
    });
    if (result.error) {
      return result.error;
    }
    this._fileDeleted.fire(name);
    return null;
  }

  /**
   * Deletes a project folder
   * @param name Folder to delete
   * @returns Null, if successful; otherwise, error message
   */
  async deleteFolder(name: string): Promise<string | null> {
    const result = await sendFromIdeToEmu<FileOperationResponse>({
      type: "DeleteFolder",
      name,
    });
    if (result.error) {
      return result.error;
    }
    this._folderDeleted.fire(name);
    return null;
  }

  /**
   * Renames a project file
   * @param oldName Old filename
   * @param newName New filename
   * @returns Null, if successful; otherwise, error message
   */
  async renameFile(oldName: string, newName: string): Promise<string | null> {
    const result = await sendFromIdeToEmu<FileOperationResponse>({
      type: "RenameFile",
      oldName,
      newName,
    });
    if (result.error) {
      return result.error;
    }
    this._fileRenamed.fire({ oldName, newName });
    return null;
  }

  /**
   * Renames a project folder
   * @param oldName Old folder name
   * @param newName New folder name
   * @returns Null, if successful; otherwise, error message
   */
  async renameFolder(oldName: string, newName: string): Promise<string | null> {
    const result = await sendFromIdeToEmu<FileOperationResponse>({
      type: "RenameFile",
      oldName,
      newName,
    });
    if (result.error) {
      return result.error;
    }
    this._folderRenamed.fire({ oldName, newName });
    return null;
  }

  /**
   * Searches for the specified project node within the tree
   * @param resource Resource node name
   */
  searchNode(resource: string): ITreeNode<ProjectNode> | null {
    return searchNode(resource, this._projectTree.rootNode);

    function searchNode(
      id: string,
      node: ITreeNode<ProjectNode>
    ): ITreeNode<ProjectNode> | null {
      if (node.nodeData.fullPath === id) {
        return node;
      }
      for (const child of node.getChildren()) {
        const childFound = searchNode(id, child);
        if (childFound) {
          return childFound;
        }
      }
      return null;
    }
  }

  /**
   * Fires when a project file is created
   */
  get fileCreated(): ILiteEvent<string> {
    return this._fileCreated;
  }

  /**
   * Fires when a project folder is created
   */
  get folderCreated(): ILiteEvent<string> {
    return this._folderCreated;
  }

  /**
   * Fires when a project file is renamed
   */
  get fileRenamed(): ILiteEvent<FileChange> {
    return this._fileRenamed;
  }

  /**
   * Fires when a project folder is renamed
   */
  get folderRenamed(): ILiteEvent<FileChange> {
    return this._folderRenamed;
  }

  /**
   * Fires when a project file has been deleted
   */
  get fileDeleted(): ILiteEvent<string> {
    return this._fileDeleted;
  }

  /**
   * Fires when a project folder has been deleted
   */
  get folderDeleted(): ILiteEvent<string> {
    return this._folderDeleted;
  }
}
