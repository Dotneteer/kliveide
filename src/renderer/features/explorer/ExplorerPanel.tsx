import styles from "./ExplorerPanel.module.scss";
import { useDispatch, useRendererContext, useSelector } from "@renderer/core/RendererProvider";
import { MouseEvent, useRef, useState } from "react";
import { getFileTypeEntry } from "@renderer/appIde/project/project-node";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { useContextMenuState } from "@controls/ContextMenu";
import { RenameDialog } from "@renderer/appIde/dialogs/RenameDialog";
import { DeleteDialog } from "@renderer/appIde/dialogs/DeleteDialog";
import { NewItemDialog } from "@renderer/appIde/dialogs/NewItemDialog";
import {
  displayDialogAction,
  incExploreViewVersionAction,
  setBuildRootAction
} from "@state/actions";
import { PROJECT_FILE } from "@common/structs/project-const";
import { EMPTY_ARRAY } from "@renderer/utils/stablerefs";
import { EXCLUDED_PROJECT_ITEMS_DIALOG, NEW_PROJECT_DIALOG } from "@common/messaging/dialog-ids";
import { saveProject } from "@renderer/appIde/utils/save-project";
import { FileTypeEditor } from "@renderer/abstractions/FileTypePattern";
import { ITreeNode } from "@abstractions/ITreeNode";
import { ProjectNode } from "@abstractions/ProjectNode";
import { useMainApi } from "@renderer/core/MainApi";
import { VirtualizedList } from "@renderer/controls/VirtualizedList";
import { VListHandle } from "virtua";
import { useEmuApi } from "@renderer/core/EmuApi";
import { ExplorerProjectItem } from "./ExplorerProjectItem";
import { ExplorerEmptyState } from "./ExplorerEmptyState";
import { ExplorerContextMenu } from "./ExplorerContextMenu";
import { clearExplorerFolderCache, useExplorerTree } from "./useExplorerTree";
import {
  addExplorerItem,
  deleteExplorerNode,
  renameExplorerNode
} from "./explorerFileOperations";

