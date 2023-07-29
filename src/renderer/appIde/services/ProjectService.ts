import { ITreeNode, ITreeView } from "@/renderer/core/tree-node";
import { LiteEvent, ILiteEvent } from "@/emu/utils/lite-event";
import { AppState } from "@/common/state/AppState";
import { Store } from "@/common/state/redux-light";
import { IProjectService } from "../../abstractions/IProjectService";
import { ProjectNode } from "../project/project-node";

class ProjectService implements IProjectService {
  private _tree: ITreeView<ProjectNode>;
  private _oldState: AppState;
  private _projectOpened = new LiteEvent<void>();
  private _projectClosed = new LiteEvent<void>();
  private _itemAdded = new LiteEvent<ITreeNode<ProjectNode>>;
  private _itemRenamed = new LiteEvent<{oldName: string, node: ITreeNode<ProjectNode>}>;
  private _itemDeleted = new LiteEvent<ITreeNode<ProjectNode>>;

  constructor (store: Store<AppState>) {
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

  getProjectTree (): ITreeView<ProjectNode> | undefined {
    return this._tree;
  }

  get projectOpened (): ILiteEvent<void> {
    return this._projectOpened;
  }

  get projectClosed (): ILiteEvent<void> {
    return this._projectClosed;
  }

  signItemAdded(node: ITreeNode<ProjectNode>): void {
    this._itemAdded.fire(node);
  }

  signItemRenamed(oldName: string, node: ITreeNode<ProjectNode>): void {
    this._itemRenamed.fire({oldName, node});
  }

  signItemDeleted(node: ITreeNode<ProjectNode>): void {
    this._itemDeleted.fire(node);
  }

  get itemAdded(): ILiteEvent<ITreeNode<ProjectNode>> {
    return this._itemAdded;
  }

  get itemRenamed(): ILiteEvent<{oldName: string, node: ITreeNode<ProjectNode>}> {
    return this._itemRenamed;
  }

  get itemDeleted(): ILiteEvent<ITreeNode<ProjectNode>> {
    return this._itemDeleted;
  }

  getNodeForFile(file: string): ITreeNode<ProjectNode> {
    return this._tree ? findFileNode(this._tree.rootNode, file) : undefined;

    function findFileNode(node: ITreeNode<ProjectNode>, name: string): ITreeNode<ProjectNode> | undefined {
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
}

export const createProjectService = (store: Store<AppState>) =>
  new ProjectService(store);
