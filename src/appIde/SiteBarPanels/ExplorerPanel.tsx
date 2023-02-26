import styles from "./ExplorerPanel.module.scss";
import { useRendererContext, useSelector } from "@/core/RendererProvider";
import { ITreeNode, ITreeView, TreeNode } from "@/core/tree-node";
import { MainGetDirectoryContentResponse } from "@messaging/any-to-main";
import { MouseEvent, useEffect, useRef, useState } from "react";
import {
  buildProjectTree,
  compareProjectNode,
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
import { ModalApi } from "@/controls/Modal";
import { Button } from "@/controls/Button";
import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuSeparator
} from "@/controls/ContextMenu";
import { RenameDialog } from "./RenameDialog";
import { DeleteDialog } from "./DeleteDialog";
import { NewItemDialog } from "./NewItemDialog";

const PROJECT_FILE_NAME = "klive.project";

const folderCache = new Map<string, ITreeView<ProjectNode>>();
let lastExplorerPath = "";

const ExplorerPanel = () => {
  const { messenger } = useRendererContext();
  const { projectService } = useAppServices();
  const [tree, setTree] = useState<ITreeView<ProjectNode>>(null);
  const [visibleNodes, setVisibleNodes] = useState<ITreeNode<ProjectNode>[]>(
    []
  );
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isNewItemDialogOpen, setIsNewItemDialogOpen] = useState(false);
  const [newItemIsFolder, setNewItemIsFolder] = useState(false);

  const [selected, setSelected] = useState(-1);
  const [isFocused, setIsFocused] = useState(false);

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
    selectedContextNode?.data.name === PROJECT_FILE_NAME &&
    selectedContextNode?.level === 1;
  const selectedNodeIsRoot = !selectedContextNode?.parentNode;

  // --- Information about a project (Is any project open? Is it a Klive project?)
  const folderPath = useSelector(s => s.project?.folderPath);
  const isKliveProject = useSelector(s => s.project?.isKliveProject);

  // --- APIs used to manage the tree view
  const svApi = useRef<ScrollViewerApi>();
  const vlApi = useRef<VirtualizedListApi>();

  // --- API to manage dialogs
  const modalApi = useRef<ModalApi>();

  const refreshTree = () => {
    tree.buildIndex();
    setVisibleNodes(tree.getVisibleNodes());
    vlApi.current.refresh();
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
        </ContextMenu>

        {isRenameDialogOpen && (
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
              if (response.type === "ErrorResponse") {
                await messenger.sendMessage({
                  type: "MainDisplayMessageBox",
                  messageType: "error",
                  title: "Rename Error",
                  message: response.message
                });
              } else {
                // --- Succesfully renamed
                selectedContextNode.data.fullPath = newFullName;
                selectedContextNode.data.name = newName;
                selectedContextNode.parentNode.sortChildren((a, b) =>
                  compareProjectNode(a.data, b.data)
                );
                refreshTree();
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
        )}

        {isDeleteDialogOpen && (
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
              }
            }}
            onClose={() => {
              setIsDeleteDialogOpen(false);
            }}
          />
        )}

        {isNewItemDialogOpen && (
          <NewItemDialog
            isFolder={newItemIsFolder}
            path={selectedContextNode?.data?.name}
            itemNames={(selectedContextNode.children ?? []).map(
              item => item.data.name
            )}
            onAdd={async (newName: string) => {
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
                // --- Succesfully deleted
                const newNode = new TreeNode({
                  isFolder: newItemIsFolder,
                  name: newName,
                  fullPath: `${selectedContextNode.data.fullPath}/${newName}`
                });
                selectedContextNode.insertAndSort(newNode, (a, b) =>
                  compareProjectNode(a.data, b.data)
                );
                refreshTree();
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
        )}

        <VirtualizedListView
          items={visibleNodes}
          approxSize={20}
          fixItemHeight={false}
          svApiLoaded={api => (svApi.current = api)}
          vlApiLoaded={api => (vlApi.current = api)}
          getItemKey={index => tree.getViewNodeByIndex(index).data.fullPath}
          itemRenderer={idx => {
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
                }}
              >
                <div
                  className={styles.indent}
                  style={{ width: (node.level + 1) * 16 }}
                ></div>
                {node.data.isFolder && (
                  <Icon
                    iconName={
                      node.isExpanded ? "chevron-down" : "chevron-right"
                    }
                    width={16}
                    height={16}
                    fill={
                      isSelected
                        ? "--color-chevron-selected"
                        : "--color-chevron"
                    }
                  />
                )}
                {!node.data.isFolder && (
                  <Icon
                    iconName='file-code'
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
              </div>
            );
          }}
        />
      </div>
    ) : null
  ) : (
    <>
      <div className={styles.noFolder}>You have not yet opened a folder.</div>
      <Button
        text='Open Folder'
        disabled={false}
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
