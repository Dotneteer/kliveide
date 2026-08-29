import styles from "./ExplorerPanel.module.scss";
import { useDispatch, useRendererContext, useSelector } from "@renderer/core/RendererProvider";
import { type ComponentProps, type KeyboardEvent, type MouseEvent, useEffect, useRef, useState } from "react";
import { getFileTypeEntry } from "@renderer/appIde/project/project-node";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { useContextMenuState } from "@controls/ContextMenu";
import { RenameDialog, RenameDialogResult } from "@renderer/appIde/dialogs/RenameDialog";
import { DeleteDialog } from "@renderer/appIde/dialogs/DeleteDialog";
import { NewItemDialog, NewItemDialogResult } from "@renderer/appIde/dialogs/NewItemDialog";
import {
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
import { useDialogs } from "@renderer/controls/overlay/DialogProvider";
import {
  ideDialogRegistry,
  IdeDialogResult
} from "@renderer/appIde/dialogs/ideDialogRegistry";
import { ExplorerProjectItem } from "./ExplorerProjectItem";
import { ExplorerEmptyState } from "./ExplorerEmptyState";
import { ExplorerContextMenu } from "./ExplorerContextMenu";
import { clearExplorerFolderCache, useExplorerTree } from "./useExplorerTree";
import {
  addExplorerItem,
  deleteExplorerNode,
  renameExplorerNode
} from "./explorerFileOperations";
import { handleExplorerKeyboardCommand } from "./explorerKeyboard";

export const ExplorerPanel = () => {
  // --- Services used in this component
  const { store, messenger } = useRendererContext();
  const mainApi = useMainApi();
  const emuApi = useEmuApi();
  const dialogs = useDialogs();

  const dispatch = useDispatch();
  const appServices = useAppServices();
  const { projectService, ideCommandsService } = appServices;
  const documentHubService = projectService.getActiveDocumentHubService();

  const [isFocused, setIsFocused] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);

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
  const explorerPanelRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const vlApi = useRef<VListHandle>();

  const explorerViewVersion = useSelector((s) => s.ideView?.explorerViewVersion);
  const {
    refreshTree,
    rememberExpandedItems,
    selected,
    setSelected,
    setSelectedNode,
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

  useEffect(() => {
    setFocusedIndex((current) => {
      if (!visibleNodes.length) return -1;
      if (current >= 0 && current < visibleNodes.length) return current;
      return selected >= 0 && selected < visibleNodes.length ? selected : 0;
    });
  }, [selected, visibleNodes.length]);

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
      onDelete={() => openDeleteDialog()}
      onExclude={async () => {
        await ideCommandsService.executeCommand(`p:x "${selectedContextNode.data.projectPath}"`);
      }}
      onExpandAll={() => {
        selectedContextNode.expandAll();
        refreshTree();
      }}
      onNewFile={() => openNewItemDialog(false)}
      onNewFolder={() => openNewItemDialog(true)}
      onRefresh={async () => {
        clearExplorerFolderCache();
        store.dispatch(incExploreViewVersionAction());
        // Reload all open documents after refreshing the folder
        await reloadAllOpenDocuments();
      }}
      onRename={() => openRenameDialog()}
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

  const setSelectedNodeContext = (node: ITreeNode<ProjectNode>): void => {
    setSelectedContextNode(node);
    setContextInfo(getFileTypeEntry(node?.data?.fullPath, store));
  };

  const focusExplorerPanel = (): void => {
    // File activation can focus the editor; return focus so tree navigation can continue.
    explorerPanelRef.current?.focus();
    setTimeout(() => explorerPanelRef.current?.focus(), 0);
  };

  const focusExplorerItem = (index: number): void => {
    if (index < 0) {
      focusExplorerPanel();
      return;
    }

    setFocusedIndex(index);
    vlApi.current?.scrollToIndex(index, { align: "nearest" });
    focusExplorerItemElement(index);
    setTimeout(() => focusExplorerItemElement(index), 0);
  };

  const focusExplorerItemElement = (index: number): void => {
    const item = itemRefs.current.get(index);
    if (item) {
      item.focus();
    } else {
      explorerPanelRef.current?.focus();
    }
  };

  const activateExplorerNode = async (
    node: ITreeNode<ProjectNode>,
    restoreFocusIndex = focusedIndex
  ): Promise<void> => {
    if (node.data.isFolder) {
      node.isExpanded = !node.isExpanded;
      refreshTree();
      rememberExpandedItems();
      return;
    }

    const openDocument = documentHubService.getDocument(node.data.fullPath);
    if (openDocument) {
      await documentHubService.setActiveDocument(openDocument.id);
    } else {
      const newDocument = await projectService.getDocumentForProjectNode(node.data);
      await documentHubService.openDocument(newDocument, undefined, true);
    }
    focusExplorerItem(restoreFocusIndex);
  };

  const handleTreeKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const handled = handleExplorerKeyboardCommand({
      focusedIndex,
      key: event.key,
      visibleNodes,
      onDelete: (node) => {
        setSelectedNodeContext(node);
        openDeleteDialog(node);
      },
      onLeafActivate: (node) => {
        void activateExplorerNode(node, focusedIndex);
      },
      onRememberExpandedItems: rememberExpandedItems,
      onFocusChange: focusExplorerItem,
      onSelectionChange: setSelected,
      onTreeChanged: refreshTree
    });

    if (handled) {
      event.preventDefault();
    }
  };

  const openRenameDialog = (node = selectedContextNode): void => {
    if (!node) return;
    const nodeIsFolder = node.data?.isFolder ?? false;
    const oldPath = node.data?.name;
    void (async () => {
      const result = await dialogs.open<RenameDialogResult, Omit<ComponentProps<typeof RenameDialog>, "controls">>(
        RenameDialog,
        {
          isFolder: nodeIsFolder,
          oldPath
        },
        { title: nodeIsFolder ? "Rename folder" : "Rename file", width: 500 }
      );
      if (!result) return;
      await renameExplorerNode({
        buildRoots,
        dispatch,
        emuApi,
        mainApi,
        newName: result.name,
        projectService,
        refreshTree,
        selectedContextNode: node,
        setSelectedNode
      });
    })();
  };

  const openDeleteDialog = (node = selectedContextNode): void => {
    if (!node) return;
    const nodeIsFolder = node.data?.isFolder ?? false;
    void (async () => {
      const confirmed = await dialogs.open<true, Omit<ComponentProps<typeof DeleteDialog>, "controls">>(
        DeleteDialog,
        { isFolder: nodeIsFolder, entry: node.data.projectPath },
        {
          title: nodeIsFolder ? "Delete folder" : "Delete file",
          width: 500,
          dialogRole: "alertdialog",
          closeOnOutsideClick: false
        }
      );
      if (!confirmed) return;
      await deleteExplorerNode({
        mainApi,
        projectService,
        refreshTree,
        selectedContextNode: node,
        selectedContextNodeIsFolder: nodeIsFolder
      });
    })();
  };

  const openNewItemDialog = (newItemIsFolder: boolean, node = selectedContextNode): void => {
    if (!node) return;
    const itemNames = (node.children ?? []).map((item) => item.data.name);
    void (async () => {
      const result = await dialogs.open<NewItemDialogResult, Omit<ComponentProps<typeof NewItemDialog>, "controls">>(
        NewItemDialog,
        { isFolder: newItemIsFolder, path: node.data?.name, itemNames },
        { title: `Add new ${newItemIsFolder ? "folder" : "file"}`, width: 500 }
      );
      if (!result) return;
      await addExplorerItem({
        ideCommandsService,
        mainApi,
        newItemIsFolder,
        newName: result.name,
        projectService,
        refreshTree,
        selectedContextNode: node,
        setSelectedNode,
        store
      });
    })();
  };

  const openIdeDialog = (dialogId: number): void => {
    const dialogRenderer = ideDialogRegistry[dialogId];
    if (!dialogRenderer) return;
    void dialogs.open<IdeDialogResult>((controls) => dialogRenderer(controls));
  };

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
        itemRef={(element) => {
          if (element) {
            itemRefs.current.set(idx, element);
          } else {
            itemRefs.current.delete(idx);
          }
        }}
        isBuildRoot={buildRoots.indexOf(node.data.projectPath) >= 0}
        isKliveProject={isKliveProject}
        isRoot={isRoot}
        isSelected={isSelected}
        node={node}
        tabIndex={idx === focusedIndex ? 0 : -1}
        onContextMenu={(e: MouseEvent, node) => {
          setSelectedNodeContext(node);
          contextMenuApi.show(e);
        }}
        onSelect={() => {
          setFocusedIndex(idx);
          setSelected(idx);
        }}
        onFocus={() => setFocusedIndex(idx)}
        onActivate={() => activateExplorerNode(node, idx)}
        onDoubleClick={async () => {
          if (node.data.isFolder) return;
          if (documentHubService.isOpen(node.data.fullPath)) {
            await documentHubService.setActiveDocument(node.data.fullPath);
            projectService.setPermanent(node.data.fullPath);
          } else {
            await ideCommandsService.executeCommand(`nav "${node.data.fullPath}"`);
          }
          focusExplorerItem(idx);
        }}
        onExcludedItemsClick={() => openIdeDialog(EXCLUDED_PROJECT_ITEMS_DIALOG)}
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
        ref={explorerPanelRef}
        className={styles.explorerPanel}
        tabIndex={0}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onKeyDown={handleTreeKeyDown}
        onClick={() => {}}
      >
        {contextMenu}

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
      onCreateProject={() => openIdeDialog(NEW_PROJECT_DIALOG)}
      onOpenFolder={async () => {
        await mainApi.openFolder();
      }}
    />
  );
};
