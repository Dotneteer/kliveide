import styles from "./ExplorerPanel.module.scss";
import { useDispatch, useRendererContext, useSelector } from "@renderer/core/RendererProvider";
import { TreeNode } from "@renderer/core/tree-node";
import { MouseEvent, useEffect, useRef, useState } from "react";
import {
  buildProjectTree,
  compareProjectNode,
  getFileTypeEntry,
  getNodeDir
} from "../project/project-node";
import { Icon } from "@controls/Icon";
import { LabelSeparator } from "@controls/Labels";
import classnames from "classnames";
import { useAppServices } from "../services/AppServicesProvider";
import { Button } from "@controls/Button";
import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuSeparator,
  useContextMenuState
} from "@controls/ContextMenu";
import { RenameDialog } from "../dialogs/RenameDialog";
import { DeleteDialog } from "../dialogs/DeleteDialog";
import { NewItemDialog } from "../dialogs/NewItemDialog";
import {
  displayDialogAction,
  incExploreViewVersionAction,
  setBuildRootAction
} from "@state/actions";
import { PROJECT_FILE } from "@common/structs/project-const";
import { SpaceFiller } from "@controls/SpaceFiller";
import { EMPTY_ARRAY } from "@renderer/utils/stablerefs";
import { EXCLUDED_PROJECT_ITEMS_DIALOG, NEW_PROJECT_DIALOG } from "@common/messaging/dialog-ids";
import { saveProject } from "../utils/save-project";
import { FileTypeEditor } from "@renderer/abstractions/FileTypePattern";
import { ITreeView, ITreeNode } from "@abstractions/ITreeNode";
import { ProjectNode } from "@abstractions/ProjectNode";
import { useMainApi } from "@renderer/core/MainApi";
import { VirtualizedList } from "@renderer/controls/VirtualizedList";
import { VListHandle } from "virtua";
import { VStack } from "@renderer/controls/new/Panels";
import { useEmuApi } from "@renderer/core/EmuApi";

const folderCache = new Map<string, ITreeView<ProjectNode>>();
let lastExplorerPath = "";

