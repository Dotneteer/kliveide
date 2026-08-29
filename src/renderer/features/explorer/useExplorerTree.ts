import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "@common/state/AppState";
import { MainApi } from "@common/messaging/MainApi";
import { Store } from "@common/state/redux-light";
import { ITreeNode, ITreeView } from "@abstractions/ITreeNode";
import { ProjectNode } from "@abstractions/ProjectNode";
import { IProjectService } from "@renderer/abstractions/IProjectService";
import { buildProjectTree } from "@renderer/appIde/project/project-node";

const folderCache = new Map<string, ITreeView<ProjectNode>>();
let lastExplorerPath = "";

type UseExplorerTreeArgs = {
  excludedItems?: string[];
  explorerViewVersion?: number;
  folderPath?: string;
  mainApi: MainApi;
  projectService: IProjectService;
  store: Store<AppState>;
};

export function useExplorerTree({
  excludedItems,
  explorerViewVersion,
  folderPath,
  mainApi,
  projectService,
  store
}: UseExplorerTreeArgs) {
  const [tree, setTree] = useState<ITreeView<ProjectNode>>(null);
  const [visibleNodes, setVisibleNodes] = useState<ITreeNode<ProjectNode>[]>([]);
  const [selectedNode, setSelectedNode] = useState<ITreeNode<ProjectNode> | null>(null);
  const lastExpandedRef = useRef<string[]>(null);
  const selected = selectedNode ? visibleNodes.indexOf(selectedNode) : -1;

  const refreshTree = useCallback(() => {
    if (!tree) return;
    tree.buildIndex();
    setVisibleNodes(tree.getVisibleNodes());
  }, [tree]);

  const rememberExpandedItems = useCallback(() => {
    if (tree?.rootNode) {
      lastExpandedRef.current = getExpandedItems(tree.rootNode);
    }
  }, [tree]);

  const refreshProjectFolder = useCallback(async (useCache: boolean) => {
    if (!folderPath) {
      setSelectedNode(null);
      return;
    }

    lastExplorerPath = folderPath;
    const cachedTree = folderCache.get(folderPath);
    if (cachedTree && useCache) {
      setTree(cachedTree);
      setVisibleNodes(cachedTree.getVisibleNodes());
      projectService.setProjectTree(cachedTree);
      return;
    }

    const contents = await mainApi.getDirectoryContent(folderPath);
    const projectTree = buildProjectTree(contents, store, lastExpandedRef.current);
    setTree(projectTree);
    setVisibleNodes(projectTree.getVisibleNodes());
    projectService.setProjectTree(projectTree);
    folderCache.set(folderPath, projectTree);
  }, [folderPath, mainApi, projectService, store]);

  const refreshProjectFolderRef = useRef(refreshProjectFolder);
  refreshProjectFolderRef.current = refreshProjectFolder;
  const explorerVersionInitializedRef = useRef(false);

  useEffect(() => {
    const projectClosed = () => {
      if (lastExplorerPath) folderCache.delete(lastExplorerPath);
    };

    const itemDeleted = (node: ITreeNode<ProjectNode>) => {
      const docId = node.data.fullPath;
      const deletedDoc = projectService.getDocumentById(docId);
      if (deletedDoc?.usedIn) {
        deletedDoc.usedIn.forEach((docHub) => docHub.closeDocument(docId));
      }
    };

    const itemRenamed = (info: { oldName: string; node: ITreeNode<ProjectNode> }) => {
      const docId = info.node.data.fullPath;
      const renamedDoc = projectService.getDocumentById(docId);
      if (renamedDoc?.usedIn) {
        renamedDoc.usedIn.forEach((docHub) => {
          docHub.renameDocument(info.oldName, info.node.data.fullPath);
        });
      }
    };

    projectService.projectClosed.on(projectClosed);
    projectService.itemDeleted.on(itemDeleted);
    projectService.itemRenamed.on(itemRenamed);
    return () => {
      projectService.projectClosed.off(projectClosed);
      projectService.itemDeleted.off(itemDeleted);
      projectService.itemRenamed.off(itemRenamed);
    };
  }, [projectService]);

  useEffect(() => {
    if (lastExplorerPath) folderCache.delete(lastExplorerPath);
  }, [excludedItems]);

  useEffect(() => {
    (async () => {
      await refreshProjectFolder(true);
    })();
  }, [excludedItems, folderPath, refreshProjectFolder]);

  useEffect(() => {
    if (!explorerVersionInitializedRef.current) {
      explorerVersionInitializedRef.current = true;
      return;
    }
    (async () => {
      await refreshProjectFolderRef.current(false);
    })();
  }, [explorerViewVersion]);

  return {
    refreshTree,
    rememberExpandedItems,
    selected,
    selectedNode,
    setSelected,
    setSelectedNode,
    setVisibleNodes,
    tree,
    visibleNodes
  };

  function setSelected(index: number): void {
    setSelectedNode(index >= 0 ? visibleNodes[index] ?? null : null);
  }
}

export function clearExplorerFolderCache(): void {
  folderCache.clear();
}

export function getExpandedItems(root: ITreeNode<ProjectNode>): string[] {
  const result: string[] = [];
  getExpandedItemsRecursive(root, result);
  return result;
}

function getExpandedItemsRecursive(
  node: ITreeNode<ProjectNode>,
  result: string[]
): void {
  if (node.isExpanded && node.data.isFolder) {
    result.push(node.data.projectPath);
    node.children.forEach((child) => getExpandedItemsRecursive(child, result));
  }
}
