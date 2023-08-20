import { ITreeNode, ITreeView } from "@renderer/core/tree-node";
import { ILiteEvent } from "@emu/utils/lite-event";
import { ProjectNode } from "../appIde/project/project-node";
import { BreakpointAddressInfo } from "@abstractions/BreakpointInfo";

/**
 * This service is responsible to manage the hierarchy and contents of project files
 */
export type IProjectService = {
  /**
   * Gets the current project tree
   */
  getProjectTree: () => ITreeView<ProjectNode> | undefined;

  /**
   * Sets the current project tree to the specified one.
   * @param tree New project tree to use.
   */
  setProjectTree: (tree: ITreeView<ProjectNode>) => void;

  /**
   * Signs that a new item has been added to the project tree
   * @param node New project tree node
   */
  signItemAdded: (node: ITreeNode<ProjectNode>) => void;

  /**
   * Signs that a project item has been renamed
   * @param oldName Old project item id
   * @param node New project item node
   */
  signItemRenamed: (oldName: string, node: ITreeNode<ProjectNode>) => void;

  /**
   * Signs that a project item has benn removed from the project
   * @param node Project node removed
   */
  signItemDeleted: (node: ITreeNode<ProjectNode>) => void;

  /**
   * Fires when a project has been open
   */
  readonly projectOpened: ILiteEvent<void>;

  /**
   * Fires when a project has been closed
   */
  readonly projectClosed: ILiteEvent<void>;

  /**
   * Fires when an item has been added to the project
   */
  readonly itemAdded: ILiteEvent<ITreeNode<ProjectNode>>;

  /**
   * Fires when an item has been renamed in the project
   */
  readonly itemRenamed: ILiteEvent<{oldName: string, node: ITreeNode<ProjectNode>}>;

  /**
   * Fires when an item hasn been deleted from the project
   */
  readonly itemDeleted: ILiteEvent<ITreeNode<ProjectNode>>;

  /**
   * Gets the project node for the file with the specified name
   * @param file 
   */  
  getNodeForFile(file: string): ITreeNode<ProjectNode> | undefined;

  /**
   * Gets breakpoint information according to the address. 
   * @param addr Binary address or a "[<projectFile>]:<lineNo>" format for source code address
   */  
  getBreakpointAddressInfo(addr: string | number): BreakpointAddressInfo;

  /**
   * Reads the contents of the specified file from the file system and puts the content into the cache
   * @param file File to read
   * @param isBinary Read it as a binary file? (Use the default according to the file's type)
   */
  readFileContent(file: string, isBinary?: boolean): Promise<string | Uint8Array>;

  /**
   * Gets the contents of the file. First checks the cache, than uses the file system
   * @param file File to read
   * @param isBinary Read it as a binary file? (Use the default according to the file's type)
   */
  getFileContent(file: string, isBinary?: boolean): Promise<string | Uint8Array>;

  /**
   * Saves the specified contents of the file to the file system, and then to the cache
   * @param file File name
   * @param contents File contents to save
   */
  saveFileContent(file: string, contents: string | Uint8Array): Promise<void>

  /**
   * Removes the specified file from the cache
   * @param file File to remove from the cache
   */
  forgetFile(file: string): void;
};
