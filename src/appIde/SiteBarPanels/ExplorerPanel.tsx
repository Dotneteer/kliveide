import styles from "./ExplorerPanel.module.scss";
import { useRendererContext, useSelector } from "@/core/RendererProvider";
import { ITreeNode, ITreeView } from "@/core/tree-node";
import { MainGetDirectoryContentResponse } from "@messaging/any-to-main";
import { useEffect, useRef, useState } from "react";
import { buildProjectTree, ProjectNode } from "../project/project-node";
import { VirtualizedListView } from "@/controls/VirtualizedListView";
import { Icon } from "@/controls/Icon";
import { ScrollViewerApi } from "@/controls/ScrollViewer";
import { VirtualizedListApi } from "@/controls/VirtualizedList";
import { LabelSeparator } from "@/controls/Labels";
import classnames from "@/utils/classnames";
import { useAppServices } from "../services/AppServicesProvider";
import { Modal, ModalApi } from "@/controls/Modal";

const folderCache = new Map<string, ITreeView<ProjectNode>>();
let lastExplorerPath = "";

const ExplorerPanel = () => {
  const { messenger } = useRendererContext();
  const { projectService } = useAppServices();
  const [tree, setTree] = useState<ITreeView<ProjectNode>>(null);
  const [visibleNodes, setVisibleNodes] = useState<ITreeNode<ProjectNode>[]>(
    []
  );
  const [isOpen, setIsOpen] = useState(false);

  const [selected, setSelected] = useState(-1);
  const [isFocused, setIsFocused] = useState(false);
  const folderPath = useSelector(s => s.project?.folderPath);
  const isKliveProject = useSelector(s => s.project?.isKliveProject);

  const svApi = useRef<ScrollViewerApi>();
  const vlApi = useRef<VirtualizedListApi>();
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

  return folderPath ? (
    visibleNodes && visibleNodes.length > 0 ? (
      <div
        className={styles.explorerPanel}
        tabIndex={0}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onClick={() => {
          setIsOpen(true);
        }}
      >
        <Modal
          title="Rename file"
          isOpen={isOpen}
          fullScreen={false}
          width={500}
          cancelEnabled={false}
          secondaryVisible={true}
          secondaryLabel="Other"
          onApiLoaded={(api) => modalApi.current = api }
          onPrimaryClicked={() => {
            modalApi.current?.enableCancel(true);
            return false;
          }}
          onClose={() => {
            setIsOpen(false);
          }}
        >
          Rename the file...
        </Modal>
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
                    fill={isSelected ? "--color-chevron-selected" : "--color-chevron"}
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
      <button
        className={styles.openButton}
        disabled={false}
        onClick={async () => {
          await messenger.sendMessage({
            type: "MainOpenFolder"
          });
        }}
      >
        Open Folder
      </button>
    </>
  );
};

export const explorerPanelRenderer = () => <ExplorerPanel />;
