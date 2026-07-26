import { EmuApi } from "@common/messaging/EmuApi";
import { MainApi } from "@common/messaging/MainApi";
import { AppState } from "@common/state/AppState";
import { setBuildRootAction } from "@common/state/actions";
import { Store } from "@common/state/redux-light";
import { ITreeNode, ITreeView } from "@abstractions/ITreeNode";
import { ProjectNode } from "@abstractions/ProjectNode";
import { IProjectService } from "@renderer/abstractions/IProjectService";
import { IIdeCommandService } from "@renderer/abstractions/IIdeCommandService";
import { TreeNode } from "@renderer/core/tree-node";
import { compareProjectNode, getFileTypeEntry, getNodeDir } from "../project/project-node";

type DispatchAction = (action: any, source?: any) => any;

type RenameExplorerNodeArgs = {
  buildRoots: string[];
  dispatch: DispatchAction;
  emuApi: Pick<EmuApi, "renameBreakpoints">;
  mainApi: Pick<MainApi, "displayMessageBox" | "renameFileEntry" | "saveProject">;
  newName: string;
  projectService: Pick<IProjectService, "performAllDelayedSavesNow" | "renameDocument">;
  refreshTree: () => void;
  selectedContextNode: ITreeNode<ProjectNode>;
  setSelected: (index: number) => void;
  tree: ITreeView<ProjectNode>;
};

type DeleteExplorerNodeArgs = {
  mainApi: Pick<MainApi, "checkBuildRoot" | "deleteFileEntry">;
  projectService: Pick<IProjectService, "signItemDeleted">;
  refreshTree: () => void;
  selectedContextNode: ITreeNode<ProjectNode>;
  selectedContextNodeIsFolder: boolean;
};

type AddExplorerItemArgs = {
  ideCommandsService: Pick<IIdeCommandService, "executeCommand">;
  mainApi: Pick<MainApi, "addNewFileEntry" | "displayMessageBox">;
  newItemIsFolder: boolean;
  newName: string;
  projectService: Pick<IProjectService, "signItemAdded">;
  refreshTree: () => void;
  scheduleNavigation?: (action: () => Promise<void>, delay: number) => void;
  selectedContextNode: ITreeNode<ProjectNode>;
  setSelected: (index: number) => void;
  store: Store<AppState>;
  tree: ITreeView<ProjectNode>;
};

export async function renameExplorerNode({
  buildRoots,
  dispatch,
  emuApi,
  mainApi,
  newName,
  projectService,
  refreshTree,
  selectedContextNode,
  setSelected,
  tree
}: RenameExplorerNodeArgs): Promise<void> {
  const newFullName = `${getNodeDir(selectedContextNode.data.fullPath)}/${newName}`;
  await projectService.performAllDelayedSavesNow();

  const oldProjectFolder = getNodeDir(selectedContextNode.data.projectPath);
  const wasBuildRoot = buildRoots.indexOf(selectedContextNode.data.projectPath) >= 0;
  try {
    await mainApi.renameFileEntry(selectedContextNode.data.fullPath, newFullName);
    projectService.renameDocument(selectedContextNode.data.fullPath, newFullName);

    const oldResource = selectedContextNode.data.projectPath;
    const oldProjectPath = getNodeDir(oldResource);
    const newResource = oldProjectPath ? `${oldProjectPath}/${newName}` : newName;
    await emuApi.renameBreakpoints(oldResource, newResource);

    if (wasBuildRoot) {
      const newProjectPath = oldProjectFolder ? `${oldProjectFolder}/${newName}` : newName;
      dispatch(setBuildRootAction([newProjectPath], true));
      await mainApi.saveProject();
    }

    refreshTree();
    const newIndex = tree.findIndex(selectedContextNode);
    if (newIndex >= 0) {
      setSelected(newIndex);
    }
  } catch (err) {
    await mainApi.displayMessageBox("error", "Rename Error", err.toString());
  }
}

export async function deleteExplorerNode({
  mainApi,
  projectService,
  refreshTree,
  selectedContextNode,
  selectedContextNodeIsFolder
}: DeleteExplorerNodeArgs): Promise<void> {
  await mainApi.deleteFileEntry(selectedContextNodeIsFolder, selectedContextNode.data.fullPath);

  selectedContextNode.parentNode.removeChild(selectedContextNode);
  refreshTree();
  projectService.signItemDeleted(selectedContextNode);
  await mainApi.checkBuildRoot(selectedContextNode.data.projectPath);
}

export async function addExplorerItem({
  ideCommandsService,
  mainApi,
  newItemIsFolder,
  newName,
  projectService,
  refreshTree,
  scheduleNavigation = (action, delay) => {
    setTimeout(action, delay);
  },
  selectedContextNode,
  setSelected,
  store,
  tree
}: AddExplorerItemArgs): Promise<ITreeNode<ProjectNode> | undefined> {
  selectedContextNode.isExpanded = true;

  try {
    await mainApi.addNewFileEntry(newName, newItemIsFolder, selectedContextNode.data.fullPath);

    const fileTypeEntry = getFileTypeEntry(newName, store);
    const newNode = new TreeNode<ProjectNode>({
      isFolder: newItemIsFolder,
      name: newName,
      fullPath: `${selectedContextNode.data.fullPath}/${newName}`
    });

    if (fileTypeEntry) {
      newNode.data.icon = fileTypeEntry.icon;
      newNode.data.editor = fileTypeEntry.editor;
      newNode.data.subType = fileTypeEntry.subType;
      newNode.data.isBinary = fileTypeEntry.isBinary;
    }
    selectedContextNode.insertAndSort(newNode, (a, b) => compareProjectNode(a.data, b.data));

    refreshTree();
    projectService.signItemAdded(newNode);
    const newIndex = tree.findIndex(newNode);
    if (newIndex >= 0) {
      setSelected(newIndex);
    }

    scheduleNavigation(async () => {
      if (!newNode.data.isFolder) {
        await ideCommandsService.executeCommand(`nav "${newNode.data.fullPath}"`);
      }
    }, 600);

    return newNode;
  } catch (err) {
    await mainApi.displayMessageBox("error", "Add new item error", err.toString());
    return undefined;
  }
}
