import styles from "./ExplorerPanel.module.scss";
import {
  useDispatch,
  useRendererContext,
  useSelector
} from "@/core/RendererProvider";
import { ITreeNode, ITreeView, TreeNode } from "@/core/tree-node";
import {
  MainGetDirectoryContentResponse,
  TextContentsResponse
} from "@messaging/any-to-main";
import { MouseEvent, useEffect, useRef, useState } from "react";
import {
  buildProjectTree,
  compareProjectNode,
  getFileTypeEntry,
  getNodeDir,
  ProjectNode
} from "../project/project-node";
import { VirtualizedListView } from "@/controls/VirtualizedListView";
import { Icon } from "@/controls/Icon";
import { ScrollViewerApi } from "@/controls/ScrollViewer";
import { VirtualizedListApi } from "@/controls/VirtualizedList";
import { LabelSeparator } from "@/controls/Labels";
import classnames from "@/utils/classnames";
import { useAppServices } from "../services/AppServicesProvider";
import { Button } from "@/controls/Button";
import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuSeparator
} from "@/controls/ContextMenu";
import { RenameDialog } from "../dialogs/RenameDialog";
import { DeleteDialog } from "../dialogs/DeleteDialog";
import { NewItemDialog } from "../dialogs/NewItemDialog";
import { CodeDocumentState } from "../services/DocumentService";
import {
  incDocumentActivationVersionAction,
  setBuildRootAction
} from "@common/state/actions";
import { PROJECT_FILE } from "@common/structs/project-const";
import { SpaceFiller } from "@/controls/SpaceFiller";

const folderCache = new Map<string, ITreeView<ProjectNode>>();
let lastExplorerPath = "";

