import { FileChange } from "../../renderer/ide/explorer-tools/ProjectService";
import { ITreeNode, ITreeView } from "../../renderer/common-ui/ITreeNode";
import { ProjectNode } from "../../renderer/ide/explorer-tools/ProjectNode";
import { ILiteEvent } from "@core/LiteEvent";
import { DirectoryContent } from "@core/state/AppState";

/**
 * This interface defines the service handling projects
 */
export interface IProjectService {
  /**
   * Gets the current project tree
   * @returns Project tree, if set; otherwise, null
   */
  getProjectTree(): ITreeView<ProjectNode> | null;

  /**
   * Close the current project tree
   */
  closeProjectTree(): void;

  /**
   * Sets the project folder to the specified one
   * @param name
   */
  setProjectContents(contents?: DirectoryContent): Promise<void>;

  /**
   * Creates a tree view from the specified contents
   */
  createTreeFrom(
    contents: DirectoryContent,
    rootPath: string
  ): ITreeNode<ProjectNode>;

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
  ): void;

  /**
   * Creates a new file
   * @param name File to create
   * @returns Null, if successful; otherwise, error message
   */
  createFile(name: string): Promise<string | null>;

  /**
   * Creates a new folder
   * @param name Folder to create
   * @returns Null, if successful; otherwise, error message
   */
  createFolder(name: string): Promise<string | null>;

  /**
   * Deletes a project file
   * @param name File to delete
   * @returns Null, if successful; otherwise, error message
   */
  deleteFile(name: string): Promise<string | null>;

  /**
   * Deletes a project folder
   * @param name Folder to delete
   * @returns Null, if successful; otherwise, error message
   */
  deleteFolder(name: string): Promise<string | null>;

  /**
   * Renames a project file
   * @param oldName Old filename
   * @param newName New filename
   * @returns Null, if successful; otherwise, error message
   */
  renameFile(oldName: string, newName: string): Promise<string | null>;

  /**
   * Renames a project folder
   * @param oldName Old folder name
   * @param newName New folder name
   * @returns Null, if successful; otherwise, error message
   */
  renameFolder(oldName: string, newName: string): Promise<string | null>;

  /**
   * Fires when a project file is created
   */
  readonly fileCreated: ILiteEvent<string>;

  /**
   * Fires when a project folder is created
   */
  readonly folderCreated: ILiteEvent<string>;

  /**
   * Fires when a project file is renamed
   */
  readonly fileRenamed: ILiteEvent<FileChange>;

  /**
   * Fires when a project folder is renamed
   */
  readonly folderRenamed: ILiteEvent<FileChange>;

  /**
   * Fires when a project file has been deleted
   */
  readonly fileDeleted: ILiteEvent<string>;

  /**
   * Fires when a project folder has been deleted
   */
  readonly folderDeleted: ILiteEvent<string>;
}