const ExplorerPanel = () => {
  // --- Services used in this component
  const { store, messenger } = useRendererContext();
  const mainApi = useMainApi();
  const emuApi = useEmuApi();

  const dispatch = useDispatch();
  const appServices = useAppServices();
  const { projectService, ideCommandsService } = appServices;
  const documentHubService = projectService.getActiveDocumentHubService();

  // --- The state representing the project tree
  const [tree, setTree] = useState<ITreeView<ProjectNode>>(null);
  const [visibleNodes, setVisibleNodes] = useState<ITreeNode<ProjectNode>[]>([]);

  // --- Visibility of dialogs
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isNewItemDialogOpen, setIsNewItemDialogOpen] = useState(false);
  const [newItemIsFolder, setNewItemIsFolder] = useState(false);

  const [selected, setSelected] = useState(-1);
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
    selectedContextNode &&
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

  // --- State used for tree refresh
  const [lastExpanded, setLastExpanded] = useState<string[]>(null);
  const explorerViewVersion = useSelector((s) => s.ideView?.explorerViewVersion);

  // --- This function refreshes the Explorer tree
  const refreshTree = () => {
    tree.buildIndex();
    setVisibleNodes(tree.getVisibleNodes());
  };

  // --- Let's use this context menu when clicking a project tree node
  const [contextMenuState, contextMenuApi] = useContextMenuState();
  const contextMenu = (
    <ContextMenu state={contextMenuState} onClickOutside={contextMenuApi.conceal}>
      {selectedNodeIsRoot && (
        <>
          <ContextMenuItem
            text="Refresh"
            clicked={() => {
              contextMenuApi.conceal();
              folderCache.clear();
              store.dispatch(incExploreViewVersionAction());
            }}
          />
        </>
      )}
      {selectedContextNodeIsFolder && (
        <>
          <ContextMenuItem
            text="New file..."
            clicked={() => {
              contextMenuApi.conceal();
              setNewItemIsFolder(false);
              setIsNewItemDialogOpen(true);
            }}
          />
          <ContextMenuItem
            text="New folder..."
            clicked={() => {
              contextMenuApi.conceal();
              setNewItemIsFolder(true);
              setIsNewItemDialogOpen(true);
            }}
          />
          <ContextMenuSeparator />
          <ContextMenuItem
            text="Expand all"
            clicked={() => {
              contextMenuApi.conceal();
              selectedContextNode.expandAll();
              refreshTree();
            }}
          />
          <ContextMenuItem
            text="Collapse all"
            clicked={() => {
              contextMenuApi.conceal();
              selectedContextNode.collapseAll();
              refreshTree();
            }}
          />
          <ContextMenuSeparator />
        </>
      )}
      <ContextMenuItem
        text={`Reveal in ${isWindows ? "File Explorer" : "Finder"}`}
        disabled={!selectedContextNode?.data.fullPath}
        clicked={() => {
          contextMenuApi.conceal();
          mainApi.showItemInFolder(selectedContextNode.data.fullPath);
        }}
      />
      <ContextMenuSeparator />
      <ContextMenuItem
        text="Rename..."
        disabled={selectedNodeIsProjectFile || selectedNodeIsRoot}
        clicked={() => {
          contextMenuApi.conceal();
          setIsRenameDialogOpen(true);
        }}
      />
      <ContextMenuItem
        text="Exclude"
        disabled={selectedNodeIsProjectFile || selectedNodeIsRoot || !isKliveProject}
        clicked={async () => {
          contextMenuApi.conceal();
          await ideCommandsService.executeCommand(`p:x "${selectedContextNode.data.projectPath}"`);
        }}
      />
      <ContextMenuItem
        dangerous={true}
        text="Delete"
        disabled={selectedNodeIsProjectFile || selectedNodeIsRoot}
        clicked={() => {
          contextMenuApi.conceal();
          setIsDeleteDialogOpen(true);
        }}
      />
      {selectedContextNode?.data.canBeBuildRoot && (
        <>
          <ContextMenuSeparator />
          <ContextMenuItem
            text={selectedNodeIsBuildRoot ? "Demote from Build Root" : "Promote to Build Root"}
            clicked={async () => {
              contextMenuApi.conceal();
              dispatch(
                setBuildRootAction([selectedContextNode.data.projectPath], !selectedNodeIsBuildRoot)
              );
              await saveProject(messenger);
            }}
            disabled={!isKliveProject}
          />
        </>
      )}
      {contextInfo?.contextMenuInfo && (
        <>
          <ContextMenuSeparator />
          {contextInfo?.contextMenuInfo?.(appServices).map((item, index) => {
            return item.separator ? (
              <ContextMenuSeparator />
            ) : (
              <ContextMenuItem
                key={index}
                dangerous={item.dangerous}
                text={item.text}
                disabled={item.disabled?.(store, selectedContextNode.data?.fullPath)}
                clicked={() => item?.clicked(selectedContextNode?.data?.fullPath)}
              />
            );
          })}
        </>
      )}
    </ContextMenu>
  );

  // --- Rename dialog box to display
  const renameDialog = isRenameDialogOpen && (
    <RenameDialog
      isFolder={selectedContextNodeIsFolder}
      oldPath={selectedContextNode?.data?.name}
      onRename={async (newName: string) => {
        // --- Start renaming the item
        const newFullName = `${getNodeDir(selectedContextNode.data.fullPath)}/${newName}`;
        await projectService.performAllDelayedSavesNow();

        // --- Check if the item was a build root
        const oldProjectFolder = getNodeDir(selectedContextNode.data.projectPath);
        const wasBuildRoot = buildRoots.indexOf(selectedContextNode.data.projectPath) >= 0;
        try {
          await mainApi.renameFileEntry(selectedContextNode.data.fullPath, newFullName);
          projectService.renameDocument(selectedContextNode.data.fullPath, newFullName);

          // --- Rename breakpoints
          const oldResource = selectedContextNode.data.projectPath;
          const oldProjectPath = getNodeDir(oldResource);
          const newResource = oldProjectPath ? `${oldProjectPath}/${newName}` : newName;
          await emuApi.renameBreakpoints(oldResource, newResource);

          if (wasBuildRoot) {
            const newProjectPath = oldProjectFolder ? `${oldProjectFolder}/${newName}` : newName;
            dispatch(setBuildRootAction([newProjectPath], true));
            await mainApi.saveProject();
          }

          // --- Refresh the tree and notify other objects listening to a rename
          refreshTree();

          // --- Make sure the selected node is displayed
          const newIndex = tree.findIndex(selectedContextNode);
          if (newIndex >= 0) {
            setSelected(newIndex);
          }
        } catch (err) {
          await mainApi.displayMessageBox("error", "Rename Error", err.toString());
        }
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
        // --- Delete the item
        await mainApi.deleteFileEntry(
          selectedContextNodeIsFolder,
          selectedContextNode.data.fullPath
        );

        // --- Succesfully deleted
        selectedContextNode.parentNode.removeChild(selectedContextNode);
        refreshTree();
        projectService.signItemDeleted(selectedContextNode);

        // --- Check if build root should be deleted
        await mainApi.checkBuildRoot(selectedContextNode.data.projectPath);
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
        // --- Expand the context node
        selectedContextNode.isExpanded = true;

        // --- Add the item
        try {
          await mainApi.addNewFileEntry(
            newName,
            newItemIsFolder,
            selectedContextNode.data.fullPath
          );

          // --- Succesfully added
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

          setTimeout(async () => {
            if (!newNode.data.isFolder) {
              await ideCommandsService.executeCommand(`nav "${newNode.data.fullPath}"`);
            }
          }, 600);
        } catch (err) {
          await mainApi.displayMessageBox("error", "Add new item error", err.toString());
        }
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
      <div
        className={classnames(styles.item, {
          [styles.selected]: isSelected,
          [styles.focused]: isFocused
        })}
        tabIndex={idx}
        onContextMenu={(e: MouseEvent) => {
          setSelectedContextNode(node);
          setContextInfo(getFileTypeEntry(node?.data?.fullPath, store));
          contextMenuApi.show(e);
        }}
        onMouseDown={(e) => {
          if (e.button === 0) {
            setSelected(idx);
          }
        }}
        onClick={async () => {
          node.isExpanded = !node.isExpanded;
          tree.buildIndex();
          setVisibleNodes(tree.getVisibleNodes());
          setLastExpanded(getExpandedItems(tree.rootNode));

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
      >
        <div className={styles.indent} style={{ width: (node.level + 1) * 16 }}></div>
        {node.data.isFolder && (
          <Icon
            iconName={node.isExpanded ? "chevron-down" : "chevron-right"}
            width={16}
            height={16}
            fill={isSelected ? "--color-chevron-selected" : "--color-chevron"}
          />
        )}
        {!node.data.isFolder && (
          <Icon
            iconName={node.data.icon ?? "file-code"}
            fill={node.data.iconFill ?? "--fill-explorer-icon"}
            width={16}
            height={16}
          />
        )}
        {isRoot && isKliveProject && (
          <Icon iconName="home" fill="--console-ansi-bright-magenta" width={16} height={16} />
        )}
        <LabelSeparator width={8} />
        <span className={styles.name}>{node.data.name}</span>
        <div className={styles.indent} style={{ width: 8 }}></div>
        <SpaceFiller />
        {isRoot && isKliveProject && hasExcludedItems && (
          <div
            className={styles.iconRight}
            onClick={(e) => {
              e.stopPropagation();
              dispatch(displayDialogAction(EXCLUDED_PROJECT_ITEMS_DIALOG));
            }}
          >
            <Icon xclass={styles.actionButton} iconName="exclude" width={16} height={16} />
          </div>
        )}
        {!node.data.isFolder && buildRoots.indexOf(node.data.projectPath) >= 0 && (
          <div className={styles.iconRight}>
            <Icon iconName="combine" fill="--console-ansi-bright-green" width={16} height={16} />
          </div>
        )}
      </div>
    );
  };

  const refreshProjectFolder = async (useCache: boolean) => {
    // --- No open folder
    if (!folderPath) {
      setSelected(-1);
      return;
    }

    // --- Check the cache for the folder
    lastExplorerPath = folderPath;
    const cachedTree = folderCache.get(folderPath);
    if (cachedTree && useCache) {
      // --- Folder tree found in the cache
      setTree(cachedTree);
      setVisibleNodes(cachedTree.getVisibleNodes());
      projectService.setProjectTree(cachedTree);
      return;
    }

    // --- Read the folder tree
    const contents = await mainApi.getDirectoryContent(folderPath);

    // --- Build the folder tree
    const projectTree = buildProjectTree(contents, store, lastExpanded);
    setTree(projectTree);
    setVisibleNodes(projectTree.getVisibleNodes());
    projectService.setProjectTree(projectTree);
    folderCache.set(folderPath, projectTree);
  };

  // --- Set up the project service to handle project events
  useEffect(() => {
    // --- Remove the last explorer tree from the cache when closing the folder
    const projectClosed = () => {
      if (lastExplorerPath) folderCache.delete(lastExplorerPath);
    };

    // --- Close deleted items in all document hubs
    const itemDeleted = (node: ITreeNode<ProjectNode>) => {
      const docId = node.data.fullPath;
      const deletedDoc = projectService.getDocumentById(docId);
      if (deletedDoc?.usedIn) {
        deletedDoc.usedIn.forEach((docHub) => docHub.closeDocument(docId));
      }
    };

    // --- Rename the renamed item in all document hubs
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

  // --- Get the current project tree when the project path changes
  useEffect(() => {
    (async () => {
      refreshProjectFolder(true);
    })();
  }, [folderPath, excludedItems, explorerViewVersion]);

  // --- Get the current project tree when file system changes
  useEffect(() => {
    (async () => {
      refreshProjectFolder(false);
    })();
  }, [explorerViewVersion]);

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
    <VStack>
      <div className={styles.noFolder}>You have not yet opened a folder.</div>
      <Button
        text="Open Folder"
        disabled={dimmed}
        spaceLeft={16}
        spaceRight={16}
        clicked={async () => await mainApi.openFolder()}
      />
      <div className={styles.noFolder}>or</div>
      <Button
        text="Create a Klive Project"
        disabled={dimmed}
        spaceLeft={16}
        spaceRight={16}
        clicked={async () => {
          dispatch(displayDialogAction(NEW_PROJECT_DIALOG));
        }}
      />
    </VStack>
  );
};

function getExpandedItems(root: ITreeNode<ProjectNode>): string[] {
  const result: string[] = [];
  getExpandedItemsRecursive(root, result);
  return result;

  function getExpandedItemsRecursive(node: ITreeNode<ProjectNode>, results: string[]) {
    if (node.isExpanded && node.data.isFolder) {
      result.push(node.data.projectPath);
      node.children.forEach((child) => getExpandedItemsRecursive(child, results));
    }
  }
}

export const explorerPanelRenderer = () => <ExplorerPanel />;