const ExplorerPanel = () => {
  // --- Services used in this component
  const { messenger } = useRendererContext();
  const dispatch = useDispatch();
  const { projectService, documentService } = useAppServices();

  // --- The state representing the project tree
  const [tree, setTree] = useState<ITreeView<ProjectNode>>(null);
  const [visibleNodes, setVisibleNodes] = useState<ITreeNode<ProjectNode>[]>(
    []
  );

  // --- Visibility of dialogs
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isNewItemDialogOpen, setIsNewItemDialogOpen] = useState(false);
  const [newItemIsFolder, setNewItemIsFolder] = useState(false);

  const [selected, setSelected] = useState(-1);
  const [isFocused, setIsFocused] = useState(false);

  // --- Information about a project (Is any project open? Is it a Klive project?)
  const folderPath = useSelector(s => s.project?.folderPath);
  const isKliveProject = useSelector(s => s.project?.isKliveProject);
  const buildRoots = useSelector(s => s.project?.buildRoots ?? []);

  // --- State and helpers for the selected node's context menu
  const contextRef = useRef<HTMLElement>(document.getElementById("appMain"));
  const [contextVisible, setContextVisible] = useState(false);
  const [contextX, setContextX] = useState(0);
  const [contextY, setContextY] = useState(0);
  const [selectedContextNode, setSelectedContextNode] =
    useState<ITreeNode<ProjectNode>>(null);
  const selectedContextNodeIsFolder =
    selectedContextNode?.data?.isFolder ?? false;
  const selectedNodeIsProjectFile =
    selectedContextNode &&
    !selectedContextNode?.data.isFolder &&
    selectedContextNode?.data.name === PROJECT_FILE &&
    selectedContextNode?.level === 1;
  const selectedNodeIsRoot = !selectedContextNode?.parentNode;
  const selectedNodeIsBuildRoot = selectedContextNode
    ? buildRoots.indexOf(selectedContextNode.data.fullPath) >= 0
    : false;

  // --- Is the screen dimmed?
  const dimmed = useSelector(s => s.dimMenu);

  // --- APIs used to manage the tree view
  const svApi = useRef<ScrollViewerApi>();
  const vlApi = useRef<VirtualizedListApi>();

  // --- This function refreshes the Explorer tree
  const refreshTree = () => {
    tree.buildIndex();
    setVisibleNodes(tree.getVisibleNodes());
    vlApi.current.refresh();
  };

  // --- Saves the current project
  const saveProject = async () => {
    await new Promise(r => setTimeout(r, 100));
    await messenger.sendMessage({ type: "MainSaveProject" });
  };

  // --- Let's use this context menu when clicking a project tree node
  const contextMenu = (
    <ContextMenu
      refElement={contextRef.current}
      isVisible={contextVisible}
      offsetX={contextX}
      offsetY={contextY}
      onClickAway={() => {
        setContextVisible(false);
      }}
    >
      {selectedContextNodeIsFolder && (
        <>
          <ContextMenuItem
            text='New file...'
            clicked={() => {
              setNewItemIsFolder(false);
              setIsNewItemDialogOpen(true);
            }}
          />
          <ContextMenuItem
            text='New folder...'
            clicked={() => {
              setNewItemIsFolder(true);
              setIsNewItemDialogOpen(true);
            }}
          />
          <ContextMenuSeparator />
          <ContextMenuItem
            text='Expand all'
            clicked={() => {
              selectedContextNode.expandAll();
              refreshTree();
            }}
          />
          <ContextMenuItem
            text='Collapse all'
            clicked={() => {
              selectedContextNode.collapseAll();
              refreshTree();
            }}
          />
          <ContextMenuSeparator />
        </>
      )}
      <ContextMenuItem
        text='Rename...'
        disabled={selectedNodeIsProjectFile || selectedNodeIsRoot}
        clicked={() => setIsRenameDialogOpen(true)}
      />
      <ContextMenuItem
        text='Delete'
        disabled={selectedNodeIsProjectFile || selectedNodeIsRoot}
        clicked={() => setIsDeleteDialogOpen(true)}
      />
      {selectedContextNode?.data.canBeBuildRoot && (
        <>
          <ContextMenuSeparator />
          <ContextMenuItem
            text={
              selectedNodeIsBuildRoot
                ? "Remove from Build Root"
                : "Promote to Build Root"
            }
            clicked={async () => {
              dispatch(
                setBuildRootAction(
                  selectedContextNode.data.fullPath,
                  !selectedNodeIsBuildRoot
                )
              );
              await saveProject();
            }}
          />
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
        const newFullName = `${getNodeDir(
          selectedContextNode.data.fullPath
        )}/${newName}`;
        const response = await messenger.sendMessage({
          type: "MainRenameFileEntry",
          oldName: selectedContextNode.data.fullPath,
          newName: newFullName
        });

        // --- Check for successful operation
        if (response.type === "ErrorResponse") {
          // --- Display an error message
          await messenger.sendMessage({
            type: "MainDisplayMessageBox",
            messageType: "error",
            title: "Rename Error",
            message: response.message
          });
        } else {
          // --- Succesfully renamed
          const oldId = selectedContextNode.data.fullPath;
          const fileTypeEntry = getFileTypeEntry(newFullName);
          selectedContextNode.data.icon = fileTypeEntry?.icon;

          // TODO: Manage editor type change
          // --- Change the properties of the renamed node
          selectedContextNode.data.fullPath = newFullName;
          selectedContextNode.data.name = newName;
          selectedContextNode.parentNode.sortChildren((a, b) =>
            compareProjectNode(a.data, b.data)
          );

          // --- Refresh the tree and notify other objects listening to a rename
          refreshTree();
          projectService.signItemRenamed(oldId, selectedContextNode);

          // --- Make sure the selected node is displayed
          const newIndex = tree.findIndex(selectedContextNode);
          if (newIndex >= 0) {
            setSelected(newIndex);
          }
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
        const response = await messenger.sendMessage({
          type: "MainDeleteFileEntry",
          isFolder: selectedContextNodeIsFolder,
          name: selectedContextNode.data.fullPath
        });

        if (response.type === "ErrorResponse") {
          // --- Delete failed
          await messenger.sendMessage({
            type: "MainDisplayMessageBox",
            messageType: "error",
            title: "Delete Error",
            message: response.message
          });
        } else {
          // --- Succesfully deleted
          selectedContextNode.parentNode.removeChild(selectedContextNode);
          refreshTree();
          projectService.signItemDeleted(selectedContextNode);
        }
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
      itemNames={(selectedContextNode.children ?? []).map(
        item => item.data.name
      )}
      onAdd={async (newName: string) => {
        // --- Expand the context node
        selectedContextNode.isExpanded = true;

        // --- Add the item
        const response = await messenger.sendMessage({
          type: "MainAddNewFileEntry",
          isFolder: newItemIsFolder,
          folder: selectedContextNode.data.fullPath,
          name: newName
        });

        if (response.type === "ErrorResponse") {
          // --- Delete failed
          await messenger.sendMessage({
            type: "MainDisplayMessageBox",
            messageType: "error",
            title: "Add new item error",
            message: response.message
          });
        } else {
          // --- Succesfully added
          const fileTypeEntry = getFileTypeEntry(newName);
          const newNode = new TreeNode<ProjectNode>({
            isFolder: newItemIsFolder,
            name: newName,
            fullPath: `${selectedContextNode.data.fullPath}/${newName}`
          });
          if (fileTypeEntry) {
            newNode.data.icon = fileTypeEntry.icon;
            newNode.data.editor = fileTypeEntry.editor;
            newNode.data.subType = fileTypeEntry.subType;
          }
          selectedContextNode.insertAndSort(newNode, (a, b) =>
            compareProjectNode(a.data, b.data)
          );
          refreshTree();
          projectService.signItemAdded(newNode);
          const newIndex = tree.findIndex(newNode);
          if (newIndex >= 0) {
            setSelected(newIndex);
          }
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
          setContextVisible(true);
          setContextX(e.nativeEvent.screenX);
          setContextY(
            e.nativeEvent.screenY - contextRef.current.offsetHeight - 20
          );
        }}
        onMouseDown={e => {
          if (e.button === 0) {
            setSelected(idx);
          }
        }}
        onClick={() => {
          node.isExpanded = !node.isExpanded;
          tree.buildIndex();
          setVisibleNodes(tree.getVisibleNodes());

          if (!node.data.isFolder) {
            if (documentService.isOpen(node.data.fullPath)) {
              documentService.setActiveDocument(node.data.fullPath);
            } else {
              getAndOpenDocument(node, true);
            }
          }
        }}
        onDoubleClick={() => {
          if (node.data.isFolder) return;
          if (documentService.isOpen(node.data.fullPath)) {
            documentService.setActiveDocument(node.data.fullPath);
            documentService.setPermanent(node.data.fullPath);
            dispatch(incDocumentActivationVersionAction());
          } else {
            getAndOpenDocument(node, false);
          }
        }}
      >
        <div
          className={styles.indent}
          style={{ width: (node.level + 1) * 16 }}
        ></div>
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
            fill='--fill-explorer-icon'
            width={16}
            height={16}
          />
        )}
        {isRoot && isKliveProject && (
          <Icon
            iconName='home'
            fill='--console-ansi-bright-magenta'
            width={16}
            height={16}
          />
        )}
        <LabelSeparator width={8} />
        <span className={styles.name}>{node.data.name}</span>
        <div className={styles.indent} style={{ width: 8 }}></div>
        <SpaceFiller />
        {!node.data.isFolder && buildRoots.indexOf(node.data.fullPath) >= 0 && (
          <div className={styles.rootBuilder}>
            <Icon
              iconName='combine'
              fill='--console-ansi-bright-green'
              width={16}
              height={16}
            />
          </div>
        )}
      </div>
    );
  };

  // --- Obtain document data and open the document
  const getAndOpenDocument = async (
    node: ITreeNode<ProjectNode>,
    isTemporary: boolean = true
  ): Promise<void> => {
    const docPath = node.data.fullPath;
    const response = (await messenger.sendMessage({
      type: "MainReadTextFile",
      path: docPath
    })) as TextContentsResponse;

    const data: CodeDocumentState = documentService.isOpen(docPath)
      ? documentService.getDocumentData(docPath)
      : {
          value: response.contents
        };

    documentService.openDocument(
      {
        id: node.data.fullPath,
        name: node.data.name,
        type: node.data.editor,
        language: node.data.subType,
        iconName: node.data.icon,
        isReadOnly: node.data.isReadOnly,
        node
      },
      data,
      isTemporary
    );
  };

  // --- Remove the last explorer tree from the cache when closing the folder
  useEffect(() => {
    const projectClosed = () => {
      if (lastExplorerPath) folderCache.delete(lastExplorerPath);
    };
    projectService.projectClosed.on(projectClosed);
    return () => {
      projectService.projectClosed.off(projectClosed);
    };
  }, [projectService]);

  // --- Get the current project tree when the project path changes
  useEffect(() => {
    (async () => {
      // --- No open folder
      if (!folderPath) {
        setSelected(-1);
        return;
      }

      // --- Check the cache for the folder
      lastExplorerPath = folderPath;
      const cachedTree = folderCache.get(folderPath);
      if (cachedTree) {
        // --- Folder tree found in the cache
        setTree(cachedTree);
        setVisibleNodes(cachedTree.getVisibleNodes());
        return;
      }

      // --- Read the folder tree
      const dir = (
        (await messenger.sendMessage({
          type: "MainGetDirectoryContent",
          directory: folderPath
        })) as MainGetDirectoryContentResponse
      ).contents;

      // --- Build the folder tree
      const projectTree = buildProjectTree(dir);
      setTree(projectTree);
      setVisibleNodes(projectTree.getVisibleNodes());
      folderCache.set(folderPath, projectTree);
    })();
  }, [folderPath]);

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

        <VirtualizedListView
          items={visibleNodes}
          approxSize={20}
          fixItemHeight={false}
          svApiLoaded={api => (svApi.current = api)}
          vlApiLoaded={api => (vlApi.current = api)}
          getItemKey={index => tree.getViewNodeByIndex(index).data.fullPath}
          itemRenderer={idx => projectItemRenderer(idx)}
        />
      </div>
    ) : null
  ) : (
    <>
      <div className={styles.noFolder}>You have not yet opened a folder.</div>
      <Button
        text='Open Folder'
        disabled={dimmed}
        spaceLeft={16}
        spaceRight={16}
        clicked={async () => {
          await messenger.sendMessage({
            type: "MainOpenFolder"
          });
        }}
      />
    </>
  );
};

export const explorerPanelRenderer = () => <ExplorerPanel />;
