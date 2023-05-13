import { ITreeNode } from "@/core/tree-node";
import { LiteEvent, ILiteEvent } from "@/emu/utils/lite-event";
import { AppState } from "@common/state/AppState";
import { Store } from "@common/state/redux-light";
import { IProjectService } from "../abstractions/IProjectService";
import { ProjectNode } from "../project/project-node";

class ProjectService implements IProjectService {
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
      const newProjectVersion = newState?.project?.projectVersion;
      const oldProjectVersion = this._oldState?.project?.projectVersion;
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
}

export const createProjectService = (store: Store<AppState>) =>
  new ProjectService(store);
