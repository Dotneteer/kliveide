import styles from "./ExplorerPanel.module.scss";
import { useRendererContext, useSelector } from "@/core/RendererProvider";
import { ITreeNode, ITreeView } from "@/core/tree-node";
import { MainGetDirectoryContentResponse } from "@messaging/any-to-main";
import { MouseEvent, useEffect, useRef, useState } from "react";
import { buildProjectTree, ProjectNode } from "../project/project-node";
import { VirtualizedListView } from "@/controls/VirtualizedListView";
import { Icon } from "@/controls/Icon";
import { ScrollViewerApi } from "@/controls/ScrollViewer";
import { VirtualizedListApi } from "@/controls/VirtualizedList";
import { LabelSeparator } from "@/controls/Labels";
import classnames from "@/utils/classnames";
import { useAppServices } from "../services/AppServicesProvider";
import { Modal, ModalApi } from "@/controls/Modal";
import { Button } from "@/controls/Button";
import { TextInput } from "@/controls/TextInput";
import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuSeparator
} from "@/controls/ContextMenu";

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
  const [isNewItemDialogOpen, setIsNewItemDialogOpen] = useState(false);

  const [selected, setSelected] = useState(-1);
  const [isFocused, setIsFocused] = useState(false);

  // --- State and helpers for the selected node's context menu
  const contextRef = useRef<HTMLElement>(document.getElementById("appMain"));
  const [contextVisible, setContextVisible] = useState(false);
  const [selectedContextItem, setSelectedContextItem] = useState(-1);
  const [contextX, setContextX] = useState(0);
  const [contextY, setContextY] = useState(0);
  const selectedContextNode =
    selectedContextItem >= 0 && tree
      ? tree.getViewNodeByIndex(selectedContextItem)
      : null;
  
  const selectedContextNodeIsFolder =
    selectedContextNode?.data?.isFolder ?? false;

  // --- Information about a project (Is any project open? Is it a Klive project?)
  const folderPath = useSelector(s => s.project?.folderPath);
  const isKliveProject = useSelector(s => s.project?.isKliveProject);

  // --- APIs used to manage the tree view
  const svApi = useRef<ScrollViewerApi>();
  const vlApi = useRef<VirtualizedListApi>();

  // --- API to manage dialogs
  const modalApi = useRef<ModalApi>();

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
            setSelectedContextItem(-1);
          }}
        >
          {selectedContextNodeIsFolder && (
            <>
              <ContextMenuItem
                text='New file...'
                clicked={() => console.log("New file clicked")}
              />
              <ContextMenuItem
                text='New folder...'
                clicked={() => console.log("New folder clicked")}
              />
              <ContextMenuSeparator />
            </>
          )}
          <ContextMenuItem
            text='Rename...'
            clicked={() => console.log("Rename clicked")}
          />
          <ContextMenuItem
            text='Delete'
            clicked={() => console.log("Delete clicked")}
          />
        </ContextMenu>

        <RenameDialog
          isFolder={true}
          oldPath='dddfdfd'
          isOpen={isRenameDialogOpen}
          onClose={() => {
            setIsRenameDialogOpen(false);
          }}
        />
        <NewItemDialog
          isFolder={false}
          rootPath='dddfdfd'
          isOpen={isNewItemDialogOpen}
          onClose={() => {
            setIsNewItemDialogOpen(false);
          }}
        />
        <VirtualizedListView
          items={visibleNodes}
          approxSize={20}
          fixItemHeight={false}
          svApiLoaded={api => (svApi.current = api)}
          vlApiLoaded={api => (vlApi.current = api)}
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
                  console.log(node);
                  setSelectedContextItem(idx);
                  setContextVisible(!contextVisible);
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

type RenameDialogProps = {
  isFolder?: boolean;
  oldPath: string;
  isOpen?: boolean;
  onClose: () => void;
};

const RenameDialog = ({
  isFolder,
  oldPath,
  isOpen,
  onClose
}: RenameDialogProps) => {
  const modalApi = useRef<ModalApi>(null);
  const [newPath, setNewPath] = useState(oldPath);
  return (
    <Modal
      title={isFolder ? "Rename folder" : "Rename file"}
      isOpen={isOpen}
      fullScreen={false}
      width={500}
      onApiLoaded={api => (modalApi.current = api)}
      primaryLabel='Rename'
      initialFocus='none'
      onPrimaryClicked={() => {
        console.log("Renamed to " + newPath);
        return false;
      }}
      onClose={() => {
        onClose();
      }}
    >
      <div>
        Rename <span className={styles.hilite}>{oldPath}</span> to:
      </div>
      <TextInput
        value={oldPath}
        focusOnInit={true}
        keyPressed={e => {
          if (e.code === "Enter") {
            modalApi.current.triggerPrimary(newPath);
          }
        }}
        valueChanged={val => {
          setNewPath(val);
          return false;
        }}
      />
    </Modal>
  );
};

type NewItemProps = {
  isFolder?: boolean;
  rootPath?: string;
  isOpen?: boolean;
  onClose: () => void;
};

const NewItemDialog = ({
  isFolder,
  rootPath,
  isOpen,
  onClose
}: NewItemProps) => {
  const modalApi = useRef<ModalApi>(null);
  const [newItem, setNewItem] = useState<string>();
  return (
    <Modal
      title={isFolder ? "Create new folder" : "Create new file"}
      isOpen={isOpen}
      fullScreen={false}
      width={500}
      onApiLoaded={api => (modalApi.current = api)}
      primaryLabel='Create'
      initialFocus='none'
      onPrimaryClicked={() => {
        console.log("Create " + newItem);
        return false;
      }}
      onClose={() => {
        onClose();
      }}
    >
      <div>
        Create a new {isFolder ? "folder" : "file"} in{" "}
        <span className={styles.hilite}>{rootPath}</span>:
      </div>
      <TextInput
        value={""}
        focusOnInit={true}
        keyPressed={e => {
          if (e.code === "Enter") {
            modalApi.current.triggerPrimary(newItem);
          }
        }}
        valueChanged={val => {
          setNewItem(val);
          return false;
        }}
      />
    </Modal>
  );
};

export const explorerPanelRenderer = () => <ExplorerPanel />;