export const ExplorerPanel = () => {
  // --- Services used in this component
  const { store, messenger } = useRendererContext();
  const mainApi = useMainApi();
  const emuApi = useEmuApi();

  const dispatch = useDispatch();
  const appServices = useAppServices();
  const { projectService, ideCommandsService } = appServices;
  const documentHubService = projectService.getActiveDocumentHubService();

  // --- Visibility of dialogs
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isNewItemDialogOpen, setIsNewItemDialogOpen] = useState(false);
  const [newItemIsFolder, setNewItemIsFolder] = useState(false);

  const [isFocused, setIsFocused] = useState(false);

  // --- Information about a project (Is any project open? Is it a Klive project?)
  const folderPath = useSelector((s) => s.project?.folderPath);
  const excludedItems = useSelector((s) => s.project?.excludedItems);
  const isKliveProject = useSelector((s) => s.project?.isKliveProject);
  const buildRoots = useSelector((s) => s.project?.buildRoots ?? EMPTY_ARRAY);
  const hasExcludedItems = useSelector((s) => s.project?.excludedItems?.length > 0);
  const isWindows = !!store.getState().isWindows;

  // --- State and helpers for the selected node's context menu
  const [selectedContextNode, setSelectedContextNode] = useState<ITreeNode<ProjectNode>>(null);
  const [contextInfo, setContextInfo] = useState<FileTypeEditor>();
  const selectedContextNodeIsFolder = selectedContextNode?.data?.isFolder ?? false;
  const selectedNodeIsProjectFile =
    !!selectedContextNode &&
    !selectedContextNode?.data.isFolder &&
    selectedContextNode?.data.name === PROJECT_FILE &&
    selectedContextNode?.level === 1;
  const selectedNodeIsRoot = !selectedContextNode?.parentNode;
  const selectedNodeIsBuildRoot = selectedContextNode
    ? buildRoots.indexOf(selectedContextNode.data.projectPath) >= 0
    : false;

  // --- Is the screen dimmed?
  const dimmed = useSelector((s) => s.dimMenu);

  // --- APIs used to manage the tree view
  const vlApi = useRef<VListHandle>();

  const explorerViewVersion = useSelector((s) => s.ideView?.explorerViewVersion);
  const {
    refreshTree,
    rememberExpandedItems,
    selected,
    setSelected,
    tree,
    visibleNodes
  } = useExplorerTree({
    excludedItems,
    explorerViewVersion,
    folderPath,
    mainApi,
    projectService,
    store
  });

  // --- Let's use this context menu when clicking a project tree node
  const [contextMenuState, contextMenuApi] = useContextMenuState();
  const contextMenu = (
    <ExplorerContextMenu
      appServices={appServices}
      contextInfo={contextInfo}
      isKliveProject={isKliveProject}
      isWindows={isWindows}
      onClickOutside={contextMenuApi.conceal}
      onCollapseAll={() => {
        selectedContextNode.collapseAll();
        refreshTree();
      }}
      onConceal={contextMenuApi.conceal}
      onDelete={() => setIsDeleteDialogOpen(true)}
      onExclude={async () => {
        await ideCommandsService.executeCommand(`p:x "${selectedContextNode.data.projectPath}"`);
      }}
      onExpandAll={() => {
        selectedContextNode.expandAll();
        refreshTree();
      }}
      onNewFile={() => {
        setNewItemIsFolder(false);
        setIsNewItemDialogOpen(true);
      }}
      onNewFolder={() => {
        setNewItemIsFolder(true);
        setIsNewItemDialogOpen(true);
      }}
      onRefresh={async () => {
        clearExplorerFolderCache();
        store.dispatch(incExploreViewVersionAction());
        // Reload all open documents after refreshing the folder
        await reloadAllOpenDocuments();
      }}
      onRename={() => setIsRenameDialogOpen(true)}
      onReveal={() => mainApi.showItemInFolder(selectedContextNode.data.fullPath)}
      onToggleBuildRoot={async () => {
        dispatch(setBuildRootAction([selectedContextNode.data.projectPath], !selectedNodeIsBuildRoot));
        await saveProject(messenger);
      }}
      selectedContextNode={selectedContextNode}
      selectedContextNodeIsFolder={selectedContextNodeIsFolder}
      selectedNodeIsBuildRoot={selectedNodeIsBuildRoot}
      selectedNodeIsProjectFile={selectedNodeIsProjectFile}
      selectedNodeIsRoot={selectedNodeIsRoot}
      state={contextMenuState}
      store={store}
    />
  );

  // --- Rename dialog box to display
  const renameDialog = isRenameDialogOpen && (
    <RenameDialog
      isFolder={selectedContextNodeIsFolder}
      oldPath={selectedContextNode?.data?.name}
      onRename={async (newName: string) => {
        await renameExplorerNode({
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
        });
      }}
      onClose={() => {
        setIsRenameDialogOpen(false);
      }}
    />
  );

  // --- Delete dialog box to display
  const deleteDialog = isDeleteDialogOpen && (
    <DeleteDialog
      isFolder={selectedContextNodeIsFolder}
      entry={selectedContextNode.data.fullPath}
      onDelete={async () => {
        await deleteExplorerNode({
          mainApi,
          projectService,
          refreshTree,
          selectedContextNode,
          selectedContextNodeIsFolder
        });
      }}
      onClose={() => {
        setIsDeleteDialogOpen(false);
      }}
    />
  );

  // --- New item dialog to display
  const newItemDialog = isNewItemDialogOpen && (
    <NewItemDialog
      isFolder={newItemIsFolder}
      path={selectedContextNode?.data?.name}
      itemNames={(selectedContextNode.children ?? []).map((item) => item.data.name)}
      onAdd={async (newName: string) => {
        await addExplorerItem({
          ideCommandsService,
          mainApi,
          newItemIsFolder,
          newName,
          projectService,
          refreshTree,
          selectedContextNode,
          setSelected,
          store,
          tree
        });
      }}
      onClose={() => {
        setIsNewItemDialogOpen(false);
      }}
    />
  );

  // --- This function represents a project item component
  const projectItemRenderer = (idx: number) => {
    const node = tree.getViewNodeByIndex(idx);
    if (!node) {
      // --- This should not happen
      return <div style={{ display: "none" }}></div>;
    }
    const isSelected = idx === selected;
    const isRoot = tree.rootNode === node;
    return (
      <ExplorerProjectItem
        canShowExcludedItems={hasExcludedItems}
        focused={isFocused}
        isBuildRoot={buildRoots.indexOf(node.data.projectPath) >= 0}
        isKliveProject={isKliveProject}
        isRoot={isRoot}
        isSelected={isSelected}
        node={node}
        tabIndex={idx}
        onContextMenu={(e: MouseEvent, node) => {
          setSelectedContextNode(node);
          setContextInfo(getFileTypeEntry(node?.data?.fullPath, store));
          contextMenuApi.show(e);
        }}
        onSelect={() => setSelected(idx)}
        onActivate={async () => {
          node.isExpanded = !node.isExpanded;
          refreshTree();
          rememberExpandedItems();

          if (!node.data.isFolder) {
            await ideCommandsService.executeCommand(`nav "${node.data.fullPath}"`);
          }
        }}
        onDoubleClick={async () => {
          if (node.data.isFolder) return;
          if (documentHubService.isOpen(node.data.fullPath)) {
            await documentHubService.setActiveDocument(node.data.fullPath);
            projectService.setPermanent(node.data.fullPath);
          } else {
            await ideCommandsService.executeCommand(`nav "${node.data.fullPath}"`);
          }
        }}
        onExcludedItemsClick={() => dispatch(displayDialogAction(EXCLUDED_PROJECT_ITEMS_DIALOG))}
      />
    );
  };

  // --- Reload all open documents in all document hubs
  const reloadAllOpenDocuments = async () => {
    const documentHubs = projectService.getDocumentHubServiceInstances();
    for (const hub of documentHubs) {
      const openDocs = hub.getOpenDocuments();
      for (const doc of openDocs) {
        if (doc.path) {
          // Only reload if document has no unsaved changes
          const hasUnsavedChanges =
            doc.editVersionCount !== undefined &&
            doc.savedVersionCount !== undefined &&
            doc.editVersionCount !== doc.savedVersionCount;
          if (!hasUnsavedChanges) {
            await hub.reloadDocument(doc.id);
          }
        }
      }
    }
  };

  // --- Render the Explorer panel
  return folderPath ? (
    visibleNodes && visibleNodes.length > 0 ? (
      <div
        className={styles.explorerPanel}
        tabIndex={0}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onClick={() => {}}
      >
        {contextMenu}
        {renameDialog}
        {deleteDialog}
        {newItemDialog}

        <VirtualizedList
          items={visibleNodes}
          apiLoaded={(api) => (vlApi.current = api)}
          renderItem={(idx) => projectItemRenderer(idx)}
        />
      </div>
    ) : null
  ) : (
    <ExplorerEmptyState
      dimmed={dimmed}
      onCreateProject={() => dispatch(displayDialogAction(NEW_PROJECT_DIALOG))}
      onOpenFolder={async () => await mainApi.openFolder()}
    />
  );
};
